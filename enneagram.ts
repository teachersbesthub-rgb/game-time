export type EnneagramType = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface EnneaTypeInfo {
  type: EnneagramType;
  name: string;
  title: string;
  role: string; // e.g. "The Heart"
  description: string;
  color: string; // oklch
  keywords: string[];
  strengths: string[];
  blindSpots: string[];
  growth: string[];
}

export const ENNEAGRAM: Record<EnneagramType, EnneaTypeInfo> = {
  1: {
    type: 1,
    name: "The Reformer",
    title: "Principled · Purposeful",
    role: "The Compass",
    description:
      "Rational, idealistic, and driven by a strong sense of right and wrong. Ones strive to improve everything around them.",
    color: "oklch(0.68 0.19 25)",
    keywords: ["Integrity", "Discipline", "Ethics"],
    strengths: ["Principled decisions", "High standards", "Reliable follow-through"],
    blindSpots: ["Perfectionism", "Self-criticism", "Rigid thinking"],
    growth: ["Practice self-compassion", "Accept 'good enough'", "Play without a goal"],
  },
  2: {
    type: 2,
    name: "The Helper",
    title: "Caring · Generous",
    role: "The Heart",
    description:
      "Warm, empathetic, and people-pleasing. Twos live to connect and support the people around them.",
    color: "oklch(0.72 0.17 350)",
    keywords: ["Empathy", "Warmth", "Support"],
    strengths: ["Emotional attunement", "Generosity", "Community glue"],
    blindSpots: ["Over-giving", "Hidden needs", "Approval-seeking"],
    growth: ["Name your own needs", "Say no without guilt", "Receive as well as give"],
  },
  3: {
    type: 3,
    name: "The Achiever",
    title: "Success-Oriented · Adaptive",
    role: "The Achiever",
    description:
      "Ambitious, driven, and image-conscious. Threes are natural leaders who set goals and hit them.",
    color: "oklch(0.78 0.17 85)",
    keywords: ["Ambition", "Charisma", "Drive"],
    strengths: ["Execution", "Charismatic leadership", "Adaptability"],
    blindSpots: ["Image over substance", "Workaholism", "Feelings deferred"],
    growth: ["Rest without earning it", "Share the win", "Own true feelings"],
  },
  4: {
    type: 4,
    name: "The Individualist",
    title: "Expressive · Romantic",
    role: "The Visionary",
    description:
      "Self-aware, sensitive, and creative. Fours find meaning in emotional depth and originality.",
    color: "oklch(0.65 0.18 305)",
    keywords: ["Creativity", "Depth", "Authenticity"],
    strengths: ["Creative vision", "Emotional honesty", "Aesthetic sense"],
    blindSpots: ["Melancholy loops", "Envy", "Feeling misunderstood"],
    growth: ["Act before feeling ready", "See what's already here", "Anchor in the ordinary"],
  },
  5: {
    type: 5,
    name: "The Investigator",
    title: "Perceptive · Cerebral",
    role: "The Investigator",
    description:
      "Insightful, curious, and independent. Fives master ideas and pursue knowledge with intensity.",
    color: "oklch(0.62 0.14 240)",
    keywords: ["Insight", "Focus", "Mastery"],
    strengths: ["Deep expertise", "Clear analysis", "Calm under pressure"],
    blindSpots: ["Withdrawal", "Hoarding energy", "Detachment"],
    growth: ["Engage before knowing enough", "Share resources", "Feel in the body"],
  },
  6: {
    type: 6,
    name: "The Loyalist",
    title: "Committed · Security-Oriented",
    role: "The Protector",
    description:
      "Reliable, hardworking, and responsible. Sixes bring loyalty and stability to any team.",
    color: "oklch(0.7 0.16 200)",
    keywords: ["Loyalty", "Trust", "Preparation"],
    strengths: ["Risk awareness", "Team loyalty", "Contingency planning"],
    blindSpots: ["Anxiety spirals", "Distrust", "Second-guessing"],
    growth: ["Trust your own signal", "Act on 70% info", "Notice when things go right"],
  },
  7: {
    type: 7,
    name: "The Enthusiast",
    title: "Spontaneous · Versatile",
    role: "The Spark",
    description:
      "Fun-loving, optimistic, and adventurous. Sevens see possibility everywhere and bring the energy.",
    color: "oklch(0.8 0.18 65)",
    keywords: ["Joy", "Ideas", "Adventure"],
    strengths: ["Idea generation", "Optimism", "Reframing setbacks"],
    blindSpots: ["Scatter", "Avoiding pain", "Overcommitment"],
    growth: ["Finish before starting", "Sit with hard feelings", "Depth over novelty"],
  },
  8: {
    type: 8,
    name: "The Challenger",
    title: "Powerful · Assertive",
    role: "The Challenger",
    description:
      "Confident, decisive, and protective. Eights lead from the front and never back down.",
    color: "oklch(0.62 0.22 20)",
    keywords: ["Power", "Courage", "Command"],
    strengths: ["Decisive action", "Protecting others", "Direct communication"],
    blindSpots: ["Intensity overwhelms", "Control", "Vulnerability hidden"],
    growth: ["Soften without losing strength", "Let others lead", "Show the softer side"],
  },
  9: {
    type: 9,
    name: "The Peacemaker",
    title: "Receptive · Reassuring",
    role: "The Peacemaker",
    description:
      "Easygoing, agreeable, and grounded. Nines create harmony and hold the group together.",
    color: "oklch(0.72 0.15 145)",
    keywords: ["Harmony", "Calm", "Acceptance"],
    strengths: ["Mediation", "Steady presence", "Inclusive listening"],
    blindSpots: ["Conflict avoidance", "Self-forgetting", "Merging with others"],
    growth: ["Voice your preference", "Choose before consensus", "Notice your own agenda"],
  },
};

