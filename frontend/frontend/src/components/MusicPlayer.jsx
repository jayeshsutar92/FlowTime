import { useEffect, useMemo, useRef, useState } from "react";
import {
  enqueueMusicTrack,
  fetchMusicQueue,
  fetchMusicTracks,
  getApiErrorMessage,
  removeQueueItem,
  uploadMusicTrack,
} from "../api";
import QueueList from "./QueueList";
import TrackList from "./TrackList";

const MEDIA_BASE_URL = "http://127.0.0.1:8000";

const resolveTrackSource = (track, localSources) => {
  if (!track) {
    return null;
  }

  const localSource = localSources[track.id];
  if (localSource) {
    return localSource;
  }

  if (!track.file_path) {
    return null;
  }

  if (track.file_path.startsWith("http")) {
    return track.file_path;
  }

  if (track.file_path.startsWith("/")) {
    return `${MEDIA_BASE_URL}${track.file_path}`;
  }

  return `${MEDIA_BASE_URL}/${track.file_path}`;
};

function MusicPlayer() {
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);
  const localSourcesRef = useRef({});
  const [tracks, setTracks] = useState([]);
  const [queue, setQueue] = useState([]);
  const [currentTrack, setCurrentTrack] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isQueueLoading, setIsQueueLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [trackName, setTrackName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [localSources, setLocalSources] = useState({});

  const currentSource = useMemo(
    () => resolveTrackSource(currentTrack, localSources),
    [currentTrack, localSources]
  );

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [tracksResult, queueResult] = await Promise.all([
          fetchMusicTracks(),
          fetchMusicQueue(),
        ]);
        setTracks(Array.isArray(tracksResult) ? tracksResult : []);
        setQueue(Array.isArray(queueResult) ? queueResult : []);
      } catch (err) {
        console.error(err);
        setErrorMessage(getApiErrorMessage(err, "Could not load music data."));
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!queue.length) {
      setCurrentTrack(null);
      setIsPlaying(false);
      return;
    }

    if (!currentTrack) {
      setCurrentTrack(queue[0]);
      return;
    }

    if (!queue.some((track) => track.id === currentTrack.id)) {
      setCurrentTrack(queue[0]);
    }
  }, [queue, currentTrack]);

  useEffect(() => {
    const audio = audioRef.current;

    if (!audio) {
      return;
    }

    if (!currentSource) {
      audio.pause();
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    audio.src = currentSource;
    audio.load();
    setCurrentTime(0);

    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [currentSource, isPlaying]);

  useEffect(() => {
    if (currentTrack && !currentSource) {
      setIsPlaying(false);
    }
  }, [currentTrack, currentSource]);

  useEffect(() => {
    return () => {
      Object.values(localSourcesRef.current).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const syncQueue = async () => {
    setIsQueueLoading(true);
    setErrorMessage("");

    try {
      const data = await fetchMusicQueue();
      setQueue(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setErrorMessage(getApiErrorMessage(err, "Could not sync queue."));
    } finally {
      setIsQueueLoading(false);
    }
  };

  const handleAddToQueue = async (track) => {
    if (!track?.id) {
      return;
    }

    setIsQueueLoading(true);
    setErrorMessage("");

    try {
      await enqueueMusicTrack(track.id);
      await syncQueue();
    } catch (err) {
      console.error(err);
      setErrorMessage(getApiErrorMessage(err, "Could not add to queue."));
    } finally {
      setIsQueueLoading(false);
    }
  };

  const handleRemoveFromQueue = async (track) => {
    if (!track?.id) {
      return;
    }

    setIsQueueLoading(true);
    setErrorMessage("");

    try {
      await removeQueueItem(track.id);
      await syncQueue();
    } catch (err) {
      console.error(err);
      setErrorMessage(getApiErrorMessage(err, "Could not remove from queue."));
    } finally {
      setIsQueueLoading(false);
    }
  };

  const handleUpload = async (event) => {
    event.preventDefault();
    setErrorMessage("");

    if (!trackName && !selectedFile) {
      setErrorMessage("Provide a track name or file.");
      return;
    }

    try {
      const data = await uploadMusicTrack({ name: trackName, file: selectedFile });
      const newTrack = {
        id: data?.track_id ?? data?.id,
        name: data?.name ?? ( trackName || selectedFile?.name ),
        file_path: selectedFile ? selectedFile.name : null,
      };

      if (newTrack.id) {
        setTracks((current) => [...current, newTrack]);
      }

      if (selectedFile && newTrack.id) {
        const objectUrl = URL.createObjectURL(selectedFile);
        setLocalSources((current) => {
          const nextSources = {
            ...current,
            [newTrack.id]: objectUrl,
          };
          localSourcesRef.current = nextSources;
          return nextSources;
        });
      }

      setTrackName("");
      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error(err);
      setErrorMessage(getApiErrorMessage(err, "Could not upload track."));
    }
  };

  const handlePlayPause = () => {
    const audio = audioRef.current;

    if (!audio || !currentSource) {
      return;
    }

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleNext = () => {
    if (!queue.length) {
      setIsPlaying(false);
      return;
    }

    const currentIndex = currentTrack
      ? queue.findIndex((track) => track.id === currentTrack.id)
      : -1;

    if (currentIndex === -1) {
      setCurrentTrack(queue[0]);
      setIsPlaying(true);
      return;
    }

    if (currentIndex >= queue.length - 1) {
      setIsPlaying(false);
      return;
    }

    setCurrentTrack(queue[currentIndex + 1]);
    setIsPlaying(true);
  };

  const handlePrevious = () => {
    if (!queue.length) {
      return;
    }

    const currentIndex = currentTrack
      ? queue.findIndex((track) => track.id === currentTrack.id)
      : -1;

    if (currentIndex <= 0) {
      return;
    }

    setCurrentTrack(queue[currentIndex - 1]);
    setIsPlaying(true);
  };

  const handleProgressChange = (event) => {
    const audio = audioRef.current;
    const nextTime = Number(event.target.value);

    if (!audio || Number.isNaN(nextTime)) {
      return;
    }

    audio.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  return (
    <section className="w-full min-w-0 flex flex-col gap-4">
      <div className="music-player-header">
        <h2 className="section-title">Music Player</h2>
      </div>

      {isLoading ? <p className="feedback-message">Loading music...</p> : null}
      {errorMessage ? (
        <p className="feedback-message error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="music-player-bar">
        <div className="music-track-info">
          <p className="music-track-title">
            {currentTrack?.name || "No track selected"}
          </p>
          {!currentSource && currentTrack ? (
            <p className="feedback-message">No audio file available.</p>
          ) : null}
        </div>
        <div className="music-controls">
          <button
            type="button"
            className="action-button secondary-button"
            onClick={handlePrevious}
            disabled={!queue.length}
          >
            Previous
          </button>
          <button
            type="button"
            className="action-button primary-button"
            onClick={handlePlayPause}
            disabled={!currentSource}
          >
            {isPlaying ? "Pause" : "Play"}
          </button>
          <button
            type="button"
            className="action-button secondary-button"
            onClick={handleNext}
            disabled={!queue.length}
          >
            Next
          </button>
        </div>
        <div className="music-progress">
          <input
            type="range"
            min="0"
            max={duration || 0}
            value={currentTime}
            onChange={handleProgressChange}
            className="music-progress-bar"
          />
          <div className="music-timer">
            <span>{Math.floor(currentTime)}s</span>
            <span>{Math.floor(duration)}s</span>
          </div>
        </div>
      </div>

      <div className="music-upload">
        <form className="music-upload-form" onSubmit={handleUpload}>
          <input
            type="text"
            placeholder="Track name"
            value={trackName}
            onChange={(event) => setTrackName(event.target.value)}
          />
          <input
            type="file"
            accept="audio/*"
            ref={fileInputRef}
            onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
          />
          <button type="submit" className="action-button secondary-button">
            Upload
          </button>
        </form>
      </div>

      <div className="music-columns">
        <section className="music-column">
          <h3 className="section-title">Tracks</h3>
          <TrackList
            tracks={tracks}
            onAddToQueue={handleAddToQueue}
            isDisabled={isQueueLoading}
          />
        </section>
        <section className="music-column">
          <h3 className="section-title">Queue</h3>
          <QueueList
            queue={queue}
            currentTrackId={currentTrack?.id}
            onRemove={handleRemoveFromQueue}
            isDisabled={isQueueLoading}
          />
        </section>
      </div>

      <audio
        ref={audioRef}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={handleNext}
      />
    </section>
  );
}

export default MusicPlayer;
