import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const [u, setU] = useState("admin");
  const [p, setP] = useState("admin");
  const [err, setErr] = useState("");
  const { login } = useAuth();
  const nav = useNavigate();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    try { await login(u, p); nav("/dashboard"); }
    catch { setErr("Credenciales inválidas"); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center">
      <form onSubmit={submit} className="card w-96 flex flex-col gap-3">
        <h1 className="text-2xl font-bold text-[#e8d5ae]">🧀 La Casa del Queso</h1>
        <input className="input" value={u} onChange={(e) => setU(e.target.value)} placeholder="Usuario" />
        <input className="input" type="password" value={p} onChange={(e) => setP(e.target.value)} placeholder="Contraseña" />
        {err && <p className="text-red-300 text-sm">{err}</p>}
        <button className="btn btn-primary" type="submit">Ingresar</button>
        <p className="text-xs text-stone-400">Demo: admin / admin</p>
      </form>
    </div>
  );
}
