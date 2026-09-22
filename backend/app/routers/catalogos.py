from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.catalogos import Categoria, Cliente, Producto, Proveedor
from app.schemas.catalogos import (
    CategoriaCreate, CategoriaRead, ClienteCreate, ClienteRead, ClienteUpdate,
    ProductoCreate, ProductoRead, ProductoUpdate, ProveedorCreate, ProveedorRead, ProveedorUpdate,
)

router = APIRouter(tags=["catalogos"])


# ---- helpers ----
def _get_or_404(db, model, obj_id: int, name: str):
    obj = db.get(model, obj_id)
    if not obj:
        raise HTTPException(404, f"{name} no encontrado")
    return obj


# ---- CATEGORIAS ----
@router.get("/categorias", response_model=list[CategoriaRead])
def list_categorias(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    return db.query(Categoria).filter(Categoria.activo == True).order_by(Categoria.nombre).all()  # noqa: E712


@router.post("/categorias", response_model=CategoriaRead, status_code=201)
def create_categoria(body: CategoriaCreate, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    if db.query(Categoria).filter(Categoria.nombre == body.nombre).first():
        raise HTTPException(400, "Categoría ya existe")
    c = Categoria(nombre=body.nombre, descripcion=body.descripcion)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/categorias/{cid}")
def delete_categoria(cid: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    c = _get_or_404(db, Categoria, cid, "Categoría")
    c.activo = False
    db.commit()
    return {"ok": True}


# ---- PROVEEDORES ----
@router.get("/proveedores", response_model=list[ProveedorRead])
def list_proveedores(db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    return db.query(Proveedor).filter(Proveedor.activo == True).order_by(Proveedor.nombre).all()  # noqa: E712


@router.post("/proveedores", response_model=ProveedorRead, status_code=201)
def create_proveedor(body: ProveedorCreate, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    p = Proveedor(**body.model_dump())
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/proveedores/{pid}", response_model=ProveedorRead)
def update_proveedor(pid: int, body: ProveedorUpdate, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    p = _get_or_404(db, Proveedor, pid, "Proveedor")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/proveedores/{pid}")
def delete_proveedor(pid: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    p = _get_or_404(db, Proveedor, pid, "Proveedor")
    p.activo = False
    db.commit()
    return {"ok": True}


# ---- CLIENTES ----
@router.get("/clientes", response_model=list[ClienteRead])
def list_clientes(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None),
    _: object = Depends(get_current_user),
):
    q = db.query(Cliente).filter(Cliente.activo == True)  # noqa: E712
    if search:
        q = q.filter(Cliente.nombre.ilike(f"%{search}%"))
    return q.order_by(Cliente.nombre).limit(200).all()


@router.post("/clientes", response_model=ClienteRead, status_code=201)
def create_cliente(body: ClienteCreate, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    c = Cliente(**body.model_dump())
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.put("/clientes/{cid}", response_model=ClienteRead)
def update_cliente(cid: int, body: ClienteUpdate, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    c = _get_or_404(db, Cliente, cid, "Cliente")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(c, k, v)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/clientes/{cid}")
def delete_cliente(cid: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    c = _get_or_404(db, Cliente, cid, "Cliente")
    c.activo = False
    db.commit()
    return {"ok": True}


# ---- PRODUCTOS ----
@router.get("/productos", response_model=list[ProductoRead])
def list_productos(
    db: Session = Depends(get_db),
    search: str | None = Query(default=None),
    stock_bajo: bool = Query(default=False),
    _: object = Depends(get_current_user),
):
    q = db.query(Producto).filter(Producto.activo == True)  # noqa: E712
    if search:
        q = q.filter((Producto.nombre.ilike(f"%{search}%")) | (Producto.codigo.ilike(f"%{search}%")))
    items = q.order_by(Producto.nombre).limit(500).all()
    if stock_bajo:
        items = [p for p in items if Decimal(p.stock_actual) <= Decimal(p.stock_minimo)]
    return items


@router.get("/productos/{pid}", response_model=ProductoRead)
def get_producto(pid: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    return _get_or_404(db, Producto, pid, "Producto")


@router.post("/productos", response_model=ProductoRead, status_code=201)
def create_producto(body: ProductoCreate, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    if db.query(Producto).filter(Producto.codigo == body.codigo).first():
        raise HTTPException(400, "Código de producto ya existe")
    if body.categoria_id and not db.get(Categoria, body.categoria_id):
        raise HTTPException(400, "Categoría no existe")
    if body.proveedor_id and not db.get(Proveedor, body.proveedor_id):
        raise HTTPException(400, "Proveedor no existe")
    p = Producto(**body.model_dump())
    p.stock_actual = Decimal("0")
    p.costo_promedio = Decimal("0")
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.put("/productos/{pid}", response_model=ProductoRead)
def update_producto(pid: int, body: ProductoUpdate, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    p = _get_or_404(db, Producto, pid, "Producto")
    data = body.model_dump(exclude_unset=True)
    if data.get("proveedor_id") and not db.get(Proveedor, data["proveedor_id"]):
        raise HTTPException(400, "Proveedor no existe")
    for k, v in data.items():
        setattr(p, k, v)
    db.commit()
    db.refresh(p)
    return p


@router.delete("/productos/{pid}")
def delete_producto(pid: int, db: Session = Depends(get_db), _: object = Depends(get_current_user)):
    p = _get_or_404(db, Producto, pid, "Producto")
    p.activo = False
    db.commit()
    return {"ok": True}
