import { create } from "zustand";
import {
  ENNEAGRAM,
  leadingTypes,
  makePerson,
  type EnneagramType,
  type NomineeColor,
  type Person,
  type QuestionItem,
} from "./enneagram";
import {
  initialShowAuthoredState,
  makeMemoryEntry,
  normalizeAuthored,
  type MemoryEntry,
  type ParticipantAnswer,
  type PersonalityHypothesis,
  type ShowAuthoredState,
} from "./show-state";
import { orderQuestions, toQuestionItems, type BankQuestion } from "./bank";
import { buildPeople, allNames, idOf, type Round } from "./ledger";
import { pickNominees } from "./selector";
import { popupsForRound, type Popup } from "./popups";

export type Screen =
  | "welcome"
  | "next-question"
  | "question"
  | "nominees"
  | "winner"
  | "insight"
  | "analyzing"
  | "results"
  | "type-detail"
  | "profiles"
  | "chemistry"
  | "movie-cast"
  | "awards"
  | "summary"
  | "compare"
  | "finale"
  | "chapter";

export interface Nominees {
  red: string;
  blue: string;
  green: string;
}

export interface Participant {
  id: string;
  name: string;
}

export interface EventState {
  screen: Screen;
  questions: QuestionItem[];
  currentIndex: number;
  nominees: Nominees;
  winnerColor: NomineeColor | null;
  people: Record<string, Person>;
  selectedType: EnneagramType | null;
  selectedPersonId: string | null;
  movieTheme: string;
  currentInsight: string | null;
  audienceContext: string;
  roomContext: string;
  comparePair: [string, string] | null;
  soundOn: boolean;
  insightsShownAt: number[];
  // Pre-event roster + audience metadata (additive; safe defaults).
  participants: Participant[];
  audienceType: string;
  preparedAt: number | null;
  // Show Engine — authored slice of the single central show state.
  show: ShowAuthoredState;
  // Automatic show engine
  rounds: Round[];
  seed: number;
  live: boolean;
  pendingPopup: Popup | null;
  shownPopups: string[];
  updatedAt: number;
}

const initial: EventState = {
  screen: "welcome",
  questions: [],
  currentIndex: 0,
  nominees: { red: "", blue: "", green: "" },
  winnerColor: null,
  people: {},
  selectedType: null,
  selectedPersonId: null,
  movieTheme: "",
  currentInsight: null,
  audienceContext: "",
  roomContext: "",
  comparePair: null,
  soundOn: false,
  insightsShownAt: [],
  participants: [],
  audienceType: "",
  preparedAt: null,
  show: initialShowAuthoredState,
  rounds: [],
  seed: 1,
  live: false,
  pendingPopup: null,
  shownPopups: [],
  updatedAt: Date.now(),
};

const STORAGE_KEY = "enneagram-event-state-v1";
const CHANNEL = "enneagram-event-channel-v1";

function loadInitial(): EventState {
  if (typeof window === "undefined") return initial;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    return { ...initial, ...parsed, show: normalizeAuthored(parsed?.show) };
  } catch {
    return initial;
  }
}

let bc: BroadcastChannel | null = null;
let suppressBroadcast = false;

