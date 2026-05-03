import axios from "axios";

const apiClient = axios.create({
  baseURL: "http://127.0.0.1:8000/api/",
  headers: {
    "Content-Type": "application/json",
  },
});

const DASHBOARD_CACHE_KEY = "flowtime-dashboard-cache";
const DASHBOARD_REFRESH_EVENT = "flowtime-dashboard-refresh";

const requestVariants = async (variants) => {
  let lastError = null;

  for (const variant of variants) {
    try {
      const response = await variant();
      return response.data;
    } catch (error) {
      lastError = error;

      if (!isRetriableDeleteError(error)) {
        break;
      }
    }
  }

  throw lastError;
};

const normalizePresets = (data) => {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.data)) {
    return data.data;
  }

  if (Array.isArray(data?.presets)) {
    return data.presets;
  }

  if (Array.isArray(data?.results)) {
    return data.results;
  }

  return [];
};

const unwrapApiData = (payload) => payload?.data ?? payload ?? null;

const sanitizeSessionPayload = (payload) => {
  const numericFields = new Set([
    "work_duration",
    "break_duration",
    "total_sessions",
    "long_break_duration",
    "sessions_before_long_break",
  ]);

  return Object.entries(payload).reduce((sanitizedPayload, [key, value]) => {
    if (value === undefined || value === null || value === "") {
      return sanitizedPayload;
    }

    const normalizedValue = numericFields.has(key) ? Number(value) : value;

    if (numericFields.has(key) && Number.isNaN(normalizedValue)) {
      return sanitizedPayload;
    }

    return {
      ...sanitizedPayload,
      [key]: normalizedValue,
    };
  }, {});
};

const extractAdaptiveBreak = (...sources) => {
  for (const source of sources) {
    const breakDuration = source?.break_duration;
    const breakType = source?.break_type;

    if (breakDuration !== undefined || breakType !== undefined) {
      return {
        break_duration: breakDuration,
        break_type: breakType,
      };
    }
  }

  return null;
};

const readDashboardCache = () => {
  try {
    const cachedValue = window.localStorage.getItem(DASHBOARD_CACHE_KEY);

    if (!cachedValue) {
      return null;
    }

    return JSON.parse(cachedValue);
  } catch (error) {
    console.error(error);
    return null;
  }
};

const saveDashboardCache = (snapshot) => {
  window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(snapshot));
};

const broadcastDashboardRefresh = (snapshot) => {
  window.dispatchEvent(
    new CustomEvent(DASHBOARD_REFRESH_EVENT, {
      detail: snapshot,
    })
  );
};

const isRetriableDeleteError = (error) => {
  const status = error?.response?.status;
  return status === 404 || status === 405;
};

export const getApiErrorMessage = (error, fallbackMessage) => {
  const responseData = error?.response?.data;

  if (typeof responseData === "string" && responseData.trim()) {
    return responseData;
  }

  if (typeof responseData?.detail === "string" && responseData.detail.trim()) {
    return responseData.detail;
  }

  if (typeof responseData?.message === "string" && responseData.message.trim()) {
    return responseData.message;
  }

  if (Array.isArray(responseData?.non_field_errors) && responseData.non_field_errors[0]) {
    return responseData.non_field_errors[0];
  }

  if (responseData && typeof responseData === "object") {
    const firstFieldError = Object.values(responseData).find((value) =>
      Array.isArray(value) ? value[0] : typeof value === "string"
    );

    if (Array.isArray(firstFieldError) && firstFieldError[0]) {
      return firstFieldError[0];
    }

    if (typeof firstFieldError === "string" && firstFieldError.trim()) {
      return firstFieldError;
    }
  }

  return fallbackMessage;
};

export const loginWithPassword = async (payload) => {
  const response = await apiClient.post("login/", payload);
  return unwrapApiData(response.data);
};

export const loginWithOtp = async (payload) => {
  const response = await apiClient.post("login/", payload);
  return unwrapApiData(response.data);
};

export const signupUser = async (payload) => {
  const response = await apiClient.post("signup/", payload);
  return unwrapApiData(response.data);
};

export const requestForgotPassword = async (payload) => {
  const response = await apiClient.post("forgot-password/", payload);
  return unwrapApiData(response.data);
};

export const resetPassword = async (payload) => {
  const response = await apiClient.post("reset-password/", payload);
  return unwrapApiData(response.data);
};

export const startSession = async (payload) => {
  const requestBody = sanitizeSessionPayload(payload);
  const response = await apiClient.post("start-session/", JSON.stringify(requestBody), {
    headers: {
      "Content-Type": "application/json",
    },
  });
  console.log("start-session response", response.data);
  return unwrapApiData(response.data);
};

export const endSession = async (payload) => {
  const response = await apiClient.post("end-session/", payload);
  return response.data;
};

export const fetchStats = async () => {
  const response = await apiClient.get("stats/");
  return unwrapApiData(response.data);
};

export const fetchInsights = async () => {
  const data = await requestVariants([
    () => apiClient.get("insights/"),
    () => apiClient.get("focus-insights/"),
    () => apiClient.get("productivity-insights/"),
  ]);

  return unwrapApiData(data);
};

export const fetchProductivityScore = async () => {
  const data = await requestVariants([
    () => apiClient.get("productivity-score/"),
    () => apiClient.get("score/"),
    () => apiClient.get("productivity/score/"),
  ]);

  return unwrapApiData(data);
};

export const refreshDashboardSnapshot = async () => {
  const [statsResult, insightsResult, scoreResult] = await Promise.allSettled([
    fetchStats(),
    fetchInsights(),
    fetchProductivityScore(),
  ]);

  const stats = statsResult.status === "fulfilled" ? statsResult.value : null;
  const insights = insightsResult.status === "fulfilled" ? insightsResult.value : null;
  const score = scoreResult.status === "fulfilled" ? scoreResult.value : null;

  if (!stats && !insights && !score) {
    throw statsResult.reason ?? insightsResult.reason ?? scoreResult.reason;
  }

  const snapshot = {
    stats,
    insights,
    score,
    adaptiveBreak: extractAdaptiveBreak(stats, insights, score),
    updatedAt: Date.now(),
  };

  saveDashboardCache(snapshot);
  broadcastDashboardRefresh(snapshot);

  return snapshot;
};

export { DASHBOARD_REFRESH_EVENT, readDashboardCache };

export const fetchPresets = async () => {
  const response = await apiClient.get("presets/");
  console.log("presets response", response.data);
  return normalizePresets(response.data);
};

export const savePreset = async (payload) => {
  const response = await apiClient.post("save-preset/", payload);
  return response.data;
};

export const deletePreset = async (presetId) => {
  const data = await requestVariants([
    () => apiClient.delete(`delete-preset/${presetId}/`),
    () => apiClient.delete(`presets/${presetId}/`),
    () => apiClient.delete("delete-preset/", { data: { id: presetId } }),
    () => apiClient.post("delete-preset/", { id: presetId }),
  ]);

  return data;
};

export default apiClient;
