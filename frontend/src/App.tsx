import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventario from "./pages/Inventario";
import Distribucion from "./pages/Distribucion";
import Entregas from "./pages/Entregas";
import MisEntregas from "./pages/MisEntregas";
import { Categorias, Clientes, Proveedores } from "./pages/Catalogos";
import { Compras, Ventas } from "./pages/Operaciones";
import { Caja, HistorialCajas } from "./pages/PedidosCaja";
import Pedidos from "./pages/Pedidos";
import InformeVentas from "./pages/InformeVentas";

const STAFF = ["administrador", "vendedor", "bodeguero"];

// El conductor entra directo a sus entregas; el resto al dashboard.
function IndexRedirect() {
  const { user } = useAuth();
  if (user?.rol === "conductor") return <Navigate to="/mis-entregas" replace />;
  return <Navigate to="/dashboard" replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<IndexRedirect />} />
            <Route path="dashboard" element={<ProtectedRoute roles={STAFF}><Dashboard /></ProtectedRoute>} />
            <Route path="pos" element={<ProtectedRoute roles={STAFF}><POS /></ProtectedRoute>} />
            <Route path="ventas" element={<ProtectedRoute roles={STAFF}><Ventas /></ProtectedRoute>} />
            <Route path="informes/ventas" element={<ProtectedRoute roles={STAFF}><InformeVentas /></ProtectedRoute>} />
            <Route path="pedidos" element={<ProtectedRoute roles={STAFF}><Pedidos /></ProtectedRoute>} />
            {/* Compatibilidad: el antiguo módulo Distribución ahora vive dentro de Ventas */}
            <Route path="distribucion" element={<Navigate to="/pedidos" replace />} />
            <Route path="entregas" element={<ProtectedRoute roles={STAFF}><Entregas /></ProtectedRoute>} />
            <Route path="mis-entregas" element={<ProtectedRoute roles={["conductor", "administrador"]}><MisEntregas /></ProtectedRoute>} />
            <Route path="productos" element={<Navigate to="/inventario" replace />} />
            <Route path="categorias" element={<ProtectedRoute roles={STAFF}><Categorias /></ProtectedRoute>} />
            <Route path="proveedores" element={<ProtectedRoute roles={["administrador", "bodeguero"]}><Proveedores /></ProtectedRoute>} />
            <Route path="clientes" element={<ProtectedRoute roles={STAFF}><Clientes /></ProtectedRoute>} />
            <Route path="compras" element={<ProtectedRoute roles={["administrador", "bodeguero"]}><Compras /></ProtectedRoute>} />
            <Route path="inventario" element={<ProtectedRoute roles={STAFF}><Inventario /></ProtectedRoute>} />
            <Route path="caja" element={<ProtectedRoute roles={["administrador", "vendedor"]}><Caja /></ProtectedRoute>} />
            <Route path="caja/historial" element={<ProtectedRoute roles={["administrador", "vendedor"]}><HistorialCajas /></ProtectedRoute>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
