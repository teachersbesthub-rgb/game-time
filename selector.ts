// Picks 3 nominees for a round. Adaptive: people with the fewest appearances on this
// trait come first. Also avoids back-to-back appearances and repeating the same trio,
// with a little seeded randomness so it never looks patterned.
import type { DimKey } from "./bank";
import { idOf, type Round } from "./ledger";
import { mulberry32, shuffle } from "./rng";

export function pickNominees(
  names: string[],
  rounds: Round[],
  dim: DimKey,
  seed: number,
): [string, string, string] {
  const rnd = mulberry32(seed);
  const recent = rounds.slice(-2);
  const stat = names.map((name) => {
    const id = idOf(name);
    let nDim = 0;
    let nAll = 0;
    for (const r of rounds) {
      if (r.nominees.some((x) => idOf(x) === id)) {
        nAll++;
        if (r.dim === dim) nDim++;
      }
    }
    const justSeen = recent.filter((r) => r.nominees.some((x) => idOf(x) === id)).length;
    return { id, base: nDim * 4 + nAll + justSeen * 3 + rnd() * 1.5 };
  });

  const pairCount = (a: string, b: string) =>
    rounds.filter((r) => {
      const ids = r.nominees.map(idOf);
      return ids.includes(a) && ids.includes(b);
    }).length;

  const chosen: string[] = [];
  while (chosen.length < 3) {
    let best: { id: string } | null = null;
    let bestScore = Infinity;
    for (const s of stat) {
      if (chosen.includes(s.id)) continue;
      const score = s.base + chosen.reduce((sum, c) => sum + pairCount(c, s.id) * 2, 0);
      if (score < bestScore) {
        best = s;
        bestScore = score;
      }
    }
    chosen.push(best!.id);
  }
  const picked = chosen.map((id) => names.find((n) => idOf(n) === id)!);
  return shuffle(picked, rnd) as [string, string, string]; // random red/blue/green slots
}
