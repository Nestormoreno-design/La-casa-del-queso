from decimal import Decimal
from sqlalchemy.orm import Session

from app.models.catalogos import Producto
from app.models.compra import InventarioMovimiento


def registrar_movimiento(
    db: Session,
    producto: Producto,
    tipo: str,
    cantidad: Decimal,
    motivo: str | None = None,
    ref_tipo: str | None = None,
    ref_id: int | None = None,
    usuario_id: int | None = None,
) -> InventarioMovimiento:
    anterior = producto.stock_actual
    if tipo == "ENTRADA":
        producto.stock_actual = anterior + cantidad
    elif tipo == "SALIDA":
        if producto.stock_actual < cantidad:
            raise ValueError(f"Stock insuficiente para {producto.nombre}: {producto.stock_actual} < {cantidad}")
        producto.stock_actual = anterior - cantidad
    elif tipo == "AJUSTE":
        producto.stock_actual = cantidad  # cantidad = nuevo stock absoluto
    else:
        raise ValueError(f"Tipo de movimiento inválido: {tipo}")
    mov = InventarioMovimiento(
        producto_id=producto.id,
        tipo=tipo,
        cantidad=cantidad,
        stock_anterior=anterior,
        stock_nuevo=producto.stock_actual,
        motivo=motivo,
        ref_tipo=ref_tipo,
        ref_id=ref_id,
        usuario_id=usuario_id,
    )
    db.add(mov)
    return mov
