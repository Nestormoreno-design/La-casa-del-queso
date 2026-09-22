import json
from datetime import date, timedelta
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8001"
ok = []


def call(method, path, data=None, token=None):
    req = urllib.request.Request(
        BASE + path,
        data=json.dumps(data).encode() if data is not None else None,
        headers={"Content-Type": "application/json"},
        method=method,
    )
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        r = urllib.request.urlopen(req)
        body = r.read().decode()
        return r.status, json.loads(body) if body else None
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:300]


def check(name, cond, extra=""):
    print(("PASS " if cond else "FAIL ") + name, extra)
    ok.append(cond)


s, login = call("POST", "/api/v1/auth/login", {"username": "admin", "password": "admin"})
check("login", s == 200)
T = login["access_token"]

s, actual = call("GET", "/api/v1/caja/actual", token=T)
cid = actual["sesion_id"] if actual.get("abierta") else call("POST", "/api/v1/caja/abrir", {"saldo_inicial": "100000"}, token=T)[1]["id"]

# 1. crear producto
s, p = call("POST", "/api/v1/productos",
            {"codigo": "QDC-T1", "nombre": "Queso doble crema test", "tipo_venta": "PESO",
             "unidad_medida": "KG", "precio_venta": "22000", "stock_minimo": "10",
             "categoria_id": None}, token=T)
check("1 crear producto", s == 201, str(p.get("codigo") if isinstance(p, dict) else p))
pid = p["id"]

# 2-4. compra directa 100kg
s, provs = call("GET", "/api/v1/proveedores", token=T)
s, comp = call("POST", "/api/v1/compras/directa",
               {"proveedor_id": provs[0]["id"],
                "items": [{"producto_id": pid, "cantidad": "100", "costo_unitario": "18000"}]}, token=T)
check("2-3 compra directa RECIBIDA", s == 201 and comp["estado"] == "RECIBIDA", str(comp.get("total")))
s, prods = call("GET", "/api/v1/productos", token=T)
st = [x for x in prods if x["id"] == pid][0]["stock_actual"]
check("4 inventario +100", st == "100.000", st)

# 5. cliente
s, clis = call("GET", "/api/v1/clientes", token=T)
esq = next((c for c in clis if c["nombre"] == "Tienda La Esquina"), None)
check("5 cliente existe", esq is not None, esq["nombre"] if esq else "?")

# 6-8. pedido 20kg con fecha futura
fut = (date.today() + timedelta(days=3)).isoformat()
s, ped = call("POST", "/api/v1/pedidos",
              {"cliente_id": esq["id"], "fecha_entrega": fut + "T12:00:00",
               "hora_entrega": "8:00 AM - 10:00 AM", "direccion_entrega": "Cra 15 # 48-20",
               "items": [{"producto_id": pid, "cantidad": "20"}]}, token=T)
check("6-8 pedido programado creado", s == 201, str(ped))
s, prods = call("GET", "/api/v1/productos", token=T)
st = [x for x in prods if x["id"] == pid][0]["stock_actual"]
check("9 inventario NO disminuye", st == "100.000", st)

# 10. dashboard próximas
s, dd = call("GET", "/api/v1/dashboard/distribucion", token=T)
hay = any(x["id"] == ped["id"] for x in dd["proximas"])
check("10 dashboard próxima entrega", s == 200 and hay, f"n={len(dd['proximas']) if s==200 else '?'}")

# 11-12. EN_PREPARACION y PROGRAMADO no descuentan
call("POST", f"/api/v1/pedidos/{ped['id']}/estado", {"estado": "EN_PREPARACION"}, token=T)
s, r = call("POST", f"/api/v1/pedidos/{ped['id']}/estado", {"estado": "PROGRAMADO"}, token=T)
check("11-12 preparar+programar", s == 200, str(r))
s, prods = call("GET", "/api/v1/productos", token=T)
st = [x for x in prods if x["id"] == pid][0]["stock_actual"]
check("12 programado NO descuenta", st == "100.000", st)

# 14. entregar
s, ent = call("POST", f"/api/v1/pedidos/{ped['id']}/entregar", {"metodo_pago": "TRANSFERENCIA"}, token=T)
check("14 entregar crea venta", s == 200, str(ent))
s, prods = call("GET", "/api/v1/productos", token=T)
st = [x for x in prods if x["id"] == pid][0]["stock_actual"]
check("15 inventario -20 = 80", st == "80.000", st)
s, v = call("GET", f"/api/v1/ventas/{ent['venta_id']}", token=T)
check("15 venta DISTRIBUCION ligada", v["tipo"] == "DISTRIBUCION" and v["pedido_id"] == ped["id"], f"tipo={v.get('tipo')}")
s, res = call("GET", f"/api/v1/caja/{cid}/resumen", token=T)
check("15 caja registra", float(res["total_ventas"]) >= 440000, res["total_ventas"])
s, lst = call("GET", "/api/v1/ventas?tipo=DISTRIBUCION", token=T)
check("15 historial DISTRIBUCION", any(x["id"] == ent["venta_id"] for x in lst), f"n={len(lst)}")

# 16-17. menudeo independiente
s, vm = call("POST", "/api/v1/pos/checkout",
             {"metodo_pago": "EFECTIVO", "items": [{"producto_id": pid, "cantidad": "2.5"}]}, token=T)
s, det = call("GET", f"/api/v1/ventas/{vm['id']}", token=T)
check("16-17 menudeo MENUDEO", det["tipo"] == "MENUDEO", det["tipo"])

# 18. informe filtros
s, a = call("GET", "/api/v1/ventas?tipo=MENUDEO", token=T)
s, b = call("GET", "/api/v1/ventas?tipo=DISTRIBUCION", token=T)
s, c = call("GET", "/api/v1/ventas", token=T)
check("18 informe tipos", len(a) >= 1 and len(b) >= 1 and len(c) >= len(a) + len(b) - 1,
      f"men={len(a)} dis={len(b)} tot={len(c)}")

print(f"\nRESULTADO: {sum(ok)}/{len(ok)} PASS")
