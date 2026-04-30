import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { clearStoredAuth, getStoredAuth } from "../authStorage";

function Layout() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const showLogout = Boolean(auth?.token) && location.pathname !== "/" && location.pathname !== "/auth";
  const pageShellClassName = location.pathname === "/" ? "page-shell page-shell-wide" : "page-shell";

  const handleLogout = () => {
    clearStoredAuth();
    navigate("/", { replace: true });
  };

  return (
    <div className="app-shell">
      {showLogout ? (
        <div className="layout-header">
          <div className="layout-actions">
            <button
              type="button"
              className="action-button secondary-button logout-button"
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
        </div>
      ) : null}
      <main className={pageShellClassName}>
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
