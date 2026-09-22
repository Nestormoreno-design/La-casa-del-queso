from datetime import date, datetime, time, timezone
from decimal import Decimal
from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.catalogos import Cliente, Producto
from app.models.usuario import Usuario
from app.models.venta import Venta, VentaItem

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _day_bounds(fecha: date):
    start = datetime.combine(fecha, time.min).replace(tzinfo=timezone.utc)
    end = datetime.combine(fecha, time.max).replace(tzinfo=timezone.utc)
    return start, end


@router.get("/resumen")
def resumen(fecha: date | None = Query(default=None), db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    hoy = fecha or datetime.now(timezone.utc).date()
    d0, d1 = _day_bounds(hoy)
    m0 = datetime(hoy.year, hoy.month, 1, tzinfo=timezone.utc)
    estados_ok = ("PAGADA", "PENDIENTE")
    ventas_dia = db.query(func.coalesce(func.sum(Venta.total), 0)).filter(
        Venta.fecha >= d0, Venta.fecha <= d1, Venta.estado.in_(estados_ok)).scalar() or 0
    ventas_mes = db.query(func.coalesce(func.sum(Venta.total), 0)).filter(
        Venta.fecha >= m0, Venta.estado.in_(estados_ok)).scalar() or 0
    n_dia = db.query(func.count(Venta.id)).filter(
        Venta.fecha >= d0, Venta.fecha <= d1, Venta.estado.in_(estados_ok)).scalar() or 0
    return {"ventas_dia": str(ventas_dia), "ventas_mes": str(ventas_mes), "num_ventas_dia": n_dia, "fecha": str(hoy)}


@router.get("/top-productos")
def top_productos(limite: int = 5, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    rows = db.query(Producto.nombre, func.sum(VentaItem.cantidad).label("cant"),
                    func.sum(VentaItem.subtotal).label("ing")).join(
        VentaItem, VentaItem.producto_id == Producto.id).join(
        Venta, Venta.id == VentaItem.venta_id).filter(Venta.estado.in_(("PAGADA", "PENDIENTE"))).group_by(
        Producto.nombre).order_by(func.sum(VentaItem.subtotal).desc()).limit(limite).all()
    top = [{"producto": r[0], "cantidad": str(r[1]), "ingresos": str(r[2])} for r in rows]
    return {"top": top, "mas_vendido": top[0] if top else None}


@router.get("/top-clientes")
def top_clientes(limite: int = 5, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    rows = db.query(Cliente.nombre, func.sum(Venta.total).label("tot")).join(
        Venta, Venta.cliente_id == Cliente.id).filter(Venta.estado.in_(("PAGADA", "PENDIENTE"))).group_by(
        Cliente.nombre).order_by(func.sum(Venta.total).desc()).limit(limite).all()
    top = [{"cliente": r[0], "total": str(r[1])} for r in rows]
    return {"top": top, "top_cliente": top[0] if top else None}


@router.get("/stock-bajo")
def stock_bajo(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    prods = db.query(Producto).filter(Producto.activo == True).all()  # noqa: E712
    bajos = [p for p in prods if Decimal(p.stock_actual) <= Decimal(p.stock_minimo)]
    return [{"id": p.id, "codigo": p.codigo, "nombre": p.nombre,
             "stock": str(p.stock_actual), "minimo": str(p.stock_minimo)} for p in bajos]


@router.get("/valorizacion")
def valorizacion(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    prods = db.query(Producto).filter(Producto.activo == True).all()  # noqa: E712
    total = sum((Decimal(p.stock_actual) * Decimal(p.costo_promedio) for p in prods), Decimal("0"))
    return {"valor_inventario": str(total.quantize(Decimal("0.01"))), "num_productos": len(prods)}


@router.get("/ventas-por-metodo")
def por_metodo(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    rows = db.query(Venta.metodo_pago, func.sum(Venta.total), func.count(Venta.id)).filter(
        Venta.estado.in_(("PAGADA", "PENDIENTE"))).group_by(Venta.metodo_pago).all()
    return [{"metodo": r[0], "total": str(r[1]), "num_ventas": r[2]} for r in rows]


@router.get("/distribucion")
def distribucion(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    from app.models.pedido import Pedido
    hoy = datetime.now(timezone.utc).date()
    m0 = datetime(hoy.year, hoy.month, 1, tzinfo=timezone.utc)
    men = db.query(func.coalesce(func.sum(Venta.total), 0)).filter(
        Venta.fecha >= m0, Venta.estado.in_(("PAGADA", "PENDIENTE")), Venta.tipo == "MENUDEO").scalar() or 0
    dis = db.query(func.coalesce(func.sum(Venta.total), 0)).filter(
        Venta.fecha >= m0, Venta.estado.in_(("PAGADA", "PENDIENTE")), Venta.tipo == "DISTRIBUCION").scalar() or 0
    abiertos = ("PENDIENTE", "EN PREPARACIÓN", "EN DISTRIBUCIÓN")
    pendientes = db.query(func.count(Pedido.id)).filter(Pedido.estado == "PENDIENTE").scalar() or 0
    preparacion = db.query(func.count(Pedido.id)).filter(Pedido.estado == "EN PREPARACIÓN").scalar() or 0
    d0, d1 = _day_bounds(hoy)
    entregas_hoy = db.query(func.count(Pedido.id)).filter(
        Pedido.fecha_entrega >= d0, Pedido.fecha_entrega <= d1,
        Pedido.estado.in_(abiertos)).scalar() or 0
    prox = db.query(Pedido).filter(
        Pedido.estado.in_(abiertos), Pedido.fecha_entrega != None).order_by(  # noqa: E711
        Pedido.fecha_entrega).limit(10).all()
    return {
        "ventas_menudeo_mes": str(men),
        "ventas_distribucion_mes": str(dis),
        "pedidos_pendientes": pendientes,
        "pedidos_preparacion": preparacion,
        "entregas_hoy": entregas_hoy,
        "proximas": [
            {"id": p.id, "cliente": p.cliente.nombre if p.cliente else "Mostrador",
             "fecha_entrega": p.fecha_entrega.date().isoformat() if p.fecha_entrega else None,
             "hora_entrega": p.hora_entrega, "total": str(p.total), "estado": p.estado}
            for p in prox
        ],
    }


@router.get("/ventas-diarias")
def ventas_diarias(dias: int = Query(default=14, ge=1, le=90),
                   db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    """Serie principal del dashboard: ventas por día (PAGADA + PENDIENTE/crédito)."""
    from datetime import timedelta
    hoy = datetime.now(timezone.utc).date()
    inicio = hoy - timedelta(days=dias - 1)
    d0 = datetime.combine(inicio, time.min).replace(tzinfo=timezone.utc)
    rows = db.query(
        func.date(Venta.fecha).label("dia"),
        func.coalesce(func.sum(Venta.total), 0).label("total"),
        func.count(Venta.id).label("n"),
    ).filter(
        Venta.fecha >= d0, Venta.estado.in_(("PAGADA", "PENDIENTE"))
    ).group_by(func.date(Venta.fecha)).order_by(func.date(Venta.fecha)).all()
    por_dia = {str(r[0]): {"total": str(r[1]), "num": r[2]} for r in rows}
    serie = []
    for i in range(dias):
        d = inicio + timedelta(days=i)
        k = str(d)
        serie.append({"fecha": d.isoformat(), "total": por_dia.get(k, {}).get("total", "0"),
                      "num_ventas": por_dia.get(k, {}).get("num", 0)})
    return {"dias": dias, "serie": serie}
