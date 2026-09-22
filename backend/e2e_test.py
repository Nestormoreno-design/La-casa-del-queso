import json
import urllib.error
import urllib.request

BASE = "http://127.0.0.1:8001"


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
        return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:500]


s, login = call("POST", "/api/v1/auth/login", {"username": "admin", "password": "admin"})
assert s == 200, login
T = login["access_token"]
print("LOGIN", s, "OK")

s, prods = call("GET", "/api/v1/productos", token=T)
print("PRODUCTOS", s, len(prods))
pid = prods[0]["id"]
print("STOCK_INI", prods[0]["codigo"], prods[0]["stock_actual"])

s, provs = call("GET", "/api/v1/proveedores", token=T)
s, compra = call("POST", "/api/v1/compras",
                 {"proveedor_id": provs[0]["id"],
                  "items": [{"producto_id": pid, "cantidad": "10", "costo_unitario": "18000"}]},
                 token=T)
print("COMPRA CREADA", s, compra)

s, r = call("POST", f"/api/v1/compras/{compra['id']}/recibir", {}, token=T)
print("COMPRA RECIBIDA", s, r)

s, prods = call("GET", "/api/v1/productos", token=T)
p1 = [p for p in prods if p["id"] == pid][0]
print("STOCK tras compra:", p1["stock_actual"], "costo:", p1["costo_promedio"])

s, caja = call("POST", "/api/v1/caja/abrir", {"saldo_inicial": "100000"}, token=T)
print("CAJA ABIERTA", s, caja)

s, venta = call("POST", "/api/v1/pos/checkout",
                {"cliente_id": None, "metodo_pago": "EFECTIVO",
                 "caja_sesion_id": caja.get("id"),
                 "items": [{"producto_id": pid, "cantidad": "2.5"}]}, token=T)
print("POS 2.5kg:", s, venta)

s, prods = call("GET", "/api/v1/productos", token=T)
print("STOCK tras POS:", [p for p in prods if p["id"] == pid][0]["stock_actual"])

s, clis = call("GET", "/api/v1/clientes", token=T)
s, ped = call("POST", "/api/v1/pedidos",
              {"cliente_id": clis[0]["id"], "items": [{"producto_id": pid, "cantidad": "1"}]},
              token=T)
print("PEDIDO (no descuenta):", s, ped)

s, prods = call("GET", "/api/v1/productos", token=T)
print("STOCK tras pedido (igual):", [p for p in prods if p["id"] == pid][0]["stock_actual"])

s, fac = call("POST", f"/api/v1/pedidos/{ped['id']}/facturar",
              {"metodo_pago": "NEQUI", "caja_sesion_id": caja.get("id")}, token=T)
print("PEDIDO FACTURADO:", s, fac)

for path in ["/api/v1/dashboard/resumen", "/api/v1/dashboard/top-productos?limite=5",
             "/api/v1/dashboard/top-clientes?limite=5", "/api/v1/dashboard/stock-bajo",
             "/api/v1/dashboard/valorizacion", "/api/v1/dashboard/ventas-por-metodo"]:
    s, d = call("GET", path, token=T)
    print("DASH", path, "->", s, json.dumps(d)[:220])

s, c = call("POST", f"/api/v1/caja/{caja.get('id')}/cerrar",
            {"saldo_final_real": "230000"}, token=T)
print("CAJA CIERRE:", s, c)
print("E2E OK")
