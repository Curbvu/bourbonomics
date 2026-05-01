"use client";

/**
 * Action bar — full-width slate panel between the main grid and HandTray.
 *
 * Styled to the design handoff's panel chrome (slate-900/70, slate-800
 * border, mono caption header, amber-on-hover ghost buttons). The Pass
 * action lives in HandTray's "End turn" button now, so it's intentionally
 * removed from this bar to avoid duplication.
 *
 * When it's not the human's turn, the bar collapses into a single mono
 * caption announcing whose turn it is.
 */

import { useState } from "react";

import type { Action, ResourcePileName } from "@/lib/engine/actions";
import { useGameStore } from "@/lib/store/gameStore";
import { pickMashFromHand } from "./mashHelpers";

const PILES: Array<{ id: ResourcePileName; label: string }> = [
  { id: "cask", label: "Cask" },
  { id: "corn", label: "Corn" },
  { id: "barley", label: "Barley" },
  { id: "rye", label: "Rye" },
  { id: "wheat", label: "Wheat" },
];

export default function ActionBar() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const [pileOpen, setPileOpen] = useState(false);

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  if (!humanId) return null;

  if (state.currentPlayerId !== humanId) {
    return (
      <section className="rounded-lg border border-slate-800 bg-slate-900/70 px-3.5 py-2.5">
        <span className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-500">
          Waiting on{" "}
          <span className="text-slate-300">
            {state.players[state.currentPlayerId]?.name ?? "opponent"}
          </span>
          …
        </span>
      </section>
    );
  }

  const me = state.players[humanId];
  const cost = state.actionPhase.freeWindowActive
    ? 0
    : state.actionPhase.paidLapTier;
  const canAfford = me.cash >= cost;

  const doDispatch = (action: Action) => {
    if (!canAfford && action.t !== "PASS_ACTION") return;
    setPileOpen(false);
    dispatch(action);
  };

  const ownedBarrels = state.rickhouses.flatMap((h) =>
    h.barrels.filter((b) => b.ownerId === humanId),
  );
  const sellable = ownedBarrels.find((b) => b.age >= 2);
  const bourbonCardIdForSale =
    state.market.bourbonFaceUp ?? me.bourbonHand[0];

  // Make-bourbon uses the first viable mash from hand.
  const mash = pickMashFromHand(me);
  const canMake =
    mash.length >= 3 &&
    state.rickhouses.some((h) => h.barrels.length < h.capacity);
  const firstOpenRickhouse = state.rickhouses.find(
    (h) => h.barrels.length < h.capacity,
  );

  const unbuilt = me.investments.find((i) => i.status === "unbuilt");

  return (
    <section className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/70 px-3.5 py-2.5">
      <span className="mr-auto font-mono text-[11px] uppercase tracking-[.18em] text-slate-400">
        Your turn ·{" "}
        <span className="text-amber-300">
          {cost === 0 ? "FREE" : `$${cost}`}
        </span>
      </span>

      {/* Draw resource — picker menu */}
      <div className="relative">
        <ActionButton
          onClick={() => setPileOpen((v) => !v)}
          disabled={!canAfford}
          aria-haspopup="menu"
          aria-expanded={pileOpen}
        >
          Draw resource ▾
        </ActionButton>
        {pileOpen ? (
          <div
            role="menu"
            aria-label="Resource pile"
            className="absolute left-0 top-full z-20 mt-1 flex flex-col gap-0.5 rounded-md border border-slate-700 bg-slate-950 p-1.5 shadow-lg"
          >
            {PILES.map((p) => (
              <button
                key={p.id}
                type="button"
                role="menuitem"
                onClick={() =>
                  doDispatch({
                    t: "DRAW_RESOURCE",
                    playerId: humanId,
                    pile: p.id,
                  })
                }
                className="flex items-center justify-between gap-3 rounded px-2.5 py-1 text-left font-mono text-[11px] hover:bg-slate-800 focus-visible:bg-slate-800 focus-visible:outline-none"
              >
                <span className="font-semibold text-slate-200">{p.label}</span>
                <span className="text-[10px] tabular-nums text-slate-500">
                  {state.market[p.id].length}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <ActionButton
        onClick={() =>
          doDispatch({
            t: "DRAW_BOURBON",
            playerId: humanId,
            source: state.market.bourbonFaceUp ? "face-up" : "deck",
          })
        }
        disabled={
          !canAfford ||
          (state.market.bourbonDeck.length === 0 &&
            !state.market.bourbonFaceUp)
        }
      >
        Draw bourbon
      </ActionButton>

      <ActionButton
        onClick={() =>
          canMake && firstOpenRickhouse
            ? doDispatch({
                t: "MAKE_BOURBON",
                playerId: humanId,
                rickhouseId: firstOpenRickhouse.id,
                resourceInstanceIds: mash,
              })
            : undefined
        }
        disabled={!canAfford || !canMake}
      >
        Make bourbon
      </ActionButton>

      <ActionButton
        onClick={() =>
          sellable && bourbonCardIdForSale
            ? doDispatch({
                t: "SELL_BOURBON",
                playerId: humanId,
                barrelId: sellable.barrelId,
                bourbonCardId: bourbonCardIdForSale,
              })
            : undefined
        }
        disabled={!canAfford || !sellable || !bourbonCardIdForSale}
      >
        Sell bourbon
      </ActionButton>

      <ActionButton
        onClick={() =>
          doDispatch({ t: "DRAW_INVESTMENT", playerId: humanId })
        }
        disabled={!canAfford || state.market.investmentDeck.length === 0}
      >
        Draw invest
      </ActionButton>

      <ActionButton
        onClick={() =>
          doDispatch({ t: "DRAW_OPERATIONS", playerId: humanId })
        }
        disabled={!canAfford || state.market.operationsDeck.length === 0}
      >
        Draw ops
      </ActionButton>

      <ActionButton
        onClick={() =>
          unbuilt
            ? doDispatch({
                t: "IMPLEMENT_INVESTMENT",
                playerId: humanId,
                investmentInstanceId: unbuilt.instanceId,
              })
            : undefined
        }
        disabled={!canAfford || !unbuilt}
      >
        Implement
      </ActionButton>
    </section>
  );
}

type ActionButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

function ActionButton({ children, ...props }: ActionButtonProps) {
  return (
    <button
      type="button"
      {...props}
      className="rounded border border-slate-700 bg-slate-900 px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-200 transition-colors hover:border-amber-500/60 hover:bg-amber-700/[0.20] hover:text-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/60 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-950 disabled:text-slate-600 disabled:hover:border-slate-800 disabled:hover:bg-slate-950 disabled:hover:text-slate-600"
    >
      {children}
    </button>
  );
}
