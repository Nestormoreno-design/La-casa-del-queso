import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { displayName, displayRole } from "../utils/user";

export default function TopBar({ onMenu }: { onMenu: () => void }) {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [proximas, setProximas] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const total = alerts.length + proximas.length;

  useEffect(() => {
    if (user?.rol === "conductor") return;
    api.get("/dashboard/stock-bajo").then((r) => setAlerts(r.data)).catch(() => {});
    api.get("/dashboard/distribucion").then((r) => setProximas(r.data.proximas ?? [])).catch(() => {});
  }, [user?.rol]);

  const doLogout = () => {
    logout();
    nav("/login");
  };

  return (
    <header className="topbar">
      <button onClick={onMenu} title="Abrir menú" className="btn btn-ghost px-3 py-1.5 text-lg md:hidden">
        ☰
      </button>
      <span className="flex items-center gap-2 font-bold text-[#e8d5ae]">
        <span className="text-xl leading-none">🧀</span>
        <span className="hidden sm:inline">La Casa del Queso</span>
      </span>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        {user?.rol !== "conductor" && (
          <div className="relative">
            {showAlerts && (
              <div className="absolute right-0 top-full z-30 mt-2 w-72 card !p-3">
                <p className="mb-1 text-sm font-semibold text-stone-100">🚚 Entregas próximas ({proximas.length})</p>
                {proximas.length === 0 && <p className="text-sm text-stone-400">Sin entregas programadas.</p>}
                <ul>
                  {proximas.slice(0, 4).map((p: any) => (
                    <li key={p.id} className="flex justify-between py-0.5 text-sm"><span>{p.cliente}</span><span className="text-stone-400">{p.fecha_entrega ?? ""}</span></li>
                  ))}
                </ul>
                <button className="btn btn-ghost mt-2 w-full py-1 text-sm" onClick={() => { setShowAlerts(false); nav("/entregas"); }}>Ver entregas</button>
                <p className="mb-1 mt-3 text-sm font-semibold text-stone-100">Stock bajo ({alerts.length})</p>
                {alerts.length === 0 && <p className="text-sm text-stone-400">Sin alertas. Todo en orden. 👍</p>}
                <ul>
                  {alerts.slice(0, 6).map((a: any) => (
                    <li key={a.id} className="flex justify-between py-0.5 text-sm"><span>{a.nombre}</span><span className="text-stone-400">{a.stock}</span></li>
                  ))}
                </ul>
                <button className="btn btn-ghost mt-2 w-full py-1 text-sm" onClick={() => { setShowAlerts(false); nav("/inventario"); }}>Ver inventario</button>
              </div>
            )}
            <button
              title="Alertas"
              onClick={() => { setShowAlerts((s) => !s); setShowUser(false); }}
              className="topbar-icon"
            >
              <span className="relative text-xl leading-none">
                🔔
                {total > 0 && <span className="bb-badge">{total}</span>}
              </span>
            </button>
          </div>
        )}

        <div className="relative">
          {showUser && (
            <div className="absolute right-0 top-full z-30 mt-2 w-56 card !p-3">
              <p className="font-semibold text-stone-50">{displayName(user?.username)}</p>
              <p className="mb-2 text-sm text-stone-400">{displayRole(user?.rol)}</p>
              <button className="btn btn-ghost w-full py-1.5 text-sm" onClick={doLogout}>Cerrar sesión</button>
            </div>
          )}
          <button
            title={`${displayName(user?.username)} — ${displayRole(user?.rol)}`}
            onClick={() => { setShowUser((s) => !s); setShowAlerts(false); }}
            className="topbar-user"
          >
            <span className="text-xl leading-none">👤</span>
            <span className="hidden text-left leading-tight md:block">
              <span className="block max-w-[140px] truncate text-sm font-semibold text-stone-100">{displayName(user?.username)}</span>
              <span className="block text-[11px] text-stone-400">{displayRole(user?.rol)}</span>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
