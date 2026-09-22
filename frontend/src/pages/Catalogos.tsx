import { useEffect, useState } from "react";
import { api } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";
import { fmtMoney } from "../utils/format";

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

const CLI_EMPTY = { nombre: "", documento: "", telefono: "", email: "", direccion: "", ciudad: "", tipo_cliente: "MINORISTA" };
const PROV_EMPTY = { nombre: "", nit: "", telefono: "", email: "", direccion: "" };

const catBadge = (t?: string) =>
  t === "MAYORISTA" ? <span className="badge badge-warn">Mayorista</span> : <span className="badge badge-ok">Minorista</span>;

export function Clientes() {
  const { items, load } = useCrud("/clientes");
  const [saldos, setSaldos] = useState<Record<number, any>>({});
  const [show, setShow] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [f, setF] = useState(CLI_EMPTY);
  const [msg, setMsg] = useState("");
  const [desact, setDesact] = useState<any>(null);
  const [cuenta, setCuenta] = useState<any>(null);
  const [abonoMonto, setAbonoMonto] = useState("");
  const [abonoMetodo, setAbonoMetodo] = useState("EFECTIVO");
  const [credMonto, setCredMonto] = useState("");
  const [credObs, setCredObs] = useState("");
  const [showCred, setShowCred] = useState<any>(null);

  const loadSaldos = async (clis: any[]) => {
    const m: Record<number, any> = {};
    await Promise.all(clis.map(async (c) => {
      try {
        const r = await api.get(`/creditos/cliente/${c.id}`);
        m[c.id] = r.data;
      } catch { /* sin créditos */ }
    }));
    setSaldos(m);
  };

  useEffect(() => { if (items.length > 0) loadSaldos(items); }, [items]);

  const nuevo = () => { setEditing(null); setF(CLI_EMPTY); setShow(true); };
  const editar = (c: any) => {
    setEditing(c);
    setF({
      nombre: c.nombre ?? "", documento: c.documento ?? "", telefono: c.telefono ?? "",
      email: c.email ?? "", direccion: c.direccion ?? "", ciudad: c.ciudad ?? "",
      tipo_cliente: c.tipo_cliente ?? "MINORISTA",
    });
    setShow(true);
  };
  const save = async () => {
    try {
      if (!f.nombre.trim()) { setMsg("El nombre del cliente es obligatorio."); return; }
      if (editing) await api.put(`/clientes/${editing.id}`, f);
      else await api.post("/clientes", f);
      setShow(false); setEditing(null); setF(CLI_EMPTY); setMsg("Guardado"); load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };
  const desactivar = async () => { await api.delete(`/clientes/${desact.id}`); setDesact(null); setMsg("Cliente desactivado"); load(); };

  const verCuenta = async (c: any) => {
    const r = await api.get(`/creditos/cliente/${c.id}`);
    setCuenta({ cliente: c, ...r.data });
    setAbonoMonto("");
  };

  const abonar = async (creditoId: number) => {
    try {
      if (!abonoMonto || Number(abonoMonto) <= 0) { setMsg("Indica un monto válido para abonar."); return; }
      await api.post(`/creditos/${creditoId}/abonar`, { monto: abonoMonto, metodo_pago: abonoMetodo });
      setMsg("Abono registrado");
      setAbonoMonto("");
      if (cuenta) verCuenta(cuenta.cliente);
      load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error al abonar"); }
  };

  const crearCredito = async () => {
    try {
      if (!credMonto || Number(credMonto) <= 0) { setMsg("Indica el valor del crédito."); return; }
      await api.post("/creditos", { cliente_id: showCred.id, monto: credMonto, observaciones: credObs || null });
      setMsg(`Crédito registrado para ${showCred.nombre}`);
      setShowCred(null); setCredMonto(""); setCredObs("");
      load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error al registrar crédito"); }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="page-title">Clientes</h2><p className="page-sub">Minoristas y mayoristas, con su estado de crédito.</p></div>
        <button className="btn btn-primary" onClick={nuevo}>+ Nuevo cliente</button>
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}
      {show && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">{editing ? "Editar cliente" : "Nuevo cliente"}</h3>
          <div className="grid gap-2 md:grid-cols-3">
            <input className="input" placeholder="Nombre *" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <input className="input" placeholder="Documento" value={f.documento} onChange={(e) => setF({ ...f, documento: e.target.value })} />
            <input className="input" placeholder="Teléfono" value={f.telefono} onChange={(e) => setF({ ...f, telefono: e.target.value })} />
            <input className="input" placeholder="Email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
            <input className="input" placeholder="Dirección" value={f.direccion} onChange={(e) => setF({ ...f, direccion: e.target.value })} />
            <input className="input" placeholder="Ciudad" value={f.ciudad} onChange={(e) => setF({ ...f, ciudad: e.target.value })} />
            <div>
              <label className="mb-1 block text-xs text-stone-400">Categoría</label>
              <select className="input" value={f.tipo_cliente} onChange={(e) => setF({ ...f, tipo_cliente: e.target.value })}>
                <option value="MINORISTA">Minorista</option>
                <option value="MAYORISTA">Mayorista</option>
              </select>
            </div>
            <div className="flex items-end gap-2"><button className="btn btn-primary" onClick={save}>Guardar</button><button className="btn btn-ghost" onClick={() => setShow(false)}>Cancelar</button></div>
          </div>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>Nombre</th><th>Categoría</th><th>Teléfono</th><th>Crédito</th><th>Acciones</th></tr></thead>
        <tbody>{items.map((c: any) => {
          const s = saldos[c.id];
          const pendiente = s ? Number(s.saldo_pendiente) : 0;
          return (
            <tr key={c.id}>
              <td className="font-medium text-stone-50">{c.nombre}<div className="text-xs font-normal text-stone-500">{c.direccion ?? ""}</div></td>
              <td>{catBadge(c.tipo_cliente)}</td>
              <td>{c.telefono ?? "—"}</td>
              <td>
                {s ? (
                  pendiente > 0
                    ? <span className="badge badge-bad">Crédito {fmtMoney(s.saldo_pendiente)}</span>
                    : <span className="badge badge-idle">Sin crédito pendiente</span>
                ) : <span className="text-xs text-stone-500">—</span>}
              </td>
              <td className="flex flex-wrap gap-1">
                <button className="btn btn-ghost px-3 py-1" onClick={() => editar(c)}>Editar</button>
                <button className="btn btn-ghost px-3 py-1" onClick={() => verCuenta(c)}>Estado de cuenta</button>
                <button className="btn btn-ghost px-3 py-1" onClick={() => { setShowCred(c); setCredMonto(""); setCredObs(""); }}>Crear crédito</button>
                <button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setDesact(c)}>Desactivar</button>
              </td>
            </tr>
          );
        })}</tbody></table>
      </div>
      {desact && <ConfirmDialog title="Desactivar cliente" message={`¿Deseas desactivar a "${desact.nombre}"? Se conservará su historial de compras.`} confirmLabel="Desactivar" onCancel={() => setDesact(null)} onConfirm={desactivar} />}

      {cuenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setCuenta(null)}>
          <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-50">Estado de cuenta — {cuenta.cliente?.nombre}</h3>
              <button className="text-stone-400 hover:text-white" onClick={() => setCuenta(null)}>✕</button>
            </div>
            {cuenta.tiene_pendiente
              ? <p className="mb-2"><span className="badge badge-bad">Crédito pendiente {fmtMoney(cuenta.saldo_pendiente)}</span></p>
              : <p className="mb-2"><span className="badge badge-idle">Sin crédito pendiente</span></p>}
            {(cuenta.creditos ?? []).length === 0 && <p className="text-sm text-stone-500">Este cliente no tiene créditos registrados.</p>}
            {(cuenta.creditos ?? []).map((cr: any) => (
              <div key={cr.id} className="mb-2 rounded-xl border border-[#31373e] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm"><strong>Crédito #{cr.id}</strong> · Total {fmtMoney(cr.monto_total)} · Saldo {fmtMoney(cr.saldo_pendiente)} {cr.estado === "PAGADO" ? <span className="badge badge-ok">PAGADO</span> : <span className="badge badge-bad">PENDIENTE</span>}</p>
                  <span className="text-xs text-stone-500">{cr.venta_id ? `Venta #${cr.venta_id}` : ""}{cr.pedido_id ? ` · Pedido #${cr.pedido_id}` : ""}</span>
                </div>
                {(cr.abonos ?? []).length > 0 && (
                  <ul className="mt-1 text-xs text-stone-400">
                    {cr.abonos.map((a: any) => <li key={a.id}>Abono {fmtMoney(a.monto)} · {a.metodo_pago} · {String(a.fecha ?? "").slice(0, 10)}</li>)}
                  </ul>
                )}
                {cr.estado === "PENDIENTE" && (
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <div><label className="mb-1 block text-xs text-stone-400">Abonar</label><input className="input" style={{ maxWidth: 140 }} value={abonoMonto} onChange={(e) => setAbonoMonto(e.target.value)} placeholder="50000" /></div>
                    <select className="input" style={{ maxWidth: 160 }} value={abonoMetodo} onChange={(e) => setAbonoMetodo(e.target.value)}>
                      <option>EFECTIVO</option><option>TRANSFERENCIA</option><option>NEQUI</option><option>DAVIPLATA</option><option>TARJETA</option>
                    </select>
                    <button className="btn btn-primary px-3 py-2 text-sm" onClick={() => abonar(cr.id)}>Registrar abono</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showCred && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowCred(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-stone-50">Crear crédito — {showCred.nombre}</h3>
            <p className="mb-2 text-sm text-stone-400">Registra un valor pendiente de pago. No es obligatorio.</p>
            <label className="mb-1 block text-xs text-stone-400">Valor</label>
            <input className="input" value={credMonto} onChange={(e) => setCredMonto(e.target.value)} placeholder="150000" />
            <label className="mb-1 mt-2 block text-xs text-stone-400">Observaciones (opcional)</label>
            <input className="input" value={credObs} onChange={(e) => setCredObs(e.target.value)} placeholder="Ej: pedido #12" />
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setShowCred(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={crearCredito}>Registrar crédito</button>
            </div>
          </div>
        </div>
      )}
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
