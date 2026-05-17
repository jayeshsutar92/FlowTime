/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import TimerSelection from "./pages/TimerSelection";
import DefaultTimer from "./pages/DefaultTimer";
import CustomTimer from "./pages/CustomTimer";
import Dashboard from "./pages/Dashboard";
import Presets from "./pages/Presets";
import Music from "./pages/Music";
import TopNav from "./components/TopNav";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/auth" />;
  return <>{children}</>;
};

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth" element={<Auth />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
                  {/* Background Ambient Glows */}
                  <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-primary/10 rounded-full blur-[120px] pointer-events-none z-0"></div>
                  <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-secondary/10 rounded-full blur-[100px] pointer-events-none z-0"></div>
                  
                  <div className="relative z-10 flex flex-col min-h-screen">
                    <TopNav />
                    <Routes>
                      <Route path="/timer" element={<TimerSelection />} />
                      <Route path="/timer/default" element={<DefaultTimer />} />
                      <Route path="/timer/custom" element={<CustomTimer />} />
                      <Route path="/dashboard" element={<Dashboard />} />
                      <Route path="/presets" element={<Presets />} />
                      <Route path="/music" element={<Music />} />
                      <Route path="*" element={<Navigate to="/timer" />} />
                    </Routes>
                  </div>
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
