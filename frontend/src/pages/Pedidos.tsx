import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import ClienteModal from "../components/ClienteModal";
import ConfirmDialog from "../components/ConfirmDialog";
import FacturaDemo from "../components/FacturaDemo";
import VentaDetail from "../components/VentaDetail";

const METODOS = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CREDITO"];
const FILTROS = ["Todos", "PENDIENTE", "PREPARANDO", "LISTO", "ENTREGADO", "CANCELADO"] as const;

const estadoLabel = (e: string) => e;
const filtroLabel = (f: string) => f === "Todos" ? "Todos" : f.charAt(0) + f.slice(1).toLowerCase() + "s";
const estadoBadge = (e: string) =>
  e === "ENTREGADO" ? "badge badge-ok" : e === "CANCELADO" ? "badge badge-bad" : e === "LISTO" ? "badge badge-ok" : e === "PREPARANDO" ? "badge badge-warn" : "badge badge-idle";

type Linea = { producto_id: number | ""; cantidad: string };

export default function Pedidos() {
  const [items, setItems] = useState<any[]>([]);
  const [clis, setClis] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lines, setLines] = useState<Linea[]>([]);
  const [cli, setCli] = useState("");
  const [fEntrega, setFEntrega] = useState("");
  const [fHora, setFHora] = useState("");
  const [fDir, setFDir] = useState("");
  const [fObs, setFObs] = useState("");
  const [showCliModal, setShowCliModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [ver, setVer] = useState<any>(null);
  const [entregar, setEntregar] = useState<any>(null);
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [ventaId, setVentaId] = useState<number | null>(null);
  const [cancelar, setCancelar] = useState<any>(null);
  const [entregarErr, setEntregarErr] = useState("");
  const [genVenta, setGenVenta] = useState<any>(null);
  const [genMetodo, setGenMetodo] = useState("EFECTIVO");
  const [genErr, setGenErr] = useState("");
  const [facturaId, setFacturaId] = useState<number | null>(null);

  const openEntregar = (p: any) => { setEntregarErr(""); setEntregar(p); };

  const loadPedidos = () => api.get("/pedidos").then((r) => setItems(r.data));
  const loadClis = () => api.get("/clientes").then((r) => setClis(r.data)).catch(() => {});
  useEffect(() => { loadPedidos(); loadClis(); api.get("/productos").then((r) => setProds(r.data)); }, []);

  const prodDe = (id: number | "") => prods.find((p) => p.id === id);
  const sub = (l: Linea) => { const p = prodDe(l.producto_id); return p ? (parseFloat(l.cantidad) || 0) * Number(p.precio_venta) : 0; };
  const total = lines.reduce((a, l) => a + sub(l), 0);
  const filtrados = useMemo(() => (filtro === "Todos" ? items : items.filter((p) => p.estado === filtro)), [items, filtro]);

  const nuevo = () => { setEditingId(null); setLines([]); setCli(""); setFEntrega(""); setFHora(""); setFDir(""); setFObs(""); setShowForm(true); window.scrollTo({ top: 0 }); };
  const editar = (p: any) => {
    setEditingId(p.id);
    setCli(p.cliente_id ? String(p.cliente_id) : "");
    setFEntrega(p.fecha_entrega ? String(p.fecha_entrega).slice(0, 10) : "");
    setFHora(p.hora_entrega ?? "");
    setFDir(p.direccion_entrega ?? "");
    setFObs(p.observaciones ?? "");
    setLines((p.items ?? []).map((it: any) => ({ producto_id: it.producto_id, cantidad: String(it.cantidad) })));
    setShowForm(true);
    window.scrollTo({ top: 0 });
  };

  const guardar = async () => {
    try {
      const validas = lines.filter((l) => l.producto_id !== "");
      if (validas.length === 0) { setMsg("Agrega al menos un producto"); return; }
      const payload = { cliente_id: cli ? Number(cli) : null, fecha_entrega: fEntrega ? new Date(fEntrega + "T12:00:00").toISOString() : null, hora_entrega: fHora || null, direccion_entrega: fDir || null, observaciones: fObs || null, items: validas.map((l) => ({ producto_id: Number(l.producto_id), cantidad: l.cantidad })) };
      if (editingId) { await api.put(`/pedidos/${editingId}`, payload); setMsg(`Pedido #${editingId} actualizado`); }
      else { const r = await api.post("/pedidos", payload); setMsg(`Pedido #${r.data.id} confirmado (no descuenta inventario)`); }
      setShowForm(false); setEditingId(null); setLines([]); setCli(""); setFEntrega(""); setFHora(""); setFDir(""); setFObs(""); loadPedidos();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
  };

  const preparar = async (id: number) => { await api.post(`/pedidos/${id}/estado`, { estado: "PREPARANDO" }); loadPedidos(); };

  const doGenerar = async () => {
    setGenErr("");
    try {
      const r = await api.post(`/pedidos/${genVenta.id}/generar-venta`, { metodo_pago: genMetodo });
      setFacturaId(r.data.venta_id);
      setGenVenta(null); loadPedidos();
    } catch (e: any) { setGenErr(e.response?.data?.detail ?? "Error"); }
  };

  const doEntregar = async () => {
    setEntregarErr("");
    try {
      const caja = await api.get("/caja/actual").catch(() => ({ data: { abierta: false } }));
      if (!caja.data.abierta) { setEntregarErr("Debes abrir la caja antes de registrar ventas."); return; }
      const r = await api.post(`/pedidos/${entregar.id}/entregar`, { metodo_pago: metodo, caja_sesion_id: caja.data.sesion_id });
      setFacturaId(r.data.venta_id);
      setEntregar(null); setEntregarErr(""); loadPedidos();
    } catch (e: any) { setEntregarErr(e.response?.data?.detail ?? "Error al entregar"); }
  };

  const doCancelar = async () => {
    try { await api.delete(`/pedidos/${cancelar.id}`); setMsg(`Pedido #${cancelar.id} cancelado`); }
    catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
    setCancelar(null); loadPedidos();
  };

  const verDetalle = async (id: number) => { const r = await api.get(`/pedidos/${id}`); setVer(r.data); };

  const verFacturaDe = async (pid: number) => {
    const r = await api.get("/ventas");
    const v = r.data.find((x: any) => x.pedido_id === pid && x.estado !== "ANULADA");
    if (v) setFacturaId(v.id);
    else setMsg("El pedido aún no tiene factura generada.");
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div><h2 className="page-title">Pedidos</h2><p className="page-sub">Preparamos y entregamos los pedidos a nuestros clientes.</p></div>
        <button className="btn btn-primary" onClick={nuevo}>+ Nuevo pedido</button>
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}

      {showForm && (
        <div className="card">
          <h3 className="mb-1 text-lg font-bold text-stone-50">{editingId ? `Editar pedido #${editingId}` : "Nuevo pedido"}</h3>
          <h4 className="mb-2 text-sm font-semibold text-stone-300">PRODUCTOS DEL PEDIDO</h4>
          <table className="table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th><th>Precio</th><th>Subtotal</th><th /></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const p = prodDe(l.producto_id);
              return (
                <tr key={i}>
                  <td><select className="input" value={l.producto_id} onChange={(e) => { const c = [...lines]; c[i] = { ...c[i], producto_id: e.target.value ? Number(e.target.value) : "" }; setLines(c); }}><option value="">Seleccionar...</option>{prods.map((x) => <option key={x.id} value={x.id}>{x.nombre}</option>)}</select></td>
                  <td><input className="input" style={{ minWidth: 90 }} value={l.cantidad} onChange={(e) => { const c = [...lines]; c[i] = { ...c[i], cantidad: e.target.value }; setLines(c); }} placeholder="2.5" /></td>
                  <td>{p ? p.unidad_medida : "—"}</td>
                  <td>{p ? `$${Number(p.precio_venta).toLocaleString()}` : "—"}</td>
                  <td className="font-medium">${sub(l).toLocaleString()}</td>
                  <td><button className="btn btn-ghost px-3 py-1" title="Eliminar" onClick={() => setLines(lines.filter((_, j) => j !== i))}>🗑</button></td>
                </tr>
              );
            })}
          </tbody></table>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="btn btn-ghost" onClick={() => setLines([...lines, { producto_id: "", cantidad: "1" }])}>+ Agregar producto</button>
            <span className="ml-auto font-bold text-stone-50">TOTAL: ${total.toLocaleString()}</span>
          </div>
          <h4 className="mb-1 mt-3 text-sm font-semibold text-stone-300">CLIENTE</h4>
          <div className="flex flex-wrap gap-2">
            <select className="input" style={{ maxWidth: 320 }} value={cli} onChange={(e) => setCli(e.target.value)}>
              <option value="">Cliente Mostrador</option>
              {clis.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={() => setShowCliModal(true)}>+ Nuevo cliente</button>
          </div>
          {cli && (() => { const c = clis.find((x) => String(x.id) === cli); return c ? (
            <div className="mt-2 rounded-xl border border-[#31373e] p-2 text-sm">
              <p><span className="text-stone-400">Razón social:</span> {c.nombre}</p>
              <p><span className="text-stone-400">NIT:</span> {c.documento ?? "—"} · <span className="text-stone-400">Teléfono:</span> {c.telefono ?? "—"}</p>
              <p><span className="text-stone-400">Dirección:</span> {c.direccion ?? "—"}{c.ciudad ? `, ${c.ciudad}` : ""} · <span className="text-stone-400">Correo:</span> {c.email ?? "—"}</p>
            </div>
          ) : null; })()}
          <h4 className="mb-1 mt-3 text-sm font-semibold text-stone-300">ENTREGA PROGRAMADA</h4>
          <div className="grid gap-2 md:grid-cols-3">
            <div><label className="text-xs text-stone-400">Fecha de entrega</label><input type="date" className="input" value={fEntrega} onChange={(e) => setFEntrega(e.target.value)} /></div>
            <div><label className="text-xs text-stone-400">Horario (ej: 8:00 AM - 10:00 AM)</label><input className="input" value={fHora} onChange={(e) => setFHora(e.target.value)} placeholder="8:00 AM - 10:00 AM" /></div>
            <div><label className="text-xs text-stone-400">Dirección de entrega</label><input className="input" value={fDir} onChange={(e) => setFDir(e.target.value)} placeholder="Puede diferir del cliente" /></div>
          </div>
          <div className="mt-2"><label className="text-xs text-stone-400">Observaciones</label><input className="input" value={fObs} onChange={(e) => setFObs(e.target.value)} placeholder="Notas del pedido" /></div>
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" onClick={guardar}>{editingId ? "Guardar cambios" : "Guardar pedido"}</button>
            <button className="btn btn-ghost" onClick={() => setShowForm(false)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTROS.map((f) => (
          <button key={f} onClick={() => setFiltro(f)} className={`btn px-3 py-1 text-sm ${filtro === f ? "btn-primary" : "btn-ghost"}`}>
            {filtroLabel(f)}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>ID</th><th>Cliente</th><th>Fecha</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          {filtrados.map((p: any) => (
            <tr key={p.id}>
              <td>#{p.id}</td>
              <td>{p.cliente?.nombre ?? "Mostrador"}</td>
              <td className="text-xs text-stone-400">{p.fecha?.slice(0, 10)}</td>
              <td>${Number(p.total).toLocaleString()}</td>
              <td><span className={estadoBadge(p.estado)}>{estadoLabel(p.estado)}</span></td>
              <td className="flex flex-wrap gap-1">
                <button className="btn btn-ghost px-3 py-1" onClick={() => verDetalle(p.id)}>Ver</button>
                {p.estado === "PENDIENTE" && <><button className="btn btn-ghost px-3 py-1" onClick={() => editar(p)}>Editar</button><button className="btn btn-ghost px-3 py-1" onClick={() => preparar(p.id)}>Preparar</button><button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setCancelar(p)}>Cancelar</button></>}
                {p.estado === "PREPARANDO" && <><button className="btn btn-ghost px-3 py-1" onClick={() => { setGenErr(""); setGenVenta(p); }}>Generar venta</button><button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setCancelar(p)}>Cancelar</button></>}
                {p.estado === "LISTO" && <><button className="btn btn-ghost px-3 py-1" onClick={() => verFacturaDe(p.id)}>Ver factura</button><button className="btn btn-primary px-3 py-1" onClick={() => openEntregar(p)}>Entregar</button><button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setCancelar(p)}>Cancelar</button></>}
              </td>
            </tr>
          ))}
        </tbody></table>
      </div>

      {ver && <PedidoDetalle pedido={ver} clis={clis} onClose={() => setVer(null)} onEntregar={() => { setVer(null); openEntregar(ver); }} onVerVenta={(vid: number) => { setVer(null); setVentaId(vid); }} onVerFactura={(pid: number) => { setVer(null); verFacturaDe(pid); }} onCancelado={() => { setVer(null); loadPedidos(); }} />}

      {genVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setGenVenta(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-stone-50">Generar venta y factura #{genVenta.id}</h3>
            <p className="mb-2 text-sm text-stone-300">Cliente: {genVenta.cliente?.nombre ?? "Mostrador"} · Total: ${Number(genVenta.total).toLocaleString()}. No descuenta inventario todavía.</p>
            <label className="mb-1 block text-sm text-stone-300">Método de pago</label>
            <select className="input" value={genMetodo} onChange={(e) => setGenMetodo(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
            {genErr && <p className="mt-2 text-sm text-red-300">{genErr}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setGenVenta(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doGenerar}>Generar venta y factura</button>
            </div>
          </div>
        </div>
      )}

      {entregar && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setEntregar(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-stone-50">Entregar pedido #{entregar.id}</h3>
            <p className="mb-2 text-sm text-stone-300">Se creará la venta automáticamente, se descontará inventario y se registrará en caja.</p>
            <label className="mb-1 block text-sm text-stone-300">Método de pago</label>
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS.map((m) => <option key={m}>{m}</option>)}</select>
            {entregarErr && <p className="mt-2 text-sm text-red-300">{entregarErr}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setEntregar(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doEntregar}>Entregar pedido</button>
            </div>
          </div>
        </div>
      )}

      {facturaId !== null && <FacturaDemo ventaId={facturaId} onClose={() => setFacturaId(null)} />}
      {ventaId !== null && <VentaDetail id={ventaId} onClose={() => setVentaId(null)} onAnulada={() => { setVentaId(null); loadPedidos(); }} />}
      {cancelar && <ConfirmDialog title="Cancelar pedido" message={`¿Deseas cancelar el pedido #${cancelar.id}? No se modificará el inventario.`} confirmLabel="Cancelar pedido" onCancel={() => setCancelar(null)} onConfirm={doCancelar} />}
      {showCliModal && <ClienteModal onClose={() => setShowCliModal(false)} onCreated={(c) => { setShowCliModal(false); loadClis(); setCli(String(c.id)); }} />}
    </div>
  );
}

function PedidoDetalle({ pedido, clis, onClose, onEntregar, onVerVenta, onVerFactura, onCancelado }: any) {
  const [ventaId, setVentaId] = useState<number | null>(null);
  useEffect(() => {
    if (pedido.estado === "ENTREGADO" || pedido.estado === "LISTO") {
      api.get("/ventas").then((r) => {
        const v = r.data.find((x: any) => x.pedido_id === pedido.id && x.estado !== "ANULADA");
        if (v) setVentaId(v.id);
      }).catch(() => {});
    }
  }, [pedido]);
  const cli = pedido.cliente ?? {};
  const cancelar = async () => {
    await api.delete(`/pedidos/${pedido.id}`);
    onCancelado();
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-lg font-bold text-stone-50">Pedido #{pedido.id}</h3>
          <button className="text-stone-400 hover:text-white" onClick={onClose}>✕</button>
        </div>
        <p><span className="text-stone-400">Cliente:</span> {cli.nombre ?? "Mostrador"}</p>
        <div className="mt-1 grid grid-cols-2 gap-1 text-sm">
          <p><span className="text-stone-400">NIT:</span> {cli.documento ?? "—"}</p>
          <p><span className="text-stone-400">Teléfono:</span> {cli.telefono ?? "—"}</p>
          <p><span className="text-stone-400">Dirección:</span> {cli.direccion ?? "—"}{cli.ciudad ? `, ${cli.ciudad}` : ""}</p>
          <p><span className="text-stone-400">Estado:</span> {estadoLabel(pedido.estado)}</p>
          <p><span className="text-stone-400">Entrega programada:</span> {pedido.fecha_entrega ? String(pedido.fecha_entrega).slice(0, 10) : "—"}{pedido.hora_entrega ? ` · ${pedido.hora_entrega}` : ""}</p>
          <p><span className="text-stone-400">Dirección de entrega:</span> {pedido.direccion_entrega ?? "—"}</p>
        </div>
        <h4 className="mb-1 mt-3 font-semibold text-stone-100">Productos</h4>
        <table className="table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>{(pedido.items ?? []).map((it: any) => <tr key={it.id}><td>{it.producto?.nombre}</td><td>{it.cantidad}</td><td>${Number(it.precio_unitario).toLocaleString()}</td><td>${Number(it.subtotal).toLocaleString()}</td></tr>)}</tbody></table>
        <p className="mt-2 text-right text-lg font-bold text-stone-50">Total: ${Number(pedido.total).toLocaleString()}</p>
        <div className="mt-3 flex justify-end gap-2">
          {pedido.estado === "LISTO" && (
            <><button className="btn btn-ghost" onClick={() => onVerFactura(pedido.id)}>Ver factura</button><button className="btn btn-primary" onClick={onEntregar}>Entregar pedido</button><button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={cancelar}>Cancelar pedido</button></>
          )}
          {(pedido.estado === "PENDIENTE" || pedido.estado === "PREPARANDO") && (
            <button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={cancelar}>Cancelar pedido</button>
          )}
          {pedido.estado === "ENTREGADO" && <><button className="btn btn-ghost" onClick={() => onVerFactura(pedido.id)}>Ver factura</button>{ventaId && <button className="btn btn-ghost" onClick={() => onVerVenta(ventaId)}>Ver venta</button>}</>}
        </div>
      </div>
    </div>
  );
}

