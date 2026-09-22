import { useEffect, useState } from "react";
import { api } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";

function stockEstado(p: any): { label: string; cls: string } {
  const stock = Number(p.stock_actual);
  const min = Number(p.stock_minimo);
  if (stock <= 0) return { label: "Sin stock", cls: "badge badge-bad" };
  if (stock <= min) return { label: "Stock bajo", cls: "badge badge-warn" };
  return { label: "Disponible", cls: "badge badge-ok" };
}

const EMPTY = { codigo: "", nombre: "", precio_venta: "", costo: "", tipo_venta: "PESO", unidad_medida: "KG", stock_minimo: "0", proveedor_id: "" };

export default function Productos() {
  const [items, setItems] = useState<any[]>([]);
  const [provs, setProvs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState("");
  const [desact, setDesact] = useState<any>(null);

  const load = () => api.get("/productos").then((r) => setItems(r.data));
  useEffect(() => { load(); api.get("/proveedores").then((r) => setProvs(r.data)).catch(() => {}); }, []);

  const provNombre = (id: number | null) => provs.find((p) => p.id === id)?.nombre ?? "—";

  const nuevo = () => { setEditing(null); setF(EMPTY); setShowForm(true); };
  const editar = (p: any) => {
    setEditing(p);
    setF({ codigo: p.codigo, nombre: p.nombre, precio_venta: String(p.precio_venta), costo: String(p.costo_promedio), tipo_venta: p.tipo_venta, unidad_medida: p.unidad_medida, stock_minimo: String(p.stock_minimo), proveedor_id: p.proveedor_id ? String(p.proveedor_id) : "" });
    setShowForm(true);
  };

  const save = async () => {
    try {
      const payload: any = {
        nombre: f.nombre, tipo_venta: f.tipo_venta, unidad_medida: f.unidad_medida,
        precio_venta: f.precio_venta, stock_minimo: f.stock_minimo,
        proveedor_id: f.proveedor_id ? Number(f.proveedor_id) : null,
      };
      if (editing) {
        if (f.costo !== "") payload.costo_promedio = f.costo;
        await api.put(`/productos/${editing.id}`, payload);
        setMsg("Producto actualizado");
      } else {
        await api.post("/productos", { ...payload, codigo: f.codigo, categoria_id: null });
        setMsg("Producto creado");
      }
      setShowForm(false); setEditing(null); setF(EMPTY); load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };

  const desactivar = async () => {
    await api.delete(`/productos/${desact.id}`);
    setDesact(null); setMsg("Producto desactivado"); load();
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="page-title">Productos</h2>
          <p className="page-sub">Gestiona los productos, precios y existencias de La Casa del Queso.</p>
        </div>
        <button className="btn btn-primary" onClick={nuevo}>+ Nuevo producto</button>
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}

      {showForm && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">{editing ? `Editar: ${editing.nombre}` : "Nuevo producto"}</h3>
          <div className="grid gap-2 md:grid-cols-4">
            {!editing && <input className="input" placeholder="Código (ej: QUES-001)" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} />}
            <input className="input" placeholder="Nombre (ej: Queso doble crema)" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} />
            <input className="input" placeholder="Precio de venta" value={f.precio_venta} onChange={(e) => setF({ ...f, precio_venta: e.target.value })} />
            <input className="input" placeholder="Costo" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} />
            <select className="input" value={f.tipo_venta} onChange={(e) => setF({ ...f, tipo_venta: e.target.value })}><option>PESO</option><option>UNIDAD</option></select>
            <select className="input" value={f.unidad_medida} onChange={(e) => setF({ ...f, unidad_medida: e.target.value })}><option>KG</option><option>G</option><option>UND</option><option>LB</option></select>
            <select className="input" value={f.proveedor_id} onChange={(e) => setF({ ...f, proveedor_id: e.target.value })}><option value="">Proveedor...</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
            <input className="input" placeholder="Stock mínimo" value={f.stock_minimo} onChange={(e) => setF({ ...f, stock_minimo: e.target.value })} />
            <div className="flex gap-2">
              <button className="btn btn-primary" onClick={save}>Guardar</button>
              <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Producto</th><th>Código</th><th>Unidad</th><th>Precio</th><th>Stock</th><th>Stock mínimo</th><th>Proveedor</th><th>Estado</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((p) => {
              const est = stockEstado(p);
              return (
                <tr key={p.id}>
                  <td className="font-medium text-stone-50">{p.nombre}</td>
                  <td className="text-stone-400">{p.codigo}</td>
                  <td>{p.tipo_venta === "PESO" ? `${p.unidad_medida} (peso)` : p.unidad_medida}</td>
                  <td>${Number(p.precio_venta).toLocaleString()}</td>
                  <td className="font-semibold">{p.stock_actual}</td>
                  <td className="text-stone-400">{p.stock_minimo}</td>
                  <td className="text-stone-300">{provNombre(p.proveedor_id)}</td>
                  <td><span className={est.cls}>{est.label}</span></td>
                  <td className="flex gap-1">
                    <button className="btn btn-ghost px-3 py-1" onClick={() => editar(p)}>Editar</button>
                    <button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setDesact(p)}>Desactivar</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {desact && (
        <ConfirmDialog title="Desactivar producto" message={`¿Deseas desactivar "${desact.nombre}"? No se eliminará el historial.`} confirmLabel="Desactivar" onCancel={() => setDesact(null)} onConfirm={desactivar} />
      )}
    </div>
  );
}
