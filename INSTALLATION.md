# Installation

## Local (VS Code / any editor)
```sh
git clone <your-repo-url>
cd enneagram-event-platform
bun install    # or: npm install / pnpm install
bun run dev
```
Open `http://localhost:5173/host` in one window and `/presentation` in another.

## StackBlitz
1. Push to GitHub.
2. Open `https://stackblitz.com/github/<user>/<repo>`.
3. StackBlitz auto-detects Vite and runs `bun install && bun run dev`.

## GitHub
Inside Lovable: **+ menu → GitHub → Connect project** to create the repo.
Outside Lovable: use the Ownership Center → **Export Full Project** to download a zip, then:
```sh
unzip enneagram-event-full.zip -d enneagram-event-platform
cd enneagram-event-platform
git init && git add . && git commit -m "Initial import"
git remote add origin git@github.com:<you>/<repo>.git
git push -u origin main
```

## Production Build
```sh
bun run build
bun run preview
```
Deploy the `.output/` directory (Cloudflare Workers/Pages, Vercel, Netlify, Node).

## Environment
No environment variables are required. There is no backend, no database, and no third-party API keys.
