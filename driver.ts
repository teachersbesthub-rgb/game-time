// The show runs itself. This hook (mounted on the audience Presentation screen) advances
// every screen on a timer and plays sound cues. The only human input is the winner tap.
import { useEffect } from "react";
import { useEvent, type EventState } from "./event-store";
import { play } from "./sound";

export const TIMING = {
  welcome: 6000,
  question: 4500,
  winner: 5200,
  insight: 5500,
  analyzing: 3200,
  results: 9000,
  profile: 12000,
  chemistry: 11000,
  awards: 11000,
  summary: 10000,
};

// People are shown with the biggest standouts last.
function orderedIds(s: Pick<EventState, "people">): string[] {
  return Object.values(s.people)
    .sort((a, b) => a.wins - b.wins || a.name.localeCompare(b.name))
    .map((p) => p.id);
}

export function useShowDriver() {
  const live = useEvent((s) => s.live);
  const screen = useEvent((s) => s.screen);
  const idx = useEvent((s) => s.currentIndex);
  const selected = useEvent((s) => s.selectedPersonId);

  // Sound cues
  useEffect(() => {
    if (!live) return;
    const cue: Record<string, Parameters<typeof play>[0] | undefined> = {
      welcome: "whoosh",
      question: "whoosh",
      nominees: "spotlight",
      winner: "confetti",
      insight: "discovery",
      analyzing: "tension",
      results: "victory",
      chemistry: "discovery",
      awards: "victory",
      summary: "discovery",
      finale: "victory",
    };
    const c = cue[screen];
    if (c) play(c);
  }, [live, screen, idx]);

  // Automatic flow
  useEffect(() => {
    if (!live) return;
    const after = (ms: number, fn: () => void) => {
      const t = setTimeout(fn, ms);
      return () => clearTimeout(t);
    };
    const st = () => useEvent.getState();
    switch (screen) {
      case "welcome":
        return after(TIMING.welcome, () => st().beginRound());
      case "question":
        return after(TIMING.question, () => st().set({ screen: "nominees" }));
      case "winner":
        return after(TIMING.winner, () => (st().pendingPopup ? st().showPopup() : st().advance()));
      case "insight":
        return after(TIMING.insight, () => st().advance());
      case "analyzing":
        return after(TIMING.analyzing, () => st().showResults());
      case "results":
        return after(TIMING.results, () => {
          const first = orderedIds(st())[0];
          if (first) st().set({ screen: "profiles", selectedPersonId: first });
          else st().showChemistry();
        });
      case "profiles": {
        const ids = orderedIds(st());
        if (!selected && ids.length) return after(50, () => st().selectPerson(ids[0]));
        return after(TIMING.profile, () => {
          const i = ids.indexOf(selected ?? "");
          if (i >= 0 && i + 1 < ids.length) st().selectPerson(ids[i + 1]);
          else st().showChemistry();
        });
      }
      case "chemistry":
        return after(TIMING.chemistry, () => st().showAwards());
      case "awards":
        return after(TIMING.awards, () => st().showSummary());
      case "summary":
        return after(TIMING.summary, () => st().showFinale());
      default:
        return;
    }
  }, [live, screen, idx, selected]);
}
