import React, { createContext, useContext, useState, useEffect } from "react";
import api, { ensureCsrfCookie, resetCsrfState } from "../services/api";

interface AuthContextType {
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  login: (accessToken: string, refreshToken: string, isAdmin?: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("flowtime_token"));
  const [refreshToken, setRefreshToken] = useState<string | null>(localStorage.getItem("flowtime_refresh"));
  const [isAdmin, setIsAdmin] = useState<boolean>(() => localStorage.getItem("flowtime_is_admin") === "true");

  const login = (accessToken: string, newRefreshToken: string, admin?: boolean) => {
    localStorage.setItem("flowtime_token", accessToken);
    localStorage.setItem("flowtime_refresh", newRefreshToken);
    setToken(accessToken);
    setRefreshToken(newRefreshToken);
    if (admin !== undefined) {
      localStorage.setItem("flowtime_is_admin", String(admin));
      setIsAdmin(admin);
    }
  };

  const logout = () => {
    const currentRefresh = localStorage.getItem("flowtime_refresh");
    if (currentRefresh) {
      api.post("/logout/", { refresh: currentRefresh }).catch(() => undefined);
    }
    localStorage.removeItem("flowtime_token");
    localStorage.removeItem("flowtime_refresh");
    localStorage.removeItem("flowtime_is_admin");
    resetCsrfState();
    setToken(null);
    setRefreshToken(null);
    setIsAdmin(false);
  };

  useEffect(() => {
    // Keep CSRF cookie for non-JWT actions if any, but do not block on it
    void ensureCsrfCookie().catch(() => undefined);
    const handleLogout = () => logout();
    window.addEventListener("flowtime:logout", handleLogout);
    return () => window.removeEventListener("flowtime:logout", handleLogout);
  }, []);

  useEffect(() => {
    const verifySession = async () => {
      if (!token) return;
      try {
        await api.get("/sessions/");
      } catch (err: any) {
        const status = err?.response?.status;
        if (status === 401 || status === 403) {
          logout();
        }
      }
    };
    verifySession();
  }, [token]);

  return (
    <AuthContext.Provider value={{ token, refreshToken, isAuthenticated: !!token, isAdmin, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
