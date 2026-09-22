import { useEffect, useState } from "react";
import { api } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";

function useCrud(path: string) {
  const [items, setItems] = useState<any[]>([]);
  const load = () => api.get(path).then((r) => setItems(r.data));
  useEffect(() => { load(); }, [path]);
  return { items, load };
}

export function SimpleAdmin({ title, path, fields }: { title: string; path: string; fields: string[] }) {
  const { items, load } = useCrud(path);
  const [form, setForm] = useState<any>({});
  const [msg, setMsg] = useState("");
  const save = async () => {
    try { await api.post(path, form); setForm({}); setMsg("Guardado"); load(); }
    catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };
  const del = async (id: number) => { await api.delete(`${path}/${id}`); load(); };
  return (
    <div className="card">
      <h2 className="page-title">{title}</h2>
      <div className="mb-2 flex flex-wrap gap-2">
        {fields.map((f) => <input key={f} className="input" style={{ maxWidth: 200 }} placeholder={f} value={form[f] ?? ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} />)}
        <button className="btn btn-primary" onClick={save}>Agregar</button>
      </div>
      {msg && <p className="mb-2 text-sm text-stone-300">{msg}</p>}
      <table className="table"><thead><tr><th>ID</th><th>Nombre</th><th>Detalle</th><th /></tr></thead>
      <tbody>{items.map((i: any) => <tr key={i.id}><td>{i.id}</td><td>{i.nombre}</td><td className="text-xs">{i.nit ?? i.documento ?? i.descripcion ?? i.telefono ?? ""}</td><td><button className="btn btn-ghost" onClick={() => del(i.id)}>X</button></td></tr>)}</tbody></table>
    </div>
  );
}

const CLI_EMPTY = { nombre: "", documento: "", telefono: "", email: "", direccion: "", ciudad: "" };
const PROV_EMPTY = { nombre: "", nit: "", telefono: "", email: "", direccion: "" };

export function Clientes() {
  const { items, load } = useCrud("/clientes");
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [f, setF] = useState(CLI_EMPTY);
  const [msg, setMsg] = useState("");
  const [desact, setDesact] = useState<any>(null);

  const nuevo = () => { setEditing(null); setF(CLI_EMPTY); setShow(true); };
  const editar = (c: any) => { setEditing(c); setF({ nombre: c.nombre ?? "", documento: c.documento ?? "", telefono: c.telefono ?? "", email: c.email ?? "", direccion: c.direccion ?? "", ciudad: c.ciudad ?? "" }); setShow(true); };
  const save = async () => {
    try {
      if (editing) await api.put(`/clientes/${editing.id}`, f);
      else await api.post("/clientes", f);
      setShow(false); setEditing(null); setF(CLI_EMPTY); setMsg("Guardado"); load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };
  const desactivar = async () => { await api.delete(`/clientes/${desact.id}`); setDesact(null); setMsg("Cliente desactivado"); load(); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="page-title">Clientes</h2><p className="page-sub">Gestiona los clientes de la distribuidora.</p></div>
        <button className="btn btn-primary" onClick={nuevo}>+ Nuevo cliente</button>
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}
      {show && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">{editing ? "Editar cliente" : "Nuevo cliente"}</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <input className="input" placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <input className="input" placeholder="Documento" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} />
            <input className="input" placeholder="Teléfono" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
            <input className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className="input" placeholder="Dirección" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
            <input className="input" placeholder="Ciudad" value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} />
            <div className="flex gap-2"><button className="btn btn-primary" onClick={save}>Guardar</button><button className="btn btn-ghost" onClick={() => setShow(false)}>Cancelar</button></div>
          </div>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Nombre</th><th>Documento</th><th>Teléfono</th><th>Dirección</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{items.map((c: any) => <tr key={c.id}><td className="font-medium text-stone-50">{c.nombre}</td><td>{c.documento ?? "—"}</td><td>{c.telefono ?? "—"}</td><td>{c.direccion ?? "—"}</td><td><span className="badge badge-ok">Activo</span></td>
        <td className="flex gap-1"><button className="btn btn-ghost px-3 py-1" onClick={() => editar(c)}>Editar</button><button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setDesact(c)}>Desactivar</button></td></tr>)}</tbody></table>
      </div>
      {desact && <ConfirmDialog title="Desactivar cliente" message={`¿Deseas desactivar a "${desact.nombre}"? Se conservará su historial de compras.`} confirmLabel="Desactivar" onCancel={() => setDesact(null)} onConfirm={desactivar} />}
    </div>
  );
}

export function Proveedores() {
  const { items, load } = useCrud("/proveedores");
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [f, setF] = useState(PROV_EMPTY);
  const [msg, setMsg] = useState("");
  const [desact, setDesact] = useState<any>(null);

  const nuevo = () => { setEditing(null); setF(PROV_EMPTY); setShow(true); };
  const editar = (p: any) => { setEditing(p); setF({ nombre: p.nombre ?? "", nit: p.nit ?? "", telefono: p.telefono ?? "", email: p.email ?? "", direccion: p.direccion ?? "" }); setShow(true); };
  const save = async () => {
    try {
      if (editing) await api.put(`/proveedores/${editing.id}`, f);
      else await api.post("/proveedores", f);
      setShow(false); setEditing(null); setF(PROV_EMPTY); setMsg("Guardado"); load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };
  const desactivar = async () => { await api.delete(`/proveedores/${desact.id}`); setDesact(null); setMsg("Proveedor desactivado"); load(); };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="page-title">Proveedores</h2><p className="page-sub">Gestiona los proveedores de quesos y lácteos.</p></div>
        <button className="btn btn-primary" onClick={nuevo}>+ Nuevo proveedor</button>
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}
      {show && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">{editing ? "Editar proveedor" : "Nuevo proveedor"}</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <input className="input" placeholder="Nombre" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <input className="input" placeholder="NIT" value={f.nit} onChange={(e) => setF({ ...f, nit: e.target.value })} />
            <input className="input" placeholder="Teléfono" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
            <input className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className="input" placeholder="Dirección" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
            <div className="flex gap-2"><button className="btn btn-primary" onClick={save}>Guardar</button><button className="btn btn-ghost" onClick={() => setShow(false)}>Cancelar</button></div>
          </div>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Nombre</th><th>NIT</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>{items.map((p: any) => <tr key={p.id}><td className="font-medium text-stone-50">{p.nombre}</td><td>{p.nit ?? "—"}</td><td>{p.telefono ?? "—"}</td><td>{p.email ?? "—"}</td><td>{p.direccion ?? "—"}</td><td><span className="badge badge-ok">Activo</span></td>
        <td className="flex gap-1"><button className="btn btn-ghost px-3 py-1" onClick={() => editar(p)}>Editar</button><button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setDesact(p)}>Desactivar</button></td></tr>)}</tbody></table>
      </div>
      {desact && <ConfirmDialog title="Desactivar proveedor" message={`¿Deseas desactivar a "${desact.nombre}"? Se conservará su historial de compras.`} confirmLabel="Desactivar" onCancel={() => setDesact(null)} onConfirm={desactivar} />}
    </div>
  );
}

export function Categorias() { return <SimpleAdmin title="Categorías" path="/categorias" fields={["nombre", "descripcion"]} />; }
