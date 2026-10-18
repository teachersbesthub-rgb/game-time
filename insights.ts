import {
  ENNEAGRAM,
  leadingTypes,
  type EnneagramType,
  type Person,
  type QuestionItem,
} from "./enneagram";

// ============ Utilities ============
function pick<T>(a: T[]): T {
  return a[Math.floor(Math.random() * a.length)];
}
function names(ns: string[]): string {
  if (ns.length === 0) return "";
  if (ns.length === 1) return ns[0];
  if (ns.length === 2) return `${ns[0]} and ${ns[1]}`;
  return `${ns.slice(0, -1).join(", ")}, and ${ns[ns.length - 1]}`;
}

// ============ Personality Profile ============
export interface PersonalityProfile {
  person: Person;
  dominant: EnneagramType | null;
  wing: EnneagramType | null;
  confidence: number; // 0-100
  top3: { type: EnneagramType; score: number; pct: number }[];
  blend: string;
  role: string;
  howGroupSeesYou: string[];
  // Deep intelligence (optional; populated when data available)
  archetype?: string;
  confidenceBand?: string;
  reputations?: { title: string; evidence: string }[];
  evidence?: { label: string; detail: string }[];
  hiddenStrength?: string;
  blindSpot?: string;
  growthEdge?: string;
  truthBomb?: string;
  intel?: TypeIntel;
  traits?: Record<string, number>;
  distribution?: { type: EnneagramType; score: number; pct: number }[];
  blendNarrative?: string;
}

/** Rewrites generic phrasing to match the host-provided audience context (e.g. "teachers"). */
export function contextualize(text: string, audience: string): string {
  const a = audience.trim().toLowerCase();
  if (!a) return text;
  const map: Array<[RegExp, string]> = [
    [/\bthe room\b/gi, `the ${a}`],
    [/\bthe group\b/gi, `the ${a}`],
    [/\bpeople\b/gi, a],
  ];
  let out = text;
  for (const [re, rep] of map) out = out.replace(re, rep);
  return out;
}

export function buildProfile(
  person: Person,
  allPeople: Person[],
  questions: QuestionItem[] = [],
): PersonalityProfile {
  const entries = (Object.entries(person.scores) as [string, number][])
    .map(([k, v]) => ({ type: Number(k) as EnneagramType, score: v }))
    .sort((a, b) => b.score - a.score);
  const total = entries.reduce((s, e) => s + e.score, 0) || 1;
  const top3 = entries.slice(0, 3).map((e) => ({ ...e, pct: Math.round((e.score / total) * 100) }));
  const dominant = entries[0]?.score > 0 ? entries[0].type : null;
  const second = entries[1]?.score > 0 ? entries[1].type : null;
  // Wing: adjacent type (dominant±1, wrapping 1..9) with higher of the two scores
  let wing: EnneagramType | null = null;
  if (dominant) {
    const left = (((dominant - 1 - 1 + 9) % 9) + 1) as EnneagramType;
    const right = ((dominant % 9) + 1) as EnneagramType;
    const lS = person.scores[left];
    const rS = person.scores[right];
    wing = lS === 0 && rS === 0 ? null : lS >= rS ? left : right;
  }
  // Confidence: how dominant the top type is vs #2
  const gap = (entries[0]?.score ?? 0) - (entries[1]?.score ?? 0);
  const confidence = Math.max(
    20,
    Math.min(99, Math.round(40 + (gap / Math.max(1, total)) * 200 + (dominant ? 20 : 0))),
  );
  const role = dominant ? ENNEAGRAM[dominant].role : "The Newcomer";
  const blend =
    dominant && second
      ? `${ENNEAGRAM[dominant].role} with a ${ENNEAGRAM[second].role} streak`
      : dominant
        ? `A pure ${ENNEAGRAM[dominant].role}`
        : "Still forming";

  // How the group sees you — data-driven
  const seen: string[] = [];
  const winRate = person.nominations > 0 ? person.wins / person.nominations : 0;
  if (person.nominations >= Math.max(2, Math.floor(allPeople.length / 3))) {
    seen.push(
      `You were on people's minds — nominated in ${person.nominations} moments across the night.`,
    );
  }
  if (person.wins >= 3) {
    seen.push(`The group repeatedly landed on you when it mattered — ${person.wins} wins tonight.`);
  }
  if (winRate >= 0.6 && person.nominations >= 2) {
    seen.push(
      `When you were named, the room agreed — ${Math.round(winRate * 100)}% of your nominations became wins.`,
    );
  }
  if (person.nominations > 0 && person.wins === 0) {
    seen.push(
      `People kept thinking of you even when the spotlight went elsewhere — a quiet, trusted presence.`,
    );
  }
  if (dominant) {
    const info = ENNEAGRAM[dominant];
    seen.push(
      `Whenever a moment called for ${info.keywords[0].toLowerCase()} or ${info.keywords[1].toLowerCase()}, your name came up.`,
    );
    seen.push(`The group sees you as ${info.role.toLowerCase()} — ${info.title.toLowerCase()}.`);
  }
  if (dominant && wing && wing !== dominant) {
    seen.push(
      `They also see a ${ENNEAGRAM[wing].keywords[0].toLowerCase()} edge in you — you don't fit just one box.`,
    );
  }
  if (seen.length === 0) seen.push("The group is still getting to know your rhythm. Keep playing!");

  const profile: PersonalityProfile = {
    person,
    dominant,
    wing,
    confidence,
    top3,
    blend,
    role,
    howGroupSeesYou: seen,
  };
  // Deep intelligence layer
  const traits = computeTraits(person);
  profile.traits = traits;
  profile.archetype = archetypeFor(dominant, traits);
  profile.confidenceBand = confidenceBand(confidence);
  profile.reputations = reputationTitlesFor(person, allPeople).map((r) => ({
    title: r.title,
    evidence: r.evidence,
  }));
  profile.evidence = evidenceFor(person, allPeople, questions);
  if (dominant) {
    const intel = TYPE_INTEL[dominant];
    profile.intel = intel;
    profile.hiddenStrength = intel.hiddenGift;
    profile.blindSpot = intel.blindSpot;
    profile.growthEdge = intel.growthPattern;
  }
  profile.truthBomb = truthBombFor(profile);
  profile.distribution = entries.map((e) => ({
    ...e,
    pct: Math.round((e.score / total) * 100),
  }));
  if (dominant && second) {
    const d = ENNEAGRAM[dominant];
    const s = ENNEAGRAM[second];
    profile.blendNarrative =
      `${d.role} carrying a strong ${s.role} current — you show up as ${d.keywords[0].toLowerCase()} on the outside, ` +
      `but people sense the ${s.keywords[0].toLowerCase()} underneath.`;
  } else if (dominant) {
    profile.blendNarrative = `A defined ${ENNEAGRAM[dominant].role} — the group reads you as ${ENNEAGRAM[dominant].keywords[0].toLowerCase()} without hesitation.`;
  }
  return profile;
}

