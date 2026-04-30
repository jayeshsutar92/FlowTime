import { Navigate, Outlet, useLocation } from "react-router-dom";
import { getStoredAuth } from "../authStorage";

function ProtectedRoute() {
  const location = useLocation();
  const auth = getStoredAuth();

  if (!auth?.token) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  return <Outlet />;
}

export default ProtectedRoute;
