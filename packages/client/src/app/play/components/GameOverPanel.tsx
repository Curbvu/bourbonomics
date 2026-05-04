"use client";

import { useGameStore } from "@/lib/store/game";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";

export default function GameOverPanel() {
  const { state, scores, clear } = useGameStore();
  if (!state || !scores) return null;

  return (
    <section className="rounded-lg border border-amber-700 bg-amber-900/20 px-5 py-4">
      <div className="flex items-baseline justify-between">
        <div>
          <h2 className="font-display text-2xl font-semibold text-amber-100">
            Game over · final standings
          </h2>
          <p className="font-mono text-[11px] uppercase tracking-[.12em] text-amber-300/70">
            ended after round {state.round}
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          className="rounded border border-amber-500 bg-amber-500 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-950 hover:bg-amber-400"
        >
          New match ↵
        </button>
      </div>
      <ol className="mt-3 space-y-1.5">
        {scores.map((s) => {
          const player = state.players.find((p) => p.id === s.playerId);
          const idx = state.players.findIndex((p) => p.id === s.playerId);
          if (!player) return null;
          return (
            <li
              key={s.playerId}
              className="flex items-baseline gap-3 rounded border border-amber-700/40 bg-slate-950/50 px-3 py-2"
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold text-white ${PLAYER_BG_CLASS[paletteIndex(idx)]}`}
              >
                {s.rank}
              </span>
              <span className="w-32 font-display text-[16px] font-semibold text-slate-100">
                {player.name}
              </span>
              <span className="font-mono text-[14px] font-bold tabular-nums text-amber-300">
                {s.reputation}
                <span className="ml-1 text-[10px] font-medium text-amber-300/70">
                  rep
                </span>
              </span>
              <span className="flex-1" />
              <span className="font-mono text-[10px] uppercase tracking-[.10em] text-slate-500">
                {s.barrelsSold} sold · deck {s.deckSize}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
