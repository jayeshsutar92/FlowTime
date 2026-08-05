import { useEffect, useState, useMemo } from "react";
import {
  getDailyContributions,
  getContributionHeatmap,
  getContributionAnalytics,
  createContribution,
  markContributionComplete,
  markContributionUncomplete,
  deleteContribution,
  DailyContribution,
  ContributionAnalytics,
  DailyContributionsSummary,
} from "../services/contributions";
import { Calendar, Flame, Target, Award, CheckCircle2, Circle, Plus, Trash2 } from "lucide-react";
import { cn } from "../lib/utils";

export default function Contributions() {
  const [date, setDate] = useState<string>(
    new Date().toLocaleDateString("en-CA") // YYYY-MM-DD
  );
  
  const [heatmapDays, setHeatmapDays] = useState<number>(365);
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [analytics, setAnalytics] = useState<ContributionAnalytics | null>(null);
  const [dailySummary, setDailySummary] = useState<DailyContributionsSummary | null>(null);
  
  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newWeight, setNewWeight] = useState<"low" | "normal" | "high">("normal");

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [date, heatmapDays]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [dailyRes, analyticsRes, heatmapRes] = await Promise.all([
        getDailyContributions(date),
        getContributionAnalytics(),
        getContributionHeatmap(heatmapDays),
      ]);
      setDailySummary(dailyRes);
      setAnalytics(analyticsRes);
      setHeatmapData(heatmapRes);
    } catch (error) {
      console.error("Error fetching contributions data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await createContribution({
        title: newTitle,
        notes: newNotes,
        weight: newWeight,
        scheduled_date: date,
      });
      setNewTitle("");
      setNewNotes("");
      setNewWeight("normal");
      fetchData();
    } catch (error) {
      console.error("Error creating contribution:", error);
    }
  };

  const toggleComplete = async (contrib: DailyContribution) => {
    try {
      if (contrib.completed) {
        await markContributionUncomplete(contrib.id);
      } else {
        await markContributionComplete(contrib.id);
      }
      fetchData();
    } catch (error) {
      console.error("Error toggling completion:", error);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteContribution(id);
      fetchData();
    } catch (error) {
      console.error("Error deleting contribution:", error);
    }
  };

  const generateHeatmapGrid = () => {
    const today = new Date();
    const cells = [];
    for (let i = heatmapDays - 1; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const dateStr = d.toLocaleDateString("en-CA");
      cells.push({
        date: dateStr,
        count: heatmapData[dateStr] || 0,
      });
    }
    return cells;
  };

  const heatmapCells = useMemo(() => generateHeatmapGrid(), [heatmapData, heatmapDays]);

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-white/5";
    if (count === 1) return "bg-green-500/30";
    if (count === 2) return "bg-green-500/60";
    if (count >= 3) return "bg-green-500/90";
    return "bg-white/5";
  };

  return (
    <main className="pt-24 pb-20 px-4 md:px-margin-desktop max-w-container-max mx-auto">
      <header className="mb-10 text-center">
        <h1 className="font-headline-lg text-headline-lg md:text-display-xl md:font-display-xl text-on-surface text-center mb-2 tracking-tight">
          Daily Contributions
        </h1>
        <p className="text-on-surface-variant text-center max-w-2xl mx-auto mb-6">
          Track your meaningful work independent of focus timers.
        </p>
      </header>

      {/* Analytics Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5 flex flex-col items-center">
          <Target className="w-8 h-8 text-blue-400 mb-3" />
          <p className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Completion Rate</p>
          <p className="text-3xl font-bold text-on-surface">{analytics?.completion_rate || 0}%</p>
        </div>
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5 flex flex-col items-center">
          <Flame className="w-8 h-8 text-orange-400 mb-3" />
          <p className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Current Streak</p>
          <p className="text-3xl font-bold text-on-surface">{analytics?.current_streak || 0} days</p>
        </div>
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5 flex flex-col items-center">
          <Award className="w-8 h-8 text-yellow-400 mb-3" />
          <p className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Total Points</p>
          <p className="text-3xl font-bold text-on-surface">{analytics?.total_points || 0}</p>
        </div>
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5 flex flex-col items-center">
          <Calendar className="w-8 h-8 text-purple-400 mb-3" />
          <p className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Best Weekday</p>
          <p className="text-3xl font-bold text-on-surface">{analytics?.best_weekday || "None"}</p>
        </div>
      </section>

      {/* Main Content */}
      <div className="grid lg:grid-cols-[1fr_350px] gap-8">
        <section className="bg-surface-container rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl">
          <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
            <h2 className="text-xl font-bold tracking-tight text-on-surface">Contribution Heatmap</h2>
            <div className="inline-flex items-center gap-1.5 p-1 bg-background/50 rounded-full border border-white/5">
              {[30, 90, 365].map((d) => (
                <button
                  key={d}
                  onClick={() => setHeatmapDays(d)}
                  className={cn(
                    "px-4 py-1.5 rounded-full text-xs font-semibold transition-all duration-200",
                    heatmapDays === d
                      ? "bg-primary text-white shadow-md shadow-primary/20"
                      : "text-on-surface-variant hover:text-on-surface hover:bg-white/5"
                  )}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto pb-4">
            <div className="flex flex-wrap gap-[4px] min-w-[max-content]">
              {heatmapCells.map((cell, i) => (
                <button
                  key={i}
                  title={`${cell.date}: ${cell.count} contributions`}
                  onClick={() => setDate(cell.date)}
                  className={cn(
                    "w-3.5 h-3.5 rounded-sm transition-transform hover:scale-125 hover:ring-2 ring-primary ring-offset-1 ring-offset-surface-container cursor-pointer",
                    getHeatmapColor(cell.count),
                    date === cell.date && "ring-2 ring-white scale-110"
                  )}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="bg-surface-container rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col">
          <h2 className="text-xl font-bold tracking-tight text-on-surface mb-2">
            {new Date(date).toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
          </h2>
          <p className="text-sm text-on-surface-variant mb-6">
            {dailySummary?.completed || 0} of {dailySummary?.total || 0} completed
          </p>

          <form onSubmit={handleCreate} className="mb-6 flex flex-col gap-3 p-4 bg-background/30 rounded-2xl border border-white/5">
            <input
              type="text"
              placeholder="What did you achieve?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-transparent border-b border-white/10 px-2 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
              required
            />
            <div className="flex items-center justify-between mt-2">
              <select
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value as any)}
                className="bg-surface-variant text-xs text-on-surface rounded-lg px-2 py-1.5 outline-none border-none cursor-pointer"
              >
                <option value="low">Low Impact</option>
                <option value="normal">Normal</option>
                <option value="high">High Impact</option>
              </select>
              <button
                type="submit"
                disabled={!newTitle.trim()}
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white disabled:opacity-50 hover:bg-blue-500 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
            {isLoading ? (
              <p className="text-center text-on-surface-variant text-sm mt-8">Loading...</p>
            ) : dailySummary?.contributions.length === 0 ? (
              <div className="text-center mt-8">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-6 h-6 text-on-surface-variant/50" />
                </div>
                <p className="text-sm text-on-surface-variant">No contributions scheduled for this day.</p>
              </div>
            ) : (
              dailySummary?.contributions.map((c) => (
                <div
                  key={c.id}
                  className={cn(
                    "group flex items-start gap-3 p-3 rounded-xl border transition-all",
                    c.completed ? "bg-white/5 border-transparent opacity-60" : "bg-surface-variant border-white/5 hover:border-white/10"
                  )}
                >
                  <button onClick={() => toggleComplete(c)} className="mt-0.5 flex-shrink-0 text-on-surface-variant hover:text-primary transition-colors">
                    {c.completed ? (
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                    ) : (
                      <Circle className="w-5 h-5" />
                    )}
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium truncate", c.completed && "line-through")}>
                      {c.title}
                    </p>
                    {c.weight !== "normal" && (
                      <span className={cn(
                        "inline-block mt-1 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                        c.weight === "high" ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"
                      )}>
                        {c.weight}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => handleDelete(c.id)}
                    className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 text-on-surface-variant hover:text-red-400 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
