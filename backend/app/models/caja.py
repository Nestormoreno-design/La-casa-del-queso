from datetime import datetime
from decimal import Decimal
from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class CajaSesion(Base):
    __tablename__ = "caja_sesiones"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    fecha_apertura: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    fecha_cierre: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    saldo_inicial: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    saldo_final_teorico: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    saldo_final_real: Mapped[Decimal | None] = mapped_column(Numeric(12, 2))
    diferencia: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    estado: Mapped[str] = mapped_column(String(10), default="ABIERTA", nullable=False)
    # ABIERTA | CERRADA
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))

    movimientos = relationship("CajaMovimiento", cascade="all, delete-orphan", lazy="selectin")


class CajaMovimiento(Base):
    __tablename__ = "caja_movimientos"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    sesion_id: Mapped[int] = mapped_column(ForeignKey("caja_sesiones.id", ondelete="CASCADE"))
    tipo: Mapped[str] = mapped_column(String(10), nullable=False)  # INGRESO | EGRESO | VENTA
    monto: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    metodo_pago: Mapped[str | None] = mapped_column(String(20))
    descripcion: Mapped[str | None] = mapped_column(Text)
    venta_id: Mapped[int | None] = mapped_column(ForeignKey("ventas.id"))
    usuario_id: Mapped[int | None] = mapped_column(ForeignKey("usuarios.id"))
    fecha: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
