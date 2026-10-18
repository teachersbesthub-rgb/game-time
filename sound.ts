// Tiny WebAudio cue bank. No external files. Opt-in via host toggle.
// Never throws; safe to call on SSR (no-ops when window missing).

type Cue = "whoosh" | "heartbeat" | "spotlight" | "confetti" | "discovery" | "victory" | "tension";

let ctx: AudioContext | null = null;
let enabled = false;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  } catch {
    return null;
  }
}

export function setSoundEnabled(v: boolean) {
  enabled = v;
  if (v)
    getCtx()
      ?.resume()
      .catch(() => {});
}

export function isSoundEnabled() {
  return enabled;
}

function tone(
  freq: number,
  dur: number,
  type: OscillatorType = "sine",
  gain = 0.15,
  slideTo?: number,
) {
  if (!enabled) return;
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export function play(cue: Cue) {
  switch (cue) {
    case "whoosh":
      tone(600, 0.35, "sawtooth", 0.08, 120);
      break;
    case "heartbeat":
      tone(80, 0.12, "sine", 0.25);
      setTimeout(() => tone(80, 0.1, "sine", 0.2), 180);
      break;
    case "spotlight":
      tone(220, 0.5, "triangle", 0.1, 880);
      break;
    case "confetti":
      [523, 659, 784, 1046].forEach((f, i) =>
        setTimeout(() => tone(f, 0.18, "triangle", 0.14), i * 60),
      );
      break;
    case "discovery":
      tone(392, 0.25, "sine", 0.14);
      setTimeout(() => tone(587, 0.35, "sine", 0.14), 140);
      break;
    case "victory":
      [523, 659, 784, 1046, 1318].forEach((f, i) =>
        setTimeout(() => tone(f, 0.22, "triangle", 0.16), i * 90),
      );
      break;
    case "tension":
      tone(110, 0.9, "sawtooth", 0.06, 180);
      break;
  }
}
