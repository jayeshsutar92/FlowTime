import { Link, useLocation } from "react-router-dom";
import { cn } from "../lib/utils";
import { useAuth } from "../contexts/AuthContext";
import { LogOut, Shield, Sun, Moon } from "lucide-react";
import { useTheme } from "../contexts/ThemeContext";

export default function TopNav() {
  const location = useLocation();
  const { isAuthenticated, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const links = [
    { name: "Timer", path: "/timer" },
    { name: "Dashboard", path: "/dashboard" },
    { name: "Presets", path: "/presets" },
    { name: "Focus Ambience", path: "/music" },
    ...(isAdmin ? [{ name: "Admin", path: "/admin" }] : []),
  ];

  const handleLogout = () => {
    logout();
  };

  return (
    <header className="fixed top-0 w-full z-50 bg-background/40 backdrop-blur-xl border-b border-outline shadow-sm">
      <div className="flex justify-between items-center h-20 px-margin-mobile md:px-margin-desktop max-w-container-max mx-auto">
        <Link to="/" className="text-xl font-bold tracking-tight text-on-surface flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <div className="w-3 h-3 bg-white rounded-full"></div>
          </div>
          FlowTime
        </Link>
        <nav className="hidden md:flex items-center space-x-8">
          {links.map((link) => (
            <Link
              key={link.path}
              to={link.path}
              className={cn(
                "font-medium font-label-sm text-sm transition-colors flex flex-col justify-center",
                (link.path === "/timer" ? location.pathname.startsWith("/timer") : location.pathname === link.path)
                  ? "text-primary border-b-2 border-primary pb-1 font-bold"
                  : "text-on-surface-variant hover:text-on-surface"
              )}
            >
              {link.name}
            </Link>
          ))}
        </nav>
        
        <div className="flex items-center gap-4">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-surface-variant transition-colors text-on-surface-variant hover:text-on-surface flex items-center justify-center"
            aria-label="Toggle Theme"
          >
            {theme === "light" ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
          </button>

          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
              <Link
                to="/timer"
                className="bg-primary hover:bg-blue-500 text-white px-6 py-2 rounded-full font-semibold text-sm hover:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20"
              >
                Start Session
              </Link>
            </div>
          ) : (
            <Link
              to="/auth"
              className="bg-primary hover:bg-blue-500 text-white px-6 py-2 rounded-full font-semibold text-sm hover:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20"
            >
              Start Session
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
