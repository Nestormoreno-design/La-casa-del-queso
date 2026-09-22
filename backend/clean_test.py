from app.database import engine
from sqlalchemy import text

with engine.connect() as c:
    c.execute(text(
        "TRUNCATE caja_movimientos,caja_sesiones,venta_items,ventas,"
        "pedido_items,pedidos,despachos,compra_items,compras,"
        "inventario_movimientos RESTART IDENTITY CASCADE"
    ))
    c.execute(text("DELETE FROM clientes WHERE nombre='Distribuidora Test'"))
    c.execute(text("UPDATE productos SET stock_actual=0, costo_promedio=0"))
    c.commit()
print("CLEAN OK")
