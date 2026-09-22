from decimal import Decimal
from pydantic import BaseModel, Field


class CategoriaBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    descripcion: str | None = None


class CategoriaCreate(CategoriaBase):
    pass


class CategoriaRead(CategoriaBase):
    id: int
    activo: bool
    model_config = {"from_attributes": True}


class ProveedorBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    nit: str | None = Field(default=None, max_length=30)
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None


class ProveedorCreate(ProveedorBase):
    pass


class ProveedorRead(ProveedorBase):
    id: int
    activo: bool
    model_config = {"from_attributes": True}


class ClienteBase(BaseModel):
    nombre: str = Field(min_length=1, max_length=150)
    documento: str | None = Field(default=None, max_length=30)
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    tipo_cliente: str | None = None


class ClienteCreate(ClienteBase):
    pass


class ClienteRead(ClienteBase):
    id: int
    activo: bool
    model_config = {"from_attributes": True}


class ProductoBase(BaseModel):
    codigo: str = Field(min_length=1, max_length=50)
    nombre: str = Field(min_length=1, max_length=150)
    categoria_id: int | None = None
    proveedor_id: int | None = None
    tipo_venta: str = Field(default="PESO", pattern="^(PESO|UNIDAD)$")
    unidad_medida: str = Field(default="KG", pattern="^(KG|G|UND|LB)$")
    precio_venta: Decimal = Field(ge=0)
    stock_minimo: Decimal = Field(default=Decimal("0"), ge=0)
    perecedero: bool = False


class ProductoCreate(ProductoBase):
    pass


class ProductoUpdate(BaseModel):
    nombre: str | None = None
    categoria_id: int | None = None
    proveedor_id: int | None = None
    tipo_venta: str | None = Field(default=None, pattern="^(PESO|UNIDAD)$")
    unidad_medida: str | None = Field(default=None, pattern="^(KG|G|UND|LB)$")
    precio_venta: Decimal | None = Field(default=None, ge=0)
    costo_promedio: Decimal | None = Field(default=None, ge=0)
    stock_minimo: Decimal | None = Field(default=None, ge=0)
    perecedero: bool | None = None
    activo: bool | None = None


class ClienteUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=150)
    documento: str | None = Field(default=None, max_length=30)
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    ciudad: str | None = None
    tipo_cliente: str | None = None
    activo: bool | None = None


class ProveedorUpdate(BaseModel):
    nombre: str | None = Field(default=None, max_length=150)
    nit: str | None = Field(default=None, max_length=30)
    telefono: str | None = None
    email: str | None = None
    direccion: str | None = None
    activo: bool | None = None


class ProductoRead(BaseModel):
    id: int
    codigo: str
    nombre: str
    categoria_id: int | None
    proveedor_id: int | None = None
    tipo_venta: str
    unidad_medida: str
    precio_venta: Decimal
    costo_promedio: Decimal
    stock_actual: Decimal
    stock_minimo: Decimal
    perecedero: bool
    activo: bool
    model_config = {"from_attributes": True}
