"use client";

/**
 * Main menu — the top tile cluster on the landing page.
 *
 * Reads the saved-game blob straight out of localStorage so the
 * "Resume" tile only renders when there's an in-progress game waiting.
 * Keeps the component self-contained — no dependency on the React
 * store provider, which only wakes up under `/play` anyway.
 *
 * Tiles, in priority order:
 *   1. Resume Game (only when a non-ended save exists)
 *   2. New Game (anchors to the form below — kept on this page so
 *      players don't context-switch through a separate route)
 *   3. Bourbon Cards (read-only mash bill gallery)
 *   4. Rules
 */

import { useEffect, useState } from "react";
import Link from "next/link";

const STORAGE_KEY = "bourbonomics:v2.6.0-game";

interface SavedGameMeta {
  round: number;
  phase: string;
  playerCount: number;
}

export default function MainMenu({ formAnchorId }: { formAnchorId: string }) {
  const [resume, setResume] = useState<SavedGameMeta | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setHydrated(true);
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { state?: { round?: number; phase?: string; players?: unknown[] } };
      const s = saved.state;
      if (!s || s.phase === "ended" || !s.players) return;
      setResume({
        round: s.round ?? 1,
        phase: s.phase ?? "demand",
        playerCount: s.players.length,
      });
    } catch {
      // Corrupt save — pretend it isn't there so the menu still renders.
    }
  }, []);

  return (
    <nav className="mb-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {hydrated && resume ? (
        <Link
          href="/play"
          className="group relative col-span-1 flex flex-col justify-between overflow-hidden rounded-lg border-2 border-emerald-500/70 bg-[linear-gradient(160deg,rgba(6,78,59,.65)_0%,rgba(15,23,42,.95)_75%)] p-5 shadow-[0_8px_24px_rgba(0,0,0,.4)] transition-transform hover:-translate-y-0.5 sm:col-span-2"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-emerald-300">
                Resume game
              </span>
              <h2 className="mt-1 font-display text-2xl font-bold text-emerald-100">
                Pick up where you left off
              </h2>
              <p className="mt-1.5 font-mono text-xs uppercase tracking-[.12em] text-emerald-200/80">
                Round {resume.round} · {resume.phase} phase · {resume.playerCount} players
              </p>
            </div>
            <span className="font-display text-3xl text-emerald-300 transition-transform group-hover:translate-x-1">
              →
            </span>
          </div>
        </Link>
      ) : null}

      <a
        href={`#${formAnchorId}`}
        className="group flex flex-col justify-between overflow-hidden rounded-lg border-2 border-amber-500/70 bg-[linear-gradient(160deg,rgba(120,53,15,.55)_0%,rgba(15,23,42,.95)_75%)] p-5 shadow-[0_8px_24px_rgba(0,0,0,.4)] transition-transform hover:-translate-y-0.5"
      >
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-amber-300">
          New game
        </span>
        <h2 className="mt-1 font-display text-2xl font-bold text-amber-100">
          Start a fresh barrel
        </h2>
        <p className="mt-1.5 text-sm text-amber-200/80">
          Pick your seat, opponents, and seed. Bots play themselves.
        </p>
      </a>

      <Link
        href="/mash-bills"
        className="group flex flex-col justify-between overflow-hidden rounded-lg border-2 border-sky-500/60 bg-[linear-gradient(160deg,rgba(12,74,110,.55)_0%,rgba(15,23,42,.95)_75%)] p-5 shadow-[0_8px_24px_rgba(0,0,0,.4)] transition-transform hover:-translate-y-0.5"
      >
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-sky-300">
          Bourbon Cards
        </span>
        <h2 className="mt-1 font-display text-2xl font-bold text-sky-100">
          Browse every mash bill
        </h2>
        <p className="mt-1.5 text-sm text-sky-200/80">
          Recipes, payoff grids, awards, and tier breakdowns.
        </p>
      </Link>

      <Link
        href="/rules"
        className="group flex flex-col justify-between overflow-hidden rounded-lg border-2 border-slate-600 bg-[linear-gradient(160deg,rgba(51,65,85,.55)_0%,rgba(15,23,42,.95)_75%)] p-5 shadow-[0_8px_24px_rgba(0,0,0,.4)] transition-transform hover:-translate-y-0.5 sm:col-span-2"
      >
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Rules
        </span>
        <h2 className="mt-1 font-display text-xl font-bold text-slate-100">
          Read the rulebook
        </h2>
      </Link>
    </nav>
  );
}
