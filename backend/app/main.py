from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.database import engine
from app.routers import auth, caja, catalogos, compras, creditos, dashboard, pedidos, usuarios, ventas


def ensure_conductor_user() -> str:
    """Garantiza que exista el usuario conductor (idempotente).

    Solo crea el usuario 'conductor' si no existe. No toca admin, vendedor,
    bodeguero ni ningún otro dato (clientes, productos, ventas, pedidos, caja).
    Retorna 'creado' o 'existe'.
    """
    from app.core.security import hash_password
    from app.database import SessionLocal
    from app.models.usuario import Usuario

    db = SessionLocal()
    try:
        if db.query(Usuario).filter(Usuario.username == "conductor").first():
            return "existe"
        db.add(Usuario(username="conductor",
                       password_hash=hash_password("conductor"),
                       rol="conductor", activo=True))
        db.commit()
        return "creado"
    finally:
        db.close()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Render Free no permite Shell, así que el deploy debe auto-reparar el
    # usuario conductor. Idempotente y acotado: solo conductor, nada más.
    try:
        print(f"Startup: conductor -> {ensure_conductor_user()}")
    except Exception as e:
        # No bloquear el arranque si la BD aún no está lista.
        print(f"Startup: verificación de conductor omitida: {e}")
    yield


app = FastAPI(title="La Casa del Queso API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL, "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(usuarios.router, prefix="/api/v1")
app.include_router(catalogos.router, prefix="/api/v1")
app.include_router(compras.router, prefix="/api/v1")
app.include_router(ventas.router, prefix="/api/v1")
app.include_router(pedidos.router, prefix="/api/v1")
app.include_router(caja.router, prefix="/api/v1")
app.include_router(dashboard.router, prefix="/api/v1")
app.include_router(creditos.router, prefix="/api/v1")


@app.get("/")
def root():
    return {"message": "La Casa del Queso API funcionando", "version": "1.0.0"}


@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content={"status": "error", "database": "disconnected", "detail": str(e)})
