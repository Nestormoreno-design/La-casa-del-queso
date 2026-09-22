from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.security import create_access_token, verify_password
from app.database import get_db
from app.models.usuario import Usuario
from app.schemas.auth import LoginJSON, MeResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["auth"])


def _login_ok(db: Session, username: str, password: str) -> Usuario:
    user = db.query(Usuario).filter(Usuario.username == username).first()
    if not user or not user.activo or not verify_password(password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Credenciales inválidas")
    return user


@router.post("/login", response_model=TokenResponse)
def login_json(body: LoginJSON, db: Session = Depends(get_db)):
    user = _login_ok(db, body.username, body.password)
    return TokenResponse(access_token=create_access_token(user.username))


@router.post("/login-form", response_model=TokenResponse)
def login_form(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = _login_ok(db, form.username, form.password)
    return TokenResponse(access_token=create_access_token(user.username))


@router.get("/me", response_model=MeResponse)
def me(user: Usuario = Depends(get_current_user)):
    return user
