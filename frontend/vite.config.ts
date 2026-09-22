import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Backend oficial: puerto 8000 en loopback IPv6 (::1).
// En 127.0.0.1:8000 puede existir una instancia vieja congelada del sistema
// que no responde al código actual; por eso se usa ::1 explícitamente.
// Se puede redirigir sin tocar código, p. ej.: $env:VITE_BACKEND_URL="http://127.0.0.1:8001"
const backend = process.env.VITE_BACKEND_URL ?? "http://[::1]:8000";

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { "/api": backend } },
});
