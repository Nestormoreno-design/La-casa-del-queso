import { useEffect, useState } from "react";
import { api } from "../api/client";
import FacturaDemo from "./FacturaDemo";

export default function VentaDetail({ id, onClose, onAnulada }: { id: number; onClose: () => void; onAnulada: () => void }) {
  const [v, setV] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [factura, setFactura] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    api.get(`/ventas/${id}`).then((r) => setV(r.data));
    api.get("/usuarios").then((r) => setUsers(r.data)).catch(() => {});
  }, [id]);

  const anular = async () => {
    try {
      await api.post(`/ventas/${id}/anular`, {});
      setConfirm(false);
      onAnulada();
    } catch (e: any) { setMsg(e.response?.data?.detail ?? "Error al anular"); }
  };

  const vendedor = users.find((u) => u.id === v?.usuario_id)?.username ?? (v?.usuario_id ? `#${v.usuario_id}` : "—");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {!v ? <p className="text-stone-300">Cargando...</p> : (
          <>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-lg font-bold text-stone-50">Venta #{v.id}{v.pedido_id ? ` · Pedido #${v.pedido_id}` : ""}</h3>
              <button className="text-stone-400 hover:text-white" onClick={onClose}>✕</button>
            </div>
            {v.estado === "ANULADA" && <p className="badge badge-bad mb-2">VENTA ANULADA</p>}
            {v.estado === "FACTURADA" && <p className="badge badge-warn mb-2">FACTURADA (sin descontar inventario)</p>}
            {v.estado === "PENDIENTE" && <p className="badge badge-bad mb-2">CRÉDITO PENDIENTE DE PAGO</p>}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><span className="text-stone-400">Fecha:</span> {v.fecha?.slice(0, 16).replace("T", " ")}</p>
              <p><span className="text-stone-400">Cliente:</span> {v.cliente?.nombre ?? "Mostrador"}</p>
              <p><span className="text-stone-400">Método de pago:</span> {v.metodo_pago}</p>
              <p><span className="text-stone-400">Usuario:</span> {vendedor}</p>
              <p><span className="text-stone-400">Estado:</span> {v.estado}</p>
              <p><span className="text-stone-400">Tipo:</span> {v.tipo === "DISTRIBUCION" ? "Distribución" : "Menudeo"}</p>
              <p><span className="text-stone-400">Canal:</span> {v.canal}</p>
            </div>
            <table className="table mt-3"><thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Subtotal</th></tr></thead>
            <tbody>{v.items?.map((it: any) => <tr key={it.id}><td>{it.producto?.nombre}</td><td>{it.cantidad}</td><td>${Number(it.precio_unitario).toLocaleString()}</td><td>${Number(it.subtotal).toLocaleString()}</td></tr>)}</tbody></table>
            <div className="mt-2 text-right text-sm">
              <p className="text-stone-400">Subtotal: ${Number(v.subtotal).toLocaleString()}</p>
              <p className="text-stone-400">Descuento: ${Number(v.descuento).toLocaleString()}</p>
              <p className="text-lg font-bold text-stone-50">Total: ${Number(v.total).toLocaleString()}</p>
            </div>
            {msg && <p className="mt-2 text-sm text-red-300">{msg}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir</button>
              <button className="btn btn-ghost" onClick={() => setFactura(true)}>Ver factura</button>
              {(v.estado === "PAGADA" || v.estado === "FACTURADA" || v.estado === "PENDIENTE") && !confirm && (
                <button className="btn border border-red-800 text-red-300 hover:bg-red-950" onClick={() => setConfirm(true)}>Anular venta</button>
              )}
            </div>
            {confirm && (
              <div className="mt-3 rounded-xl border border-red-900 bg-red-950/40 p-3">
                <p className="text-sm text-stone-200">¿Deseas anular esta venta? Esta acción revertirá el inventario y los movimientos de caja.</p>
                <div className="mt-2 flex justify-end gap-2">
                  <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancelar</button>
                  <button className="btn border border-red-800 text-red-200 hover:bg-red-950" onClick={anular}>Anular venta</button>
                </div>
              </div>
            )}
          </>
        )}
        {factura && <FacturaDemo ventaId={id} onClose={() => setFactura(false)} />}
      </div>
    </div>
  );
}
