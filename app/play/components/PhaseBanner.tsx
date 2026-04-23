"use client";

import { useGameStore } from "@/lib/store/gameStore";

const PHASE_LABEL: Record<string, string> = {
  opening: "Opening · keep 3 of 6",
  fees: "Phase 1 · Rickhouse fees",
  action: "Phase 2 · Action",
  market: "Phase 3 · Market",
  gameover: "Game over",
};

export default function PhaseBanner() {
  const state = useGameStore((s) => s.state)!;
  const current = state.players[state.currentPlayerId];
  const isBotTurn = current?.kind === "bot";

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-lg border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Year {state.round}
        </span>
        <span className="text-lg font-semibold">{PHASE_LABEL[state.phase]}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Market demand
        </span>
        <span className="text-lg font-semibold text-amber-400">{state.demand}</span>
      </div>
      <div className="flex flex-col">
        <span className="text-xs uppercase tracking-wide text-slate-500">
          Turn
        </span>
        <span className="text-lg font-semibold">
          {current?.name ?? "—"}
          {isBotTurn ? <span className="ml-2 text-xs text-slate-400">(bot)</span> : null}
        </span>
      </div>
      {state.phase === "action" ? (
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-slate-500">
            Next action cost
          </span>
          <span className="text-lg font-semibold text-cyan-300">
            ${state.actionPhase.freeWindowActive ? 0 : state.actionPhase.paidLapTier}
          </span>
        </div>
      ) : null}
    </div>
  );
}
