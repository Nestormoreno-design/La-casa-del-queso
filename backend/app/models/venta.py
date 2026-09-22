from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Venta(Base):
    __tablename__ = "ventas"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cliente_id: Mapped[int | None] = mapped_column(ForeignKey("clientes.id"), nullable=True)
    pedido_id: Mapped[int | None] = mapped_column(ForeignKey("pedidos.id"), nullable=True)
    fecha: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    descuento: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    metodo_pago: Mapped[str] = mapped_column(String(20), default="EFECTIVO", nullable=False)
    # EFECTIVO | NEQUI | DAVIPLATA | TARJETA | TRANSFERENCIA | CREDITO
    tipo: Mapped[str] = mapped_column(String(20), default="MENUDEO", nullable=False)
    # MENUDEO | DISTRIBUCION
    estado: Mapped[str] = mapped_column(String(20), default="PAGADA", nullable=False)
    # PAGADA | ANULADA
    canal: Mapped[str] = mapped_column(String(20), default="POS", nullable=False)
    # POS | PEDIDO
    caja_sesion_id: Mapped[int | None] = mapped_column(ForeignKey("caja_sesiones.id"))
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    observaciones: Mapped[str | None] = mapped_column(Text)
    # Reservados futura etapa (NO usar aún):
    # dian_* / siigo_id / hadnling impresora, pagos online, whatsapp
    siigo_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    items = relationship("VentaItem", cascade="all, delete-orphan", lazy="selectin")
    cliente = relationship("Cliente", lazy="joined")


class VentaItem(Base):
    __tablename__ = "venta_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    venta_id: Mapped[int] = mapped_column(ForeignKey("ventas.id", ondelete="CASCADE"), nullable=False)
    producto_id: Mapped[int] = mapped_column(ForeignKey("productos.id"), nullable=False)
    cantidad: Mapped[Decimal] = mapped_column(Numeric(12, 3), nullable=False)
    precio_unitario: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)

    producto = relationship("Producto", lazy="joined")
