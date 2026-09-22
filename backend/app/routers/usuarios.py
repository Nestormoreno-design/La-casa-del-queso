from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.usuario import Usuario

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("")
def list_usuarios(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    users = db.query(Usuario).filter(Usuario.activo == True).all()  # noqa: E712
    return [{"id": u.id, "username": u.username, "rol": u.rol} for u in users]
