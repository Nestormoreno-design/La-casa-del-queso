import { useEffect, useState } from "react";
import { api } from "../api/client";

const METODOS = ["EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO"];

type CartLine = { producto_id: number; nombre: string; cantidad: string; precio_unitario: string; unidad: string };

export default function POS() {
  const [prods, setProds] = useState<any[]>([]);
  const [clis, setClis] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cant, setCant] = useState("1");
  const [cli, setCli] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [msg, setMsg] = useState("");

  const load = () => api.get(`/productos${q ? `?search=${q}` : ""}`).then((r) => setProds(r.data));
  useEffect(() => { load(); api.get("/clientes").then((r) => setClis(r.data)).catch(() => {}); }, []);

  const add = (p: any) => {
    const c = parseFloat(cant);
    if (!c || c <= 0) { setMsg("Cantidad inválida"); return; }
    setCart([...cart, { producto_id: p.id, nombre: p.nombre, cantidad: String(c), precio_unitario: String(p.precio_venta), unidad: p.unidad_medida }]);
    setMsg("");
  };
  const setLine = (i: number, patch: Partial<CartLine>) => { const c = [...cart]; c[i] = { ...c[i], ...patch }; setCart(c); };
  const step = (i: number, d: number) => {
    const cur = parseFloat(cart[i].cantidad) || 0;
    const next = Math.max(0, Math.round((cur + d) * 1000) / 1000);
    setLine(i, { cantidad: String(next) });
  };
  const quitar = (i: number) => setCart(cart.filter((_, j) => j !== i));
  const sub = (l: CartLine) => (parseFloat(l.cantidad) || 0) * (parseFloat(l.precio_unitario) || 0);
  const total = cart.reduce((a, l) => a + sub(l), 0);

  const checkout = async () => {
    setMsg("");
    if (cart.length === 0) { setMsg("El carrito está vacío"); return; }
    try {
      const caja = await api.get("/caja/actual").catch(() => ({ data: { abierta: false } }));
      if (!caja.data.abierta) { setMsg("Debes abrir la caja antes de registrar ventas."); return; }
      const r = await api.post("/pos/checkout", {
        cliente_id: cli ? Number(cli) : null, metodo_pago: metodo, descuento: "0",
        caja_sesion_id: caja.data.sesion_id,
        items: cart.map((c) => ({ producto_id: c.producto_id, cantidad: c.cantidad, precio_unitario: c.precio_unitario })),
      });
      setMsg(`Venta #${r.data.id} por $${Number(r.data.total).toLocaleString()} registrada. Inventario actualizado.`);
      setCart([]);
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error en checkout"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Nueva venta</h2>
        <p className="page-sub">Registra una venta y actualiza automáticamente el inventario.</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">Catálogo</h3>
          <div className="mb-2 flex gap-2">
            <input className="input" placeholder="Buscar queso..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn btn-ghost" onClick={load}>Buscar</button>
          </div>
          <div className="mb-2 flex items-center gap-2">
            <label className="text-sm text-stone-300">Cantidad (kg/und):</label>
            <input className="input" style={{ maxWidth: 120 }} value={cant} onChange={(e) => setCant(e.target.value)} placeholder="2.5" />
            <span className="text-xs text-stone-500">Ej: 0.500 · 1.250 · 2.500</span>
          </div>
          <table className="table"><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th /></tr></thead>
          <tbody>{prods.map((p) => <tr key={p.id}><td className="font-medium text-stone-50">{p.nombre}</td><td>${Number(p.precio_venta).toLocaleString()}</td><td>{p.stock_actual}</td><td><button className="btn btn-primary px-3 py-1" onClick={() => add(p)}>+</button></td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">Venta actual</h3>
          <label className="mb-1 block text-sm text-stone-300">Cliente (opcional)</label>
          <select className="input mb-2" value={cli} onChange={(e) => setCli(e.target.value)}>
            <option value="">Mostrador (sin cliente)</option>
            {clis.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          {cart.map((c, i) => (
            <div key={i} className="mb-2 rounded-xl border border-[#31373e] p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-stone-100">{c.nombre}</p>
                <button className="text-stone-500 hover:text-red-300" title="Eliminar producto" onClick={() => quitar(i)}>🗑</button>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button className="btn btn-ghost px-2 py-1" onClick={() => step(i, c.unidad === "UND" ? -1 : -0.5)}>−</button>
                <input className="input py-1 text-center" style={{ maxWidth: 90 }} value={c.cantidad} onChange={(e) => setLine(i, { cantidad: e.target.value })} title="Cantidad / peso" />
                <button className="btn btn-ghost px-2 py-1" onClick={() => step(i, c.unidad === "UND" ? 1 : 0.5)}>+</button>
                <span className="text-xs text-stone-400">{c.unidad}</span>
                <input className="input py-1" style={{ maxWidth: 110 }} value={c.precio_unitario} onChange={(e) => setLine(i, { precio_unitario: e.target.value })} title="Precio" />
                <span className="ml-auto text-sm font-semibold">${sub(c).toLocaleString()}</span>
              </div>
            </div>
          ))}
          {cart.length === 0 && <p className="text-sm text-stone-500">Agrega productos desde el catálogo.</p>}
          <p className="mt-2 text-xl font-bold text-stone-50">Total: ${total.toLocaleString()}</p>
          <label className="mb-1 mt-2 block text-sm text-stone-300">Método de pago</label>
          <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
          <button className="btn btn-primary mt-3 w-full" onClick={checkout}>Finalizar venta</button>
          {msg && <p className="mt-2 text-sm text-stone-300">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
