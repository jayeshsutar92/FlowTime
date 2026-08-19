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
  updateContribution,
} from "../services/contributions";
import { Calendar, Flame, Target, Award, CheckCircle2, Circle, Plus, Trash2, Edit2, X, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export default function Contributions() {
  const todayStr = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD
  
  const [todaySummary, setTodaySummary] = useState<DailyContributionsSummary | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSummary, setSelectedSummary] = useState<DailyContributionsSummary | null>(null);
  
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [heatmapData, setHeatmapData] = useState<Record<string, number>>({});
  const [analytics, setAnalytics] = useState<ContributionAnalytics | null>(null);
  
  const [scratchpad, setScratchpad] = useState<string>(
    localStorage.getItem("flowtime_scratchpad") || ""
  );

  const [newTitle, setNewTitle] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newWeight, setNewWeight] = useState<"low" | "normal" | "high">("normal");
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editWeight, setEditWeight] = useState<"low" | "normal" | "high">("normal");

  const [isLoadingToday, setIsLoadingToday] = useState(true);
  const [isLoadingSelected, setIsLoadingSelected] = useState(false);

  useEffect(() => {
    localStorage.setItem("flowtime_scratchpad", scratchpad);
  }, [scratchpad]);

  useEffect(() => {
    fetchGlobalData();
    fetchTodayData();
  }, [currentMonth]);

  useEffect(() => {
    if (selectedDate && selectedDate !== todayStr) {
      fetchSelectedData(selectedDate);
    }
  }, [selectedDate]);

  const fetchGlobalData = async () => {
    try {
      const [analyticsRes, heatmapRes] = await Promise.all([
        getContributionAnalytics(),
        getContributionHeatmap(365), // Fetch enough data for calendar
      ]);
      setAnalytics(analyticsRes);
      setHeatmapData(heatmapRes);
    } catch (error) {
      console.error("Error fetching global data:", error);
    }
  };

  const fetchTodayData = async () => {
    setIsLoadingToday(true);
    try {
      const dailyRes = await getDailyContributions(todayStr);
      setTodaySummary(dailyRes);
    } catch (error) {
      console.error("Error fetching today data:", error);
    } finally {
      setIsLoadingToday(false);
    }
  };

  const fetchSelectedData = async (date: string) => {
    setIsLoadingSelected(true);
    try {
      const res = await getDailyContributions(date);
      setSelectedSummary(res);
    } catch (error) {
      console.error("Error fetching selected data:", error);
    } finally {
      setIsLoadingSelected(false);
    }
  };

  const handleCreate = async (e: React.FormEvent, targetDate: string) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    try {
      await createContribution({
        title: newTitle,
        notes: newNotes,
        weight: newWeight,
        scheduled_date: targetDate,
      });
      setNewTitle("");
      setNewNotes("");
      setNewWeight("normal");
      
      fetchGlobalData();
      if (targetDate === todayStr) fetchTodayData();
      if (selectedDate === targetDate) fetchSelectedData(targetDate);
    } catch (error) {
      console.error("Error creating contribution:", error);
    }
  };

  const startEditing = (c: DailyContribution) => {
    setEditingId(c.id);
    setEditTitle(c.title);
    setEditNotes(c.notes || "");
    setEditWeight(c.weight);
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number, targetDate: string) => {
    if (!editTitle.trim()) return;
    try {
      await updateContribution(id, {
        title: editTitle,
        notes: editNotes,
        weight: editWeight,
      });
      setEditingId(null);
      
      fetchGlobalData();
      if (targetDate === todayStr) fetchTodayData();
      if (selectedDate === targetDate) fetchSelectedData(targetDate);
    } catch (error) {
      console.error("Error updating contribution:", error);
    }
  };

  const toggleComplete = async (contrib: DailyContribution, listDate: string) => {
    try {
      if (contrib.completed) {
        await markContributionUncomplete(contrib.id);
      } else {
        await markContributionComplete(contrib.id);
      }
      fetchGlobalData();
      if (listDate === todayStr) fetchTodayData();
      if (selectedDate === listDate) fetchSelectedData(listDate);
    } catch (error) {
      console.error("Error toggling completion:", error);
    }
  };

  const handleDelete = async (id: number, listDate: string) => {
    try {
      await deleteContribution(id);
      fetchGlobalData();
      if (listDate === todayStr) fetchTodayData();
      if (selectedDate === listDate) fetchSelectedData(listDate);
    } catch (error) {
      console.error("Error deleting contribution:", error);
    }
  };

  // Calendar Logic
  const getCalendarDays = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 (Sun) to 6 (Sat)
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    
    // Empty padding for first week
    for (let i = 0; i < (firstDayOfMonth === 0 ? 6 : firstDayOfMonth - 1); i++) {
      days.push(null);
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
      const d = new Date(year, month, i);
      const dateStr = d.toLocaleDateString("en-CA");
      days.push({
        date: dateStr,
        dayNum: i,
        count: heatmapData[dateStr] || 0,
      });
    }
    return days;
  };

  const calendarDays = useMemo(() => getCalendarDays(), [currentMonth, heatmapData]);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getHeatmapColor = (count: number) => {
    if (count === 0) return "bg-white/5 border-transparent";
    if (count === 1) return "bg-green-500/30 border-green-500/10";
    if (count === 2) return "bg-green-500/60 border-green-500/30";
    if (count >= 3) return "bg-green-500/90 border-green-500/50";
    return "bg-white/5 border-transparent";
  };

  const renderContributionList = (
    summary: DailyContributionsSummary | null, 
    isLoading: boolean, 
    listDate: string
  ) => {
    if (isLoading) return <p className="text-center text-on-surface-variant text-sm py-8">Loading...</p>;
    
    if (!summary || summary.contributions.length === 0) {
      return (
        <div className="text-center py-10">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/5 shadow-inner">
            <CheckCircle2 className="w-8 h-8 text-on-surface-variant/40" />
          </div>
          <p className="text-sm font-medium text-on-surface-variant mb-1">No contributions yet.</p>
          <p className="text-xs text-on-surface-variant/60">Log your first task above to start building your streak!</p>
        </div>
      );
    }

    const completed = summary.contributions.filter(c => c.completed);
    const pending = summary.contributions.filter(c => !c.completed);
    const sorted = [...pending, ...completed];

    return (
      <div className="space-y-3">
        {sorted.map((c) => (
          <div
            key={c.id}
            className={cn(
              "group flex flex-col p-3.5 rounded-xl border transition-all",
              c.completed ? "bg-white/[0.02] border-transparent" : "bg-surface-variant border-white/5 hover:border-white/10"
            )}
          >
            {editingId === c.id ? (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="bg-background/50 border border-white/10 rounded-md px-2 py-1 text-sm text-on-surface focus:outline-none focus:border-primary"
                />
                <input
                  type="text"
                  placeholder="Optional notes..."
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  className="bg-background/50 border border-white/10 rounded-md px-2 py-1 text-xs text-on-surface-variant focus:outline-none focus:border-primary"
                />
                <div className="flex items-center justify-between mt-1">
                  <select
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value as any)}
                    className="bg-background text-xs text-on-surface rounded-md px-2 py-1 outline-none border border-white/10"
                  >
                    <option value="low">Low Impact</option>
                    <option value="normal">Normal</option>
                    <option value="high">High Impact</option>
                  </select>
                  <div className="flex gap-2">
                    <button onClick={cancelEditing} className="p-1 hover:bg-white/10 rounded text-on-surface-variant">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => saveEdit(c.id, listDate)} className="p-1 hover:bg-green-500/20 text-green-400 rounded">
                      <CheckCircle2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <button onClick={() => toggleComplete(c, listDate)} className="mt-0.5 flex-shrink-0 text-on-surface-variant hover:text-primary transition-colors">
                  {c.completed ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-medium", c.completed ? "line-through text-on-surface-variant/50" : "text-on-surface")}>
                    {c.title}
                  </p>
                  {c.notes && (
                    <p className={cn("text-xs mt-0.5", c.completed ? "text-on-surface-variant/40" : "text-on-surface-variant/80")}>
                      {c.notes}
                    </p>
                  )}
                  {c.weight !== "normal" && (
                    <span className={cn(
                      "inline-block mt-1.5 text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                      c.completed ? "opacity-50" : "",
                      c.weight === "high" ? "bg-orange-500/20 text-orange-400" : "bg-blue-500/20 text-blue-400"
                    )}>
                      {c.weight}
                    </span>
                  )}
                </div>
                <div className="opacity-0 group-hover:opacity-100 flex flex-col gap-1 transition-opacity">
                  <button onClick={() => startEditing(c)} className="p-1.5 hover:bg-white/10 text-on-surface-variant hover:text-on-surface rounded-md">
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDelete(c.id, listDate)} className="p-1.5 hover:bg-red-500/20 text-on-surface-variant hover:text-red-400 rounded-md">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <main className="pt-24 pb-20 px-4 md:px-margin-desktop max-w-container-max mx-auto space-y-8">
      <header className="mb-4 text-center">
        <h1 className="font-headline-lg text-headline-lg md:text-display-xl md:font-display-xl text-on-surface text-center mb-2 tracking-tight">
          Daily Contributions
        </h1>
        <p className="text-on-surface-variant text-center max-w-2xl mx-auto mb-6">
          Track your meaningful work independent of focus timers.
        </p>
      </header>

      {/* Analytics Cards */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5 flex flex-col items-center shadow-lg">
          <Target className="w-8 h-8 text-blue-400 mb-3" />
          <p className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Completion Rate</p>
          <p className="text-3xl font-bold text-on-surface">{analytics?.completion_rate || 0}%</p>
        </div>
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5 flex flex-col items-center shadow-lg">
          <Flame className="w-8 h-8 text-orange-400 mb-3" />
          <p className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Current Streak</p>
          <p className="text-3xl font-bold text-on-surface">{analytics?.current_streak || 0} days</p>
        </div>
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5 flex flex-col items-center shadow-lg">
          <Award className="w-8 h-8 text-yellow-400 mb-3" />
          <p className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Total Points</p>
          <p className="text-3xl font-bold text-on-surface">{analytics?.total_points || 0}</p>
        </div>
        <div className="bg-surface-container rounded-2xl p-6 border border-white/5 flex flex-col items-center shadow-lg">
          <Calendar className="w-8 h-8 text-purple-400 mb-3" />
          <p className="text-on-surface-variant text-xs uppercase tracking-wider font-semibold mb-1">Best Weekday</p>
          <p className="text-3xl font-bold text-on-surface">{analytics?.best_weekday || "None"}</p>
        </div>
      </section>

      {/* Today & Scratchpad Section */}
      <div className="grid lg:grid-cols-[1fr_350px] gap-6">
        <section className="bg-surface-container rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col min-h-[400px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold tracking-tight text-on-surface">Today's Contributions</h2>
            <div className="bg-primary/20 text-primary px-3 py-1 rounded-full text-xs font-bold">
              {todaySummary?.completed || 0} / {todaySummary?.total || 0}
            </div>
          </div>

          <form onSubmit={(e) => handleCreate(e, todayStr)} className="mb-6 flex flex-col gap-3 p-4 bg-background/40 rounded-2xl border border-white/5 shadow-inner">
            <input
              type="text"
              placeholder="What did you achieve today?"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="w-full bg-transparent border-b border-white/10 px-2 py-2 text-sm text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-primary transition-colors"
              required
            />
            <input
              type="text"
              placeholder="Add optional notes..."
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              className="w-full bg-transparent px-2 py-1 text-xs text-on-surface-variant placeholder:text-on-surface-variant/30 focus:outline-none"
            />
            <div className="flex items-center justify-between mt-1 px-2">
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
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white disabled:opacity-50 hover:bg-blue-500 transition-colors shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </form>

          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {renderContributionList(todaySummary, isLoadingToday, todayStr)}
          </div>
        </section>

        <section className="bg-surface-container rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col min-h-[400px]">
          <h2 className="text-xl font-bold tracking-tight text-on-surface mb-2">Notes / Scratchpad</h2>
          <p className="text-xs text-on-surface-variant mb-4">A temporary place for your ideas and to-dos.</p>
          <textarea
            value={scratchpad}
            onChange={(e) => setScratchpad(e.target.value)}
            placeholder="- Fix authentication bug&#10;- Deploy backend..."
            className="flex-1 w-full bg-background/30 border border-white/5 rounded-xl p-4 text-sm text-on-surface resize-none focus:outline-none focus:border-primary/50 transition-colors custom-scrollbar"
          />
        </section>
      </div>

      {/* Calendar Navigation & Day Details */}
      <div className="grid lg:grid-cols-[1fr_350px] gap-6">
        <section className="bg-surface-container rounded-3xl p-6 md:p-8 border border-white/5 shadow-xl min-h-[400px]">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-xl font-bold tracking-tight text-on-surface">Contribution History</h2>
            <div className="flex items-center gap-4 bg-background/50 rounded-full p-1 border border-white/5">
              <button onClick={prevMonth} className="p-1.5 hover:bg-white/10 rounded-full text-on-surface transition-colors">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="text-sm font-semibold text-on-surface min-w-[100px] text-center">
                {currentMonth.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </span>
              <button onClick={nextMonth} className="p-1.5 hover:bg-white/10 rounded-full text-on-surface transition-colors">
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-7 gap-2 mb-2">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
              <div key={day} className="text-center text-xs font-semibold text-on-surface-variant/50 pb-2">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square rounded-xl" />;
              const isSelected = selectedDate === cell.date;
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(cell.date)}
                  className={cn(
                    "aspect-square rounded-xl border flex flex-col items-center justify-center gap-1 transition-all hover:scale-105",
                    getHeatmapColor(cell.count),
                    isSelected && "ring-2 ring-white ring-offset-2 ring-offset-surface-container scale-105"
                  )}
                >
                  <span className={cn(
                    "text-xs font-medium",
                    cell.count > 0 ? "text-white" : "text-on-surface-variant/50"
                  )}>
                    {cell.dayNum}
                  </span>
                  {cell.count > 0 && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white/70" />
                  )}
                </button>
              );
            })}
          </div>
        </section>

        <section className="bg-surface-container rounded-3xl p-6 border border-white/5 shadow-xl flex flex-col min-h-[400px]">
          {!selectedDate ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <Calendar className="w-12 h-12 text-on-surface-variant/20 mb-4" />
              <p className="text-on-surface text-lg font-medium mb-1">Select a Day</p>
              <p className="text-sm text-on-surface-variant">Click on any date in the calendar to view past contributions.</p>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold tracking-tight text-on-surface">
                  {new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </h2>
                <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-white/10 rounded-full text-on-surface-variant">
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="flex gap-4 mb-6">
                <div className="flex-1 bg-background/30 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-1">Score</p>
                  <p className="text-xl font-bold text-primary">{selectedSummary?.completion_rate || 0}%</p>
                </div>
                <div className="flex-1 bg-background/30 rounded-xl p-3 border border-white/5">
                  <p className="text-[10px] uppercase text-on-surface-variant font-bold mb-1">Completed</p>
                  <p className="text-xl font-bold text-on-surface">{selectedSummary?.completed || 0}/{selectedSummary?.total || 0}</p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar">
                {renderContributionList(selectedSummary, isLoadingSelected, selectedDate)}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
