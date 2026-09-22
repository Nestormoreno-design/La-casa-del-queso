import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import ConfirmDialog from "../components/ConfirmDialog";

const EMPTY = { codigo: "", nombre: "", precio_venta: "", costo: "", tipo_venta: "PESO", unidad_medida: "KG", stock_minimo: "0", proveedor_id: "", activo: true };

function estadoBadge(p: any) {
  const s = Number(p.stock_actual);
  if (s <= 0) return <span className="badge badge-bad">Sin stock</span>;
  if (s <= Number(p.stock_minimo)) return <span className="badge badge-warn">Stock bajo</span>;
  return <span className="badge badge-ok">Disponible</span>;
}

export default function Inventario() {
  const [items, setItems] = useState<any[]>([]);
  const [provs, setProvs] = useState<any[]>([]);
  const [movs, setMovs] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [f, setF] = useState(EMPTY);
  const [stock, setStock] = useState<any>(null);
  const [sCant, setSCant] = useState("");
  const [sCosto, setSCosto] = useState("");
  const [sProv, setSProv] = useState("");
  const [sObs, setSObs] = useState("");
  const [desact, setDesact] = useState<any>(null);
  const [msg, setMsg] = useState("");

  const load = () => {
    api.get("/productos").then((r) => setItems(r.data));
    api.get("/inventario/movimientos").then((r) => setMovs(r.data)).catch(() => {});
  };
  useEffect(() => { load(); api.get("/proveedores").then((r) => setProvs(r.data)).catch(() => {}); }, []);

  const ultimoMov: Record<number, any> = {};
  for (const m of movs) {
    if (!ultimoMov[m.producto_id] || m.id > ultimoMov[m.producto_id].id) ultimoMov[m.producto_id] = m;
  }
  const provNombre = (id: number | null) => provs.find((p) => p.id === id)?.nombre ?? "—";

  const nuevo = () => { setEditing(null); setF(EMPTY); setShowForm(true); };
  const editar = (p: any) => {
    setEditing(p);
    setF({ codigo: p.codigo, nombre: p.nombre, precio_venta: String(p.precio_venta), costo: String(p.costo_promedio), tipo_venta: p.tipo_venta, unidad_medida: p.unidad_medida, stock_minimo: String(p.stock_minimo), proveedor_id: p.proveedor_id ? String(p.proveedor_id) : "", activo: p.activo });
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
        payload.activo = f.activo;
        await api.put(`/productos/${editing.id}`, payload);
        setMsg("Producto actualizado");
      } else {
        await api.post("/productos", { ...payload, codigo: f.codigo, categoria_id: null });
        setMsg("Producto creado");
      }
      setShowForm(false); setEditing(null); setF(EMPTY); load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };

  const desactivar = async () => { await api.delete(`/productos/${desact.id}`); setDesact(null); setMsg("Producto desactivado"); load(); };

  const openStock = (p: any) => {
    setStock(p); setSCant(""); setSCosto(p.costo_promedio ? String(p.costo_promedio) : ""); setSProv(p.proveedor_id ? String(p.proveedor_id) : ""); setSObs("");
  };

  const doAgregarStock = async () => {
    try {
      const r = await api.post("/inventario/entrada", { producto_id: stock.id, cantidad: sCant, costo_unitario: sCosto || null, proveedor_id: sProv || null, observacion: sObs });
      setMsg(`Stock agregado: ${r.data.anterior} + ${r.data.entrada} = ${r.data.nuevo} kg`);
      setStock(null); load();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };

  const field = (label: string, el: React.ReactNode) => (
    <div><label className="mb-1 block text-xs text-stone-400">{label}</label>{el}</div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="page-title">Inventario</h2>
          <p className="page-sub">Administra productos, precios y existencias de La Casa del Queso.</p>
        </div>
        <div className="flex gap-2">
          <Link to="/compras" className="btn btn-ghost">Registrar compra</Link>
          <button className="btn btn-primary" onClick={nuevo}>+ Nuevo producto</button>
        </div>
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}

      {showForm && (
        <div className="card">
          <h3 className="mb-2 font-semibold text-stone-100">{editing ? "Editar producto" : "Nuevo producto"}</h3>
          <div className="grid gap-2 md:grid-cols-3">
            {field("Nombre del producto", <input className="input" value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Queso paipa x kg" />)}
            {!editing
              ? field("Código", <input className="input" value={f.codigo} onChange={(e) => setF({ ...f, codigo: e.target.value })} placeholder="QMAD-001" />)
              : field("Código", <input className="input opacity-60" value={f.codigo} disabled />)}
            {field("Precio de venta", <input className="input" value={f.precio_venta} onChange={(e) => setF({ ...f, precio_venta: e.target.value })} placeholder="48000" />)}
            {field("Costo de compra", <input className="input" value={f.costo} onChange={(e) => setF({ ...f, costo: e.target.value })} placeholder="36000" />)}
            {field("Unidad de venta", <select className="input" value={f.unidad_medida} onChange={(e) => setF({ ...f, unidad_medida: e.target.value })}><option>KG</option><option>G</option><option>UND</option><option>LB</option></select>)}
            {field("Tipo de venta", <select className="input" value={f.tipo_venta} onChange={(e) => setF({ ...f, tipo_venta: e.target.value })}><option>PESO</option><option>UNIDAD</option></select>)}
            {field("Stock mínimo", <input className="input" value={f.stock_minimo} onChange={(e) => setF({ ...f, stock_minimo: e.target.value })} placeholder="5" />)}
            {field("Proveedor principal", <select className="input" value={f.proveedor_id} onChange={(e) => setF({ ...f, proveedor_id: e.target.value })}><option value="">Seleccionar proveedor</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>)}
            {editing && field("Estado", <select className="input" value={f.activo ? "1" : "0"} onChange={(e) => setF({ ...f, activo: e.target.value === "1" })}><option value="1">Activo</option><option value="0">Inactivo</option></select>)}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-ghost" onClick={() => { setShowForm(false); setEditing(null); }}>Cancelar</button>
            <button className="btn btn-primary" onClick={save}>{editing ? "Guardar cambios" : "Guardar producto"}</button>
          </div>
          <p className="mt-2 text-xs text-stone-500">Precio de venta: a cuánto se vende. Costo de compra: cuánto se paga al proveedor.</p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="table">
          <thead><tr><th>Producto</th><th>Código</th><th>Unidad</th><th>Precio de venta</th><th>Costo de compra</th><th>Existencia</th><th>Stock mínimo</th><th>Estado</th><th>Último movimiento</th><th>Acciones</th></tr></thead>
          <tbody>
            {items.map((p: any) => {
              const u = ultimoMov[p.id];
              return (
                <tr key={p.id}>
                  <td className="font-medium text-stone-50">{p.nombre}<div className="text-xs font-normal text-stone-500">{provNombre(p.proveedor_id)}</div></td>
                  <td className="text-stone-400">{p.codigo}</td>
                  <td>{p.unidad_medida}</td>
                  <td>${Number(p.precio_venta).toLocaleString()}</td>
                  <td className="text-stone-300">${Number(p.costo_promedio).toLocaleString()}</td>
                  <td className="font-semibold">{p.stock_actual} {p.tipo_venta === "PESO" ? "kg" : ""}</td>
                  <td className="text-stone-400">{p.stock_minimo}</td>
                  <td>{estadoBadge(p)}</td>
                  <td className="text-xs text-stone-400">{u ? `${u.tipo} · ${u.cantidad}` : "—"}</td>
                  <td>
                    <div className="flex gap-1">
                      <button className="btn btn-ghost px-3 py-1" onClick={() => editar(p)}>Editar</button>
                      <button className="btn btn-primary px-3 py-1" onClick={() => openStock(p)}>+ Agregar stock</button>
                      <button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setDesact(p)}>Desactivar</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {stock && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setStock(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 text-lg font-bold text-stone-50">Agregar stock</h3>
            <p className="text-sm text-stone-300">Producto: <strong className="text-stone-100">{stock.nombre}</strong></p>
            <p className="mb-3 text-sm text-stone-300">Existencia actual: <strong className="text-stone-100">{stock.stock_actual} {stock.unidad_medida}</strong></p>
            {field("Cantidad a ingresar", <input className="input" value={sCant} onChange={(e) => setSCant(e.target.value)} placeholder={stock.tipo_venta === "PESO" ? "50" : "10"} />)}
            <p className="mt-1 text-xs text-stone-500">Unidad: {stock.unidad_medida}{stock.tipo_venta === "PESO" ? " (se permiten decimales: 0.500, 2.500)" : ""}</p>
            <div className="mt-2">{field(`Costo de compra por ${stock.unidad_medida}`, <input className="input" value={sCosto} onChange={(e) => setSCosto(e.target.value)} placeholder="36000" />)}</div>
            <p className="mt-1 text-xs text-stone-500">Valor que La Casa del Queso paga por cada {stock.unidad_medida}. No es el precio de venta (${Number(stock.precio_venta).toLocaleString()} / {stock.unidad_medida}).</p>
            <p className="mt-2 text-sm text-stone-300">Total de compra: <strong className="text-lg text-stone-50">${((parseFloat(sCant) || 0) * (parseFloat(sCosto) || 0)).toLocaleString()}</strong></p>
            <div className="mt-2">{field("Proveedor", <select className="input" value={sProv} onChange={(e) => setSProv(e.target.value)}><option value="">Seleccionar proveedor</option>{provs.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>)}</div>
            <div className="mt-2">{field("Observación (opcional)", <input className="input" value={sObs} onChange={(e) => setSObs(e.target.value)} placeholder="Opcional" />)}</div>
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setStock(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doAgregarStock}>Agregar al inventario</button>
            </div>
          </div>
        </div>
      )}

      {desact && <ConfirmDialog title="Desactivar producto" message={`¿Deseas desactivar "${desact.nombre}"? No se eliminará el historial.`} confirmLabel="Desactivar" onCancel={() => setDesact(null)} onConfirm={desactivar} />}

      <div className="card overflow-x-auto">
        <h3 className="mb-2 font-semibold text-stone-100">Movimientos recientes</h3>
        <table className="table"><thead><tr><th>ID</th><th>Producto</th><th>Tipo</th><th>Cant</th><th>Antes → Nuevo</th><th>Ref</th></tr></thead>
        <tbody>{movs.slice(0, 30).map((m: any) => <tr key={m.id}><td>{m.id}</td><td>{m.producto?.nombre}</td><td>{m.tipo}</td><td>{m.cantidad}</td><td>{m.stock_anterior} → {m.stock_nuevo}</td><td>{m.ref_tipo} #{m.ref_id}</td></tr>)}</tbody></table>
      </div>
    </div>
  );
}
