"use client";

/**
 * GameOverPanel — fullscreen final-standings modal shown when the
 * engine flips to `state.phase === "ended"`. Page-root mount so the
 * backdrop covers the entire viewport regardless of ScalingHost.
 *
 * Self-gates on `state.phase` + `scores`; renders nothing otherwise.
 */

import { useGameStore } from "@/lib/store/game";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";

export default function GameOverPanel() {
  const { state, scores, clear } = useGameStore();
  if (!state || !scores) return null;
  if (state.phase !== "ended") return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Game over — final standings"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur animate-bb-spot-fade"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.30) 0%, transparent 65%)",
        }}
      />

      <section className="relative w-full max-w-[640px] rounded-xl border-2 border-amber-700 bg-gradient-to-b from-amber-950/80 to-slate-950 px-7 py-6 shadow-[0_20px_60px_rgba(0,0,0,.6)]">
        <header className="flex items-baseline justify-between gap-4">
          <div>
            <div className="font-mono text-[13px] uppercase tracking-[.18em] text-amber-300">
              Match Complete
            </div>
            <h2 className="mt-1 font-display text-3xl font-semibold text-amber-100">
              Final Standings
            </h2>
            <p className="mt-1 font-mono text-[12px] uppercase tracking-[.14em] text-slate-400">
              ended after round {state.round}
            </p>
          </div>
          <button
            type="button"
            onClick={clear}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-sans text-sm font-bold uppercase tracking-[.05em] text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] transition-all hover:from-amber-200 hover:to-amber-400"
          >
            New match ↵
          </button>
        </header>

        <ol className="mt-5 space-y-2">
          {scores.map((s) => {
            const player = state.players.find((p) => p.id === s.playerId);
            const idx = state.players.findIndex((p) => p.id === s.playerId);
            if (!player) return null;
            const isWinner = s.rank === 1;
            return (
              <li
                key={s.playerId}
                className={`flex items-baseline gap-3 rounded-lg border px-3 py-2.5 ${
                  isWinner
                    ? "border-amber-400/80 bg-amber-700/15 shadow-[inset_0_1px_0_rgba(251,191,36,0.18)]"
                    : "border-amber-700/40 bg-slate-950/55"
                }`}
              >
                <span
                  className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold text-white ${PLAYER_BG_CLASS[paletteIndex(idx)]}`}
                >
                  {s.rank}
                </span>
                <span
                  className={`w-32 font-display text-[16px] font-semibold ${
                    isWinner ? "text-amber-100" : "text-slate-100"
                  }`}
                >
                  {player.name}
                </span>
                <span
                  className={`font-mono text-[16px] font-bold tabular-nums ${
                    isWinner ? "text-amber-200" : "text-amber-300"
                  }`}
                >
                  {s.reputation}
                  <span className="ml-1 text-[12px] font-medium text-amber-300/70">
                    rep
                  </span>
                </span>
                <span className="flex-1" />
                <span className="font-mono text-[12px] uppercase tracking-[.10em] text-slate-500">
                  {s.barrelsSold} sold · deck {s.deckSize}
                </span>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
