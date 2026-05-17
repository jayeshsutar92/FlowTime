import { useEffect, useState } from "react";
import api from "../services/api";
import { Play, Pause, SkipForward, Volume2, Waves } from "lucide-react";
import { cn } from "../lib/utils";

type ApiTrack = {
  id: number;
  name: string;
  duration: number | null;
};

type Track = {
  id: number;
  title: string;
  duration_seconds: number;
  artist?: string;
  category?: string;
};

export default function Music() {
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);

  useEffect(() => {
    fetchQueue();
  }, []);

  const fetchQueue = async () => {
    try {
      const res = await api.get("/music/queue/");
      const mapped = (res.data.data as ApiTrack[]).map((track) => ({
        id: track.id,
        title: track.name,
        duration_seconds: track.duration ?? 0,
      }));
      setQueue(mapped);
    } catch (e) {}
  };

  const playPause = () => {
    setIsPlaying(!isPlaying);
  };

  const nextTrack = () => {
    setCurrentTrackIndex((prev) => (prev + 1) % queue.length);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const currentTrack = queue[currentTrackIndex];

  return (
    <main className="pt-24 pb-20 px-4 md:px-margin-desktop max-w-container-max mx-auto min-h-screen flex flex-col">
      <header className="mb-12">
        <h1 className="font-headline-lg text-headline-lg md:text-display-xl md:font-display-xl text-on-surface mb-2 tracking-tight flex items-center gap-4">
          <Waves className="w-10 h-10 text-primary" />
          Focus Ambience
        </h1>
        <p className="text-on-surface-variant max-w-2xl">Binaural beats, white noise, and lo-fi soundscapes designed to tune out distractions and instantly drop you into flow state.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter flex-1">
        {/* Main Player */}
        <div className="glass-card rounded-3xl p-10 flex flex-col items-center justify-center relative overflow-hidden group">
          <div className="absolute inset-0 bg-primary/5"></div>
          {isPlaying && (
            <div className="absolute inset-0 z-0 flex items-center justify-center opacity-50">
              <div className="w-[300px] h-[300px] bg-primary/20 rounded-full blur-[80px] animate-pulse"></div>
            </div>
          )}
          
          <div className="w-64 h-64 rounded-full border-4 border-white/10 mb-10 flex items-center justify-center relative z-10 shadow-2xl overflow-hidden bg-surface-container-high relative">
             <div className={cn(
                "w-full h-full rounded-full transition-transform duration-1000",
                isPlaying ? "scale-105" : "scale-100"
             )}></div>
             {/* Abstract Album Art */}
             <div className="absolute inset-0 bg-gradient-to-tr from-surface-container to-surface-container-lowest mesh-bg"></div>
             <Waves className={cn("absolute text-primary w-20 h-20", isPlaying ? "animate-pulse" : "")} strokeWidth={1} />
          </div>

          <div className="text-center mb-10 relative z-10 w-full">
            <h2 className="text-2xl font-bold text-on-surface tracking-tight mb-2">
              {currentTrack ? currentTrack.title : "No Track Selected"}
            </h2>
            <p className="text-on-surface-variant text-sm uppercase tracking-widest font-label-sm">
              {currentTrack?.category || "Ambient Sounds"}
            </p>
          </div>

          <div className="flex items-center gap-6 relative z-10">
            <button className="text-on-surface-variant hover:text-on-surface transition-colors p-2">
              <Volume2 className="w-5 h-5" />
            </button>
            <button 
              onClick={playPause}
              disabled={queue.length === 0}
              className="w-16 h-16 bg-primary text-on-primary rounded-full flex justify-center items-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_20px_rgba(37,99,235,0.4)] disabled:opacity-50"
            >
              {isPlaying ? <Pause className="w-6 h-6" fill="currentColor" /> : <Play className="w-6 h-6 ml-1" fill="currentColor" />}
            </button>
            <button 
              onClick={nextTrack}
              disabled={queue.length <= 1}
              className="text-on-surface-variant hover:text-on-surface transition-colors p-2 disabled:opacity-50"
            >
              <SkipForward className="w-6 h-6" fill="currentColor" />
            </button>
          </div>
        </div>

        {/* Up Next List */}
        <div className="glass-card rounded-3xl p-8 flex flex-col h-full">
          <h3 className="font-label-sm text-sm text-on-surface-variant uppercase tracking-widest mb-6 px-2">Up Next</h3>
          
          <div className="flex-1 overflow-y-auto pr-2 space-y-2">
            {queue.map((track, idx) => (
              <div 
                key={track.id}
                onClick={() => {
                  setCurrentTrackIndex(idx);
                  setIsPlaying(true);
                }}
                className={cn(
                  "p-4 rounded-xl flex items-center justify-between cursor-pointer transition-all border",
                  idx === currentTrackIndex 
                    ? "bg-primary/10 border-primary/30 text-primary" 
                    : "bg-surface-container-low border-white/5 text-on-surface hover:bg-surface-container hover:border-white/10"
                )}
              >
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center border font-bold text-sm",
                    idx === currentTrackIndex ? "bg-primary text-on-primary border-primary" : "bg-surface-variant border-white/10"
                  )}>
                    {idx === currentTrackIndex && isPlaying ? <div className="flex items-end gap-0.5 h-3"><div className="w-0.5 h-full bg-current animate-bounce" style={{animationDelay: '0ms'}}></div><div className="w-0.5 h-1/2 bg-current animate-bounce" style={{animationDelay: '100ms'}}></div><div className="w-0.5 h-3/4 bg-current animate-bounce" style={{animationDelay: '200ms'}}></div></div> : idx + 1}
                  </div>
                  <div>
                    <h4 className="font-medium">{track.title}</h4>
                    <p className={cn("text-xs mt-0.5", idx === currentTrackIndex ? "text-primary/70" : "text-on-surface-variant")}>
                      {track.category || "Ambient"}
                    </p>
                  </div>
                </div>
                <div className="font-label-sm text-sm tabular-nums">
                  {formatTime(track.duration_seconds)}
                </div>
              </div>
            ))}
            
            {queue.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant space-y-4">
                <Waves className="w-12 h-12 opacity-20" />
                <p>No tracks loaded</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
