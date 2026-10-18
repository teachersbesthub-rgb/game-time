// Tiny FSM used by the presentation to sequence dramatic beats.
// Pure/framework-free so it can be driven from React or timers.

export type RevealPhase = "idle" | "suspense" | "countdown" | "reveal" | "celebrate" | "rest";

export interface RevealBeat {
  phase: RevealPhase;
  durationMs: number;
}

// Default beat lengths — used by presentation for auto-advancing sequences.
export const REVEAL_TIMINGS: Record<RevealPhase, number> = {
  idle: 0,
  suspense: 1800,
  countdown: 2400,
  reveal: 3200,
  celebrate: 2600,
  rest: 900,
};

export type RevealSequence = "question" | "nominees" | "winner" | "insight";

export const SEQUENCES: Record<RevealSequence, RevealPhase[]> = {
  question: ["suspense", "reveal", "rest"],
  nominees: ["suspense", "reveal", "rest"],
  winner: ["suspense", "countdown", "reveal", "celebrate", "rest"],
  insight: ["suspense", "reveal", "rest"],
};

export function beatsFor(seq: RevealSequence): RevealBeat[] {
  return SEQUENCES[seq].map((p) => ({ phase: p, durationMs: REVEAL_TIMINGS[p] }));
}

export function totalDuration(seq: RevealSequence): number {
  return beatsFor(seq).reduce((s, b) => s + b.durationMs, 0);
}
