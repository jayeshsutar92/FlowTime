import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import api from "../services/api";

export type Track = {
  id: number;
  name: string;
  file_path: string;
  audio_url: string | null;
  duration: number | null;
  created_at: string;
  isFavorite?: boolean;
};

export type Playlist = {
  id: number;
  name: string;
  tracks: { track: Track; position: number }[];
  created_at: string;
};

type RepeatMode = "off" | "track" | "queue";

type MusicContextType = {
  tracks: Track[];
  playlists: Playlist[];
  favorites: Track[];
  queue: Track[];
  currentTrack: Track | null;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  loading: boolean;
  error: string | null;
  
  // Controls
  play: (track?: Track) => Promise<void>;
  pause: () => Promise<void>;
  next: () => Promise<void>;
  previous: () => Promise<void>;
  seek: (seconds: number) => void;
  setVolume: (vol: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => Promise<void>;
  setRepeat: (mode: RepeatMode) => Promise<void>;
  
  // Library / Uploads
  uploadTracks: (files: FileList) => Promise<void>;
  refreshTracks: () => Promise<void>;
  
  // Playlists
  createPlaylist: (name: string, trackIds: number[]) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  updatePlaylist: (id: number, name?: string, trackIds?: number[]) => Promise<void>;
  refreshPlaylists: () => Promise<void>;
  
  // Favorites
  toggleFavorite: (trackId: number) => Promise<void>;
  refreshFavorites: () => Promise<void>;
  
  // Queue
  addToQueue: (trackId: number) => Promise<void>;
  addPlaylistToQueue: (playlistId: number) => Promise<void>;
  removeFromQueue: (position: number) => Promise<void>;
  reorderQueue: (oldIndex: number, newIndex: number) => Promise<void>;
  refreshQueue: () => Promise<void>;
};

const MusicContext = createContext<MusicContextType | undefined>(undefined);

export const MusicProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [favorites, setFavorites] = useState<Track[]>([]);
  const [queue, setQueue] = useState<Track[]>([]);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeatState] = useState<RepeatMode>("off");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const syncTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Audio
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;
    audio.volume = volume;

    const handleTimeUpdate = () => {
      setProgress(audio.currentTime);
    };

    const handleDurationChange = () => {
      setDuration(audio.duration || 0);
    };

    const handleEnded = () => {
      handleTrackEnded();
    };

    const handleError = () => {
      setError("Error playing audio stream.");
      setIsPlaying(false);
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("durationchange", handleDurationChange);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("error", handleError);

    // Initial data load
    loadInitialData();

    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("durationchange", handleDurationChange);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("error", handleError);
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
    };
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        refreshTracks(),
        refreshPlaylists(),
        refreshFavorites(),
        refreshQueue(),
      ]);
      await fetchPlaybackState();
    } catch (e) {
      setError("Failed to load music player data.");
    } finally {
      setLoading(false);
    }
  };

  // Sync progress with backend periodically
  useEffect(() => {
    if (isPlaying) {
      syncTimeoutRef.current = setInterval(() => {
        syncPlaybackState();
      }, 5000);
    } else {
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
    }
    return () => {
      if (syncTimeoutRef.current) {
        clearInterval(syncTimeoutRef.current);
      }
    };
  }, [isPlaying, progress]);

  const fetchPlaybackState = async () => {
    try {
      const res = await api.get("/music/queue/state/");
      const state = res.data.data;
      setShuffle(state.shuffle);
      setRepeatState(state.repeat);
      
      if (state.current_track) {
        const track: Track = state.current_track;
        setCurrentTrack(track);
        if (audioRef.current) {
          audioRef.current.src = track.audio_url || "";
          audioRef.current.currentTime = state.progress_seconds || 0;
          setProgress(state.progress_seconds || 0);
        }
      }
    } catch (e) {}
  };

  const syncPlaybackState = async () => {
    if (!audioRef.current) return;
    try {
      await api.post("/music/queue/state/", {
        is_playing: isPlaying,
        progress_seconds: Math.floor(audioRef.current.currentTime),
      });
    } catch (e) {}
  };

  const handleTrackEnded = async () => {
    if (repeat === "track") {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {});
      }
    } else {
      await next();
    }
  };

  const refreshTracks = async () => {
    const res = await api.get("/music/tracks/");
    setTracks(res.data.data);
  };

  const refreshPlaylists = async () => {
    const res = await api.get("/music/playlists/");
    setPlaylists(res.data.data);
  };

  const refreshFavorites = async () => {
    const res = await api.get("/music/favorites/");
    const favs = res.data.data.map((f: any) => f.track);
    setFavorites(favs);
  };

  const refreshQueue = async () => {
    const res = await api.get("/music/queue/");
    setQueue(res.data.data);
  };

  // Playback Control Implementation
  const play = async (track?: Track) => {
    if (!audioRef.current) return;
    setError(null);

    try {
      if (track) {
        // Find if this track is in queue, if not add it
        const isInQueue = queue.some((q) => q.id === track.id);
        if (!isInQueue) {
          await addToQueue(track.id);
        }
        
        // Find index of the track in the updated queue
        const updatedQueueRes = await api.get("/music/queue/");
        const updatedQueue: Track[] = updatedQueueRes.data.data;
        const index = updatedQueue.findIndex((q) => q.id === track.id);
        
        setCurrentTrack(track);
        audioRef.current.src = track.audio_url || "";
        audioRef.current.currentTime = 0;

        // Sync with backend before playing
        await api.post("/music/queue/state/", {
          is_playing: true,
          progress_seconds: 0,
          current_index: index >= 0 ? index : 0,
        });
      } else {
        await api.post("/music/queue/state/", { is_playing: true });
      }

      await audioRef.current.play();
      setIsPlaying(true);
    } catch (e) {
      setError("Playback failed. Please try again.");
      setIsPlaying(false);
    }
  };

  const pause = async () => {
    if (!audioRef.current) return;
    audioRef.current.pause();
    setIsPlaying(false);
    try {
      await api.post("/music/queue/state/", { is_playing: false });
    } catch (e) {}
  };

  const next = async () => {
    if (!audioRef.current) return;
    try {
      const res = await api.post("/music/queue/next/");
      const track = res.data.data;
      if (track) {
        setCurrentTrack(track);
        audioRef.current.src = track.audio_url || "";
        audioRef.current.currentTime = 0;
        if (isPlaying) {
          await audioRef.current.play();
        }
        // Sync queue index change
        await refreshQueue();
        await fetchPlaybackState();
      } else {
        // Reached end of queue or queue empty
        setIsPlaying(false);
        audioRef.current.pause();
      }
    } catch (e) {
      setError("Failed to skip forward.");
    }
  };

  const previous = async () => {
    if (!audioRef.current) return;
    try {
      const res = await api.post("/music/queue/previous/");
      const track = res.data.data;
      if (track) {
        setCurrentTrack(track);
        audioRef.current.src = track.audio_url || "";
        audioRef.current.currentTime = 0;
        if (isPlaying) {
          await audioRef.current.play();
        }
        await refreshQueue();
        await fetchPlaybackState();
      }
    } catch (e) {
      setError("Failed to skip backward.");
    }
  };

  const seek = (seconds: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = seconds;
    setProgress(seconds);
  };

  const setVolume = (vol: number) => {
    if (!audioRef.current) return;
    audioRef.current.volume = vol;
    setVolumeState(vol);
    if (vol > 0 && isMuted) {
      setIsMuted(false);
      audioRef.current.muted = false;
    }
  };

  const toggleMute = () => {
    if (!audioRef.current) return;
    const muted = !isMuted;
    audioRef.current.muted = muted;
    setIsMuted(muted);
  };

  const toggleShuffle = async () => {
    try {
      const res = await api.post("/music/queue/shuffle/");
      setShuffle(res.data.data.shuffle);
    } catch (e) {
      setError("Failed to toggle shuffle.");
    }
  };

  const setRepeat = async (mode: RepeatMode) => {
    try {
      const res = await api.post("/music/queue/repeat/", { mode });
      setRepeatState(res.data.data.repeat);
    } catch (e) {
      setError("Failed to update repeat mode.");
    }
  };

  // Upload tracks
  const uploadTracks = async (files: FileList) => {
    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
      formData.append("file", files[i]);
    }
    
    setLoading(true);
    try {
      await api.post("/music/upload/", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      await refreshTracks();
    } catch (e) {
      setError("Failed to upload audio files.");
      throw e;
    } finally {
      setLoading(false);
    }
  };

  // Playlists
  const createPlaylist = async (name: string, trackIds: number[]) => {
    try {
      await api.post("/music/playlists/", { name, track_ids: trackIds });
      await refreshPlaylists();
    } catch (e) {
      setError("Failed to create playlist.");
    }
  };

  const deletePlaylist = async (id: number) => {
    try {
      await api.delete(`/music/playlists/${id}/`);
      await refreshPlaylists();
    } catch (e) {
      setError("Failed to delete playlist.");
    }
  };

  const updatePlaylist = async (id: number, name?: string, trackIds?: number[]) => {
    try {
      await api.put(`/music/playlists/${id}/`, { name, track_ids: trackIds });
      await refreshPlaylists();
    } catch (e) {
      setError("Failed to update playlist.");
    }
  };

  // Favorites
  const toggleFavorite = async (trackId: number) => {
    const isFav = favorites.some((f) => f.id === trackId);
    try {
      if (isFav) {
        await api.post("/music/favorites/remove/", { track_id: trackId });
      } else {
        await api.post("/music/favorites/add/", { track_id: trackId });
      }
      await refreshFavorites();
    } catch (e) {
      setError("Failed to update favorites.");
    }
  };

  // Queue Operations
  const addToQueue = async (trackId: number) => {
    try {
      await api.post("/music/queue/add/", { track_id: trackId });
      await refreshQueue();
    } catch (e) {
      setError("Failed to add track to queue.");
    }
  };

  const addPlaylistToQueue = async (playlistId: number) => {
    try {
      await api.post("/music/queue/add/", { playlist_id: playlistId });
      await refreshQueue();
      // Start playing the first track of the playlist if nothing is playing
      if (!currentTrack) {
        const updatedQ = await api.get("/music/queue/");
        if (updatedQ.data.data.length > 0) {
          await play(updatedQ.data.data[0]);
        }
      }
    } catch (e) {
      setError("Failed to add playlist to queue.");
    }
  };

  const removeFromQueue = async (position: number) => {
    try {
      await api.post("/music/queue/remove/", { position });
      await refreshQueue();
    } catch (e) {
      setError("Failed to remove track from queue.");
    }
  };

  const reorderQueue = async (oldIndex: number, newIndex: number) => {
    try {
      await api.post("/music/queue/reorder/", {
        old_position: oldIndex,
        new_position: newIndex,
      });
      await refreshQueue();
    } catch (e) {
      setError("Failed to reorder queue.");
    }
  };

  return (
    <MusicContext.Provider
      value={{
        tracks,
        playlists,
        favorites,
        queue,
        currentTrack,
        isPlaying,
        progress,
        duration,
        volume,
        isMuted,
        shuffle,
        repeat,
        loading,
        error,
        play,
        pause,
        next,
        previous,
        seek,
        setVolume,
        toggleMute,
        toggleShuffle,
        setRepeat,
        uploadTracks,
        refreshTracks,
        createPlaylist,
        deletePlaylist,
        updatePlaylist,
        refreshPlaylists,
        toggleFavorite,
        refreshFavorites,
        addToQueue,
        addPlaylistToQueue,
        removeFromQueue,
        reorderQueue,
        refreshQueue,
      }}
    >
      {children}
    </MusicContext.Provider>
  );
};

export const useMusic = () => {
  const context = useContext(MusicContext);
  if (context === undefined) {
    throw new Error("useMusic must be used within a MusicProvider");
  }
  return context;
};
