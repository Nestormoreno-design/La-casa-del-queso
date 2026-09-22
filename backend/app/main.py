from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.database import engine
from app.routers import auth, caja, catalogos, compras, dashboard, pedidos, usuarios, ventas

app = FastAPI(title="La Casa del Queso API", version="1.0.0")

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
