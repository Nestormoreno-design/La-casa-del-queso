import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import POS from "./pages/POS";
import Inventario from "./pages/Inventario";
import Distribucion from "./pages/Distribucion";
import Entregas from "./pages/Entregas";
import { Categorias, Clientes, Proveedores } from "./pages/Catalogos";
import { Compras, Ventas } from "./pages/Operaciones";
import { Caja, HistorialCajas } from "./pages/PedidosCaja";
import Pedidos from "./pages/Pedidos";
import InformeVentas from "./pages/InformeVentas";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="pos" element={<POS />} />
            <Route path="ventas" element={<Ventas />} />
            <Route path="informes/ventas" element={<InformeVentas />} />
            <Route path="pedidos" element={<Pedidos />} />
            <Route path="distribucion" element={<Distribucion />} />
            <Route path="entregas" element={<Entregas />} />
            <Route path="productos" element={<Navigate to="/inventario" replace />} />
            <Route path="categorias" element={<Categorias />} />
            <Route path="proveedores" element={<Proveedores />} />
            <Route path="clientes" element={<Clientes />} />
            <Route path="compras" element={<Compras />} />
            <Route path="inventario" element={<Inventario />} />
            <Route path="caja" element={<Caja />} />
            <Route path="caja/historial" element={<HistorialCajas />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
