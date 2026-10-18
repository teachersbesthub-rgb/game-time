// Full-show smoke test of the store logic (no browser): runs a whole show and checks invariants.
import { useEvent } from "../src/lib/event-store";
import { loadBank } from "../src/lib/bank";
const names = ["Ava", "Ben", "Cara", "Dev", "Eli", "Fay", "Gus", "Hana"];
const b = await loadBank();
if (!b.ok) throw new Error("bank");
const st = () => useEvent.getState();
st().beginShow({ names, count: 40, bank: b.data });
if (st().screen !== "welcome" || !st().live) throw new Error("start");
st().beginRound();
let popups = 0,
  seenQ = new Set<string>(),
  prevDim = "";
for (let i = 0; i < 40; i++) {
  const s = st();
  if (s.screen !== "question") throw new Error(`round ${i}: screen ${s.screen}`);
  const n = [s.nominees.red, s.nominees.blue, s.nominees.green];
  if (new Set(n).size !== 3 || n.some((x) => !x)) throw new Error("nominees " + n);
  const q = s.questions[s.currentIndex];
  if (q.dim === prevDim) throw new Error("same trait twice");
  prevDim = q.dim!;
  seenQ.add(q.question);
  s.set({ screen: "nominees" });
  st().recordWinner(Math.floor(Math.random() * 3) as 0 | 1 | 2);
  if (st().screen !== "winner") throw new Error("winner screen");
  if (i === 5) {
    st().recordWinner(0);
  } // correction must not add a round
  if (st().pendingPopup) {
    popups++;
    st().showPopup();
    if (st().screen !== "insight") throw new Error("popup");
  }
  st().advance();
}
const s = st();
console.log(
  "final screen:",
  s.screen,
  "| rounds:",
  s.rounds.length,
  "| unique questions:",
  seenQ.size,
  "| popups:",
  popups,
);
const apps = names.map((n) => s.rounds.filter((r) => r.nominees.includes(n)).length);
console.log("appearances per player:", apps.join(","));
console.log(
  "sample people:",
  Object.values(s.people)
    .slice(0, 3)
    .map((p) => `${p.name} wins=${p.wins} nom=${p.nominations}`)
    .join(" | "),
);
if (s.screen !== "analyzing" || s.rounds.length !== 40) throw new Error("end state");
st().recordWinner(null);
console.log("SMOKE OK");
