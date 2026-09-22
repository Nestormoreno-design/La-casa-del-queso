from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.catalogos import Cliente, Producto
from app.models.pedido import Despacho, Pedido, PedidoItem
from app.models.usuario import Usuario
from app.schemas.operaciones import CheckoutIn, PedidoCreate
from app.services.inventario import registrar_movimiento

router = APIRouter(tags=["pedidos-despachos"])

ESTADOS = ("PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO", "CANCELADO")

# Transiciones manuales permitidas (LISTO vía /generar-venta, ENTREGADO vía /entregar)
TRANSICIONES = {
    "PENDIENTE": ("PREPARANDO", "CANCELADO"),
    "PREPARANDO": ("CANCELADO",),
    "LISTO": ("CANCELADO",),
    "ENTREGADO": (),
    "CANCELADO": (),
}


@router.get("/pedidos")
def list_pedidos(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    return db.query(Pedido).order_by(Pedido.id.desc()).limit(200).all()


@router.get("/pedidos/{pid}")
def get_pedido(pid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    return p


@router.post("/pedidos", status_code=201)
def create_pedido(body: PedidoCreate, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    if body.cliente_id:
        cli = db.get(Cliente, body.cliente_id)
        if not cli or not cli.activo:
            raise HTTPException(400, "Cliente inválido")
    pedido = Pedido(cliente_id=body.cliente_id, fecha_entrega=body.fecha_entrega,
                    hora_entrega=body.hora_entrega,
                    direccion_entrega=body.direccion_entrega, observaciones=body.observaciones,
                    estado="PENDIENTE")
    db.add(pedido)
    db.flush()
    total = Decimal("0")
    for it in body.items:
        prod = db.get(Producto, it.producto_id)
        if not prod or not prod.activo:
            raise HTTPException(400, f"Producto {it.producto_id} inválido")
        precio = it.precio_unitario if it.precio_unitario is not None else Decimal(prod.precio_venta)
        sub = (Decimal(it.cantidad) * Decimal(precio)).quantize(Decimal("0.01"))
        total += sub
        db.add(PedidoItem(pedido_id=pedido.id, producto_id=prod.id, cantidad=it.cantidad,
                          precio_unitario=precio, subtotal=sub))
    pedido.total = total
    db.commit()
    db.refresh(pedido)
    return {"id": pedido.id, "total": str(total), "estado": pedido.estado}


@router.put("/pedidos/{pid}")
def update_pedido(pid: int, body: PedidoCreate, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    """Editar pedido solo mientras esté PENDIENTE (no ha movido inventario)."""
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado != "PENDIENTE":
        raise HTTPException(400, f"Solo PENDIENTE puede editarse (actual: {p.estado})")
    if body.cliente_id:
        cli = db.get(Cliente, body.cliente_id)
        if not cli or not cli.activo:
            raise HTTPException(400, "Cliente inválido")
    p.cliente_id = body.cliente_id
    p.fecha_entrega = body.fecha_entrega
    p.hora_entrega = body.hora_entrega
    p.direccion_entrega = body.direccion_entrega
    p.observaciones = body.observaciones
    for old in list(p.items):
        db.delete(old)
    db.flush()
    total = Decimal("0")
    for it in body.items:
        prod = db.get(Producto, it.producto_id)
        if not prod or not prod.activo:
            raise HTTPException(400, f"Producto {it.producto_id} inválido")
        precio = it.precio_unitario if it.precio_unitario is not None else Decimal(prod.precio_venta)
        sub = (Decimal(it.cantidad) * Decimal(precio)).quantize(Decimal("0.01"))
        total += sub
        db.add(PedidoItem(pedido_id=p.id, producto_id=prod.id, cantidad=it.cantidad,
                          precio_unitario=precio, subtotal=sub))
    p.total = total
    db.commit()
    return {"ok": True, "total": str(total)}


@router.delete("/pedidos/{pid}")
def delete_pedido(pid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if db.query(Despacho).filter(Despacho.pedido_id == pid).first():
        raise HTTPException(400, "El pedido ya tiene despacho; no puede eliminarse")
    if p.estado == "PENDIENTE":
        db.delete(p)  # sin movimientos asociados: eliminación física segura
        db.commit()
        return {"ok": True, "eliminado": True}
    if p.estado in ("EN_PREPARACION", "PREPARANDO"):
        p.estado = "CANCELADO"  # baja lógica: conserva historial
        db.commit()
        return {"ok": True, "estado": "CANCELADO"}
    raise HTTPException(400, f"No puede cancelarse en estado {p.estado}")
@router.post("/pedidos/{pid}/estado")
def cambiar_estado(pid: int, body: dict, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    nuevo = str(body.get("estado", "")).upper()
    if nuevo not in ESTADOS:
        raise HTTPException(400, f"Estado inválido: {nuevo}")
    if nuevo not in TRANSICIONES.get(p.estado, ()):
        raise HTTPException(400, f"No se puede pasar de {p.estado} a {nuevo}")
    p.estado = nuevo
    db.commit()
    return {"ok": True, "estado": nuevo}


@router.post("/pedidos/{pid}/generar-venta")
def generar_venta(pid: int, body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Genera la venta y factura DEMO sin descontar inventario. Pedido -> LISTO."""
    from app.models.venta import Venta, VentaItem

    METODOS = ("EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO")
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado not in ("PENDIENTE", "PREPARANDO"):
        raise HTTPException(400, f"Solo PENDIENTE o PREPARANDO generan venta (actual: {p.estado})")
    ya = db.query(Venta).filter(Venta.pedido_id == pid, Venta.estado != "ANULADA").first()
    if ya:
        raise HTTPException(400, f"El pedido ya tiene venta #{ya.id}")
    metodo = str(body.get("metodo_pago", "EFECTIVO"))
    if metodo not in METODOS:
        raise HTTPException(400, f"Método de pago inválido: {metodo}")
    try:
        with db.begin_nested():
            subtotal = Decimal("0")
            venta = Venta(cliente_id=p.cliente_id, descuento=Decimal("0"), metodo_pago=metodo,
                          canal="PEDIDO", tipo="DISTRIBUCION", estado="FACTURADA",
                          caja_sesion_id=None, usuario_id=user.id, pedido_id=p.id,
                          observaciones=f"Pedido #{p.id}")
            db.add(venta)
            db.flush()
            for it in p.items:
                prod = db.get(Producto, it.producto_id)
                if not prod or not prod.activo:
                    raise HTTPException(400, f"Producto {it.producto_id} inválido")
                sub = (Decimal(it.cantidad) * Decimal(it.precio_unitario)).quantize(Decimal("0.01"))
                subtotal += sub
                db.add(VentaItem(venta_id=venta.id, producto_id=prod.id, cantidad=it.cantidad,
                                 precio_unitario=it.precio_unitario, subtotal=sub))
            venta.subtotal = subtotal
            venta.total = subtotal
            p.estado = "LISTO"
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(400, str(e))
    return {"ok": True, "venta_id": venta.id, "total": str(venta.total)}


@router.post("/pedidos/{pid}/entregar")
def entregar_pedido(pid: int, body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Confirmar entrega: descuenta inventario, registra caja y marca ENTREGADO/PAGADA."""
    from app.models.venta import Venta, VentaItem
    from app.models.caja import CajaMovimiento

    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado != "LISTO":
        raise HTTPException(400, f"Solo LISTO puede entregarse (actual: {p.estado})")
    venta = db.query(Venta).filter(Venta.pedido_id == pid, Venta.estado == "FACTURADA").first()
    if not venta:
        raise HTTPException(400, "El pedido no tiene venta generada. Genere la venta primero.")
    metodo = str(body.get("metodo_pago") or venta.metodo_pago)
    from app.models.caja import CajaSesion
    caja_id = body.get("caja_sesion_id")
    if caja_id is not None:
        sc = db.get(CajaSesion, caja_id)
        if not sc or sc.estado != "ABIERTA":
            raise HTTPException(400, "La caja indicada no está abierta")
    else:
        sc = db.query(CajaSesion).filter(CajaSesion.estado == "ABIERTA").first()
        if not sc:
            raise HTTPException(400, "Debes abrir la caja antes de registrar ventas.")
        caja_id = sc.id
    try:
        with db.begin_nested():
            subtotal = Decimal("0")
            for it in venta.items:
                prod = db.get(Producto, it.producto_id)
                if not prod or not prod.activo:
                    raise HTTPException(400, f"Producto {it.producto_id} inválido")
                subtotal += Decimal(it.subtotal)
                registrar_movimiento(db, prod, "SALIDA", Decimal(it.cantidad),
                                     motivo=f"Pedido #{p.id} entregado", ref_tipo="PEDIDO",
                                     ref_id=p.id, usuario_id=user.id)
            venta.subtotal = subtotal
            venta.total = subtotal
            venta.metodo_pago = metodo
            venta.estado = "PAGADA"
            venta.caja_sesion_id = caja_id
            db.add(CajaMovimiento(sesion_id=caja_id, tipo="VENTA", monto=venta.total,
                                  metodo_pago=metodo, descripcion=f"Pedido #{p.id} -> Venta #{venta.id}",
                                  venta_id=venta.id, usuario_id=user.id))
            p.estado = "ENTREGADO"
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(400, str(e))
    return {"ok": True, "venta_id": venta.id, "total": str(venta.total)}


@router.get("/despachos")
def list_despachos(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    return db.query(Despacho).order_by(Despacho.id.desc()).limit(200).all()


@router.post("/despachos", status_code=201)
def create_despacho(body: dict, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    pid = body.get("pedido_id")
    p = db.get(Pedido, pid) if pid else None
    if not p:
        raise HTTPException(400, "Pedido inválido")
    if db.query(Despacho).filter(Despacho.pedido_id == pid).first():
        raise HTTPException(400, "Pedido ya tiene despacho")
    d = Despacho(pedido_id=pid, responsable=body.get("responsable"), observaciones=body.get("observaciones"))
    db.add(d)
    if p.estado not in ("DESPACHADO", "ENTREGADO"):
        p.estado = "DESPACHADO"
    db.commit()
    db.refresh(d)
    return {"id": d.id, "pedido_id": pid}