interface Actions {
  set: (patch: Partial<EventState>) => void;
  loadQuestions: (qs: QuestionItem[]) => void;
  reset: () => void;
  startEvent: () => void;
  showQuestion: () => void;
  showNextQuestionReveal: () => void;
  setNominee: (color: NomineeColor, name: string) => void;
  showNominees: () => void;
  setWinner: (color: NomineeColor) => void;
  showWinner: () => void;
  nextQuestion: () => void;
  showInsight: (text?: string) => void;
  showAnalyzing: () => void;
  showResults: () => void;
  selectType: (t: EnneagramType) => void;
  showProfiles: () => void;
  selectPerson: (id: string | null) => void;
  showChemistry: () => void;
  showMovieCast: () => void;
  setMovieTheme: (t: string) => void;
  showAwards: () => void;
  showSummary: () => void;
  setAudienceContext: (s: string) => void;
  setRoomContext: (s: string) => void;
  setComparePair: (pair: [string, string] | null) => void;
  setSoundOn: (v: boolean) => void;
  showFinale: () => void;
  showChapter: () => void;
  markInsightShown: (idx: number) => void;
  addParticipant: (name: string) => void;
  removeParticipant: (id: string) => void;
  setParticipants: (list: Participant[]) => void;
  setAudienceType: (v: string) => void;
  markPrepared: () => void;
  pickNominee: (color: NomineeColor, name: string) => void;
  beginShow: (args: { names: string[]; count: number; bank: BankQuestion[] }) => void;
  beginRound: () => void;
  recordWinner: (slot: 0 | 1 | 2 | null) => void;
  showPopup: () => void;
  advance: () => void;
  _hydrateFromRemote: (s: EventState) => void;
  // ---- Show Engine actions (single central state) ----
  patchShow: (patch: Partial<ShowAuthoredState>) => void;
  setEventName: (v: string) => void;
  setShowTheme: (v: string) => void;
  setPresentation: (patch: Partial<ShowAuthoredState["presentation"]>) => void;
  recordAnswer: (personId: string, answer: ParticipantAnswer) => void;
  addObservation: (personId: string, text: string) => void;
  addDetectedPattern: (personId: string, text: string) => void;
  rememberDiscovery: (text: string, extra?: Partial<MemoryEntry>) => void;
  rememberMoment: (text: string, extra?: Partial<MemoryEntry>) => void;
  addUnresolvedQuestion: (text: string, extra?: Partial<MemoryEntry>) => void;
  resolveQuestion: (id: string) => void;
  addGroupPattern: (text: string, extra?: Partial<MemoryEntry>) => void;
  setHypotheses: (personId: string, hyps: PersonalityHypothesis[]) => void;
  clearMemory: () => void;
}

