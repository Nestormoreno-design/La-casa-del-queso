from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.deps import ROLES_VALIDOS, get_current_user, require_roles
from app.core.security import hash_password
from app.database import get_db
from app.models.usuario import Usuario

router = APIRouter(prefix="/usuarios", tags=["usuarios"])


@router.get("")
def list_usuarios(db: Session = Depends(get_db), _: Usuario = Depends(get_current_user)):
    users = db.query(Usuario).filter(Usuario.activo == True).all()  # noqa: E712
    return [{"id": u.id, "username": u.username, "rol": u.rol} for u in users]


@router.get("/conductores")
def list_conductores(db: Session = Depends(get_db),
                     user: Usuario = Depends(require_roles("administrador", "vendedor", "bodeguero"))):
    users = db.query(Usuario).filter(Usuario.activo == True, Usuario.rol == "conductor").all()  # noqa: E712
    return [{"id": u.id, "username": u.username, "rol": u.rol} for u in users]


@router.post("", status_code=201)
def create_usuario(body: dict, db: Session = Depends(get_db),
                   _: Usuario = Depends(require_roles("administrador"))):
    username = str(body.get("username", "")).strip()
    password = str(body.get("password", ""))
    rol = str(body.get("rol", "vendedor")).strip().lower()
    if not username or not password:
        raise HTTPException(400, "Usuario y contraseña requeridos")
    if rol not in ROLES_VALIDOS:
        raise HTTPException(400, f"Rol inválido. Válidos: {', '.join(ROLES_VALIDOS)}")
    if db.query(Usuario).filter(Usuario.username == username).first():
        raise HTTPException(400, "El usuario ya existe")
    u = Usuario(username=username, password_hash=hash_password(password), rol=rol)
    db.add(u)
    db.commit()
    db.refresh(u)
    return {"id": u.id, "username": u.username, "rol": u.rol}
