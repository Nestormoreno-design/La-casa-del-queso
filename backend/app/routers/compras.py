from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.catalogos import Producto, Proveedor
from app.models.compra import Compra, CompraItem, InventarioMovimiento
from app.models.usuario import Usuario
from app.schemas.operaciones import CompraCreate
from app.services.inventario import registrar_movimiento

router = APIRouter(tags=["compras-inventario"])


@router.get("/compras")
def list_compras(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    return db.query(Compra).order_by(Compra.id.desc()).limit(200).all()


@router.post("/compras/directa", status_code=201)
def registrar_compra(body: CompraCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Registrar compra recibida: crea la compra y entra al inventario en una sola transacción."""
    if user.rol == "conductor":
        raise HTTPException(403, "El conductor no puede registrar compras")
    if not db.get(Proveedor, body.proveedor_id):
        raise HTTPException(400, "Proveedor no existe")
    try:
        with db.begin_nested():
            compra = Compra(proveedor_id=body.proveedor_id, observaciones=body.observaciones, estado="RECIBIDA")
            db.add(compra)
            db.flush()
            total = Decimal("0")
            detalle = []
            for it in body.items:
                prod = db.get(Producto, it.producto_id)
                if not prod or not prod.activo:
                    raise HTTPException(400, f"Producto {it.producto_id} inválido")
                if it.cantidad <= 0:
                    raise HTTPException(400, "Cantidad debe ser > 0")
                sub = it.cantidad * it.costo_unitario
                total += sub
                db.add(CompraItem(compra_id=compra.id, producto_id=prod.id, cantidad=it.cantidad,
                                  costo_unitario=it.costo_unitario, subtotal=sub))
                stock_prev = Decimal(prod.stock_actual)
                if stock_prev + it.cantidad > 0:
                    nuevo = (stock_prev * Decimal(prod.costo_promedio) + it.cantidad * Decimal(it.costo_unitario)) / (stock_prev + it.cantidad)
                else:
                    nuevo = Decimal(it.costo_unitario)
                prod.costo_promedio = nuevo.quantize(Decimal("0.01"))
                registrar_movimiento(db, prod, "ENTRADA", Decimal(it.cantidad),
                                     motivo=f"Compra #{compra.id}", ref_tipo="COMPRA", ref_id=compra.id,
                                     usuario_id=user.id)
                detalle.append({"producto": prod.nombre, "anterior": str(stock_prev),
                                "entrada": str(it.cantidad), "nuevo": str(prod.stock_actual)})
            compra.subtotal = total
            compra.total = total
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(400, str(e))
    return {"id": compra.id, "total": str(compra.total), "estado": "RECIBIDA", "detalle": detalle}


@router.get("/compras/{cid}")
def get_compra(cid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    c = db.get(Compra, cid)
    if not c:
        raise HTTPException(404, "Compra no encontrada")
    return c


@router.post("/compras", status_code=201)
def create_compra(body: CompraCreate, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if not db.get(__import__("app.models.catalogos", fromlist=["Proveedor"]).Proveedor, body.proveedor_id):
        raise HTTPException(400, "Proveedor no existe")
    try:
        with db.begin_nested():
            compra = Compra(proveedor_id=body.proveedor_id, observaciones=body.observaciones, estado="REGISTRADA")
            db.add(compra)
            db.flush()
            total = Decimal("0")
            for it in body.items:
                prod = db.get(Producto, it.producto_id)
                if not prod or not prod.activo:
                    raise HTTPException(400, f"Producto {it.producto_id} inválido")
                if it.cantidad <= 0:
                    raise HTTPException(400, "Cantidad debe ser > 0")
                sub = it.cantidad * it.costo_unitario
                total += sub
                db.add(CompraItem(compra_id=compra.id, producto_id=prod.id, cantidad=it.cantidad,
                                 costo_unitario=it.costo_unitario, subtotal=sub))
            compra.subtotal = total
            compra.total = total
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(400, str(e))
    db.refresh(compra)
    return {"id": compra.id, "total": str(compra.total), "estado": compra.estado}


@router.post("/compras/{cid}/recibir")
def recibir_compra(cid: int, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    compra = db.get(Compra, cid)
    if not compra:
        raise HTTPException(404, "Compra no encontrada")
    if compra.estado != "REGISTRADA":
        raise HTTPException(400, f"Solo REGISTRADA puede recibirse (actual: {compra.estado})")
    try:
        with db.begin_nested():
            for it in compra.items:
                prod = db.get(Producto, it.producto_id)
                stock_prev = Decimal(prod.stock_actual)
                # costo promedio ponderado automático
                if stock_prev + it.cantidad > 0:
                    nuevo = (stock_prev * Decimal(prod.costo_promedio) + it.cantidad * Decimal(it.costo_unitario)) / (stock_prev + it.cantidad)
                else:
                    nuevo = Decimal(it.costo_unitario)
                prod.costo_promedio = nuevo.quantize(Decimal("0.01"))
                registrar_movimiento(db, prod, "ENTRADA", Decimal(it.cantidad),
                                     motivo=f"Compra #{compra.id}", ref_tipo="COMPRA", ref_id=compra.id,
                                     usuario_id=user.id)
            compra.estado = "RECIBIDA"
        db.commit()
    except Exception as e:
        db.rollback()
        raise HTTPException(400, str(e))
    return {"ok": True, "estado": "RECIBIDA"}


@router.post("/compras/{cid}/cancelar")
def cancelar_compra(cid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    compra = db.get(Compra, cid)
    if not compra:
        raise HTTPException(404, "Compra no encontrada")
    if compra.estado != "REGISTRADA":
        raise HTTPException(400, "Solo REGISTRADA puede cancelarse")
    compra.estado = "CANCELADA"
    db.commit()
    return {"ok": True}


@router.put("/compras/{cid}")
def update_compra(cid: int, body: CompraCreate, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    """Editar compra solo antes de recibir (no ha movido inventario)."""
    compra = db.get(Compra, cid)
    if not compra:
        raise HTTPException(404, "Compra no encontrada")
    if compra.estado != "REGISTRADA":
        raise HTTPException(400, f"Solo REGISTRADA puede editarse (actual: {compra.estado})")
    for old in list(compra.items):
        db.delete(old)
    db.flush()
    total = Decimal("0")
    for it in body.items:
        prod = db.get(Producto, it.producto_id)
        if not prod or not prod.activo:
            raise HTTPException(400, f"Producto {it.producto_id} inválido")
        if it.cantidad <= 0:
            raise HTTPException(400, "Cantidad debe ser > 0")
        sub = it.cantidad * it.costo_unitario
        total += sub
        db.add(CompraItem(compra_id=compra.id, producto_id=prod.id, cantidad=it.cantidad,
                          costo_unitario=it.costo_unitario, subtotal=sub))
    compra.proveedor_id = body.proveedor_id
    compra.observaciones = body.observaciones
    compra.subtotal = total
    compra.total = total
    db.commit()
    return {"ok": True, "total": str(total)}


@router.delete("/compras/{cid}")
def delete_compra(cid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    compra = db.get(Compra, cid)
    if not compra:
        raise HTTPException(404, "Compra no encontrada")
    if compra.estado != "REGISTRADA":
        raise HTTPException(400, "Solo REGISTRADA puede eliminarse (use cancelar/anular para el resto)")
    db.delete(compra)  # sin movimientos asociados
    db.commit()
    return {"ok": True, "eliminado": True}


@router.get("/inventario/movimientos")
def list_movimientos(producto_id: int | None = None, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    q = db.query(InventarioMovimiento).order_by(InventarioMovimiento.id.desc()).limit(300)
    items = q.all()
    if producto_id:
        items = [m for m in items if m.producto_id == producto_id]
    return items


@router.post("/inventario/ajuste")
def ajuste(body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    try:
        pid = int(body["producto_id"])
        nuevo_stock = Decimal(str(body["nuevo_stock"]))
    except Exception:
        raise HTTPException(400, "producto_id y nuevo_stock requeridos")
    prod = db.get(Producto, pid)
    if not prod:
        raise HTTPException(404, "Producto no encontrado")
    if nuevo_stock < 0:
        raise HTTPException(400, "El stock no puede ser negativo")
    registrar_movimiento(db, prod, "AJUSTE", nuevo_stock, motivo=body.get("motivo", "Ajuste manual"),
                         ref_tipo="AJUSTE", ref_id=None, usuario_id=user.id)
    db.commit()
    return {"ok": True, "stock_actual": str(prod.stock_actual)}


@router.post("/inventario/entrada")
def entrada_manual(body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Agregar stock: entrada puntual de mercancía con costo y proveedor (pantalla Inventario)."""
    from app.models.catalogos import Proveedor
    try:
        pid = int(body["producto_id"])
        cantidad = Decimal(str(body.get("cantidad", "0")))
    except Exception:
        raise HTTPException(400, "producto_id y cantidad requeridos")
    if cantidad <= 0:
        raise HTTPException(400, "La cantidad debe ser mayor a 0")
    prod = db.get(Producto, pid)
    if not prod or not prod.activo:
        raise HTTPException(404, "Producto no encontrado")
    costo = body.get("costo_unitario")
    if costo is not None and costo != "":
        costo = Decimal(str(costo))
        if costo < 0:
            raise HTTPException(400, "El costo no puede ser negativo")
        stock_prev = Decimal(prod.stock_actual)
        if stock_prev + cantidad > 0:
            prod.costo_promedio = ((stock_prev * Decimal(prod.costo_promedio) + cantidad * costo) / (stock_prev + cantidad)).quantize(Decimal("0.01"))
    prov_id = body.get("proveedor_id")
    if prov_id:
        prov = db.get(Proveedor, int(prov_id))
        if not prov:
            raise HTTPException(400, "Proveedor no existe")
        prod.proveedor_id = prov.id
    obs = str(body.get("observacion", "") or "").strip()
    motivo = "Agregar stock" + (f": {obs}" if obs else "")
    anterior = Decimal(prod.stock_actual)
    registrar_movimiento(db, prod, "ENTRADA", cantidad, motivo=motivo,
                         ref_tipo="AJUSTE", ref_id=None, usuario_id=user.id)
    db.commit()
    return {"ok": True, "anterior": str(anterior), "entrada": str(cantidad),
            "nuevo": str(prod.stock_actual)}
