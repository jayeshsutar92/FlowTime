import { useEffect, useRef, useState } from "react";
import Timer from "../components/timer";
import {
  savePreset,
  endSession,
  getApiErrorMessage,
  readDashboardCache,
  refreshDashboardSnapshot,
  startSession,
} from "../api";
import MusicPlayer from "../components/MusicPlayer";
import Presets from "../components/Presets";

const CUSTOM_TIMER_SETTINGS_KEY = "flowtime-custom-settings";
const CUSTOM_SESSION_ID_KEY = "flowtime-custom-session-id";

const readSavedSettings = () => {
  const serializedSettings = window.localStorage.getItem(CUSTOM_TIMER_SETTINGS_KEY);

  if (!serializedSettings) {
    return null;
  }

  try {
    return JSON.parse(serializedSettings);
  } catch (error) {
    console.error(error);
    return null;
  }
};

const validateSessionPayload = (payload) => {
  const normalizedPayload = {
    work_duration: Number(payload.work_duration),
    break_duration: Number(payload.break_duration),
    total_sessions: Number(payload.total_sessions),
    long_break_duration: Number(payload.long_break_duration),
    sessions_before_long_break: Number(payload.sessions_before_long_break),
  };

  const hasInvalidValue = Object.values(normalizedPayload).some(
    (value) => Number.isNaN(value) || value <= 0
  );

  if (hasInvalidValue) {
    return {
      valid: false,
      message: "Enter valid session values greater than 0.",
      payload: normalizedPayload,
    };
  }

  return {
    valid: true,
    payload: normalizedPayload,
  };
};

function CustomTimer() {
  const savedSettings = readSavedSettings();
  const [work, setWork] = useState(() => savedSettings?.work ?? 25);
  const [breakTime, setBreakTime] = useState(() => savedSettings?.breakTime ?? 5);
  const [longBreakDuration, setLongBreakDuration] = useState(
    () => savedSettings?.longBreakDuration ?? 15
  );
  const [sessionsBeforeLongBreak, setSessionsBeforeLongBreak] = useState(
    () => savedSettings?.sessionsBeforeLongBreak ?? 4
  );
  const [sessionId, setSessionId] = useState(() => window.localStorage.getItem(CUSTOM_SESSION_ID_KEY));
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [presetRefreshKey, setPresetRefreshKey] = useState(0);
  const [adaptiveBreak, setAdaptiveBreak] = useState(() => readDashboardCache()?.adaptiveBreak ?? null);
  const timerStorageKey = `flowtime-custom-timer-${work}-${breakTime}-${longBreakDuration}-${sessionsBeforeLongBreak}`;
  const timerControlsRef = useRef(null);

  const handleNumberChange = (setter) => (event) => {
    setter(event.target.value === "" ? "" : Number(event.target.value));
  };

  useEffect(() => {
    window.localStorage.setItem(
      CUSTOM_TIMER_SETTINGS_KEY,
      JSON.stringify({
        work,
        breakTime,
        longBreakDuration,
        sessionsBeforeLongBreak,
      })
    );
  }, [breakTime, longBreakDuration, sessionsBeforeLongBreak, work]);

  useEffect(() => {
    if (!sessionId) {
      window.localStorage.removeItem(CUSTOM_SESSION_ID_KEY);
      return;
    }

    window.localStorage.setItem(CUSTOM_SESSION_ID_KEY, String(sessionId));
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
      setErrorMessage("Session ended locally, but saving completion failed.");
    }
  };

  const handleApplyPreset = ({
    work,
    breakTime,
    longBreakDuration = 15,
    sessionsBeforeLongBreak = 4,
  }) => {
    setWork(Number(work));
    setBreakTime(Number(breakTime));
    setLongBreakDuration(Number(longBreakDuration));
    setSessionsBeforeLongBreak(Number(sessionsBeforeLongBreak));
    setStatusMessage("Preset applied.");
    setErrorMessage("");
    setPresetRefreshKey((current) => current + 1);
  };

  const handleSavePreset = async () => {
    const payload = {
      name: `Preset ${work}-${breakTime}-${longBreakDuration}-${sessionsBeforeLongBreak}`,
      work_duration: Number(work),
      short_break: Number(breakTime),
      long_break_duration: Number(longBreakDuration),
      sessions_before_long_break: Number(sessionsBeforeLongBreak),
    };

    try {
      await savePreset(payload);
      setStatusMessage("Preset saved.");
      setErrorMessage("");
      setPresetRefreshKey((current) => current + 1);
    } catch (err) {
      console.error(err);
      setErrorMessage(getApiErrorMessage(err, "Could not save preset."));
    }
  };

  return (
    <section className="screen">
      <div className="max-w-xl mx-auto px-4 flex flex-col gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 flex flex-col w-full space-y-4">
          <h1 className="screen-title w-full">Build your session</h1>

          <div className="field-grid w-full">
            <label className="field w-full">
              <span>Work duration (minutes)</span>
              <input
                type="number"
                min="1"
                value={work}
                onChange={handleNumberChange(setWork)}
                className="w-full"
              />
            </label>

            <label className="field w-full">
              <span>Break duration (minutes)</span>
              <input
                type="number"
                min="1"
                value={breakTime}
                onChange={handleNumberChange(setBreakTime)}
                className="w-full"
              />
            </label>

            <label className="field w-full">
              <span>Long break duration (minutes)</span>
              <input
                type="number"
                min="1"
                value={longBreakDuration}
                onChange={handleNumberChange(setLongBreakDuration)}
                className="w-full"
              />
            </label>

            <label className="field w-full">
              <span>Sessions before long break</span>
              <input
                type="number"
                min="1"
                value={sessionsBeforeLongBreak}
                onChange={handleNumberChange(setSessionsBeforeLongBreak)}
                className="w-full"
              />
            </label>
          </div>

          <div className="custom-builder-actions w-full">
            <button
              type="button"
              className="action-button secondary-button w-full"
              onClick={handleSavePreset}
            >
              Save Preset
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 flex flex-col w-full space-y-4 items-center justify-center">
          <h1 className="screen-title w-full text-center">Focus Time</h1>
          <div className="w-full">
            <Timer
              ref={timerControlsRef}
              key={timerStorageKey}
              work={work}
              breakTime={breakTime}
              longBreakDuration={longBreakDuration}
              sessionsBeforeLongBreak={sessionsBeforeLongBreak}
              totalSessions={sessionsBeforeLongBreak}
              isStarting={isStartingSession}
              storageKey={timerStorageKey}
              onStart={handleStart}
              onComplete={handleComplete}
              statusMessage={statusMessage}
              errorMessage={errorMessage}
              startLabel="Start"
              repeatCycles
              adaptiveBreak={adaptiveBreak}
              buildStartPayload={({
                work,
                breakTime,
                totalSessions,
                longBreakDuration,
                sessionsBeforeLongBreak,
              }) => ({
                work_duration: Number(work),
                break_duration: Number(breakTime),
                total_sessions: Number(totalSessions),
                long_break_duration: Number(longBreakDuration),
                sessions_before_long_break: Number(sessionsBeforeLongBreak),
              })}
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 flex flex-col w-full space-y-4">
          <Presets onApplyPreset={handleApplyPreset} refreshKey={presetRefreshKey} />
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-md p-6 flex flex-col w-full space-y-4">
          <MusicPlayer />
        </div>
      </div>
    </section>
  );
}

export default CustomTimer;
