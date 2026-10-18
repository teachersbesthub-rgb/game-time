# Cinematic Show Engine — Architecture Refactor + Live Show Upgrade

Goal: turn the existing app into a true AI-powered live game show without deleting anything that works. Everything ships behind a new central engine so future AI + animation features drop in cleanly.

## Guiding rules
- **Nothing removed.** Existing exports, imports, ownership center, docs, scoring, chemistry, keyboard shortcuts, presentation screens all keep working.
- **Single source of truth.** One store, one flow, one clock. Host and Screen B always mirror.
- **Screen B is always in motion.** No static frame anywhere.
- **AI = storyteller, never report writer.** Evidence in, story out.
- **Host never types names during the live show.** All names are pre-loaded participants.

---

## 1. Centralized Show Engine (architecture)

New module: `src/lib/show-engine.ts` — a thin orchestrator layered on top of the existing `event-store.ts` (which stays). It exposes a single `useShow()` hook plus typed action creators. Internally it composes:

- `participants` (pre-registered before show)
- `roomContext` + `audienceType`
- `chapter` (auto-derived from progress)
- `currentQuestion` / `nominees` / `winner`
- `livingProfiles` (AI evidence per participant)
- `observations[]` (AI beats generated live)
- `reveal` state machine: `idle → suspense → countdown → reveal → celebrate → rest`
- `presentation` state: `screen`, `cinemaMode`, `activeOverlay`
- `atmosphere`: `bgIntensity`, `particleDensity`, `paletteMood`, `soundBed`

`event-store.ts` becomes the persistence + sync layer (BroadcastChannel + localStorage stay). The Show Engine wraps it and adds the new fields — additive only.

New files:
- `src/lib/show-engine.ts` — orchestrator + selectors + action creators
- `src/lib/reveal-machine.ts` — tiny FSM for suspense/countdown/reveal/celebrate
- `src/lib/atmosphere.ts` — palette + motion + sound presets per chapter/screen
- `src/lib/story-engine.ts` — converts evidence → discoveries/surprises/jokes/truth bombs
- `src/lib/personality-engine.ts` — living profile builder (evidence accumulator, confidence, group perception)

Extended (no removals):
- `src/lib/event-store.ts` — add `participants[]`, `audienceType`, `preparedAt`, `observations[]`, `livingProfiles`, `reveal`, `atmosphere`. Keep every existing action/field.
- `src/lib/ai-brain.ts` — keep chapters/archetype/compliments/truth bombs/compare/finale. Story Engine calls into it.

---

## 2. Host Panel upgrade

Pre-event setup (new top section, existing controls stay under Advanced):
- **Participants roster** — add/remove people once; saved before show starts
- **Room description** + **Audience type** inputs
- **Prepare with AI** button — generates the question package tuned to the room and warms the personality engine
- **Start Show** — only enabled once prepped

During show:
- **Nominee picker** — three dropdowns/chips pulled from the saved participants (no typing)
- **Winner picker** — chips of the three nominees
- **Show control bar** — Start · Next · Reveal Nominees · Reveal Winner · Play Insight · Chapter · Compare · Finale
- Existing manual overrides + Ownership Center + exports/imports stay in place under a collapsible "Advanced".

---

## 3. Presentation Screen — cinematic live show

Global always-on layer (already partly there — extended):
- Animated gradient bed that shifts by chapter mood
- Particle field with density tied to atmosphere state
- Moving light sweeps + breathing vignette
- Cinematic typography scale (display/serif for reveals)
- Framer-motion page transitions between every screen
- `prefers-reduced-motion` respected

Show flow screens (all auto-driven by the reveal FSM):

```
Opening
 → Chapter 1  First Impressions
 → Chapter 2  Discovering Patterns
 → Chapter 3  Social Dynamics
 → Chapter 4  Hidden Strengths
 → Chapter 5  Personality Reveal
 → Chapter 6  Group Chemistry
 → Chapter 7  Finale
```

Each round now runs as: `suspense → question reveal → nominees reveal → drumroll countdown → winner reveal → celebration → AI observation beat → rest → next`. Existing question/nominee/winner screens are kept and wrapped in the new FSM.

Cinema-mode reveals for: Type Reveal, Most Trusted, Truth Bomb, Group Archetype, Finale.

---

## 4. AI Personality Engine

`src/lib/personality-engine.ts` — pure TS accumulator, no AI needed to run, AI used only for voice.

Per participant, a `LivingProfile`:
- `evidence[]` — every answer/nomination/win tagged with (question, traits, weight)
- `traitVector` — rolling Leadership/Trust/Support/Influence/Steadiness/Creativity/Connector/Hidden
- `typeSpectrum` — 9-type distribution
- `topTypes` — primary + wing + third
- `confidence` — grows only when evidence agrees across chapters
- `groupPerception` — how others' picks describe them
- `timeline[]` — "Q4 early signal → Q11 pattern → Q18 clear → Q25 confirmed"

The engine only "speaks" once confidence crosses a threshold. Never fabricates.

---

## 5. Story Engine

`src/lib/story-engine.ts` turns engine state into:
- **Discoveries** — "Something kept happening tonight…"
- **Surprises** — self vs group gaps
- **Funny observations** — inside-joke lines about the room
- **Emotional moments** — most trusted, quiet hero, unexpected pair
- **Group insights** — archetype crystallization
- **Truth bombs** — surfaced at dramatic beats
- **Compliments** — one per participant, evidence-based
- **Finale** — the emotional close (kept from ai-brain)

Voice is post-processed by an optional Lovable AI Gateway call (`google/gemini-3.6-flash`, server route). Deterministic fallback baked in so the show never stalls.

---

## 6. Reveal & atmosphere state

`reveal-machine.ts` drives timing for every dramatic beat (host presses one button, machine plays the sequence). `atmosphere.ts` maps chapter + reveal state → palette, particle density, sound bed. Presentation reads atmosphere; the room visibly *breathes* between beats.

---

## 7. Verification

- `tsgo` typecheck, `bun run build`
- Host↔Presentation sync smoke via BroadcastChannel
- Full 5-question dry run with saved participants (no live typing)
- Import an old export bundle → confirm backward-compatible
- Reduced-motion path renders without particles/sweeps

---

## Technical section (files at a glance)

**New**
- `src/lib/show-engine.ts`
- `src/lib/reveal-machine.ts`
- `src/lib/atmosphere.ts`
- `src/lib/story-engine.ts`
- `src/lib/personality-engine.ts`

**Extended (additive)**
- `src/lib/event-store.ts` — participants, audienceType, observations, livingProfiles, reveal, atmosphere
- `src/lib/ai-brain.ts` — used by story-engine; no signature changes
- `src/routes/host.tsx` — Pre-event setup + participant-driven nominee/winner pickers + Show Control Bar; existing panels move under Advanced
- `src/routes/presentation.tsx` — chapter-driven flow, reveal FSM wiring, cinema mode, richer motion layer
- `src/routes/api/ai/generate-questions.ts` — reused; add `audienceType` to prompt

**Unchanged**
Ownership Center, exports/imports, docs, keyboard shortcuts, scoring/chemistry engines, question package format (new optional fields only).

---

## One check before I start

Do you want me to ship this in a **single pass** (all of the above at once), or in **two waves**:
- Wave A: architecture (Show Engine + Personality Engine + Story Engine + reveal FSM + atmosphere) and Host pre-event setup + participant-driven pickers.
- Wave B: cinematic screen rewrite (chapter flow, cinema-mode reveals, richer motion, AI observation beats streaming into the show).

Confirm one-pass or two-waves and I'll build it end-to-end without removing anything currently working.
