"use client";

/**
 * SellOverlay — sticky status bar for interactive Sell mode.
 *
 * v2.10: single-step picker. The player picks a barrel and the sale
 * resolves immediately (no card-spend cost). The overlay shows the
 * grid reward live as a barrel is picked.
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

  const reward =
    barrel && barrel.attachedMashBill
      ? computeReward(barrel.attachedMashBill, barrel.age, state.demand, {
          demandBandOffset: barrel.demandBandOffset,
          gridRepOffset: barrel.gridRepOffset,
        })
      : 0;

  const prompt = barrel
    ? "Selling…"
    : "Pick a sellable barrel in your Rickhouse — sale fires instantly.";

  return (
    <div className="border-t border-amber-700/60 bg-gradient-to-b from-amber-950/50 to-slate-950 px-[18px] py-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded border border-amber-500 bg-amber-700/30 px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[.14em] text-amber-100">
          Selling
        </span>
        <span className="font-display text-[13px] font-semibold text-amber-100">
          {barrel
            ? `${barrel.attachedMashBill?.name ?? "barrel"} · age ${barrel.age} · ${reward} rep`
            : "no barrel picked"}
        </span>
        <button
          type="button"
          onClick={cancelSellMode}
          className="rounded-md border border-rose-700/60 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
        >
          Cancel
        </button>
        <span className="font-mono text-[12px] italic text-slate-400">{prompt}</span>
      </div>
    </div>
  );
}
