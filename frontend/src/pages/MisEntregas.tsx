import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { displayName } from "../utils/user";
import { fmtCantidad, fmtFecha, fmtMoney, isoToTimePart } from "../utils/format";

const METODOS = ["EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO"];

// Vista sencilla del conductor, pensada para celular:
// cliente, dirección, fecha/hora, productos, cantidades, total, estado.
export default function MisEntregas() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [err, setErr] = useState("");
  const [devObs, setDevObs] = useState("");
  const [modo, setModo] = useState<"entregar" | "devolver" | null>(null);

  const load = () => api.get("/pedidos/mis-entregas").then((r) => setItems(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const abrir = (p: any, m: "entregar" | "devolver") => {
    setSel(p); setModo(m); setErr(""); setDevObs(""); setMetodo("EFECTIVO");
  };

  const confirmar = async () => {
    setErr("");
    try {
      if (modo === "entregar") {
        // El conductor NO opera caja: solo marca ENTREGADO.
        // No consulta /caja/actual ni envía caja_sesion_id.
        // El mostrador (vendedor/admin) registra luego el dinero en Caja.
        await api.post(`/pedidos/${sel.id}/entregar`, { metodo_pago: metodo });
        setMsg(`Pedido #${sel.id} entregado ✔`);
      } else {
        await api.post(`/pedidos/${sel.id}/devolver`, { observaciones: devObs || null });
        setMsg(`Pedido #${sel.id} marcado como devuelto.`);
      }
      setSel(null); setModo(null); load();
    } catch (e: any) { setErr(e.response?.data?.detail ?? "Error"); }
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <div>
        <h2 className="page-title">Hola, {displayName(user?.username)} 🚚</h2>
        <p className="page-sub">Tus entregas asignadas. Toca una para ver el detalle.</p>
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}
      {items.length === 0 && (
        <div className="card text-center">
          <p className="text-3xl">🎉</p>
          <p className="mt-1 font-semibold text-stone-100">Sin entregas pendientes</p>
          <p className="text-sm text-stone-400">Cuando te asignen pedidos, aparecerán aquí.</p>
        </div>
      )}
      {items.map((p: any) => (
        <div key={p.id} className="card !p-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-lg font-bold text-stone-50">Pedido #{p.id}</p>
            <span className="badge badge-warn">{p.estado}</span>
          </div>
          <p className="mt-1 text-sm"><span className="text-stone-400">Cliente:</span> <strong className="text-stone-100">{p.cliente?.nombre ?? p.cliente ?? "Mostrador"}</strong></p>
          <p className="text-sm"><span className="text-stone-400">Dirección:</span> {p.direccion_entrega ?? "—"}</p>
          <p className="text-sm"><span className="text-stone-400">Fecha:</span> {fmtFecha(p.fecha_entrega)}</p>
          <p className="text-sm"><span className="text-stone-400">Hora:</span> {isoToTimePart(p.fecha_entrega) || p.hora_entrega || "—"}</p>
          <div className="mt-2 rounded-xl bg-[#16181b] p-2 text-sm">
            {(p.items ?? []).map((it: any) => (
              <p key={it.id} className="flex justify-between py-0.5">
                <span>{it.producto?.nombre} × <strong>{fmtCantidad(it.cantidad, it.producto?.unidad_medida)}</strong></span>
                <span className="text-stone-400">{fmtMoney(it.subtotal)}</span>
              </p>
            ))}
            <p className="mt-1 border-t border-[#31373e] pt-1 text-right font-bold text-stone-50">Total {fmtMoney(p.total)}</p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button className="btn btn-primary min-h-[56px] py-4 text-lg" onClick={() => abrir(p, "entregar")}>✔ ENTREGADO</button>
            <button className="btn min-h-[56px] border border-amber-900 py-4 text-lg text-amber-300" onClick={() => abrir(p, "devolver")}>↩ DEVUELTO</button>
          </div>
        </div>
      ))}

      {sel && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSel(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-stone-50">
              {modo === "entregar" ? `Confirmar entrega #${sel.id}` : `Marcar devuelto #${sel.id}`}
            </h3>
            <p className="mb-2 text-sm text-stone-300">{sel.cliente?.nombre ?? sel.cliente} · {fmtMoney(sel.total)}</p>
            {modo === "entregar" && (
              <>
                <label className="mb-1 block text-sm text-stone-300">¿Cómo pagó?</label>
                <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
              </>
            )}
            {modo === "devolver" && (
              <>
                <label className="mb-1 block text-sm text-stone-300">Motivo (opcional)</label>
                <input className="input" value={devObs} onChange={(e) => setDevObs(e.target.value)} placeholder="Ej: cliente ausente" />
              </>
            )}
            {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setSel(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={confirmar}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
