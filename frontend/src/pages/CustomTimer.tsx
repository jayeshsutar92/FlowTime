import { useState, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import api from "../services/api";
import { playWorkCompleteSound, playBreakCompleteSound } from "../lib/sounds";
import { Play, Pause, RefreshCw, SkipForward, AlertCircle, Sparkles, Zap, Trash2, CheckCircle2, TrendingUp, History, Timer as TimerIcon } from "lucide-react";
import { cn } from "../lib/utils";

type Preset = {
  id: number;
  name: string;
  work_duration: number;
  short_break: number;
  long_break: number;
};

type SessionState = "idle" | "work" | "break";

export default function CustomTimer() {
  const [baseWorkDuration, setBaseWorkDuration] = useState(() => {
    const saved = localStorage.getItem("flowtime_custom_base_work_duration");
    return saved ? Number(saved) : 25;
  });
  const [baseBreakDuration, setBaseBreakDuration] = useState(() => {
    const saved = localStorage.getItem("flowtime_custom_base_break_duration");
    return saved ? Number(saved) : 5;
  });
  const [baseTotalSessions, setBaseTotalSessions] = useState(() => {
    const saved = localStorage.getItem("flowtime_custom_base_total_sessions");
    return saved ? Number(saved) : 4;
  });
  const [baseLongBreak, setBaseLongBreak] = useState(() => {
    const saved = localStorage.getItem("flowtime_custom_base_long_break");
    return saved ? Number(saved) : 15;
  });

  const [workDuration, setWorkDuration] = useState(baseWorkDuration);
  const [breakDuration, setBreakDuration] = useState(baseBreakDuration);
  const [totalSessions, setTotalSessions] = useState(baseTotalSessions);
  const [longBreak, setLongBreak] = useState(baseLongBreak);
  const [currentSession, setCurrentSession] = useState(1);

  const [sessionState, setSessionState] = useState<SessionState>("idle");
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(workDuration * 60);
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [sessionStartAt, setSessionStartAt] = useState<number | null>(null);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const [breakStartAt, setBreakStartAt] = useState<number | null>(null);
  const [breakDurationSeconds, setBreakDurationSeconds] = useState<number | null>(null);

  const [presets, setPresets] = useState<Preset[]>([]);
  const [adjustmentMessage, setAdjustmentMessage] = useState<string | null>(null);

  // Stats for the "daily flow"
  const [stats, setStats] = useState({ flow: "0h", score: "0%", streak: "0d" });

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const breakSoundPlayedRef = useRef(false);
  const BREAK_STORAGE_KEY = "flowtime_custom_break_state";

  const blocker = useBlocker(
    ({ currentValue, nextLocation }) =>
      isActive && sessionState !== "idle" && currentValue.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isActive && sessionState !== "idle") {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isActive, sessionState]);

  const handlePauseAndLeave = async () => {
    if (isActive) {
      await togglePause();
    }
    blocker.proceed?.();
  };

  const handleEndAndLeave = async () => {
    if (sessionState === "work" && sessionId) {
      try {
        await api.post("/end-session/", { session_id: sessionId, completed: false });
      } catch (e) {}
    }
    setSessionState("idle");
    setIsActive(false);
    setCurrentSession(1);
    setWorkDuration(baseWorkDuration);
    setTimeLeft(baseWorkDuration * 60);
    setBreakStartAt(null);
    setBreakDurationSeconds(null);
    clearBreakState();
    localStorage.removeItem("flowtime_active_timer_type");
    blocker.proceed?.();
  };

  const computeRemainingSeconds = (
    startAtMs: number,
    durationSeconds: number,
    pausedSecondsValue: number,
    pausedAtMs?: number | null
  ) => {
    const effectiveNow = pausedAtMs ?? Date.now();
    const elapsedSeconds = Math.max(
      0,
      Math.floor((effectiveNow - startAtMs) / 1000) - pausedSecondsValue
    );
    return Math.max(0, durationSeconds - elapsedSeconds);
  };

  const saveBreakState = (state: {
    breakStartAt: number;
    breakDurationSeconds: number;
    currentSession: number;
    totalSessions: number;
    workDuration: number;
    breakDuration: number;
    longBreak: number;
  }) => {
    localStorage.setItem(BREAK_STORAGE_KEY, JSON.stringify(state));
  };

  const loadBreakState = () => {
    try {
      const raw = localStorage.getItem(BREAK_STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const clearBreakState = () => {
    localStorage.removeItem(BREAK_STORAGE_KEY);
  };

  useEffect(() => {
    fetchPresets();
    fetchStats();

    api.get("/sessions/").then((res) => {
      const running = res.data.data.find((s: any) => s.status === "running" && s.timer_type === "custom");
      const paused = res.data.data.find((s: any) => s.status === "paused" && s.timer_type === "custom");
      const activeSession = running || paused;

      if (activeSession) {
        const startAtMs = new Date(activeSession.created_at).getTime();
        const pausedAtMs = activeSession.paused_at ? new Date(activeSession.paused_at).getTime() : null;
        const pausedSecondsValue = activeSession.paused_seconds || 0;
        const durationSeconds = activeSession.work_duration * 60;
        const remaining = computeRemainingSeconds(
          startAtMs,
          durationSeconds,
          pausedSecondsValue,
          pausedAtMs
        );

        if (Number.isFinite(startAtMs) && durationSeconds > 0 && remaining > 0) {
          setSessionId(activeSession.id);
          setSessionState("work");
          setWorkDuration(activeSession.work_duration);
          setBreakDuration(activeSession.break_duration || 5);
          setTotalSessions(activeSession.total_sessions);
          setCurrentSession(activeSession.current_session);
          setSessionStartAt(startAtMs);
          setPausedSeconds(pausedSecondsValue);
          setIsActive(activeSession.status === "running");
          setTimeLeft(remaining);
          clearBreakState();
          return;
        }
      }

      const breakState = loadBreakState();
      if (breakState) {
        const nowMs = Date.now();
        const breakEnd = breakState.breakStartAt + breakState.breakDurationSeconds * 1000;
        if (breakEnd > nowMs) {
          const remaining = Math.max(0, Math.floor((breakEnd - nowMs) / 1000));
          setSessionState("break");
          setIsActive(true);
          setBreakStartAt(breakState.breakStartAt);
          setBreakDurationSeconds(breakState.breakDurationSeconds);
          setCurrentSession(breakState.currentSession);
          setTotalSessions(breakState.totalSessions);
          setWorkDuration(breakState.workDuration);
          setBreakDuration(breakState.breakDuration);
          setLongBreak(breakState.longBreak);
          setTimeLeft(remaining);
        } else {
          clearBreakState();
        }
      }
    });
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await api.get("/presets/");
      setPresets(res.data.data);
    } catch (e) {}
  };

  const fetchStats = async () => {
    try {
      const [statsRes, scoreRes] = await Promise.all([
        api.get("/stats/?days=1"),
        api.get("/productivity-score/"),
      ]);
      const hoursStr = (statsRes.data.data.total_focus_time / 60).toFixed(1) + "h";
      setStats({
        flow: hoursStr,
        score: scoreRes.data.data.score + "%",
        streak: "12d",
      });
    } catch (e) {}
  };

  useEffect(() => {
    if (!isActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      if (sessionState === "work" && sessionStartAt && sessionId) {
        const remaining = computeRemainingSeconds(
          sessionStartAt,
          workDuration * 60,
          pausedSeconds
        );
        setTimeLeft(remaining);
        if (remaining <= 0) {
          endWorkSession(sessionId, true);
        }
      } else if (sessionState === "break" && breakStartAt && breakDurationSeconds) {
        const breakEnd = breakStartAt + breakDurationSeconds * 1000;
        const remaining = Math.max(0, Math.floor((breakEnd - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0 && !breakSoundPlayedRef.current) {
          breakSoundPlayedRef.current = true;
          playBreakCompleteSound();
          if (currentSession < totalSessions) {
            startSession(currentSession + 1);
          } else {
            setSessionState("idle");
            setIsActive(false);
            setCurrentSession(1);
            setTimeLeft(workDuration * 60);
            setBreakStartAt(null);
            setBreakDurationSeconds(null);
            clearBreakState();
            localStorage.removeItem("flowtime_active_timer_type");
          }
        }
      }
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    isActive,
    sessionState,
    sessionStartAt,
    pausedSeconds,
    breakStartAt,
    breakDurationSeconds,
    workDuration,
    totalSessions,
    sessionId,
    currentSession,
  ]);

  const endWorkSession = async (id: number, naturallyCompleted: boolean) => {
    try {
      await api.post("/end-session/", { session_id: id, completed: naturallyCompleted });
    } catch (e) {}
    playWorkCompleteSound();
    breakSoundPlayedRef.current = false;
    setSessionState("break");
    setIsActive(true);
    
    const completedWorkSessions = currentSession;
    const isLongBreak = completedWorkSessions % 4 === 0;
    const durationSeconds = (isLongBreak ? longBreak : breakDuration) * 60;
    const startAt = Date.now();
    setBreakStartAt(startAt);
    setBreakDurationSeconds(durationSeconds);
    setTimeLeft(durationSeconds);
    saveBreakState({
      breakStartAt: startAt,
      breakDurationSeconds: durationSeconds,
      currentSession,
      totalSessions,
      workDuration,
      breakDuration,
      longBreak,
    });
    fetchStats();
  };

  const startSession = async (sessionNum?: number) => {
    const targetSession = sessionNum ?? currentSession;
    try {
      setAdjustmentMessage(null);
      const res = await api.post("/start-session/", {
        work_duration: baseWorkDuration,
        break_duration: baseBreakDuration,
        total_sessions: baseTotalSessions,
        current_session: targetSession,
        timer_type: "custom",
      });
      const data = res.data.data;
      const effectiveWorkDuration = data?.work_duration ?? baseWorkDuration;
      const startedAt = data?.started_at ? new Date(data.started_at).getTime() : Date.now();
      setSessionId(data.session_id);
      setSessionStartAt(startedAt);
      setPausedSeconds(data.paused_seconds ?? 0);
      clearBreakState();
      
      if (data.adjusted) {
        setAdjustmentMessage(data.adjustment_reason);
        setWorkDuration(effectiveWorkDuration);
      }

      setBreakDuration(data.break_duration);
      setSessionState("work");
      setTimeLeft(effectiveWorkDuration * 60);
      setIsActive(true);
      setCurrentSession(targetSession);
      localStorage.setItem("flowtime_active_timer_type", "custom");
    } catch (e) {
      console.error(e);
    }
  };

  const togglePause = async () => {
    if (sessionState === "work") {
      try {
        if (isActive) {
          const { data } = await api.post("/pause-session/", { session_id: sessionId });
          const pausedAt = data?.data?.paused_at ? new Date(data.data.paused_at).getTime() : Date.now();
          const updatedPausedSeconds = data?.data?.paused_seconds ?? pausedSeconds;
          const remaining = sessionStartAt
            ? computeRemainingSeconds(sessionStartAt, workDuration * 60, updatedPausedSeconds, pausedAt)
            : timeLeft;
          setPausedSeconds(updatedPausedSeconds);
          setTimeLeft(remaining);
          setIsActive(false);
          return;
        }

        const { data } = await api.post("/resume-session/", { session_id: sessionId });
        const updatedPausedSeconds = data?.data?.paused_seconds ?? pausedSeconds;
        setPausedSeconds(updatedPausedSeconds);
        setIsActive(true);
        return;
      } catch (e) {}
    }
    setIsActive(!isActive);
  };

  const resetTimer = async () => {
    if (sessionState === "work" && sessionId) {
      try {
        await api.post("/end-session/", { session_id: sessionId, completed: false });
      } catch (e) {}
    }
    setIsActive(false);
    if (sessionState === "work") {
      setSessionState("idle");
      setCurrentSession(1);
      setWorkDuration(baseWorkDuration);
      setBreakDuration(baseBreakDuration);
      setTotalSessions(baseTotalSessions);
      setLongBreak(baseLongBreak);
      setTimeLeft(baseWorkDuration * 60);
      setBreakStartAt(null);
      setBreakDurationSeconds(null);
      clearBreakState();
      localStorage.removeItem("flowtime_active_timer_type");
    } else if (sessionState === "break") {
      const durationSeconds = breakDuration * 60;
      const startAt = Date.now();
      setBreakStartAt(startAt);
      setBreakDurationSeconds(durationSeconds);
      setTimeLeft(durationSeconds);
      saveBreakState({
        breakStartAt: startAt,
        breakDurationSeconds: durationSeconds,
        currentSession,
        totalSessions,
        workDuration,
        breakDuration,
        longBreak,
      });
    }
  };

  const skipTimer = () => {
    if (sessionState === "work" && sessionId) {
      endWorkSession(sessionId, false);
    } else if (sessionState === "break") {
      if (currentSession < totalSessions) {
        startSession(currentSession + 1);
      } else {
        setSessionState("idle");
        setIsActive(false);
        setCurrentSession(1);
        setWorkDuration(baseWorkDuration);
        setBreakDuration(baseBreakDuration);
        setTotalSessions(baseTotalSessions);
        setLongBreak(baseLongBreak);
        setTimeLeft(baseWorkDuration * 60);
        setBreakStartAt(null);
        setBreakDurationSeconds(null);
        clearBreakState();
        localStorage.removeItem("flowtime_active_timer_type");
      }
    }
  };

  const saveAsPreset = async () => {
    try {
      const name = window.prompt("Preset Name:", "Custom Focus");
      if (!name) return;
      await api.post("/save-preset/", {
        name,
        work_duration: workDuration,
        break_duration: breakDuration,
        long_break_duration: longBreak,
        sessions_before_long_break: 4,
      });
      fetchPresets();
    } catch (e) {
      console.error(e);
    }
  };

  const usePreset = (p: Preset) => {
    setWorkDuration(p.work_duration);
    setBaseWorkDuration(p.work_duration);
    localStorage.setItem("flowtime_custom_base_work_duration", String(p.work_duration));

    setBreakDuration(p.short_break);
    setBaseBreakDuration(p.short_break);
    localStorage.setItem("flowtime_custom_base_break_duration", String(p.short_break));

    setLongBreak(p.long_break);
    setBaseLongBreak(p.long_break);
    localStorage.setItem("flowtime_custom_base_long_break", String(p.long_break));

    setTimeLeft(p.work_duration * 60);
  };

  const deletePreset = async (id: number) => {
    try {
      await api.delete(`/presets/${id}/`);
      fetchPresets();
    } catch (e) {}
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const completedWorkSessions = currentSession;
  const currentTotalDuration = sessionState === "break" 
    ? (completedWorkSessions % 4 === 0 ? longBreak * 60 : breakDuration * 60)
    : workDuration * 60;
    
  const progressPercent = sessionState === "idle" ? 0 : 100 - (timeLeft / currentTotalDuration) * 100;

  return (
    <main className="min-h-screen pt-32 pb-20 px-4 md:px-margin-desktop flex w-full justify-center relative z-10">
      {blocker.state === "blocked" && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[999] flex items-center justify-center p-4">
          <div className="bg-[#141A28] border border-white/10 rounded-[2.5rem] p-8 max-w-[440px] w-full text-center shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[150px] bg-blue-500/10 blur-[50px] pointer-events-none rounded-full" />
            
            <h3 className="text-xl font-semibold text-white mb-4 relative z-10">
              Active Focus Session
            </h3>
            <p className="text-sm text-slate-400 mb-8 relative z-10">
              You have an active focus session. What would you like to do?
            </p>
            
            <div className="flex flex-col gap-3 relative z-10">
              <button
                onClick={() => blocker.reset?.()}
                className="w-full bg-[#2563EB] hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.3)] cursor-pointer"
              >
                Continue Session
              </button>
              <button
                onClick={handlePauseAndLeave}
                className="w-full bg-[#1E2638] hover:bg-[#2A344A] border border-white/5 text-slate-300 hover:text-white font-medium py-3 rounded-xl transition-all cursor-pointer"
              >
                Pause Session
              </button>
              <button
                onClick={handleEndAndLeave}
                className="w-full bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-medium py-3 rounded-xl transition-all cursor-pointer"
              >
                End Session
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="w-full max-w-[1200px] grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-8">
        
        {/* LEFT PANEL */}
        <div className="flex flex-col gap-8">
          <div className="bg-[#141A28] border border-white/5 rounded-[2rem] p-8 shadow-xl">
            <h2 className="text-2xl font-semibold text-white mb-2">Build your session</h2>
            <p className="text-sm text-slate-400 mb-8">Configure your rhythm for peak cognitive performance.</p>
            
            <div className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Work Duration (min)</label>
                <input
                  type="number"
                  value={workDuration}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setWorkDuration(val);
                    setBaseWorkDuration(val);
                    localStorage.setItem("flowtime_custom_base_work_duration", String(val));
                    if (sessionState === "idle") setTimeLeft(val * 60);
                  }}
                  disabled={sessionState !== "idle"}
                  className="w-full bg-[#0F141F] border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[#2563EB]/50 transition-colors"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Break Duration (min)</label>
                <input
                  type="number"
                  value={breakDuration}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setBreakDuration(val);
                    setBaseBreakDuration(val);
                    localStorage.setItem("flowtime_custom_base_break_duration", String(val));
                  }}
                  disabled={sessionState !== "idle"}
                  className="w-full bg-[#0F141F] border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[#2563EB]/50 transition-colors"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Sessions</label>
                  <input
                    type="number"
                    value={totalSessions}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setTotalSessions(val);
                      setBaseTotalSessions(val);
                      localStorage.setItem("flowtime_custom_base_total_sessions", String(val));
                    }}
                    disabled={sessionState !== "idle"}
                    className="w-full bg-[#0F141F] border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[#2563EB]/50 transition-colors"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Long Break</label>
                  <input
                    type="number"
                    value={longBreak}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setLongBreak(val);
                      setBaseLongBreak(val);
                      localStorage.setItem("flowtime_custom_base_long_break", String(val));
                    }}
                    disabled={sessionState !== "idle"}
                    className="w-full bg-[#0F141F] border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-[#2563EB]/50 transition-colors"
                  />
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  onClick={() => startSession()}
                  className="w-full bg-[#2563EB] hover:bg-blue-500 text-white font-medium py-3.5 rounded-xl transition-colors shadow-[0_4px_20px_rgba(37,99,235,0.2)]"
                >
                  Start Session
                </button>
                <button
                  onClick={saveAsPreset}
                  className="w-full bg-[#1E2638] hover:bg-[#2A344A] text-slate-300 font-medium py-3.5 rounded-xl transition-colors"
                >
                  Save as Preset
                </button>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <h3 className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Quick Apply</h3>
            
            {presets.map((preset) => (
              <div key={preset.id} className="bg-[#141A28] border border-white/5 rounded-[1.5rem] p-6 shadow-lg group">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="text-lg font-semibold text-white">{preset.name}</h4>
                  <Sparkles className="w-4 h-4 text-slate-500 group-hover:text-[#2563EB] transition-colors" />
                </div>
                <p className="text-xs text-slate-400 mb-4 font-mono">Custom Preset</p>
                
                <div className="flex gap-4 text-xs font-mono text-slate-400 mb-6">
                  <div className="flex items-center gap-1.5"><TimerIcon className="w-3 h-3" /> {preset.work_duration}m</div>
                  <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-[#2563EB]/20 flex items-center justify-center text-[8px] text-[#2563EB]">B</div> {preset.short_break}m</div>
                  <div className="flex items-center gap-1.5"><RefreshCw className="w-3 h-3" /> {totalSessions}x</div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => usePreset(preset)}
                    className="flex-1 bg-[#1E2638] hover:bg-[#2A344A] text-slate-300 py-2 rounded-lg text-xs font-medium transition-colors"
                  >
                    Use Preset
                  </button>
                  <button
                    onClick={() => deletePreset(preset.id)}
                    className="p-2 bg-[#1E2638] hover:bg-red-500/20 text-slate-400 hover:text-red-400 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="bg-[#141A28] border border-white/5 rounded-[2.5rem] flex flex-col items-center justify-center p-12 shadow-2xl relative overflow-hidden h-[750px]">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[60%] h-[300px] bg-blue-500/5 blur-[100px] pointer-events-none rounded-full" />
          
          <h2 className="text-3xl font-semibold text-white tracking-wide relative z-10 mb-2">Focus Time</h2>
          
          <div className="relative z-10 mb-12">
            <span className="text-[10px] tracking-[0.2em] uppercase font-semibold text-slate-400">
              {sessionState === "idle" ? "READY" : sessionState === "work" ? "ACTIVE SESSION" : "BREAK MODE"}
            </span>
          </div>

          <div className="relative w-[320px] h-[320px] flex items-center justify-center mb-10">
            {/* Very faint background ring */}
            <div className="absolute inset-0 rounded-full border-[1px] border-white/5"></div>
            
            <div className="flex flex-col items-center justify-center z-10 text-center">
              <div className="text-[5.5rem] font-bold text-white tracking-tighter tabular-nums leading-none mb-3">
                {formatTime(timeLeft)}
              </div>
              <div className="text-[10px] text-slate-400 tracking-[0.2em] uppercase font-semibold">
                SESSION {currentSession} / {totalSessions}
              </div>
            </div>
          </div>

          {/* Progress Bar under the circle */}
          <div className="w-[320px] h-1.5 bg-[#1E2638] rounded-full mb-6 overflow-hidden relative z-10">
            <div 
              className={cn("h-full rounded-full transition-all duration-1000", sessionState === "break" ? "bg-emerald-500" : "bg-[#2563EB]")}
              style={{ width: `${progressPercent}%` }}
            ></div>
          </div>

          <div className="text-sm text-slate-400 mb-12 relative z-10">
            Next: {sessionState === "work" ? `${breakDuration} min break` : sessionState === "break" ? `${workDuration} min focus` : "Start your session"}
          </div>

          <div className="flex items-center justify-center gap-6 relative z-10 mb-16">
            <button 
              onClick={resetTimer}
              disabled={sessionState === "idle"}
              className="w-14 h-14 rounded-full bg-[#1A2234] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            
            {sessionState === "idle" ? (
              <button
                onClick={() => startSession()}
                className="w-20 h-20 bg-[#2563EB] hover:bg-blue-500 text-white rounded-full flex items-center justify-center transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] outline-none"
              >
                <Play className="w-8 h-8 ml-1" fill="currentColor" />
              </button>
            ) : (
              <button 
                onClick={togglePause}
                className="w-20 h-20 bg-[#2563EB] hover:bg-blue-500 text-white rounded-full flex items-center justify-center transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] outline-none"
              >
                {isActive ? <Pause className="w-8 h-8" fill="currentColor" /> : <Play className="w-8 h-8 ml-1" fill="currentColor" />}
              </button>
            )}

            <button 
              onClick={skipTimer}
              disabled={sessionState === "idle"}
              className="w-14 h-14 rounded-full bg-[#1A2234] border border-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-3 w-[320px] border-t border-white/5 pt-8 relative z-10 text-center">
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mb-2">Daily Flow</div>
              <div className="text-xl font-bold text-white">{stats.flow}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mb-2">Focus Score</div>
              <div className="text-xl font-bold text-white">{stats.score}</div>
            </div>
            <div className="space-y-1">
              <div className="text-[10px] text-slate-500 font-semibold tracking-widest uppercase mb-2">Streak</div>
              <div className="text-xl font-bold text-white">{stats.streak}</div>
            </div>
          </div>
          
        </div>
      </div>
    </main>
  );
}
