import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { JSX } from "react";

export default function ProtectedRoute({ children, roles }: { children: JSX.Element; roles?: string[] }) {
  const { token, user } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (roles && roles.length > 0 && user && !roles.includes(user.rol)) {
    // Conductor y roles restringidos: redirigir a su vista principal.
    if (user.rol === "conductor") return <Navigate to="/mis-entregas" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}
