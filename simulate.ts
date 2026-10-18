// Simulates a session: synthetic people with known true traits, noisy voters, popularity bias.
// Reports how well the engine recovers the true traits. Run: bun scripts/simulate.ts
import { DEFAULT_BANK } from "../src/lib/default-bank";
import { DIMS, orderQuestions, validateBank } from "../src/lib/bank";
import { scoreGroup, TUNING, type Round } from "../src/lib/ledger";
import { pickNominees } from "../src/lib/selector";
import { mulberry32 } from "../src/lib/rng";

const N = Number(process.env.N ?? 20);
const NOISE = Number(process.env.NOISE ?? 1.0); // how noisy each voter's judgement is
const LIKE = Number(process.env.LIKE ?? 0.6); // popularity bias strength
const TRIALS = Number(process.env.TRIALS ?? 30);
const bank = (validateBank(DEFAULT_BANK) as any).data;

function gauss(r: () => number) {
  return Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
}
function corr(a: number[], b: number[]) {
  const n = a.length,
    ma = a.reduce((s, v) => s + v, 0) / n,
    mb = b.reduce((s, v) => s + v, 0) / n;
  let sab = 0,
    saa = 0,
    sbb = 0;
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb);
    saa += (a[i] - ma) ** 2;
    sbb += (b[i] - mb) ** 2;
  }
  return sab / Math.sqrt(saa * sbb + 1e-12);
}

function run(rounds: number, seed: number) {
  const r = mulberry32(seed);
  const names = Array.from({ length: N }, (_, i) => `P${i}`);
  const truth = names.map(
    () => Object.fromEntries(DIMS.map((d) => [d, gauss(r)])) as Record<string, number>,
  );
  const like = names.map(() => gauss(r) * LIKE);
  const qs = orderQuestions(bank, seed, rounds);
  const log: Round[] = [];
  qs.forEach((q, qi) => {
    const nom = pickNominees(names, log, q.dim, seed * 1000 + qi);
    const idx = nom.map((n) => names.indexOf(n));
    let votes: [number, number, number] = [0, 0, 0];
    const voters = N - 3;
    for (let v = 0; v < voters; v++) {
      let best = 0,
        bs = -1e9;
      idx.forEach((pi, k) => {
        const s = q.pole * truth[pi][q.dim] + like[pi] + gauss(r) * NOISE;
        if (s > bs) {
          bs = s;
          best = k;
        }
      });
      votes[best]++;
    }
    if (process.env.WINNER_ONLY) {
      const mx = Math.max(...votes);
      const w = votes.indexOf(mx);
      votes =
        votes.filter((v) => v === mx).length === 1
          ? [w === 0 ? 3 : 0, w === 1 ? 3 : 0, w === 2 ? 3 : 0]
          : [0, 0, 0];
    }
    log.push({ qid: q.id, dim: q.dim, pole: q.pole, nominees: nom, votes, at: qi });
  });
  const prof = scoreGroup(log, names);
  const half1 = scoreGroup(
    log.filter((_, i) => i % 2 === 0),
    names,
  );
  const half2 = scoreGroup(
    log.filter((_, i) => i % 2 === 1),
    names,
  );
  const res: Record<string, { acc: number; split: number }> = {};
  for (const d of DIMS) {
    res[d] = {
      acc: corr(
        names.map((_, i) => prof[names[i].toLowerCase()][d].z),
        truth.map((t) => t[d]),
      ),
      split: corr(
        names.map((n) => half1[n.toLowerCase()][d].z),
        names.map((n) => half2[n.toLowerCase()][d].z),
      ),
    };
  }
  const apps = names.map((n) => log.filter((x) => x.nominees.includes(n as any)).length);
  return { res, minApp: Math.min(...apps), maxApp: Math.max(...apps) };
}

const SK = process.env.SK,
  HA = process.env.HA;
if (SK) (TUNING as any).SHRINK_K = Number(SK);
if (HA) (TUNING as any).HALO = Number(HA);
const ROUNDS = process.env.ROUNDS
  ? process.env.ROUNDS.split(",").map(Number)
  : [40, 60, 80, 100, 120];
console.log(
  `N=${N} noise=${NOISE} like=${LIKE} trials=${TRIALS}  (SHRINK_K=${TUNING.SHRINK_K} HALO=${TUNING.HALO})`,
);
for (const rounds of ROUNDS) {
  const acc: number[] = [],
    split: number[] = [];
  let mn = 99,
    mx = 0;
  for (let t = 0; t < TRIALS; t++) {
    const o = run(rounds, 7 + t);
    DIMS.forEach((d) => {
      acc.push(o.res[d].acc);
      split.push(o.res[d].split);
    });
    mn = Math.min(mn, o.minApp);
    mx = Math.max(mx, o.maxApp);
  }
  const avg = (a: number[]) => (a.reduce((s, v) => s + v, 0) / a.length).toFixed(2);
  console.log(
    `rounds=${String(rounds).padStart(3)}  truth-corr=${avg(acc)}  split-half=${avg(split)}  appearances/person min=${mn} max=${mx}`,
  );
}
