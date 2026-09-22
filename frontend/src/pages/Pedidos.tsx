import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import ClienteModal from "../components/ClienteModal";
import ConfirmDialog from "../components/ConfirmDialog";
import FacturaDemo from "../components/FacturaDemo";
import VentaDetail from "../components/VentaDetail";
import { useAuth } from "../context/AuthContext";
import { fmtCantidad, fmtMoney, dateTimeToISO, fmtFechaHoraCorta, isoToDatePart, isoToTimePart } from "../utils/format";

const FILTROS = ["Todos", "PENDIENTE", "EN PREPARACIÓN", "EN DISTRIBUCIÓN", "ENTREGADO", "DEVUELTO"] as const;
const METODOS_ENTREGA = ["EFECTIVO", "NEQUI", "DAVIPLATA", "TARJETA", "TRANSFERENCIA", "CREDITO"];

const estadoBadge = (e: string) =>
  e === "ENTREGADO" ? "badge badge-ok"
  : e === "DEVUELTO" ? "badge badge-bad"
  : e === "EN DISTRIBUCIÓN" ? "badge badge-warn"
  : e === "EN PREPARACIÓN" ? "badge badge-warn"
  : "badge badge-idle";

type Linea = { producto_id: number | ""; cantidad: string };

export default function Pedidos() {
  const { user } = useAuth();
  const puedeOperar = user?.rol === "conductor" || user?.rol === "administrador";
  const puedeGestionar = user?.rol !== "conductor";
  const [items, setItems] = useState<any[]>([]);
  const [clis, setClis] = useState<any[]>([]);
  const [prods, setProds] = useState<any[]>([]);
  const [filtro, setFiltro] = useState<(typeof FILTROS)[number]>("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [lines, setLines] = useState<Linea[]>([]);
  const [cli, setCli] = useState("");
  const [fFecha, setFFecha] = useState("");
  const [fHora, setFHora] = useState("");
  const [fDir, setFDir] = useState("");
  const [fObs, setFObs] = useState("");
  const [showCliModal, setShowCliModal] = useState(false);
  const [msg, setMsg] = useState("");
  const [ver, setVer] = useState<any>(null);
  const [entregar, setEntregar] = useState<any>(null);
  const [devolver, setDevolver] = useState<any>(null);
  const [devObs, setDevObs] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [ventaId, setVentaId] = useState<number | null>(null);
  const [eliminar, setEliminar] = useState<any>(null);
  const [entregarErr, setEntregarErr] = useState("");
  const [genVenta, setGenVenta] = useState<any>(null);
  const [genErr, setGenErr] = useState("");
  const [facturaId, setFacturaId] = useState<number | null>(null);

  const openEntregar = (p: any) => { setEntregarErr(""); setMetodo("EFECTIVO"); setEntregar(p); };

  const loadPedidos = () => api.get("/pedidos").then((r) => setItems(r.data));
  const loadClis = () => api.get("/clientes").then((r) => setClis(r.data)).catch(() => {});
  useEffect(() => {
    loadPedidos(); loadClis();
    api.get("/productos").then((r) => setProds(r.data));
  }, []);

  const prodDe = (id: number | "") => prods.find((p) => p.id === id);
  const sub = (l: Linea) => { const p = prodDe(l.producto_id); return p ? (parseFloat(l.cantidad) || 0) * Number(p.precio_venta) : 0; };
  const total = lines.reduce((a, l) => a + sub(l), 0);
  const filtrados = useMemo(() => (filtro === "Todos" ? items : items.filter((p) => p.estado === filtro)), [items, filtro]);

  const nuevo = () => {
    setEditingId(null); setLines([]); setCli(""); setFFecha(""); setFHora("");
    setFDir(""); setFObs("");
    setShowForm(true); window.scrollTo({ top: 0 });
  };
  const editar = (p: any) => {
    setEditingId(p.id);
    setCli(p.cliente_id ? String(p.cliente_id) : "");
    setFFecha(isoToDatePart(p.fecha_entrega));
    setFHora(isoToTimePart(p.fecha_entrega));
    setFDir(p.direccion_entrega ?? "");
    setFObs(p.observaciones ?? "");
    setLines((p.items ?? []).map((it: any) => ({ producto_id: it.producto_id, cantidad: String(it.cantidad) })));
    setShowForm(true);
    window.scrollTo({ top: 0 });
  };

  const guardar = async () => {
    try {
      setMsg("");
      const validas = lines.filter((l) => l.producto_id !== "" && parseFloat(l.cantidad) > 0);
      if (validas.length === 0) { setMsg("Debes agregar al menos un producto al pedido."); return; }
      if (!cli) { setMsg("Selecciona el cliente del pedido."); return; }
      const payload = {
        cliente_id: Number(cli),
        fecha_entrega: dateTimeToISO(fFecha, fHora),
        hora_entrega: null,
        direccion_entrega: fDir || null,
        observaciones: fObs || null,
        items: validas.map((l) => ({ producto_id: Number(l.producto_id), cantidad: l.cantidad })),
      };
      if (editingId) { await api.put(`/pedidos/${editingId}`, payload); setMsg(`Pedido #${editingId} actualizado`); }
      else { const r = await api.post("/pedidos", payload); setMsg(`Pedido #${r.data.id} confirmado (no descuenta inventario)`); }
      setShowForm(false); setEditingId(null); setLines([]); setCli(""); setFFecha(""); setFHora(""); setFDir(""); setFObs(""); loadPedidos();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error al guardar el pedido"); }
  };

  const avanzar = async (id: number, estado: string) => {
    try { await api.post(`/pedidos/${id}/estado`, { estado }); setMsg(""); loadPedidos(); }
    catch (e: any) { setMsg(`Error al cambiar estado: "${e.response?.data?.detail ?? "no se pudo cambiar el estado"}"`); }
  };

  const doGenerar = async () => {
    setGenErr("");
    try {
      const r = await api.post(`/pedidos/${genVenta.id}/generar-venta`, {});
      setFacturaId(r.data.venta_id);
      setGenVenta(null); loadPedidos();
    } catch (e: any) { setGenErr(e.response?.data?.detail ?? "Error"); }
  };

  const doEntregar = async () => {
    setEntregarErr("");
    try {
      if (metodo !== "CREDITO") {
        const caja = await api.get("/caja/actual").catch(() => ({ data: { abierta: false } }));
        if (!caja.data.abierta) { setEntregarErr("Debes abrir la caja antes de registrar ventas."); return; }
        const r = await api.post(`/pedidos/${entregar.id}/entregar`, { metodo_pago: metodo, caja_sesion_id: caja.data.sesion_id });
        setFacturaId(r.data.venta_id);
      } else {
        if (!entregar.cliente_id && !entregar.cliente) { setEntregarErr("El crédito requiere un cliente asignado."); return; }
        const r = await api.post(`/pedidos/${entregar.id}/entregar`, { metodo_pago: "CREDITO" });
        setFacturaId(r.data.venta_id);
      }
      setEntregar(null); setEntregarErr(""); loadPedidos();
    } catch (e: any) { setEntregarErr(e.response?.data?.detail ?? "Error al entregar"); }
  };

  const doDevolver = async () => {
    setEntregarErr("");
    try {
      await api.post(`/pedidos/${devolver.id}/devolver`, { observaciones: devObs || null });
      setDevolver(null); setDevObs(""); loadPedidos();
    } catch (e: any) { setEntregarErr(e.response?.data?.detail ?? "Error al devolver"); }
  };

  const doEliminar = async () => {
    try { await api.delete(`/pedidos/${eliminar.id}`); setMsg(`Pedido #${eliminar.id} eliminado`); }
    catch (e: any) { setMsg(e.response?.data?.detail ?? "Error"); }
    setEliminar(null); loadPedidos();
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
        <div><h2 className="page-title">Pedidos</h2><p className="page-sub">Ventas mayoristas y distribución: preparamos y entregamos.</p></div>
        {puedeGestionar && <button className="btn btn-primary" onClick={nuevo}>+ Nuevo pedido</button>}
      </div>
      {msg && <p className="text-sm text-stone-300">{msg}</p>}

      {showForm && puedeGestionar && (
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
                  <td>{p ? fmtMoney(p.precio_venta) : "—"}</td>
                  <td className="font-medium">{fmtMoney(sub(l))}</td>
                  <td><button className="btn btn-ghost px-3 py-1" title="Eliminar" onClick={() => setLines(lines.filter((_, j) => j !== i))}>🗑</button></td>
                </tr>
              );
            })}
          </tbody></table>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button className="btn btn-ghost" onClick={() => setLines([...lines, { producto_id: "", cantidad: "1" }])}>+ Agregar producto</button>
            <span className="ml-auto font-bold text-stone-50">TOTAL: {fmtMoney(total)}</span>
          </div>
          <h4 className="mb-1 mt-3 text-sm font-semibold text-stone-300">CLIENTE</h4>
          <div className="flex flex-wrap gap-2">
            <select className="input" style={{ maxWidth: 320 }} value={cli} onChange={(e) => setCli(e.target.value)}>
              <option value="">Seleccionar cliente *</option>
              {clis.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.tipo_cliente === "MAYORISTA" ? "(mayorista)" : ""}</option>)}
            </select>
            <button className="btn btn-ghost" onClick={() => setShowCliModal(true)}>+ Nuevo cliente</button>
          </div>
          <h4 className="mb-1 mt-3 text-sm font-semibold text-stone-300">ENTREGA PROGRAMADA</h4>
          <div className="grid gap-2 md:grid-cols-3">
            <div><label className="text-xs text-stone-400">Fecha</label><input type="date" className="input" value={fFecha} onChange={(e) => setFFecha(e.target.value)} /></div>
            <div><label className="text-xs text-stone-400">Hora</label><input type="time" className="input" value={fHora} onChange={(e) => setFHora(e.target.value)} /></div>
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
            {f === "Todos" ? "Todos" : f}
          </button>
        ))}
      </div>

      <div className="card overflow-x-auto">
        <table className="table"><thead><tr><th>ID</th><th>Cliente</th><th>Entrega</th><th>Total</th><th>Estado</th><th>Acciones</th></tr></thead>
        <tbody>
          {filtrados.map((p: any) => (
            <tr key={p.id}>
              <td>#{p.id}</td>
              <td>{p.cliente?.nombre ?? "Mostrador"}</td>
              <td className="text-xs text-stone-400">{fmtFechaHoraCorta(p.fecha_entrega)}</td>
              <td>{fmtMoney(p.total)}</td>
              <td><span className={estadoBadge(p.estado)}>{p.estado}</span></td>
              <td className="flex flex-wrap gap-1">
                <button className="btn btn-ghost px-3 py-1" onClick={() => verDetalle(p.id)}>Ver</button>
                {puedeGestionar && (p.estado === "PENDIENTE" || p.estado === "EN PREPARACIÓN") && (
                  <><button className="btn btn-ghost px-3 py-1" onClick={() => editar(p)}>Editar</button>
                  {p.estado === "PENDIENTE"
                    ? <button className="btn btn-ghost px-3 py-1" onClick={() => avanzar(p.id, "EN PREPARACIÓN")}>Preparar</button>
                    : <button className="btn btn-ghost px-3 py-1" onClick={() => { setGenErr(""); setGenVenta(p); }}>A distribución</button>}
                  <button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={() => setEliminar(p)}>Eliminar</button></>
                )}
                {puedeGestionar && p.estado === "EN DISTRIBUCIÓN" && (
                  <button className="btn btn-ghost px-3 py-1" onClick={() => verFacturaDe(p.id)}>Ver factura</button>
                )}
                {puedeOperar && p.estado === "EN DISTRIBUCIÓN" && (
                  <><button className="btn btn-primary px-3 py-1" onClick={() => openEntregar(p)}>Entregar</button>
                  <button className="btn px-3 py-1 border border-amber-900 text-amber-300 hover:bg-amber-950" onClick={() => { setEntregarErr(""); setDevObs(""); setDevolver(p); }}>Devuelto</button></>
                )}
              </td>
            </tr>
          ))}
        </tbody></table>
      </div>

      {ver && <PedidoDetalle pedido={ver} puedeOperar={puedeOperar} puedeGestionar={puedeGestionar} onClose={() => setVer(null)} onEntregar={() => { setVer(null); openEntregar(ver); }} onDevolver={() => { setVer(null); setDevolver(ver); }} onVerFactura={(pid: number) => { setVer(null); verFacturaDe(pid); }} onEliminado={() => { setVer(null); loadPedidos(); }} />}

      {genVenta && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setGenVenta(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-stone-50">Pasar a distribución #{genVenta.id}</h3>
            <p className="mb-2 text-sm text-stone-300">Cliente: {genVenta.cliente?.nombre ?? "Mostrador"} · Total: {fmtMoney(genVenta.total)}. Se genera la venta sin descontar inventario; el inventario se descuenta al entregar.</p>
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
            <p className="mb-2 text-sm text-stone-300">Se descontará inventario y se registrará la venta{metodo === "CREDITO" ? " a crédito (pendiente de pago)" : " en caja"}.</p>
            <label className="mb-1 block text-sm text-stone-300">Método de pago</label>
            <select className="input" value={metodo} onChange={(e) => setMetodo(e.target.value)}>{METODOS_ENTREGA.map((m) => <option key={m}>{m}</option>)}</select>
            {metodo === "CREDITO" && <p className="mt-1 text-xs text-amber-300">Quedará como crédito pendiente del cliente.</p>}
            {entregarErr && <p className="mt-2 text-sm text-red-300">{entregarErr}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setEntregar(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doEntregar}>Entregar pedido</button>
            </div>
          </div>
        </div>
      )}

      {devolver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setDevolver(null)}>
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-2 text-lg font-bold text-stone-50">Marcar devuelto #{devolver.id}</h3>
            <p className="mb-2 text-sm text-stone-300">Se anula la venta generada sin mover inventario.</p>
            <label className="mb-1 block text-sm text-stone-300">Motivo (opcional)</label>
            <input className="input" value={devObs} onChange={(e) => setDevObs(e.target.value)} placeholder="Ej: cliente ausente" />
            {entregarErr && <p className="mt-2 text-sm text-red-300">{entregarErr}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => setDevolver(null)}>Cancelar</button>
              <button className="btn btn-primary" onClick={doDevolver}>Marcar devuelto</button>
            </div>
          </div>
        </div>
      )}

      {facturaId !== null && <FacturaDemo ventaId={facturaId} onClose={() => setFacturaId(null)} />}
      {ventaId !== null && <VentaDetail id={ventaId} onClose={() => setVentaId(null)} onAnulada={() => { setVentaId(null); loadPedidos(); }} />}
      {eliminar && <ConfirmDialog title="Eliminar pedido" message={`¿Deseas eliminar el pedido #${eliminar.id}? Solo PENDIENTE puede eliminarse y no mueve inventario.`} confirmLabel="Eliminar" onCancel={() => setEliminar(null)} onConfirm={doEliminar} />}
      {showCliModal && <ClienteModal onClose={() => setShowCliModal(false)} onCreated={(c) => { setShowCliModal(false); loadClis(); setCli(String(c.id)); }} />}
    </div>
  );
}

