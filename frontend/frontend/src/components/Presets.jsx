import { useEffect, useState } from "react";
import { deletePreset, fetchPresets } from "../api";

function Presets({ onApplyPreset, refreshKey = 0 }) {
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [activePresetId, setActivePresetId] = useState(null);

  useEffect(() => {
    const loadPresets = async () => {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const data = await fetchPresets();
        console.log("mapped presets", data);
        setPresets(data);
      } catch (err) {
        console.error(err);
        setErrorMessage("Could not load presets. Make sure the backend server is running.");
      } finally {
        setIsLoading(false);
      }
    };

    loadPresets();
  }, [refreshKey]);

  const handleDeletePreset = async (presetId) => {
    setActivePresetId(presetId);
    setErrorMessage("");

    try {
      await deletePreset(presetId);
      setPresets((currentPresets) => currentPresets.filter((preset) => preset.id !== presetId));
    } catch (err) {
      console.error(err);
      setErrorMessage("Could not delete preset.");
    } finally {
      setActivePresetId(null);
    }
  };

  return (
    <div className="w-full min-w-0 flex flex-col gap-4">
      <h2 className="section-title">Quick Apply</h2>

      {isLoading ? <p className="feedback-message">Loading presets...</p> : null}
      {errorMessage ? (
        <p className="feedback-message error-message" role="alert">
          {errorMessage}
        </p>
      ) : null}
      {!isLoading && !errorMessage && presets.length === 0 ? (
        <p className="feedback-message">No presets saved yet.</p>
      ) : null}

      <div className="preset-list w-full min-w-0 overflow-hidden flex flex-col gap-4">
        {presets.map((preset) => (
          <article
            key={preset.id}
            className="preset-card w-full min-w-0 flex justify-between items-center gap-4"
          >
            <div className="preset-copy w-full min-w-0 break-words">
              <h3>{preset.name}</h3>
              <p>
                {preset.work_duration} min focus | {preset.short_break} min break |{" "}
                {preset.long_break_duration ?? preset.long_break ?? preset.longBreakDuration ?? 15} min long break
              </p>
            </div>

            <div className="preset-actions flex flex-col gap-2 shrink-0">
              <button
                type="button"
                className="action-button secondary-button"
                onClick={() =>
                  onApplyPreset({
                    work: Number(preset.work_duration),
                    breakTime: Number(preset.short_break),
                    longBreakDuration: Number(
                      preset.long_break_duration ?? preset.long_break ?? preset.longBreakDuration ?? 15
                    ),
                    sessionsBeforeLongBreak: Number(
                      preset.sessions_before_long_break ??
                        preset.sessionsBeforeLongBreak ??
                        preset.total_sessions ??
                        4
                    ),
                  })
                }
              >
                Use
              </button>
              <button
                type="button"
                className="action-button secondary-button"
                onClick={() => handleDeletePreset(preset.id)}
                disabled={activePresetId === preset.id}
              >
                {activePresetId === preset.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export default Presets;
