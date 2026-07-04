/// <reference types="vite/client" />
import axios from "axios";

const normalizeApiBaseUrl = (value: string) => {
  const apiUrl = value.trim();

  if (/^https?:\/\//i.test(apiUrl)) {
    const url = new URL(apiUrl);
    url.pathname = url.pathname.replace(/\/+$/, "") || "/api";
    return url.toString().replace(/\/+$/, "");
  }

  const path = apiUrl.replace(/\/+$/, "");
  return path || "/api";
};

const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

if (import.meta.env.PROD && !isLocalhost && !configuredApiUrl) {
  throw new Error("Missing VITE_API_URL for production API requests.");
}

if (
  import.meta.env.PROD &&
  !isLocalhost &&
  configuredApiUrl &&
  !/^https?:\/\//i.test(configuredApiUrl)
) {
  throw new Error("VITE_API_URL must be an absolute backend URL in production.");
}

const apiUrl = configuredApiUrl || "/api";

export const API_BASE_URL = normalizeApiBaseUrl(apiUrl);

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
  headers: {
    "Content-Type": "application/json",
  },
});

const csrfClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  withXSRFToken: true,
  xsrfCookieName: "csrftoken",
  xsrfHeaderName: "X-CSRFToken",
});

export const resetCsrfState = () => {
  if (typeof document !== "undefined") {
    document.cookie = "csrftoken=; Max-Age=0; path=/";
  }
};

export const ensureCsrfCookie = async () => {
  await csrfClient.get("/csrf/");
  if (!getCookie("csrftoken")) {
    throw new Error("CSRF cookie missing after refresh");
  }
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

api.interceptors.request.use((config) => {
  const method = (config.method || "get").toLowerCase();
  if (!["get", "head", "options"].includes(method)) {
    const csrfToken = getCookie("csrftoken");
    if (csrfToken) {
      config.headers = config.headers || {};
      config.headers["X-CSRFToken"] = csrfToken;
    }
  }
  const token = localStorage.getItem("flowtime_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`; 
  }
  return config;
});

let isRefreshing = false;
let failedQueue: any[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error?.response?.status;
    const responseText = JSON.stringify(error?.response?.data ?? "").toLowerCase();

    const isAuthFailure =
      status === 401 ||
      (status === 403 &&
        !responseText.includes("csrf") &&
        (responseText.includes("authentication") ||
          responseText.includes("credentials") ||
          responseText.includes("not authenticated")));

    if (isAuthFailure && originalRequest && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers = originalRequest.headers || {};
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refresh = localStorage.getItem("flowtime_refresh");
      if (refresh) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/token/refresh/`, { refresh }, {
            withCredentials: true,
          });
          const newAccess = data.data.access;
          const newRefresh = data.data.refresh;
          localStorage.setItem("flowtime_token", newAccess);
          if (newRefresh) {
            localStorage.setItem("flowtime_refresh", newRefresh);
          }
          isRefreshing = false;
          processQueue(null, newAccess);
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${newAccess}`;
          return api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError, null);
          localStorage.removeItem("flowtime_token");
          localStorage.removeItem("flowtime_refresh");
          localStorage.removeItem("flowtime_is_admin");
          window.dispatchEvent(new Event("flowtime:logout"));
          return Promise.reject(refreshError);
        }
      } else {
        localStorage.removeItem("flowtime_token");
        localStorage.removeItem("flowtime_refresh");
        localStorage.removeItem("flowtime_is_admin");
        window.dispatchEvent(new Event("flowtime:logout"));
      }
    }
    return Promise.reject(error);
  }
);

export default api;