export const useEvent = create<EventState & Actions>((set, get) => {
  const commit = (patch: Partial<EventState>) => {
    const next = { ...get(), ...patch, updatedAt: Date.now() };
    set(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(stripActions(next)));
      } catch {
        /* noop */
      }
      if (!suppressBroadcast && bc) {
        bc.postMessage(stripActions(next));
      }
    }
  };

  return {
    ...loadInitial(),
    set: commit,
    _hydrateFromRemote: (s) => {
      suppressBroadcast = true;
      set({ ...s });
      suppressBroadcast = false;
    },
    loadQuestions: (qs) =>
      commit({
        questions: qs,
        currentIndex: 0,
        screen: "welcome",
        nominees: { red: "", blue: "", green: "" },
        winnerColor: null,
        people: {},
        selectedType: null,
      }),
    reset: () => commit({ ...initial, updatedAt: Date.now() }),
    startEvent: () => commit({ screen: "welcome" }),
    showQuestion: () => commit({ screen: "question" }),
    setNominee: (color, name) => commit({ nominees: { ...get().nominees, [color]: name } }),
    showNominees: () => {
      // register/increment nominations
      const { nominees, people } = get();
      const next = { ...people };
      (["red", "blue", "green"] as NomineeColor[]).forEach((c) => {
        const n = nominees[c].trim();
        if (!n) return;
        const id = n.toLowerCase();
        if (!next[id]) next[id] = makePerson(n);
        next[id] = { ...next[id], nominations: next[id].nominations + 1 };
      });
      commit({ people: next, screen: "nominees", winnerColor: null });
    },
    setWinner: (color) => commit({ winnerColor: color }),
    showWinner: () => {
      const { winnerColor, nominees, people, questions, currentIndex } = get();
      if (!winnerColor) return;
      const q = questions[currentIndex];
      if (!q) return;
      const next = { ...people };
      (["red", "blue", "green"] as NomineeColor[]).forEach((c) => {
        const n = nominees[c].trim();
        if (!n) return;
        const id = n.toLowerCase();
        if (!next[id]) next[id] = makePerson(n);
        const p = { ...next[id], scores: { ...next[id].scores } };
        if (c === winnerColor) {
          p.wins += 1;
          p.scores[q.primaryType] += q.winnerPoints;
          p.scores[q.secondaryType] += q.secondaryPoints;
        } else {
          p.scores[q.primaryType] += q.nomineePoints;
          p.scores[q.secondaryType] += q.nomineePoints;
        }
        next[id] = p;
      });
      // Central show state: log each participant's answer for this question.
      const show = get().show;
      const answers = { ...show.answers };
      (["red", "blue", "green"] as NomineeColor[]).forEach((c) => {
        const n = nominees[c].trim();
        if (!n) return;
        const id = n.toLowerCase();
        const prev = answers[id] ?? [];
        if (prev.some((a) => a.questionIndex === currentIndex)) return;
        answers[id] = [
          ...prev,
          {
            questionIndex: currentIndex,
            questionText: q.question,
            color: c,
            role: c === winnerColor ? "winner" : "nominee",
            at: Date.now(),
          },
        ];
      });
      const winnerName = nominees[winnerColor].trim();
      const moments = winnerName
        ? [
            ...show.aiMemory.importantMoments,
            makeMemoryEntry(`${winnerName} won “${q.question}”`, {
              personId: winnerName.toLowerCase(),
              questionIndex: currentIndex,
              weight: 0.6,
            }),
          ]
        : show.aiMemory.importantMoments;
      commit({
        people: next,
        screen: "winner",
        show: { ...show, answers, aiMemory: { ...show.aiMemory, importantMoments: moments } },
      });
    },
    nextQuestion: () => {
      const { currentIndex, questions } = get();
      const ni = Math.min(currentIndex + 1, questions.length - 1);
      commit({
        currentIndex: ni,
        nominees: { red: "", blue: "", green: "" },
        winnerColor: null,
        screen: "next-question",
      });
    },
    showResults: () => commit({ screen: "results", selectedType: null }),
    selectType: (t) => commit({ selectedType: t, screen: "type-detail" }),
    showChemistry: () => commit({ screen: "chemistry" }),
    showSummary: () => commit({ screen: "summary" }),
    showNextQuestionReveal: () => commit({ screen: "next-question" }),
    showAnalyzing: () => commit({ screen: "analyzing" }),
    showInsight: (text) =>
      commit({ screen: "insight", currentInsight: text ?? get().currentInsight }),
    showProfiles: () => commit({ screen: "profiles", selectedPersonId: null }),
    selectPerson: (id) => commit({ selectedPersonId: id }),
    showMovieCast: () => commit({ screen: "movie-cast" }),
    setMovieTheme: (t) => commit({ movieTheme: t }),
    showAwards: () => commit({ screen: "awards" }),
    setAudienceContext: (s) => commit({ audienceContext: s }),
    setRoomContext: (s: string) => commit({ roomContext: s }),
    setComparePair: (pair: [string, string] | null) =>
      commit({ comparePair: pair, screen: pair ? "compare" : get().screen }),
    setSoundOn: (v: boolean) => commit({ soundOn: v }),
    showFinale: () => commit({ screen: "finale" }),
    showChapter: () => commit({ screen: "chapter" }),
    markInsightShown: (idx) => {
      const cur = get().insightsShownAt;
      if (cur.includes(idx)) return;
      commit({ insightsShownAt: [...cur, idx] });
    },
    addParticipant: (name) => {
      const clean = name.trim();
      if (!clean) return;
      const id = clean.toLowerCase();
      const list = get().participants;
      if (list.some((p) => p.id === id)) return;
      commit({ participants: [...list, { id, name: clean }] });
    },
    removeParticipant: (id) =>
      commit({ participants: get().participants.filter((p) => p.id !== id) }),
    setParticipants: (list) => commit({ participants: list }),
    setAudienceType: (v) => commit({ audienceType: v }),
    markPrepared: () => commit({ preparedAt: Date.now() }),
    // ---------------- Automatic show engine ----------------
    beginShow: ({ names, count, bank }) => {
      const clean = Array.from(new Map(names.map((n) => [idOf(n), n.trim()])).values()).filter(
        Boolean,
      );
      const seed = (Date.now() % 2147483000) + 1;
      const ordered = orderQuestions(bank, seed, count);
      commit({
        ...initial,
        participants: clean.map((n) => ({ id: idOf(n), name: n })),
        questions: toQuestionItems(ordered),
        seed,
        live: true,
        rounds: [],
        people: buildPeople([], clean),
        screen: "welcome",
        currentIndex: 0,
        updatedAt: Date.now(),
      });
    },
    beginRound: () => {
      const { participants, rounds, questions, currentIndex, seed } = get();
      const q = questions[currentIndex];
      if (!q || !q.dim) return;
      const [r, b, g] = pickNominees(
        participants.map((p) => p.name),
        rounds,
        q.dim,
        seed * 1000 + currentIndex,
      );
      commit({ nominees: { red: r, blue: b, green: g }, winnerColor: null, screen: "question" });
    },
    // Host taps the winner. Tapping again during the winner screen corrects it.
    recordWinner: (slot) => {
      const s = get();
      const q = s.questions[s.currentIndex];
      if (!q || !q.dim || !q.id) return;
      if (slot === null) {
        get().advance();
        return;
      }
      const noms: [string, string, string] = [s.nominees.red, s.nominees.blue, s.nominees.green];
      if (!noms[0] || !noms[1] || !noms[2]) return;
      const votes: [number, number, number] = [
        slot === 0 ? 3 : 0,
        slot === 1 ? 3 : 0,
        slot === 2 ? 3 : 0,
      ];
      const round: Round = {
        qid: q.id,
        dim: q.dim,
        pole: q.pole ?? 1,
        nominees: noms,
        votes,
        at: Date.now(),
      };
      const replace = s.rounds.some((r) => r.qid === q.id);
      const rounds = replace
        ? s.rounds.map((r) => (r.qid === q.id ? round : r))
        : [...s.rounds, round];
      const roster = s.participants.map((p) => p.name);
      const people = buildPeople(rounds, roster);
      // At most one pop-up every 3 rounds so the show keeps its pace.
      const lastAt = Math.max(
        0,
        ...s.shownPopups.filter((k) => k.startsWith("@r:")).map((k) => Number(k.slice(3))),
      );
      const gateOpen = rounds.length - lastAt >= 3;
      const pop =
        replace || !gateOpen
          ? null
          : (popupsForRound(rounds, roster, new Set(s.shownPopups))[0] ?? null);
      const colors = ["red", "blue", "green"] as const;
      commit({
        rounds,
        people,
        winnerColor: colors[slot],
        screen: "winner",
        pendingPopup: replace ? s.pendingPopup : pop,
      });
    },
    showPopup: () => {
      const { pendingPopup, shownPopups } = get();
      if (!pendingPopup) return;
      commit({
        screen: "insight",
        currentInsight: `${pendingPopup.icon}  ${pendingPopup.title}: ${pendingPopup.text}`,
        shownPopups: [...shownPopups, pendingPopup.key, `@r:${get().rounds.length}`],
        pendingPopup: null,
      });
    },
    advance: () => {
      const { currentIndex, questions } = get();
      if (currentIndex + 1 >= questions.length) {
        commit({ screen: "analyzing", pendingPopup: null });
        return;
      }
      commit({
        currentIndex: currentIndex + 1,
        nominees: { red: "", blue: "", green: "" },
        winnerColor: null,
        pendingPopup: null,
      });
      get().beginRound();
    },
    // ---------------- Show Engine actions ----------------
    patchShow: (patch) => commit({ show: { ...get().show, ...patch } }),
    setEventName: (v) => commit({ show: { ...get().show, eventName: v } }),
    setShowTheme: (v) => commit({ show: { ...get().show, showTheme: v } }),
    setPresentation: (patch) =>
      commit({
        show: {
          ...get().show,
          presentation: { ...get().show.presentation, ...patch },
        },
      }),
    recordAnswer: (personId, answer) => {
      const show = get().show;
      const prev = show.answers[personId] ?? [];
      if (prev.some((a) => a.questionIndex === answer.questionIndex)) return;
      commit({ show: { ...show, answers: { ...show.answers, [personId]: [...prev, answer] } } });
    },
    addObservation: (personId, text) => {
      const show = get().show;
      const prev = show.observations[personId] ?? [];
      if (!text.trim() || prev.includes(text)) return;
      commit({
        show: { ...show, observations: { ...show.observations, [personId]: [...prev, text] } },
      });
    },
    addDetectedPattern: (personId, text) => {
      const show = get().show;
      const prev = show.patterns[personId] ?? [];
      if (!text.trim() || prev.includes(text)) return;
      commit({ show: { ...show, patterns: { ...show.patterns, [personId]: [...prev, text] } } });
    },
    rememberDiscovery: (text, extra) => {
      const show = get().show;
      commit({
        show: {
          ...show,
          aiMemory: {
            ...show.aiMemory,
            discoveries: [...show.aiMemory.discoveries, makeMemoryEntry(text, extra)],
          },
        },
      });
    },
    rememberMoment: (text, extra) => {
      const show = get().show;
      commit({
        show: {
          ...show,
          aiMemory: {
            ...show.aiMemory,
            importantMoments: [...show.aiMemory.importantMoments, makeMemoryEntry(text, extra)],
          },
        },
      });
    },
    addUnresolvedQuestion: (text, extra) => {
      const show = get().show;
      commit({
        show: {
          ...show,
          aiMemory: {
            ...show.aiMemory,
            unresolvedQuestions: [
              ...show.aiMemory.unresolvedQuestions,
              makeMemoryEntry(text, extra),
            ],
          },
        },
      });
    },
    resolveQuestion: (id) => {
      const show = get().show;
      commit({
        show: {
          ...show,
          aiMemory: {
            ...show.aiMemory,
            unresolvedQuestions: show.aiMemory.unresolvedQuestions.filter((q) => q.id !== id),
          },
        },
      });
    },
    addGroupPattern: (text, extra) => {
      const show = get().show;
      if (show.aiMemory.groupPatterns.some((g) => g.text === text)) return;
      commit({
        show: {
          ...show,
          aiMemory: {
            ...show.aiMemory,
            groupPatterns: [...show.aiMemory.groupPatterns, makeMemoryEntry(text, extra)],
          },
        },
      });
    },
    setHypotheses: (personId, hyps) => {
      const show = get().show;
      commit({
        show: {
          ...show,
          aiMemory: {
            ...show.aiMemory,
            personalityHypotheses: { ...show.aiMemory.personalityHypotheses, [personId]: hyps },
          },
        },
      });
    },
    clearMemory: () =>
      commit({ show: { ...get().show, aiMemory: normalizeAuthored({}).aiMemory } }),
    pickNominee: (color, name) => commit({ nominees: { ...get().nominees, [color]: name } }),
  };
});

