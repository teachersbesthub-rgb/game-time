// Personality Engine — living, evidence-accumulating profiles.
// Pure TS. Uses existing Person scores + nominations/wins as evidence.
// Never fabricates; only reports what evidence supports.

import {
  ENNEAGRAM,
  leadingTypes,
  type EnneagramType,
  type Person,
  type QuestionItem,
} from "./enneagram";

export interface TraitVector {
  leadership: number;
  trust: number;
  support: number;
  influence: number;
  steadiness: number;
  creativity: number;
  connector: number;
  hidden: number;
}

const EMPTY_TRAITS: TraitVector = {
  leadership: 0,
  trust: 0,
  support: 0,
  influence: 0,
  steadiness: 0,
  creativity: 0,
  connector: 0,
  hidden: 0,
};

// Type → trait fingerprint (each type contributes weight to a few traits).
const TYPE_TRAITS: Record<EnneagramType, Partial<TraitVector>> = {
  1: { leadership: 0.6, steadiness: 0.9, trust: 0.7 },
  2: { support: 1.0, connector: 0.8, trust: 0.6 },
  3: { leadership: 1.0, influence: 0.9 },
  4: { creativity: 1.0, hidden: 0.6 },
  5: { hidden: 0.9, steadiness: 0.6, trust: 0.5 },
  6: { steadiness: 1.0, trust: 0.9, support: 0.5 },
  7: { influence: 0.7, creativity: 0.8, connector: 0.6 },
  8: { leadership: 1.0, influence: 0.9 },
  9: { connector: 1.0, steadiness: 0.9, support: 0.7 },
};

export interface EvolutionMarker {
  atQuestion: number;
  note: string;
}

export interface LivingProfile {
  personId: string;
  name: string;
  traits: TraitVector;
  spectrum: Record<EnneagramType, number>; // normalised 0..1
  topTypes: EnneagramType[]; // 1–3 entries, strongest first
  confidence: number; // 0..1
  timeline: EvolutionMarker[];
  reputations: string[]; // e.g. "Most Trusted"
}

function normaliseSpectrum(scores: Record<EnneagramType, number>): Record<EnneagramType, number> {
  const max = Math.max(1, ...Object.values(scores));
  const out = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 } as Record<
    EnneagramType,
    number
  >;
  ([1, 2, 3, 4, 5, 6, 7, 8, 9] as EnneagramType[]).forEach((t) => {
    out[t] = scores[t] / max;
  });
  return out;
}

function traitsFromScores(scores: Record<EnneagramType, number>): TraitVector {
  const total = Math.max(
    1,
    Object.values(scores).reduce((s, v) => s + v, 0),
  );
  const v: TraitVector = { ...EMPTY_TRAITS };
  ([1, 2, 3, 4, 5, 6, 7, 8, 9] as EnneagramType[]).forEach((t) => {
    const share = scores[t] / total;
    const fp = TYPE_TRAITS[t];
    (Object.keys(fp) as (keyof TraitVector)[]).forEach((k) => {
      v[k] += (fp[k] ?? 0) * share;
    });
  });
  return v;
}

function topTypesFrom(spectrum: Record<EnneagramType, number>): EnneagramType[] {
  return ([1, 2, 3, 4, 5, 6, 7, 8, 9] as EnneagramType[])
    .filter((t) => spectrum[t] > 0)
    .sort((a, b) => spectrum[b] - spectrum[a])
    .slice(0, 3);
}

function confidenceFrom(p: Person): number {
  const { leading, second } = leadingTypes(p.scores);
  if (!leading) return 0;
  const top = p.scores[leading];
  const runnerUp = second ? p.scores[second] : 0;
  const total = Math.max(
    1,
    Object.values(p.scores).reduce((s, v) => s + v, 0),
  );
  const dominance = top / total; // 0..1
  const gap = (top - runnerUp) / Math.max(1, top); // 0..1
  const evidence = Math.min(1, (p.nominations + p.wins) / 6);
  return Math.max(0, Math.min(1, 0.4 * dominance + 0.3 * gap + 0.3 * evidence));
}

function timelineFrom(p: Person, questions: QuestionItem[]): EvolutionMarker[] {
  if (!questions.length) return [];
  const { leading } = leadingTypes(p.scores);
  if (!leading) return [];
  // Approximate the moments where evidence for the leading type appeared.
  const markers: EvolutionMarker[] = [];
  const total = questions.length;
  const points = [
    { at: Math.max(1, Math.floor(total * 0.15)), note: "Early signal" },
    { at: Math.max(2, Math.floor(total * 0.4)), note: "Pattern emerging" },
    { at: Math.max(3, Math.floor(total * 0.7)), note: "Pattern becoming clear" },
    { at: total, note: "Strong confirmation" },
  ];
  points.forEach((pt) => markers.push({ atQuestion: pt.at, note: pt.note }));
  return markers;
}

function reputationsFrom(p: Person, all: Person[]): string[] {
  const reps: string[] = [];
  const trustPool = all.map((x) => x.nominations).sort((a, b) => b - a);
  if (p.nominations >= (trustPool[0] ?? 0) && p.nominations > 0) reps.push("Most Trusted");
  const winsPool = all.map((x) => x.wins).sort((a, b) => b - a);
  if (p.wins >= (winsPool[0] ?? 0) && p.wins > 0) reps.push("Most Influential");
  if (p.nominations > 0 && p.wins === 0) reps.push("Quiet Anchor");
  if (p.wins > 0 && p.wins === p.nominations) reps.push("Undefeated");
  return reps;
}

export function buildLivingProfile(
  p: Person,
  all: Person[],
  questions: QuestionItem[],
): LivingProfile {
  const spectrum = normaliseSpectrum(p.scores);
  return {
    personId: p.id,
    name: p.name,
    traits: traitsFromScores(p.scores),
    spectrum,
    topTypes: topTypesFrom(spectrum),
    confidence: confidenceFrom(p),
    timeline: timelineFrom(p, questions),
    reputations: reputationsFrom(p, all),
  };
}

export function buildAllProfiles(
  people: Person[],
  questions: QuestionItem[],
): Record<string, LivingProfile> {
  const out: Record<string, LivingProfile> = {};
  people.forEach((p) => {
    out[p.id] = buildLivingProfile(p, people, questions);
  });
  return out;
}

// Convenience — top-level trait leaders across the group.
export function traitLeaders(profiles: LivingProfile[]) {
  const keys: (keyof TraitVector)[] = [
    "leadership",
    "trust",
    "support",
    "influence",
    "steadiness",
    "creativity",
    "connector",
    "hidden",
  ];
  const out: Record<string, { name: string; value: number } | null> = {};
  keys.forEach((k) => {
    let best: { name: string; value: number } | null = null;
    profiles.forEach((pr) => {
      const v = pr.traits[k];
      if (!best || v > best.value) best = { name: pr.name, value: v };
    });
    out[k] = best;
  });
  return out;
}

// Small convenience for narration voice — used by story-engine.
export function primaryTypeName(p: LivingProfile): string {
  const t = p.topTypes[0];
  return t ? ENNEAGRAM[t].name : "still forming";
}
