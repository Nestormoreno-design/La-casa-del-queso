import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { displayName } from "../utils/user";

export default function Dashboard() {
  const { user } = useAuth();
  const [res, setRes] = useState<any>(null);
  const [topP, setTopP] = useState<any>(null);
  const [topC, setTopC] = useState<any>(null);
  const [bajo, setBajo] = useState<any[]>([]);
  const [val, setVal] = useState<any>(null);
  const [dist, setDist] = useState<any>(null);

  useEffect(() => {
    api.get("/dashboard/resumen").then((r) => setRes(r.data));
    api.get("/dashboard/top-productos?limite=5").then((r) => setTopP(r.data));
    api.get("/dashboard/top-clientes?limite=5").then((r) => setTopC(r.data));
    api.get("/dashboard/stock-bajo").then((r) => setBajo(r.data));
    api.get("/dashboard/valorizacion").then((r) => setVal(r.data));
    api.get("/dashboard/distribucion").then((r) => setDist(r.data)).catch(() => {});
  }, []);

  const kpi = (t: string, v: string) => (
    <div className="card-sm"><p className="text-xs text-stone-400">{t}</p><p className="mt-0.5 truncate text-lg font-bold text-stone-50" title={v}>{v}</p></div>
  );

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="page-title">¡Hola, {displayName(user?.username)}! 👋</h2>
        <p className="page-sub">Este es el resumen de operaciones de La Casa del Queso.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpi("Ventas de hoy", `$${Number(res?.ventas_dia ?? 0).toLocaleString()}`)}
        {kpi("Ventas del mes", `$${Number(res?.ventas_mes ?? 0).toLocaleString()}`)}
        {kpi("Número de ventas", `${res?.num_ventas_dia ?? 0}`)}
        {kpi("Valor del inventario", `$${Number(val?.valor_inventario ?? 0).toLocaleString()}`)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpi("Producto más vendido", topP?.mas_vendido?.producto ?? "—")}
        {kpi("Cliente que más compra", topC?.top_cliente?.cliente ?? "—")}
        {kpi("Productos con stock bajo", `${bajo.length}`)}
        {kpi("Ventas de menudeo (mes)", `$${Number(dist?.ventas_menudeo_mes ?? 0).toLocaleString()}`)}
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {kpi("Ventas de distribución (mes)", `$${Number(dist?.ventas_distribucion_mes ?? 0).toLocaleString()}`)}
        {kpi("Pedidos pendientes", `${dist?.pedidos_pendientes ?? 0}`)}
        {kpi("Entregas próximas", `${dist?.proximas?.length ?? 0}`)}
      </div>
      <div className="card-sm overflow-x-auto">
        <h3 className="mb-1 text-sm font-semibold text-stone-100">🚚 Próximas entregas</h3>
        <table className="table"><thead><tr><th>Cliente</th><th>Fecha</th><th>Hora</th><th>Total</th><th>Estado</th></tr></thead>
        <tbody>
          {(dist?.proximas ?? []).slice(0, 5).map((p: any) => (
            <tr key={p.id}><td>{p.cliente}</td><td>{p.fecha_entrega ?? "—"}</td><td>{p.hora_entrega ?? "—"}</td><td>${Number(p.total).toLocaleString()}</td><td>{p.estado}</td></tr>
          ))}
          {(dist?.proximas ?? []).length === 0 && <tr><td colSpan={5} className="text-center text-sm text-stone-500">No hay ventas registradas todavía.</td></tr>}
        </tbody></table>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card-sm">
          <h3 className="mb-1 text-sm font-semibold text-stone-100">Top productos</h3>
          {(topP?.top ?? []).length === 0 && <p className="text-sm text-stone-500">No hay ventas registradas todavía.</p>}
          <ul>{topP?.top?.map((t: any) => <li key={t.producto} className="flex justify-between border-b border-[#262b31] py-1 text-sm"><span className="truncate">{t.producto}</span><span className="ml-2 shrink-0">${Number(t.ingresos).toLocaleString()}</span></li>)}</ul>
        </div>
        <div className="card-sm">
          <h3 className="mb-1 text-sm font-semibold text-stone-100">Top clientes</h3>
          {(topC?.top ?? []).length === 0 && <p className="text-sm text-stone-500">No hay ventas registradas todavía.</p>}
          <ul>{topC?.top?.map((t: any) => <li key={t.cliente} className="flex justify-between border-b border-[#262b31] py-1 text-sm"><span className="truncate">{t.cliente}</span><span className="ml-2 shrink-0">${Number(t.total).toLocaleString()}</span></li>)}</ul>
        </div>
      </div>
    </div>
  );
}
