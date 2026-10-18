// Server route: POST /api/ai/generate-questions
// Body: { roomContext: string; count?: number; participants?: string[] }
// Returns: { ok: true, questions: QuestionItem[] } | { ok: false, error: string }
import { createFileRoute } from "@tanstack/react-router";
import { validateQuestions, type QuestionItem } from "@/lib/enneagram";

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3.6-flash";

const SYSTEM = `You are a game-show writer generating "Who would…?" nomination questions for a live Enneagram personality show.
Rules:
- Every question is a single sentence starting with "Who".
- Each question maps to a primary Enneagram type (1-9) and a distinct secondary type (1-9).
- Coverage: across the set, every type 1..9 must appear at least once as primary.
- Voice: playful, human, specific to the room. NEVER clinical.
- No duplicates. No meta commentary.
Enneagram anchors (use for mapping, do not quote):
1 Reformer/principled, 2 Helper/warm, 3 Achiever/driver, 4 Individualist/expressive,
5 Investigator/analyst, 6 Loyalist/reliable, 7 Enthusiast/spark, 8 Challenger/decisive, 9 Peacemaker/steady.`;

function buildPrompt(roomContext: string, count: number, participants: string[]) {
  const who = roomContext.trim() || "a mixed group of friends and colleagues";
  const roster = participants.length ? `\nParticipants in the room: ${participants.join(", ")}.` : "";
  return `Write ${count} questions for this room: ${who}.${roster}
Tune the situations to that room (their environment, jobs, humor, dynamics).
Return ONLY a JSON object of the form:
{ "questions": [ { "question": "...", "primaryType": 1-9, "secondaryType": 1-9, "trait": "one-word", "winnerPoints": 3, "secondaryPoints": 2, "nomineePoints": 1 } ] }`;
}

export const Route = createFileRoute("/api/ai/generate-questions")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = process.env.LOVABLE_API_KEY;
        if (!key) return Response.json({ ok: false, error: "Missing LOVABLE_API_KEY" }, { status: 500 });
        let body: { roomContext?: string; count?: number; participants?: string[] } = {};
        try { body = await request.json(); } catch { /* noop */ }
        const roomContext = String(body.roomContext ?? "").slice(0, 500);
        const count = Math.max(5, Math.min(25, Number(body.count) || 12));
        const participants = Array.isArray(body.participants)
          ? body.participants.filter((s): s is string => typeof s === "string").slice(0, 40)
          : [];

        try {
          const upstream = await fetch(GATEWAY, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": key,
              "X-Lovable-AIG-SDK": "fetch",
            },
            body: JSON.stringify({
              model: MODEL,
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: SYSTEM },
                { role: "user", content: buildPrompt(roomContext, count, participants) },
              ],
            }),
          });
          if (!upstream.ok) {
            const t = await upstream.text();
            return Response.json({ ok: false, error: `Gateway ${upstream.status}: ${t.slice(0, 400)}` }, { status: 502 });
          }
          const json = await upstream.json() as { choices?: Array<{ message?: { content?: string } }> };
          const raw = json.choices?.[0]?.message?.content ?? "";
          let parsed: unknown;
          try { parsed = JSON.parse(raw); } catch {
            return Response.json({ ok: false, error: "AI did not return valid JSON." }, { status: 502 });
          }
          const arr = (parsed as { questions?: unknown })?.questions ?? parsed;
          const validated = validateQuestions(arr);
          if (!validated.ok || !validated.data) {
            return Response.json({ ok: false, error: validated.error ?? "Invalid question shape." }, { status: 502 });
          }
          const questions: QuestionItem[] = validated.data.map((q) => ({
            ...q,
            winnerPoints: q.winnerPoints || 3,
            secondaryPoints: q.secondaryPoints || 2,
            nomineePoints: q.nomineePoints || 1,
          }));
          return Response.json({ ok: true, questions });
        } catch (e) {
          return Response.json({ ok: false, error: (e as Error).message }, { status: 500 });
        }
      },
    },
  },
});
