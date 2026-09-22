import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";

const estadoBadge = (e: string) =>
  e === "ENTREGADO" ? "badge badge-ok" : e === "CANCELADO" ? "badge badge-bad" : "badge badge-warn";

export default function Distribucion() {
  const [d, setD] = useState<any>(null);
  useEffect(() => { api.get("/dashboard/distribucion").then((r) => setD(r.data)).catch(() => {}); }, []);

  const card = (t: string, v: string, to: string) => (
    <Link to={to} className="card transition-colors hover:border-[#c9a86a]/50">
      <p className="text-sm text-stone-400">{t}</p>
      <p className="mt-1 text-2xl font-bold text-stone-50">{v}</p>
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="page-title">Distribución</h2>
        <p className="page-sub">Gestiona pedidos y entregas a clientes.</p>
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {card("Pedidos pendientes", `${d?.pedidos_pendientes ?? 0}`, "/pedidos")}
        {card("En preparación", `${d?.pedidos_preparacion ?? 0}`, "/pedidos")}
        {card("Entregas de hoy", `${d?.entregas_hoy ?? 0}`, "/entregas")}
        {card("Entregas próximas", `${d?.proximas?.length ?? 0}`, "/entregas")}
      </div>
      <div className="card overflow-x-auto">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="font-semibold text-stone-100">🚚 Próximos pedidos</h3>
          <Link to="/pedidos" className="btn btn-primary">+ Nuevo pedido</Link>
        </div>
        <table className="table"><thead><tr><th>ID</th><th>Cliente</th><th>Entrega</th><th>Hora</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>
          {(d?.proximas ?? []).map((p: any) => (
            <tr key={p.id}>
              <td>#{p.id}</td><td>{p.cliente}</td><td>{p.fecha_entrega ?? "—"}</td>
              <td>{p.hora_entrega ?? "—"}</td><td>${Number(p.total).toLocaleString()}</td>
              <td><span className={estadoBadge(p.estado)}>{p.estado}</span></td>
            </tr>
          ))}
          {(d?.proximas ?? []).length === 0 && <tr><td colSpan={6} className="text-center text-stone-500">No hay entregas programadas.</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}
