"use client";

/**
 * Main menu — the landing page tile stack.
 *
 * Reads the saved-game blob straight out of localStorage so the
 * "Resume" tile only renders when there's an in-progress game waiting.
 * Self-contained — no dependency on the React store provider, which
 * only wakes up under `/play` anyway.
 *
 * Each menu item gets its own full-width row so nothing competes for
 * eye-line. Order: Resume (when applicable) → New Game → Bourbon
 * Cards → Rules.
 */

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "bourbonomics:v2.6.0-game";
const TUTORIAL_COMPLETE_KEY = "bourbonomics:tutorial-complete";

interface SavedGameMeta {
  round: number;
  phase: string;
  playerCount: number;
}

export default function MainMenu() {
  const [resume, setResume] = useState<SavedGameMeta | null>(null);
  const [tutorialDone, setTutorialDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          state?: { round?: number; phase?: string; players?: unknown[] };
        };
        const s = saved.state;
        if (s && s.phase !== "ended" && s.players) {
          setResume({
            round: s.round ?? 1,
            phase: s.phase ?? "draw",
            playerCount: s.players.length,
          });
        }
      }
      if (window.localStorage.getItem(TUTORIAL_COMPLETE_KEY) === "true") {
        setTutorialDone(true);
      }
    } catch {
      // Corrupt save — pretend it isn't there so the menu still renders.
    }
  }, []);

  return (
    <nav className="flex flex-col gap-3">
      {hydrated && resume ? (
        <MenuTile
          href="/play"
          eyebrow="Resume game"
          title="Pick up where you left off"
          subtitle={`Round ${resume.round} · ${resume.phase} phase · ${resume.playerCount} players`}
          accent="emerald"
        />
      ) : null}

      {hydrated ? (
        <MenuTile
          href="/tutorial"
          eyebrow={tutorialDone ? "Replay tutorial" : "Tutorial"}
          title={tutorialDone ? "Walk through it again" : "Learn the game in 8 minutes"}
          subtitle={
            tutorialDone
              ? "Same script — useful when teaching a friend."
              : "Build, age, sell — every beat scripted, every lesson lands."
          }
          accent={tutorialDone ? "slate" : "violet"}
        />
      ) : null}

      <MenuTile
        href="/new-game"
        eyebrow="New game"
        title="Start a fresh barrel"
        subtitle="Pick your seat, opponents, and seed. Bots play themselves."
        accent={tutorialDone ? "amber" : "sky"}
      />

      <MenuTile
        href="/multiplayer"
        eyebrow="Multiplayer"
        title="Play with friends online"
        subtitle="Mint a 4-char room code, share the link, race to the rep cap."
        accent="rose"
      />

      <MenuTile
        href="/mash-bills"
        eyebrow="Bourbon Cards"
        title="Browse every mash bill"
        subtitle="Recipes, payoff grids, awards, and rarity tiers."
        accent="sky"
      />

      <MenuTile
        href="/rules"
        eyebrow="Rules"
        title="Read the rulebook"
        subtitle="Round loop, recipes, scoring, ops cards."
        accent="slate"
      />
    </nav>
  );
}

type Accent = "emerald" | "amber" | "sky" | "slate" | "rose" | "violet";

const ACCENTS: Record<Accent, { border: string; eyebrow: string; arrow: string; hoverBg: string }> = {
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
          className={`font-mono text-[11px] font-semibold uppercase tracking-[.18em] ${a.eyebrow}`}
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
