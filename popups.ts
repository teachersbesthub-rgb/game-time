// Detects "show moments" from the real results. Returns pop-ups; the show decides when to display them.
import { DIMS } from "./bank";
import { allNames, DIM_LABEL, idOf, scoreGroup, winnerIndex, type Round } from "./ledger";

export interface Popup {
  key: string; // never shown twice
  kind: "first" | "streak" | "signal" | "mystery";
  icon: string;
  title: string;
  text: string;
  names: string[];
}

function winsOf(rounds: Round[], id: string): boolean[] {
  // one entry per appearance, true = won that round
  const out: boolean[] = [];
  for (const r of rounds) {
    const i = r.nominees.findIndex((n) => idOf(n) === id);
    if (i < 0) continue;
    out.push(winnerIndex(r.votes) === i);
  }
  return out;
}

export function popupsForRound(
  rounds: Round[],
  roster: string[],
  shown: ReadonlySet<string>,
): Popup[] {
  const out: Popup[] = [];
  const n = rounds.length;
  const last = rounds[n - 1];
  if (!last) return out;
  const names = allNames(rounds, roster);
  const wi = winnerIndex(last.votes);

  if (wi >= 0) {
    const w = last.nominees[wi];
    const id = idOf(w);
    const hist = winsOf(rounds, id);
    const totalWins = hist.filter(Boolean).length;
    if (totalWins === 1 && n >= 3)
      out.push({
        key: `first:${id}`,
        kind: "first",
        icon: "⭐",
        title: "First win",
        text: `${w} is on the board.`,
        names: [w],
      });
    if (hist.length >= 2 && hist[hist.length - 1] && hist[hist.length - 2])
      out.push({
        key: `streak:${id}:${totalWins}`,
        kind: "streak",
        icon: "🔥",
        title: "Two for two",
        text: `${w} won again. The room keeps choosing them.`,
        names: [w],
      });
  }

  // Slower pop-ups only every 4th round so they never point back at the last question.
  if (n % 4 === 0) {
    const prof = scoreGroup(rounds, names);
    let best: { name: string; dim: (typeof DIMS)[number]; z: number } | null = null;
    for (const name of names) {
      for (const d of DIMS) {
        const e = prof[idOf(name)]?.[d];
        if (
          e &&
          e.n >= 2 &&
          e.z >= 1.2 &&
          !shown.has(`signal:${idOf(name)}`) &&
          (!best || e.z > best.z)
        )
          best = { name, dim: d, z: e.z };
      }
    }
    if (best)
      out.push({
        key: `signal:${idOf(best.name)}`,
        kind: "signal",
        icon: "🔍",
        title: "Signal detected",
        text: `${best.name}: something ${DIM_LABEL[best.dim]}-shaped is taking form…`,
        names: [best.name],
      });
    if (n >= 8)
      for (const name of names) {
        const id = idOf(name);
        if (winsOf(rounds, id).length <= 2)
          out.push({
            key: `mystery:${id}`,
            kind: "mystery",
            icon: "🔒",
            title: "Still a mystery",
            text: `${name} has barely been seen. Something is hidden here.`,
            names: [name],
          });
      }
  }
  return out.filter((p) => !shown.has(p.key));
}
