import { BrowserRouter, Route, Routes } from "react-router-dom";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { TimerStateProvider } from "./context/TimerStateContext";
import Home from "./pages/Home";
import Login from "./pages/Login";
import SelectTimer from "./pages/SelectTimer";
import DefaultTimer from "./pages/DefaultTimer";
import CustomTimer from "./pages/CustomTimer";
import Dashboard from "./pages/Dashboard";

function App() {
  return (
    <TimerStateProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="auth" element={<Login />} />
            <Route element={<ProtectedRoute />}>
              <Route path="select" element={<SelectTimer />} />
              <Route path="timer" element={<DefaultTimer />} />
              <Route path="custom" element={<CustomTimer />} />
              <Route path="dashboard" element={<Dashboard />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </TimerStateProvider>
  );
}

export default App;
