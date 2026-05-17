import { useEffect, useState } from "react";
import api from "../services/api";
import { Trash2, Edit2, PlayCircle, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Preset = {
  id: number;
  name: string;
  work_duration: number;
  short_break: number;
  long_break: number;
  sessions_before_long_break: number;
};

export default function Presets() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchPresets();
  }, []);

  const fetchPresets = async () => {
    try {
      const res = await api.get("/presets/");
      setPresets(res.data.data);
    } catch (e) {}
  };

  const deletePreset = async (id: number) => {
    try {
      await api.delete(`/presets/${id}/`);
      fetchPresets();
    } catch (e) {}
  };

  return (
    <main className="pt-24 pb-20 px-4 md:px-margin-desktop max-w-container-max mx-auto">
      <div className="flex justify-between items-end mb-12">
        <header>
          <h1 className="font-headline-lg text-headline-lg md:text-display-xl md:font-display-xl text-on-surface mb-2 tracking-tight">Presets</h1>
          <p className="text-on-surface-variant max-w-2xl">Manage your personalized flow rhythms. Create setups for deep work, admin tasks, or reading.</p>
        </header>
        <button 
          onClick={() => navigate("/timer")}
          className="flex items-center gap-2 bg-primary hover:bg-blue-500 text-white px-6 py-3 rounded-full font-semibold text-sm hover:scale-[0.98] transition-transform shadow-lg shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          New Preset
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {presets.map((preset) => (
          <div key={preset.id} className="glass-card rounded-2xl p-8 hover:border-primary/40 transition-all group flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-start mb-6">
                <h3 className="font-headline-lg text-headline-lg text-on-surface group-hover:text-primary transition-colors">{preset.name}</h3>
              </div>
              <div className="grid grid-cols-3 gap-4 mb-8">
                <div className="bg-surface-container rounded-lg p-3 text-center border border-white/5">
                  <span className="block text-primary font-bold text-xl mb-1">{preset.work_duration}m</span>
                  <span className="text-[10px] uppercase font-label-sm tracking-wider text-on-surface-variant">Focus</span>
                </div>
                <div className="bg-surface-container rounded-lg p-3 text-center border border-white/5">
                  <span className="block text-tertiary font-bold text-xl mb-1">{preset.short_break}m</span>
                  <span className="text-[10px] uppercase font-label-sm tracking-wider text-on-surface-variant">Break</span>
                </div>
                <div className="bg-surface-container rounded-lg p-3 text-center border border-white/5">
                  <span className="block text-secondary font-bold text-xl mb-1">{preset.long_break}m</span>
                  <span className="text-[10px] uppercase font-label-sm tracking-wider text-on-surface-variant">Long Break</span>
                </div>
              </div>
            </div>
            
            <div className="flex justify-between items-center border-t border-white/5 pt-6 mt-auto">
              <button 
                onClick={() => navigate("/timer")}
                className="flex items-center gap-2 font-label-sm uppercase tracking-wider text-xs text-on-surface hover:text-primary transition-colors"
              >
                <PlayCircle className="w-4 h-4" /> Select
              </button>
              <button 
                onClick={() => deletePreset(preset.id)}
                className="text-on-surface-variant hover:text-error transition-colors p-2"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {presets.length === 0 && (
          <div className="md:col-span-2 lg:col-span-3 glass-card rounded-2xl p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
            <p className="text-on-surface-variant mb-4">No presets created yet.</p>
            <button 
              onClick={() => navigate("/timer")}
              className="text-primary hover:text-primary-fixed transition-colors underline"
            >
              Head to the Timer to create one
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
