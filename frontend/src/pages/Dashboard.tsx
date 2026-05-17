import { useEffect, useState } from "react";
import api from "../services/api";
import { TrendingUp, Activity, History, Calendar, CheckCircle2, Award } from "lucide-react";
import { cn } from "../lib/utils";

export default function Dashboard() {
  const [stats, setStats] = useState({ focusTime: "0", sessions: "-", avgFocus: "0", completion: "0" });
  const [score, setScore] = useState({ score: 0, level: "LOW" });
  const [insights, setInsights] = useState({ timeSlot: "No data", recommendation: "" });
  const [heatmap, setHeatmap] = useState<number[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [statsRes, scoreRes, insightsRes, heatmapRes] = await Promise.all([
        api.get("/stats/"),
        api.get("/productivity-score/"),
        api.get("/insights/"),
        api.get("/heatmap/")
      ]);

      setStats({
        focusTime: (statsRes.data.data.total_focus_time / 60).toFixed(1),
        sessions: statsRes.data.data.total_sessions.toString(),
        avgFocus: insightsRes.data.data.avg_session_length?.toFixed(1) || "0",
        completion: (insightsRes.data.data.completion_rate * 100).toFixed(1)
      });
      setScore({
        score: scoreRes.data.data.score,
        level: scoreRes.data.data.level.toUpperCase()
      });
      setInsights({
        timeSlot: insightsRes.data.data.best_focus_time || "No data",
        recommendation: insightsRes.data.data.recommendation
      });
      setHeatmap(heatmapRes.data.data.last_7_days || []);
    } catch (e) {}
  };

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-white/5";
    if (count === 1) return "bg-primary/20";
    if (count <= 3) return "bg-primary/50";
    if (count <= 5) return "bg-primary/80";
    return "bg-primary";
  };

  return (
    <main className="pt-24 pb-20 px-4 md:px-margin-desktop max-w-container-max mx-auto">
      <header className="mb-12">
        <h1 className="font-headline-lg text-headline-lg md:text-display-xl md:font-display-xl text-on-surface text-center mb-2 tracking-tight">Dashboard</h1>
        <p className="text-on-surface-variant text-center max-w-2xl mx-auto">Analyze your focus performance and weekly rhythms to optimize your deep work sessions.</p>
      </header>

      {/* Top Level Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter mb-gutter">
        <div className="glass-card rounded-xl p-8 transition-all hover:border-primary/30">
          <div className="flex flex-col h-full">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 tracking-wider">Total focus time</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display-xl text-[64px] font-bold leading-none tracking-tighter text-on-surface">{stats.focusTime}</span>
              <span className="text-on-surface-variant font-medium">hrs</span>
            </div>
          </div>
        </div>
        <div className="glass-card rounded-xl p-8 transition-all hover:border-primary/30">
          <div className="flex flex-col h-full">
            <span className="font-label-sm text-label-sm text-on-surface-variant uppercase mb-4 tracking-wider">Total sessions</span>
            <div className="flex items-baseline gap-2">
              <span className="font-display-xl text-[64px] font-bold leading-none tracking-tighter text-on-surface">{stats.sessions}</span>
              <span className="text-on-surface-variant font-medium">completed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Productivity Score */}
      <div className="glass-card rounded-xl p-12 mb-gutter text-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        <div className="relative z-10">
          <span className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-[0.2em] mb-6 block">Productivity Score</span>
          <div className="flex flex-col items-center">
            <span className={cn(
              "text-[120px] font-display-xl font-bold leading-none mb-2 tabular-nums tracking-tighter",
              score.score < 40 ? "text-error" : score.score < 70 ? "text-tertiary" : "text-primary"
            )}>
              {score.score}
            </span>
            <span className={cn(
              "font-semibold uppercase tracking-widest text-lg mb-4",
              score.score < 40 ? "text-error" : score.score < 70 ? "text-tertiary" : "text-primary"
            )}>
              {score.level}
            </span>
            <p className="text-on-surface-variant text-sm font-label-sm max-w-xs mx-auto">Based on your recent sessions and completion frequency.</p>
          </div>
        </div>
      </div>

      {/* Focus Insights Grid */}
      <div className="glass-card rounded-xl p-8 mb-gutter">
        <div className="flex items-center gap-2 mb-8 border-b border-white/5 pb-4">
          <Activity className="text-primary w-6 h-6" />
          <h2 className="font-headline-lg text-headline-lg-mobile text-on-surface tracking-tight">Focus Insights</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-surface-container rounded-xl p-6 border border-white/5 flex flex-col items-center text-center">
            <span className="text-on-surface-variant font-label-sm text-label-sm mb-4 uppercase tracking-wider">Avg Focus Time</span>
            <span className="font-headline-lg text-[32px] font-bold text-on-surface tracking-tight">{stats.avgFocus}</span>
            <span className="text-on-surface-variant text-xs mt-2 uppercase tracking-wide">min / session</span>
          </div>
          <div className="bg-surface-container rounded-xl p-6 border border-white/5 flex flex-col items-center text-center">
            <span className="text-on-surface-variant font-label-sm text-label-sm mb-4 uppercase tracking-wider">Completion Rate</span>
            <span className="font-headline-lg text-[32px] font-bold text-on-surface tracking-tight">{stats.completion}%</span>
            <div className="w-full bg-white/5 h-1.5 rounded-full mt-4 overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${stats.completion}%` }}></div>
            </div>
          </div>
          <div className="bg-surface-container rounded-xl p-6 border border-white/5 flex flex-col items-center text-center">
            <span className="text-on-surface-variant font-label-sm text-label-sm mb-4 uppercase tracking-wider">Best Time Slot</span>
            <span className="font-headline-lg text-xl font-bold text-on-surface tracking-tight mt-1">{insights.timeSlot}</span>
            <span className="text-on-surface-variant text-xs mt-3 uppercase tracking-wide">Peak flow state</span>
          </div>
          <div className="primary-gradient rounded-3xl p-6 ambient-glow flex flex-col items-center text-center justify-center relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-700"></div>
            <span className="text-white/80 font-label-sm text-label-sm mb-2 relative z-10 uppercase tracking-widest">Recommendation</span>
            <span className="font-headline-lg text-xl font-bold text-white leading-tight relative z-10">{insights.recommendation}</span>
          </div>
        </div>
      </div>

      {/* Session Heatmap */}
      <div className="glass-card rounded-xl p-8 mb-gutter">
        <div className="flex justify-between items-center mb-10 border-b border-white/5 pb-4">
          <div className="flex items-center gap-2">
            <Calendar className="text-primary w-6 h-6" />
            <h2 className="font-headline-lg text-headline-lg-mobile text-on-surface tracking-tight">Session Heatmap</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-on-surface-variant font-label-sm">
            <span className="uppercase tracking-widest text-[10px]">Less</span>
            <div className="flex gap-1.5 mx-2">
              <div className="w-3.5 h-3.5 rounded-md bg-white/5 border border-white/5"></div>
              <div className="w-3.5 h-3.5 rounded-md bg-primary/20"></div>
              <div className="w-3.5 h-3.5 rounded-md bg-primary/50"></div>
              <div className="w-3.5 h-3.5 rounded-md bg-primary/80"></div>
              <div className="w-3.5 h-3.5 rounded-md bg-primary shadow-[0_0_8px_rgba(59,130,246,0.8)]"></div>
            </div>
            <span className="uppercase tracking-widest text-[10px]">More</span>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-4 lg:gap-6">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, i) => (
            <div key={day} className="flex flex-col items-center gap-4 group">
              <div className={cn(
                "w-full aspect-square rounded-xl border border-white/5 transition-colors duration-500",
                getHeatmapColor(heatmap[i] || 0)
              )}></div>
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-widest group-hover:text-primary transition-colors">{day}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
        <div className="glass-card rounded-xl p-8 flex flex-col justify-center items-center text-center group overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <Award className="w-16 h-16 text-primary/60 mb-6 group-hover:text-primary transition-colors" strokeWidth={1} />
          <h3 className="font-headline-lg text-headline-lg-mobile text-on-surface tracking-tight">Level 1 Focus</h3>
          <p className="text-on-surface-variant text-sm mt-3 leading-relaxed max-w-xs">You are just starting your flow journey. Complete 5 more sessions to reach Level 2.</p>
          <div className="w-full max-w-[200px] bg-white/5 h-1.5 rounded-full mt-8 overflow-hidden">
            <div className="bg-primary h-full w-[20%] rounded-full shadow-[0_0_8px_rgba(37,99,235,0.8)]"></div>
          </div>
          <span className="text-[10px] font-label-sm text-on-surface-variant mt-3 uppercase tracking-widest">1,200 / 5,000 XP</span>
        </div>
        <div className="md:col-span-2 glass-card rounded-xl p-8 relative overflow-hidden min-h-[300px]">
          <div className="relative z-10 flex flex-col justify-between h-full">
            <div className="max-w-xs">
              <h3 className="font-headline-lg text-headline-lg-mobile text-on-surface mb-3 tracking-tight">Rhythm Visualization</h3>
              <p className="text-on-surface-variant text-sm leading-relaxed">A procedural representation of your current work-rest cycle based on historical data.</p>
            </div>
            <div className="flex gap-3 items-end h-32 mt-8">
               <div className="flex-1 bg-primary/20 rounded-t-lg h-[15%] hover:h-[20%] transition-all duration-300"></div>
               <div className="flex-1 bg-primary/40 rounded-t-lg h-[30%] hover:h-[35%] transition-all duration-300"></div>
               <div className="flex-1 bg-white/5 rounded-t-lg h-[5%] hover:h-[10%] transition-all duration-300"></div>
               <div className="flex-1 bg-primary/60 rounded-t-lg h-[55%] hover:h-[60%] transition-all duration-300"></div>
               <div className="flex-1 bg-primary/80 rounded-t-lg h-[80%] shadow-[0_0_15px_rgba(37,99,235,0.5)] hover:h-[85%] transition-all duration-300 transform origin-bottom hover:scale-105"></div>
               <div className="flex-1 bg-white/5 rounded-t-lg h-[10%] hover:h-[15%] transition-all duration-300"></div>
               <div className="flex-1 bg-primary/50 rounded-t-lg h-[40%] hover:h-[45%] transition-all duration-300"></div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
