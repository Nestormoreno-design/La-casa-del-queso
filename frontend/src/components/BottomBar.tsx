import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { displayName, displayRole } from "../utils/user";

function BarLink({ to, icon, label }: { to: string; icon: string; label: string }) {
  return (
    <NavLink
      to={to}
      title={label}
      className={({ isActive }) => `bb-item${isActive ? " bb-item-active" : ""}`}
    >
      <span className="text-xl leading-none">{icon}</span>
      <span className="bb-label">{label}</span>
    </NavLink>
  );
}

export default function BottomBar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const loc = useLocation();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [proximas, setProximas] = useState<any[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const name = displayName(user?.username);

  useEffect(() => {
    api.get("/dashboard/stock-bajo").then((r) => setAlerts(r.data)).catch(() => {});
    api.get("/dashboard/distribucion").then((r) => setProximas(r.data.proximas ?? [])).catch(() => {});
    setShowAlerts(false);
    setShowUser(false);
  }, [loc.pathname]);

  const doLogout = () => {
    logout();
    nav("/login");
  };

  return (
    <div className="bottombar">
      <BarLink to="/dashboard" icon="🏠" label="Inicio" />
      <BarLink to="/pos" icon="➕" label="Nueva venta" />
      <BarLink to="/distribucion" icon="🚚" label="Distribución" />
      <BarLink to="/inventario" icon="📦" label="Inventario" />

      <div className="relative">
        {showAlerts && (
          <div className="absolute bottom-full right-0 z-30 mb-2 w-72 card !p-3">
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
          className={`bb-item${showAlerts ? " bb-item-active" : ""}`}
        >
          <span className="relative text-xl leading-none">
            🔔
            {(alerts.length + proximas.length) > 0 && <span className="bb-badge">{alerts.length + proximas.length}</span>}
          </span>
          <span className="bb-label">Alertas</span>
        </button>
      </div>

      <div className="relative">
        {showUser && (
          <div className="absolute bottom-full right-0 z-30 mb-2 w-56 card !p-3">
            <p className="font-semibold text-stone-50">{name}</p>
            <p className="mb-2 text-sm text-stone-400">{displayRole(user?.rol)}</p>
            <button className="btn btn-ghost w-full py-1.5 text-sm" onClick={doLogout}>Cerrar sesión</button>
          </div>
        )}
        <button
          title={name}
          onClick={() => { setShowUser((s) => !s); setShowAlerts(false); }}
          className={`bb-item${showUser ? " bb-item-active" : ""}`}
        >
          <span className="text-xl leading-none">👤</span>
          <span className="bb-label">{name}</span>
        </button>
      </div>
    </div>
  );
}
