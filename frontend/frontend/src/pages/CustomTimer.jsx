import { useEffect, useMemo, useRef, useState } from "react";

import Timer from "../components/timer";
import {
  deletePreset,
  endSession,
  fetchPresets,
  getApiErrorMessage,
  readDashboardCache,
  refreshDashboardSnapshot,
  savePreset,
  startSession,
} from "../api";

const CUSTOM_SESSION_ID_KEY = "flowtime-custom-session-id";
const CUSTOM_TIMER_STORAGE_KEY = "flowtime-custom-timer";

const resolvePositiveInt = (value, fallback) => {
  const resolved = Number(value);

  if (Number.isNaN(resolved) || resolved <= 0) {
    return fallback;
  }

  return Math.floor(resolved);
};

const validateStartPayload = (payload) => {
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

const buildPresetBaseName = ({ work, breakTime, sessionsBeforeLongBreak, longBreakDuration }) =>
  `Focus ${work}m | Break ${breakTime}m | ${sessionsBeforeLongBreak} sessions | Long ${longBreakDuration}m`;

function CustomTimer() {
  const timerRef = useRef(null);

  const [workDuration, setWorkDuration] = useState("25");
  const [breakDuration, setBreakDuration] = useState("5");
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState("4");
  const [longBreakDuration, setLongBreakDuration] = useState("15");

  const [sessionId, setSessionId] = useState(() => window.localStorage.getItem(CUSTOM_SESSION_ID_KEY));
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isSavingPreset, setIsSavingPreset] = useState(false);
  const [presetsRefreshKey, setPresetsRefreshKey] = useState(0);
  const [presets, setPresets] = useState([]);
  const [isLoadingPresets, setIsLoadingPresets] = useState(true);
  const [presetsErrorMessage, setPresetsErrorMessage] = useState("");
  const [activePresetId, setActivePresetId] = useState(null);
  const [adaptiveBreak, setAdaptiveBreak] = useState(() => readDashboardCache()?.adaptiveBreak ?? null);
  const [shouldResetTimer, setShouldResetTimer] = useState(false);

  const resolvedConfig = useMemo(() => {
    const resolvedWork = resolvePositiveInt(workDuration, 25);
    const resolvedBreak = resolvePositiveInt(breakDuration, 5);
    const resolvedSessionsBeforeLongBreak = resolvePositiveInt(sessionsBeforeLongBreak, 4);
    const resolvedLongBreak = resolvePositiveInt(longBreakDuration, 15);

    return {
      work: resolvedWork,
      breakTime: resolvedBreak,
      sessionsBeforeLongBreak: resolvedSessionsBeforeLongBreak,
      longBreakDuration: resolvedLongBreak,
      totalSessions: resolvedSessionsBeforeLongBreak,
    };
  }, [breakDuration, longBreakDuration, sessionsBeforeLongBreak, workDuration]);

  useEffect(() => {
    if (!sessionId) {
      window.localStorage.removeItem(CUSTOM_SESSION_ID_KEY);
      return;
    }

    window.localStorage.setItem(CUSTOM_SESSION_ID_KEY, String(sessionId));
  }, [sessionId]);

  useEffect(() => {
    if (!shouldResetTimer) {
      return;
    }

    timerRef.current?.reset?.();
    setShouldResetTimer(false);
  }, [shouldResetTimer]);

  useEffect(() => {
    const loadPresets = async () => {
      setIsLoadingPresets(true);
      setPresetsErrorMessage("");

      try {
        const data = await fetchPresets();
        setPresets(data);
      } catch (err) {
        console.error(err);
        setPresetsErrorMessage("Could not load presets. Make sure the backend server is running.");
      } finally {
        setIsLoadingPresets(false);
      }
    };

    loadPresets();
  }, [presetsRefreshKey]);

  const handleStart = async (payload) => {
    if (isStartingSession) {
      return false;
    }

    setErrorMessage("");
    const validation = validateStartPayload(payload);

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
      setStatusMessage("Session started.");
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

  const handleSavePreset = async () => {
    if (isSavingPreset) {
      return;
    }

    setErrorMessage("");

    const resolvedWork = resolvedConfig.work;
    const resolvedBreak = resolvedConfig.breakTime;
    const resolvedLongBreak = resolvedConfig.longBreakDuration;
    const resolvedSessions = resolvedConfig.sessionsBeforeLongBreak;

    if ([resolvedWork, resolvedBreak, resolvedLongBreak, resolvedSessions].some((value) => value <= 0)) {
      setStatusMessage("");
      setErrorMessage("Invalid preset data");
      return;
    }

    const baseName = buildPresetBaseName({
      work: resolvedWork,
      breakTime: resolvedBreak,
      sessionsBeforeLongBreak: resolvedSessions,
      longBreakDuration: resolvedLongBreak,
    });

    setIsSavingPreset(true);
    setStatusMessage("Saving preset...");

    try {
      let lastError = null;

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const name = attempt === 0 ? baseName : `${baseName} (${attempt + 1})`;

        try {
          await savePreset({
            name,
            work_duration: resolvedWork,
            break_duration: resolvedBreak,
            long_break_duration: resolvedLongBreak,
            sessions_before_long_break: resolvedSessions,
          });

          setStatusMessage("Preset saved.");
          setPresetsRefreshKey((current) => current + 1);
          return;
        } catch (err) {
          lastError = err;
          const message = getApiErrorMessage(err, "Could not save preset");

          if (message.toLowerCase().includes("already exists") && attempt < 2) {
            continue;
          }

          throw err;
        }
      }

      throw lastError;
    } catch (err) {
      console.error(err);
      setStatusMessage("");
      setErrorMessage(getApiErrorMessage(err, "Could not save preset"));
    } finally {
      setIsSavingPreset(false);
    }
  };

  const handleStartFromBuilder = async () => {
    setErrorMessage("");
    setStatusMessage("");

    timerRef.current?.reset?.();
    await timerRef.current?.start?.();
  };

  const handleApplyPreset = (preset) => {
    setWorkDuration(String(resolvePositiveInt(preset.work, 25)));
    setBreakDuration(String(resolvePositiveInt(preset.breakTime, 5)));
    setSessionsBeforeLongBreak(String(resolvePositiveInt(preset.sessionsBeforeLongBreak, 4)));
    setLongBreakDuration(String(resolvePositiveInt(preset.longBreakDuration, 15)));

    setShouldResetTimer(true);
  };

  return (
    <section className="screen">
      <div className="card builder-card">
        <h1 className="screen-title">Build your session</h1>

        <div className="field-grid">
          <label className="field">
            <span>Work duration</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={workDuration}
              onChange={(event) => setWorkDuration(event.target.value)}
              disabled={isStartingSession}
            />
          </label>

          <label className="field">
            <span>Break duration</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={breakDuration}
              onChange={(event) => setBreakDuration(event.target.value)}
              disabled={isStartingSession}
            />
          </label>

          <label className="field">
            <span>Sessions before long break</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={sessionsBeforeLongBreak}
              onChange={(event) => setSessionsBeforeLongBreak(event.target.value)}
              disabled={isStartingSession}
            />
          </label>

          <label className="field">
            <span>Long break duration</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={longBreakDuration}
              onChange={(event) => setLongBreakDuration(event.target.value)}
              disabled={isStartingSession}
            />
          </label>
        </div>

        <div className="action-stack">
          <button
            type="button"
            className="action-button secondary-button"
            onClick={handleSavePreset}
            disabled={isSavingPreset}
          >
            {isSavingPreset ? "Saving..." : "Save Session / Save Preset"}
          </button>

          <button
            type="button"
            className="action-button primary-button"
            onClick={() => void handleStartFromBuilder()}
            disabled={isStartingSession}
          >
            Start Session
          </button>
        </div>
      </div>

      <div className="card timer-screen-card">
        <h2 className="screen-title">Focus Time</h2>
        <Timer
          ref={timerRef}
          key={CUSTOM_TIMER_STORAGE_KEY}
          work={resolvedConfig.work}
          breakTime={resolvedConfig.breakTime}
          longBreakDuration={resolvedConfig.longBreakDuration}
          sessionsBeforeLongBreak={resolvedConfig.sessionsBeforeLongBreak}
          totalSessions={resolvedConfig.totalSessions}
          isStarting={isStartingSession}
          storageKey={CUSTOM_TIMER_STORAGE_KEY}
          onStart={handleStart}
          onComplete={handleComplete}
          statusMessage={statusMessage}
          errorMessage={errorMessage}
          startLabel="Start Session"
          adaptiveBreak={adaptiveBreak}
        />
      </div>

      <div className="card presets-card">
        <div className="field-grid">
          <h2 className="section-title">Quick Apply</h2>

          {isLoadingPresets ? <p className="feedback-message">Loading presets...</p> : null}
          {presetsErrorMessage ? (
            <p className="feedback-message error-message" role="alert">
              {presetsErrorMessage}
            </p>
          ) : null}
          {!isLoadingPresets && !presetsErrorMessage && presets.length === 0 ? (
            <p className="feedback-message">No presets saved yet.</p>
          ) : null}

          <div className="field-grid">
            {presets.map((preset) => {
              const resolvedLongBreak = Number(
                preset.long_break_duration ?? preset.long_break ?? preset.longBreakDuration ?? 15
              );
              const resolvedSessions = Number(
                preset.sessions_before_long_break ??
                  preset.sessionsBeforeLongBreak ??
                  preset.total_sessions ??
                  4
              );

              return (
                <article key={preset.id} className="score-panel">
                  <div>
                    <p className="section-title">{preset.name}</p>
                    <p className="score-caption">
                      {preset.work_duration} min focus | {preset.short_break ?? preset.break_duration} min break | {resolvedLongBreak} min long break
                    </p>
                  </div>

                  <div className="action-stack">
                    <button
                      type="button"
                      className="action-button secondary-button"
                      onClick={() =>
                        handleApplyPreset({
                          work: Number(preset.work_duration),
                          breakTime: Number(preset.short_break ?? preset.break_duration),
                          longBreakDuration: resolvedLongBreak,
                          sessionsBeforeLongBreak: resolvedSessions,
                        })
                      }
                    >
                      Use
                    </button>
                    <button
                      type="button"
                      className="action-button secondary-button"
                      onClick={async () => {
                        setActivePresetId(preset.id);
                        setPresetsErrorMessage("");

                        try {
                          await deletePreset(preset.id);
                          setPresets((currentPresets) =>
                            currentPresets.filter((item) => item.id !== preset.id)
                          );
                        } catch (err) {
                          console.error(err);
                          setPresetsErrorMessage("Could not delete preset.");
                        } finally {
                          setActivePresetId(null);
                        }
                      }}
                      disabled={activePresetId === preset.id}
                    >
                      {activePresetId === preset.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default CustomTimer;
