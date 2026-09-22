import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("admin");
  const [showP, setShowP] = useState(false);
  const [err, setErr] = useState("");
  const { login } = useAuth();
  const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try {
      await login(u, p);
      const me = await api.get("/auth/me");
      nav(me.data?.rol === "conductor" ? "/mis-entregas" : "/dashboard");
    }
    catch { setErr("Credenciales inválidas"); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="card w-96 flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-[#e8d5ae]">🧀 La Casa del Queso</h1>
        <input className="input" value={u} onChange={(e) => setU(e.target.value)} placeholder="Usuario" />
        <div className="relative">
          <input
            className="input pr-11"
            type={showP ? "text" : "password"}
            value={p}
            onChange={(e) => setP(e.target.value)}
            placeholder="Contraseña"
          />
          <button
            type="button"
            onClick={() => setShowP((s) => !s)}
            title={showP ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-label={showP ? "Ocultar contraseña" : "Mostrar contraseña"}
            aria-pressed={showP}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-xl text-stone-400 hover:text-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#c9a86a]/50"
          >
            {showP ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                <line x1="2" y1="2" x2="22" y2="22" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M2 12s3.5-8 10-8 10 8 10 8-3.5 8-10 8-10-8-10-8Z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
        {err && <p className="text-red-300 text-sm">{err}</p>}
        <button className="btn btn-primary" type="submit">Ingresar</button>
        <p className="text-xs text-stone-400">Demo: admin / admin</p>
      </form>
    </div>
  );
}
