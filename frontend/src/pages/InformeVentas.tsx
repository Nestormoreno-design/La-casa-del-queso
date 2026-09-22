import { useEffect, useState } from "react";
import { api } from "../api/client";
import VentaDetail from "../components/VentaDetail";

const TR = ["NEQUI", "DAVIPLATA", "TRANSFERENCIA"];
const METODOS = ["", "EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO"];
const ESTADOS = ["", "PAGADA", "PENDIENTE", "FACTURADA", "ANULADA"];
const TIPOS = ["", "MENUDEO", "DISTRIBUCION"];

export default function InformeVentas() {
  const [items, setItems] = useState<any[]>([]);
  const [clis, setClis] = useState<any[]>([]);
  const [f, setF] = useState({ desde: "", hasta: "", cliente_id: "", metodo_pago: "", estado: "", tipo: "" });
  const [detalle, setDetalle] = useState<number | null>(null);

  useEffect(() => { api.get("/clientes").then((r) => setClis(r.data)).catch(() => {}); buscar(); }, []);

  const buscar = async () => {
    const p = new URLSearchParams();
    if (f.desde) p.set("desde", f.desde);
    if (f.hasta) p.set("hasta", f.hasta);
    if (f.cliente_id) p.set("cliente_id", f.cliente_id);
    if (f.metodo_pago) p.set("metodo_pago", f.metodo_pago);
    if (f.estado) p.set("estado", f.estado);
    if (f.tipo) p.set("tipo", f.tipo);
    const r = await api.get(`/ventas?${p.toString()}`);
    setItems(r.data);
  };

  // PAGADA + PENDIENTE (crédito) cuentan como venta; FACTURADA aún no descuenta.
  const validas = items.filter((v) => v.estado === "PAGADA" || v.estado === "PENDIENTE");
  const pagadas = validas;
  const menudeo = pagadas.filter((v) => (v.tipo ?? "MENUDEO") === "MENUDEO").reduce((a, v) => a + Number(v.total), 0);
  const distrib = pagadas.filter((v) => v.tipo === "DISTRIBUCION").reduce((a, v) => a + Number(v.total), 0);
  const total = pagadas.reduce((a, v) => a + Number(v.total), 0);
  const ef = pagadas.filter((v) => v.metodo_pago === "EFECTIVO").reduce((a, v) => a + Number(v.total), 0);
  const tr = pagadas.filter((v) => TR.includes(v.metodo_pago)).reduce((a, v) => a + Number(v.total), 0);
  const tj = pagadas.filter((v) => v.metodo_pago === "TARJETA").reduce((a, v) => a + Number(v.total), 0);
  const prodVend = pagadas.reduce((a, v) => a + (v.items ?? []).reduce((x: number, it: any) => x + Number(it.cantidad), 0), 0);
  const ticket = pagadas.length ? total / pagadas.length : 0;

  const card = (t: string, v: string) => (
    <div className="card"><p className="text-sm text-stone-400">{t}</p><p className="mt-1 text-xl font-bold text-stone-50">{v}</p></div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="page-title">Informe de ventas</h2><p className="page-sub">Filtra, resume e imprime las ventas del período.</p></div>
        <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir informe</button>
      </div>
      <div className="card">
        <div className="grid gap-2 md:grid-cols-6">
          <div><label className="text-xs text-stone-400">Fecha inicial</label><input type="date" className="input" value={f.desde} onChange={(e) => setF({ ...f, desde: e.target.value })} /></div>
          <div><label className="text-xs text-stone-400">Fecha final</label><input type="date" className="input" value={f.hasta} onChange={(e) => setF({ ...f, hasta: e.target.value })} /></div>
          <div><label className="text-xs text-stone-400">Cliente</label><select className="input" value={f.cliente_id} onChange={(e) => setF({ ...f, cliente_id: e.target.value })}><option value="">Todos</option>{clis.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}</select></div>
          <div><label className="text-xs text-stone-400">Método de pago</label><select className="input" value={f.metodo_pago} onChange={(e) => setF({ ...f, metodo_pago: e.target.value })}>{METODOS.map((m) => <option key={m} value={m}>{m || "Todos"}</option>)}</select></div>
          <div><label className="text-xs text-stone-400">Estado</label><select className="input" value={f.estado} onChange={(e) => setF({ ...f, estado: e.target.value })}>{ESTADOS.map((m) => <option key={m} value={m}>{m || "Todos"}</option>)}</select></div>
          <div><label className="text-xs text-stone-400">Tipo</label><select className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS.map((m) => <option key={m} value={m}>{m === "" ? "Todos" : m === "MENUDEO" ? "Menudeo" : "Distribución"}</option>)}</select></div>
          <div className="flex items-end"><button className="btn btn-primary w-full" onClick={buscar}>Filtrar</button></div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {card("Número de ventas", `${pagadas.length}`)}
        {card("Total vendido", `$${total.toLocaleString()}`)}
        {card("Ventas menudeo", `$${menudeo.toLocaleString()}`)}
        {card("Ventas distribución", `$${distrib.toLocaleString()}`)}
        {card("Total efectivo", `$${ef.toLocaleString()}`)}
        {card("Total transferencias", `$${tr.toLocaleString()}`)}
        {card("Total tarjetas", `$${tj.toLocaleString()}`)}
        {card("Productos vendidos", `${prodVend}`)}
        {card("Ticket promedio", `$${Math.round(ticket).toLocaleString()}`)}
      </div>
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Fecha</th><th>ID</th><th>Tipo</th><th>Cliente</th><th>Total</th><th>Método de pago</th><th>Estado</th><th /></tr></thead>
        <tbody>{items.map((v: any) => <tr key={v.id}><td className="text-xs text-stone-400">{v.fecha?.slice(0, 16).replace("T", " ")}</td><td>#{v.id}</td><td>{v.tipo === "DISTRIBUCION" ? <span className="badge badge-warn">Distribución</span> : <span className="badge badge-ok">Menudeo</span>}</td><td>{v.cliente?.nombre ?? "Mostrador"}</td><td>${Number(v.total).toLocaleString()}</td><td>{v.metodo_pago}</td><td>{v.estado}</td><td><button className="btn btn-ghost px-3 py-1" onClick={() => setDetalle(v.id)}>Abrir</button></td></tr>)}</tbody></table>
      </div>
      {detalle !== null && <VentaDetail id={detalle} onClose={() => setDetalle(null)} onAnulada={() => { setDetalle(null); buscar(); }} />}
    </div>
  );
}
