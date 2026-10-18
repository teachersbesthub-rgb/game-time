# Enneagram Event Platform

A live, game-show style Enneagram experience: a host panel drives a
full-screen audience presentation, participants get nominated round after
round, and the platform infers each person's Enneagram profile plus
group chemistry in real time.

**No backend required.** Two browser tabs (host + presentation) stay in
sync via `BroadcastChannel` + `localStorage`.

## Quick start
```sh
bun install
bun run dev
```
Open two tabs:
- `http://localhost:5173/host` — host controls
- `http://localhost:5173/presentation` — audience screen (project this)

## Features
- Question packages (import JSON, or use the built-in sample).
- Live nominee entry, winner selection, animated confetti.
- Animated Enneagram wheel with distribution counts.
- Per-type detail: strengths, blind spots, growth areas, assigned members.
- Group chemistry: leadership / support / creativity / harmony presence, strengths, opportunities, risks, name-rich narrative.
- Event summary: podium, distribution, fun facts.
- Full **Ownership Center**: export the entire project (source, components, engines, docs, or one giant zip) — the software is yours to run anywhere.
- Full **Event export/import**: JSON, CSV, Markdown, standalone `.js` report.
- Keyboard shortcuts, progress tracking, autosave.

## Documentation
- [`BUILD_GUIDE.md`](./BUILD_GUIDE.md) — build, run, extend.
- [`PROJECT_ARCHITECTURE.md`](./PROJECT_ARCHITECTURE.md) — module map & event flow.
- [`DATA_MODELS.md`](./DATA_MODELS.md) — every type & scoring rule.
- [`INSTALLATION.md`](./INSTALLATION.md) — local, StackBlitz, GitHub deploy.
- [`AGENT_SPEC.md`](./AGENT_SPEC.md) — how a future LLM agent should generate importable question packages.
- [`CHANGELOG.md`](./CHANGELOG.md) — release notes.

## Portability
This project is 100% portable. It runs anywhere Vite + Node run:
GitHub, VS Code, StackBlitz, or your laptop. Nothing here depends on
Lovable to keep working.

## License
MIT — do whatever you want with it.
