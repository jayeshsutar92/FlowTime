import React from "react";

function TrackList({ tracks, onAddToQueue, isDisabled }) {
  if (!tracks.length) {
    return <p className="feedback-message">No tracks available.</p>;
  }

  return (
    <div className="track-list flex flex-col gap-3 w-full">
      {tracks.map((track) => (
        <article key={track.id} className="track-row flex items-center justify-between gap-3">
          <div className="track-meta">
            <p className="track-name">{track.name || "Untitled track"}</p>
            {track.duration ? (
              <p className="track-duration">{Math.round(track.duration)} sec</p>
            ) : null}
          </div>
          <button
            type="button"
            className="action-button secondary-button"
            onClick={() => onAddToQueue(track)}
            disabled={isDisabled}
          >
            Add to Queue
          </button>
        </article>
      ))}
    </div>
  );
}

export default TrackList;
