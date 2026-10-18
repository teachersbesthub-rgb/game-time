# Enneagram Live Show - host guide

## Before the show (Host screen, /host)
1. Add the players' names (3 or more).
2. Set the number of questions (the screen recommends about 6 per player).
3. Check or edit the questions (optional). One per line, starting with a trait tag:
   [soc] [warm] [rel] [calm] [open]; add "-" (e.g. [soc-]) for a low-end question.
   Without edits it uses public/questions.json, then the built-in 60 questions.
4. Open the Presentation screen (/presentation) on the projector and click
   "Click once to enable sound" (browsers require one click for audio).
5. Press "Start the show" on the host screen.

## During the show
Three nominees appear on the big screen (A/B/C). Tap the winner on the host screen.
Tapping a different name while the winner screen shows corrects a mistake.
Everything else is automatic: nominee choice, reveals, sound, pop-ups, results,
personality readings one person at a time, group chemistry, awards, summary, finale.
Keep the Presentation window open: it runs the timers.

## Tuning
- Timing: src/lib/driver.ts (TIMING)
- Scoring constants: src/lib/ledger.ts (TUNING)
- Simulate accuracy: bun scripts/simulate.ts (WINNER_ONLY=1 for tap-the-winner data)
- Full-show logic test: bun scripts/smoke.ts

## Deploying
- Vercel: import the repo; no env vars or special settings needed (vite.config.ts picks the Vercel target automatically).
- Cloudflare / other: builds with the default target; set NITRO_PRESET if you need another.
- The host and presentation windows must be in the SAME browser on the SAME device (state syncs via the browser).
