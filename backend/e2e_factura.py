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
T = login["access_token"]
s, actual = call("GET", "/api/v1/caja/actual", token=T)
if not actual.get("abierta"):
    call("POST", "/api/v1/caja/abrir", {"saldo_inicial": "100000"}, token=T)
s, prods = call("GET", "/api/v1/productos", token=T)
pid = prods[0]["id"]
s, prods0 = call("GET", "/api/v1/productos", token=T)
base = float([x for x in prods0 if x["id"] == pid][0]["stock_actual"])
s, clis = call("GET", "/api/v1/clientes", token=T)

s, ped = call("POST", "/api/v1/pedidos",
              {"cliente_id": clis[0]["id"], "items": [{"producto_id": pid, "cantidad": "2"}]}, token=T)
check("crear pedido", s == 201, str(ped))
call("POST", f"/api/v1/pedidos/{ped['id']}/estado", {"estado": "PREPARANDO"}, token=T)

# entregar sin generar -> 400
s, r = call("POST", f"/api/v1/pedidos/{ped['id']}/entregar", {"metodo_pago": "EFECTIVO"}, token=T)
check("entregar sin venta bloqueado", s == 400, f"-> {s}")

# generar venta
s, g = call("POST", f"/api/v1/pedidos/{ped['id']}/generar-venta", {"metodo_pago": "CREDITO"}, token=T)
check("generar venta", s == 200, str(g))
s, prods = call("GET", "/api/v1/productos", token=T)
st = float([x for x in prods if x["id"] == pid][0]["stock_actual"])
check("generar NO descuenta", abs(st - base) < 0.001, st)
s, v = call("GET", f"/api/v1/ventas/{g['venta_id']}", token=T)
check("venta FACTURADA", v["estado"] == "FACTURADA" and v["pedido_id"] == ped["id"], f"{v['estado']} ped={v.get('pedido_id')}")
s, det = call("GET", f"/api/v1/pedidos/{ped['id']}", token=T)
check("pedido LISTO", det["estado"] == "LISTO", det["estado"])

# entregar
s, e = call("POST", f"/api/v1/pedidos/{ped['id']}/entregar", {"metodo_pago": "CREDITO"}, token=T)
check("entregar", s == 200, str(e))
s, prods = call("GET", "/api/v1/productos", token=T)
st = float([x for x in prods if x["id"] == pid][0]["stock_actual"])
check("entregar descuenta", abs(st - (base - 2.0)) < 0.001, st)
s, v = call("GET", f"/api/v1/ventas/{g['venta_id']}", token=T)
check("venta PAGADA", v["estado"] == "PAGADA", v["estado"])

# segundo pedido: generar + anular FACTURADA (no debe mover stock)
s, ped2 = call("POST", "/api/v1/pedidos",
               {"cliente_id": clis[0]["id"], "items": [{"producto_id": pid, "cantidad": "1"}]}, token=T)
s, g2 = call("POST", f"/api/v1/pedidos/{ped2['id']}/generar-venta", {"metodo_pago": "EFECTIVO"}, token=T)
s, prods = call("GET", "/api/v1/productos", token=T)
st0 = float([x for x in prods if x["id"] == pid][0]["stock_actual"])
s, r = call("POST", f"/api/v1/ventas/{g2['venta_id']}/anular", {}, token=T)
s, prods = call("GET", "/api/v1/productos", token=T)
st1 = float([x for x in prods if x["id"] == pid][0]["stock_actual"])
s, det2 = call("GET", f"/api/v1/pedidos/{ped2['id']}", token=T)
check("anular FACTURADA no mueve stock y revierte pedido", s == 200 and abs(st1 - st0) < 0.001 and det2["estado"] == "PREPARANDO", f"{st0}->{st1} ped={det2['estado']}")

print(f"\nRESULTADO: {sum(ok)}/{len(ok)} PASS")
