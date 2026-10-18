// AI Host Brain — deterministic living-profile / show-beat engine.
// Adds chapters, group archetype, compliments, truth bombs, "if you just met",
// and side-by-side comparison. Pure functions; consumed by presentation & host.

import { ENNEAGRAM, leadingTypes, type EnneagramType, type Person } from "./enneagram";

// ============ Chapters ============
export interface Chapter {
  number: number;
  title: string;
  subtitle: string;
}

const CHAPTERS: Chapter[] = [
  { number: 1, title: "First Impressions", subtitle: "The room takes shape…" },
  { number: 2, title: "Emerging Leaders", subtitle: "Patterns start to form." },
  { number: 3, title: "Trust & Relationships", subtitle: "Who does the room lean on?" },
  { number: 4, title: "Hidden Patterns", subtitle: "Something quiet is emerging." },
  { number: 5, title: "Personality Discovery", subtitle: "The picture becomes clear." },
  { number: 6, title: "Group Chemistry", subtitle: "How it all fits together." },
  { number: 7, title: "Final Revelations", subtitle: "The story of tonight." },
];

export function chapterFor(currentIndex: number, total: number): Chapter {
  if (total <= 0) return CHAPTERS[0];
  const ratio = currentIndex / Math.max(1, total - 1);
  const idx = Math.min(CHAPTERS.length - 1, Math.floor(ratio * CHAPTERS.length));
  return CHAPTERS[idx];
}

export function isChapterOpener(currentIndex: number, total: number): boolean {
  if (total <= 0) return false;
  const step = Math.max(1, Math.floor(total / CHAPTERS.length));
  return currentIndex % step === 0;
}

// ============ Group archetype ============
const ARCHETYPES: Record<string, { title: string; tagline: string; types: EnneagramType[] }> = {
  builders: {
    title: "The Builders",
    tagline: "They turn ideas into things that last.",
    types: [1, 3, 8],
  },
  guardians: { title: "The Guardians", tagline: "They protect what matters.", types: [1, 6, 9] },
  explorers: { title: "The Explorers", tagline: "They chase what's next.", types: [5, 7] },
  connectors: {
    title: "The Connectors",
    tagline: "They keep the room together.",
    types: [2, 6, 9],
  },
  trailblazers: {
    title: "The Trailblazers",
    tagline: "They open doors nobody knew existed.",
    types: [3, 7, 8],
  },
  architects: {
    title: "The Architects",
    tagline: "They see the whole shape before anyone.",
    types: [1, 5],
  },
  catalysts: {
    title: "The Catalysts",
    tagline: "They make things happen — fast.",
    types: [3, 7, 8],
  },
  dreamers: {
    title: "The Dreamers",
    tagline: "They imagine what the room could become.",
    types: [4, 7, 9],
  },
};

export function groupArchetype(people: Person[]): { title: string; tagline: string } {
  if (people.length < 2)
    return {
      title: "A Room Still Forming",
      tagline: "Play a few more rounds to unlock the story.",
    };
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
    if (leading) dist[leading]++;
  });
  let best = ARCHETYPES.connectors;
  let bestScore = -1;
  for (const a of Object.values(ARCHETYPES)) {
    const s = a.types.reduce((sum, t) => sum + dist[t], 0);
    if (s > bestScore) {
      bestScore = s;
      best = a;
    }
  }
  return { title: best.title, tagline: best.tagline };
}

// ============ Per-person show beats ============
export function complimentFor(p: Person): string {
  const { leading } = leadingTypes(p.scores);
  const pool = leading
    ? {
        1: "The room kept coming back to your standards. That doesn't happen by accident.",
        2: "People visibly warmed up around you tonight. That's a gift, not a coincidence.",
        3: "When motion was needed, the room turned to you — over and over.",
        4: "You made the room feel something. That's rarer than it sounds.",
        5: "Whenever clarity was needed, people quietly leaned on your judgment.",
        6: "Somehow the room got steadier when you were part of the answer.",
        7: "Energy in the room noticeably lifted around you. That's not nothing.",
        8: "When a decision needed a spine, the room found yours.",
        9: "You made hard conversations feel easier. People noticed.",
      }[leading]
    : null;
  return pool ?? "The room paid attention to you tonight in ways you may not have noticed.";
}

export function truthBombFor(p: Person): string {
  const bombs = [
    "You may underestimate how much influence you have.",
    "People seem to trust you more than you realize.",
    "Your quiet contributions appear far more visible than you think.",
    "The room sees a version of you that you might not see yet.",
    "When you spoke, the room shifted. That kept happening.",
    "You show up bigger in this room than you probably feel.",
  ];
  const idx = Math.abs(hash(p.id)) % bombs.length;
  return bombs[idx];
}