// ============ Scenarios ============
export function scenariosFor(profile: PersonalityProfile): Record<string, string> {
  const t = profile.dominant;
  const name = profile.person.name;
  if (!t) {
    const empty = `${name} is still revealing themselves — nothing to say yet.`;
    return {
      "On A Typical Day": empty,
      "In A Crisis": empty,
      "During Conflict": empty,
      "In A Team Project": empty,
      "As A Leader": empty,
      "As A Friend": empty,
    };
  }
  const S: Record<EnneagramType, Record<string, string>> = {
    1: {
      "On A Typical Day": `${name} moves with quiet purpose — lists get crossed off, standards get held, and small things are noticed.`,
      "In A Crisis": `${name} steadies the room by finding the right thing to do, then doing it precisely.`,
      "During Conflict": `${name} pushes for what's fair — sometimes at the cost of what's easy.`,
      "In A Team Project": `${name} is the one who fixes what everyone else missed at the last minute.`,
      "As A Leader": `${name} leads by principle. Expect high standards and no shortcuts.`,
      "As A Friend": `${name} is the friend who tells you the truth — because they respect you enough to.`,
    },
    2: {
      "On A Typical Day": `${name} is quietly noticing what everyone needs before they say it.`,
      "In A Crisis": `${name} shows up with food, with hugs, with the practical thing you didn't know you needed.`,
      "During Conflict": `${name} tries to help everyone feel heard — even the person being difficult.`,
      "In A Team Project": `${name} is the emotional glue — the one who keeps the group actually a group.`,
      "As A Leader": `${name} leads through relationship. People follow because they feel seen.`,
      "As A Friend": `${name} is the friend who remembers everything about you and celebrates you loudly.`,
    },
    3: {
      "On A Typical Day": `${name} is already three steps into the goal you're still describing.`,
      "In A Crisis": `${name} snaps into action mode — deliver first, feel later.`,
      "During Conflict": `${name} wants a resolution that works, keeps their reputation clean, and moves on fast.`,
      "In A Team Project": `${name} sets the pace and drags results across the line.`,
      "As A Leader": `${name} leads from the front. Vision, energy, results.`,
      "As A Friend": `${name} is the friend who genuinely wants to see you win — and helps you do it.`,
    },
    4: {
      "On A Typical Day": `${name} sees the beauty and the ache in ordinary moments most people breeze past.`,
      "In A Crisis": `${name} names what everyone else is feeling but won't say.`,
      "During Conflict": `${name} needs to be understood, not fixed. Meaning matters more than resolution.`,
      "In A Team Project": `${name} brings the idea nobody else would've thought of — and defends its soul.`,
      "As A Leader": `${name} leads with meaning. Work has to matter.`,
      "As A Friend": `${name} is the friend who goes deep fast — no small talk, real conversation.`,
    },
    5: {
      "On A Typical Day": `${name} is quietly mastering something. You'll find out later how good they got.`,
      "In A Crisis": `${name} goes calm and analytical — while everyone else is losing signal, they're finding it.`,
      "During Conflict": `${name} steps back, thinks it through, and returns with a precise answer.`,
      "In A Team Project": `${name} is the one who actually understands the thing. Ask them the hard question.`,
      "As A Leader": `${name} leads by expertise. Trust the depth of what they know.`,
      "As A Friend": `${name} is the friend who's low-maintenance but shows up with real substance when it counts.`,
    },
    6: {
      "On A Typical Day": `${name} is scanning for what could go wrong — and quietly making sure it won't.`,
      "In A Crisis": `${name} is the person you actually want next to you. Loyal, prepared, on your side.`,
      "During Conflict": `${name} needs to know who's safe. Once they do, they'll fight for their people.`,
      "In A Team Project": `${name} is the one who spotted the risk everyone else ignored.`,
      "As A Leader": `${name} leads by commitment. They will not leave their people behind.`,
      "As A Friend": `${name} is the friend who never bails, never forgets, and always has your back.`,
    },
    7: {
      "On A Typical Day": `${name} is already onto the next idea, and the one after that, and you're invited.`,
      "In A Crisis": `${name} keeps morale up by finding the angle nobody else saw.`,
      "During Conflict": `${name} reframes fast — sometimes too fast for the person still hurting.`,
      "In A Team Project": `${name} brings the spark and the twelve ideas. The trick is picking one.`,
      "As A Leader": `${name} leads by energy. Follow them into places you'd never go alone.`,
      "As A Friend": `${name} is the friend your best stories are about.`,
    },
    8: {
      "On A Typical Day": `${name} is deciding. Fast, clear, not asking permission.`,
      "In A Crisis": `${name} takes the wheel. Everything gets simpler.`,
      "During Conflict": `${name} goes direct. If they push you, it's usually because they respect you.`,
      "In A Team Project": `${name} pushes the group past the polite ceiling into what's actually possible.`,
      "As A Leader": `${name} leads by presence. They protect their people and refuse to lose.`,
      "As A Friend": `${name} is the friend who'd absolutely show up if you called at 3am.`,
    },
    9: {
      "On A Typical Day": `${name} is quietly holding the room together — steady, warm, unhurried.`,
      "In A Crisis": `${name} keeps everyone calm and reminds them they'll get through it.`,
      "During Conflict": `${name} sees every side. That's a gift, and a trap.`,
      "In A Team Project": `${name} is the mediator — the one who makes the group actually work.`,
      "As A Leader": `${name} leads by consensus. Nobody feels left out.`,
      "As A Friend": `${name} is the friend who feels like home.`,
    },
  };
  return S[t];
}

