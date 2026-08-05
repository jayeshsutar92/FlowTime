/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { createBrowserRouter, RouterProvider, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import TimerSelection from "./pages/TimerSelection";
import DefaultTimer from "./pages/DefaultTimer";
import CustomTimer from "./pages/CustomTimer";
import Dashboard from "./pages/Dashboard";
import Contributions from "./pages/Contributions";
import Presets from "./pages/Presets";
import Music from "./pages/Music";
import Admin from "./pages/Admin";
import TopNav from "./components/TopNav";
import RouteErrorBoundary from "./components/RouteErrorBoundary";

import { MusicProvider } from "./contexts/MusicContext";
import GlobalPlayer from "./components/GlobalPlayer";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth" />;
  return <>{children}</>;
};

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/timer" />;
  return <>{children}</>;
};

const RootRoutes = () => (
  <Routes>
    <Route path="/" element={<Landing />} />
    <Route path="/auth" element={<Auth />} />
    <Route
      path="/*"
      element={
        <ProtectedRoute>
          <MusicProvider>
            <div className="min-h-screen bg-background relative overflow-hidden flex flex-col pb-24">
              {/* Background Ambient Glows */}
              <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
              <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
              
              <div className="relative z-10 flex flex-col min-h-screen">
                <TopNav />
                <RouteErrorBoundary>
                  <Routes>
                    <Route path="/timer" element={<TimerSelection />} />
                    <Route path="/timer/default" element={<DefaultTimer />} />
                    <Route path="/timer/custom" element={<CustomTimer />} />
                    <Route path="/dashboard" element={<Dashboard />} />
                    <Route path="/contributions" element={<Contributions />} />
                    <Route path="/presets" element={<Presets />} />
                    <Route path="/music" element={<Music />} />
                    <Route path="/admin" element={<AdminRoute><Admin /></AdminRoute>} />
                    <Route path="*" element={<Navigate to="/timer" />} />
                  </Routes>
                </RouteErrorBoundary>
              </div>
              <GlobalPlayer />
            </div>
          </MusicProvider>
        </ProtectedRoute>
      }
    />
  </Routes>
);

import { ThemeProvider } from "./contexts/ThemeContext";

const router = createBrowserRouter([{ path: "*", element: <RootRoutes /> }]);

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </ThemeProvider>
  );
}
