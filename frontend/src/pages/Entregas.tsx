import { useEffect, useState } from "react";
import { api } from "../api/client";
import FacturaDemo from "../components/FacturaDemo";
import { useAuth } from "../context/AuthContext";
import { fmtMoney, fmtFechaHoraCorta } from "../utils/format";

const METODOS = ["EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO"];

export default function Entregas() {
  const { user } = useAuth();
  const puedeOperar = user?.rol === "conductor" || user?.rol === "administrador";
  const [items, setItems] = useState<any[]>([]);
  const [entregar, setEntregar] = useState<any>(null);
  const [devolver, setDevolver] = useState<any>(null);
  const [devObs, setDevObs] = useState("");
  const [entregarErr, setEntregarErr] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [facturaId, setFacturaId] = useState<number | null>(null);

  const openEntregar = (p: any) => { setEntregarErr(""); setMetodo("EFECTIVO"); setEntregar(p); };

  const load = async () => {
    const r = await api.get("/pedidos");
    setItems(r.data
      .filter((p: any) => ["EN DISTRIBUCIÓN", "ENTREGADO", "DEVUELTO"].includes(p.estado))
      .sort((a: any, b: any) => b.id - a.id));
  };
  useEffect(() => { load(); }, []);

  const doEntregar = async () => {
    setEntregarErr("");
    try {
      const payload: any = { metodo_pago: metodo };
      if (metodo !== "CREDITO") {
        const caja = await api.get("/caja/actual").catch(() => ({ data: { abierta: false } }));
        if (!caja.data.abierta) { setEntregarErr("Debes abrir la caja antes de registrar ventas."); return; }
        payload.caja_sesion_id = caja.data.sesion_id;
      }
      const r = await api.post(`/pedidos/${entregar.id}/entregar`, payload);
      setFacturaId(r.data.venta_id);
      setEntregar(null); setEntregarErr(""); load();
    } catch (e: any) { setEntregarErr(e.response?.data?.detail ?? "Error al entregar"); }
  };

  const doDevolver = async () => {
    setEntregarErr("");
    try {
      await api.post(`/pedidos/${devolver.id}/devolver`, { observaciones: devObs || null });
      setDevolver(null); setDevObs(""); load();
    } catch (e: any) { setEntregarErr(e.response?.data?.detail ?? "Error al devolver"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Entregas</h2>
        <p className="page-sub">Pedidos en distribución. Al entregar se descuenta inventario y se registra la venta.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>ID</th><th>Cliente</th><th>Entrega</th><th>Dirección</th><th>Conductor</th><th>Total</th><th>Estado</th><th /></tr></thead>
        <tbody>
          {items.map((p: any) => (
            <tr key={p.id}>
              <td>#{p.id}</td>
              <td>{p.cliente?.nombre ?? "Mostrador"}</td>
              <td>{fmtFechaHoraCorta(p.fecha_entrega)}</td>
              <td className="text-xs">{p.direccion_entrega ?? "—"}</td>
              <td className="text-xs">{p.conductor ?? "—"}</td>
              <td>{fmtMoney(p.total)}</td>
              <td>{p.estado === "ENTREGADO" ? <span className="badge badge-ok">ENTREGADO</span> : p.estado === "DEVUELTO" ? <span className="badge badge-bad">DEVUELTO</span> : <span className="badge badge-warn">EN DISTRIBUCIÓN</span>}</td>
              <td>
                {p.estado === "EN DISTRIBUCIÓN" && puedeOperar
                  ? <div className="flex gap-1"><button className="btn btn-primary px-3 py-1" onClick={() => openEntregar(p)}>Entregar</button><button className="btn px-3 py-1 border border-amber-900 text-amber-300 hover:bg-amber-950" onClick={() => { setEntregarErr(""); setDevObs(""); setDevolver(p); }}>Devuelto</button></div>
                  : p.estado === "EN DISTRIBUCIÓN" ? <span className="text-xs text-stone-500">Solo el conductor</span> : null}
              </td>
            </tr>
          ))}
          {items.length === 0 && <tr><td colSpan={8} className="text-center text-stone-500">No hay entregas.</td></tr>}
        </tbody></table>
      </div>

      {entregar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEntregar(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-stone-50">Entregar pedido #{entregar.id}</h3>
            <div className="mb-2 text-sm">
              <p><span className="text-stone-400">Cliente:</span> {entregar.cliente?.nombre ?? "Mostrador"}</p>
              <p><span className="text-stone-400">Fecha:</span> {fmtFechaHoraCorta(entregar.fecha_entrega)}</p>
              <p><span className="text-stone-400">Total:</span> <strong>{fmtMoney(entregar.total)}</strong></p>
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

      {devolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDevolver(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-stone-50">Marcar devuelto #{devolver.id}</h3>
            <label className="mb-1 block text-sm text-stone-300">Motivo (opcional)</label>
            <input className="input" value={devObs} onChange={(e) => setDevObs(e.target.value)} placeholder="Ej: cliente ausente" />
            {entregarErr && <p className="mt-2 text-sm text-red-300">{entregarErr}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setDevolver(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doDevolver}>Marcar devuelto</button>
            </div>
          </div>
        </div>
      )}

      {facturaId !== null && <FacturaDemo ventaId={facturaId} onClose={() => setFacturaId(null)} />}
    </div>
  );
}