export function importBundle(raw: string): { ok: boolean; error?: string } {
  try {
    const parsed = JSON.parse(raw);
    const s: Partial<EventState> = parsed?.state ?? parsed;
    if (!s || typeof s !== "object") return { ok: false, error: "Missing state." };
    if (!Array.isArray(s.questions)) return { ok: false, error: "Missing questions[]." };
    if (!s.people || typeof s.people !== "object") return { ok: false, error: "Missing people{}." };
    const next: EventState = {
      screen: (s.screen as Screen) ?? "welcome",
      questions: s.questions,
      currentIndex: typeof s.currentIndex === "number" ? s.currentIndex : 0,
      nominees: s.nominees ?? { red: "", blue: "", green: "" },
      winnerColor: (s.winnerColor as NomineeColor | null) ?? null,
      people: s.people as Record<string, Person>,
      selectedType: (s.selectedType as EnneagramType | null) ?? null,
      selectedPersonId: (s.selectedPersonId as string | null) ?? null,
      movieTheme: typeof s.movieTheme === "string" ? s.movieTheme : "",
      currentInsight: (s.currentInsight as string | null) ?? null,
      audienceContext: typeof s.audienceContext === "string" ? s.audienceContext : "",
      roomContext: typeof s.roomContext === "string" ? s.roomContext : "",
      comparePair:
        Array.isArray(s.comparePair) && s.comparePair.length === 2
          ? [String(s.comparePair[0]), String(s.comparePair[1])]
          : null,
      soundOn: typeof s.soundOn === "boolean" ? s.soundOn : false,
      insightsShownAt: Array.isArray(s.insightsShownAt) ? s.insightsShownAt : [],
      participants: Array.isArray(s.participants) ? (s.participants as Participant[]) : [],
      audienceType: typeof s.audienceType === "string" ? s.audienceType : "",
      preparedAt: typeof s.preparedAt === "number" ? s.preparedAt : null,
      show: normalizeAuthored((s as { show?: unknown }).show),
      rounds: Array.isArray(s.rounds) ? s.rounds : [],
      seed: typeof s.seed === "number" ? s.seed : 1,
      live: typeof s.live === "boolean" ? s.live : false,
      pendingPopup: s.pendingPopup ?? null,
      shownPopups: Array.isArray(s.shownPopups) ? s.shownPopups : [],
      updatedAt: Date.now(),
    };

    useEvent.setState(next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* noop */
      }
      if (bc) bc.postMessage(next);
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function stripActions(s: EventState & Partial<Actions>): EventState {
  const {
    screen,
    questions,
    currentIndex,
    nominees,
    winnerColor,
    people,
    selectedType,
    selectedPersonId,
    movieTheme,
    currentInsight,
    audienceContext,
    roomContext,
    comparePair,
    soundOn,
    insightsShownAt,
    participants,
    audienceType,
    preparedAt,
    show,
    updatedAt,
    rounds,
    seed,
    live,
    pendingPopup,
    shownPopups,
  } = s;
  return {
    screen,
    questions,
    currentIndex,
    nominees,
    winnerColor,
    people,
    selectedType,
    selectedPersonId,
    movieTheme,
    currentInsight,
    audienceContext,
    roomContext,
    comparePair,
    soundOn,
    insightsShownAt,
    participants,
    audienceType,
    preparedAt,
    show,
    updatedAt,
    rounds,
    seed,
    live,
    pendingPopup,
    shownPopups,
  };
}

// Cross-tab sync setup
if (typeof window !== "undefined") {
  try {
    bc = new BroadcastChannel(CHANNEL);
    bc.onmessage = (ev) => {
      const s = ev.data as EventState;
      if (!s || typeof s.updatedAt !== "number") return;
      if (s.updatedAt <= useEvent.getState().updatedAt) return;
      useEvent.getState()._hydrateFromRemote(s);
    };
  } catch {
    // ignore
  }
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY || !e.newValue) return;
    try {
      const s = JSON.parse(e.newValue) as EventState;
      if (s.updatedAt <= useEvent.getState().updatedAt) return;
      useEvent.getState()._hydrateFromRemote(s);
    } catch {
      /* noop */
    }
  });
}

