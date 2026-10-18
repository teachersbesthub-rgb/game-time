// Question bank: loads from a host override, then /questions.json, then the built-in default.
// Validates, reports quality warnings, and builds the show order.
import type { QuestionItem } from "./enneagram";
import { DEFAULT_BANK } from "./default-bank";
import { mulberry32, shuffle } from "./rng";

export type DimKey = "soc" | "warm" | "rel" | "calm" | "open";
export const DIMS: DimKey[] = ["soc", "warm", "rel", "calm", "open"];

export interface BankQuestion {
  id: string;
  dim: DimKey;
  pole: 1 | -1; // 1 = high end of the trait, -1 = low end
  q: string;
}

export type BankResult = { ok: true; data: BankQuestion[] } | { ok: false; error: string };

const OVERRIDE_KEY = "show-question-bank-override-v1";

export function validateBank(raw: unknown): BankResult {
  const arr = Array.isArray(raw) ? raw : (raw as { questions?: unknown })?.questions;
  if (!Array.isArray(arr)) return { ok: false, error: 'Expected {"questions":[ ... ]}.' };
  const seen = new Set<string>();
  const data: BankQuestion[] = [];
  for (let i = 0; i < arr.length; i++) {
    const r = arr[i] as Partial<BankQuestion> & { question?: string };
    const n = i + 1;
    const text = typeof r?.q === "string" ? r.q : typeof r?.question === "string" ? r.question : "";
    if (text.trim().length < 8)
      return { ok: false, error: `Question ${n}: "q" is missing or too short.` };
    if (!DIMS.includes(r.dim as DimKey))
      return { ok: false, error: `Question ${n}: "dim" must be one of ${DIMS.join(", ")}.` };
    const id = typeof r.id === "string" && r.id.trim() ? r.id.trim() : `q${n}`;
    if (seen.has(id)) return { ok: false, error: `Question ${n}: duplicate id "${id}".` };
    seen.add(id);
    data.push({ id, dim: r.dim as DimKey, pole: r.pole === -1 ? -1 : 1, q: text.trim() });
  }
  if (data.length < 10) return { ok: false, error: "Need at least 10 questions." };
  return { ok: true, data };
}

/** Human-readable quality warnings for the host. */
export function bankWarnings(bank: BankQuestion[]): string[] {
  const out: string[] = [];
  for (const d of DIMS) {
    const all = bank.filter((q) => q.dim === d);
    const low = all.filter((q) => q.pole === -1).length;
    if (all.length < 6) out.push(`Trait "${d}" has only ${all.length} questions (aim for 8+).`);
    if (all.length >= 6 && low === 0)
      out.push(`Trait "${d}" has no low-end questions (they catch popularity voting).`);
  }
  return out;
}

export type LoadedBank = BankResult & { source: string };

export async function loadBank(): Promise<LoadedBank> {
  if (typeof window !== "undefined") {
    const o = localStorage.getItem(OVERRIDE_KEY);
    if (o) {
      try {
        const v = validateBank(JSON.parse(o));
        if (v.ok) return { ...v, source: "your pasted questions" };
      } catch {
        /* fall through */
      }
    }
    try {
      const res = await fetch(`/questions.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        const v = validateBank(await res.json());
        if (v.ok) return { ...v, source: "questions.json" };
      }
    } catch {
      /* fall through to built-in */
    }
  }
  const v = validateBank(DEFAULT_BANK);
  return { ...v, source: "built-in bank" };
}

export function saveBankOverride(text: string): BankResult {
  try {
    const v = validateBank(JSON.parse(text));
    if (v.ok) localStorage.setItem(OVERRIDE_KEY, text);
    return v;
  } catch (e) {
    return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
  }
}

export function clearBankOverride() {
  localStorage.removeItem(OVERRIDE_KEY);
}

export function bankToJSON(bank: BankQuestion[], title = "Coworkers"): string {
  return JSON.stringify({ title, questions: bank }, null, 2);
}

/**
 * Builds the show order: never two questions of the same trait in a row.
 * If count > bank size, the bank is reused in another shuffled pass
 * (nominees differ, so the data is still valid).
 */
export function orderQuestions(bank: BankQuestion[], seed: number, count = 60): BankQuestion[] {
  const rnd = mulberry32(seed);
  const out: BankQuestion[] = [];
  let pass = 0;
  let last: DimKey | null = null;
  while (out.length < count && bank.length) {
    const pools = {} as Record<DimKey, BankQuestion[]>;
    DIMS.forEach(
      (d) =>
        (pools[d] = shuffle(
          bank.filter((q) => q.dim === d),
          rnd,
        )),
    );
    while (out.length < count && DIMS.some((d) => pools[d].length)) {
      const open = DIMS.filter((d) => pools[d].length);
      const notLast = open.filter((d) => d !== last);
      const from = notLast.length ? notLast : open;
      let best = from[0];
      let bestScore = -1;
      for (const d of from) {
        const s = pools[d].length + rnd(); // prefer the trait with the most questions left
        if (s > bestScore) {
          best = d;
          bestScore = s;
        }
      }
      const q = pools[best].pop()!;
      out.push(pass ? { ...q, id: `${q.id}~${pass}` } : q);
      last = best;
    }
    pass++;
  }
  return out;
}

/** Converts to the store's QuestionItem. Legacy type points are 0 so old scoring adds nothing. */
export function toQuestionItems(list: BankQuestion[]): QuestionItem[] {
  return list.map((q) => ({
    question: q.q,
    primaryType: 1,
    secondaryType: 2,
    trait: "",
    winnerPoints: 0,
    secondaryPoints: 0,
    nomineePoints: 0,
    id: q.id,
    dim: q.dim,
    pole: q.pole,
  }));
}

/** Plain-text question format (one per line) or JSON. Used by the host question editor. */
export function parseQuestionText(text: string): BankResult {
  const t = text.trim();
  if (t.startsWith("{") || t.startsWith("[")) {
    try {
      return validateBank(JSON.parse(t));
    } catch (e) {
      return { ok: false, error: `Invalid JSON: ${(e as Error).message}` };
    }
  }
  const out: unknown[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith("#")) continue;
    const m = line.match(/^\[(soc|warm|rel|calm|open)(-?)\]\s*(.+)$/i);
    if (!m)
      return {
        ok: false,
        error: `Line ${i + 1}: start with a trait tag: [soc] [warm] [rel] [calm] or [open]. Add - for a low-end question, e.g. [soc-].`,
      };
    out.push({
      id: `c${out.length + 1}`,
      dim: m[1].toLowerCase(),
      pole: m[2] === "-" ? -1 : 1,
      q: m[3],
    });
  }
  return validateBank({ questions: out });
}

export function bankToText(bank: BankQuestion[]): string {
  const head = [
    "# One question per line. Start each line with a trait tag in brackets:",
    "#   [soc] social energy   [warm] warmth / kindness   [rel] reliable / organized",
    "#   [calm] calm under stress   [open] curious / creative",
    "# Add a minus for a LOW-end question, e.g. [soc-] Who would leave the party unnoticed?",
    "# Aim for at least 8 questions per tag, including a few low-end ones.",
    "",
  ];
  return head.concat(bank.map((q) => `[${q.dim}${q.pole === -1 ? "-" : ""}] ${q.q}`)).join("\n");
}
