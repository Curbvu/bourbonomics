"use client";

import { useGameStore } from "@/lib/store/gameStore";

export default function MarketPhasePanel() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);

  const humanId = state.playerOrder.find((id) => state.players[id].kind === "human");
  if (!humanId) return null;
  const me = state.players[humanId];
  if (me.marketResolved || me.eliminated) return null;
  if (state.currentPlayerId !== humanId) return null;

  const canDrawEvent = state.market.eventDeck.length > 0;

  return (
    <section className="rounded-md border border-cyan-800 bg-cyan-950/30 p-4">
      <h2 className="mb-2 text-lg font-semibold text-cyan-200">
        Phase 3 · Market
      </h2>
      <p className="mb-3 text-sm text-cyan-100">
        Roll 2 dice to shift demand, or draw an event card (event deck currently
        empty — defaults to a roll).
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() =>
            dispatch({ t: "ROLL_DEMAND", playerId: humanId })
          }
          className="rounded-md bg-cyan-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Roll for demand
        </button>
        <button
          type="button"
          disabled={!canDrawEvent}
          onClick={() => dispatch({ t: "DRAW_EVENT", playerId: humanId })}
          className="rounded-md border border-cyan-700 px-4 py-1.5 text-sm font-semibold text-cyan-200 hover:bg-cyan-900/40 disabled:opacity-40"
        >
          Draw event
        </button>
      </div>
    </section>
  );
}
