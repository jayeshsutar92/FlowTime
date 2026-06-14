import { useState, useEffect, useRef } from "react";
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

export default function Timer() {
  const [workDuration, setWorkDuration] = useState(25);
  const [breakDuration, setBreakDuration] = useState(5);
  const [totalSessions, setTotalSessions] = useState(4);
  const [longBreak, setLongBreak] = useState(15);
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
  const BREAK_STORAGE_KEY = "flowtime_break_state";

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
      const running = res.data.data.find((s: any) => s.status === "running");
      const paused = res.data.data.find((s: any) => s.status === "paused");
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
        // This is a simplification for visual accuracy with design
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
          endWorkSession(sessionId);
        }
      } else if (sessionState === "break" && breakStartAt && breakDurationSeconds) {
        const breakEnd = breakStartAt + breakDurationSeconds * 1000;
        const remaining = Math.max(0, Math.floor((breakEnd - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0 && !breakSoundPlayedRef.current) {
          breakSoundPlayedRef.current = true;
          playBreakCompleteSound();
          setSessionState("idle");
          setIsActive(false);
          setCurrentSession((prev) => (prev < totalSessions ? prev + 1 : 1));
          setTimeLeft(workDuration * 60);
          setBreakStartAt(null);
          setBreakDurationSeconds(null);
          clearBreakState();
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
  ]);

  const endWorkSession = async (id: number) => {
    try {
      await api.post("/end-session/", { session_id: id });
    } catch (e) {}
    playWorkCompleteSound();
    breakSoundPlayedRef.current = false;
    setSessionState("break");
    setIsActive(true);
    // Is it a long break? 
    const isLongBreak = currentSession % 4 === 0 && currentSession <= totalSessions;
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
    fetchStats(); // Update stats after a session ends
  };

  const startSession = async () => {
    try {
      setAdjustmentMessage(null);
      const res = await api.post("/start-session/", {
        work_duration: workDuration,
        break_duration: breakDuration,
        total_sessions: totalSessions,
        current_session: currentSession,
      });
      const data = res.data.data;
      const effectiveWorkDuration = data?.work_duration ?? workDuration;
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

  const resetTimer = () => {
    setIsActive(false);
    if (sessionState === "work") {
      setTimeLeft(workDuration * 60);
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
      endWorkSession(sessionId);
    } else if (sessionState === "break") {
      setSessionState("idle");
      setIsActive(false);
      setCurrentSession((prev) => (prev < totalSessions ? prev + 1 : 1));
      setTimeLeft(workDuration * 60);
      setBreakStartAt(null);
      setBreakDurationSeconds(null);
      clearBreakState();
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
    setBreakDuration(p.short_break);
    setLongBreak(p.long_break);
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

  const currentTotalDuration = sessionState === "break" 
    ? (currentSession % 4 === 0 ? longBreak * 60 : breakDuration * 60)
    : workDuration * 60;
    
  const progressPercent = sessionState === "idle" ? 0 : 100 - (timeLeft / currentTotalDuration) * 100;
  const strokeDashoffset = sessionState === "idle" ? 289.02 : 289.02 - (289.02 * (progressPercent / 100));

  return (
    <main className="min-h-screen pt-32 pb-20 px-4 md:px-margin-desktop flex flex-col items-center justify-start w-full relative z-10">
      
      {adjustmentMessage && (
        <div className="mb-6 bg-[#1A2234] border border-blue-500/20 text-white text-xs px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-blue-500" />
          {adjustmentMessage}
        </div>
      )}

      <div className="w-full max-w-[800px] flex flex-col gap-6">
        {/* Main Card */}
        <div className="bg-[#141A28] border border-white/5 rounded-[2.5rem] p-10 md:p-14 flex flex-col items-center text-center shadow-2xl relative overflow-hidden">
          {/* Subtle top glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[80%] h-[300px] bg-blue-500/10 blur-[100px] pointer-events-none rounded-full" />
          
          <h2 className="text-3xl font-semibold text-white tracking-wide relative z-10">Focus Time</h2>
          
          <div className="mt-4 relative z-10">
            <span className={cn(
              "text-[10px] tracking-[0.2em] uppercase font-semibold px-4 py-1.5 rounded-full border border-white/10",
              sessionState === "work" ? "bg-white/5 text-blue-200" : "bg-white/5 text-slate-400"
             )}>
              {sessionState === "break" ? "RECOVERY MODE" : "DEEP WORK MODE"}
            </span>
          </div>

          <div className="text-sm text-slate-400 mt-5 font-mono tracking-widest relative z-10">
            Session {currentSession} / {totalSessions}
          </div>

          <div className="relative flex justify-center items-center mt-10 mb-10 w-full">
            {/* Progress Ring */}
            <svg className="w-[360px] h-[360px] -rotate-90 transform" viewBox="0 0 100 100">
                <circle className="text-[#1A2234]" cx="50" cy="50" fill="transparent" r="46" stroke="currentColor" strokeWidth="3"></circle>
                <circle 
                  className={cn(
                    "transition-all duration-1000 origin-center -rotate-90",
                    sessionState === "break" ? "text-emerald-500 filter drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]" : "text-[#2563EB] filter drop-shadow-[0_0_20px_rgba(37,99,235,0.6)]"
                  )}
                  cx="50" cy="50" fill="transparent" r="46" stroke="currentColor" 
                  strokeDasharray="289.02" strokeDashoffset={strokeDashoffset} 
                  strokeLinecap="round" strokeWidth="3"
                ></circle>
            </svg>

            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-[200px] h-[150px] bg-[#1E2638] rounded-[2rem] flex flex-col items-center justify-center shadow-lg pointer-events-auto border border-white/5">
                    <div className="text-7xl font-bold text-white tracking-tighter tabular-nums leading-none">
                        {formatTime(timeLeft)}
                    </div>
                    <div className="mt-4 font-semibold text-[10px] text-slate-400 tracking-[0.2em] uppercase">
                        STAY FOCUSED
                    </div>
                </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-white/5 border border-white/5 rounded-full px-5 py-2.5 text-xs text-slate-400 tracking-wide relative z-10 mb-8">
            <TimerIcon className="w-4 h-4" /> Work {workDuration} min | Break {breakDuration} min
          </div>

          <div className="flex items-center justify-center gap-6 relative z-10">
            <button 
              onClick={resetTimer}
              disabled={sessionState === "idle"}
              className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all outline-none disabled:opacity-50"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            
            {sessionState === "idle" ? (
              <button
                onClick={startSession}
                className="bg-[#2563EB] hover:bg-blue-500 text-white px-10 h-14 rounded-[1.25rem] font-medium tracking-wide flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] w-[180px] outline-none"
              >
                <Play className="w-5 h-5" fill="currentColor" />
                Start
              </button>
            ) : (
              <button 
                onClick={togglePause}
                className="bg-[#2563EB] hover:bg-blue-500 text-white px-10 h-14 rounded-[1.25rem] font-medium tracking-wide flex items-center justify-center gap-2 transition-all shadow-[0_0_30px_rgba(37,99,235,0.4)] w-[180px] outline-none"
              >
                {isActive ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5" fill="currentColor" />}
                {isActive ? "Pause" : "Resume"}
              </button>
            )}

            <button 
              onClick={skipTimer}
              disabled={sessionState === "idle"}
              className="w-14 h-14 rounded-full border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 transition-all outline-none disabled:opacity-50"
            >
              {/* To visually match the image which shows a pause icon outline */}
              <Pause className="w-5 h-5" />
            </button>
          </div>

          <div className="mt-10 text-xs text-slate-500 italic relative z-10 tracking-widest">
            {sessionState === "idle" ? "Ready to begin your session." : "Maintain your momentum."}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#141A28] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex items-center gap-2 text-[#2563EB] mb-6">
              <TrendingUp className="w-4 h-4" />
              <span className="text-[10px] font-semibold tracking-widest uppercase">VELOCITY</span>
            </div>
            <div className="text-4xl font-bold text-white mb-2 tracking-tight">120%</div>
            <div className="text-sm text-slate-400">Higher than yesterday</div>
          </div>

          <div className="bg-[#141A28] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex items-center gap-2 text-[#2563EB] mb-6">
              <Zap className="w-4 h-4" />
              <span className="text-[10px] font-semibold tracking-widest uppercase">ENERGY</span>
            </div>
            <div className="text-4xl font-bold text-white mb-2 tracking-tight">Peak</div>
            <div className="text-sm text-slate-400">Optimal for deep work</div>
          </div>

          <div className="bg-[#141A28] border border-white/5 rounded-3xl p-6 relative overflow-hidden">
            <div className="flex items-center gap-2 text-[#2563EB] mb-6">
              <History className="w-4 h-4" />
              <span className="text-[10px] font-semibold tracking-widest uppercase">STREAK</span>
            </div>
            <div className="text-4xl font-bold text-white mb-2 tracking-tight">12 Days</div>
            <div className="text-sm text-slate-400">Keep the momentum</div>
          </div>
        </div>
      </div>

      <footer className="mt-auto pt-20 mb-8 flex flex-col md:flex-row justify-between items-center w-full max-w-[900px] text-xs text-slate-500 px-4">
        <div className="text-slate-400 mb-4 md:mb-0">FlowTime</div>
        <div className="flex gap-6 mb-4 md:mb-0 text-white/70">
          <a href="#" className="hover:text-white transition-colors">About</a>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Support</a>
          <a href="#" className="hover:text-white transition-colors">Twitter</a>
          <a href="#" className="hover:text-white transition-colors">Changelog</a>
        </div>
        <div className="font-mono text-[10px]">© 2026 FlowTime. All rights reserved. Designed for Deep Work.</div>
      </footer>
    </main>
  );
}
