"use client";

/**
 * P2 landing menu — styled like the original (P1) main menu: a dark-slate
 * tile stack with eyebrow / title / subtitle rows and an accent per tile.
 * The P2 prototype keeps its game state in React (no localStorage save),
 * so there is no "Resume" tile, and tutorial/multiplayer don't exist yet.
 * The primary "New game" tile launches the new P2 game on /play.
 */

import Link from "next/link";

export default function MainMenu() {
  return (
    <nav className="flex flex-col gap-3">
      <MenuTile
        href="/play"
        eyebrow="New game"
        title="Start a fresh barrel"
        subtitle="2–6 players (AI fills the rivals). Draft grain, age bourbon, and sell into a shifting demand market."
        accent="amber"
      />

      <MenuTile
        href="/play?tutorial=1"
        eyebrow="Tutorial"
        title="Learn to play"
        subtitle="A guided, spotlighted walk through one full round — draft, build, age, and sell your first bourbon."
        accent="emerald"
      />

      <MenuTile
        href="/mapgame"
        eyebrow="Map Game · v0"
        title="Play the territorial prototype"
        subtitle="A separate game: build Distribution Points across a hex map of taste-space, distill bourbons, and Push rivals off contested shelves. Pre-balance playtest."
        accent="rose"
      />

      <MenuTile
        href="/wiki"
        eyebrow="Bourbon Wiki"
        title="Browse every catalog"
        subtitle="Mash bills, demand orders, and distilleries — recipes, payouts, ultimates."
        accent="sky"
      />

      <MenuTile
        href="#rules"
        eyebrow="Rules"
        title="Read the rulebook"
        subtitle="The three-phase round, the dice draft, the demand meter, and scoring — in full, below."
        accent="slate"
      />
    </nav>
  );
}

type Accent = "emerald" | "amber" | "sky" | "slate" | "rose" | "violet";

const ACCENTS: Record<
  Accent,
  { border: string; eyebrow: string; arrow: string; hoverBg: string }
> = {
  emerald: {
    border: "border-emerald-500/70",
    eyebrow: "text-emerald-300",
    arrow: "text-emerald-300",
    hoverBg: "hover:bg-emerald-950/30",
  },
  violet: {
    border: "border-violet-500/70",
    eyebrow: "text-violet-300",
    arrow: "text-violet-300",
    hoverBg: "hover:bg-violet-950/30",
  },
  amber: {
    border: "border-amber-500/70",
    eyebrow: "text-amber-300",
    arrow: "text-amber-300",
    hoverBg: "hover:bg-amber-950/30",
  },
  sky: {
    border: "border-sky-500/60",
    eyebrow: "text-sky-300",
    arrow: "text-sky-300",
    hoverBg: "hover:bg-sky-950/30",
  },
  slate: {
    border: "border-slate-600",
    eyebrow: "text-slate-400",
    arrow: "text-slate-400",
    hoverBg: "hover:bg-slate-900/50",
  },
  rose: {
    border: "border-rose-500/70",
    eyebrow: "text-rose-300",
    arrow: "text-rose-300",
    hoverBg: "hover:bg-rose-950/30",
  },
};

function MenuTile({
  href,
  eyebrow,
  title,
  subtitle,
  accent,
}: {
  href: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  accent: Accent;
}) {
  const a = ACCENTS[accent];
  return (
    <Link
      href={href}
      className={[
        "group flex items-center justify-between gap-4 rounded-lg border-2 bg-slate-900/40 px-6 py-5 transition-colors",
        a.border,
        a.hoverBg,
      ].join(" ")}
    >
      <div className="min-w-0">
        <span
          className={`font-mono text-[13px] font-semibold uppercase tracking-[.18em] ${a.eyebrow}`}
        >
          {eyebrow}
        </span>
        <h2 className="mt-1 font-display text-2xl font-bold text-slate-100">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
      </div>
      <span
        className={`flex-shrink-0 font-display text-3xl transition-transform group-hover:translate-x-1 ${a.arrow}`}
      >
        →
      </span>
    </Link>
  );
}
