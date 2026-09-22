import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

const fmtDT = (iso: string | null) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleDateString("es-CO")} ${d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}`;
};

export function Caja() {
  const [actual, setActual] = useState<any>(null);
  const [real, setReal] = useState("");
  const [msg, setMsg] = useState("");
  const [saldoIni, setSaldoIni] = useState("100000");
  const load = async () => {
    const a = await api.get("/caja/actual").catch(() => ({ data: { abierta: false } }));
    setActual(a.data);
    if (a.data.abierta && !real) setReal(a.data.teorico ?? "");
  };
  useEffect(() => { load(); }, []);

  const abrir = async () => {
    try { await api.post("/caja/abrir", { saldo_inicial: saldoIni }); setMsg("Caja abierta"); load(); }
    catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };
  const cerrar = async () => {
    try { await api.post(`/caja/${actual.sesion_id}/cerrar`, { saldo_final_real: real }); setMsg("Caja cerrada. Quedó como historial inmutable."); setReal(""); load(); }
    catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };

  if (!actual) return <div className="card"><p className="text-stone-300">Cargando...</p></div>;

  if (!actual.abierta) {
    return (
      <div className="flex flex-col gap-4">
        <div><h2 className="page-title">Apertura de caja</h2><p className="page-sub">Abre la caja para iniciar la operación del día. Sin caja abierta no se pueden registrar ventas.</p></div>
        <div className="card max-w-md">
          <p className="text-sm text-stone-300">Fecha/hora de apertura: <strong className="text-stone-100">ahora ({new Date().toLocaleString("es-CO")})</strong></p>
          <p className="mt-1 text-sm text-stone-300">Responsable: <strong className="text-stone-100">{actual.responsable ?? "usuario actual"}</strong></p>
          <label className="mb-1 mt-3 block text-sm text-stone-300">Saldo inicial</label>
          <input className="input" value={saldoIni} onChange={(e) => setSaldoIni(e.target.value)} placeholder="100000" />
          <button className="btn btn-primary mt-3 w-full" onClick={abrir}>Abrir caja</button>
          {msg && <p className="mt-2 text-sm text-stone-300">{msg}</p>}
        </div>
      </div>
    );
  }

  const dif = (parseFloat(real) || 0) - (parseFloat(actual.teorico) || 0);
  return (
    <div className="flex flex-col gap-4">
      <div><h2 className="page-title">Caja abierta</h2><p className="page-sub">Operación del día en curso. <Link to="/caja/historial" className="underline">Ver historial →</Link></p></div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card">
          <p className="badge badge-ok mb-2">CAJA ABIERTA</p>
          <div className="text-sm">
            <p><span className="text-stone-400">Fecha de apertura:</span> {fmtDT(actual.fecha_apertura)}</p>
            <p><span className="text-stone-400">Responsable:</span> {actual.responsable}</p>
            <p><span className="text-stone-400">Saldo inicial:</span> ${Number(actual.saldo_inicial).toLocaleString()}</p>
          </div>
        </div>
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">Ventas de esta caja</h3>
          <div className="text-sm">
            <p>Ventas en efectivo: <strong>${Number(actual.ventas_efectivo ?? 0).toLocaleString()}</strong></p>
            <p>Transferencias: <strong>${Number(actual.ventas_transferencias ?? 0).toLocaleString()}</strong></p>
            <p>Tarjetas: <strong>${Number(actual.ventas_tarjetas ?? 0).toLocaleString()}</strong></p>
            <p className="mt-1 text-base">Total ventas: <strong>${Number(actual.total_ventas ?? 0).toLocaleString()}</strong></p>
            <p>Saldo esperado en efectivo: <strong className="text-[#e3c98a]">${Number(actual.saldo_esperado_efectivo ?? 0).toLocaleString()}</strong></p>
          </div>
        </div>
      </div>
      <div className="card">
        <h3 className="mb-2 font-semibold text-stone-100">Cierre de caja</h3>
        <div className="flex flex-wrap items-end gap-2">
          <div><label className="mb-1 block text-sm text-stone-300">Saldo contado (real)</label><input className="input" style={{ maxWidth: 200 }} value={real} onChange={(e) => setReal(e.target.value)} /></div>
          <p className="text-sm text-stone-300">Diferencia: <strong className={dif === 0 ? "text-emerald-300" : "text-red-300"}>${dif.toLocaleString()}</strong></p>
          <button className="btn btn-primary" onClick={cerrar}>Cerrar caja</button>
        </div>
        {msg && <p className="mt-2 text-sm text-stone-300">{msg}</p>}
      </div>
      <div className="card">
        <h3 className="mb-2 font-semibold text-stone-100">Ingresos / egresos manuales</h3>
        <MovRapido sid={actual.sesion_id} onDone={load} />
      </div>
    </div>
  );
}

function MovRapido({ sid, onDone }: { sid: number; onDone: () => void }) {
  const [tipo, setTipo] = useState("INGRESO");
  const [monto, setMonto] = useState("");
  const [desc, setDesc] = useState("");
  const save = async () => {
    await api.post(`/caja/${sid}/movimiento`, { tipo, monto, metodo_pago: "EFECTIVO", descripcion: desc });
    setMonto(""); setDesc(""); onDone();
  };
  return (
    <div className="flex flex-wrap gap-2">
      <select className="input" style={{ maxWidth: 150 }} value={tipo} onChange={(e) => setTipo(e.target.value)}><option>INGRESO</option><option>EGRESO</option></select>
      <input className="input" style={{ maxWidth: 160 }} placeholder="Monto" value={monto} onChange={(e) => setMonto(e.target.value)} />
      <input className="input" style={{ maxWidth: 260 }} placeholder="Descripción" value={desc} onChange={(e) => setDesc(e.target.value)} />
      <button className="btn btn-ghost" onClick={save}>Registrar</button>
    </div>
  );
}

export function HistorialCajas() {
  const [items, setItems] = useState<any[]>([]);
  const [detalle, setDetalle] = useState<any>(null);
  useEffect(() => { api.get("/caja/historial").then((r) => setItems(r.data)); }, []);
  const ver = async (id: number) => { const r = await api.get(`/caja/${id}/detalle`); setDetalle(r.data); };
  return (
    <div className="flex flex-col gap-4">
      <div><h2 className="page-title">Historial de cajas</h2><p className="page-sub">Las cajas cerradas son inmutables y solo pueden consultarse.</p></div>
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>ID</th><th>Apertura</th><th>Cierre</th><th>Responsable</th><th>Inicial</th><th>Ventas</th><th>Final</th><th>Diferencia</th><th>Estado</th><th /></tr></thead>
        <tbody>{items.map((c: any) => <tr key={c.id}><td>#{c.id}</td><td className="text-xs">{fmtDT(c.fecha_apertura)}</td><td className="text-xs">{fmtDT(c.fecha_cierre)}</td><td>{c.responsable}</td><td>${Number(c.saldo_inicial).toLocaleString()}</td><td>${Number(c.total_ventas).toLocaleString()}</td><td>{c.saldo_final_real ? `$${Number(c.saldo_final_real).toLocaleString()}` : "—"}</td><td className={Number(c.diferencia) === 0 ? "" : "font-bold text-red-300"}>${Number(c.diferencia).toLocaleString()}</td><td>{c.estado === "ABIERTA" ? <span className="badge badge-ok">ABIERTA</span> : <span className="badge badge-idle">CERRADA</span>}</td><td><button className="btn btn-ghost px-3 py-1" onClick={() => ver(c.id)}>Ver</button></td></tr>)}</tbody></table>
      </div>
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDetalle(null)}>
          <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-50">Caja #{detalle.id} — {detalle.estado}</h3>
              <button className="text-stone-400 hover:text-white" onClick={() => setDetalle(null)}>✕</button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <p><span className="text-stone-400">Apertura:</span> {fmtDT(detalle.fecha_apertura)}</p>
              <p><span className="text-stone-400">Cierre:</span> {fmtDT(detalle.fecha_cierre)}</p>
              <p><span className="text-stone-400">Responsable:</span> {detalle.responsable}</p>
              <p><span className="text-stone-400">Saldo inicial:</span> ${Number(detalle.saldo_inicial).toLocaleString()}</p>
              <p><span className="text-stone-400">Ventas:</span> ${Number(detalle.total_ventas).toLocaleString()} ({detalle.num_ventas})</p>
              <p><span className="text-stone-400">Efectivo / Transf. / Tarjeta:</span> ${Number(detalle.ventas_efectivo).toLocaleString()} / ${Number(detalle.ventas_transferencias).toLocaleString()} / ${Number(detalle.ventas_tarjetas).toLocaleString()}</p>
              <p><span className="text-stone-400">Ingresos / Egresos:</span> ${Number(detalle.ingresos).toLocaleString()} / ${Number(detalle.egresos).toLocaleString()}</p>
              <p><span className="text-stone-400">Saldo esperado:</span> ${Number(detalle.saldo_esperado_efectivo).toLocaleString()}</p>
              <p><span className="text-stone-400">Saldo contado:</span> {detalle.saldo_final_real ? `$${Number(detalle.saldo_final_real).toLocaleString()}` : "—"}</p>
              <p><span className="text-stone-400">Diferencia:</span> ${Number(detalle.diferencia).toLocaleString()}</p>
            </div>
            <h4 className="mb-1 mt-3 font-semibold text-stone-100">Movimientos</h4>
            <table className="table"><thead><tr><th>Tipo</th><th>Monto</th><th>Método</th><th>Descripción</th></tr></thead>
            <tbody>{detalle.movimientos?.map((m: any) => <tr key={m.id}><td>{m.tipo}</td><td>${Number(m.monto).toLocaleString()}</td><td>{m.metodo_pago}</td><td className="text-xs">{m.descripcion}</td></tr>)}</tbody></table>
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir</button>
              <button className="btn btn-ghost" onClick={() => setDetalle(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
