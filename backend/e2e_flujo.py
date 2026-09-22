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
T = login["access_token"]
s, actual = call("GET", "/api/v1/caja/actual", token=T)
cid = actual["sesion_id"] if actual.get("abierta") else call("POST", "/api/v1/caja/abrir", {"saldo_inicial": "100000"}, token=T)[1]["id"]

# 1. producto
s, p = call("POST", "/api/v1/productos",
            {"codigo": "QDC-F1", "nombre": "Queso doble crema flujo", "tipo_venta": "PESO",
             "unidad_medida": "KG", "precio_venta": "22000", "stock_minimo": "10",
             "categoria_id": None}, token=T)
check("1 crear producto", s == 201)
pid = p["id"]
# 2-4. compra directa 100
s, provs = call("GET", "/api/v1/proveedores", token=T)
s, comp = call("POST", "/api/v1/compras/directa",
               {"proveedor_id": provs[0]["id"],
                "items": [{"producto_id": pid, "cantidad": "100", "costo_unitario": "18000"}]}, token=T)
check("2-3 compra directa", s == 201 and comp["estado"] == "RECIBIDA", str(comp.get("total")))
s, prods = call("GET", "/api/v1/productos", token=T)
check("4 stock 100", [x for x in prods if x["id"] == pid][0]["stock_actual"] == "100.000")
# 5. cliente
s, clis = call("GET", "/api/v1/clientes", token=T)
esq = next(c for c in clis if c["nombre"] == "Tienda La Esquina")
check("5 cliente", True, esq["nombre"])
# 6-8. pedido 20 + fecha futura + hora
fut = (date.today() + timedelta(days=4)).isoformat()
s, ped = call("POST", "/api/v1/pedidos",
              {"cliente_id": esq["id"], "fecha_entrega": fut + "T12:00:00",
               "hora_entrega": "8:00 AM - 10:00 AM", "direccion_entrega": "Cra 15 # 48-20",
               "items": [{"producto_id": pid, "cantidad": "20"}]}, token=T)
check("6-8 pedido con programación", s == 201 and ped["total"] == "440000.00", str(ped))
s, det = call("GET", f"/api/v1/pedidos/{ped['id']}", token=T)
check("8 fecha/hora guardadas", det["hora_entrega"] == "8:00 AM - 10:00 AM" and det["fecha_entrega"][:10] == fut, f"{det['fecha_entrega'][:10]} {det['hora_entrega']}")
s, prods = call("GET", "/api/v1/productos", token=T)
check("9 no descuenta", [x for x in prods if x["id"] == pid][0]["stock_actual"] == "100.000")
# 10. dashboard
s, dd = call("GET", "/api/v1/dashboard/distribucion", token=T)
check("10 próxima en dashboard", any(x["id"] == ped["id"] for x in dd["proximas"]), f"n={len(dd['proximas'])}")
# 11. preparando
call("POST", f"/api/v1/pedidos/{ped['id']}/estado", {"estado": "PREPARANDO"}, token=T)
# generar venta
s, g = call("POST", f"/api/v1/pedidos/{ped['id']}/generar-venta", {"metodo_pago": "TRANSFERENCIA"}, token=T)
check("13 generar venta LISTO", s == 200, str(g))
s, prods = call("GET", "/api/v1/productos", token=T)
check("19 generar no descuenta", [x for x in prods if x["id"] == pid][0]["stock_actual"] == "100.000")
# 14. factura demo datos
s, v = call("GET", f"/api/v1/ventas/{g['venta_id']}", token=T)
fac_ok = (v["cliente"] and v["cliente"]["documento"] == "1020304050"
          and len(v["items"]) == 1 and v["estado"] == "FACTURADA")
check("14 factura DEMO datos", fac_ok, f"cli={v['cliente']['nombre']} items={len(v['items'])} est={v['estado']}")
# entregar
s, e = call("POST", f"/api/v1/pedidos/{ped['id']}/entregar", {"metodo_pago": "TRANSFERENCIA"}, token=T)
check("entregar", s == 200, str(e))
s, prods = call("GET", "/api/v1/productos", token=T)
check("20 entregar descuenta 80", [x for x in prods if x["id"] == pid][0]["stock_actual"] == "80.000")
s, res = call("GET", f"/api/v1/caja/{cid}/resumen", token=T)
check("caja registra", float(res["total_ventas"]) >= 440000, res["total_ventas"])
s, lst = call("GET", "/api/v1/ventas?tipo=DISTRIBUCION", token=T)
check("historial DISTRIBUCION", any(x["id"] == g["venta_id"] for x in lst), f"n={len(lst)}")
# 16-17 menudeo
s, vm = call("POST", "/api/v1/pos/checkout",
             {"metodo_pago": "EFECTIVO", "items": [{"producto_id": pid, "cantidad": "2"}]}, token=T)
s, det = call("GET", f"/api/v1/ventas/{vm['id']}", token=T)
check("16-17 menudeo", det["tipo"] == "MENUDEO", det["tipo"])
# 18 informe
s, a = call("GET", "/api/v1/ventas?tipo=MENUDEO", token=T)
s, b = call("GET", "/api/v1/ventas?tipo=DISTRIBUCION", token=T)
s, c = call("GET", "/api/v1/ventas", token=T)
check("18 filtros informe", len(a) >= 1 and len(b) >= 1 and len(c) >= 2, f"men={len(a)} dis={len(b)} tot={len(c)}")

print(f"\nRESULTADO: {sum(ok)}/{len(ok)} PASS")