export const NOMINEE_COLORS = {
  red: "oklch(0.65 0.24 25)",
  blue: "oklch(0.62 0.2 250)",
  green: "oklch(0.7 0.19 150)",
} as const;

export type NomineeColor = keyof typeof NOMINEE_COLORS;

export interface QuestionItem {
  question: string;
  primaryType: EnneagramType;
  secondaryType: EnneagramType;
  trait: string;
  winnerPoints: number;
  secondaryPoints: number;
  nomineePoints: number;
  id?: string;
  dim?: "soc" | "warm" | "rel" | "calm" | "open";
  pole?: 1 | -1;
}

export interface Person {
  id: string;
  name: string;
  wins: number;
  nominations: number;
  scores: Record<EnneagramType, number>;
}

export const makePerson = (name: string): Person => ({
  id: name.trim().toLowerCase(),
  name: name.trim(),
  wins: 0,
  nominations: 0,
  scores: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 },
});

export function leadingTypes(scores: Record<EnneagramType, number>): {
  leading: EnneagramType | null;
  second: EnneagramType | null;
} {
  const entries = (Object.entries(scores) as unknown as [string, number][])
    .map(([k, v]) => [Number(k) as EnneagramType, v] as const)
    .sort((a, b) => b[1] - a[1]);
  const leading = entries[0] && entries[0][1] > 0 ? entries[0][0] : null;
  const second = entries[1] && entries[1][1] > 0 ? entries[1][0] : null;
  return { leading, second };
}

export function validateQuestions(input: unknown): {
  ok: boolean;
  data?: QuestionItem[];
  error?: string;
} {
  if (!Array.isArray(input)) return { ok: false, error: "JSON root must be an array." };
  const out: QuestionItem[] = [];
  for (let i = 0; i < input.length; i++) {
    const q = input[i] as Partial<QuestionItem>;
    if (!q || typeof q !== "object")
      return { ok: false, error: `Entry ${i + 1} is not an object.` };
    if (typeof q.question !== "string" || !q.question.trim())
      return { ok: false, error: `Entry ${i + 1} missing "question".` };
    const p = Number(q.primaryType);
    const s = Number(q.secondaryType);
    if (!(p >= 1 && p <= 9)) return { ok: false, error: `Entry ${i + 1} invalid primaryType.` };
    if (!(s >= 1 && s <= 9)) return { ok: false, error: `Entry ${i + 1} invalid secondaryType.` };
    out.push({
      question: q.question.trim(),
      primaryType: p as EnneagramType,
      secondaryType: s as EnneagramType,
      trait: typeof q.trait === "string" ? q.trait : "",
      winnerPoints: Number(q.winnerPoints ?? 3),
      secondaryPoints: Number(q.secondaryPoints ?? 2),
      nomineePoints: Number(q.nomineePoints ?? 1),
    });
  }
  return { ok: true, data: out };
}

export const SAMPLE_PACKAGE: QuestionItem[] = [
  {
    question: "Who would make the best principal?",
    primaryType: 3,
    secondaryType: 8,
    trait: "Leadership",
    winnerPoints: 3,
    secondaryPoints: 2,
    nomineePoints: 1,
  },
  {
    question: "Who is most likely to throw the best party?",
    primaryType: 7,
    secondaryType: 2,
    trait: "Fun",
    winnerPoints: 3,
    secondaryPoints: 2,
    nomineePoints: 1,
  },
  {
    question: "Who would you call in a crisis?",
    primaryType: 6,
    secondaryType: 8,
    trait: "Reliability",
    winnerPoints: 3,
    secondaryPoints: 2,
    nomineePoints: 1,
  },
  {
    question: "Who is the group's peacemaker?",
    primaryType: 9,
    secondaryType: 2,
    trait: "Harmony",
    winnerPoints: 3,
    secondaryPoints: 2,
    nomineePoints: 1,
  },
  {
    question: "Who is the most creative mind here?",
    primaryType: 4,
    secondaryType: 5,
    trait: "Creativity",
    winnerPoints: 3,
    secondaryPoints: 2,
    nomineePoints: 1,
  },
];
