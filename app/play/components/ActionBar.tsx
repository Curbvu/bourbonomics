"use client";

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

  const humanId = state.playerOrder.find((id) => state.players[id].kind === "human");
  if (!humanId) return null;
  if (state.currentPlayerId !== humanId) {
    return (
      <section className="rounded-md border border-slate-800 bg-slate-900/60 px-3 py-4 text-center text-sm text-slate-400">
        Waiting on {state.players[state.currentPlayerId]?.name ?? "opponent"}…
      </section>
    );
  }
  const me = state.players[humanId];
  const cost = state.actionPhase.freeWindowActive ? 0 : state.actionPhase.paidLapTier;
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
    <section className="flex flex-wrap items-center gap-2 rounded-md border border-slate-800 bg-slate-900/60 p-3">
      <span className="mr-auto text-xs uppercase tracking-wide text-slate-400">
        Your turn · next action ${cost}
      </span>

      <div className="relative">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={pileOpen}
          onClick={() => setPileOpen((v) => !v)}
          disabled={!canAfford}
          className="rounded-md bg-amber-500 px-3 py-1.5 text-sm font-medium text-slate-950 transition hover:bg-amber-400 focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:outline-none disabled:bg-slate-800 disabled:text-slate-500"
        >
          Draw resource ▾
        </button>
        {pileOpen ? (
          <div
            role="menu"
            aria-label="Resource pile"
            className="absolute left-0 top-full z-20 mt-1 flex flex-col gap-1 rounded-md border border-slate-700 bg-slate-950 p-2 shadow-lg"
          >
            {PILES.map((p) => (
              <button
                type="button"
                role="menuitem"
                key={p.id}
                className="rounded px-3 py-1 text-left text-sm hover:bg-slate-800 focus-visible:bg-slate-800 focus-visible:outline-none"
                onClick={() =>
                  doDispatch({
                    t: "DRAW_RESOURCE",
                    playerId: humanId,
                    pile: p.id,
                  })
                }
              >
                {p.label}{" "}
                <span className="text-xs text-slate-500">
                  ({state.market[p.id].length} left)
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <Button
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
      </Button>

      <Button
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
      </Button>

      <Button
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
      </Button>

      <Button
        onClick={() =>
          doDispatch({ t: "DRAW_INVESTMENT", playerId: humanId })
        }
        disabled={!canAfford || state.market.investmentDeck.length === 0}
      >
        Draw investment
      </Button>

      <Button
        onClick={() =>
          doDispatch({ t: "DRAW_OPERATIONS", playerId: humanId })
        }
        disabled={!canAfford || state.market.operationsDeck.length === 0}
      >
        Draw operations
      </Button>

      <Button
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
        Implement investment
      </Button>

      <Button
        onClick={() => doDispatch({ t: "PASS_ACTION", playerId: humanId })}
        tone="danger"
      >
        Pass{cost > 0 ? ` (lap $${cost})` : ""}
      </Button>
    </section>
  );
}

function Button({
  children,
  onClick,
  disabled,
  tone,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  tone?: "primary" | "danger";
}) {
  const toneCls =
    tone === "primary"
      ? "bg-amber-500 text-slate-950 hover:bg-amber-400 focus-visible:ring-amber-300 disabled:bg-slate-800 disabled:text-slate-500"
      : tone === "danger"
        ? "bg-rose-600 text-white hover:bg-rose-500 focus-visible:ring-rose-300 disabled:bg-slate-800 disabled:text-slate-500"
        : "border border-slate-700 bg-slate-900 text-slate-100 hover:bg-slate-800 focus-visible:ring-slate-400 disabled:bg-slate-950 disabled:text-slate-600";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 ${toneCls}`}
    >
      {children}
    </button>
  );
}
