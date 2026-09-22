import json
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

# caja abierta (abrir si no hay)
s, actual = call("GET", "/api/v1/caja/actual", token=T)
if not actual.get("abierta"):
    s, caja = call("POST", "/api/v1/caja/abrir", {"saldo_inicial": "100000"}, token=T)
    check("abrir caja", s == 201)
    cid = caja["id"]
else:
    cid = actual["sesion_id"]

# stock inicial via compra
s, prods = call("GET", "/api/v1/productos", token=T)
pid = prods[0]["id"]
s, provs = call("GET", "/api/v1/proveedores", token=T)
s, comp = call("POST", "/api/v1/compras",
               {"proveedor_id": provs[0]["id"],
                "items": [{"producto_id": pid, "cantidad": "10", "costo_unitario": "18000"}]}, token=T)
call("POST", f"/api/v1/compras/{comp['id']}/recibir", {}, token=T)
s, prods = call("GET", "/api/v1/productos", token=T)
stock0 = [p for p in prods if p["id"] == pid][0]["stock_actual"]
print("stock tras compra:", stock0)

# cliente con datos de facturación (modal)
s, cli = call("POST", "/api/v1/clientes",
              {"nombre": "Distribuidora Test", "documento": "900999111-2", "telefono": "3001112233",
               "email": "t@t.co", "direccion": "Calle 1", "ciudad": "Bucaramanga",
               "tipo_cliente": "DISTRIBUIDOR"}, token=T)
check("crear cliente facturación", s == 201 and cli["ciudad"] == "Bucaramanga", str(cli))

# crear pedido 2.5kg
s, ped = call("POST", "/api/v1/pedidos",
              {"cliente_id": cli["id"], "items": [{"producto_id": pid, "cantidad": "2.5"}]}, token=T)
check("crear pedido", s == 201, str(ped))
s, prods = call("GET", "/api/v1/productos", token=T)
st = [p for p in prods if p["id"] == pid][0]["stock_actual"]
check("crear NO descuenta", st == stock0, st)

# pedido mostrador (sin cliente)
s, ped2 = call("POST", "/api/v1/pedidos",
               {"cliente_id": None, "items": [{"producto_id": pid, "cantidad": "1"}]}, token=T)
check("pedido mostrador", s == 201, str(ped2))
call("DELETE", f"/api/v1/pedidos/{ped2['id']}", token=T)

# transición inválida directa a ENTREGADO
s, r = call("POST", f"/api/v1/pedidos/{ped['id']}/estado", {"estado": "ENTREGADO"}, token=T)
check("transición directa bloqueada", s == 400, f"-> {s}")

# EN_PREPARACION no descuenta
s, r = call("POST", f"/api/v1/pedidos/{ped['id']}/estado", {"estado": "EN_PREPARACION"}, token=T)
check("a EN_PREPARACION", s == 200, str(r))
s, prods = call("GET", "/api/v1/productos", token=T)
st = [p for p in prods if p["id"] == pid][0]["stock_actual"]
check("preparación NO descuenta", st == stock0, st)

# editar en EN_PREPARACION bloqueado
s, r = call("PUT", f"/api/v1/pedidos/{ped['id']}",
            {"cliente_id": cli["id"], "items": [{"producto_id": pid, "cantidad": "1"}]}, token=T)
check("editar EN_PREPARACION bloqueado", s == 400, f"-> {s}")

# entregar
s, ent = call("POST", f"/api/v1/pedidos/{ped['id']}/entregar", {"metodo_pago": "EFECTIVO"}, token=T)
check("entregar crea venta", s == 200 and "venta_id" in ent, str(ent))
s, prods = call("GET", "/api/v1/productos", token=T)
st = [p for p in prods if p["id"] == pid][0]["stock_actual"]
check("entregar descuenta 2.5", abs(float(st) - (float(stock0) - 2.5)) < 0.001, st)
s, v = call("GET", f"/api/v1/ventas/{ent['venta_id']}", token=T)
check("venta ligada a pedido", s == 200 and v["pedido_id"] == ped["id"], f"pedido_id={v.get('pedido_id') if s==200 else '?'}")
s, res = call("GET", f"/api/v1/caja/{cid}/resumen", token=T)
check("caja registra venta", float(res["total_ventas"]) > 0, res["total_ventas"])
s, det = call("GET", f"/api/v1/pedidos/{ped['id']}", token=T)
check("pedido ENTREGADO", det["estado"] == "ENTREGADO", det["estado"])
s, d = call("GET", "/api/v1/dashboard/resumen", token=T)
check("dashboard refleja", float(d["ventas_dia"]) > 0, str(d["ventas_dia"]))

print(f"\nRESULTADO: {sum(ok)}/{len(ok)} PASS")
