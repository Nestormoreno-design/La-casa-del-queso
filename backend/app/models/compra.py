from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Compra(Base):
    __tablename__ = "compras"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    proveedor_id: Mapped[int] = mapped_column(ForeignKey("proveedores.id"), nullable=False)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="REGISTRADA", nullable=False)
    # REGISTRADA | RECIBIDA | CANCELADA
    observaciones: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items = relationship("CompraItem", cascade="all, delete-orphan", lazy="selectin")
    proveedor = relationship("Proveedor", lazy="joined")


class CompraItem(Base):
    __tablename__ = "compra_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    compra_id: Mapped[int] = mapped_column(ForeignKey("compras.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    costo_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    producto = relationship("Producto", lazy="joined")


class InventarioMovimiento(Base):
    __tablename__ = "inventario_movimientos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)  # ENTRADA | SALIDA | AJUSTE
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    stock_anterior: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    stock_nuevo: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    motivo: Mapped[str | None] = mapped_column(String(255))
    ref_tipo: Mapped[str | None] = mapped_column(String(30))  # COMPRA | VENTA | AJUSTE | PEDIDO
    ref_id: Mapped[int | None] = mapped_column(Integer)
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    producto = relationship("Producto", lazy="joined")
