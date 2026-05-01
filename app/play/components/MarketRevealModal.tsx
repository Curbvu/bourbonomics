"use client";

/**
 * Market reveal — Hearthstone-style flip-in animation for Phase 3.
 *
 * Behaviour:
 *   - As soon as Phase 3 lands on the human and they haven't drawn yet,
 *     this component **auto-dispatches** `MARKET_DRAW`. There is no
 *     "Draw 2 market cards" button — the cards just appear.
 *   - Once the engine has populated `state.marketPhase[humanId]` with the
 *     two drawn card ids, the modal renders both side-by-side using the
 *     `market-reveal-card` keyframe (same vocabulary as the regular
 *     card-draw overlay, but the cards stay on screen rather than flying
 *     off — the player still has to choose one).
 *   - Clicking a card dispatches `MARKET_KEEP` for the chosen id; the
 *     other goes to the discard. The modal then dismisses on its own
 *     (the engine clears `marketPhase[humanId]`, which fails our render
 *     gate).
 *
 * The choice is forced — Esc does not dismiss. Refreshes are also
 * handled: on remount, `state.marketPhase[humanId]` is the source of
 * truth, so the modal re-appears for any in-progress draw.
 */

import { useEffect } from "react";

import { MARKET_CARDS_BY_ID } from "@/lib/catalogs/market.generated";
import type { MarketEffect } from "@/lib/catalogs/types";
import { useGameStore } from "@/lib/store/gameStore";

export default function MarketRevealModal() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);

  // Auto-draw — fires whenever the human's market-phase turn is up and
  // they haven't drawn yet. Two trigger points:
  //
  //   1) On every store update (subscribe) — covers the live in-game flow
  //      where bots auto-resolve and control eventually reaches the human.
  //   2) Once on mount (initial check) — covers refresh / save-load where
  //      the conditions are *already* met when this component first
  //      renders. A subscribe-only approach would miss this.
  //
  // The reducer's own guards make this idempotent — once drawnCardIds is
  // non-empty, both the subscribe handler and any subsequent re-trigger
  // short-circuit.
  useEffect(() => {
    const tryAutoDraw = (cur: ReturnType<typeof useGameStore.getState>) => {
      const s = cur.state;
      if (!s) return;
      const me = s.playerOrder.find((id) => s.players[id].kind === "human");
      if (!me) return;
      if (s.phase !== "market") return;
      if (s.currentPlayerId !== me) return;
      const player = s.players[me];
      if (!player || player.eliminated || player.marketResolved) return;
      if (s.marketPhase[me]?.drawnCardIds?.length) return;
      cur.dispatch({ t: "MARKET_DRAW", playerId: me });
    };
    // Initial check (covers refresh / save-load into market phase).
    tryAutoDraw(useGameStore.getState());
    // Future updates.
    return useGameStore.subscribe(tryAutoDraw);
  }, []);

  // Render gate — read directly from state so the modal also shows up
  // after a page refresh mid-draw.
  if (!state) return null;
  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  if (!humanId) return null;
  const me = state.players[humanId];
  if (me.eliminated || me.marketResolved) return null;
  if (state.phase !== "market") return null;
  const cardIds = state.marketPhase[humanId]?.drawnCardIds ?? [];
  if (cardIds.length === 0) return null;

  const choose = (cardId: string) => {
    dispatch({ t: "MARKET_KEEP", playerId: humanId, keptCardId: cardId });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pick one of two market cards"
      className="card-draw-stage fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      {/* Centered amber aura — same colour family as the card-draw overlay. */}
      <div
        className="card-draw-glow pointer-events-none absolute left-1/2 top-1/2 h-[520px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.35) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-w-[820px] flex-col items-center gap-6">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
            Phase 3 · Market draw
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            Keep one — the other goes to the discard
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {cardIds.map((cardId, idx) => (
            <MarketCardTile
              key={`${cardId}-${idx}`}
              cardId={cardId}
              delayMs={idx * 120}
              onChoose={() => choose(cardId)}
            />
          ))}
        </div>

        <div className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
          click a card to keep it
        </div>
      </div>
    </div>
  );
}

function MarketCardTile({
  cardId,
  delayMs,
  onChoose,
}: {
  cardId: string;
  delayMs: number;
  onChoose: () => void;
}) {
  const def = MARKET_CARDS_BY_ID[cardId];
  return (
    <button
      type="button"
      onClick={onChoose}
      className="market-reveal-card group flex h-[320px] w-[280px] cursor-pointer flex-col rounded-xl border-2 border-amber-700 bg-gradient-to-b from-amber-700/40 via-amber-900/40 to-slate-950 p-5 text-left shadow-[0_8px_24px_rgba(0,0,0,0.45)] transition-all hover:border-amber-400 hover:shadow-[0_0_0_3px_rgba(251,191,36,0.35),0_8px_24px_rgba(0,0,0,0.45)]"
      style={{ animationDelay: `${delayMs}ms` }}
      aria-label={`Keep ${def?.title ?? cardId}`}
    >
      <header className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">
          Market card
        </span>
        <EffectBadge effect={def?.resolved ?? { kind: "flavor" }} />
      </header>

      <h3 className="mt-3 font-display text-2xl font-semibold leading-tight text-amber-100">
        {def?.title ?? cardId}
      </h3>

      <p className="mt-3 font-mono text-[12px] leading-snug text-amber-100/85">
        {def?.effect ?? ""}
      </p>

      <div className="mt-auto pt-4">
        <span className="inline-flex items-center gap-2 rounded-md border border-amber-500 bg-gradient-to-b from-amber-500 to-amber-700 px-4 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors group-hover:from-amber-400 group-hover:to-amber-600">
          Keep this card ↵
        </span>
      </div>
    </button>
  );
}

/**
 * Small chip surfacing the typed effect kind so the player can see at a
 * glance whether they're getting a demand bump, a shortage, etc.
 */
function EffectBadge({ effect }: { effect: MarketEffect }) {
  const label =
    effect.kind === "demand_delta"
      ? `Demand ${effect.delta >= 0 ? "+" : ""}${effect.delta}`
      : effect.kind === "demand_delta_conditional"
        ? `Demand ${effect.deltaAbove >= 0 ? "+" : ""}${effect.deltaAbove}/${effect.deltaBelow >= 0 ? "+" : ""}${effect.deltaBelow}`
        : effect.kind === "resource_shortage"
          ? `Lock ${effect.resource}`
          : "Flavor";
  const tone =
    effect.kind === "resource_shortage"
      ? "border-rose-500/60 bg-rose-500/[0.15] text-rose-200"
      : effect.kind === "flavor"
        ? "border-slate-500/60 bg-slate-500/[0.15] text-slate-200"
        : "border-amber-500/60 bg-amber-500/[0.15] text-amber-200";
  return (
    <span
      className={`rounded border px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[.08em] ${tone}`}
    >
      {label}
    </span>
  );
}
