// Atmosphere — maps chapter + reveal state to visual mood presets.
// Consumed by the presentation motion layer so every screen breathes.

import type { RevealPhase } from "./reveal-machine";

export interface AtmospherePreset {
  mood: string; // human-readable
  palette: [string, string, string]; // oklch swatches (bg drift)
  particleDensity: number; // 0.4 → 1.4
  glow: number; // 0 → 1
  breatheMs: number; // background breathing period
}

export const CHAPTER_MOODS: Record<number, AtmospherePreset> = {
  1: {
    mood: "Curious opening",
    palette: ["oklch(0.20 0.09 275)", "oklch(0.30 0.10 305)", "oklch(0.25 0.10 330)"],
    particleDensity: 0.6,
    glow: 0.5,
    breatheMs: 8000,
  },
  2: {
    mood: "Warm discovery",
    palette: ["oklch(0.24 0.10 300)", "oklch(0.32 0.14 340)", "oklch(0.30 0.14 30)"],
    particleDensity: 0.8,
    glow: 0.6,
    breatheMs: 7500,
  },
  3: {
    mood: "Social electricity",
    palette: ["oklch(0.25 0.12 250)", "oklch(0.35 0.14 300)", "oklch(0.30 0.14 350)"],
    particleDensity: 1.0,
    glow: 0.7,
    breatheMs: 7000,
  },
  4: {
    mood: "Hidden currents",
    palette: ["oklch(0.18 0.08 260)", "oklch(0.24 0.10 285)", "oklch(0.22 0.10 220)"],
    particleDensity: 0.9,
    glow: 0.6,
    breatheMs: 8500,
  },
  5: {
    mood: "Reveal light",
    palette: ["oklch(0.28 0.14 65)", "oklch(0.32 0.16 40)", "oklch(0.26 0.16 350)"],
    particleDensity: 1.2,
    glow: 0.9,
    breatheMs: 6500,
  },
  6: {
    mood: "Chemistry lift",
    palette: ["oklch(0.28 0.13 170)", "oklch(0.30 0.14 200)", "oklch(0.32 0.14 275)"],
    particleDensity: 1.1,
    glow: 0.75,
    breatheMs: 7000,
  },
  7: {
    mood: "Finale glow",
    palette: ["oklch(0.24 0.14 300)", "oklch(0.30 0.18 40)", "oklch(0.30 0.16 350)"],
    particleDensity: 1.4,
    glow: 1.0,
    breatheMs: 6000,
  },
};

export function moodForChapter(n: number): AtmospherePreset {
  return CHAPTER_MOODS[Math.min(7, Math.max(1, n))];
}

// Reveal-phase intensity multipliers (short-lived boosts on top of chapter mood).
export const PHASE_INTENSITY: Record<RevealPhase, number> = {
  idle: 1,
  suspense: 0.85,
  countdown: 1.1,
  reveal: 1.35,
  celebrate: 1.5,
  rest: 0.95,
};
