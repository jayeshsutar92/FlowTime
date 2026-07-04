import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { ensureCsrfCookie } from "../services/api";
import { useAuth } from "../contexts/AuthContext";

type AuthView = "login" | "signup" | "forgot_password" | "reset_password" | "otp_login";

const stringifyErrorValue = (value: unknown): string => {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value.map(stringifyErrorValue).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    if (typeof objectValue.message === "string") return objectValue.message;
    if (typeof objectValue.detail === "string") return objectValue.detail;
    if (typeof objectValue.code === "string") return objectValue.code;
    return Object.values(objectValue).map(stringifyErrorValue).filter(Boolean).join(" ");
  }
  return "";
};

export default function Auth() {
  const [view, setView] = useState<AuthView>("login");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpHint, setOtpHint] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOtpHint(null);
    setLoading(true);
    try {
      const { data } = await api.post("/login/", { identifier, password });
      login(data.data.access, data.data.refresh, data.data.is_admin);
      navigate("/timer");
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOtpHint(null);
    setLoading(true);
    try {
      await api.post("/signup/", { identifier, password });
      const { data } = await api.post("/login/", { identifier, password });
      login(data.data.access, data.data.refresh, data.data.is_admin);
      navigate("/timer");
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setOtpHint(null);
    setLoading(true);
    try {
      await ensureCsrfCookie();
      const { data } = await api.post("/forgot-password/", { identifier });
      setMessage("If the account exists, an OTP has been sent.");
      setOtpHint(data?.otp ?? null);
      setView("reset_password");
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setOtpHint(null);
    setLoading(true);
    try {
      await ensureCsrfCookie();
      await api.post("/reset-password/", { identifier, otp, new_password: newPassword });
      setMessage("Password reset successful. You can now login.");
      setView("login");
      setPassword("");
      setOtp("");
      setNewPassword("");
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestOtpLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setOtpHint(null);
    setLoading(true);
    try {
      // Using forgot-password to generate OTP for login, as they share the same OTP verification logic without purpose restriction.
      await ensureCsrfCookie();
      const { data } = await api.post("/forgot-password/", { identifier });
      setMessage("An OTP has been generated for login.");
      setOtpHint(data?.otp ?? null);
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setOtpHint(null);
    setLoading(true);
    try {
      const { data } = await api.post("/login/", { identifier, otp });
      login(data.data.access, data.data.refresh, data.data.is_admin);
      navigate("/timer");
    } catch (err: any) {
      handleError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleError = (err: any) => {
    const data = err?.response?.data;
    if (data?.error) {
      setError(stringifyErrorValue(data.error));
      return;
    }
    if (data?.detail) {
      setError(stringifyErrorValue(data.detail));
      return;
    }
    if (data?.details) {
      setError(stringifyErrorValue(data.details));
      return;
    }
    if (data?.data) {
      setError(stringifyErrorValue(data.data));
      return;
    }
    if (data?.message) {
      setError(stringifyErrorValue(data.message));
      return;
    }
    if (err?.message) {
      setError(err.message);
      return;
    }
    setError("An error occurred. Please try again.");
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background mesh-bg">
      <div className="max-w-md w-full glass-card p-10 rounded-3xl z-10 relative">
        <h2 className="text-3xl font-bold text-center mb-2 tracking-tight text-white">
          {view === "login" && "Welcome back"}
          {view === "signup" && "Create account"}
          {view === "forgot_password" && "Forgot Password"}
          {view === "reset_password" && "Reset Password"}
          {view === "otp_login" && "Login with OTP"}
        </h2>
        <p className="text-on-surface-variant text-center mb-8 text-sm">
          {view === "login" && "Enter your details to access your focus hub."}
          {view === "signup" && "Start your deep work journey."}
          {view === "forgot_password" && "Enter your email to receive a reset code."}
          {view === "reset_password" && "Enter the OTP sent to your email and a new password."}
          {view === "otp_login" && "Login without a password using an OTP."}
        </p>

        {error && (
          <div className="bg-error/10 border border-error/20 text-error p-3 rounded-lg mb-6 text-sm">
            {error}
          </div>
        )}
        
        {message && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-3 rounded-lg mb-6 text-sm">
            {message}
            {(view === "forgot_password" || view === "otp_login") && (
              <div className="text-[11px] text-emerald-300/90 mt-2">
                Check backend console for OTP
              </div>
            )}
            {otpHint && (
              <div className="text-[11px] text-emerald-300/90 mt-1">
                OTP: {otpHint}
              </div>
            )}
          </div>
        )}

        {view === "login" && (
          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">Email or Username</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">Password</label>
                <button type="button" onClick={() => setView("forgot_password")} className="text-primary text-xs hover:underline">Forgot?</button>
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] hover:bg-blue-500 text-white py-3.5 rounded-xl font-medium shadow-[0_4px_20px_rgba(37,99,235,0.2)] transition-colors flex justify-center items-center"
            >
              {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></span> : "Sign In"}
            </button>
            <div className="text-center flex flex-col gap-2">
              <button type="button" onClick={() => setView("otp_login")} className="text-on-surface-variant text-sm hover:text-white transition-colors">
                Login with OTP instead
              </button>
              <p className="text-on-surface-variant text-sm">
                Don't have an account? <button type="button" onClick={() => setView("signup")} className="text-primary hover:underline font-medium">Sign up</button>
              </p>
            </div>
          </form>
        )}

        {view === "signup" && (
          <form onSubmit={handleSignup} className="space-y-6">
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">Email or Username</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] hover:bg-blue-500 text-white py-3.5 rounded-xl font-medium shadow-[0_4px_20px_rgba(37,99,235,0.2)] transition-colors flex justify-center items-center"
            >
              {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></span> : "Sign Up"}
            </button>
            <p className="text-center text-on-surface-variant text-sm">
              Already have an account? <button type="button" onClick={() => setView("login")} className="text-primary hover:underline font-medium">Sign in</button>
            </p>
          </form>
        )}

        {view === "forgot_password" && (
          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">Email or Username</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="you@example.com"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] hover:bg-blue-500 text-white py-3.5 rounded-xl font-medium shadow-[0_4px_20px_rgba(37,99,235,0.2)] transition-colors flex justify-center items-center"
            >
              {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></span> : "Send OTP"}
            </button>
            <div className="text-center flex flex-col gap-2">
              <button type="button" onClick={() => setView("reset_password")} className="text-primary text-sm hover:underline">
                Already have an OTP?
              </button>
              <button type="button" onClick={() => setView("login")} className="text-on-surface-variant text-sm hover:text-white transition-colors">
                Back to Login
              </button>
            </div>
          </form>
        )}

        {view === "reset_password" && (
          <form onSubmit={handleResetPassword} className="space-y-6">
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">Email or Username</label>
              <input
                type="text"
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">OTP</label>
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="123456"
              />
            </div>
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">New Password</label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#2563EB] hover:bg-blue-500 text-white py-3.5 rounded-xl font-medium shadow-[0_4px_20px_rgba(37,99,235,0.2)] transition-colors flex justify-center items-center"
            >
              {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></span> : "Reset Password"}
            </button>
            <button type="button" onClick={() => setView("login")} className="w-full text-center text-on-surface-variant text-sm hover:text-white transition-colors">
              Back to Login
            </button>
          </form>
        )}

        {view === "otp_login" && (
          <form className="space-y-6">
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">Email or Username</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="flex-1 bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                  placeholder="you@example.com"
                />
                <button
                  type="button"
                  onClick={handleRequestOtpLogin}
                  disabled={loading || !identifier}
                  className="bg-[#1E2638] hover:bg-[#2A344A] text-white px-4 py-3 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
                >
                  Get OTP
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-on-surface-variant font-label-sm text-xs tracking-widest uppercase">OTP</label>
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-[#0F141F] border border-white/10 rounded-xl px-4 py-3 text-white focus:border-primary transition-all outline-none"
                placeholder="123456"
              />
            </div>
            <button
              type="button"
              onClick={handleOtpLoginSubmit}
              disabled={loading || !otp || !identifier}
              className="w-full bg-[#2563EB] hover:bg-blue-500 text-white py-3.5 rounded-xl font-medium shadow-[0_4px_20px_rgba(37,99,235,0.2)] transition-colors flex justify-center items-center"
            >
              {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/20 border-t-white rounded-full"></span> : "Sign In with OTP"}
            </button>
            <button type="button" onClick={() => setView("login")} className="w-full text-center text-on-surface-variant text-sm hover:text-white transition-colors">
              Login with Password instead
            </button>
          </form>
        )}

      </div>
    </div>
  );
}
