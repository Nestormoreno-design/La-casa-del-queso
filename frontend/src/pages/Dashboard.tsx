import { useEffect, useState } from "react";
import {
  Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { displayName } from "../utils/user";
import { fmtCantidad, fmtMoney } from "../utils/format";

const PERIODOS = [7, 14, 30] as const;

export default function Dashboard() {
  const { user } = useAuth();
  const [res, setRes] = useState<any>(null);
  const [serie, setSerie] = useState<any[]>([]);
  const [dias, setDias] = useState<number>(14);
  const [bajo, setBajo] = useState<any[]>([]);
  const [dist, setDist] = useState<any>(null);
  const [cred, setCred] = useState<any>(null);
  const [topP, setTopP] = useState<any[]>([]);

  useEffect(() => {
    api.get("/dashboard/resumen").then((r) => setRes(r.data)).catch(() => {});
    api.get("/dashboard/stock-bajo").then((r) => setBajo(r.data)).catch(() => {});
    api.get("/dashboard/distribucion").then((r) => setDist(r.data)).catch(() => {});
    api.get("/creditos/resumen").then((r) => setCred(r.data)).catch(() => {});
    api.get("/dashboard/top-productos?limite=4").then((r) => setTopP(r.data.top ?? [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.get(`/dashboard/ventas-diarias?dias=${dias}`).then((r) => {
      setSerie((r.data.serie ?? []).map((p: any) => ({
        ...p,
        total: Number(p.total),
        dia: String(p.fecha).slice(5),
      })));
    }).catch(() => {});
  }, [dias]);

  const kpi = (t: string, v: string) => (
    <div className="card-sm"><p className="text-xs text-stone-400">{t}</p><p className="mt-0.5 truncate text-lg font-bold text-stone-50" title={v}>{v}</p></div>
  );

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="page-title !mb-0">¡Hola, {displayName(user?.username)}! 👋</h2>
          <p className="page-sub !mb-0">Qué se vendió, qué hay y qué está por entregar.</p>
        </div>
        <div className="flex gap-1">
          {PERIODOS.map((d) => (
            <button key={d} onClick={() => setDias(d)} className={`btn px-3 py-1 text-sm ${dias === d ? "btn-primary" : "btn-ghost"}`}>
              {d} días
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpi("Ventas de hoy", fmtMoney(res?.ventas_dia ?? 0))}
        {kpi(`Ventas últimos ${dias} días`, fmtMoney(serie.reduce((a, p) => a + (p.total || 0), 0)))}
        {kpi("Pedidos por entregar", `${(dist?.pedidos_pendientes ?? 0) + (dist?.pedidos_preparacion ?? 0)}`)}
        {kpi("Crédito pendiente", cred && Number(cred.saldo_pendiente) > 0 ? fmtMoney(cred.saldo_pendiente) : "Sin crédito")}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <div className="card-sm lg:col-span-2">
          <h3 className="mb-1 text-sm font-semibold text-stone-100">📈 Ventas por día</h3>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serie} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#2a2f35" strokeDasharray="3 3" />
                <XAxis dataKey="dia" tick={{ fill: "#a8a29e", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#3a4148" }} />
                <YAxis tick={{ fill: "#a8a29e", fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={(v: number) => v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`} />
                <Tooltip
                  contentStyle={{ background: "#2a2f35", border: "1px solid #3a4148", borderRadius: 12 }}
                  labelStyle={{ color: "#e7e5e4" }}
                  formatter={(v: any) => [fmtMoney(v), "Ventas"]}
                />
                <Area type="monotone" dataKey="total" stroke="#c9a86a" fill="#c9a86a33" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="card-sm">
          <h3 className="mb-1 text-sm font-semibold text-stone-100">🏆 Más vendidos</h3>
          {topP.length === 0 && <p className="text-sm text-stone-500">No hay ventas registradas todavía.</p>}
          <ul>{topP.map((t: any) => <li key={t.producto} className="flex justify-between border-b border-[#262b31] py-1.5 text-sm"><span className="truncate">{t.producto}</span><span className="ml-2 shrink-0">{fmtMoney(t.ingresos)}</span></li>)}</ul>
          <h3 className="mb-1 mt-3 text-sm font-semibold text-stone-100">⚠️ Stock bajo ({bajo.length})</h3>
          {bajo.length === 0 && <p className="text-sm text-stone-500">Todo en orden. 👍</p>}
          <ul>{bajo.slice(0, 4).map((a: any) => <li key={a.id} className="flex justify-between py-0.5 text-sm"><span className="truncate">{a.nombre}</span><span className="ml-2 shrink-0 text-stone-400">{fmtCantidad(a.stock, a.unidad)}</span></li>)}</ul>
        </div>
      </div>
    </div>
  );
}
