import { useEffect, useState } from "react";
import { api } from "../api/client";
import FacturaDemo from "../components/FacturaDemo";

const METODOS = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CREDITO"];

export default function Entregas() {
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [entregar, setEntregar] = useState<any>(null);
  const [entregarErr, setEntregarErr] = useState("");
  const openEntregar = (p: any) => { setEntregarErr(""); setMetodo("EFECTIVO"); setEntregar(p); };
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [facturaId, setFacturaId] = useState<number | null>(null);

  const load = async () => {
    const r = await api.get("/pedidos");
    const ab = ["PENDIENTE", "PREPARANDO", "LISTO"];
    setItems(r.data.filter((p: any) => ab.includes(p.estado)).sort((a: any, b: any) => String(a.fecha_entrega ?? "9").localeCompare(String(b.fecha_entrega ?? "9"))));
  };
  useEffect(() => { load(); }, []);

  const doEntregar = async () => {
    setEntregarErr("");
    try {
      const caja = await api.get("/caja/actual").catch(() => ({ data: { abierta: false } }));
      if (!caja.data.abierta) { setEntregarErr("Debes abrir la caja antes de registrar ventas."); return; }
      const r = await api.post(`/pedidos/${entregar.id}/entregar`, { metodo_pago: metodo, caja_sesion_id: caja.data.sesion_id });
      setFacturaId(r.data.venta_id);
      setEntregar(null); setEntregarErr(""); load();
    } catch (e: any) { setEntregarErr(e.response?.data?.detail ?? "Error al entregar"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Entregas</h2>
        <p className="page-sub">Pedidos programados listos para entregar. Al entregar se crea la venta automáticamente.</p>
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>ID</th><th>Cliente</th><th>Entrega</th><th>Hora</th><th>Dirección</th><th>Total</th><th>Estado</th><th /></tr></thead>
        <tbody>
          {items.map((p: any) => (
            <tr key={p.id}>
              <td>#{p.id}</td>
              <td>{p.cliente?.nombre ?? "Mostrador"}</td>
              <td>{p.fecha_entrega ? String(p.fecha_entrega).slice(0, 10) : "—"}</td>
              <td>{p.hora_entrega ?? "—"}</td>
              <td className="text-xs">{p.direccion_entrega ?? "—"}</td>
              <td>${Number(p.total).toLocaleString()}</td>
              <td>{p.estado === "LISTO" ? <span className="badge badge-ok">LISTO</span> : <span className="badge badge-warn">{p.estado}</span>}</td>
              <td>{p.estado === "LISTO" ? <button className="btn btn-primary px-3 py-1" onClick={() => openEntregar(p)}>Entregar</button> : <span className="text-xs text-stone-500">Genera la venta primero</span>}</td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={8} className="text-center text-stone-500">No hay entregas pendientes.</td></tr>}
        </tbody></table>
      </div>

      {entregar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEntregar(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-stone-50">Entregar pedido #{entregar.id}</h3>
            <div className="mb-2 text-sm">
              <p><span className="text-stone-400">Cliente:</span> {entregar.cliente?.nombre ?? "Mostrador"}</p>
              <p><span className="text-stone-400">Fecha:</span> {entregar.fecha_entrega ? String(entregar.fecha_entrega).slice(0, 10) : "—"}</p>
              <p><span className="text-stone-400">Total:</span> <strong>${Number(entregar.total).toLocaleString()}</strong></p>
            </div>
            <label className="mb-1 block text-sm text-stone-300">Método de pago</label>
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
            {entregarErr && <p className="mt-2 text-sm text-red-300">{entregarErr}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setEntregar(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doEntregar}>Entregar pedido</button>
            </div>
          </div>
        </div>
      )}

      {facturaId !== null && <FacturaDemo ventaId={facturaId} onClose={() => setFacturaId(null)} />}
    </div>
  );
}
