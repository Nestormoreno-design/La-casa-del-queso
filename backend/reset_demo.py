from app.database import engine
from sqlalchemy import text

with engine.connect() as c:
    c.execute(text(
        "TRUNCATE caja_movimientos,caja_sesiones,venta_items,ventas,"
        "pedido_items,pedidos,despachos,compra_items,compras,"
        "inventario_movimientos RESTART IDENTITY CASCADE"
    ))
    c.execute(text(
        "UPDATE productos SET stock_actual=0, costo_promedio=0, proveedor_id=NULL, "
        "precio_venta=CASE codigo "
        "WHEN 'QFRE-001' THEN 25000 WHEN 'QFRE-002' THEN 22000 "
        "WHEN 'QMAD-001' THEN 48000 WHEN 'LAC-001' THEN 9000 "
        "ELSE precio_venta END"
    ))
    c.execute(text("UPDATE clientes SET telefono='3000000000' WHERE id=1"))
    c.commit()
print("RESET DEMO OK")
