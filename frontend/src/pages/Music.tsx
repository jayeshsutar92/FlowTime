import { useState } from "react";
import { useMusic, Track } from "../contexts/MusicContext";
import { Play, Pause, Heart, Trash2, Plus, Upload, ListMusic, ArrowUp, ArrowDown, Waves, PlusCircle, Check } from "lucide-react";
import { cn } from "../lib/utils";

type ActiveTab = "library" | "playlists" | "favorites";

export default function Music() {
  const {
    tracks,
    playlists,
    favorites,
    queue,
    currentTrack,
    isPlaying,
    loading,
    error,
    play,
    pause,
    uploadTracks,
    createPlaylist,
    deletePlaylist,
    toggleFavorite,
    addToQueue,
    addPlaylistToQueue,
    removeFromQueue,
    reorderQueue,
  } = useMusic();

  const [activeTab, setActiveTab] = useState<ActiveTab>("library");
  const [uploading, setUploading] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [playlistTrackIds, setPlaylistTrackIds] = useState<number[]>([]);
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setUploading(true);
      try {
        await uploadTracks(e.target.files);
      } catch (err) {
      } finally {
        setUploading(false);
      }
    }
  };

  const handleCreatePlaylistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    await createPlaylist(newPlaylistName.trim(), playlistTrackIds);
    setNewPlaylistName("");
    setPlaylistTrackIds([]);
    setShowCreatePlaylist(false);
  };

  const toggleTrackSelectForPlaylist = (trackId: number) => {
    setPlaylistTrackIds((prev) =>
      prev.includes(trackId) ? prev.filter((id) => id !== trackId) : [...prev, trackId]
    );
  };

  const moveQueueItem = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex >= 0 && newIndex < queue.length) {
      await reorderQueue(index, newIndex);
    }
  };

  return (
    <main className="pt-24 pb-32 px-4 md:px-margin-desktop max-w-container-max mx-auto min-h-screen flex flex-col">
      <header className="mb-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline-lg text-headline-lg md:text-display-xl md:font-display-xl text-on-surface mb-2 tracking-tight flex items-center gap-4">
            <Waves className="w-10 h-10 text-primary" />
            Focus Ambience
          </h1>
          <p className="text-on-surface-variant max-w-2xl">
            Binaural beats, white noise, and lo-fi soundscapes designed to tune out distractions and instantly drop you into flow state.
          </p>
        </div>

        {/* Upload Button */}
        <label className={cn(
          "flex items-center gap-2 px-5 h-12 bg-primary text-on-primary rounded-xl font-medium cursor-pointer transition-all hover:scale-102 active:scale-98 shadow-lg shadow-primary/20 self-start md:self-auto",
          (uploading || loading) && "opacity-50 pointer-events-none"
        )}>
          <Upload className="w-4 h-4" />
          {uploading ? "Uploading..." : "Upload Tracks"}
          <input
            type="file"
            multiple
            accept="audio/*"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
      </header>

      {/* Global Error Display */}
      {error && (
        <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-gutter flex-1 items-start">
        {/* Left/Middle Content Panel: library, playlists, favorites */}
        <div className="lg:col-span-2 flex flex-col h-full space-y-6">
          {/* Tab buttons */}
          <div className="flex border-b border-white/5 pb-px gap-6">
            {(["library", "playlists", "favorites"] as ActiveTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "pb-4 text-sm font-semibold capitalize transition-all border-b-2 relative -bottom-0.5",
                  activeTab === tab
                    ? "border-primary text-primary"
                    : "border-transparent text-on-surface-variant hover:text-on-surface"
                )}
              >
                {tab === "library" ? "Audio Library" : tab}
              </button>
            ))}
          </div>

          {/* Tab contents */}
          <div className="flex-1">
            {activeTab === "library" && (
              <div className="space-y-3">
                {tracks.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onPlay={() => play(track)}
                    onPause={pause}
                    onFavorite={() => toggleFavorite(track.id)}
                    onAddToQueue={() => addToQueue(track.id)}
                    isFavorited={favorites.some((f) => f.id === track.id)}
                  />
                ))}
                {tracks.length === 0 && (
                  <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-primary text-sm flex items-center justify-center gap-2">
                    <Waves className="w-5 h-5 animate-pulse" />
                    <span>No tracks added. Add music to start listening.</span>
                  </div>
                )}
              </div>
            )}

            {activeTab === "playlists" && (
              <div className="space-y-6">
                {/* Playlist Creation Header */}
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-bold text-on-surface">Your Playlists</h3>
                  <button
                    onClick={() => setShowCreatePlaylist(!showCreatePlaylist)}
                    className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                  >
                    <PlusCircle className="w-4 h-4" />
                    Create Playlist
                  </button>
                </div>

                {/* Inline Create Playlist Form */}
                {showCreatePlaylist && (
                  <form onSubmit={handleCreatePlaylistSubmit} className="glass-card rounded-2xl p-6 space-y-4 border border-white/5">
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Playlist Name</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Deep Work Lo-fi"
                        value={newPlaylistName}
                        onChange={(e) => setNewPlaylistName(e.target.value)}
                        className="w-full h-11 bg-surface-container rounded-xl px-4 text-sm border border-white/5 focus:border-primary focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">Select Tracks</label>
                      <div className="max-h-48 overflow-y-auto border border-white/5 rounded-xl divide-y divide-white/5">
                        {tracks.map((track) => (
                          <div
                            key={track.id}
                            onClick={() => toggleTrackSelectForPlaylist(track.id)}
                            className="flex items-center justify-between p-3 cursor-pointer hover:bg-surface-container/50 text-sm"
                          >
                            <span className="truncate">{track.name}</span>
                            <div className={cn(
                              "w-5 h-5 rounded border flex items-center justify-center transition-all",
                              playlistTrackIds.includes(track.id)
                                ? "bg-primary border-primary text-on-primary"
                                : "border-white/20"
                            )}>
                              {playlistTrackIds.includes(track.id) && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowCreatePlaylist(false)}
                        className="px-4 h-10 rounded-xl text-sm font-semibold hover:bg-white/5 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-5 h-10 rounded-xl bg-primary text-on-primary text-sm font-semibold hover:scale-102 active:scale-98 transition-all"
                      >
                        Save Playlist
                      </button>
                    </div>
                  </form>
                )}

                {/* Playlist listing */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {playlists.map((playlist) => (
                    <div key={playlist.id} className="glass-card rounded-2xl p-5 border border-white/5 flex flex-col justify-between group">
                      <div>
                        <h4 className="font-bold text-on-surface text-base truncate mb-1">{playlist.name}</h4>
                        <p className="text-xs text-on-surface-variant">{playlist.tracks?.length || 0} tracks</p>
                      </div>
                      <div className="flex items-center justify-between mt-5 pt-3 border-t border-white/5">
                        <button
                          onClick={() => addPlaylistToQueue(playlist.id)}
                          className="flex items-center gap-1.5 text-xs text-primary font-medium hover:underline"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          Play Playlist
                        </button>
                        <button
                          onClick={() => deletePlaylist(playlist.id)}
                          className="text-on-surface-variant hover:text-error transition-colors p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {playlists.length === 0 && (
                    <div className="col-span-full">
                      <EmptyState message="No playlists created yet." />
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === "favorites" && (
              <div className="space-y-3">
                {favorites.map((track) => (
                  <TrackRow
                    key={track.id}
                    track={track}
                    currentTrack={currentTrack}
                    isPlaying={isPlaying}
                    onPlay={() => play(track)}
                    onPause={pause}
                    onFavorite={() => toggleFavorite(track.id)}
                    onAddToQueue={() => addToQueue(track.id)}
                    isFavorited={true}
                  />
                ))}
                {favorites.length === 0 && (
                  <EmptyState message="No favorite tracks added yet." />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Content Panel: active queue */}
        <div className="glass-card rounded-3xl p-6 border border-white/5 flex flex-col h-[600px]">
          <div className="flex items-center justify-between mb-6 px-1">
            <h3 className="font-semibold text-sm text-on-surface-variant uppercase tracking-widest flex items-center gap-2">
              <ListMusic className="w-4 h-4 text-primary" />
              Active Queue
            </h3>
            <span className="text-xs text-on-surface-variant font-medium">{queue.length} Tracks</span>
          </div>

          <div className="flex-1 overflow-y-auto pr-1 space-y-2">
            {queue.map((track, idx) => {
              const isCurrent = currentTrack?.id === track.id;
              return (
                <div
                  key={`${track.id}-${idx}`}
                  className={cn(
                    "p-3 rounded-xl flex items-center justify-between border group transition-all",
                    isCurrent
                      ? "bg-primary/10 border-primary/20 text-primary"
                      : "bg-surface-container-low border-white/5 text-on-surface hover:bg-surface-container hover:border-white/10"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs text-on-surface-variant/50 w-4 text-center">{idx + 1}</span>
                    <div className="min-w-0">
                      <h4 className="font-semibold text-sm truncate leading-snug">{track.name}</h4>
                      <p className={cn("text-xxs mt-0.5", isCurrent ? "text-primary/70" : "text-on-surface-variant")}>
                        {track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, "0")}` : "0:00"}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => moveQueueItem(idx, "up")}
                      disabled={idx === 0}
                      className="p-1 hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => moveQueueItem(idx, "down")}
                      disabled={idx === queue.length - 1}
                      className="p-1 hover:text-on-surface disabled:opacity-30 disabled:pointer-events-none transition-colors"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => removeFromQueue(idx)}
                      className="p-1 hover:text-error transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {queue.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-on-surface-variant space-y-4 pt-10">
                <Waves className="w-12 h-12 opacity-20" />
                <p className="text-sm">Queue is empty</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

// Track Row Sub-component
type TrackRowProps = {
  track: Track;
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onFavorite: () => void;
  onAddToQueue: () => void;
  isFavorited: boolean;
};

const TrackRow: React.FC<TrackRowProps> = ({
  track,
  currentTrack,
  isPlaying,
  onPlay,
  onPause,
  onFavorite,
  onAddToQueue,
  isFavorited,
}) => {
  const isCurrent = currentTrack?.id === track.id;

  const formatDuration = (secs: number | null) => {
    if (!secs) return "0:00";
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className={cn(
      "p-4 rounded-xl flex items-center justify-between border transition-all group",
      isCurrent
        ? "bg-primary/5 border-primary/20"
        : "bg-surface-container-low border-white/5 hover:bg-surface-container hover:border-white/10"
    )}>
      <div className="flex items-center gap-4 min-w-0">
        <button
          onClick={isCurrent && isPlaying ? onPause : onPlay}
          className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0 border border-white/5",
            isCurrent
              ? "bg-primary text-on-primary border-primary shadow-lg shadow-primary/20"
              : "bg-surface-container-high text-on-surface group-hover:bg-primary group-hover:text-on-primary group-hover:border-primary"
          )}
        >
          {isCurrent && isPlaying ? (
            <Pause className="w-4 h-4" fill="currentColor" />
          ) : (
            <Play className="w-4 h-4 ml-0.5" fill="currentColor" />
          )}
        </button>

        <div className="min-w-0">
          <h4 className={cn("font-medium text-sm truncate", isCurrent ? "text-primary" : "text-on-surface")}>
            {track.name}
          </h4>
          <p className="text-xs text-on-surface-variant truncate mt-0.5">Focus Ambience</p>
        </div>
      </div>

      <div className="flex items-center gap-4 flex-shrink-0">
        <span className="text-xs text-on-surface-variant tabular-nums">{formatDuration(track.duration)}</span>
        
        {/* Track actions */}
        <div className="flex items-center gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
          <button
            onClick={onFavorite}
            className="p-2 text-on-surface-variant hover:text-primary transition-colors"
          >
            <Heart className="w-4 h-4" fill={isFavorited ? "currentColor" : "none"} color={isFavorited ? "var(--color-primary)" : "currentColor"} />
          </button>
          <button
            onClick={onAddToQueue}
            className="p-2 text-on-surface-variant hover:text-primary transition-colors"
            title="Add to queue"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

const EmptyState = ({ message }: { message: string }) => (
  <div className="text-center p-8 rounded-2xl bg-surface-container-low border border-white/5 text-on-surface-variant">
    <p className="text-sm">{message}</p>
  </div>
);
