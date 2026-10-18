// ============================================================================
// SHOW ENGINE — central state contract.
//
// The entire experience (host screen + presentation screen) runs from ONE
// event state. This module defines that state:
//
//   ShowState = { event, participants, presentation, aiMemory }
//
// Two layers:
//   * AUTHORED  (`ShowAuthoredState`) — persisted + broadcast; written by the
//     host, the AI brain, and the presentation sequencer.
//   * DERIVED   (`ShowState`) — computed from authored state + the raw event
//     record (questions / people / screen) on every read, so the two screens
//     can never drift apart.
//
// Nothing here renders. UI is untouched by design.
// ============================================================================

import { chapterFor } from "./ai-brain";
import { moodForChapter, PHASE_INTENSITY, type AtmospherePreset } from "./atmosphere";
import { buildAllProfiles, type LivingProfile } from "./personality-engine";
import type { RevealPhase } from "./reveal-machine";
import type { EnneagramType, NomineeColor, Person, QuestionItem } from "./enneagram";

// ---------------------------------------------------------------- Event ----

export interface ShowChapter {
  number: number;
  title: string;
  subtitle: string;
}

export interface ShowQuestion {
  index: number;
  number: number; // 1-based, for display
  total: number;
  item: QuestionItem | null;
}

export interface ShowEvent {
  eventName: string;
  roomDescription: string;
  audienceType: string;
  showTheme: string;
  currentChapter: ShowChapter;
  currentScene: string; // the active screen/scene key
  currentQuestion: ShowQuestion;
  progress: number; // 0..1
}

// ---------------------------------------------------------- Participants ----

export interface ParticipantAnswer {
  questionIndex: number;
  questionText: string;
  color: NomineeColor;
  role: "winner" | "nominee";
  at: number;
}

export interface ShowParticipant {
  id: string;
  name: string;
  profile: LivingProfile | null;
  answers: ParticipantAnswer[];
  nominations: number;
  wins: number;
  aiObservations: string[];
  confidence: number; // 0..1
  detectedPatterns: string[];
}

// ---------------------------------------------------------- Presentation ----

export interface ShowPresentation {
  currentAnimation: string; // e.g. "idle" | "enter" | "pulse" | "burst"
  currentReveal: RevealPhase;
  currentAtmosphere: AtmospherePreset;
  currentSound: { enabled: boolean; cue: string | null };
  currentVisualTheme: string; // e.g. "midnight" | "gold" | "aurora"
}

// ------------------------------------------------------------- AI memory ----

export interface MemoryEntry {
  id: string;
  text: string;
  at: number;
  personId?: string;
  questionIndex?: number;
  weight?: number; // 0..1 significance
}

export interface PersonalityHypothesis {
  type: EnneagramType;
  confidence: number; // 0..1
  rationale: string;
  at: number;
}

export interface AIMemory {
  discoveries: MemoryEntry[];
  importantMoments: MemoryEntry[];
  unresolvedQuestions: MemoryEntry[];
  personalityHypotheses: Record<string, PersonalityHypothesis[]>;
  groupPatterns: MemoryEntry[];
}

// ------------------------------------------------------------ Full state ----

export interface ShowState {
  event: ShowEvent;
  participants: ShowParticipant[];
  presentation: ShowPresentation;
  aiMemory: AIMemory;
}

/** The persisted / broadcast slice. Everything else is derived on read. */
export interface ShowAuthoredState {
  eventName: string;
  showTheme: string;
  presentation: {
    currentAnimation: string;
    currentReveal: RevealPhase;
    currentSound: { enabled: boolean; cue: string | null };
    currentVisualTheme: string;
    atmosphereOverride: AtmospherePreset | null;
  };
  answers: Record<string, ParticipantAnswer[]>;
  observations: Record<string, string[]>;
  patterns: Record<string, string[]>;
  aiMemory: AIMemory;
}

export const initialAIMemory: AIMemory = {
  discoveries: [],
  importantMoments: [],
  unresolvedQuestions: [],
  personalityHypotheses: {},
  groupPatterns: [],
};

export const initialShowAuthoredState: ShowAuthoredState = {
  eventName: "",
  showTheme: "",
  presentation: {
    currentAnimation: "idle",
    currentReveal: "idle",
    currentSound: { enabled: false, cue: null },
    currentVisualTheme: "midnight",
    atmosphereOverride: null,
  },
  answers: {},
  observations: {},
  patterns: {},
  aiMemory: initialAIMemory,
};

