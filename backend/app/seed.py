"""Seed inicial: usuario admin/admin + catálogos demo."""
from decimal import Decimal

from app.core.security import hash_password
from app.database import SessionLocal
from app.models import catalogos as cat
from app.models.usuario import Usuario


def run():
    db = SessionLocal()
    try:
        if not db.query(Usuario).filter(Usuario.username == "admin").first():
            db.add(Usuario(username="admin", password_hash=hash_password("admin"), rol="administrador"))
            print("Seed: usuario admin/admin creado")
        else:
            print("Seed: admin ya existe")
        # Usuarios demo por rol (idempotente; no toca contraseñas existentes)
        for uname, pwd, rol in [("vendedor", "vendedor", "vendedor"),
                                ("bodeguero", "bodeguero", "bodeguero"),
                                ("conductor", "conductor", "conductor")]:
            if not db.query(Usuario).filter(Usuario.username == uname).first():
                db.add(Usuario(username=uname, password_hash=hash_password(pwd), rol=rol))
                print(f"Seed: usuario {uname}/{pwd} ({rol}) creado")

        if db.query(cat.Categoria).count() == 0:
            nombres = ["Quesos frescos", "Quesos madurados", "Lácteos", "Acompañamientos"]
            for n in nombres:
                db.add(cat.Categoria(nombre=n, descripcion=n))
            db.flush()
            print("Seed: 4 categorías")
        frescos = db.query(cat.Categoria).filter(cat.Categoria.nombre == "Quesos frescos").first()
        mad = db.query(cat.Categoria).filter(cat.Categoria.nombre == "Quesos madurados").first()

        if db.query(cat.Proveedor).count() == 0:
            db.add(cat.Proveedor(nombre="Lácteos El Páramo", nit="900111222-1", telefono="3001112233"))
            db.add(cat.Proveedor(nombre="Quesera La Sabana", nit="900333444-5", telefono="3004445566"))
            print("Seed: 2 proveedores")

        if db.query(cat.Cliente).count() == 0:
            db.add(cat.Cliente(nombre="Cliente Mostrador Demo", telefono="3000000000", tipo_cliente="MINORISTA"))
            db.add(cat.Cliente(nombre="Tienda La Esquina", documento="1020304050", telefono="3112223344", tipo_cliente="MINORISTA"))
            print("Seed: 2 clientes")

        if not db.query(cat.Cliente).filter(cat.Cliente.nombre == "Distribuciones El Sabor").first():
            db.add(cat.Cliente(nombre="Distribuciones El Sabor", documento="900123456-7",
                               telefono="3000000000", email="contacto@elsabor.co",
                               direccion="Bucaramanga", ciudad="Bucaramanga",
                               tipo_cliente="MAYORISTA"))
            db.commit()
            print("Seed: Distribuciones El Sabor")

        if db.query(cat.Producto).count() == 0:
            demo = [
                ("QFRE-001", "Queso campesino x kg", frescos.id if frescos else None, "PESO", "KG", "25000", "10"),
                ("QFRE-002", "Cuajada x kg", frescos.id if frescos else None, "PESO", "KG", "22000", "8"),
                ("QMAD-001", "Queso paipa x kg", mad.id if mad else None, "PESO", "KG", "48000", "5"),
                ("LAC-001", "Yogur litro", None, "UNIDAD", "UND", "9000", "20"),
            ]
            for cod, nom, cat_id, tv, um, pv, smin in demo:
                db.add(cat.Producto(codigo=cod, nombre=nom, categoria_id=cat_id, tipo_venta=tv,
                                    unidad_medida=um, precio_venta=Decimal(pv),
                                    stock_minimo=Decimal(smin), costo_promedio=Decimal("0"),
                                    stock_actual=Decimal("0")))
            print("Seed: 4 productos demo")
        db.commit()
        print("Seed OK")
    finally:
        db.close()


if __name__ == "__main__":
    run()
