// ============================================================================
// SHOW ENGINE — the single orchestration layer for the live show.
//
// One event state, two screens. `useShow()` (and its focused selectors) return
// the derived central `ShowState` — event / participants / presentation /
// aiMemory — assembled from the persisted + broadcast event record.
//
// Host screen and presentation screen MUST read through this module so they
// can never disagree about what the show is doing.
// ============================================================================

import { useMemo } from "react";
import { useEvent, type EventState } from "./event-store";
import { chapterFor } from "./ai-brain";
import { moodForChapter, PHASE_INTENSITY, type AtmospherePreset } from "./atmosphere";
import type { RevealPhase } from "./reveal-machine";
import { buildAllProfiles, type LivingProfile } from "./personality-engine";
import type { EnneagramType, Person } from "./enneagram";
import {
  deriveShowState,
  type AIMemory,
  type MemoryEntry,
  type PersonalityHypothesis,
  type ShowEvent,
  type ShowParticipant,
  type ShowPresentation,
  type ShowSourceRecord,
  type ShowState,
} from "./show-state";

export type {
  AIMemory,
  MemoryEntry,
  ParticipantAnswer,
  PersonalityHypothesis,
  ShowEvent,
  ShowParticipant,
  ShowPresentation,
  ShowState,
} from "./show-state";

// ---------------- Derivation ----------------

function toSource(s: EventState): ShowSourceRecord {
  return {
    screen: s.screen,
    questions: s.questions,
    currentIndex: s.currentIndex,
    people: s.people,
    audienceType: s.audienceType,
    audienceContext: s.audienceContext,
    roomContext: s.roomContext,
    soundOn: s.soundOn,
    show: s.show,
  };
}

/** Imperative read — safe outside React (timers, sequencers, exports). */
export function getShowState(): ShowState {
  return deriveShowState(toSource(useEvent.getState()));
}

/** Reactive read of the whole central state. */
export function useShow(): ShowState {
  const s = useEvent();
  return useMemo(
    () => deriveShowState(toSource(s as EventState)),
    // updatedAt changes on every commit — cheap, complete invalidation key.
    [s.updatedAt],
  );
}

export function useShowEvent(): ShowEvent {
  return useShow().event;
}

export function useShowParticipants(): ShowParticipant[] {
  return useShow().participants;
}

export function useShowParticipant(id: string | null | undefined): ShowParticipant | null {
  const list = useShowParticipants();
  return id ? (list.find((p) => p.id === id) ?? null) : null;
}

export function useShowPresentation(): ShowPresentation {
  return useShow().presentation;
}

export function useShowMemory(): AIMemory {
  return useShow().aiMemory;
}

// ---------------- Legacy snapshot (kept for existing callers) ----------------

export interface ShowSnapshot {
  screen: string;
  chapterNumber: number;
  chapterTitle: string;
  chapterSubtitle: string;
  atmosphere: AtmospherePreset;
  currentIndex: number;
  totalQuestions: number;
  progress: number; // 0..1
  participants: Person[];
  livingProfiles: Record<string, LivingProfile>;
  audienceContext: string;
  roomContext: string;
  soundOn: boolean;
}

export function selectShowSnapshot(revealPhase: RevealPhase = "idle"): ShowSnapshot {
  const s = useEvent.getState();
  const list: Person[] = Object.values(s.people);
  const total = s.questions.length;
  const ch = chapterFor(s.currentIndex, total);
  const base = moodForChapter(ch.number);
  const intensity = PHASE_INTENSITY[revealPhase];
  const atmosphere: AtmospherePreset = {
    ...base,
    particleDensity: base.particleDensity * intensity,
    glow: Math.min(1, base.glow * intensity),
  };
  return {
    screen: s.screen,
    chapterNumber: ch.number,
    chapterTitle: ch.title,
    chapterSubtitle: ch.subtitle,
    atmosphere,
    currentIndex: s.currentIndex,
    totalQuestions: total,
    progress: total ? (s.currentIndex + 1) / total : 0,
    participants: list,
    livingProfiles: buildAllProfiles(list, s.questions),
    audienceContext: s.audienceContext,
    roomContext: s.roomContext,
    soundOn: s.soundOn,
  };
}

// ---------------- Show actions ----------------
// The only sanctioned way to move the show forward. Both screens use these.

export const showActions = {
  // Event
  setEventName: (v: string) => useEvent.getState().setEventName(v),
  setShowTheme: (v: string) => useEvent.getState().setShowTheme(v),
  setAudience: (v: string) => useEvent.getState().setAudienceContext(v),
  setAudienceType: (v: string) => useEvent.getState().setAudienceType(v),
  setRoom: (v: string) => useEvent.getState().setRoomContext(v),
  setSound: (v: boolean) => useEvent.getState().setSoundOn(v),

  // Scenes
  startShow: () => useEvent.getState().startEvent(),
  showQuestion: () => useEvent.getState().showQuestion(),
  showNominees: () => useEvent.getState().showNominees(),
  showWinner: () => useEvent.getState().showWinner(),
  next: () => useEvent.getState().nextQuestion(),
  results: () => useEvent.getState().showResults(),
  chemistry: () => useEvent.getState().showChemistry(),
  profiles: () => useEvent.getState().showProfiles(),
  finale: () => useEvent.getState().showFinale(),
  chapter: () => useEvent.getState().showChapter(),
  selectType: (t: EnneagramType) => useEvent.getState().selectType(t),
  compare: (pair: [string, string] | null) => useEvent.getState().setComparePair(pair),

  // Presentation layer
  setAnimation: (currentAnimation: string) =>
    useEvent.getState().setPresentation({ currentAnimation }),
  setReveal: (currentReveal: RevealPhase) => useEvent.getState().setPresentation({ currentReveal }),
  setVisualTheme: (currentVisualTheme: string) =>
    useEvent.getState().setPresentation({ currentVisualTheme }),
  playSound: (cue: string | null) =>
    useEvent.getState().setPresentation({
      currentSound: { enabled: useEvent.getState().soundOn, cue },
    }),
  setAtmosphereOverride: (atmosphereOverride: AtmospherePreset | null) =>
    useEvent.getState().setPresentation({ atmosphereOverride }),

  // AI memory
  observe: (personId: string, text: string) => useEvent.getState().addObservation(personId, text),
  detectPattern: (personId: string, text: string) =>
    useEvent.getState().addDetectedPattern(personId, text),
  discover: (text: string, extra?: Partial<MemoryEntry>) =>
    useEvent.getState().rememberDiscovery(text, extra),
  remember: (text: string, extra?: Partial<MemoryEntry>) =>
    useEvent.getState().rememberMoment(text, extra),
  ask: (text: string, extra?: Partial<MemoryEntry>) =>
    useEvent.getState().addUnresolvedQuestion(text, extra),
  resolve: (id: string) => useEvent.getState().resolveQuestion(id),
  groupPattern: (text: string, extra?: Partial<MemoryEntry>) =>
    useEvent.getState().addGroupPattern(text, extra),
  hypothesize: (personId: string, hyps: PersonalityHypothesis[]) =>
    useEvent.getState().setHypotheses(personId, hyps),
  clearMemory: () => useEvent.getState().clearMemory(),
};

export type ShowActions = typeof showActions;