function PedidoDetalle({ pedido, puedeOperar, puedeGestionar, onClose, onEntregar, onDevolver, onVerFactura, onEliminado }: any) {
  const [ventaId, setVentaId] = useState<number | null>(null);
  useEffect(() => {
    if (pedido.estado === "ENTREGADO" || pedido.estado === "EN DISTRIBUCIÓN") {
      api.get("/ventas").then((r) => {
        const v = r.data.find((x: any) => x.pedido_id === pedido.id && x.estado !== "ANULADA");
        if (v) setVentaId(v.id);
      }).catch(() => {});
    }
  }, [pedido]);
  const cli = pedido.cliente ?? {};
  const eliminar = async () => {
    await api.delete(`/pedidos/${pedido.id}`);
    onEliminado();
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
          <p><span className="text-stone-400">Estado:</span> {pedido.estado}</p>
          <p><span className="text-stone-400">Entrega programada:</span> {fmtFechaHoraCorta(pedido.fecha_entrega)}</p>
          <p><span className="text-stone-400">Dirección de entrega:</span> {pedido.direccion_entrega ?? "—"}</p>
        </div>
        <h4 className="mb-1 mt-3 font-semibold text-stone-100">Productos</h4>
        <table className="table"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>{(pedido.items ?? []).map((it: any) => <tr key={it.id}><td>{it.producto?.nombre}</td><td>{fmtCantidad(it.cantidad, it.producto?.unidad_medida)}</td><td>{fmtMoney(it.precio_unitario)}</td><td>{fmtMoney(it.subtotal)}</td></tr>)}</tbody></table>
        <p className="mt-2 text-right text-lg font-bold text-stone-50">Total: {fmtMoney(pedido.total)}</p>
        <div className="mt-3 flex justify-end gap-2">
          {pedido.estado === "EN DISTRIBUCIÓN" && (
            <><button className="btn btn-ghost" onClick={() => onVerFactura(pedido.id)}>Ver factura</button>
            {puedeOperar && <><button className="btn btn-primary" onClick={onEntregar}>Entregar pedido</button><button className="btn px-3 py-1 border border-amber-900 text-amber-300 hover:bg-amber-950" onClick={onDevolver}>Marcar devuelto</button></>}</>
          )}
          {puedeGestionar && (pedido.estado === "PENDIENTE" || pedido.estado === "EN PREPARACIÓN") && (
            <button className="btn px-3 py-1 border border-red-900 text-red-300 hover:bg-red-950" onClick={eliminar}>Eliminar pedido</button>
          )}
          {pedido.estado === "ENTREGADO" && <button className="btn btn-ghost" onClick={() => onVerFactura(pedido.id)}>Ver factura</button>}
        </div>
      </div>
    </div>
  );
}
