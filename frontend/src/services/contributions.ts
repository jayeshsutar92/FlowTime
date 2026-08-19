import api from "./api";

export interface DailyContribution {
  id: number;
  title: string;
  notes: string;
  scheduled_date: string;
  weight: "low" | "normal" | "high";
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  points: number;
}

export interface ContributionAnalytics {
  total: number;
  completed: number;
  completion_rate: number;
  total_points: number;
  current_streak: number;
  longest_streak: number;
  best_weekday: string | null;
}

export interface DailyContributionsSummary {
  date: string;
  total: number;
  completed: number;
  completion_rate: number;
  contributions: DailyContribution[];
}

const noCacheHeaders = { headers: { "Cache-Control": "no-cache", "Pragma": "no-cache", "Expires": "0" } };

export const getContributions = async () => {
  const { data } = await api.get("/contributions/", noCacheHeaders);
  return data.data as DailyContribution[];
};

export const getDailyContributions = async (date?: string) => {
  const query = date ? `?date=${date}` : "";
  const { data } = await api.get(`/contributions/daily/${query}`, noCacheHeaders);
  return data.data as DailyContributionsSummary;
};

export const getMonthlyContributions = async (year: number, month: number) => {
  const { data } = await api.get(`/contributions/monthly/?year=${year}&month=${month}`, noCacheHeaders);
  return data.data as DailyContribution[];
};

export const getContributionHeatmap = async (days: number = 365) => {
  const { data } = await api.get(`/contributions/heatmap/?days=${days}`, noCacheHeaders);
  return data.data as Record<string, number>;
};

export const getContributionAnalytics = async () => {
  const { data } = await api.get("/contributions/analytics/", noCacheHeaders);
  return data.data as ContributionAnalytics;
};

export const createContribution = async (payload: {
  title: string;
  notes?: string;
  scheduled_date: string;
  weight: "low" | "normal" | "high";
}) => {
  const { data } = await api.post("/contributions/", payload);
  return data.data as DailyContribution;
};

export const updateContribution = async (
  id: number,
  payload: Partial<{
    title: string;
    notes: string;
    scheduled_date: string;
    weight: "low" | "normal" | "high";
  }>
) => {
  const { data } = await api.patch(`/contributions/${id}/`, payload);
  return data.data as DailyContribution;
};

export const deleteContribution = async (id: number) => {
  const { data } = await api.delete(`/contributions/${id}/`);
  return data.data;
};

export const markContributionComplete = async (id: number) => {
  const { data } = await api.post(`/contributions/${id}/complete/`);
  return data.data as DailyContribution;
};

export const markContributionUncomplete = async (id: number) => {
  const { data } = await api.post(`/contributions/${id}/uncomplete/`);
  return data.data as DailyContribution;
};
