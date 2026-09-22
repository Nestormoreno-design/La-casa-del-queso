from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.catalogos import Cliente, Producto
from app.models.pedido import Despacho, Pedido, PedidoItem
from app.models.usuario import Usuario
from app.schemas.operaciones import PedidoCreate

router = APIRouter(tags=["pedidos-despachos"])

# Nomenclatura única requerida:
# PENDIENTE -> EN PREPARACIÓN -> EN DISTRIBUCIÓN -> ENTREGADO
# EN DISTRIBUCIÓN -> DEVUELTO
ESTADOS = ("PENDIENTE", "EN PREPARACIÓN", "EN DISTRIBUCIÓN", "ENTREGADO", "DEVUELTO")

# Transiciones manuales permitidas (generar-venta y entregar usan endpoints dedicados).
TRANSICIONES = {
    "PENDIENTE": ("EN PREPARACIÓN",),
    "EN PREPARACIÓN": ("PENDIENTE",),
    "EN DISTRIBUCIÓN": (),
    "ENTREGADO": (),
    "DEVUELTO": (),
}

ROLES_ADMIN = ("administrador",)
ROLES_OPERATIVOS = ("administrador", "vendedor", "bodeguero")
ROLES_CONDUCTOR = ("conductor", "administrador")


def _conductor_ok(db: Session, cid: int | None):
    if cid is None:
        return
    u = db.get(Usuario, cid)
    if not u or not u.activo or u.rol != "conductor":
        raise HTTPException(400, "Conductor inválido (debe ser un usuario con rol conductor)")


def _pedido_out(p: Pedido) -> dict:
    return {
        "id": p.id,
        "cliente_id": p.cliente_id,
        "cliente": {"id": p.cliente.id, "nombre": p.cliente.nombre} if p.cliente else None,
        "fecha": p.fecha.isoformat() if p.fecha else None,
        "fecha_entrega": p.fecha_entrega.isoformat() if p.fecha_entrega else None,
        "hora_entrega": p.hora_entrega,
        "estado": p.estado,
        "total": str(p.total),
        "direccion_entrega": p.direccion_entrega,
        "observaciones": p.observaciones,
        "conductor_id": p.conductor_id,
        "conductor": p.conductor.username if getattr(p, "conductor", None) else None,
        "items": [
            {
                "id": it.id,
                "producto_id": it.producto_id,
                "producto": {"id": it.producto.id, "nombre": it.producto.nombre,
                             "unidad_medida": it.producto.unidad_medida} if it.producto else None,
                "cantidad": str(it.cantidad),
                "precio_unitario": str(it.precio_unitario),
                "subtotal": str(it.subtotal),
            }
            for it in (p.items or [])
        ],
    }


@router.get("/pedidos")
def list_pedidos(
    estado: str | None = Query(default=None),
    conductor_id: int | None = Query(default=None),
    mios: bool = Query(default=False),
    db: Session = Depends(get_db),
    user: Usuario = Depends(get_current_user),
):
    q = db.query(Pedido)
    # Sin asignación: el conductor ve todo lo que está EN DISTRIBUCIÓN.
    if user.rol == "conductor":
        q = q.filter(Pedido.estado == "EN DISTRIBUCIÓN")
    if estado:
        q = q.filter(Pedido.estado == estado)
    if conductor_id:
        # Compatibilidad: columna conservada pero no se usa para visibilidad.
        q = q.filter(Pedido.conductor_id == conductor_id)
    items = q.order_by(Pedido.id.desc()).limit(200).all()
    return [_pedido_out(p) for p in items]


