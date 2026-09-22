from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class CompraItemIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(gt=0)
    costo_unitario: Decimal = Field(ge=0)


class CompraCreate(BaseModel):
    proveedor_id: int
    observaciones: str | None = None
    items: list[CompraItemIn] = Field(min_length=1)


class VentaItemIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Decimal | None = Field(default=None, ge=0)


class CheckoutIn(BaseModel):
    cliente_id: int | None = None
    metodo_pago: str = Field(default="EFECTIVO")
    descuento: Decimal = Field(default=Decimal("0"), ge=0)
    caja_sesion_id: int | None = None
    observaciones: str | None = None
    items: list[VentaItemIn] = Field(min_length=1)


class PedidoItemIn(BaseModel):
    producto_id: int
    cantidad: Decimal = Field(gt=0)
    precio_unitario: Decimal | None = Field(default=None, ge=0)


class PedidoCreate(BaseModel):
    cliente_id: int | None = None
    fecha_entrega: datetime | None = None
    hora_entrega: str | None = None
    direccion_entrega: str | None = None
    observaciones: str | None = None
    items: list[PedidoItemIn] = Field(min_length=1)


class CajaAbrir(BaseModel):
    saldo_inicial: Decimal = Field(ge=0)
