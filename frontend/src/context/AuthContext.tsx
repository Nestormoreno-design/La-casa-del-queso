import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "../api/client";

type User = { id: number; username: string; rol: string };
type Ctx = { user: User | null; token: string | null; login: (u: string, p: string) => Promise<void>; logout: () => void };

const AuthCtx = createContext<Ctx>({ user: null, token: null, login: async () => {}, logout: () => {} });
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(localStorage.getItem("token"));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (token) api.get("/auth/me").then((r) => setUser(r.data)).catch(() => { localStorage.removeItem("token"); setToken(null); });
  }, [token]);

  const login = async (username: string, password: string) => {
    const r = await api.post("/auth/login", { username, password });
    localStorage.setItem("token", r.data.access_token);
    setToken(r.data.access_token);
    const me = await api.get("/auth/me", { headers: { Authorization: `Bearer ${r.data.access_token}` } });
    setUser(me.data);
  };
  const logout = () => { localStorage.removeItem("token"); setToken(null); setUser(null); };
  return <AuthCtx.Provider value={{ user, token, login, logout }}>{children}</AuthCtx.Provider>;
}
