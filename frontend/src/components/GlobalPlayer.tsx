import React from "react";
import { useMusic } from "../contexts/MusicContext";
import { Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Shuffle, RotateCw, Heart, Music as MusicIcon } from "lucide-react";
import { cn } from "../lib/utils";

export default function GlobalPlayer() {
  const {
    currentTrack,
    isPlaying,
    progress,
    duration,
    volume,
    isMuted,
    shuffle,
    repeat,
    play,
    pause,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    setRepeat,
    toggleFavorite,
    favorites,
  } = useMusic();

  if (!currentTrack) return null;

  const isFavorited = favorites.some((f) => f.id === currentTrack.id);

  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(Number(e.target.value));
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(Number(e.target.value));
  };

  const cycleRepeat = () => {
    if (repeat === "off") setRepeat("queue");
    else if (repeat === "queue") setRepeat("track");
    else setRepeat("off");
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 h-24 bg-surface-container-high/95 backdrop-blur-md border-t border-white/5 px-6 flex items-center justify-between shadow-2xl">
      {/* Track info */}
      <div className="flex items-center gap-4 w-1/4 min-w-[200px]">
        <div className="w-14 h-14 rounded-lg bg-surface-container flex items-center justify-center border border-white/5 flex-shrink-0 relative overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-secondary/20 mesh-bg"></div>
          <MusicIcon className={cn("w-6 h-6 text-primary z-10", isPlaying ? "animate-pulse" : "")} />
        </div>
        <div className="min-w-0">
          <h4 className="font-semibold text-on-surface truncate text-sm leading-snug">
            {currentTrack.name}
          </h4>
          <p className="text-xs text-on-surface-variant truncate mt-0.5">
            Focus Ambience
          </p>
        </div>
        <button
          onClick={() => toggleFavorite(currentTrack.id)}
          className="text-on-surface-variant hover:text-primary transition-colors p-1 ml-2 flex-shrink-0"
        >
          <Heart
            className="w-5 h-5"
            fill={isFavorited ? "currentColor" : "none"}
            color={isFavorited ? "var(--color-primary)" : "currentColor"}
          />
        </button>
      </div>

      {/* Playback Controls & Progress bar */}
      <div className="flex flex-col items-center gap-2 flex-1 max-w-xl px-4">
        {/* Playback buttons */}
        <div className="flex items-center gap-5">
          <button
            onClick={toggleShuffle}
            title="Shuffle"
            className={cn(
              "p-2 hover:text-on-surface transition-colors",
              shuffle ? "text-primary" : "text-on-surface-variant"
            )}
          >
            <Shuffle className="w-4 h-4" />
          </button>
          
          <button
            onClick={previous}
            className="p-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <SkipBack className="w-5 h-5" fill="currentColor" />
          </button>

          <button
            onClick={isPlaying ? pause : () => play()}
            className="w-10 h-10 bg-primary text-on-primary rounded-full flex justify-center items-center hover:scale-105 active:scale-95 transition-all shadow-[0_0_15px_rgba(37,99,235,0.3)]"
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" fill="currentColor" />
            ) : (
              <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
            )}
          </button>

          <button
            onClick={next}
            className="p-2 text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <SkipForward className="w-5 h-5" fill="currentColor" />
          </button>

          <button
            onClick={cycleRepeat}
            title={`Repeat mode: ${repeat}`}
            className={cn(
              "p-2 hover:text-on-surface transition-colors relative",
              repeat !== "off" ? "text-primary" : "text-on-surface-variant"
            )}
          >
            <RotateCw className="w-4 h-4" />
            {repeat === "track" && (
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-primary rounded-full"></span>
            )}
          </button>
        </div>

        {/* Progress seek slider */}
        <div className="w-full flex items-center gap-3 text-xs text-on-surface-variant">
          <span className="w-10 text-right tabular-nums">{formatTime(progress)}</span>
          <input
            type="range"
            min={0}
            max={duration || 100}
            value={progress}
            onChange={handleSeekChange}
            className="flex-1 h-1 rounded-lg bg-surface-container appearance-none cursor-pointer accent-primary hover:accent-primary-hover [&::-webkit-slider-runnable-track]:bg-surface-container [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-primary"
          />
          <span className="w-10 text-left tabular-nums">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume and extra options */}
      <div className="flex items-center gap-3 w-1/4 justify-end min-w-[150px]">
        <button
          onClick={toggleMute}
          className="text-on-surface-variant hover:text-on-surface transition-colors p-2"
        >
          {isMuted || volume === 0 ? (
            <VolumeX className="w-5 h-5 text-error" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={isMuted ? 0 : volume}
          onChange={handleVolumeChange}
          className="w-24 h-1 rounded-lg bg-surface-container appearance-none cursor-pointer accent-primary [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:bg-primary"
        />
      </div>
    </div>
  );
}
