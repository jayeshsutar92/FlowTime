/// <reference types="vite/client" />
import axios from "axios";

const normalizeApiBaseUrl = (value: string) => {
  const apiUrl = value.trim() || "/api";

  if (/^https?:\/\//i.test(apiUrl)) {
    const url = new URL(apiUrl);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/api";
    return url.toString().replace(/\/+$/, "");
  }

  const path = apiUrl.replace(/\/+$/, "");
  return path || "/api";
};

const defaultApiUrl = "/api";
const configuredApiUrl = import.meta.env.PROD ? undefined : import.meta.env.VITE_API_URL;
const apiUrl = configuredApiUrl || defaultApiUrl;

export const API_BASE_URL = normalizeApiBaseUrl(apiUrl);

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

export const resetCsrfState = () => {
  csrfInitPromise = null;
  if (typeof document !== "undefined") {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  }
};

export const ensureCsrfCookie = async () => {
  if (getCookie("csrftoken")) {
    return Promise.resolve();
  }

  if (!csrfInitPromise) {
    csrfInitPromise = csrfClient
      .get("/csrf/")
      .then(() => {
        if (!getCookie("csrftoken")) {
          throw new Error("CSRF cookie missing after refresh");
        }
      })
      .catch((error) => {
        csrfInitPromise = null;
        throw error;
      });
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
    const responseText = JSON.stringify(error?.response?.data ?? "").toLowerCase();
    const isCsrfFailure =
      status === 403 && responseText.includes("csrf");
    const isAuthFailure =
      status === 401 ||
      (status === 403 &&
        !responseText.includes("csrf") &&
        (responseText.includes("authentication") ||
          responseText.includes("credentials") ||
          responseText.includes("not authenticated")));

    if (isAuthFailure) {
      localStorage.removeItem("flowtime_token");
      window.dispatchEvent(new Event("flowtime:logout"));
    }
    if (isCsrfFailure) {
      resetCsrfState();
    }
    return Promise.reject(error);
  }
);

export default api;