// Derived helpers
export function personLeadingTypes(p: Person) {
  return leadingTypes(p.scores);
}

export interface ChemistryReport {
  vibe: string;
  strengths: string[];
  opportunities: string[];
  risks: string[];
  notable: { name: string; note: string }[];
  distribution: Record<EnneagramType, number>;
  presence: {
    leadership: number;
    support: number;
    creativity: number;
    harmony: number;
  };
  narrative: string;
}

export function computeDistribution(people: Person[]): Record<EnneagramType, number> {
  const dist: Record<EnneagramType, number> = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
    7: 0,
    8: 0,
    9: 0,
  };
  people.forEach((p) => {
    const { leading } = leadingTypes(p.scores);
    if (leading) dist[leading] += 1;
  });
  return dist;
}

function peopleByType(people: Person[], t: EnneagramType): Person[] {
  return people.filter((p) => leadingTypes(p.scores).leading === t);
}

function namesList(ns: string[]): string {
  if (ns.length === 0) return "";
  if (ns.length === 1) return ns[0];
  if (ns.length === 2) return `${ns[0]} and ${ns[1]}`;
  return `${ns.slice(0, -1).join(", ")}, and ${ns[ns.length - 1]}`;
}

export function computeChemistry(people: Person[]): ChemistryReport {
  const dist = computeDistribution(people);
  const total = Math.max(1, people.length);
  const pct = (types: EnneagramType[]) =>
    Math.round((types.reduce((s, t) => s + dist[t], 0) / total) * 100);
  const presence = {
    leadership: pct([3, 8]),
    support: pct([2, 6, 9]),
    creativity: pct([4, 7]),
    harmony: pct([9, 2]),
  };
  const dominant = (Object.entries(dist) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .filter(([, v]) => v > 0)
    .slice(0, 3)
    .map(([k]) => Number(k) as EnneagramType);

  const strengths: string[] = dominant.map((t) => {
    const members = peopleByType(people, t).map((p) => p.name);
    const info = ENNEAGRAM[t];
    const who = members.length ? ` — led by ${namesList(members.slice(0, 3))}` : "";
    return `Strong ${info.name} energy: ${info.keywords[0]}${who}.`;
  });

  const missing = (Object.entries(dist) as [string, number][])
    .filter(([, v]) => v === 0)
    .map(([k]) => Number(k) as EnneagramType);
  const opportunities = missing.slice(0, 3).map((t) => {
    const info = ENNEAGRAM[t];
    return `Room to grow — no clear ${info.name}. Invite more ${info.keywords[0].toLowerCase()}.`;
  });

  const risks: string[] = [];
  const top = dominant[0];
  if (top && dist[top] / total >= 0.5 && total >= 3) {
    const members = peopleByType(people, top).map((p) => p.name);
    risks.push(
      `Heavy ${ENNEAGRAM[top].name} concentration (${dist[top]} of ${total}) — ${namesList(members.slice(0, 3))} may drive the room. Balance with other voices.`,
    );
  }
  if (presence.leadership === 0 && total >= 3) {
    risks.push("No dominant leader archetype — decisions may drift without a clear driver.");
  }
  if (presence.harmony === 0 && total >= 3) {
    risks.push("Low harmony presence — conflicts could escalate without a peacekeeper.");
  }
  if (presence.support < 20 && total >= 4) {
    risks.push("Support energy is thin — check in on emotional labor across the group.");
  }
  if (risks.length === 0 && total >= 2) {
    risks.push("Well-balanced group — no major fault lines detected.");
  }

  const sorted = [...people].sort((a, b) => b.wins - a.wins);
  const notable = sorted.slice(0, 3).map((p) => {
    const { leading } = leadingTypes(p.scores);
    return {
      name: p.name,
      note: leading ? `${p.wins} wins · ${ENNEAGRAM[leading].name}` : `${p.wins} wins`,
    };
  });

  const vibeParts = dominant.map((t) => ENNEAGRAM[t].keywords[0]);
  const vibe =
    vibeParts.length > 0 ? `${vibeParts.join(" · ")}` : "A group still finding its voice";

  const namesTop = sorted.slice(0, 3).map((p) => p.name);
  const narrative =
    total < 2
      ? "The group is still forming — play a few more rounds to unlock chemistry."
      : `${namesList(namesTop)} lead a group defined by ${vibe.toLowerCase()}. Leadership sits at ${presence.leadership}%, support at ${presence.support}%, creativity at ${presence.creativity}%, and harmony at ${presence.harmony}%.`;

  return {
    vibe,
    strengths,
    opportunities,
    risks,
    notable,
    distribution: dist,
    presence,
    narrative,
  };
}

// ==================== Fun Facts ====================

export function funFacts(people: Person[]): string[] {
  const list = people;
  const facts: string[] = [];
  if (list.length === 0) return facts;

  const totalNoms = list.reduce((s, p) => s + p.nominations, 0);
  const totalWins = list.reduce((s, p) => s + p.wins, 0);
  facts.push(`${list.length} players · ${totalNoms} total nominations · ${totalWins} total wins.`);

  const neverWon = list.filter((p) => p.wins === 0 && p.nominations > 0);
  if (neverWon.length) {
    facts.push(
      `${namesList(neverWon.slice(0, 3).map((p) => p.name))} nominated but never won — cult favorites.`,
    );
  }

  const undefeated = list.filter((p) => p.wins > 0 && p.wins === p.nominations);
  if (undefeated.length) {
    facts.push(
      `Undefeated: ${namesList(undefeated.slice(0, 3).map((p) => p.name))} won every time nominated.`,
    );
  }

  const winRate = list
    .filter((p) => p.nominations >= 2)
    .map((p) => ({ p, r: p.wins / p.nominations }))
    .sort((a, b) => b.r - a.r);
  if (winRate.length) {
    const top = winRate[0];
    facts.push(
      `Highest win rate: ${top.p.name} at ${Math.round(top.r * 100)}% (${top.p.wins}/${top.p.nominations}).`,
    );
  }

  const dual = list.filter((p) => {
    const { leading, second } = leadingTypes(p.scores);
    return !!leading && !!second && Math.abs(p.scores[leading] - p.scores[second]) <= 1;
  });
  if (dual.length) {
    facts.push(
      `${namesList(dual.slice(0, 2).map((p) => p.name))} sit right between two types — dual-natured.`,
    );
  }

  return facts;
}

// ==================== Export ====================

export interface ExportBundle {
  version: string;
  exportedAt: string;
  state: EventState;
  derived: {
    distribution: Record<EnneagramType, number>;
    people: Array<{
      name: string;
      wins: number;
      nominations: number;
      scores: Record<EnneagramType, number>;
      leading: EnneagramType | null;
      second: EnneagramType | null;
    }>;
    chemistry: ChemistryReport;
    funFacts: string[];
  };
}

export function buildExportBundle(): ExportBundle {
  const s = useEvent.getState();
  const list = Object.values(s.people);
  return {
    version: "1.0",
    exportedAt: new Date().toISOString(),
    state: stripActions(s),
    derived: {
      distribution: computeDistribution(list),
      people: list.map((p) => {
        const { leading, second } = leadingTypes(p.scores);
        return {
          name: p.name,
          wins: p.wins,
          nominations: p.nominations,
          scores: p.scores,
          leading,
          second,
        };
      }),
      chemistry: computeChemistry(list),
      funFacts: funFacts(list),
    },
  };
}

export function bundleToJSON(b: ExportBundle): string {
  return JSON.stringify(b, null, 2);
}

export function bundleToCSV(b: ExportBundle): string {
  const header = [
    "Name",
    "Wins",
    "Nominations",
    "Leading",
    "Second",
    ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((t) => `Type${t}`),
  ];
  const rows = [
    header,
    ...b.derived.people.map((p) => [
      p.name,
      p.wins,
      p.nominations,
      p.leading ?? "",
      p.second ?? "",
      ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as EnneagramType[]).map((t) => p.scores[t]),
    ]),
  ];
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
}

