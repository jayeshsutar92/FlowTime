import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import {
  getApiErrorMessage,
  loginWithOtp,
  loginWithPassword,
  requestForgotPassword,
  resetPassword,
  signupUser,
} from "../api";
import { getStoredAuth, setStoredAuth } from "../authStorage";

function Login() {
  const navigate = useNavigate();
  const auth = getStoredAuth();
  const [view, setView] = useState("login");
  const [loginMode, setLoginMode] = useState("password");
  const [otpStep, setOtpStep] = useState(1);
  const [forgotStep, setForgotStep] = useState(1);
  const [loginForm, setLoginForm] = useState({
    identifier: "",
    password: "",
  });
  const [otpLoginForm, setOtpLoginForm] = useState({
    identifier: "",
    otp: "",
  });
  const [signupForm, setSignupForm] = useState({
    identifier: "",
    password: "",
  });
  const [forgotForm, setForgotForm] = useState({
    identifier: "",
    otp: "",
    newPassword: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const otpInputRef = useRef(null);

  useEffect(() => {
    if (view === "login" && loginMode === "otp" && otpStep === 2) {
      otpInputRef.current?.focus();
    }
  }, [loginMode, otpStep, view]);

  if (auth?.token) {
    return <Navigate to="/select" replace />;
  }

  const resetMessages = () => {
    setErrorMessage("");
    setInfoMessage("");
  };

  const goToLogin = () => {
    resetMessages();
    setView("login");
    setLoginMode("password");
    setOtpStep(1);
    setForgotStep(1);
  };

  const goToSignup = () => {
    resetMessages();
    setView("signup");
    setForgotStep(1);
  };

  const goToForgot = () => {
    resetMessages();
    setView("forgot");
    setForgotStep(1);
    setForgotForm((current) => ({
      ...current,
      identifier: loginForm.identifier,
      otp: "",
      newPassword: "",
    }));
  };

  const handleLoginChange = (event) => {
    const { name, value } = event.target;
    setLoginForm((current) => ({ ...current, [name]: value }));
  };

  const handleSignupChange = (event) => {
    const { name, value } = event.target;
    setSignupForm((current) => ({ ...current, [name]: value }));
  };

  const handleOtpLoginChange = (event) => {
    const { name, value } = event.target;
    setOtpLoginForm((current) => ({ ...current, [name]: value }));
  };

  const handleForgotChange = (event) => {
    const { name, value } = event.target;
    setForgotForm((current) => ({ ...current, [name]: value }));
  };

  const handleLoginSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!loginForm.identifier.trim() || loginForm.password.length < 8) {
      setErrorMessage("Please enter valid login details");
      return;
    }

    setIsLoading(true);

    try {
      const data = await loginWithPassword({
        identifier: loginForm.identifier.trim(),
        password: loginForm.password,
      });

      setStoredAuth({
        token: data?.token ?? data?.access ?? data?.access_token ?? data?.auth_token ?? data?.key ?? null,
      });

      setLoginForm({
        identifier: "",
        password: "",
      });

      navigate("/select", { replace: true });
    } catch (error) {
      console.error(error);
      setErrorMessage(getApiErrorMessage(error, "Login failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!otpLoginForm.identifier.trim()) {
      setErrorMessage("Please enter your email or username");
      return;
    }

    setIsLoading(true);

    try {
      await requestForgotPassword({
        identifier: otpLoginForm.identifier.trim(),
      });

      setInfoMessage("If account exists, OTP sent");
      setOtpStep(2);
      setOtpLoginForm((current) => ({
        ...current,
        otp: "",
      }));
    } catch (error) {
      console.error(error);
      setErrorMessage(getApiErrorMessage(error, "Could not send OTP"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpLoginSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!otpLoginForm.identifier.trim() || !/^\d{6}$/.test(otpLoginForm.otp.trim())) {
      setErrorMessage("Invalid or expired OTP");
      return;
    }

    setIsLoading(true);

    try {
      const data = await loginWithOtp({
        identifier: otpLoginForm.identifier.trim(),
        otp: otpLoginForm.otp.trim(),
      });

      setStoredAuth({
        token: data?.token ?? data?.access ?? data?.access_token ?? data?.auth_token ?? data?.key ?? null,
      });

      setOtpLoginForm({
        identifier: "",
        otp: "",
      });

      navigate("/select", { replace: true });
    } catch (error) {
      console.error(error);
      setErrorMessage("Invalid or expired OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignupSubmit = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!signupForm.identifier.trim() || signupForm.password.length < 8) {
      setErrorMessage("Please enter valid signup details");
      return;
    }

    setIsLoading(true);

    try {
      await signupUser({
        identifier: signupForm.identifier.trim(),
        password: signupForm.password,
      });

      setSignupForm({
        identifier: "",
        password: "",
      });

      setView("login");
      setInfoMessage("Account created");
    } catch (error) {
      console.error(error);
      setErrorMessage(getApiErrorMessage(error, "Signup failed"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotRequest = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!forgotForm.identifier.trim()) {
      setErrorMessage("Please enter your email or username");
      return;
    }

    setIsLoading(true);

    try {
      await requestForgotPassword({
        identifier: forgotForm.identifier.trim(),
      });

      setInfoMessage("If account exists, OTP sent");
      setForgotStep(2);
      setForgotForm((current) => ({
        ...current,
        otp: "",
        newPassword: "",
      }));
    } catch (error) {
      console.error(error);
      setErrorMessage(getApiErrorMessage(error, "Could not send reset code"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();
    resetMessages();

    if (!forgotForm.identifier.trim() || !forgotForm.otp.trim() || forgotForm.newPassword.length < 8) {
      setErrorMessage("Please enter valid reset details");
      return;
    }

    setIsLoading(true);

    try {
      await resetPassword({
        identifier: forgotForm.identifier.trim(),
        otp: forgotForm.otp.trim(),
        new_password: forgotForm.newPassword,
      });

      setForgotForm({
        identifier: "",
        otp: "",
        newPassword: "",
      });

      setView("login");
      setForgotStep(1);
      setInfoMessage("Password reset successful");
    } catch (error) {
      console.error(error);
      setErrorMessage(getApiErrorMessage(error, "Password reset failed"));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="screen">
      <div className="card auth-card">
        <div className="auth-header">
          <h1 className="screen-title">
            {view === "signup" ? "Create Account" : view === "forgot" ? "Forgot Password" : "Login"}
          </h1>
          <p className="screen-description">Access your timers and dashboard.</p>
        </div>

        {view !== "forgot" ? (
          <div className="auth-toggle" role="tablist" aria-label="Authentication tabs">
            <button
              type="button"
              className={`auth-tab ${view === "login" ? "auth-tab-active" : ""}`}
              onClick={goToLogin}
            >
              Login
            </button>
            <button
              type="button"
              className={`auth-tab ${view === "signup" ? "auth-tab-active" : ""}`}
              onClick={goToSignup}
            >
              Signup
            </button>
          </div>
        ) : null}

        {view === "login" ? (
          <>
            <div className="auth-toggle" role="tablist" aria-label="Login mode tabs">
              <button
                type="button"
                className={`auth-tab ${loginMode === "password" ? "auth-tab-active" : ""}`}
                onClick={() => {
                  resetMessages();
                  setLoginMode("password");
                  setOtpStep(1);
                }}
              >
                Password
              </button>
              <button
                type="button"
                className={`auth-tab ${loginMode === "otp" ? "auth-tab-active" : ""}`}
                onClick={() => {
                  resetMessages();
                  setLoginMode("otp");
                  setOtpStep(1);
                }}
              >
                OTP
              </button>
            </div>

            {loginMode === "password" ? (
              <form className="auth-form" onSubmit={handleLoginSubmit}>
                <label className="field">
                  <span>Email or username</span>
                  <input
                    name="identifier"
                    value={loginForm.identifier}
                    onChange={handleLoginChange}
                    autoComplete="username"
                  />
                </label>

                <label className="field">
                  <span>Password</span>
                  <input
                    name="password"
                    type="password"
                    value={loginForm.password}
                    onChange={handleLoginChange}
                    autoComplete="current-password"
                  />
                </label>

                <button type="button" className="auth-link-button" onClick={goToForgot}>
                  Forgot Password?
                </button>

                {infoMessage ? <p className="feedback-message">{infoMessage}</p> : null}
                {errorMessage ? (
                  <p className="feedback-message error-message" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <button type="submit" className="action-button primary-button" disabled={isLoading}>
                  {isLoading ? "Signing in..." : "Login"}
                </button>

                <button type="button" className="auth-link-button" onClick={goToSignup}>
                  Create account
                </button>
              </form>
            ) : (
              <form className="auth-form" onSubmit={otpStep === 1 ? handleSendOtp : handleOtpLoginSubmit}>
                <label className="field">
                  <span>Email or username</span>
                  <input
                    name="identifier"
                    value={otpLoginForm.identifier}
                    onChange={handleOtpLoginChange}
                    autoComplete="username"
                    disabled={otpStep === 2}
                  />
                </label>

                {otpStep === 2 ? (
                  <label className="field">
                    <span>OTP</span>
                    <input
                      ref={otpInputRef}
                      name="otp"
                      value={otpLoginForm.otp}
                      onChange={handleOtpLoginChange}
                      inputMode="numeric"
                      maxLength="6"
                    />
                  </label>
                ) : null}

                {infoMessage ? <p className="feedback-message">{infoMessage}</p> : null}
                {errorMessage ? (
                  <p className="feedback-message error-message" role="alert">
                    {errorMessage}
                  </p>
                ) : null}

                <button type="submit" className="action-button primary-button" disabled={isLoading}>
                  {isLoading ? (otpStep === 1 ? "Sending..." : "Verifying...") : otpStep === 1 ? "Send OTP" : "Login"}
                </button>

                <button type="button" className="auth-link-button" onClick={goToSignup}>
                  Create account
                </button>
              </form>
            )}
          </>
        ) : null}

        {view === "signup" ? (
          <form className="auth-form" onSubmit={handleSignupSubmit}>
            <label className="field">
              <span>Email or username</span>
              <input
                name="identifier"
                value={signupForm.identifier}
                onChange={handleSignupChange}
                autoComplete="username"
              />
            </label>

            <label className="field">
              <span>Password</span>
              <input
                name="password"
                type="password"
                value={signupForm.password}
                onChange={handleSignupChange}
                autoComplete="new-password"
              />
            </label>

            {infoMessage ? <p className="feedback-message">{infoMessage}</p> : null}
            {errorMessage ? (
              <p className="feedback-message error-message" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button type="submit" className="action-button primary-button" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create account"}
            </button>

            <button type="button" className="auth-link-button" onClick={goToLogin}>
              Back to Login
            </button>
          </form>
        ) : null}

        {view === "forgot" ? (
          <form className="auth-form" onSubmit={forgotStep === 1 ? handleForgotRequest : handleResetPassword}>
            <label className="field">
              <span>Email or username</span>
              <input
                name="identifier"
                value={forgotForm.identifier}
                onChange={handleForgotChange}
                disabled={forgotStep === 2}
              />
            </label>

            {forgotStep === 2 ? (
              <>
                <label className="field">
                  <span>OTP</span>
                  <input name="otp" value={forgotForm.otp} onChange={handleForgotChange} />
                </label>

                <label className="field">
                  <span>New password</span>
                  <input
                    name="newPassword"
                    type="password"
                    value={forgotForm.newPassword}
                    onChange={handleForgotChange}
                    autoComplete="new-password"
                  />
                </label>
              </>
            ) : null}

            {infoMessage ? <p className="feedback-message">{infoMessage}</p> : null}
            {errorMessage ? (
              <p className="feedback-message error-message" role="alert">
                {errorMessage}
              </p>
            ) : null}

            <button type="submit" className="action-button primary-button" disabled={isLoading}>
              {isLoading
                ? forgotStep === 1
                  ? "Sending..."
                  : "Resetting..."
                : forgotStep === 1
                  ? "Send Reset Code"
                  : "Reset Password"}
            </button>

            <button type="button" className="auth-link-button" onClick={goToLogin}>
              Back to Login
            </button>
          </form>
        ) : null}
      </div>
    </section>
  );
}

export default Login;
