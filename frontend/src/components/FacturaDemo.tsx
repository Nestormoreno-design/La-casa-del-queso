import { useEffect, useState } from "react";
import { api } from "../api/client";

export default function FacturaDemo({ ventaId, onClose }: { ventaId: number; onClose: () => void }) {
  const [v, setV] = useState<any>(null);
  useEffect(() => { api.get(`/ventas/${ventaId}`).then((r) => setV(r.data)); }, [ventaId]);
  const num = `DEMO-${String(ventaId).padStart(6, "0")}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {!v ? <p className="text-stone-300">Cargando factura...</p> : (
          <>
            <div className="border-b border-[#31373e] pb-3 text-center">
              <h2 className="text-xl font-bold text-stone-50">🧀 LA CASA DEL QUESO</h2>
              <p className="text-sm text-stone-400">Distribuidora de quesos</p>
              <p className="mt-1 font-semibold text-[#e3c98a]">Factura {num}</p>
              <p className="text-xs text-stone-400">Fecha: {v.fecha?.slice(0, 16).replace("T", " ")}</p>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1 text-sm">
              <p><span className="text-stone-400">Cliente:</span> {v.cliente?.nombre ?? "Mostrador"}</p>
              <p><span className="text-stone-400">NIT / Documento:</span> {v.cliente?.documento ?? "—"}</p>
              <p><span className="text-stone-400">Dirección:</span> {v.cliente?.direccion ?? "—"}</p>
              <p><span className="text-stone-400">Ciudad:</span> {v.cliente?.ciudad ?? "—"}</p>
              <p><span className="text-stone-400">Correo:</span> {v.cliente?.email ?? "—"}</p>
              <p><span className="text-stone-400">Teléfono:</span> {v.cliente?.telefono ?? "—"}</p>
            </div>
            <table className="table mt-3">
              <thead><tr><th>Producto</th><th>Cantidad</th><th>Unidad</th><th>Precio unitario</th><th>Subtotal</th></tr></thead>
              <tbody>
                {(v.items ?? []).map((it: any) => (
                  <tr key={it.id}>
                    <td>{it.producto?.nombre}</td>
                    <td>{it.cantidad}</td>
                    <td>{it.producto?.unidad_medida ?? "—"}</td>
                    <td>${Number(it.precio_unitario).toLocaleString()}</td>
                    <td>${Number(it.subtotal).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-2 text-right text-sm">
              <p className="text-stone-400">Subtotal: ${Number(v.subtotal).toLocaleString()}</p>
              <p className="text-stone-400">Descuento: ${Number(v.descuento).toLocaleString()}</p>
              <p className="text-lg font-bold text-stone-50">Total: ${Number(v.total).toLocaleString()}</p>
              <p className="text-stone-400">Método de pago: {v.metodo_pago}</p>
              {v.pedido_id && <p className="text-stone-400">Pedido asociado: #{v.pedido_id}</p>}
            </div>
            <p className="mt-3 rounded-lg border border-[#c9a86a]/40 bg-[#c9a86a]/10 p-2 text-center text-xs font-semibold text-[#e3c98a]">
              DOCUMENTO DE DEMOSTRACIÓN — NO VÁLIDO COMO FACTURA ELECTRÓNICA
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn btn-ghost" onClick={() => window.print()}>Imprimir factura</button>
              <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
