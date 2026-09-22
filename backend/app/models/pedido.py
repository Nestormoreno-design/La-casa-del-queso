from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Pedido(Base):
    __tablename__ = "pedidos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id"), nullable=True)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    fecha_entrega: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    hora_entrega: Mapped[str | None] = mapped_column(String(50))
    estado: Mapped[str] = mapped_column(String(20), default="PENDIENTE", nullable=False)
    # PENDIENTE | EN_PREPARACION | PROGRAMADO | ENTREGADO | CANCELADO
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    direccion_entrega: Mapped[str | None] = mapped_column(String(255))
    observaciones: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items = relationship("PedidoItem", cascade="all, delete-orphan", lazy="selectin")
    cliente = relationship("Cliente", lazy="joined")


class PedidoItem(Base):
    __tablename__ = "pedido_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pedido_id: Mapped[int] = mapped_column(ForeignKey("pedidos.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    producto = relationship("Producto", lazy="joined")


class Despacho(Base):
    __tablename__ = "despachos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    pedido_id: Mapped[int] = mapped_column(ForeignKey("pedidos.id"), unique=True, nullable=False)
    fecha_despacho: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    estado: Mapped[str] = mapped_column(String(20), default="PROGRAMADO", nullable=False)
    # PROGRAMADO | EN_RUTA | ENTREGADO
    responsable: Mapped[str | None] = mapped_column(String(120))
    observaciones: Mapped[str | None] = mapped_column(Text)
