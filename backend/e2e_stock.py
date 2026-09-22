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

s, prods = call("GET", "/api/v1/productos", token=T)
pid = prods[0]["id"]
s, provs = call("GET", "/api/v1/proveedores", token=T)

# baseline stock
s, prods = call("GET", "/api/v1/productos", token=T)
base = float([x for x in prods if x["id"] == pid][0]["stock_actual"])

# agregar stock 10kg con costo y proveedor
s, r = call("POST", "/api/v1/inventario/entrada",
            {"producto_id": pid, "cantidad": "10", "costo_unitario": "18000",
             "proveedor_id": provs[0]["id"], "observacion": "prueba"}, token=T)
check("agregar stock ENTRADA", s == 200 and abs(float(r["nuevo"]) - (base + 10.0)) < 0.001, str(r))
s, movs = call("GET", "/api/v1/inventario/movimientos", token=T)
ult = [m for m in movs if m["producto_id"] == pid][0]
check("movimiento ENTRADA registrado", ult["tipo"] == "ENTRADA" and abs(float(ult["cantidad"]) - 10.0) < 0.001 and "Agregar stock" in (ult["motivo"] or ""),
      f"{ult['tipo']} {ult['cantidad']} {ult['motivo']}")
s, prods = call("GET", "/api/v1/productos", token=T)
p = [x for x in prods if x["id"] == pid][0]
check("costo y proveedor actualizados", abs(float(p["costo_promedio"]) - 18000.0) < 0.01 and p["proveedor_id"] == provs[0]["id"],
      f"costo={p['costo_promedio']} prov={p['proveedor_id']}")

# cantidad inválida
s, r = call("POST", "/api/v1/inventario/entrada", {"producto_id": pid, "cantidad": "0"}, token=T)
check("cantidad 0 bloqueada", s == 400, f"-> {s}")

print(f"\nRESULTADO: {sum(ok)}/{len(ok)} PASS")
