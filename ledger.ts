// Scoring from real vote counts. Deterministic: no AI, no randomness.
// Each round stores who was nominated and how many votes each nominee got.
import { DIMS, type DimKey } from "./bank";
import type { EnneagramType, Person } from "./enneagram";

export interface Round {
  qid: string;
  dim: DimKey;
  pole: 1 | -1;
  nominees: [string, string, string]; // order = red, blue, green
  votes: [number, number, number];
  at: number;
}

export const ALL_TYPES: EnneagramType[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

// Playful public names. The real trait names are never shown during the show.
export const DIM_LABEL: Record<DimKey, string> = {
  soc: "Spark",
  warm: "Heart",
  rel: "Anchor",
  calm: "Still Water",
  open: "Wildcard",
};

// Tunable constants
export const TUNING = {
  SHRINK_K: 1, // pulls scores with few appearances toward the group average
  HALO: 0.3, // removes "liked at everything" bias (0 = off, 1 = full)
  CONF_K: 4, // confidence = n / (n + CONF_K)
  MIN_GAP: 8, // a type must beat the runner-up by this many points
  CLEAR_CONF: 0.3, // minimum average confidence to call a type "clear"
};

export const idOf = (name: string) => name.trim().toLowerCase();

/** Index of the single winner, or -1 on a tie / no votes. */
export function winnerIndex(votes: readonly number[]): number {
  const max = Math.max(...votes);
  if (max <= 0) return -1;
  const top = votes.map((v, i) => (v === max ? i : -1)).filter((i) => i >= 0);
  return top.length === 1 ? top[0] : -1;
}

export interface DimEstimate {
  z: number; // standing inside this room (-2.5 .. 2.5)
  n: number; // appearances on this trait
  confidence: number; // 0..1
}
export type Profile = Record<DimKey, DimEstimate>;

function emptyDims<T>(f: () => T): Record<DimKey, T> {
  return { soc: f(), warm: f(), rel: f(), calm: f(), open: f() };
}

export function scoreGroup(rounds: Round[], names: string[]): Record<string, Profile> {
  const { SHRINK_K, HALO, CONF_K } = TUNING;
  // 1) observations: vote share above chance (1/3), flipped for "low" questions
  const obs: Record<string, Record<DimKey, number[]>> = {};
  names.forEach((n) => {
    obs[idOf(n)] = emptyDims<number[]>(() => []);
  });
  for (const r of rounds) {
    const total = r.votes[0] + r.votes[1] + r.votes[2];
    if (total < 3) continue; // too few votes to mean anything
    r.nominees.forEach((name, i) => {
      const o = obs[idOf(name)];
      if (o) o[r.dim].push(r.pole * (r.votes[i] / total - 1 / 3));
    });
  }

  // 2) shrink small samples toward 0, then remove the halo (general popularity)
  const ids = Object.keys(obs);
  const adj: Record<string, Record<DimKey, number>> = {};
  const cnt: Record<string, Record<DimKey, number>> = {};
  for (const id of ids) {
    adj[id] = emptyDims(() => 0);
    cnt[id] = emptyDims(() => 0);
    const shrunk = emptyDims(() => 0);
    let sum = 0;
    let used = 0;
    for (const d of DIMS) {
      const a = obs[id][d];
      const n = a.length;
      cnt[id][d] = n;
      const mean = n ? a.reduce((s, v) => s + v, 0) / n : 0;
      shrunk[d] = (mean * n) / (n + SHRINK_K);
      if (n) {
        sum += shrunk[d];
        used++;
      }
    }
    const halo = used ? sum / used : 0;
    for (const d of DIMS) adj[id][d] = cnt[id][d] ? shrunk[d] - HALO * halo : 0;
  }

  // 3) z-score per trait across the group (relative to this room)
  const out: Record<string, Profile> = {};
  ids.forEach((id) => {
    out[id] = emptyDims<DimEstimate>(() => ({ z: 0, n: 0, confidence: 0 }));
  });
  for (const d of DIMS) {
    const have = ids.filter((id) => cnt[id][d] > 0);
    const vals = have.map((id) => adj[id][d]);
    const m = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
    const variance = vals.length ? vals.reduce((s, v) => s + (v - m) ** 2, 0) / vals.length : 0;
    const sd = Math.max(0.02, Math.sqrt(variance));
    for (const id of ids) {
      const n = cnt[id][d];
      const z = n ? Math.max(-2.5, Math.min(2.5, (adj[id][d] - m) / sd)) : 0;
      out[id][d] = { z, n, confidence: n / (n + CONF_K) };
    }
  }
  return out;
}

// Each Enneagram-style type as a rough pattern over the 5 traits.
// This mapping is approximate (research links the Enneagram to traits only loosely).
const PROTO: Record<EnneagramType, Record<DimKey, number>> = {
  1: { soc: -0.2, warm: 0.0, rel: 1.0, calm: -0.3, open: -0.3 },
  2: { soc: 0.6, warm: 1.0, rel: 0.3, calm: 0.0, open: 0.0 },
  3: { soc: 0.7, warm: -0.2, rel: 0.8, calm: 0.3, open: 0.2 },
  4: { soc: -0.3, warm: 0.2, rel: -0.4, calm: -0.7, open: 1.0 },
  5: { soc: -0.9, warm: -0.4, rel: 0.3, calm: 0.2, open: 0.8 },
  6: { soc: 0.0, warm: 0.5, rel: 0.8, calm: -0.8, open: -0.4 },
  7: { soc: 1.0, warm: 0.3, rel: -0.6, calm: 0.3, open: 0.9 },
  8: { soc: 0.5, warm: -0.8, rel: 0.2, calm: 0.5, open: 0.2 },
  9: { soc: -0.2, warm: 0.7, rel: 0.0, calm: 0.9, open: -0.2 },
};

export function typeAffinities(p: Profile): Record<EnneagramType, number> {
  const v = DIMS.map((d) => p[d].z * p[d].confidence);
  const mag = Math.hypot(...v);
  const out = {} as Record<EnneagramType, number>;
  for (const t of ALL_TYPES) {
    const pr = DIMS.map((d) => PROTO[t][d]);
    const cos =
      mag < 0.25 ? 0 : v.reduce((s, x, i) => s + x * pr[i], 0) / (mag * Math.hypot(...pr));
    out[t] = Math.round(Math.max(0, cos) * 100);
  }
  return out;
}

export function typeReading(p: Profile) {
  const aff = typeAffinities(p);
  const ranked = ALL_TYPES.slice().sort((a, b) => aff[b] - aff[a]);
  const [top, second] = ranked;
  const confidence = DIMS.reduce((s, d) => s + p[d].confidence, 0) / DIMS.length;
  const clear =
    aff[top] > 0 && aff[top] - aff[second] >= TUNING.MIN_GAP && confidence >= TUNING.CLEAR_CONF;
  return { aff, top, second, confidence, clear }; // clear=false means "still forming"
}

/** Names used for scoring: the roster plus anyone who appeared in a round. */
export function allNames(rounds: Round[], roster: string[]): string[] {
  const seen = new Map<string, string>();
  roster.forEach((n) => seen.set(idOf(n), n.trim()));
  rounds.forEach((r) =>
    r.nominees.forEach((n) => n.trim() && !seen.has(idOf(n)) && seen.set(idOf(n), n.trim())),
  );
  return [...seen.values()];
}

/** Builds the store's `people` record from the ledger (replaces the old point scoring). */
export function buildPeople(rounds: Round[], roster: string[]): Record<string, Person> {
  const names = allNames(rounds, roster);
  const profiles = scoreGroup(rounds, names);
  const out: Record<string, Person> = {};
  for (const name of names) {
    const id = idOf(name);
    let wins = 0;
    let nominations = 0;
    for (const r of rounds) {
      const i = r.nominees.findIndex((n) => idOf(n) === id);
      if (i < 0) continue;
      nominations++;
      if (winnerIndex(r.votes) === i) wins++;
    }
    out[id] = { id, name, wins, nominations, scores: typeAffinities(profiles[id]) };
  }
  return out;
}
