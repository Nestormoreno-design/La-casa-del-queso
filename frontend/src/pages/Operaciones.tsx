import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import VentaDetail from "../components/VentaDetail";
import { fmtMoney } from "../utils/format";

type Linea = { producto_id: number | ""; cantidad: string; costo_unitario: string };

export function Compras() {
  const [items, setItems] = useState<any[]>([]);
  const [provs, setProvs] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [prov, setProv] = useState("");
  const [lines, setLines] = useState<Linea[]>([]);
  const [msg, setMsg] = useState("");
  const [ultimo, setUltimo] = useState<any>(null);

  const load = () => api.get("/compras").then((r) => setItems(r.data));
  useEffect(() => { load(); api.get("/proveedores").then((r) => setProvs(r.data)); api.get("/productos").then((r) => setProds(r.data)); }, []);

  const sub = (l: Linea) => (parseFloat(l.cantidad) || 0) * (parseFloat(l.costo_unitario) || 0);
  const total = lines.reduce((a, l) => a + sub(l), 0);
  const unidadDe = (id: number | "") => prods.find((p) => p.id === id)?.unidad_medida ?? "—";
  const setLine = (i: number, patch: Partial<Linea>) => { const c = [...lines]; c[i] = { ...c[i], ...patch }; setLines(c); };

  const registrar = async () => {
    try {
      if (!prov) { setMsg("Selecciona un proveedor"); return; }
      const validas = lines.filter((l) => l.producto_id !== "");
      if (validas.length === 0) { setMsg("Agrega al menos un producto"); return; }
      const r = await api.post("/compras/directa", { proveedor_id: Number(prov), items: validas.map((l) => ({ producto_id: Number(l.producto_id), cantidad: l.cantidad, costo_unitario: l.costo_unitario })) });
      setUltimo(r.data);
      setMsg(`Compra #${r.data.id} registrada. La mercancía ya entró al inventario.`);
      setLines([]); setProv(""); load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Registrar compra</h2>
        <p className="page-sub">Compra recibida: aumenta automáticamente el inventario. <Link to="/inventario" className="underline">Volver a Inventario →</Link></p>
      </div>
      <div className="card overflow-x-auto">
        <div className="mb-2"><label className="mb-1 block text-xs text-stone-400">Proveedor</label>
        <select className="input" value={prov} onChange={(e) => setProv(e.target.value)}><option value="">Seleccionar proveedor</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></div>
        <h3 className="mb-1 mt-2 text-sm font-semibold text-stone-300">Productos</h3>
        <table className="table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th><th>Costo de compra (por unidad)</th><th>Subtotal</th><th>Eliminar</th></tr></thead>
        <tbody>
          {lines.map((l, i) => (
            <tr key={i}>
              <td><select className="input" value={l.producto_id} onChange={(e) => setLine(i, { producto_id: e.target.value ? Number(e.target.value) : "" })}><option value="">Seleccionar...</option>{prods.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></td>
              <td><input className="input" style={{ minWidth: 90 }} value={l.cantidad} onChange={(e) => setLine(i, { cantidad: e.target.value })} placeholder="100" /></td>
              <td>{unidadDe(l.producto_id)}</td>
              <td><input className="input" style={{ minWidth: 110 }} value={l.costo_unitario} onChange={(e) => setLine(i, { costo_unitario: e.target.value })} placeholder={`por ${unidadDe(l.producto_id)}`} title="Cuánto se paga al proveedor por cada unidad" /></td>
              <td className="font-medium">${sub(l).toLocaleString()}</td>
              <td><button className="btn btn-ghost px-3 py-1" title="Eliminar fila" onClick={() => setLines(lines.filter((_, j) => j !== i))}>🗑</button></td>
            </tr>
          ))}
        </tbody></table>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button className="btn btn-ghost" onClick={() => setLines([...lines, { producto_id: "", cantidad: "1", costo_unitario: "0" }])}>+ Agregar producto</button>
          <span className="ml-auto font-bold text-stone-50">Total de compra: ${total.toLocaleString()}</span>
        </div>
        <button className="btn btn-primary mt-2" onClick={registrar}>Registrar compra</button>
        {msg && <p className="mt-2 text-sm text-stone-300">{msg}</p>}
        {ultimo?.detalle && (
          <div className="mt-2 rounded-xl border border-[#31373e] p-2 text-sm">
            {ultimo.detalle.map((d: any, i: number) => <p key={i}>{d.producto}: {d.anterior} + {d.entrada} = <strong>{d.nuevo}</strong></p>)}
          </div>
        )}
      </div>
      <div className="card overflow-x-auto">
        <h3 className="mb-2 font-semibold text-stone-100">Historial de compras</h3>
        <table className="table"><thead><tr><th>ID</th><th>Proveedor</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>{items.map((c: any) => <tr key={c.id}><td>#{c.id}</td><td>{c.proveedor?.nombre}</td><td>${Number(c.total).toLocaleString()}</td><td>{c.estado}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}

const tipoBadge = (t: string) =>
  t === "DISTRIBUCION" ? <span className="badge badge-warn">Mayorista</span> : <span className="badge badge-ok">Minorista</span>;

const estadoBadge = (e: string) =>
  e === "PAGADA" ? <span className="badge badge-ok">PAGADA</span>
  : e === "PENDIENTE" ? <span className="badge badge-bad">CRÉDITO</span>
  : e === "FACTURADA" ? <span className="badge badge-warn">FACTURADA</span>
  : <span className="badge badge-bad">ANULADA</span>;

export function Ventas() {
  const [items, setItems] = useState<any[]>([]);
  const [detalle, setDetalle] = useState<number | null>(null);
  const load = () => api.get("/ventas").then((r) => setItems(r.data));
  useEffect(() => { load(); }, []);
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Historial de ventas</h2>
        <p className="page-sub">Ventas de menudeo y de distribución de La Casa del Queso.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>ID</th><th>Tipo</th><th>Pedido</th><th>Fecha</th><th>Cliente</th><th>Total</th><th>Pago</th><th>Estado</th><th /></tr></thead>
        <tbody>{items.map((v: any) => <tr key={v.id}><td>#{v.id}</td><td>{tipoBadge(v.tipo ?? "MENUDEO")}</td><td>{v.pedido_id ? `#${v.pedido_id}` : "—"}</td><td className="text-xs text-stone-400">{v.fecha?.slice(0, 16).replace("T", " ")}</td><td>{v.cliente?.nombre ?? "Mostrador"}</td><td>{fmtMoney(v.total)}</td><td>{v.metodo_pago}</td><td>{estadoBadge(v.estado)}</td><td><button className="btn btn-ghost px-3 py-1" onClick={() => setDetalle(v.id)}>Ver</button></td></tr>)}</tbody></table>
      </div>
      {detalle !== null && <VentaDetail id={detalle} onClose={() => setDetalle(null)} onAnulada={() => { setDetalle(null); load(); }} />}
    </div>
  );
}
