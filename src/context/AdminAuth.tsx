import { createContext, useContext, useEffect, useState } from "react";
import { api, auth } from "../lib/api";

interface Admin {
  email: string;
  role: string;
}

interface AdminAuthValue {
  admin: Admin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.isAuthed()) {
      setLoading(false);
      return;
    }
    api.authApi
      .me()
      .then((res) => setAdmin(res.admin))
      .catch(() => {
        auth.clear();
        setAdmin(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.authApi.login(email, password);
    auth.setToken(res.token);
    setAdmin(res.admin);
  };

  const logout = () => {
    auth.clear();
    setAdmin(null);
  };

  return (
    <AdminAuthContext.Provider value={{ admin, loading, login, logout }}>
      {children}
    </AdminAuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
