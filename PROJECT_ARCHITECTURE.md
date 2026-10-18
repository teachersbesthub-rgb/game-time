# Project Architecture

## Stack
- **Framework**: TanStack Start (React 19 + Vite 7)
- **Routing**: TanStack Router (file-based, `src/routes/`)
- **State**: Zustand (`src/lib/event-store.ts`)
- **Styling**: Tailwind CSS v4 (`src/styles.css`)
- **Animation**: `motion` (Framer Motion successor) + `canvas-confetti`
- **Bundling for export**: `jszip`

## Runtime Topology
```
 ┌──────────────┐        localStorage + BroadcastChannel        ┌──────────────────┐
 │  /host tab   │  ◄────────────────────────────────────────►  │ /presentation tab │
 └──────────────┘                                                └──────────────────┘
        │                                                                 │
        └──────── read/write shared store (`useEvent`) ───────────────────┘
```
There is no backend. All state lives in the browser; two tabs stay in
sync through `BroadcastChannel` with `localStorage` fallback.

## Module Map
- `src/router.tsx` — router bootstrap
- `src/routes/__root.tsx` — root layout (html shell, `<Outlet />`)
- `src/routes/index.tsx` — landing page
- `src/routes/host.tsx` — host control panel (question package, event control, nominees, winner, results control, ownership center, exports, imports, debug)
- `src/routes/presentation.tsx` — audience screen (welcome, question, nominees, winner, results wheel, type detail, chemistry, summary)
- `src/lib/enneagram.ts` — Enneagram type catalog, validators, sample package
- `src/lib/event-store.ts` — Zustand store, scoring, chemistry engine, fun facts, exports, import
- `src/lib/source-bundle.ts` — Ownership Center: zips the app source for full ownership

## Event Flow
1. Host loads a JSON question package (or the sample).
2. Host presses **Start Event** → welcome screen.
3. For each question:
   - **Show Question** displays the prompt.
   - Host types the three nominee names.
   - **Show Nominees** displays all three color-coded cards.
   - Host picks a winner color; **Show Winner** commits the scoring.
   - **Next Question** advances.
4. **Generate Results** shows the animated Enneagram wheel.
5. Host can drill into any type; **Show Chemistry** shows group chemistry; **Event Summary** wraps up with fun facts.
6. Host exports (event data + full source) from the Ownership Center.

## Persistence
- Store writes to `localStorage["enneagram-event-state-v1"]` on every commit.
- On boot, the store hydrates from `localStorage`.
- Cross-tab: `BroadcastChannel("enneagram-event-channel-v1")` mirrors state; `storage` events are the fallback.
- Import replays a full state snapshot from an exported JSON bundle.
