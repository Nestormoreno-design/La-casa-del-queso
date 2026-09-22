from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.caja import CajaMovimiento, CajaSesion
from app.models.usuario import Usuario
from app.schemas.operaciones import CajaAbrir

router = APIRouter(tags=["caja"])

TRANSFERENCIAS = ("NEQUI", "DAVIPLATA", "TRANSFERENCIA")


def _teorico(db: Session, sesion_id: int) -> Decimal:
    s = db.get(CajaSesion, sesion_id)
    total = Decimal(s.saldo_inicial)
    movs = db.query(CajaMovimiento).filter(CajaMovimiento.sesion_id == sesion_id).all()
    for m in movs:
        if m.tipo in ("INGRESO", "VENTA"):
            total += Decimal(m.monto)
        elif m.tipo == "EGRESO":
            total -= Decimal(m.monto)
    return total


def _responsable(db: Session, usuario_id: int | None) -> str:
    if not usuario_id:
        return "—"
    u = db.get(Usuario, usuario_id)
    return u.username if u else "—"


def _agregados(db: Session, sid: int) -> dict:
    movs = db.query(CajaMovimiento).filter(CajaMovimiento.sesion_id == sid).all()
    ef = Decimal("0")
    tr = Decimal("0")
    tj = Decimal("0")
    cr = Decimal("0")
    ing = Decimal("0")
    egr = Decimal("0")
    ing_ef = Decimal("0")
    egr_ef = Decimal("0")
    n_ventas = 0
    for m in movs:
        monto = Decimal(m.monto)
        met = (m.metodo_pago or "EFECTIVO").upper()
        if m.tipo == "VENTA":
            n_ventas += 1
            if met == "EFECTIVO":
                ef += monto
            elif met in TRANSFERENCIAS:
                tr += monto
            elif met == "TARJETA":
                tj += monto
            elif met == "CREDITO":
                cr += monto
        elif m.tipo == "INGRESO":
            ing += monto
            if met == "EFECTIVO":
                ing_ef += monto
        elif m.tipo == "EGRESO":
            egr += monto
            if met == "EFECTIVO":
                egr_ef += monto
    s = db.get(CajaSesion, sid)
    total_ventas = ef + tr + tj + cr
    return {
        "ventas_efectivo": str(ef),
        "ventas_transferencias": str(tr),
        "ventas_tarjetas": str(tj),
        "ventas_credito": str(cr),
        "total_ventas": str(total_ventas),
        "num_ventas": n_ventas,
        "ingresos": str(ing),
        "egresos": str(egr),
        "saldo_esperado_efectivo": str(Decimal(s.saldo_inicial) + ef + ing_ef - egr_ef),
        "teorico": str(_teorico(db, sid)),
    }


def _ficha(db: Session, s: CajaSesion) -> dict:
    ag = _agregados(db, s.id)
    return {
        "id": s.id,
        "fecha_apertura": s.fecha_apertura.isoformat() if s.fecha_apertura else None,
        "fecha_cierre": s.fecha_cierre.isoformat() if s.fecha_cierre else None,
        "responsable": _responsable(db, s.usuario_id),
        "saldo_inicial": str(s.saldo_inicial),
        "saldo_final_teorico": str(s.saldo_final_teorico),
        "saldo_final_real": str(s.saldo_final_real) if s.saldo_final_real is not None else None,
        "diferencia": str(s.diferencia),
        "estado": s.estado,
        **ag,
    }


@router.get("/caja/actual")
def caja_actual(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    s = db.query(CajaSesion).filter(CajaSesion.estado == "ABIERTA").first()
    if not s:
        return {"abierta": False}
    ficha = _ficha(db, s)
    return {"abierta": True, "sesion_id": s.id, **ficha}


@router.get("/caja/historial")
def historial(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    sesiones = db.query(CajaSesion).order_by(CajaSesion.id.desc()).limit(100).all()
    return [_ficha(db, s) for s in sesiones]


@router.get("/caja/{sid}/detalle")
def detalle(sid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    s = db.get(CajaSesion, sid)
    if not s:
        raise HTTPException(404, "Sesión no encontrada")
    movs = db.query(CajaMovimiento).filter(CajaMovimiento.sesion_id == sid).order_by(CajaMovimiento.id).all()
    return {
        **_ficha(db, s),
        "movimientos": [
            {"id": m.id, "tipo": m.tipo, "monto": str(m.monto), "metodo_pago": m.metodo_pago,
             "descripcion": m.descripcion, "venta_id": m.venta_id,
             "fecha": m.fecha.isoformat() if m.fecha else None}
            for m in movs
        ],
    }


@router.post("/caja/abrir", status_code=201)
def abrir(body: CajaAbrir, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    if db.query(CajaSesion).filter(CajaSesion.estado == "ABIERTA").first():
        raise HTTPException(400, "Ya hay una caja abierta")
    s = CajaSesion(saldo_inicial=body.saldo_inicial, estado="ABIERTA", usuario_id=user.id)
    db.add(s)
    db.commit()
    db.refresh(s)
    return {"id": s.id, "estado": "ABIERTA"}


@router.post("/caja/{sid}/movimiento", status_code=201)
def movimiento(sid: int, body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    s = db.get(CajaSesion, sid)
    if not s or s.estado != "ABIERTA":
        raise HTTPException(400, "Sesión no abierta: la caja cerrada es inmutable")
    tipo = str(body.get("tipo", "")).upper()
    if tipo not in ("INGRESO", "EGRESO"):
        raise HTTPException(400, "Tipo debe ser INGRESO o EGRESO")
    m = CajaMovimiento(sesion_id=sid, tipo=tipo, monto=Decimal(str(body.get("monto", "0"))),
                       metodo_pago=body.get("metodo_pago", "EFECTIVO"),
                       descripcion=body.get("descripcion", ""), usuario_id=user.id)
    if m.monto <= 0:
        raise HTTPException(400, "Monto debe ser > 0")
    db.add(m)
    db.commit()
    return {"ok": True, "teorico": str(_teorico(db, sid))}


@router.post("/caja/{sid}/cerrar")
def cerrar(sid: int, body: dict, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    from datetime import datetime, timezone
    s = db.get(CajaSesion, sid)
    if not s or s.estado != "ABIERTA":
        raise HTTPException(400, "Sesión no abierta: la caja cerrada es inmutable")
    teorico = _teorico(db, sid)
    real = Decimal(str(body.get("saldo_final_real", teorico)))
    s.saldo_final_teorico = teorico
    s.saldo_final_real = real
    s.diferencia = real - teorico
    s.estado = "CERRADA"
    s.fecha_cierre = datetime.now(timezone.utc)
    db.commit()
    return {"ok": True, "teorico": str(teorico), "real": str(real), "diferencia": str(s.diferencia)}


@router.get("/caja/{sid}/resumen")
def resumen(sid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    s = db.get(CajaSesion, sid)
    if not s:
        raise HTTPException(404, "Sesión no encontrada")
    rows = db.query(CajaMovimiento.metodo_pago, func.sum(CajaMovimiento.monto)).filter(
        CajaMovimiento.sesion_id == sid).group_by(CajaMovimiento.metodo_pago).all()
    ficha = _ficha(db, s)
    ficha["por_metodo"] = [{"metodo": r[0], "total": str(r[1])} for r in rows]
    return ficha
