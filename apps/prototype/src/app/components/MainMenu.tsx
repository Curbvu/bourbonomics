"use client";

/**
 * P2 landing menu — the tile stack at the apex root.
 *
 * The P2 prototype holds its game state in React (no localStorage save),
 * so there is no "Resume" tile. Three destinations: Play (the game, on
 * /play), the Wiki (P2's mash-bill / slot-card / marketing catalog), and
 * the Rules (the canonical GAME_RULES_P2 rulebook). Self-contained — no
 * store dependency, which only wakes under /play anyway.
 */

import Link from "next/link";

type Accent = "gold" | "sky" | "slate";

const ACCENTS: Record<
  Accent,
  { border: string; eyebrow: string; arrow: string; hoverBg: string }
> = {
  gold: {
    border: "border-[var(--gold)]/70",
    eyebrow: "text-[var(--gold)]",
    arrow: "text-[var(--gold)]",
    hoverBg: "hover:bg-[var(--gold)]/10",
  },
  sky: {
    border: "border-[var(--sky)]/60",
    eyebrow: "text-[var(--sky)]",
    arrow: "text-[var(--sky)]",
    hoverBg: "hover:bg-[var(--sky)]/10",
  },
  slate: {
    border: "border-[var(--rule)]",
    eyebrow: "text-[var(--mute)]",
    arrow: "text-[var(--mute)]",
    hoverBg: "hover:bg-[var(--panel)]/60",
  },
};

export default function MainMenu() {
  return (
    <nav className="flex flex-col gap-3">
      <MenuTile
        href="/play"
        eyebrow="Play"
        title="Rest a barrel"
        subtitle="Draw resources, build & age bourbon, sell into your brand lines. Single-player hot-seat."
        accent="gold"
      />
      <MenuTile
        href="/wiki"
        eyebrow="Bourbon Wiki"
        title="Browse the catalog"
        subtitle="Mash bills, brand-line slot cards, and marketing — recipes, reward grids, traits."
        accent="sky"
      />
      <MenuTile
        href="/rules"
        eyebrow="Rules"
        title="Read the rulebook"
        subtitle="The round loop, the make/age/sell pipeline, the staircase, and scoring."
        accent="slate"
      />
    </nav>
  );
}

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
        "group flex items-center justify-between gap-4 rounded-lg border-2 bg-[var(--panel)]/40 px-6 py-5 transition-colors",
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
        <h2 className="mt-1 font-display text-2xl font-bold text-[var(--ink)]">
          {title}
        </h2>
        <p className="mt-1 text-sm text-[var(--ink-muted)]">{subtitle}</p>
      </div>
      <span
        className={`flex-shrink-0 font-display text-3xl transition-transform group-hover:translate-x-1 ${a.arrow}`}
      >
        →
      </span>
    </Link>
  );
}
