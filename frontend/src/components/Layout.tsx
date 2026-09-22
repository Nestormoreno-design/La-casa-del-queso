import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { displayRole } from "../utils/user";
import BottomBar from "./BottomBar";

type Child = { to: string; label: string };
type Group = { kind: "group"; id: string; label: string; icon: string; children: Child[] };
type Link = { kind: "link"; to: string; label: string; icon: string };
type Item = Group | Link;

const MENU: Item[] = [
  { kind: "link", to: "/dashboard", label: "Inicio", icon: "🏠" },
  {
    kind: "group", id: "ventas", label: "Ventas", icon: "💰",
    children: [
      { to: "/pos", label: "Nueva venta" },
      { to: "/ventas", label: "Historial" },
      { to: "/informes/ventas", label: "Informe de ventas" },
    ],
  },
  {
    kind: "group", id: "distribucion", label: "Distribución", icon: "🚚",
    children: [
      { to: "/distribucion", label: "Panel" },
      { to: "/pedidos", label: "Pedidos" },
      { to: "/entregas", label: "Entregas" },
    ],
  },
  { kind: "link", to: "/inventario", label: "Inventario", icon: "📦" },
  { kind: "link", to: "/clientes", label: "Clientes", icon: "👥" },
  { kind: "link", to: "/proveedores", label: "Proveedores", icon: "🏢" },
  {
    kind: "group", id: "caja", label: "Caja", icon: "💵",
    children: [
      { to: "/caja", label: "Caja actual" },
      { to: "/caja/historial", label: "Historial de cajas" },
    ],
  },
];

const GROUPS: Group[] = MENU.filter((i): i is Group => i.kind === "group");

function groupOf(path: string): string | null {
  for (const g of GROUPS) {
    if (g.children.some((c) => c.to === path)) return g.id;
  }
  return null;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="chev"
      style={{ transform: open ? "rotate(90deg)" : "none" }}
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

function PanelLeftIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  );
}

export default function Layout() {
  const { user } = useAuth();
  const loc = useLocation();

  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("sidebar-collapsed") === "1");
  const [mobileOpen, setMobileOpen] = useState(false);
  // Acordeón: solo un grupo abierto a la vez (o ninguno)
  const [openId, setOpenId] = useState<string | null>(() => groupOf(loc.pathname));

  // Al navegar, abrir automáticamente el grupo padre de la ruta activa
  useEffect(() => {
    setOpenId(groupOf(loc.pathname));
    setMobileOpen(false);
  }, [loc.pathname]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      localStorage.setItem("sidebar-collapsed", c ? "0" : "1");
      return !c;
    });
  };

  const toggleGroup = (id: string) => {
    if (collapsed) {
      // Contraído: expandir y abrir ese grupo (sin flechas en este estado)
      setCollapsed(false);
      localStorage.setItem("sidebar-collapsed", "0");
      setOpenId(id);
    } else {
      setOpenId((cur) => (cur === id ? null : id));
    }
  };

  const renderLink = (to: string, label: string, icon: string) => (
    <NavLink
      key={to}
      to={to}
      title={label}
      className={({ isActive }) => `side-link${isActive ? " side-link-active" : ""}${collapsed ? " justify-center px-0" : ""}`}
    >
      <span className="side-icon shrink-0 text-xl leading-none">{icon}</span>
      {!collapsed && <span className="flex-1 whitespace-nowrap overflow-hidden">{label}</span>}
    </NavLink>
  );

  const renderGroup = (g: Group) => {
    const isOpen = openId === g.id;
    const hasActive = g.children.some((c) => loc.pathname === c.to);
    return (
      <div key={g.id}>
        <button
          onClick={() => toggleGroup(g.id)}
          title={g.label}
          className={`side-link${hasActive ? " side-link-active" : ""}${collapsed ? " justify-center px-0" : ""}`}
        >
          <span className="side-icon shrink-0 text-xl leading-none">{g.icon}</span>
          {!collapsed && <span className="flex-1 whitespace-nowrap overflow-hidden">{g.label}</span>}
          {!collapsed && <Chevron open={isOpen} />}
        </button>
        {!collapsed && (
          <div className={`submenu${isOpen ? " open" : ""}`}>
            <div>
              <div className="ml-4 mt-1 flex flex-col gap-0.5 border-l border-[#31373e] pl-2">
                {g.children.map((c) => (
                  <NavLink
                    key={c.to}
                    to={c.to}
                    className={({ isActive }) => `side-sub${isActive ? " side-sub-active" : ""}`}
                  >
                    {c.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex min-h-screen">
      {/* Fondo oscuro solo en móvil cuando el menú está abierto */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col overflow-x-hidden bg-[#101214] text-stone-200 md:sticky md:top-0 md:h-screen md:shrink-0 ${
          collapsed ? "w-[68px]" : "w-60"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0`}
      >
        {/* Logo + botón colapsar: siempre en la misma fila superior */}
        <div className={`flex items-center gap-2 pb-2 ${collapsed ? "justify-center p-2" : "p-4"}`}>
          <span className="shrink-0 text-2xl leading-none" title="La Casa del Queso">🧀</span>
          {!collapsed && <h1 className="flex-1 whitespace-nowrap text-base font-bold text-[#e8d5ae]">La Casa del Queso</h1>}
          <button
            onClick={toggleCollapsed}
            title={collapsed ? "Expandir menú" : "Contraer menú"}
            className="hidden shrink-0 rounded-lg p-1.5 text-stone-500 hover:bg-[#23282e] hover:text-white md:block"
          >
            <PanelLeftIcon />
          </button>
        </div>

        {!collapsed && (
          <p className="px-4 pb-3 text-xs text-stone-400">
            {displayRole(user?.rol)}
          </p>
        )}

        {/* Navegación */}
        <nav className={`flex flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden px-3 ${collapsed ? "items-center" : ""}`}>
          {MENU.map((item) =>
            item.kind === "link"
              ? renderLink(item.to, item.label, item.icon)
              : renderGroup(item)
          )}
        </nav>
      </aside>

      {/* Contenido + Bottom Bar */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo móvil */}
        <header className="sticky top-0 z-20 flex items-center gap-3 bg-[#1f2328]/95 p-3 shadow-sm md:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            title="Abrir menú"
            className="btn btn-ghost px-3 py-1.5 text-lg"
          >
            ☰
          </button>
          <span className="font-bold text-[#e8d5ae]">🧀 La Casa del Queso</span>
        </header>
        <main className="min-w-0 flex-1 p-4 pb-28 md:p-8 md:pb-32">
          <Outlet />
        </main>
        <div className={`fixed bottom-0 right-0 z-20 left-0 ${collapsed ? "md:left-[68px]" : "md:left-60"}`}>
          <BottomBar />
        </div>
      </div>
    </div>
  );
}
