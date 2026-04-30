import { useEffect, useState } from "react";
import StatCard from "../components/StatCard";
import {
  DASHBOARD_REFRESH_EVENT,
  readDashboardCache,
  refreshDashboardSnapshot,
} from "../api";

const EMPTY_HEATMAP = [0, 0, 0, 0, 0, 0, 0];
const HEATMAP_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getDisplayValue = (value) => {
  if (value === null || value === undefined || value === "") {
    return "No data";
  }

  return value;
};

const getSummaryValue = (value, fallback = "-") => {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return value;
};

const formatAverageFocusTime = (value) => {
  if (value === null || value === undefined || value === "") {
    return "No data";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return value;
  }

  return numericValue.toFixed(numericValue % 1 === 0 ? 1 : 2);
};

const formatCompletionRate = (value) => {
  if (value === null || value === undefined || value === "") {
    return "No data";
  }

  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return value;
  }

  return `${(numericValue * 100).toFixed(1)}%`;
};

const getScoreLevel = (score) => {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return {
      label: "No data",
      className: "score-empty",
    };
  }

  const numericScore = Number(score);

  if (numericScore < 40) {
    return {
      label: "Low",
      className: "score-low",
    };
  }

  if (numericScore <= 70) {
    return {
      label: "Moderate",
      className: "score-moderate",
    };
  }

  return {
    label: "High",
    className: "score-high",
  };
};

function Dashboard() {
  const [dashboardSnapshot, setDashboardSnapshot] = useState(() => readDashboardCache());
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const snapshot = await refreshDashboardSnapshot();
        setDashboardSnapshot(snapshot);
      } catch (err) {
        console.error(err);
        setErrorMessage("Could not load dashboard stats.");
      } finally {
        setIsLoading(false);
      }
    };

    const handleDashboardRefresh = (event) => {
      setDashboardSnapshot(event.detail ?? readDashboardCache());
    };

    window.addEventListener(DASHBOARD_REFRESH_EVENT, handleDashboardRefresh);
    loadDashboard();

    return () => {
      window.removeEventListener(DASHBOARD_REFRESH_EVENT, handleDashboardRefresh);
    };
  }, []);

  const stats = dashboardSnapshot?.stats ?? {};
  const insights = dashboardSnapshot?.insights ?? {};
  const scoreData = dashboardSnapshot?.score ?? {};
  const productivityScore = scoreData.productivity_score ?? scoreData.score ?? null;
  const scoreMeta = getScoreLevel(productivityScore);
  const heatmapData = Array.isArray(insights.last_7_days) ? insights.last_7_days : EMPTY_HEATMAP;
  const recommendation =
    insights.recommendation ?? insights.recommendation_text ?? scoreData.recommendation ?? null;

  return (
    <section className="screen">
      <div className="card dashboard-card">
        <h1 className="screen-title">Dashboard</h1>

        {isLoading ? <p className="feedback-message">Loading dashboard...</p> : null}
        {errorMessage ? (
          <p className="feedback-message error-message" role="alert">
            {errorMessage}
          </p>
        ) : null}

        <div className="stats-grid">
          <StatCard label="Total focus time" value={getSummaryValue(stats.total_focus_time)} />
          <StatCard
            label="Total sessions"
            value={getSummaryValue(stats.total_completed_sessions ?? stats.completed_sessions)}
          />
        </div>

        <section className={`score-panel ${scoreMeta.className}`}>
          <p className="section-title">Productivity Score</p>
          <strong className="score-value">{getDisplayValue(productivityScore)}</strong>
          <p className="score-level">{scoreMeta.label}</p>
          <p className="score-caption">Based on your recent sessions</p>
        </section>

        <section className="insights-panel">
          <div className="section-heading">
            <h2 className="section-title">Focus Insights</h2>
          </div>

          <div className="insights-grid">
            <article className="insight-card">
              <p className="insight-label">Avg Focus Time</p>
              <strong className="insight-value">
                {formatAverageFocusTime(insights.avg_session_length)}
              </strong>
            </article>

            <article className="insight-card">
              <p className="insight-label">Completion Rate</p>
              <strong className="insight-value">
                {formatCompletionRate(insights.completion_rate)}
              </strong>
            </article>

            <article className="insight-card">
              <p className="insight-label">Best Time Slot</p>
              <strong className="insight-value">{getDisplayValue(insights.best_focus_time)}</strong>
            </article>

            <article className="insight-card recommendation-card">
              <p className="insight-label">Recommendation</p>
              <strong className="insight-value">{getDisplayValue(recommendation)}</strong>
            </article>
          </div>
        </section>

        <section className="heatmap-panel">
          <div className="section-heading">
            <h2 className="section-title">Session Heatmap</h2>
          </div>

          <div className="heatmap-grid">
            {heatmapData.map((value, index) => (
              <div key={`${HEATMAP_LABELS[index]}-${index}`} className="heatmap-item">
                <div
                  className={`heatmap-bar ${value > 0 ? "heatmap-active" : "heatmap-empty"}`}
                  style={{ "--activity": Number(value) || 0 }}
                  title={`${value ?? 0} sessions`}
                />
                <span className="heatmap-label">{HEATMAP_LABELS[index] ?? `Day ${index + 1}`}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}

export default Dashboard;
