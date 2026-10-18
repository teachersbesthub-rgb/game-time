import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useEvent } from "@/lib/event-store";
import { NOMINEE_COLORS, type NomineeColor } from "@/lib/enneagram";
import {
  bankToText,
  bankWarnings,
  clearBankOverride,
  loadBank,
  parseQuestionText,
  saveBankOverride,
  type BankQuestion,
} from "@/lib/bank";

export const Route = createFileRoute("/host")({
  head: () => ({
    meta: [
      { title: "Host Panel · Enneagram Event" },
      {
        name: "description",
        content: "Host panel: players, question count, questions and winners.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: HostPanel,
});

const card = "rounded-2xl border border-black/10 bg-white p-5 shadow-sm";
const label = "text-xs font-bold uppercase tracking-widest text-black/60";

function HostPanel() {
  const live = useEvent((s) => s.live);
  return (
    <div className="min-h-screen bg-[oklch(0.98_0_0)] text-[oklch(0.2_0.04_275)]">
      <header className="sticky top-0 z-10 border-b border-black/5 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="text-sm font-bold">Enneagram Host Panel</div>
          <div className="flex items-center gap-2">
            <Link
              to="/presentation"
              target="_blank"
              className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold shadow-sm hover:bg-black/5"
            >
              Open Presentation ↗
            </Link>
            {live && (
              <button
                onClick={() => {
                  if (confirm("End this show and start over? All results are erased."))
                    useEvent.getState().reset();
                }}
                className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-sm hover:bg-red-50"
              >
                End show
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-6 py-8">
        {live ? <LiveControls /> : <Setup />}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- before the show
function Setup() {
  const participants = useEvent((s) => s.participants);
  const [name, setName] = useState("");
  const [count, setCount] = useState<number | null>(null);
  const [bank, setBank] = useState<BankQuestion[]>([]);
  const [source, setSource] = useState("");
  const [text, setText] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  const refreshBank = async () => {
    const b = await loadBank();
    if (b.ok) {
      setBank(b.data);
      setText(bankToText(b.data));
      setSource(b.source);
    }
  };
  useEffect(() => {
    refreshBank();
  }, []);

  const n = participants.length;
  const recommended = Math.min(300, Math.max(30, n * 6));
  const total = count ?? recommended;
  const appearances = n >= 3 ? Math.round((total * 3) / n) : 0;
  const warnings = bankWarnings(bank);
  const canStart = n >= 3 && bank.length >= 10 && total >= 10;

  const addNames = () => {
    name
      .split(/[,\n]/)
      .map((x) => x.trim())
      .filter(Boolean)
      .forEach((x) => useEvent.getState().addParticipant(x));
    setName("");
  };

  const saveQuestions = () => {
    const parsed = parseQuestionText(text);
    if (!parsed.ok) return setMsg({ ok: false, text: parsed.error });
    const res = saveBankOverride(JSON.stringify({ questions: parsed.data }));
    if (!res.ok) return setMsg({ ok: false, text: res.error });
    setBank(parsed.data);
    setSource("your questions");
    setMsg({ ok: true, text: `Saved ${parsed.data.length} questions.` });
  };

  return (
    <>
      <section className={card}>
        <div className={label}>1 · Players ({n})</div>
        <div className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addNames();
              }
            }}
            placeholder="Type a name and press Enter (or paste a comma-separated list)"
            className="flex-1 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <button
            onClick={addNames}
            className="rounded-lg bg-[oklch(0.14_0.04_275)] px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            Add
          </button>
        </div>
        {n > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {participants.map((p) => (
              <span
                key={p.id}
                className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-xs font-semibold"
              >
                {p.name}
                <button
                  onClick={() => useEvent.getState().removeParticipant(p.id)}
                  className="text-black/40 hover:text-red-600"
                  aria-label={`Remove ${p.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        {n < 3 && <div className="mt-3 text-xs text-black/50">Add at least 3 players.</div>}
      </section>

      <section className={card}>
        <div className={label}>2 · Number of questions</div>
        <div className="mt-3 flex items-center gap-3">
          <input
            type="number"
            min={10}
            max={300}
            value={total}
            onChange={(e) => setCount(Math.max(0, Math.min(300, Number(e.target.value) || 0)))}
            className="w-28 rounded-lg border border-black/10 px-3 py-2 text-sm outline-none focus:border-black/30"
          />
          <span className="text-xs text-black/60">
            {n >= 3
              ? `Each player will appear about ${appearances} times. Recommended: ${recommended}+ (more questions = more accurate results).`
              : "Add players to see a recommendation."}
          </span>
        </div>
        {bank.length > 0 && total > bank.length && (
          <div className="mt-2 text-xs text-amber-700">
            You asked for {total} but there are {bank.length} questions. Questions will repeat with
            different nominees.
          </div>
        )}
      </section>

      <section className={card}>
        <div className="flex items-center justify-between">
          <div className={label}>3 · Questions</div>
          <div className="text-xs text-black/50">
            {bank.length} loaded · from {source || "…"}
          </div>
        </div>
        {warnings.length > 0 && (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-700">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setShowEditor((v) => !v)}
          className="mt-3 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-bold hover:bg-black/5"
        >
          {showEditor ? "Hide" : "Show / edit"} questions
        </button>
        {showEditor && (
          <div className="mt-3">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              spellCheck={false}
              rows={16}
              className="w-full rounded-lg border border-black/10 p-3 font-mono text-xs outline-none focus:border-black/30"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={saveQuestions}
                className="rounded-lg bg-[oklch(0.14_0.04_275)] px-4 py-2 text-xs font-bold text-white hover:opacity-90"
              >
                Save questions
              </button>
              <button
                onClick={async () => {
                  clearBankOverride();
                  await refreshBank();
                  setMsg({ ok: true, text: "Restored the built-in questions." });
                }}
                className="rounded-lg border border-black/10 bg-white px-4 py-2 text-xs font-bold hover:bg-black/5"
              >
                Restore built-in questions
              </button>
            </div>
          </div>
        )}
        {msg && (
          <div
            className={`mt-3 text-xs font-semibold ${msg.ok ? "text-green-600" : "text-red-600"}`}
          >
            {msg.text}
          </div>
        )}
      </section>

      <button
        onClick={() =>
          useEvent
            .getState()
            .beginShow({ names: participants.map((p) => p.name), count: total, bank })
        }
        disabled={!canStart}
        className="w-full rounded-2xl bg-gradient-to-br from-[oklch(0.55_0.2_290)] to-[oklch(0.65_0.22_320)] px-6 py-4 text-lg font-black text-white shadow-md hover:opacity-95 disabled:opacity-40"
      >
        ▶ Start the show
      </button>
      <p className="text-center text-xs text-black/50">
        Open the Presentation screen on the projector first and click “enable sound” there once.
        After you start, the show runs by itself.
      </p>
    </>
  );
}

// ---------------------------------------------------------------- during the show
const SLOTS: { key: NomineeColor; letter: string }[] = [
  { key: "red", letter: "A" },
  { key: "blue", letter: "B" },
  { key: "green", letter: "C" },
];
const STATUS: Record<string, string> = {
  welcome: "Opening sequence…",
  question: "Showing the question…",
  nominees: "Nominees are on screen. Tap the winner.",
  winner: "Winner recorded. Next question is coming up automatically.",
  insight: "Showing a group moment…",
  analyzing: "Analyzing the results…",
  results: "Showing results…",
  profiles: "Showing personality readings…",
  chemistry: "Showing group chemistry…",
  awards: "Showing awards…",
  summary: "Showing the summary…",
  finale: "The show is complete. 🎉",
};

function LiveControls() {
  const screen = useEvent((s) => s.screen);
  const idx = useEvent((s) => s.currentIndex);
  const total = useEvent((s) => s.questions.length);
  const q = useEvent((s) => s.questions[s.currentIndex]);
  const nominees = useEvent((s) => s.nominees);
  const winner = useEvent((s) => s.winnerColor);
  const canPick = screen === "nominees" || screen === "winner";
  const inRounds = ["question", "nominees", "winner", "insight"].includes(screen);

  return (
    <>
      <section className={card}>
        <div className="flex items-center justify-between">
          <div className={label}>Live show</div>
          {inRounds && (
            <div className="text-xs font-semibold text-black/60">
              Question {idx + 1} of {total}
            </div>
          )}
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/5">
          <div
            className="h-full bg-[oklch(0.6_0.2_290)] transition-all"
            style={{
              width: `${(Math.min(idx + (screen === "winner" ? 1 : 0), total) / Math.max(1, total)) * 100}%`,
            }}
          />
        </div>
        <div className="mt-4 text-sm text-black/70">{STATUS[screen] ?? "Running…"}</div>
        {q && inRounds && (
          <div className="mt-3 text-2xl font-black leading-tight">{q.question}</div>
        )}
      </section>

      {canPick && (
        <section className={card}>
          <div className={label}>
            {screen === "winner" ? "Wrong winner? Tap the right one" : "Who won?"}
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            {SLOTS.map((s, i) => {
              const active = winner === s.key;
              return (
                <button
                  key={s.key}
                  onClick={() => useEvent.getState().recordWinner(i as 0 | 1 | 2)}
                  disabled={!nominees[s.key]}
                  className={`rounded-xl p-5 text-left text-white shadow-sm transition-all disabled:opacity-40 ${active ? "scale-[1.03] ring-4 ring-black/25" : "opacity-95 hover:opacity-100"}`}
                  style={{ background: NOMINEE_COLORS[s.key] }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                    {s.letter} · {s.key}
                  </div>
                  <div className="mt-1 text-xl font-black">{nominees[s.key] || "—"}</div>
                  {active && <div className="mt-1 text-xs font-bold">✓ recorded</div>}
                </button>
              );
            })}
          </div>
          {screen === "nominees" && (
            <button
              onClick={() => useEvent.getState().recordWinner(null)}
              className="mt-4 rounded-lg border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-black/60 hover:bg-black/5"
            >
              No clear winner — skip this question
            </button>
          )}
        </section>
      )}

      <p className="text-center text-xs text-black/50">
        Keep the Presentation window open. It drives the timing, sound and reveals.
      </p>
    </>
  );
}
