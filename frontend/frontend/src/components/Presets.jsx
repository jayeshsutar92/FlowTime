import { useEffect, useState } from "react";
import { fetchPresets } from "../api";

function Presets({ onApplyPreset, refreshKey = 0 }) {
  const [presets, setPresets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

  return (
    <section className="card presets-card">
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

      <div className="preset-list">
        {presets.map((preset) => (
          <article key={preset.id} className="preset-card">
            <div className="preset-copy">
              <h3>{preset.name}</h3>
              <p>
                {preset.work_duration} min focus | {preset.short_break} min break
              </p>
            </div>

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
          </article>
        ))}
      </div>
    </section>
  );
}

export default Presets;
