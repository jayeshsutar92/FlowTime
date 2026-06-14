/**
 * Synthesized timer completion sounds using the Web Audio API.
 * No external audio files required.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  return audioCtx;
}

/**
 * Play a pleasant ascending chime to signal work session completion.
 * Two-tone ascending pattern (C5 → E5) — bright and rewarding.
 */
export function playWorkCompleteSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // First tone — C5 (523 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(523.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.5);

    // Second tone — E5 (659 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(659.25, now + 0.2);
    gain2.gain.setValueAtTime(0, now + 0.2);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.25);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.2);
    osc2.stop(now + 0.8);
  } catch {
    // Audio API not available — silently ignore
  }
}

/**
 * Play a soft descending chime to signal break session completion.
 * Two-tone descending pattern (G5 → C5) — gentle and calming.
 */
export function playBreakCompleteSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // First tone — G5 (783 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(783.99, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.6);

    // Second tone — C5 (523 Hz)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "triangle";
    osc2.frequency.setValueAtTime(523.25, now + 0.25);
    gain2.gain.setValueAtTime(0, now + 0.25);
    gain2.gain.linearRampToValueAtTime(0.25, now + 0.3);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.25);
    osc2.stop(now + 0.9);
  } catch {
    // Audio API not available — silently ignore
  }
}
