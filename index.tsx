import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Enneagram Event Platform" },
      {
        name: "description",
        content:
          "A live, two-screen Enneagram game show experience — host from one screen, project to the crowd on another.",
      },
      { property: "og:title", content: "Enneagram Event Platform" },
      {
        property: "og:description",
        content:
          "Run live Enneagram game show events. Host controls one screen, the audience watches another.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[oklch(0.14_0.04_280)] text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-10 h-96 w-96 rounded-full bg-[oklch(0.7_0.22_320)] opacity-40 blur-3xl" />
        <div className="absolute right-0 top-40 h-[500px] w-[500px] rounded-full bg-[oklch(0.75_0.2_60)] opacity-30 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-[oklch(0.7_0.2_180)] opacity-30 blur-3xl" />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center gap-10 px-6 py-24 text-center">
        <span className="rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.3em]">
          Live Event Platform
        </span>
        <h1 className="text-5xl font-black leading-[0.95] tracking-tight md:text-7xl">
          The{" "}
          <span className="bg-gradient-to-r from-[oklch(0.8_0.2_60)] via-[oklch(0.72_0.24_350)] to-[oklch(0.7_0.22_260)] bg-clip-text text-transparent">
            Enneagram
          </span>{" "}
          Game Show
        </h1>
        <p className="max-w-2xl text-lg text-white/70 md:text-xl">
          One host. One audience screen. Nine personality types. Run a live, high-energy Enneagram
          experience for your group.
        </p>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row">
          <Link
            to="/host"
            className="rounded-2xl bg-white px-8 py-4 text-base font-bold text-[oklch(0.14_0.04_280)] shadow-2xl transition-transform hover:scale-105"
          >
            Open Host Panel →
          </Link>
          <Link
            to="/presentation"
            className="rounded-2xl border-2 border-white/40 bg-white/5 px-8 py-4 text-base font-bold backdrop-blur transition-transform hover:scale-105 hover:bg-white/10"
          >
            Open Presentation Screen
          </Link>
        </div>
        <p className="mt-8 max-w-xl text-sm text-white/50">
          Open the presentation screen on the projector or second display. Open the host panel on
          your laptop. The two screens stay in sync automatically.
        </p>
      </div>
    </div>
  );
}
