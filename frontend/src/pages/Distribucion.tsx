import { Navigate } from "react-router-dom";

// Compatibilidad: el antiguo módulo "Distribución" ahora vive dentro de
// Ventas → Pedidos / Entregas. Se conserva el archivo para no romper imports.
export default function Distribucion() {
  return <Navigate to="/pedidos" replace />;
}
