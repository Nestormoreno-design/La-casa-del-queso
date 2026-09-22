from datetime import datetime
from decimal import Decimal
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Categoria(Base):
    __tablename__ = "categorias"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    descripcion: Mapped[str | None] = mapped_column(Text, nullable=True)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Proveedor(Base):
    __tablename__ = "proveedores"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    nit: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(120))
    direccion: Mapped[str | None] = mapped_column(String(255))
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Cliente(Base):
    __tablename__ = "clientes"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    documento: Mapped[str | None] = mapped_column(String(30), unique=True, nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(30))
    email: Mapped[str | None] = mapped_column(String(120))
    direccion: Mapped[str | None] = mapped_column(String(255))
    ciudad: Mapped[str | None] = mapped_column(String(100))
    tipo_cliente: Mapped[str | None] = mapped_column(String(30), default="MINORISTA")
    # MINORISTA | MAYORISTA (categoría comercial del cliente; no confundir con categorías de producto)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Producto(Base):
    __tablename__ = "productos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    codigo: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    nombre: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    categoria_id: Mapped[int | None] = mapped_column(ForeignKey("categorias.id"), nullable=True)
    proveedor_id: Mapped[int | None] = mapped_column(ForeignKey("proveedores.id"), nullable=True)
    tipo_venta: Mapped[str] = mapped_column(String(10), nullable=False, default="PESO")
    # PESO | UNIDAD
    unidad_medida: Mapped[str] = mapped_column(String(10), nullable=False, default="KG")
    # KG | G | UND | LB
    precio_venta: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    costo_promedio: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    stock_actual: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    stock_minimo: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False, default=0)
    perecedero: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    activo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    categoria = relationship("Categoria", lazy="joined")
    proveedor = relationship("Proveedor", lazy="joined")
