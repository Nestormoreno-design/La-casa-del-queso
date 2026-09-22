import { useEffect, useState } from "react";
import { api } from "../api/client";
import { fmtCantidad, fmtMoney } from "../utils/format";

const METODOS = ["EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO"];

type CartLine = {
  producto_id: number; nombre: string; cantidad: string;
  precio_unitario: string; precio_base: string; unidad: string;
};

export default function POS() {
  const [prods, setProds] = useState<any[]>([]);
  const [clis, setClis] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [cant, setCant] = useState("1");
  const [cli, setCli] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [editPrecio, setEditPrecio] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api.get(`/productos${q ? `?search=${q}` : ""}`).then((r) => setProds(r.data));
  useEffect(() => { load(); api.get("/clientes").then((r) => setClis(r.data)).catch(() => {}); }, []);

  const add = (p: any) => {
    const c = parseFloat(cant);
    if (!c || c <= 0) { setMsg("Cantidad inválida"); return; }
    setCart([...cart, {
      producto_id: p.id, nombre: p.nombre, cantidad: String(c),
      precio_unitario: String(p.precio_venta), precio_base: String(p.precio_venta),
      unidad: p.unidad_medida,
    }]);
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
  const precioAlterado = (l: CartLine) => l.precio_unitario !== l.precio_base;

  const checkout = async () => {
    setMsg("");
    if (cart.length === 0) { setMsg("El carrito está vacío"); return; }
    if (metodo === "CREDITO" && !cli) { setMsg("El crédito requiere seleccionar un cliente."); return; }
    try {
      let cajaId: number | null = null;
      if (metodo !== "CREDITO") {
        const caja = await api.get("/caja/actual").catch(() => ({ data: { abierta: false } }));
        if (!caja.data.abierta) { setMsg("Debes abrir la caja antes de registrar ventas."); return; }
        cajaId = caja.data.sesion_id;
      }
      const r = await api.post("/pos/checkout", {
        cliente_id: cli ? Number(cli) : null, metodo_pago: metodo, descuento: "0",
        caja_sesion_id: cajaId,
        items: cart.map((c) => ({ producto_id: c.producto_id, cantidad: c.cantidad, precio_unitario: c.precio_unitario })),
      });
      setMsg(metodo === "CREDITO"
        ? `Venta #${r.data.id} a crédito por ${fmtMoney(r.data.total)}. Quedó pendiente de pago.`
        : `Venta #${r.data.id} por ${fmtMoney(r.data.total)} registrada. Inventario actualizado.`);
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
            <span className="text-xs text-stone-500">Ej: 0.5 · 1 · 2.5</span>
          </div>
          <table className="table"><thead><tr><th>Producto</th><th>Precio</th><th>Stock</th><th /></tr></thead>
          <tbody>{prods.map((p) => <tr key={p.id}><td className="font-medium text-stone-50">{p.nombre}</td><td>{fmtMoney(p.precio_venta)}</td><td>{fmtCantidad(p.stock_actual, p.unidad_medida)} {p.unidad_medida}</td><td><button className="btn btn-primary px-3 py-1" onClick={() => add(p)}>+</button></td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">Venta actual</h3>
          <label className="mb-1 block text-sm text-stone-300">Cliente (opcional)</label>
          <select className="input mb-2" value={cli} onChange={(e) => setCli(e.target.value)}>
            <option value="">Mostrador (sin cliente)</option>
            {clis.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
          <label className="mb-2 flex cursor-pointer items-center gap-2 text-sm text-stone-300">
            <input type="checkbox" checked={editPrecio} onChange={(e) => setEditPrecio(e.target.checked)} className="h-4 w-4 accent-[#c9a86a]" />
            Modificar precio
            {!editPrecio && <span className="text-xs text-stone-500">(se usa el precio configurado del producto)</span>}
          </label>
          {cart.map((c, i) => (
            <div key={i} className={`mb-2 rounded-xl border p-2 ${precioAlterado(c) ? "border-amber-500/60" : "border-[#31373e]"}`}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-stone-100">{c.nombre}</p>
                <button className="text-stone-500 hover:text-red-300" title="Eliminar producto" onClick={() => quitar(i)}>🗑</button>
              </div>
              <div className="mt-1 flex items-center gap-1">
                <button className="btn btn-ghost px-2 py-1" onClick={() => step(i, c.unidad === "UND" ? -1 : -0.5)}>−</button>
                <input className="input py-1 text-center" style={{ maxWidth: 90 }} value={c.cantidad} onChange={(e) => setLine(i, { cantidad: e.target.value })} title="Cantidad / peso" />
                <button className="btn btn-ghost px-2 py-1" onClick={() => step(i, c.unidad === "UND" ? 1 : 0.5)}>+</button>
                <span className="text-xs text-stone-400">{c.unidad}</span>
                <input
                  className="input py-1"
                  style={{ maxWidth: 110 }}
                  value={c.precio_unitario}
                  onChange={(e) => setLine(i, { precio_unitario: e.target.value })}
                  title={editPrecio ? "Precio manual" : "Activa 'Modificar precio' para editar"}
                  disabled={!editPrecio}
                  placeholder={c.precio_base}
                />
                <span className="ml-auto text-sm font-semibold">{fmtMoney(sub(c))}</span>
              </div>
              {precioAlterado(c) && <p className="mt-1 text-xs text-amber-300">⚠️ Precio modificado (configurado: {fmtMoney(c.precio_base)})</p>}
            </div>
          ))}
          {cart.length === 0 && <p className="text-sm text-stone-500">Agrega productos desde el catálogo.</p>}
          <p className="mt-2 text-xl font-bold text-stone-50">Total: {fmtMoney(total)}</p>
          <label className="mb-1 mt-2 block text-sm text-stone-300">Método de pago</label>
          <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
          {metodo === "CREDITO" && <p className="mt-1 text-xs text-amber-300">La venta quedará pendiente de pago (crédito del cliente).</p>}
          <button className="btn btn-primary mt-3 w-full" onClick={checkout}>Finalizar venta</button>
          {msg && <p className="mt-2 text-sm text-stone-300">{msg}</p>}
        </div>
      </div>
    </div>
  );
}