/** Merge a possibly-partial persisted value into a complete authored state. */
export function normalizeAuthored(raw: unknown): ShowAuthoredState {
  const s = (raw ?? {}) as Partial<ShowAuthoredState>;
  return {
    ...initialShowAuthoredState,
    ...s,
    presentation: {
      ...initialShowAuthoredState.presentation,
      ...(s.presentation ?? {}),
    },
    answers: s.answers ?? {},
    observations: s.observations ?? {},
    patterns: s.patterns ?? {},
    aiMemory: { ...initialAIMemory, ...(s.aiMemory ?? {}) },
  };
}

// ------------------------------------------------------------- Derivation ---

export interface ShowSourceRecord {
  screen: string;
  questions: QuestionItem[];
  currentIndex: number;
  people: Record<string, Person>;
  audienceType: string;
  audienceContext: string;
  roomContext: string;
  soundOn: boolean;
  show: ShowAuthoredState;
}

/** Patterns the engine can read straight off the evidence (no LLM needed). */
function derivePatterns(p: Person, profile: LivingProfile | null): string[] {
  const out: string[] = [];
  if (!profile) return out;
  if (p.wins > 0 && p.wins === p.nominations) out.push("Wins every room they enter");
  if (p.nominations >= 3 && p.wins === 0) out.push("Consistently trusted, rarely centre-stage");
  if (profile.confidence >= 0.7) out.push("Signal is strong and stable");
  if (profile.confidence > 0 && profile.confidence < 0.35)
    out.push("Reads differently round to round");
  if (profile.topTypes.length >= 2) {
    const [a, b] = profile.topTypes;
    if (profile.spectrum[b] > profile.spectrum[a] * 0.85) out.push("Sits between two types");
  }
  return out;
}

export function deriveShowState(src: ShowSourceRecord): ShowState {
  const people = Object.values(src.people);
  const total = src.questions.length;
  const ch = chapterFor(src.currentIndex, total);
  const profiles = buildAllProfiles(people, src.questions);

  const base = moodForChapter(ch.number);
  const intensity = PHASE_INTENSITY[src.show.presentation.currentReveal] ?? 1;
  const atmosphere: AtmospherePreset = src.show.presentation.atmosphereOverride ?? {
    ...base,
    particleDensity: base.particleDensity * intensity,
    glow: Math.min(1, base.glow * intensity),
  };

  const participants: ShowParticipant[] = people.map((p) => {
    const profile = profiles[p.id] ?? null;
    return {
      id: p.id,
      name: p.name,
      profile,
      answers: src.show.answers[p.id] ?? [],
      nominations: p.nominations,
      wins: p.wins,
      aiObservations: src.show.observations[p.id] ?? [],
      confidence: profile?.confidence ?? 0,
      detectedPatterns: [...(src.show.patterns[p.id] ?? []), ...derivePatterns(p, profile)],
    };
  });

  return {
    event: {
      eventName: src.show.eventName,
      roomDescription: src.roomContext,
      audienceType: src.audienceType || src.audienceContext,
      showTheme: src.show.showTheme,
      currentChapter: { number: ch.number, title: ch.title, subtitle: ch.subtitle },
      currentScene: src.screen,
      currentQuestion: {
        index: src.currentIndex,
        number: total ? src.currentIndex + 1 : 0,
        total,
        item: src.questions[src.currentIndex] ?? null,
      },
      progress: total ? Math.min(1, (src.currentIndex + 1) / total) : 0,
    },
    participants,
    presentation: {
      currentAnimation: src.show.presentation.currentAnimation,
      currentReveal: src.show.presentation.currentReveal,
      currentAtmosphere: atmosphere,
      currentSound: {
        enabled: src.soundOn && src.show.presentation.currentSound.enabled !== false,
        cue: src.show.presentation.currentSound.cue,
      },
      currentVisualTheme: src.show.presentation.currentVisualTheme,
    },
    aiMemory: {
      ...src.show.aiMemory,
      // Fill in evidence-based hypotheses for anyone the AI hasn't authored yet.
      personalityHypotheses: participants.reduce<Record<string, PersonalityHypothesis[]>>(
        (acc, p) => {
          if (acc[p.id]?.length) return acc;
          const prof = p.profile;
          if (!prof) return acc;
          acc[p.id] = prof.topTypes.map((t) => ({
            type: t,
            confidence: Math.max(0, Math.min(1, prof.spectrum[t] * prof.confidence)),
            rationale: `Evidence from ${p.nominations} nomination(s) and ${p.wins} win(s).`,
            at: 0,
          }));
          return acc;
        },
        { ...src.show.aiMemory.personalityHypotheses },
      ),
    },
  };
}

export function makeMemoryEntry(text: string, extra: Partial<MemoryEntry> = {}): MemoryEntry {
  return {
    id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    at: Date.now(),
    ...extra,
  };
}
