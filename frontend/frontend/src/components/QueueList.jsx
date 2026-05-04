import React from "react";

function QueueList({ queue, currentTrackId, onRemove, isDisabled }) {
  if (!queue.length) {
    return <p className="feedback-message">Queue is empty.</p>;
  }

  return (
    <div className="queue-list flex flex-col gap-3 w-full">
      {queue.map((track, index) => {
        const isCurrent = currentTrackId === track.id;
        return (
          <article
            key={`${track.id}-${index}`}
            className={`queue-row flex items-center justify-between gap-3 ${
              isCurrent ? "queue-current" : ""
            }`}
          >
            <div className="queue-meta">
              <p className="queue-name">
                {index + 1}. {track.name || "Untitled track"}
              </p>
              {isCurrent ? <span className="queue-status">Now playing</span> : null}
            </div>
            <button
              type="button"
              className="action-button secondary-button"
              onClick={() => onRemove(track)}
              disabled={isDisabled}
            >
              Remove
            </button>
          </article>
        );
      })}
    </div>
  );
}

export default QueueList;
