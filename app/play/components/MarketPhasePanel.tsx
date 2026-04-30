"use client";

import { MARKET_CARDS_BY_ID } from "@/lib/catalogs/market.generated";
import { useGameStore } from "@/lib/store/gameStore";

export default function MarketPhasePanel() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);

  const humanId = state.playerOrder.find((id) => state.players[id].kind === "human");
  if (!humanId) return null;
  const me = state.players[humanId];
  if (me.marketResolved || me.eliminated) return null;
  if (state.currentPlayerId !== humanId) return null;

  const stash = state.marketPhase[humanId];
  const drawn = stash?.drawnCardIds ?? [];
  const hasDrawn = drawn.length > 0;
  const deckSize = state.market.marketDeck.length + state.market.marketDiscard.length;

  return (
    <section className="rounded-md border border-cyan-800 bg-cyan-950/30 p-4">
      <h2 className="mb-2 text-lg font-semibold text-cyan-200">
        Phase 3 · Market
      </h2>
      {!hasDrawn ? (
        <>
          <p className="mb-3 text-sm text-cyan-100">
            Draw 2 market cards. You&apos;ll keep one and discard the other.
            Most cards in the deck raise demand. Cards remaining: {deckSize}.
          </p>
          <button
            type="button"
            onClick={() => dispatch({ t: "MARKET_DRAW", playerId: humanId })}
            className="rounded-md bg-cyan-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
          >
            Draw 2 market cards
          </button>
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-cyan-100">
            Choose one to resolve. The other goes to the discard.
          </p>
          <div className="grid gap-2 md:grid-cols-2">
            {drawn.map((cardId) => {
              const def = MARKET_CARDS_BY_ID[cardId];
              if (!def) {
                return (
                  <button
                    key={cardId}
                    type="button"
                    onClick={() =>
                      dispatch({
                        t: "MARKET_KEEP",
                        playerId: humanId,
                        keptCardId: cardId,
                      })
                    }
                    className="rounded-md border border-slate-700 bg-slate-900/40 p-3 text-left text-sm text-slate-200 hover:bg-slate-800/60"
                  >
                    Unknown card ({cardId})
                  </button>
                );
              }
              return (
                <button
                  key={cardId}
                  type="button"
                  onClick={() =>
                    dispatch({
                      t: "MARKET_KEEP",
                      playerId: humanId,
                      keptCardId: cardId,
                    })
                  }
                  className="rounded-md border border-cyan-700 bg-cyan-900/30 p-3 text-left hover:bg-cyan-800/40"
                >
                  <div className="text-sm font-semibold text-cyan-100">
                    {def.title}
                  </div>
                  <div className="mt-1 text-xs text-cyan-200/80">
                    {def.effect}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
