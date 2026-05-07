"use client";

/**
 * SellOverlay — sticky status bar for interactive Sell mode.
 *
 * Mirrors AgeOverlay: a thin gold band that prompts the player through
 * the two picks (barrel + spend card) and lets them cancel. The picks
 * themselves happen via clicks on the Rickhouse / HandTray; the store
 * auto-fires SELL_BOURBON the moment both are set, so there's no
 * Confirm button.
 *
 * The grid reward is recomputed live from the picked barrel so the
 * player sees the rep they'd earn before the sell lands.
 */

import { computeReward } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function SellOverlay() {
  const { state, sellMode, cancelSellMode } = useGameStore();
  if (!state || !sellMode) return null;
  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const barrel = sellMode.pickedBarrelId
    ? state.allBarrels.find((b) => b.id === sellMode.pickedBarrelId)
    : null;
  const card = sellMode.pickedSpendCardId
    ? human.hand.find((c) => c.id === sellMode.pickedSpendCardId)
    : null;

  const reward =
    barrel && barrel.attachedMashBill
      ? computeReward(barrel.attachedMashBill, barrel.age, state.demand, {
          demandBandOffset: barrel.demandBandOffset,
          gridRepOffset: barrel.gridRepOffset,
        })
      : 0;

  let prompt: string;
  if (!barrel && !card) {
    prompt = "Pick a 2yo+ barrel in your Rickhouse and a card in hand. Auto-sells on second pick.";
  } else if (!barrel) {
    prompt = "Now pick a 2yo+ barrel in your Rickhouse — it'll sell instantly.";
  } else if (!card) {
    prompt = "Now pick a card in your hand — selling costs 1 card.";
  } else {
    prompt = "Selling…";
  }

  return (
    <div className="border-t border-amber-700/60 bg-gradient-to-b from-amber-950/50 to-slate-950 px-[18px] py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-100">
          Selling
        </span>
        <span className="font-display text-[13px] font-semibold text-amber-100">
          {barrel
            ? `${barrel.attachedMashBill?.name ?? "barrel"} · age ${barrel.age} · ${reward} rep`
            : "no barrel picked"}
        </span>
        {card ? (
          <span className="font-mono text-[11px] uppercase tracking-[.10em] text-slate-300">
            paying with{" "}
            <span className="font-bold text-emerald-300">{cardLabel(card)}</span>
          </span>
        ) : null}
        <span className="font-mono text-[10px] italic text-slate-400">{prompt}</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={cancelSellMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function cardLabel(card: {
  type: string;
  subtype?: string;
  capitalValue?: number;
  resourceCount?: number;
  displayName?: string;
}): string {
  if (card.displayName) return card.displayName;
  if (card.type === "capital") return `Capital $${card.capitalValue ?? 1}`;
  const sub = card.subtype ?? "";
  const subCap = sub ? sub[0]!.toUpperCase() + sub.slice(1) : "Resource";
  const count = card.resourceCount && card.resourceCount > 1 ? `${card.resourceCount}× ` : "";
  return `${count}${subCap}`;
}
