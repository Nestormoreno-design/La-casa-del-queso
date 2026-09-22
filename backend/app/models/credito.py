from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Credito(Base):
    """Crédito simple MVP: una venta/pedido queda pendiente de pago.

    No es contabilidad compleja: monto_total, saldo_pendiente, estado.
    """

    __tablename__ = "creditos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    cliente_id: Mapped[int] = mapped_column(ForeignKey("clientes.id"), nullable=False, index=True)
    venta_id: Mapped[int | None] = mapped_column(ForeignKey("ventas.id"), nullable=True)
    pedido_id: Mapped[int | None] = mapped_column(ForeignKey("pedidos.id"), nullable=True)
    monto_total: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    saldo_pendiente: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    estado: Mapped[str] = mapped_column(String(20), default="PENDIENTE", nullable=False)
    # PENDIENTE | PAGADO
    observaciones: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    cliente = relationship("Cliente", lazy="joined")
    abonos = relationship("CreditoAbono", cascade="all, delete-orphan", lazy="selectin")


class CreditoAbono(Base):
    __tablename__ = "credito_abonos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    credito_id: Mapped[int] = mapped_column(
        ForeignKey("creditos.id", ondelete="CASCADE"), nullable=False, index=True
    )
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    metodo_pago: Mapped[str | None] = mapped_column(String(20))
    caja_sesion_id: Mapped[int | None] = mapped_column(ForeignKey("caja_sesiones.id"))
    caja_movimiento_id: Mapped[int | None] = mapped_column(ForeignKey("caja_movimientos.id"))
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    observaciones: Mapped[str | None] = mapped_column(Text)
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