// ============ Random Group Insights ============
export function randomInsight(
  people: Person[],
  questions: QuestionItem[],
  currentIndex: number,
): string {
  const list = people;
  if (list.length === 0) return "The group is warming up — everyone's still finding their voice.";
  const options: string[] = [];
  const sortedNoms = [...list].sort((a, b) => b.nominations - a.nominations);
  const sortedWins = [...list].sort((a, b) => b.wins - a.wins);
  const topNom = sortedNoms[0];
  const topWin = sortedWins[0];
  if (topNom && topNom.nominations >= 3) {
    options.push(
      `${topNom.name} has been on people's minds — nominated ${topNom.nominations} times already.`,
    );
  }
  if (topWin && topWin.wins >= 3) {
    options.push(
      `${topWin.name} has quietly become the frontrunner — ${topWin.wins} wins and counting.`,
    );
  }
  const totals: Record<EnneagramType, number> = {
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
  list.forEach((p) =>
    (Object.keys(totals) as unknown as string[]).forEach((k) => {
      totals[Number(k) as EnneagramType] += p.scores[Number(k) as EnneagramType];
    }),
  );
  const topType = (Object.entries(totals) as [string, number][]).sort((a, b) => b[1] - a[1])[0];
  if (topType && topType[1] > 0) {
    const t = Number(topType[0]) as EnneagramType;
    options.push(
      `${ENNEAGRAM[t].role} energy is dominating tonight — the group keeps picking ${ENNEAGRAM[t].keywords[0].toLowerCase()}.`,
    );
  }
  // Repeated leadership picks
  const leaderScores = list
    .map((p) => ({ name: p.name, s: (p.scores[3] ?? 0) + (p.scores[8] ?? 0) }))
    .sort((a, b) => b.s - a.s);
  if (leaderScores[0] && leaderScores[0].s >= 6) {
    options.push(`The group keeps looking to ${leaderScores[0].name} for the leadership calls.`);
  }
  const supporters = list
    .map((p) => ({ name: p.name, s: (p.scores[2] ?? 0) + (p.scores[9] ?? 0) }))
    .sort((a, b) => b.s - a.s);
  if (supporters[0] && supporters[0].s >= 6) {
    options.push(
      `${supporters[0].name} is the emotional anchor — support and warmth keep coming back to them.`,
    );
  }
  const done = Math.max(1, currentIndex);
  options.push(
    `${done} question${done === 1 ? "" : "s"} in, ${list.length} personalities on the board.`,
  );
  if (questions.length && currentIndex + 1 < questions.length) {
    const remaining = questions.length - currentIndex - 1;
    options.push(
      `${remaining} question${remaining === 1 ? "" : "s"} left. The story is far from over.`,
    );
  }
  // Undefeated
  const undefeated = list.filter((p) => p.nominations >= 2 && p.wins === p.nominations);
  if (undefeated.length) {
    options.push(
      `${undefeated[0].name} is undefeated tonight — every nomination has turned into a win.`,
    );
  }
  return pick(options);
}

// ============ Group Story ============
export interface GroupStory {
  archetype: string;
  story: string;
  superpower: string;
  challenge: string;
  works: string;
  problems: string;
  conflict: string;
  innovates: string;
  supports: string;
}

export function groupStory(people: Person[]): GroupStory {
  if (people.length === 0) {
    const empty = "Waiting for the story to begin.";
    return {
      archetype: "Yet to be written",
      story: empty,
      superpower: empty,
      challenge: empty,
      works: empty,
      problems: empty,
      conflict: empty,
      innovates: empty,
      supports: empty,
    };
  }
  const dist: Record<EnneagramType, string[]> = {
    1: [],
    2: [],
    3: [],
    4: [],
    5: [],
    6: [],
    7: [],
    8: [],
    9: [],
  };
  people.forEach((p) => {
    const { leading } = leadingTypes(p.scores);
    if (leading) dist[leading].push(p.name);
  });
  const withLeaders = names(dist[3].concat(dist[8]));
  const withHelpers = names(dist[2].concat(dist[9]));
  const withCreators = names(dist[4].concat(dist[7]));
  const withThinkers = names(dist[5].concat(dist[6]));
  const dominantEntry = (Object.entries(dist) as [string, string[]][]).sort(
    (a, b) => b[1].length - a[1].length,
  )[0];
  const dominantT = Number(dominantEntry[0]) as EnneagramType;
  const archetype = `The ${ENNEAGRAM[dominantT].role.replace("The ", "")}-Led Ensemble`;
  const story = `Every crew has a shape. Yours is built around ${withLeaders || "quiet leadership"}, held together by ${withHelpers || "the peacemakers"}, and colored by ${withCreators || "moments of spark"}. Together you make the kind of group that doesn't happen twice.`;
  const superpower =
    withLeaders && withHelpers
      ? `When ${names(dist[3].concat(dist[8]).slice(0, 2))} decide something and ${names(dist[2].concat(dist[9]).slice(0, 2))} rally the room around it — this group moves.`
      : `This group's superpower is that everyone brings something the others don't.`;
  const challenge =
    dist[9].length + dist[2].length > people.length * 0.5
      ? `So much harmony that hard truths get softened. Watch for the thing no one wants to say.`
      : dist[8].length + dist[3].length > people.length * 0.5
        ? `A lot of drive in the room. Watch for the quieter voices getting steamrolled.`
        : `A wide mix of energies. The challenge is coordinating them without flattening what makes each one special.`;
  const works = `${withLeaders || "The doers"} set direction, ${withThinkers || "the thinkers"} pressure-test it, and ${withHelpers || "the connectors"} make sure everyone stays in the room.`;
  const problems = `${withThinkers || "The analysts"} name what's actually going on. ${withLeaders || "The doers"} pick a path. ${withHelpers || "The peacemakers"} carry the group through it.`;
  const conflict = dist[9].length
    ? `${names(dist[9].slice(0, 2))} step in to mediate. That's the good news. The trap: the tension gets smoothed before it gets solved.`
    : `Conflict here goes direct. Which means it either resolves fast — or leaves a mark.`;
  const innovates = withCreators
    ? `${names(dist[4].concat(dist[7]).slice(0, 3))} bring the ideas nobody else would've thought of. The group's job is to catch the good ones before they scatter.`
    : `Ideas come from unexpected places here. Nobody's the designated creative — which is a strength if the group listens.`;
  const supports = withHelpers
    ? `${names(dist[2].concat(dist[9]).slice(0, 3))} carry the emotional weight — often invisibly. Notice them tonight.`
    : `Support in this group is direct, not sentimental. It shows up as action, not words.`;
  return {
    archetype,
    story,
    superpower,
    challenge,
    works,
    problems,
    conflict,
    innovates,
    supports,
  };
}

// ============ Awards ============
export interface Award {
  title: string;
  winner: string | null;
  subtitle: string;
  color: string;
  emoji: string;
}

export function awards(people: Person[]): Award[] {
  const list = people;
  const empty = (title: string, sub: string, color: string, emoji: string): Award => ({
    title,
    winner: null,
    subtitle: sub,
    color,
    emoji,
  });
  if (list.length === 0) {
    return [empty("Most Loved", "TBD", "oklch(0.72 0.17 350)", "❤️")];
  }
  const winner = (score: (p: Person) => number): Person | null => {
    const sorted = [...list].sort((a, b) => score(b) - score(a));
    return sorted[0] && score(sorted[0]) > 0 ? sorted[0] : null;
  };
  const mostLoved = winner((p) => p.nominations);
  const mostTrusted = winner((p) => p.scores[6] + p.scores[9]);
  const naturalLeader = winner((p) => p.scores[3] + p.scores[8]);
  const creativeSpark = winner((p) => p.scores[4] + p.scores[7]);
  const bestSupporter = winner((p) => p.scores[2]);
  const peacekeeper = winner((p) => p.scores[9]);
  const mvp = winner((p) => p.wins * 2 + p.nominations);
  const hiddenHero =
    [...list]
      .filter((p) => p.nominations >= 2 && p.wins <= 1)
      .sort((a, b) => b.nominations - a.nominations)[0] ?? null;
  return [
    {
      title: "Most Loved",
      winner: mostLoved?.name ?? null,
      subtitle: mostLoved ? `${mostLoved.nominations} nominations` : "TBD",
      color: "oklch(0.72 0.17 350)",
      emoji: "❤️",
    },
    {
      title: "Most Trusted",
      winner: mostTrusted?.name ?? null,
      subtitle: "the one you'd call first",
      color: "oklch(0.7 0.16 200)",
      emoji: "🛡️",
    },
    {
      title: "Natural Leader",
      winner: naturalLeader?.name ?? null,
      subtitle: "front of the room",
      color: "oklch(0.62 0.22 20)",
      emoji: "👑",
    },
    {
      title: "Creative Spark",
      winner: creativeSpark?.name ?? null,
      subtitle: "the idea machine",
      color: "oklch(0.65 0.18 305)",
      emoji: "✨",
    },
    {
      title: "Best Supporter",
      winner: bestSupporter?.name ?? null,
      subtitle: "the emotional glue",
      color: "oklch(0.72 0.17 350)",
      emoji: "🤝",
    },
    {
      title: "Peacekeeper",
      winner: peacekeeper?.name ?? null,
      subtitle: "the calm in the room",
      color: "oklch(0.72 0.15 145)",
      emoji: "🕊️",
    },
    {
      title: "Hidden Hero",
      winner: hiddenHero?.name ?? null,
      subtitle: hiddenHero ? `${hiddenHero.nominations} noms, quietly loved` : "TBD",
      color: "oklch(0.78 0.17 85)",
      emoji: "🌟",
    },
    {
      title: "Group MVP",
      winner: mvp?.name ?? null,
      subtitle: mvp ? `${mvp.wins} wins · ${mvp.nominations} noms` : "TBD",
      color: "oklch(0.8 0.18 65)",
      emoji: "🏆",
    },
  ];
}

// ============ Movie Cast ============
export interface MovieCast {
  theme: string;
  tagline: string;
  logline: string;
  roles: { name: string; role: string; note: string }[];
}

const CAST_ARCHETYPES = [
  "the heart",
  "the strategist",
  "the wildcard",
  "the mentor",
  "the loyal sidekick",
  "the creative spark",
  "the reluctant hero",
  "the peacemaker",
  "the mastermind",
  "the comic relief",
  "the protector",
  "the visionary",
];

export function movieCast(people: Person[], theme: string): MovieCast {
  const t = theme.trim() || "A group of friends who accidentally save the world";
  const roles = people.map((p, i) => {
    const { leading } = leadingTypes(p.scores);
    const archetype = leading
      ? ENNEAGRAM[leading].role.toLowerCase()
      : CAST_ARCHETYPES[i % CAST_ARCHETYPES.length];
    const note = leading
      ? `Cast as ${archetype} — the one who brings ${ENNEAGRAM[leading].keywords[0].toLowerCase()}.`
      : `Cast as ${archetype} — the wildcard nobody saw coming.`;
    return { name: p.name, role: archetype, note };
  });
  const tagline = `${t}. Nine personalities. One night. No script.`;
  const logline =
    people.length > 0
      ? `Starring ${names(roles.slice(0, 3).map((r) => r.name))} and the entire ensemble — the story of a group that could only exist tonight.`
      : `The cast is still assembling.`;
  return { theme: t, tagline, logline, roles };
}

// ================================================================
// DEEP PERSONALITY INTELLIGENCE LAYER (additive, backward-compatible)
// ================================================================

export interface TypeIntel {
  coreMotivation: string;
  coreFear: string;
  coreDesire: string;
  coreNeed: string;
  leadershipStyle: string;
  communicationStyle: string;
  conflictStyle: string;
  relationshipStyle: string;
  stressPattern: string;
  growthPattern: string;
  teamRole: string;
  hiddenQuality: string;
  internalContradiction: string;
  strongTraits: string[];
  reputation: string[];
  hiddenGift: string;
  blindSpot: string;
}

export const TYPE_INTEL: Record<EnneagramType, TypeIntel> = {
  1: {
    coreMotivation: "To improve things and live by their principles.",
    coreFear: "Being wrong, corrupt, or irresponsible.",
    coreDesire: "To be good and to live with integrity.",
    coreNeed: "To feel morally sound.",
    leadershipStyle: "Standards and excellence.",
    communicationStyle: "Precise, direct, values-driven.",
    conflictStyle: "Names what's right, holds the line.",
    relationshipStyle: "Loyal, honest, quietly devoted.",
    stressPattern: "Turns rigid; the inner critic gets louder.",
    growthPattern: "Softens into play, self-compassion, and 'good enough'.",
    teamRole: "The Compass — keeps the group aligned to what matters.",
    hiddenQuality: "A private wildness they rarely let out.",
    internalContradiction: "Wants freedom, but keeps building rules to live inside.",
    strongTraits: ["Reliability", "Discipline", "Responsibility", "Standards"],
    reputation: ["Trusted", "Dependable", "Consistent"],
    hiddenGift: "Integrity that steadies the whole room.",
    blindSpot: "Perfectionism that hides how much they've already done.",
  },
  2: {
    coreMotivation: "To help, support, and stay connected.",
    coreFear: "Being unwanted or unappreciated.",
    coreDesire: "To feel loved and valued.",
    coreNeed: "To feel genuinely needed.",
    leadershipStyle: "Encouragement, warmth, human first.",
    communicationStyle: "Attuned, generous, emotionally alive.",
    conflictStyle: "Tries to keep everyone in the room and heard.",
    relationshipStyle: "Devoted, generous, deeply invested.",
    stressPattern: "Over-gives, then quietly resents it.",
    growthPattern: "Learns to receive; names their own needs.",
    teamRole: "The Heart — the emotional glue of the group.",
    hiddenQuality: "A strong opinion they don't always voice.",
    internalContradiction: "Gives endlessly, then feels invisible.",
    strongTraits: ["Empathy", "Support", "Harmony", "Connection"],
    reputation: ["Caring", "Helpful", "Encouraging"],
    hiddenGift: "Emotional intelligence that reads a room instantly.",
    blindSpot: "People-pleasing that hides real needs.",
  },
  3: {
    coreMotivation: "To achieve, produce, and be seen as capable.",
    coreFear: "Failure or being seen as worthless.",
    coreDesire: "To be valuable, respected, and admired.",
    coreNeed: "To feel their work matters.",
    leadershipStyle: "Momentum, results, front-of-the-room.",
    communicationStyle: "Confident, adaptive, action-oriented.",
    conflictStyle: "Resolves fast; protects the image and moves on.",
    relationshipStyle: "Loyal, present, image-conscious.",
    stressPattern: "Doubles down on output; hides the crash.",
    growthPattern: "Rests without earning it; shows the real self.",
    teamRole: "The Achiever — pulls the group across the finish line.",
    hiddenQuality: "A softer, uncertain self behind the polish.",
    internalContradiction: "Wants to be known, but shows the highlight reel.",
    strongTraits: ["Leadership", "Influence", "Initiative", "Achievement"],
    reputation: ["Capable", "Driven", "Motivating"],
    hiddenGift: "Adaptability — becomes what the moment needs.",
    blindSpot: "Ties self-worth to performance.",
  },
  4: {
    coreMotivation: "To be authentic, meaningful, and true to themselves.",
    coreFear: "Being insignificant, ordinary, without identity.",
    coreDesire: "To express who they really are.",
    coreNeed: "To feel understood on a deep level.",
    leadershipStyle: "Vision and inspiration.",
    communicationStyle: "Expressive, honest, emotionally attuned.",
    conflictStyle: "Wants to be understood, not fixed.",
    relationshipStyle: "Intense, romantic, all-in.",
    stressPattern: "Melancholy loops; withdrawal into feeling.",
    growthPattern: "Roots in the ordinary; acts before feeling ready.",
    teamRole: "The Visionary — sees the story others miss.",
    hiddenQuality: "A stubborn, grounded pragmatism.",
    internalContradiction: "Craves belonging, but keeps proving they don't fit.",
    strongTraits: ["Creativity", "Individuality", "Insight", "Emotion"],
    reputation: ["Original", "Thoughtful", "Deep"],
    hiddenGift: "A perspective nobody else in the room has.",
    blindSpot: "Comparison that steals what's already here.",
  },
  5: {
    coreMotivation: "To understand and be competent in their world.",
    coreFear: "Being overwhelmed, drained, or incapable.",
    coreDesire: "To be knowledgeable and prepared.",
    coreNeed: "Space and energy to think.",
    leadershipStyle: "Insight, precision, expertise.",
    communicationStyle: "Considered, minimal, high-signal.",
    conflictStyle: "Steps back, thinks it through, returns clear.",
    relationshipStyle: "Loyal in a quiet, low-maintenance way.",
    stressPattern: "Withdraws; hoards energy.",
    growthPattern: "Engages before knowing enough; drops into the body.",
    teamRole: "The Investigator — the one who actually understands the thing.",
    hiddenQuality: "A wild, unexpected sense of humor.",
    internalContradiction: "Wants connection, but the door only opens inward.",
    strongTraits: ["Strategy", "Analysis", "Problem Solving", "Expertise"],
    reputation: ["Smart", "Insightful", "Thoughtful"],
    hiddenGift: "Wisdom the group leans on when things get hard.",
    blindSpot: "Isolation that gets called self-sufficiency.",
  },
  6: {
    coreMotivation: "To feel safe, supported, and prepared.",
    coreFear: "Being without support, guidance, or ground under their feet.",
    coreDesire: "Security and certainty.",
    coreNeed: "To trust and be trusted.",
    leadershipStyle: "Protection, preparation, reliability.",
    communicationStyle: "Loyal, questioning, risk-aware.",
    conflictStyle: "Needs to know who's safe; then they fight for their people.",
    relationshipStyle: "Deeply loyal, committed, and consistent.",
    stressPattern: "Worst-case looping; distrust spirals.",
    growthPattern: "Trusts own signal; acts on 70% info.",
    teamRole: "The Protector — spots the risk everyone else missed.",
    hiddenQuality: "Fierce courage that shows up under pressure.",
    internalContradiction: "Craves certainty, but questions every certainty they find.",
    strongTraits: ["Reliability", "Preparedness", "Loyalty", "Responsibility"],
    reputation: ["Dependable", "Trustworthy", "Loyal"],
    hiddenGift: "Courage — they hold the line when it counts.",
    blindSpot: "Self-doubt disguised as due diligence.",
  },
  7: {
    coreMotivation: "To stay free, engaged, and in motion.",
    coreFear: "Being trapped, limited, or in pain.",
    coreDesire: "Fulfillment and possibility.",
    coreNeed: "Freedom to move and imagine.",
    leadershipStyle: "Energy, ideas, possibility.",
    communicationStyle: "Fast, playful, connective.",
    conflictStyle: "Reframes fast — sometimes before the hurt is heard.",
    relationshipStyle: "Fun, generous, adventurous.",
    stressPattern: "Scatter; avoiding the hard feeling underneath.",
    growthPattern: "Finishes before starting; sits with what's hard.",
    teamRole: "The Spark — the one who keeps the group alive.",
    hiddenQuality: "A quiet ache they mostly outrun.",
    internalContradiction: "Chases everything to avoid the one thing.",
    strongTraits: ["Creativity", "Innovation", "Optimism", "Adaptability"],
    reputation: ["Fun", "Energetic", "Inspiring"],
    hiddenGift: "Vision — sees possibility where others see a wall.",
    blindSpot: "Avoidance disguised as optimism.",
  },
  8: {
    coreMotivation: "To be strong, independent, and in charge of their own life.",
    coreFear: "Being controlled, hurt, or powerless.",
    coreDesire: "Independence and impact.",
    coreNeed: "To move directly at what matters.",
    leadershipStyle: "Action, decisiveness, protection.",
    communicationStyle: "Direct, forceful, no-nonsense.",
    conflictStyle: "Goes at it head-on — pushes because they respect you.",
    relationshipStyle: "Fierce, protective, loyal to the death.",
    stressPattern: "Intensity turns to control; softness gets buried.",
    growthPattern: "Softens without losing strength; lets others lead.",
    teamRole: "The Challenger — pushes the group past its polite ceiling.",
    hiddenQuality: "A tender, protective heart under the armor.",
    internalContradiction: "Refuses to be vulnerable, then longs to be truly seen.",
    strongTraits: ["Leadership", "Influence", "Resilience", "Initiative"],
    reputation: ["Strong", "Protective", "Confident"],
    hiddenGift: "Protection — their people are safe.",
    blindSpot: "Intensity that overwhelms without meaning to.",
  },
  9: {
    coreMotivation: "To keep the peace inside and around them.",
    coreFear: "Conflict, disconnection, being overlooked.",
    coreDesire: "Harmony, wholeness, belonging.",
    coreNeed: "Space to arrive at their own pace.",
    leadershipStyle: "Consensus, inclusion, quiet steadiness.",
    communicationStyle: "Warm, receptive, unhurried.",
    conflictStyle: "Sees every side — sometimes at the cost of their own.",
    relationshipStyle: "Easy, present, deeply comforting.",
    stressPattern: "Merges with others; forgets their own preference.",
    growthPattern: "Voices what they want before consensus.",
    teamRole: "The Peacemaker — the one who makes the group feel like home.",
    hiddenQuality: "A stubborn, unmovable core.",
    internalContradiction: "Wants to matter, but keeps stepping out of the frame.",
    strongTraits: ["Harmony", "Patience", "Empathy", "Communication"],
    reputation: ["Supportive", "Welcoming", "Steady"],
    hiddenGift: "Unity — the group holds together because of them.",
    blindSpot: "Avoidance that hides real preference.",
  },
};

// ---------- Multi-dimensional trait model ----------

export type Trait =
  | "Leadership"
  | "Trust"
  | "Reliability"
  | "Influence"
  | "Support"
  | "Empathy"
  | "Creativity"
  | "Strategy"
  | "Resilience"
  | "Communication"
  | "Harmony"
  | "Initiative";

const TRAIT_MAP: Record<EnneagramType, Trait[]> = {
  1: ["Reliability", "Trust", "Leadership"],
  2: ["Empathy", "Support", "Harmony"],
  3: ["Leadership", "Influence", "Initiative"],
  4: ["Creativity", "Communication", "Empathy"],
  5: ["Strategy", "Trust", "Communication"],
  6: ["Reliability", "Trust", "Resilience"],
  7: ["Creativity", "Initiative", "Influence"],
  8: ["Leadership", "Resilience", "Influence"],
  9: ["Harmony", "Support", "Communication"],
};

export function computeTraits(person: Person): Record<Trait, number> {
  const traits: Record<Trait, number> = {
    Leadership: 0,
    Trust: 0,
    Reliability: 0,
    Influence: 0,
    Support: 0,
    Empathy: 0,
    Creativity: 0,
    Strategy: 0,
    Resilience: 0,
    Communication: 0,
    Harmony: 0,
    Initiative: 0,
  };
  (Object.keys(person.scores) as unknown as string[]).forEach((k) => {
    const t = Number(k) as EnneagramType;
    const score = person.scores[t];
    if (!score) return;
    TRAIT_MAP[t].forEach((tr, i) => {
      traits[tr] += score * (i === 0 ? 1 : 0.6);
    });
  });
  return traits;
}

// ---------- Reputation titles (room-earned) ----------

export interface ReputationTitle {
  title: string;
  trait: Trait | "Nominations" | "Wins";
  score: number;
  evidence: string;
}

const REPUTATION_MAP: { title: string; traits: Trait[] }[] = [
  { title: "Most Trusted", traits: ["Trust", "Reliability"] },
  { title: "Most Reliable", traits: ["Reliability"] },
  { title: "Most Influential", traits: ["Influence", "Leadership"] },
  { title: "Most Supportive", traits: ["Support", "Empathy"] },
  { title: "Most Strategic", traits: ["Strategy"] },
  { title: "Most Creative", traits: ["Creativity"] },
  { title: "Most Resilient", traits: ["Resilience"] },
  { title: "Most Inspiring", traits: ["Influence", "Initiative"] },
  { title: "Most Empathetic", traits: ["Empathy"] },
  { title: "Most Dependable", traits: ["Reliability", "Trust"] },
];

export function reputationTitlesFor(person: Person, allPeople: Person[]): ReputationTitle[] {
  if (allPeople.length === 0) return [];
  const traitsByPerson = new Map(allPeople.map((p) => [p.id, computeTraits(p)]));
  const mine = traitsByPerson.get(person.id) ?? computeTraits(person);
  const earned: ReputationTitle[] = [];
  for (const entry of REPUTATION_MAP) {
    const myScore = entry.traits.reduce((s, t) => s + mine[t], 0);
    if (myScore <= 0) continue;
    let iAmTop = true;
    for (const other of allPeople) {
      if (other.id === person.id) continue;
      const t = traitsByPerson.get(other.id)!;
      const s = entry.traits.reduce((sum, tr) => sum + t[tr], 0);
      if (s > myScore) {
        iAmTop = false;
        break;
      }
    }
    if (iAmTop) {
      earned.push({
        title: entry.title,
        trait: entry.traits[0],
        score: Math.round(myScore),
        evidence: `Top of the room in ${entry.traits.join(" & ")} — earned across ${person.nominations} nomination${person.nominations === 1 ? "" : "s"}.`,
      });
    }
  }
  return earned.slice(0, 3);
}

// ---------- Evidence Engine ----------

export interface EvidenceItem {
  label: string;
  detail: string;
}

export function evidenceFor(
  person: Person,
  allPeople: Person[],
  questions: QuestionItem[],
): EvidenceItem[] {
  const out: EvidenceItem[] = [];
  const winRate = person.nominations > 0 ? person.wins / person.nominations : 0;
  out.push({
    label: `${person.nominations}`,
    detail: `nomination${person.nominations === 1 ? "" : "s"} tonight`,
  });
  out.push({ label: `${person.wins}`, detail: `win${person.wins === 1 ? "" : "s"}` });
  if (person.nominations >= 2) {
    out.push({ label: `${Math.round(winRate * 100)}%`, detail: "of your nominations became wins" });
  }
  // Category / trait frequency
  const traits = computeTraits(person);
  const topTrait = (Object.entries(traits) as [Trait, number][]).sort((a, b) => b[1] - a[1])[0];
  if (topTrait && topTrait[1] > 0) {
    out.push({ label: `#1`, detail: `strongest signal: ${topTrait[0]}` });
  }
  // Rank in room by wins
  if (allPeople.length > 1) {
    const rankWins =
      [...allPeople].sort((a, b) => b.wins - a.wins).findIndex((p) => p.id === person.id) + 1;
    if (rankWins > 0)
      out.push({ label: `#${rankWins}`, detail: `by wins in the room of ${allPeople.length}` });
  }
  // Trait-based question categories that landed on this person
  const traitHits = new Map<string, number>();
  questions.forEach((q) => {
    if (!q.trait) return;
    const hitLeading = person.scores[q.primaryType] > 0;
    if (hitLeading) traitHits.set(q.trait, (traitHits.get(q.trait) ?? 0) + 1);
  });
  const topCategory = [...traitHits.entries()].sort((a, b) => b[1] - a[1])[0];
  if (topCategory && topCategory[1] >= 2) {
    out.push({ label: `${topCategory[1]}×`, detail: `named in "${topCategory[0]}" moments` });
  }
  return out;
}

// ---------- Social Archetype ----------

const ARCHETYPE_MAP: Record<EnneagramType, string> = {
  1: "The Builder",
  2: "The Mentor",
  3: "The Champion",
  4: "The Visionary",
  5: "The Strategist",
  6: "The Protector",
  7: "The Catalyst",
  8: "The Champion",
  9: "The Diplomat",
};

export function archetypeFor(
  dominant: EnneagramType | null,
  traits: Record<Trait, number>,
): string {
  const sorted = (Object.entries(traits) as [Trait, number][]).sort((a, b) => b[1] - a[1]);
  const top = sorted[0]?.[0];
  if (top === "Leadership" || top === "Initiative")
    return dominant === 3 ? "The Champion" : "The Catalyst";
  if (top === "Trust" || top === "Reliability") return "The Stabilizer";
  if (top === "Empathy" || top === "Support") return "The Connector";
  if (top === "Strategy") return "The Strategist";
  if (top === "Creativity") return "The Innovator";
  if (top === "Harmony") return "The Diplomat";
  return dominant ? ARCHETYPE_MAP[dominant] : "The Newcomer";
}

// ---------- Confidence band ----------

export function confidenceBand(c: number): string {
  if (c >= 96) return "Exceptional Consensus";
  if (c >= 86) return "High Consensus";
  if (c >= 76) return "Strong Agreement";
  if (c >= 61) return "Moderate Agreement";
  return "Emerging Pattern";
}

// ---------- Truth bomb, hidden strength, blind spot, growth ----------

export function truthBombFor(profile: PersonalityProfile): string {
  const t = profile.dominant;
  const n = profile.person.name;
  if (!t) return `${n}, the room is still learning your rhythm — keep showing up.`;
  const intel = TYPE_INTEL[t];
  return `${n} — ${intel.internalContradiction} The room already sees the shape of it.`;
}
