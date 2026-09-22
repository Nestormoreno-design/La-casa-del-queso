import { useState } from "react";
import { api } from "../api/client";

export default function ClienteModal({ onClose, onCreated }: { onClose: () => void; onCreated: (c: any) => void }) {
  const [f, setF] = useState({ nombre: "", documento: "", telefono: "", email: "", direccion: "", ciudad: "" });
  const [msg, setMsg] = useState("");

  const crear = async () => {
    try {
      const r = await api.post("/clientes", f);
      onCreated({ id: r.data.id, ...f });
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error al crear cliente"); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <h3 className="mb-2 text-lg font-bold text-stone-50">Nuevo cliente</h3>
        <div className="grid gap-2 md:grid-cols-2">
          <input className="input md:col-span-2" placeholder="Razón social / Nombre *" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
          <input className="input" placeholder="NIT / Documento" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} />
          <input className="input" placeholder="Teléfono" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
          <input className="input" placeholder="Correo electrónico" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <input className="input" placeholder="Dirección" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
          <input className="input" placeholder="Ciudad" value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} />
        </div>
        {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
        <div className="mt-3 flex justify-end gap-2">
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={crear}>Crear cliente</button>
        </div>
      </div>
    </div>
  );
}