export function bundleToMarkdown(b: ExportBundle): string {
  const { chemistry, people, funFacts: facts, distribution } = b.derived;
  const podium = [...people].sort((a, b) => b.wins - a.wins).slice(0, 3);
  const L: string[] = [];
  L.push(`# Enneagram Event Report`);
  L.push(`_Exported ${new Date(b.exportedAt).toLocaleString()}_`);
  L.push("");
  L.push(`## Group Vibe`);
  L.push(`**${chemistry.vibe}**`);
  L.push("");
  L.push(chemistry.narrative);
  L.push("");
  L.push(`## Presence`);
  L.push(`- Leadership: ${chemistry.presence.leadership}%`);
  L.push(`- Support: ${chemistry.presence.support}%`);
  L.push(`- Creativity: ${chemistry.presence.creativity}%`);
  L.push(`- Harmony: ${chemistry.presence.harmony}%`);
  L.push("");
  L.push(`## Strengths`);
  chemistry.strengths.forEach((s) => L.push(`- ${s}`));
  L.push("");
  L.push(`## Opportunities`);
  chemistry.opportunities.forEach((s) => L.push(`- ${s}`));
  L.push("");
  L.push(`## Risk Factors`);
  chemistry.risks.forEach((s) => L.push(`- ${s}`));
  L.push("");
  L.push(`## Distribution`);
  ([1, 2, 3, 4, 5, 6, 7, 8, 9] as EnneagramType[]).forEach((t) =>
    L.push(`- Type ${t} (${ENNEAGRAM[t].name}): ${distribution[t]}`),
  );
  L.push("");
  L.push(`## Podium`);
  podium.forEach((p, i) =>
    L.push(
      `${i + 1}. **${p.name}** — ${p.wins} wins, ${p.nominations} noms${p.leading ? ` · ${ENNEAGRAM[p.leading].name}` : ""}`,
    ),
  );
  L.push("");
  L.push(`## Fun Facts`);
  facts.forEach((f) => L.push(`- ${f}`));
  L.push("");
  L.push(`## All Participants`);
  L.push(`| Name | Wins | Noms | Leading | Second |`);
  L.push(`| --- | --- | --- | --- | --- |`);
  people.forEach((p) =>
    L.push(
      `| ${p.name} | ${p.wins} | ${p.nominations} | ${p.leading ?? "—"} | ${p.second ?? "—"} |`,
    ),
  );
  return L.join("\n");
}

