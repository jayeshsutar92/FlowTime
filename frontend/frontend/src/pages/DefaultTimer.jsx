import Timer from "../components/timer";
import { useEffect, useState } from "react";
import {
  endSession,
  getApiErrorMessage,
  readDashboardCache,
  refreshDashboardSnapshot,
  startSession,
} from "../api";

const TOTAL_SESSIONS = 4;
const DEFAULT_SESSION_ID_KEY = "flowtime-default-session-id";
const DEFAULT_TIMER_STORAGE_KEY = "flowtime-default-timer";

const validateSessionPayload = (payload) => {
  const normalizedPayload = {
    work_duration: Number(payload.work_duration),
    break_duration: Number(payload.break_duration),
    total_sessions: Number(payload.total_sessions),
  };

  const hasInvalidValue = Object.values(normalizedPayload).some(
    (value) => Number.isNaN(value) || value <= 0
  );

  if (hasInvalidValue) {
    return {
      valid: false,
      message: "Invalid session data",
      payload: normalizedPayload,
    };
  }

  return {
    valid: true,
    payload: normalizedPayload,
  };
};

function DefaultTimer() {
  const [sessionId, setSessionId] = useState(() => window.localStorage.getItem(DEFAULT_SESSION_ID_KEY));
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [adaptiveBreak, setAdaptiveBreak] = useState(() => readDashboardCache()?.adaptiveBreak ?? null);

  useEffect(() => {
    if (!sessionId) {
      window.localStorage.removeItem(DEFAULT_SESSION_ID_KEY);
      return;
    }

    window.localStorage.setItem(DEFAULT_SESSION_ID_KEY, String(sessionId));
  }, [sessionId]);

  const handleStart = async (payload) => {
    if (isStartingSession) {
      return false;
    }

    setErrorMessage("");
    const validation = validateSessionPayload(payload);

    if (!validation.valid) {
      setStatusMessage("");
      setErrorMessage(validation.message);
      return false;
    }

    setIsStartingSession(true);
    setStatusMessage("Starting session...");
    console.log("start-session payload", validation.payload);

    try {
      const sessionData = await startSession(validation.payload);

      if (!sessionData?.session_id) {
        setStatusMessage("");
        setErrorMessage("Invalid session data");
        setSessionId(null);
        return false;
      }

      setSessionId(sessionData.session_id);
      setStatusMessage("Default session started.");
      return true;
    } catch (err) {
      console.error(err);
      setStatusMessage("");
      setSessionId(null);
      setErrorMessage(getApiErrorMessage(err, "Invalid session data"));
      return false;
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleComplete = async () => {
    if (!sessionId) {
      setStatusMessage("Session completed.");
      return;
    }

    try {
      await endSession({ session_id: sessionId });
      setStatusMessage("Session completed and saved.");
      setSessionId(null);

      try {
        const snapshot = await refreshDashboardSnapshot();
        setAdaptiveBreak(snapshot?.adaptiveBreak ?? null);
      } catch (refreshError) {
        console.error(refreshError);
      }
    } catch (err) {
      console.error(err);
      setErrorMessage("Session finished, but saving completion failed.");
    }
  };

  return (
    <section className="screen">
      <div className="card timer-screen-card">
        <h1 className="screen-title">Focus Time</h1>
        <Timer
          key={DEFAULT_TIMER_STORAGE_KEY}
          work={25}
          breakTime={5}
          totalSessions={TOTAL_SESSIONS}
          isStarting={isStartingSession}
          storageKey={DEFAULT_TIMER_STORAGE_KEY}
          onStart={handleStart}
          onComplete={handleComplete}
          statusMessage={statusMessage}
          errorMessage={errorMessage}
          adaptiveBreak={adaptiveBreak}
        />
      </div>
    </section>
  );
}

export default DefaultTimer;
