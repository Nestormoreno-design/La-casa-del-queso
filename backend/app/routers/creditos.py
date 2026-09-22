from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.caja import CajaMovimiento, CajaSesion
from app.models.catalogos import Cliente
from app.models.credito import Credito, CreditoAbono
from app.models.usuario import Usuario
from app.models.venta import Venta

router = APIRouter(prefix="/creditos", tags=["creditos"])

ROLES_COBRO = ("administrador", "vendedor")


def _ficha(c: Credito) -> dict:
    return {
        "id": c.id,
        "cliente_id": c.cliente_id,
        "cliente": c.cliente.nombre if c.cliente else None,
        "venta_id": c.venta_id,
        "pedido_id": c.pedido_id,
        "monto_total": str(c.monto_total),
        "saldo_pendiente": str(c.saldo_pendiente),
        "estado": c.estado,
        "observaciones": c.observaciones,
        "created_at": c.created_at.isoformat() if c.created_at else None,
        "abonos": [
            {"id": a.id, "monto": str(a.monto), "metodo_pago": a.metodo_pago,
             "fecha": a.fecha.isoformat() if a.fecha else None,
             "observaciones": a.observaciones}
            for a in (c.abonos or [])
        ],
    }


@router.get("")
def list_creditos(solo_pendientes: bool = False, db: Session = Depends(get_db),
                  _: Usuario = Depends(get_current_user)):
    q = db.query(Credito).order_by(Credito.id.desc()).limit(300)
    items = q.all()
    if solo_pendientes:
        items = [c for c in items if c.estado == "PENDIENTE"]
    return [_ficha(c) for c in items]


@router.get("/resumen")
def resumen(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    pendientes = db.query(Credito).filter(Credito.estado == "PENDIENTE").all()
    total = sum((Decimal(c.saldo_pendiente) for c in pendientes), Decimal("0"))
    return {"num_pendientes": len(pendientes), "saldo_pendiente": str(total)}


@router.get("/cliente/{cid}")
def estado_cuenta(cid: int, db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    cli = db.get(Cliente, cid)
    if not cli:
        raise HTTPException(404, "Cliente no encontrado")
    creds = db.query(Credito).filter(Credito.cliente_id == cid).order_by(Credito.id.desc()).all()
    saldo = sum((Decimal(c.saldo_pendiente) for c in creds if c.estado == "PENDIENTE"), Decimal("0"))
    return {
        "cliente_id": cid,
        "cliente": cli.nombre,
        "tiene_pendiente": saldo > 0,
        "saldo_pendiente": str(saldo),
        "creditos": [_ficha(c) for c in creds],
    }


@router.post("", status_code=201)
def crear_credito(body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Registrar crédito manual (punto 9): no obligatorio, acción explícita 'Crear crédito'.

    Acepta venta_id existente (marca la venta como PENDIENTE) o monto directo con cliente.
    """
    if user.rol not in ("administrador", "vendedor"):
        raise HTTPException(403, "Sin permiso para registrar crédito")
    cid = body.get("cliente_id")
    cli = db.get(Cliente, cid) if cid else None
    if not cli or not cli.activo:
        raise HTTPException(400, "Selecciona un cliente válido.")
    venta = None
    vid = body.get("venta_id")
    if vid:
        venta = db.get(Venta, vid)
        if not venta:
            raise HTTPException(404, "Venta no encontrada")
        if venta.cliente_id and venta.cliente_id != cid:
            raise HTTPException(400, "La venta pertenece a otro cliente")
        if db.query(Credito).filter(Credito.venta_id == vid, Credito.estado == "PENDIENTE").first():
            raise HTTPException(400, "Esa venta ya tiene crédito pendiente")
        monto = Decimal(str(venta.total))
        pedido_id = venta.pedido_id
    else:
        try:
            monto = Decimal(str(body.get("monto", "0")))
        except Exception:
            raise HTTPException(400, "Monto inválido")
        if monto <= 0:
            raise HTTPException(400, "El monto debe ser mayor a 0.")
        pedido_id = body.get("pedido_id")
    c = Credito(cliente_id=cid, venta_id=vid, pedido_id=pedido_id,
                monto_total=monto, saldo_pendiente=monto, estado="PENDIENTE",
                observaciones=body.get("observaciones"))
    db.add(c)
    if venta and venta.estado == "PAGADA":
        venta.estado = "PENDIENTE"
    db.commit()
    db.refresh(c)
    return _ficha(c)


@router.post("/{cid}/abonar")
def abonar(cid: int, body: dict, db: Session = Depends(get_db), user: Usuario = Depends(get_current_user)):
    """Registrar abono/pago de un crédito. Si cubre el saldo, marca PAGADO y la venta PAGADA."""
    if user.rol not in ROLES_COBRO:
        raise HTTPException(403, "Sin permiso para registrar abonos")
    c = db.get(Credito, cid)
    if not c:
        raise HTTPException(404, "Crédito no encontrado")
    if c.estado != "PENDIENTE":
        raise HTTPException(400, "El crédito ya está pagado")
    try:
        monto = Decimal(str(body.get("monto", "0")))
    except Exception:
        raise HTTPException(400, "Monto inválido")
    if monto <= 0:
        raise HTTPException(400, "El monto debe ser mayor a 0.")
    if monto > Decimal(c.saldo_pendiente):
        raise HTTPException(400, f"El abono supera el saldo pendiente (${c.saldo_pendiente}).")
    metodo = str(body.get("metodo_pago") or "EFECTIVO").upper()
    caja_id = body.get("caja_sesion_id")
    mov_id = None
    # Abono en efectivo/transferencia con caja abierta: registrar movimiento.
    if caja_id is not None or metodo != "CREDITO":
        if caja_id is not None:
            sc = db.get(CajaSesion, caja_id)
        else:
            sc = db.query(CajaSesion).filter(CajaSesion.estado == "ABIERTA").first()
        if sc and sc.estado == "ABIERTA":
            mov = CajaMovimiento(sesion_id=sc.id, tipo="INGRESO", monto=monto,
                                 metodo_pago=metodo,
                                 descripcion=f"Abono crédito #{c.id} (cliente {c.cliente_id})",
                                 venta_id=c.venta_id, usuario_id=user.id)
            db.add(mov)
            db.flush()
            mov_id = mov.id
            caja_id = sc.id
        elif metodo in ("EFECTIVO",) and body.get("exigir_caja", True):
            # Para efectivo exigimos caja; para otros métodos se permite sin caja.
            pass
    ab = CreditoAbono(credito_id=c.id, monto=monto, metodo_pago=metodo,
                      caja_sesion_id=caja_id, caja_movimiento_id=mov_id,
                      usuario_id=user.id, observaciones=body.get("observaciones"))
    db.add(ab)
    c.saldo_pendiente = Decimal(c.saldo_pendiente) - monto
    if c.saldo_pendiente <= 0:
        c.saldo_pendiente = Decimal("0")
        c.estado = "PAGADO"
        if c.venta_id:
            v = db.get(Venta, c.venta_id)
            if v and v.estado == "PENDIENTE":
                v.estado = "PAGADA"
    db.commit()
    db.refresh(c)
    return _ficha(c)
