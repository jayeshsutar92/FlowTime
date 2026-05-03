import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import alarmSound from "../assets/alarm.wav";
import useTimerStateContext from "../context/useTimerStateContext";

const Timer = forwardRef(function Timer({
  work = 25,
  breakTime = 5,
  longBreakDuration = breakTime,
  sessionsBeforeLongBreak = 4,
  onStart,
  onComplete,
  statusMessage,
  errorMessage,
  totalSessions = 4,
  isStarting = false,
  storageKey,
  startLabel = "Start",
  buildStartPayload,
  repeatCycles = false,
  adaptiveBreak = null,
}, ref) {
  const { getTimerState, updateTimerState } = useTimerStateContext();
  const fallbackState = useMemo(
    () => ({
      time: work * 60,
      isRunning: false,
      mode: "work",
      currentSession: 1,
      hasStartedCurrentSession: false,
      sessionsBeforeLongBreak,
      longBreakDuration,
      isLongBreak: false,
      timerNotice: "Ready to start.",
    }),
    [longBreakDuration, sessionsBeforeLongBreak, work]
  );
  const timerState = getTimerState(storageKey, fallbackState);
  const {
    time,
    isRunning,
    mode,
    currentSession,
    hasStartedCurrentSession,
    isLongBreak,
    timerNotice,
  } = timerState;
  const audioRef = useRef(null);
  const resolvedSessionsBeforeLongBreak = Math.max(1, Number(sessionsBeforeLongBreak) || 1);
  const resolvedLongBreakDuration = Math.max(1, Number(longBreakDuration) || breakTime);
  const adaptiveBreakDuration = Number(adaptiveBreak?.break_duration);
  const adaptiveBreakType = String(adaptiveBreak?.break_type ?? "").toLowerCase();
  const hasAdaptiveBreakDuration = !Number.isNaN(adaptiveBreakDuration) && adaptiveBreakDuration > 0;
  const effectiveBreakTime =
    hasAdaptiveBreakDuration && adaptiveBreakType !== "long" ? adaptiveBreakDuration : breakTime;
  const effectiveLongBreakDuration =
    hasAdaptiveBreakDuration && adaptiveBreakType === "long"
      ? adaptiveBreakDuration
      : resolvedLongBreakDuration;

  const patchTimerState = useCallback(
    (updater) => {
      updateTimerState(storageKey, updater, fallbackState);
    },
    [fallbackState, storageKey, updateTimerState]
  );

  const getStartPayload = useCallback(
    () =>
      buildStartPayload?.({
        work,
        breakTime: effectiveBreakTime,
        totalSessions,
        longBreakDuration: effectiveLongBreakDuration,
        sessionsBeforeLongBreak: resolvedSessionsBeforeLongBreak,
      }) ?? {
        work_duration: work,
        break_duration: effectiveBreakTime,
        total_sessions: totalSessions,
      },
    [
      buildStartPayload,
      effectiveBreakTime,
      effectiveLongBreakDuration,
      resolvedSessionsBeforeLongBreak,
      totalSessions,
      work,
    ]
  );

  const startTimer = useCallback(async () => {
    if (isRunning || isStarting) {
      return;
    }

    if (mode === "work" && !hasStartedCurrentSession) {
      const shouldStart = await onStart?.(getStartPayload());

      if (shouldStart === false) {
        return;
      }

      patchTimerState((current) => ({
        ...current,
        hasStartedCurrentSession: true,
      }));
    }

    patchTimerState((current) => ({
      ...current,
      timerNotice: mode === "break" ? "Break Time" : "Focus Time",
      isRunning: true,
    }));
  }, [
    getStartPayload,
    hasStartedCurrentSession,
    isRunning,
    isStarting,
    mode,
    onStart,
    patchTimerState,
  ]);

  const pauseTimer = useCallback(
    () =>
      patchTimerState((current) => ({
        ...current,
        isRunning: false,
      })),
    [patchTimerState]
  );

  const resetTimer = useCallback(() => {
    patchTimerState({
      ...fallbackState,
      time: work * 60,
    });
  }, [fallbackState, patchTimerState, work]);

  const playAlarm = useCallback(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {});
  }, []);

  const handlePhaseComplete = useCallback(async () => {
    playAlarm();

    if (mode === "work") {
      await onComplete?.();

      if (!repeatCycles && currentSession >= totalSessions) {
        patchTimerState((current) => ({
          ...current,
          timerNotice: "All sessions completed.",
          hasStartedCurrentSession: false,
        }));
        return;
      }

      const shouldUseLongBreak = currentSession % resolvedSessionsBeforeLongBreak === 0;
      const nextBreakDuration = shouldUseLongBreak ? effectiveLongBreakDuration : effectiveBreakTime;
      const nextNotice = shouldUseLongBreak ? "Long Break Time" : "Break Time";

      patchTimerState((current) => ({
        ...current,
        mode: "break",
        time: nextBreakDuration * 60,
        hasStartedCurrentSession: false,
        isLongBreak: shouldUseLongBreak,
        timerNotice: nextNotice,
        isRunning: true,
      }));
      return;
    }

    const nextSession = isLongBreak
      ? 1
      : Math.min(currentSession + 1, resolvedSessionsBeforeLongBreak);
    const shouldStart = await onStart?.(getStartPayload());

    if (shouldStart === false) {
      patchTimerState((current) => ({
        ...current,
        currentSession: nextSession,
        mode: "work",
        time: work * 60,
        hasStartedCurrentSession: false,
        isLongBreak: false,
        timerNotice: `Session ${nextSession} ready.`,
      }));
      return;
    }

    patchTimerState((current) => ({
      ...current,
      currentSession: nextSession,
      mode: "work",
      time: work * 60,
      hasStartedCurrentSession: true,
      isLongBreak: false,
      timerNotice: "Focus Time",
      isRunning: true,
    }));
  }, [
    currentSession,
    effectiveBreakTime,
    effectiveLongBreakDuration,
    getStartPayload,
    isLongBreak,
    mode,
    onComplete,
    onStart,
    patchTimerState,
    playAlarm,
    repeatCycles,
    resolvedSessionsBeforeLongBreak,
    totalSessions,
    work,
  ]);

  useEffect(() => {
    if (!isRunning) {
      return undefined;
    }

    const interval = setInterval(() => {
      patchTimerState((current) => {
        const previousTime = current.time;

        if (previousTime <= 1) {
          clearInterval(interval);
          void handlePhaseComplete();
          return {
            ...current,
            isRunning: false,
            time: 0,
          };
        }

        return {
          ...current,
          time: previousTime - 1,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [handlePhaseComplete, isRunning, patchTimerState]);

  useImperativeHandle(
    ref,
    () => ({
      start: startTimer,
      pause: pauseTimer,
      reset: resetTimer,
    }),
    [pauseTimer, resetTimer, startTimer]
  );

  const minutes = Math.floor(time / 60);
  const seconds = time % 60;
  const isUpcomingLongBreak = currentSession % resolvedSessionsBeforeLongBreak === 0;
  const activeBreakDuration = isLongBreak ? effectiveLongBreakDuration : effectiveBreakTime;
  const breakSummaryLabel = isLongBreak
    ? `Long Break ${effectiveLongBreakDuration} min`
    : `Break ${activeBreakDuration} min`;
  const timerSummary =
    mode === "work"
      ? `Work ${work} min | ${
          isUpcomingLongBreak
            ? `Long Break ${effectiveLongBreakDuration} min`
            : `Break ${effectiveBreakTime} min`
        }`
      : breakSummaryLabel;
  const phaseLabel =
    mode === "break" ? (isLongBreak ? "Long Break Time" : "Break Time") : "Focus Time";
  const progressWidth = `${(currentSession / resolvedSessionsBeforeLongBreak) * 100}%`;

  return (
    <section className="timer-panel">
      <div className="timer-meta">
        <p className={`mode-badge ${mode === "break" ? "break-badge" : "work-badge"}`}>
          {phaseLabel}
        </p>
        <p className="session-count">
          Session {currentSession} / {resolvedSessionsBeforeLongBreak}
        </p>
        <div className="session-progress" aria-hidden="true">
          <span className="session-progress-fill" style={{ width: progressWidth }} />
        </div>
        <p className="timer-config">{timerSummary}</p>
        {hasAdaptiveBreakDuration ? (
          <p
            className="timer-hint"
            title="Break length adapts to your consistency"
          >
            Break adjusted based on your recent performance
          </p>
        ) : null}
      </div>

      <div className="timer-display" aria-live="polite">
        {String(minutes).padStart(2, "0")}:{String(seconds).padStart(2, "0")}
      </div>

      <div className="button-row">
        <button
          type="button"
          className="action-button primary-button"
          onClick={startTimer}
          disabled={isStarting}
        >
          {isStarting ? "Starting..." : startLabel}
        </button>
        <button type="button" className="action-button secondary-button" onClick={pauseTimer}>
          Pause
        </button>
        <button type="button" className="action-button secondary-button" onClick={resetTimer}>
          Reset
        </button>
      </div>

      <p className="status-text">{timerNotice}</p>
      {statusMessage ? <p className="status-text">{statusMessage}</p> : null}
      {errorMessage ? (
        <p className="feedback-message error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}
      <audio ref={audioRef} src={alarmSound} preload="auto" />
    </section>
  );
});

export default Timer;