export function ifYouJustMet(p: Person): string {
  const { leading } = leadingTypes(p.scores);
  const pool = leading
    ? {
        1: "You'd probably notice how quickly they read what's off in a room — and how gently they name it.",
        2: "You'd likely leave the conversation feeling better than when it started.",
        3: "You'd notice how quickly they turn talk into motion.",
        4: "You'd notice how the ordinary sounds different when they describe it.",
        5: "You'd notice how much they've quietly figured out before you got there.",
        6: "You'd probably feel a little safer just from being nearby.",
        7: "You'd leave with three new ideas and one new plan you didn't ask for.",
        8: "You'd probably notice they don't flinch when things get hard.",
        9: "You'd notice how much easier it is to just… be, around them.",
      }[leading]
    : null;
  return pool ?? "You'd probably want to know them for longer than one day.";
}

// ============ Comparison ============
export interface Comparison {
  a: Person;
  b: Person;
  similarities: string[];
  differences: string[];
  communication: { a: string; b: string };
  leadership: { a: string; b: string };
  together: string;
}

const STYLE: Record<EnneagramType, { comm: string; lead: string }> = {
  1: { comm: "precise, principled", lead: "leads by standard" },
  2: { comm: "warm, attentive", lead: "leads by lifting others" },
  3: { comm: "focused, forward", lead: "leads by momentum" },
  4: { comm: "expressive, honest", lead: "leads by meaning" },
  5: { comm: "concise, analytical", lead: "leads by insight" },
  6: { comm: "grounded, careful", lead: "leads by preparation" },
  7: { comm: "playful, spark-first", lead: "leads by possibility" },
  8: { comm: "direct, decisive", lead: "leads by conviction" },
  9: { comm: "steady, unifying", lead: "leads by presence" },
};

export function comparePeople(a: Person, b: Person): Comparison {
  const la = leadingTypes(a.scores).leading;
  const lb = leadingTypes(b.scores).leading;
  const sims: string[] = [];
  const diffs: string[] = [];
  const shared = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as EnneagramType[])
    .filter((t) => a.scores[t] > 0 && b.scores[t] > 0)
    .sort((x, y) => b.scores[y] + a.scores[y] - (b.scores[x] + a.scores[x]));
  if (shared.length)
    sims.push(`Both show up with ${ENNEAGRAM[shared[0]].keywords[0].toLowerCase()} energy.`);
  if (la && lb && la !== lb) {
    diffs.push(
      `${a.name} leans ${ENNEAGRAM[la].role}, while ${b.name} leans ${ENNEAGRAM[lb].role}.`,
    );
  }
  if (a.wins > b.wins + 1)
    diffs.push(`${a.name} carried more of the room tonight; ${b.name} carried quieter weight.`);
  else if (b.wins > a.wins + 1)
    diffs.push(`${b.name} carried more of the room tonight; ${a.name} carried quieter weight.`);

  return {
    a,
    b,
    similarities: sims.length ? sims : ["The room saw both of you show up in overlapping moments."],
    differences: diffs.length
      ? diffs
      : ["Different flavors of the same room — the contrast makes it interesting."],
    communication: {
      a: la ? STYLE[la].comm : "still emerging",
      b: lb ? STYLE[lb].comm : "still emerging",
    },
    leadership: {
      a: la ? STYLE[la].lead : "still emerging",
      b: lb ? STYLE[lb].lead : "still emerging",
    },
    together:
      la && lb
        ? `${a.name} brings ${ENNEAGRAM[la].keywords[0].toLowerCase()}. ${b.name} brings ${ENNEAGRAM[lb].keywords[0].toLowerCase()}. Together — that's momentum.`
        : `Together, ${a.name} and ${b.name} balance the room in ways it may not have noticed yet.`,
  };
}

// ============ Finale beats ============
export function finaleLines(people: Person[]): string[] {
  const arch = groupArchetype(people);
  return [
    "Tonight we discovered…",
    "who leads.",
    "who supports.",
    "who inspires.",
    "who protects.",
    "who connects.",
    "who creates momentum.",
    "who keeps this group together.",
    "",
    "Different personalities.",
    "Different strengths.",
    "Different perspectives.",
    "One remarkable group.",
    "",
    arch.title + ".",
    arch.tagline,
    "",
    "This wasn't about labels.",
    "It was about discovering how people experience each other.",
  ];
}

// ============ tiny hash ============
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h << 5) - h + s.charCodeAt(i);
  return h;
}
