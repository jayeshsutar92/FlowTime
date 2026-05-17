/// <reference types="vite/client" />
import axios from "axios";

export const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
  headers: {
    "Content-Type": "application/json",
  },
});

const csrfClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

let csrfInitPromise: Promise<void> | null = null;

export const ensureCsrfCookie = async () => {
  if (!csrfInitPromise) {
    csrfInitPromise = csrfClient
      .get("/csrf/")
      .then(() => undefined)
      .catch(() => undefined);
  }
  return csrfInitPromise;
};

const getCookie = (name: string) => {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split(";").map((part) => part.trim());
  for (const part of parts) {
    if (part.startsWith(`${name}=`)) {
      return decodeURIComponent(part.substring(name.length + 1));
    }
  }
  return null;
};

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toLowerCase();
  if (![
    "get",
    "head",
    "options",
  ].includes(method)) {
    await ensureCsrfCookie();
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers["X-CSRFToken"] = csrfToken;
    }
  }
  const token = localStorage.getItem("flowtime_token");
  if (token) {
    // Some backends check this. If it's pure session auth, withCredentials handles it.
    // But passing token is safe.
    config.headers.Authorization = `Bearer ${token}`; 
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("flowtime_token");
      window.dispatchEvent(new Event("flowtime:logout"));
    }
    return Promise.reject(error);
  }
);

export default api;
