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
check("1 login admin/admin", s == 200)
T = login["access_token"]

# 6. vender sin caja abierta debe fallar (aún no hay abierta: verificar)
s, actual = call("GET", "/api/v1/caja/actual", token=T)
if actual.get("abierta"):
    call("POST", f"/api/v1/caja/{actual['sesion_id']}/cerrar", {"saldo_final_real": actual.get("teorico", "0")}, token=T)
s, prods = call("GET", "/api/v1/productos", token=T)
pid = prods[0]["id"]
s, r = call("POST", "/api/v1/pos/checkout",
            {"metodo_pago": "EFECTIVO", "items": [{"producto_id": pid, "cantidad": "1"}]}, token=T)
check("6 venta sin caja bloqueada", s == 400, f"-> {s} {r}")

# 2. abrir caja
s, caja = call("POST", "/api/v1/caja/abrir", {"saldo_inicial": "100000"}, token=T)
check("2 abrir caja 100000", s == 201, str(caja))
cid = caja["id"]

# 3. compra 10kg + recibir
s, provs = call("GET", "/api/v1/proveedores", token=T)
s, comp = call("POST", "/api/v1/compras",
               {"proveedor_id": provs[0]["id"],
                "items": [{"producto_id": pid, "cantidad": "10", "costo_unitario": "18000"}]}, token=T)
check("3a compra creada", s == 201, str(comp))
# editar antes de recibir
s, r = call("PUT", f"/api/v1/compras/{comp['id']}",
            {"proveedor_id": provs[0]["id"],
             "items": [{"producto_id": pid, "cantidad": "10", "costo_unitario": "18000"}]}, token=T)
check("3b compra editable antes de recibir", s == 200, str(r))
s, r = call("POST", f"/api/v1/compras/{comp['id']}/recibir", {}, token=T)
check("3c compra recibida", s == 200, str(r))

# 4. stock 10
s, prods = call("GET", "/api/v1/productos", token=T)
st = [p for p in prods if p["id"] == pid][0]["stock_actual"]
check("4 stock == 10", st == "10.000", st)

# 7-8. vender 2.5kg
s, v = call("POST", "/api/v1/pos/checkout",
            {"metodo_pago": "EFECTIVO", "items": [{"producto_id": pid, "cantidad": "2.5"}]}, token=T)
check("7-8 venta 2.5kg", s == 201, str(v))
vid = v["id"]

# 9. stock 7.5
s, prods = call("GET", "/api/v1/productos", token=T)
st = [p for p in prods if p["id"] == pid][0]["stock_actual"]
check("9 stock == 7.5", st == "7.500", st)

# 10. caja tiene la venta
s, res = call("GET", f"/api/v1/caja/{cid}/resumen", token=T)
check("10 caja total_ventas 55000", res["total_ventas"] == "55000.00", str(res["total_ventas"]))

# 11. dashboard
s, d = call("GET", "/api/v1/dashboard/resumen", token=T)
check("11 dashboard ventas_dia", d["ventas_dia"] == "55000.00", str(d))

# 12. informe filtros
s, lst = call("GET", "/api/v1/ventas?estado=PAGADA&metodo_pago=EFECTIVO", token=T)
check("12 informe filtros", s == 200 and len(lst) >= 1, f"n={len(lst) if s==200 else '?'}")

# 13. abrir venta
s, det = call("GET", f"/api/v1/ventas/{vid}", token=T)
check("13 detalle venta con items", s == 200 and len(det["items"]) == 1, f"items={len(det['items']) if s==200 else '?'}")

# stock negativo bloqueado
s, r = call("POST", "/api/v1/pos/checkout",
            {"metodo_pago": "EFECTIVO", "items": [{"producto_id": pid, "cantidad": "999"}]}, token=T)
check("12b stock negativo bloqueado", s == 400, f"-> {s}")

# 14. anular
s, r = call("POST", f"/api/v1/ventas/{vid}/anular", {}, token=T)
check("14 anular venta", s == 200, str(r))

# 15. stock vuelve a 10
s, prods = call("GET", "/api/v1/productos", token=T)
st = [p for p in prods if p["id"] == pid][0]["stock_actual"]
check("15 stock vuelve a 10", st == "10.000", st)

# 16. caja revertida
s, res = call("GET", f"/api/v1/caja/{cid}/resumen", token=T)
check("16 caja revertida total 0", res["total_ventas"] == "0", str(res["total_ventas"]))

# CRUD extra
s, clis = call("GET", "/api/v1/clientes", token=T)
s, r = call("PUT", f"/api/v1/clientes/{clis[0]['id']}", {"telefono": "3009998877"}, token=T)
check("CRUD cliente editar", s == 200, str(r))
s, r = call("PUT", f"/api/v1/productos/{pid}", {"precio_venta": "23000", "proveedor_id": provs[0]["id"]}, token=T)
check("CRUD producto editar+proveedor", s == 200, str(r))
s, ped = call("POST", "/api/v1/pedidos",
              {"cliente_id": clis[0]["id"], "items": [{"producto_id": pid, "cantidad": "1"}]}, token=T)
s, r = call("PUT", f"/api/v1/pedidos/{ped['id']}",
            {"cliente_id": clis[0]["id"], "items": [{"producto_id": pid, "cantidad": "2"}]}, token=T)
check("CRUD pedido editar pendiente", s == 200, str(r))
s, r = call("DELETE", f"/api/v1/pedidos/{ped['id']}", token=T)
check("CRUD pedido cancelar pendiente", s == 200, str(r))
s, r = call("POST", "/api/v1/inventario/ajuste", {"producto_id": pid, "nuevo_stock": "-5"}, token=T)
check("CRUD ajuste negativo bloqueado", s == 400, f"-> {s}")

# 17. historial
s, hist = call("GET", "/api/v1/caja/historial", token=T)
check("17 historial cajas", s == 200 and len(hist) >= 1, f"n={len(hist) if s==200 else '?'}")

# 18. cerrar
s, prods2 = call("GET", "/api/v1/productos", token=T)
s, cierre = call("POST", f"/api/v1/caja/{cid}/cerrar", {"saldo_final_real": "100000"}, token=T)
check("18 cerrar caja", s == 200, str(cierre))

# 19. verificar ficha
s, det = call("GET", f"/api/v1/caja/{cid}/detalle", token=T)
ficha_ok = all([det["fecha_apertura"], det["fecha_cierre"], det["saldo_inicial"] == "100000.00",
                det["estado"] == "CERRADA", det["responsable"] == "admin"])
check("19 ficha completa e inmutable", s == 200 and ficha_ok, str({k: det.get(k) for k in ["fecha_apertura","fecha_cierre","saldo_inicial","estado","responsable"]}))

# 20. imposible modificar cerrada
s, r = call("POST", f"/api/v1/caja/{cid}/movimiento", {"tipo": "INGRESO", "monto": "10"}, token=T)
check("20a movimiento en cerrada bloqueado", s == 400, f"-> {s}")
s, r = call("POST", f"/api/v1/caja/{cid}/cerrar", {"saldo_final_real": "0"}, token=T)
check("20b recerrar bloqueado", s == 400, f"-> {s}")
# venta sin caja (cerrada, ninguna abierta) bloqueada
s, r = call("POST", "/api/v1/pos/checkout",
            {"metodo_pago": "EFECTIVO", "items": [{"producto_id": pid, "cantidad": "1"}]}, token=T)
check("20c venta sin caja bloqueada", s == 400, f"-> {s} {r}")

print(f"\nRESULTADO: {sum(ok)}/{len(ok)} PASS")
