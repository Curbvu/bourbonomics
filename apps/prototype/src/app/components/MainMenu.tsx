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
        subtitle="Pick your seed, draw resources, rest and age bourbon, then sell into your brand lines."
        accent="amber"
      />

      <MenuTile
        href="/wiki"
        eyebrow="Bourbon Wiki"
        title="Browse every catalog"
        subtitle="Mash bills, brand-line slot cards, marketing — recipes, reward grids, traits."
        accent="sky"
      />

      <MenuTile
        href="/rules"
        eyebrow="Rules"
        title="Read the rulebook"
        subtitle="Round loop, make/age/sell pipeline, the staircase, scoring."
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
