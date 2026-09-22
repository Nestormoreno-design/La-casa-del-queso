from datetime import date, datetime, time, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.caja import CajaMovimiento
from app.models.catalogos import Cliente, Producto
from app.models.usuario import Usuario
from app.models.venta import Venta, VentaItem
from app.schemas.operaciones import CheckoutIn
from app.services.inventario import registrar_movimiento

router = APIRouter(tags=["ventas-pos"])

METODOS = ("EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO")


def _checkout(db: Session, body: CheckoutIn, user: Usuario, canal: str = "POS") -> Venta:
    if body.metodo_pago not in METODOS:
        raise HTTPException(400, f"Método de pago inválido: {body.metodo_pago}")
    if body.cliente_id:
        cli = db.get(Cliente, body.cliente_id)
        if not cli or not cli.activo:
            raise HTTPException(400, "Cliente inválido")
    if body.metodo_pago == "CREDITO" and not body.cliente_id:
        raise HTTPException(400, "El crédito requiere seleccionar un cliente.")
    a_credito = body.metodo_pago == "CREDITO"
    # REGLA MVP: no se puede vender sin caja abierta (excepto crédito, que queda pendiente).
    from app.models.caja import CajaSesion
    sesion_id = body.caja_sesion_id
    if a_credito:
        if sesion_id is not None:
            s = db.get(CajaSesion, sesion_id)
            if not s or s.estado != "ABIERTA":
                raise HTTPException(400, "La caja indicada no está abierta")
    elif sesion_id is not None:
        s = db.get(CajaSesion, sesion_id)
        if not s or s.estado != "ABIERTA":
            raise HTTPException(400, "La caja indicada no está abierta")
    else:
        s = db.query(CajaSesion).filter(CajaSesion.estado == "ABIERTA").first()
        if not s:
            raise HTTPException(400, "Debes abrir la caja antes de registrar ventas.")
        sesion_id = s.id
    try:
        with db.begin_nested():
            subtotal = Decimal("0")
            venta = Venta(cliente_id=body.cliente_id, descuento=body.descuento or Decimal("0"),
                          metodo_pago=body.metodo_pago, canal=canal, tipo="MENUDEO",
                          estado="PENDIENTE" if a_credito else "PAGADA",
                          caja_sesion_id=sesion_id, usuario_id=user.id,
                          observaciones=body.observaciones)
            db.add(venta)
            db.flush()
            for it in body.items:
                prod = db.get(Producto, it.producto_id)
                if not prod or not prod.activo:
                    raise HTTPException(400, f"Producto {it.producto_id} inválido")
                precio = it.precio_unitario if it.precio_unitario is not None else Decimal(prod.precio_venta)
                if precio < 0:
                    raise HTTPException(400, "Precio inválido")
                sub = (Decimal(it.cantidad) * Decimal(precio)).quantize(Decimal("0.01"))
                subtotal += sub
                db.add(VentaItem(venta_id=venta.id, producto_id=prod.id, cantidad=it.cantidad,
                                 precio_unitario=precio, subtotal=sub))
                # Descuento de inventario dentro de la misma transacción
                registrar_movimiento(db, prod, "SALIDA", Decimal(it.cantidad),
                                     motivo=f"Venta #{venta.id} ({canal})", ref_tipo="VENTA",
                                     ref_id=venta.id, usuario_id=user.id)
            if venta.descuento > subtotal:
                raise HTTPException(400, "Descuento mayor al subtotal")
            venta.subtotal = subtotal
            venta.total = subtotal - venta.descuento
            db.flush()
            if a_credito:
                from app.models.credito import Credito
                db.add(Credito(cliente_id=body.cliente_id, venta_id=venta.id,
                               monto_total=venta.total, saldo_pendiente=venta.total,
                               estado="PENDIENTE",
                               observaciones=f"Venta {canal} #{venta.id} a crédito"))
            else:
                db.add(CajaMovimiento(sesion_id=sesion_id, tipo="VENTA", monto=venta.total,
                                      metodo_pago=venta.metodo_pago, descripcion=f"Venta #{venta.id}",
                                      venta_id=venta.id, usuario_id=user.id))
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
    db.refresh(venta)
    return venta


@router.post("/pos/checkout", status_code=201)
def pos_checkout(body: CheckoutIn, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if user.rol == "conductor":
        raise HTTPException(403, "El conductor no puede registrar ventas")
    v = _checkout(db, body, user, canal="POS")
    return {"id": v.id, "total": str(v.total), "estado": v.estado}


@router.get("/ventas")
def list_ventas(
    desde: date | None = Query(default=None),
    hasta: date | None = Query(default=None),
    cliente_id: int | None = Query(default=None),
    metodo_pago: str | None = Query(default=None),
    estado: str | None = Query(default=None),
    tipo: str | None = Query(default=None),
    db: Session = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    q = db.query(Venta)
    if desde:
        q = q.filter(Venta.fecha >= datetime.combine(desde, time.min).replace(tzinfo=timezone.utc))
    if hasta:
        q = q.filter(Venta.fecha <= datetime.combine(hasta, time.max).replace(tzinfo=timezone.utc))
    if cliente_id:
        q = q.filter(Venta.cliente_id == cliente_id)
    if metodo_pago:
        q = q.filter(Venta.metodo_pago == metodo_pago)
    if estado:
        q = q.filter(Venta.estado == estado)
    if tipo:
        q = q.filter(Venta.tipo == tipo)
    return q.order_by(Venta.id.desc()).limit(500).all()


@router.get("/ventas/{vid}")
def get_venta(vid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    v = db.get(Venta, vid)
    if not v:
        raise HTTPException(404, "Venta no encontrada")
    return v


@router.post("/ventas/{vid}/anular")
def anular_venta(vid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    v = db.get(Venta, vid)
    if not v:
        raise HTTPException(404, "Venta no encontrada")
    if v.estado == "ANULADA":
        raise HTTPException(400, "Ya anulada")
    if v.estado not in ("PAGADA", "PENDIENTE", "FACTURADA"):
        raise HTTPException(400, f"No se puede anular en estado {v.estado}")
    try:
        with db.begin_nested():
            if v.estado in ("PAGADA", "PENDIENTE"):
                # Ambas movieron inventario y (PAGADA) caja: revertir
                for it in v.items:
                    prod = db.get(Producto, it.producto_id)
                    registrar_movimiento(db, prod, "ENTRADA", Decimal(it.cantidad),
                                         motivo=f"Anulación venta #{v.id}", ref_tipo="VENTA",
                                         ref_id=v.id, usuario_id=user.id)
                # Revertir movimiento de caja asociado (la venta anulada no cuenta)
                db.query(CajaMovimiento).filter(CajaMovimiento.venta_id == v.id).delete()
                # Si era crédito pendiente, cerrarlo sin saldo
                if v.estado == "PENDIENTE":
                    from app.models.credito import Credito
                    for c in db.query(Credito).filter(Credito.venta_id == v.id, Credito.estado == "PENDIENTE").all():
                        c.estado = "PAGADO"
                        c.saldo_pendiente = Decimal("0")
                        c.observaciones = ((c.observaciones or "") + " | Anulada la venta").strip()
            # FACTURADA nunca descontó: solo se marca, y el pedido vuelve a EN PREPARACIÓN
            if v.pedido_id and v.estado == "FACTURADA":
                from app.models.pedido import Pedido
                ped = db.get(Pedido, v.pedido_id)
                if ped and ped.estado == "EN DISTRIBUCIÓN":
                    ped.estado = "EN PREPARACIÓN"
            v.estado = "ANULADA"
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, str(e))
    return {"ok": True}