@router.get("/pedidos/mis-entregas")
def mis_entregas(db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Vista del conductor: todo pedido EN DISTRIBUCIÓN, sin requerir asignación.

    Solo necesita el usuario autenticado; no recibe conductor_id ni vehículo.
    """
    if user.rol not in ("conductor", "administrador"):
        raise HTTPException(403, "Solo conductor")
    q = db.query(Pedido).filter(Pedido.estado == "EN DISTRIBUCIÓN")
    return [_pedido_out(p) for p in q.order_by(Pedido.id.desc()).limit(200).all()]


@router.get("/pedidos/{pid}")
def get_pedido(pid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    return _pedido_out(p)


@router.post("/pedidos", status_code=201)
def create_pedido(body: PedidoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if user.rol == "conductor":
        raise HTTPException(403, "El conductor no puede crear pedidos")
    if not body.items or len(body.items) == 0:
        raise HTTPException(400, "Debes agregar al menos un producto al pedido.")
    if body.cliente_id:
        cli = db.get(Cliente, body.cliente_id)
        if not cli or not cli.activo:
            raise HTTPException(400, "Selecciona un cliente válido.")
    for it in body.items:
        if Decimal(str(it.cantidad)) <= 0:
            raise HTTPException(400, "Las cantidades deben ser mayores a 0.")
    _conductor_ok(db, body.conductor_id)
    pedido = Pedido(cliente_id=body.cliente_id, fecha_entrega=body.fecha_entrega,
                    hora_entrega=body.hora_entrega,
                    direccion_entrega=body.direccion_entrega, observaciones=body.observaciones,
                    conductor_id=body.conductor_id, estado="PENDIENTE")
    db.add(pedido)
    db.flush()
    total = Decimal("0")
    for it in body.items:
        prod = db.get(Producto, it.producto_id)
        if not prod or not prod.activo:
            raise HTTPException(400, f"Producto {it.producto_id} inválido")
        precio = it.precio_unitario if it.precio_unitario is not None else Decimal(prod.precio_venta)
        sub = (Decimal(str(it.cantidad)) * Decimal(precio)).quantize(Decimal("0.01"))
        total += sub
        db.add(PedidoItem(pedido_id=pedido.id, producto_id=prod.id, cantidad=it.cantidad,
                          precio_unitario=precio, subtotal=sub))
    pedido.total = total
    db.commit()
    db.refresh(pedido)
    return {"id": pedido.id, "total": str(total), "estado": pedido.estado}


@router.put("/pedidos/{pid}")
def update_pedido(pid: int, body: PedidoCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Editar pedido solo mientras esté PENDIENTE o EN PREPARACIÓN (no ha descontado inventario)."""
    if user.rol == "conductor":
        raise HTTPException(403, "El conductor no puede editar pedidos")
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado not in ("PENDIENTE", "EN PREPARACIÓN"):
        raise HTTPException(400, f"Solo PENDIENTE o EN PREPARACIÓN puede editarse (actual: {p.estado})")
    if not body.items or len(body.items) == 0:
        raise HTTPException(400, "Debes agregar al menos un producto al pedido.")
    if body.cliente_id:
        cli = db.get(Cliente, body.cliente_id)
        if not cli or not cli.activo:
            raise HTTPException(400, "Selecciona un cliente válido.")
    _conductor_ok(db, body.conductor_id)
    p.cliente_id = body.cliente_id
    p.fecha_entrega = body.fecha_entrega
    p.hora_entrega = body.hora_entrega
    p.direccion_entrega = body.direccion_entrega
    p.observaciones = body.observaciones
    if body.conductor_id is not None:
        p.conductor_id = body.conductor_id
    for old in list(p.items):
        db.delete(old)
    db.flush()
    total = Decimal("0")
    for it in body.items:
        prod = db.get(Producto, it.producto_id)
        if not prod or not prod.activo:
            raise HTTPException(400, f"Producto {it.producto_id} inválido")
        precio = it.precio_unitario if it.precio_unitario is not None else Decimal(prod.precio_venta)
        sub = (Decimal(str(it.cantidad)) * Decimal(precio)).quantize(Decimal("0.01"))
        total += sub
        db.add(PedidoItem(pedido_id=p.id, producto_id=prod.id, cantidad=it.cantidad,
                          precio_unitario=precio, subtotal=sub))
    p.total = total
    db.commit()
    return {"ok": True, "total": str(total)}


@router.post("/pedidos/{pid}/asignar")
def asignar_conductor(pid: int, body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if user.rol not in ("administrador", "vendedor", "bodeguero"):
        raise HTTPException(403, "Sin permiso para asignar conductor")
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    cid = body.get("conductor_id")
    _conductor_ok(db, cid)
    p.conductor_id = cid
    db.commit()
    return {"ok": True, "conductor_id": cid}


@router.delete("/pedidos/{pid}")
def delete_pedido(pid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if user.rol == "conductor":
        raise HTTPException(403, "El conductor no puede eliminar pedidos")
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if db.query(Despacho).filter(Despacho.pedido_id == pid).first():
        raise HTTPException(400, "El pedido ya tiene despacho; no puede eliminarse")
    from app.models.venta import Venta
    if db.query(Venta).filter(Venta.pedido_id == pid).first():
        raise HTTPException(400, "El pedido ya tiene venta generada; no puede eliminarse")
    if p.estado == "PENDIENTE":
        db.delete(p)  # sin movimientos asociados: eliminación física segura
        db.commit()
        return {"ok": True, "eliminado": True}
    raise HTTPException(400, f"Solo PENDIENTE puede eliminarse (actual: {p.estado})")


@router.post("/pedidos/{pid}/estado")
def cambiar_estado(pid: int, body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    nuevo = " ".join(str(body.get("estado", "")).strip().upper().split())
    # Normalizar variantes sin tildes/guiones que pueda enviar un cliente viejo.
    alias = {
        "EN PREPARACION": "EN PREPARACIÓN",
        "EN_PREPARACION": "EN PREPARACIÓN",
        "EN-PREPARACION": "EN PREPARACIÓN",
        "EN-PREPARACIÓN": "EN PREPARACIÓN",
        "EN PREPARACIÓN": "EN PREPARACIÓN",
        "PREPARANDO": "EN PREPARACIÓN",
        "EN DISTRIBUCION": "EN DISTRIBUCIÓN",
        "EN_DISTRIBUCION": "EN DISTRIBUCIÓN",
        "EN-DISTRIBUCION": "EN DISTRIBUCIÓN",
        "EN-DISTRIBUCIÓN": "EN DISTRIBUCIÓN",
        "EN DISTRIBUCIÓN": "EN DISTRIBUCIÓN",
        "LISTO": "EN DISTRIBUCIÓN",
        "PROGRAMADO": "PENDIENTE",
        "CANCELADO": "PENDIENTE",
        "PENDIENTE": "PENDIENTE",
        "ENTREGADO": "ENTREGADO",
        "DEVUELTO": "DEVUELTO",
    }
    nuevo = alias.get(nuevo, nuevo)
    if nuevo not in ESTADOS:
        raise HTTPException(400, f"Estado inválido: {nuevo}. Válidos: {', '.join(ESTADOS)}")
    # Estados finales solo conductor (admin conserva override operativo).
    if nuevo in ("ENTREGADO", "DEVUELTO"):
        raise HTTPException(
            400,
            "Usa la acción de entrega/devolución del conductor para marcar ENTREGADO o DEVUELTO.",
        )
    if user.rol == "conductor":
        raise HTTPException(403, "El conductor solo puede marcar ENTREGADO o DEVUELTO desde sus entregas")
    # El paso a EN DISTRIBUCIÓN siempre genera la venta (no es un cambio manual).
    if nuevo == "EN DISTRIBUCIÓN":
        raise HTTPException(
            400,
            "Para pasar a EN DISTRIBUCIÓN usa 'A distribución' (generar venta), no el cambio manual.",
        )
    if nuevo not in TRANSICIONES.get(p.estado, ()):
        raise HTTPException(400, f"No se puede pasar de {p.estado} a {nuevo}")
    p.estado = nuevo
    db.commit()
    return {"ok": True, "estado": nuevo}


@router.post("/pedidos/{pid}/generar-venta")
def generar_venta(pid: int, body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Genera la venta y factura sin descontar inventario. Pedido -> EN DISTRIBUCIÓN."""
    from app.models.venta import Venta, VentaItem

    if user.rol == "conductor":
        raise HTTPException(403, "El conductor no puede generar ventas")
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado not in ("PENDIENTE", "EN PREPARACIÓN"):
        raise HTTPException(400, f"Solo PENDIENTE o EN PREPARACIÓN generan venta (actual: {p.estado})")
    ya = db.query(Venta).filter(Venta.pedido_id == pid, Venta.estado != "ANULADA").first()
    if ya:
        raise HTTPException(400, f"El pedido ya tiene venta #{ya.id}")
    # El pedido no pide método de pago (punto 8): la venta se genera sin cobro.
    try:
        with db.begin_nested():
            subtotal = Decimal("0")
            venta = Venta(cliente_id=p.cliente_id, descuento=Decimal("0"), metodo_pago="EFECTIVO",
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
            p.estado = "EN DISTRIBUCIÓN"
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
    """Confirmar entrega (conductor o admin).

    - Conductor: solo cambia a ENTREGADO y descuenta inventario. NO opera caja:
      no exige caja abierta, no crea movimientos de caja. Si es CREDITO crea el
      crédito; si es contado, la venta queda FACTURADA para que el mostrador
      (vendedor/admin) registre manualmente el dinero en Caja.
    - Admin: conserva el flujo actual (registra caja o crédito al entregar).
    """
    from app.models.caja import CajaMovimiento
    from app.models.credito import Credito
    from app.models.venta import Venta

    if user.rol not in ROLES_CONDUCTOR:
        raise HTTPException(403, "Solo el conductor puede marcar ENTREGADO (el administrador conserva acceso operativo).")
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado != "EN DISTRIBUCIÓN":
        raise HTTPException(400, f"Solo EN DISTRIBUCIÓN puede entregarse (actual: {p.estado})")
    venta = db.query(Venta).filter(Venta.pedido_id == pid, Venta.estado == "FACTURADA").first()
    if not venta:
        raise HTTPException(400, "El pedido no tiene venta generada. Genere la venta primero.")
    metodo = str(body.get("metodo_pago") or venta.metodo_pago or "EFECTIVO").upper()
    METODOS = ("EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO")
    if metodo not in METODOS:
        raise HTTPException(400, f"Método de pago inválido: {metodo}")
    a_credito = metodo == "CREDITO"
    if a_credito and not p.cliente_id:
        raise HTTPException(400, "El crédito requiere un cliente asignado al pedido.")
    from app.models.caja import CajaSesion
    from app.services.inventario import registrar_movimiento
    # El conductor NO opera caja: no se le exige caja abierta y nunca genera
    # movimientos de caja. Solo descuenta inventario y marca ENTREGADO.
    if user.rol == "conductor":
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
                if a_credito:
                    venta.estado = "PENDIENTE"
                    venta.caja_sesion_id = None
                    db.flush()
                    db.add(Credito(cliente_id=p.cliente_id, venta_id=venta.id, pedido_id=p.id,
                                   monto_total=subtotal, saldo_pendiente=subtotal,
                                   estado="PENDIENTE",
                                   observaciones=f"Pedido #{p.id} entregado a crédito"))
                else:
                    # Contado: queda FACTURADA para que el mostrador registre
                    # manualmente el dinero en Caja (INGRESO). Sin movimiento auto.
                    venta.estado = "FACTURADA"
                    venta.caja_sesion_id = None
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
        return {"ok": True, "venta_id": venta.id, "total": str(venta.total),
                "a_credito": a_credito}
    # Flujo intacto para admin: registra caja o crédito al entregar.
    caja_id = body.get("caja_sesion_id")
    sc = None
    if a_credito:
        # Crédito: no exige caja abierta ni mueve caja.
        if caja_id is not None:
            sc = db.get(CajaSesion, caja_id)
            if not sc or sc.estado != "ABIERTA":
                raise HTTPException(400, "La caja indicada no está abierta")
            caja_id = sc.id
    else:
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
            if a_credito:
                venta.estado = "PENDIENTE"
                venta.caja_sesion_id = caja_id
                db.flush()
                db.add(Credito(cliente_id=p.cliente_id, venta_id=venta.id, pedido_id=p.id,
                               monto_total=subtotal, saldo_pendiente=subtotal,
                               estado="PENDIENTE",
                               observaciones=f"Pedido #{p.id} entregado a crédito"))
            else:
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
    return {"ok": True, "venta_id": venta.id, "total": str(venta.total),
            "a_credito": a_credito}


@router.post("/pedidos/{pid}/devolver")
def devolver_pedido(pid: int, body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Marcar DEVUELTO (SOLO conductor o admin): anula la venta FACTURADA sin mover inventario."""
    from app.models.venta import Venta

    if user.rol not in ROLES_CONDUCTOR:
        raise HTTPException(403, "Solo el conductor puede marcar DEVUELTO (el administrador conserva acceso operativo).")
    p = db.get(Pedido, pid)
    if not p:
        raise HTTPException(404, "Pedido no encontrado")
    if p.estado != "EN DISTRIBUCIÓN":
        raise HTTPException(400, f"Solo EN DISTRIBUCIÓN puede devolverse (actual: {p.estado})")
    venta = db.query(Venta).filter(Venta.pedido_id == pid, Venta.estado == "FACTURADA").first()
    motivo = str((body or {}).get("observaciones") or "Devolución del conductor")
    if venta:
        venta.estado = "ANULADA"
        venta.observaciones = ((venta.observaciones or "") + f" | DEVUELTO: {motivo}").strip()
    p.observaciones = ((p.observaciones or "") + f" | DEVUELTO: {motivo}").strip()
    p.estado = "DEVUELTO"
    db.commit()
    return {"ok": True, "estado": "DEVUELTO"}


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
    if p.estado not in ("ENTREGADO", "DEVUELTO"):
        p.estado = "EN DISTRIBUCIÓN"
    db.commit()
    db.refresh(d)
    return {"id": d.id, "pedido_id": pid}
