import React, { createContext, useContext, useState, useEffect } from "react";
import api from "../services/api";

interface AuthContextType {
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("flowtime_token"));

  const login = (newToken: string) => {
    localStorage.setItem("flowtime_token", newToken);
    setToken(newToken);
  };

  const logout = () => {
    localStorage.removeItem("flowtime_token");
    setToken(null);
  };

  useEffect(() => {
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
    <AuthContext.Provider value={{ token, isAuthenticated: !!token, login, logout }}>
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