export function bundleToScript(b: ExportBundle): string {
  const payload = JSON.stringify(b, null, 2);
  return `// Enneagram Event Export — self-contained script.
// Paste into any JS runtime (Node, Deno, browser console) to inspect the event.

const EVENT = ${payload};

function report(e) {
  const c = e.derived.chemistry;
  console.log("=== ENNEAGRAM EVENT ===");
  console.log("Exported:", e.exportedAt);
  console.log("Vibe:    ", c.vibe);
  console.log("");
  console.log(c.narrative);
  console.log("");
  console.log("Presence:", c.presence);
  console.log("Strengths:");     c.strengths.forEach((s) => console.log("  \\u2022", s));
  console.log("Opportunities:"); c.opportunities.forEach((s) => console.log("  \\u2022", s));
  console.log("Risks:");         c.risks.forEach((s) => console.log("  \\u2022", s));
  console.log("Fun facts:");     e.derived.funFacts.forEach((s) => console.log("  \\u2022", s));
  console.log("");
  console.log("Participants:");
  e.derived.people
    .slice().sort((a, b) => b.wins - a.wins)
    .forEach((x) => console.log(\`  \${x.name.padEnd(20)} wins=\${x.wins} noms=\${x.nominations} leading=\${x.leading ?? "-"}\`));
}

report(EVENT);
if (typeof module !== "undefined") module.exports = EVENT;
`;
}
