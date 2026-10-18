// Story Engine — converts LivingProfile evidence into storyteller-voice beats.
// Pure/deterministic. Presentation and host both call into this module.

import { ENNEAGRAM, type Person, type QuestionItem } from "./enneagram";
import { buildAllProfiles, traitLeaders, type LivingProfile } from "./personality-engine";
import { complimentFor, truthBombFor, ifYouJustMet, groupArchetype } from "./ai-brain";

export type BeatKind =
  | "discovery"
  | "surprise"
  | "funny"
  | "emotional"
  | "group"
  | "truthBomb"
  | "compliment"
  | "finale";

export interface StoryBeat {
  kind: BeatKind;
  title: string;
  lines: string[]; // rendered line-by-line for cinematic reveals
  personId?: string;
  chapter?: number;
}

// ---------- top-level generators ----------

export function discoveryBeats(people: Person[], questions: QuestionItem[]): StoryBeat[] {
  const profiles = Object.values(buildAllProfiles(people, questions));
  if (profiles.length < 2) return [];
  const leaders = traitLeaders(profiles);
  const out: StoryBeat[] = [];

  const trust = leaders.trust;
  if (trust) {
    out.push({
      kind: "discovery",
      title: "Something the room kept doing",
      lines: [
        "Something kept happening tonight.",
        `Whenever the group needed someone to lean on, ${trust.name}'s name kept coming up.`,
        "That wasn't an accident.",
      ],
    });
  }

  const lead = leaders.leadership;
  if (lead && (!trust || lead.name !== trust.name)) {
    out.push({
      kind: "discovery",
      title: "The person who moved the room",
      lines: [
        "There was a pattern nobody talked about.",
        `When motion was needed, the room turned to ${lead.name} — over and over.`,
      ],
    });
  }

  const hidden = leaders.hidden;
  if (hidden) {
    out.push({
      kind: "surprise",
      title: "The quiet one you might've missed",
      lines: [
        "Not everyone announces themselves.",
        `${hidden.name} moved quietly through tonight — and the room noticed anyway.`,
      ],
    });
  }

  const conn = leaders.connector;
  if (conn) {
    out.push({
      kind: "emotional",
      title: "Who held the room together",
      lines: [
        "There's usually one person who keeps a group from splintering.",
        `Tonight, that was ${conn.name}.`,
      ],
    });
  }

  return out;
}

export function surpriseBeats(people: Person[], questions: QuestionItem[]): StoryBeat[] {
  const profiles = Object.values(buildAllProfiles(people, questions));
  const out: StoryBeat[] = [];
  profiles.forEach((pr) => {
    // Self vs group gap — approximated from spectrum spread.
    const top = pr.topTypes[0];
    const second = pr.topTypes[1];
    if (top && second && Math.abs(pr.spectrum[top] - pr.spectrum[second]) < 0.08) {
      out.push({
        kind: "surprise",
        personId: pr.personId,
        title: "A room-sized surprise",
        lines: [
          `The room sees ${pr.name} as both ${ENNEAGRAM[top].role} and ${ENNEAGRAM[second].role}.`,
          "That combination is rarer than it sounds.",
        ],
      });
    }
  });
  return out.slice(0, 3);
}

export function funnyBeats(people: Person[]): StoryBeat[] {
  const total = people.length;
  const jokes: string[] = [];
  if (total >= 3)
    jokes.push("If this group started a business, there would be six ideas before lunch.");
  if (total >= 4)
    jokes.push("This group has at least three people who would volunteer before hearing the plan.");
  if (total >= 5) jokes.push("Somehow this room always finds someone willing to help.");
  return jokes.map((line) => ({
    kind: "funny" as const,
    title: "For the record",
    lines: [line],
  }));
}

export function truthBombBeats(people: Person[]): StoryBeat[] {
  return people.map((p) => ({
    kind: "truthBomb" as const,
    personId: p.id,
    title: "Truth bomb",
    lines: ["TRUTH BOMB", truthBombFor(p)],
  }));
}

export function complimentBeats(people: Person[]): StoryBeat[] {
  return people.map((p) => ({
    kind: "compliment" as const,
    personId: p.id,
    title: `For ${p.name}`,
    lines: [complimentFor(p)],
  }));
}

export function ifYouJustMetBeats(people: Person[]): StoryBeat[] {
  return people.map((p) => ({
    kind: "compliment" as const,
    personId: p.id,
    title: `If you just met ${p.name}…`,
    lines: [ifYouJustMet(p)],
  }));
}

export function groupBeat(people: Person[]): StoryBeat {
  const arch = groupArchetype(people);
  return {
    kind: "group",
    title: arch.title,
    lines: [arch.title + ".", arch.tagline],
  };
}

// A single mixed sequence the presentation can pop between rounds.
export function shuffleShowBeats(
  people: Person[],
  questions: QuestionItem[],
  currentIndex: number,
): StoryBeat[] {
  const beats: StoryBeat[] = [
    ...discoveryBeats(people, questions),
    ...surpriseBeats(people, questions),
    ...funnyBeats(people),
  ];
  // deterministic rotation by round
  const start = beats.length ? currentIndex % beats.length : 0;
  return beats.slice(start).concat(beats.slice(0, start));
}

// Small formatter used by presentation lines.
export function primaryLineFor(p: LivingProfile): string {
  const t = p.topTypes[0];
  if (!t) return `${p.name} is still coming into focus tonight.`;
  return `${p.name} — ${ENNEAGRAM[t].role}. ${ENNEAGRAM[t].keywords[0]} in the way the room felt it.`;
}
