"use client";

/**
 * Market tab — bourbon doomsday clock, market conveyor (6 face-up cards),
 * and supply / discard counts. Replaces v1's resource-pile + business-deck
 * stacks; v2 doesn't have separate resource piles since plain cards only
 * come from starter decks.
 */

import type { Card } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

const CONVEYOR_SIZE = 6;

export default function MarketPanel() {
  const { state } = useGameStore();
  if (!state) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Doomsday clock */}
      <section className="rounded border border-amber-700/40 bg-amber-950/20 p-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-display text-[15px] font-semibold text-amber-200">
              Bourbon deck
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-500">
              doomsday clock
            </div>
          </div>
          <span className="font-display text-[34px] font-bold leading-none tabular-nums text-amber-300">
            {state.bourbonDeck.length}
          </span>
        </div>
        {state.finalRoundTriggered && (
          <div className="mt-2 rounded border border-amber-500 bg-amber-700/[0.20] px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[.10em] text-amber-200">
            ⚠ final round triggered
          </div>
        )}
      </section>

      {/* Market conveyor */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
            Market conveyor
          </h3>
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            supply {state.marketSupplyDeck.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {state.marketConveyor.map((c) => (
            <ConveyorCard key={c.id} card={c} />
          ))}
          {Array.from({
            length: Math.max(0, CONVEYOR_SIZE - state.marketConveyor.length),
          }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="grid aspect-[3/4] place-items-center rounded border border-dashed border-slate-800 bg-slate-950/30 font-mono text-[9px] uppercase tracking-[.18em] text-slate-700"
            >
              empty
            </div>
          ))}
        </div>
      </section>

      {/* Demand label and value (echo) */}
      <section className="rounded border border-slate-800 bg-slate-900 px-3 py-2">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="font-display text-[14px] font-semibold text-slate-100">
              Demand
            </div>
            <div className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-500">
              market temperature · 0–12
            </div>
          </div>
          <span className="font-display text-[28px] font-bold leading-none tabular-nums text-amber-300">
            {state.demand}
          </span>
        </div>
      </section>
    </div>
  );
}

function ConveyorCard({ card }: { card: Card }) {
  const isCapital = card.type === "capital";
  const label = labelFor(card);
  return (
    <div
      title={`${label} · cost ${card.cost ?? 1}`}
      className={[
        "flex aspect-[3/4] flex-col items-center justify-between rounded border px-2 py-2 transition",
        isCapital
          ? "border-emerald-700/50 bg-emerald-950/40"
          : "border-amber-700/40 bg-amber-950/20",
      ].join(" ")}
    >
      <span className="font-mono text-[8px] uppercase tracking-[.18em] text-slate-500">
        {card.type}
      </span>
      <span className="font-display text-[14px] font-semibold leading-tight text-center text-amber-100">
        {label}
      </span>
      <span className="font-mono text-[10px] font-bold tabular-nums text-amber-300">
        {card.cost ?? 1}¢
      </span>
    </div>
  );
}

function labelFor(card: Card): string {
  if (card.type === "capital") {
    const v = card.capitalValue ?? 1;
    return v === 1 ? "Capital" : `${v}× cap`;
  }
  if (card.type === "resource") {
    const count = card.resourceCount ?? 1;
    return count > 1 ? `${count}× ${card.subtype}` : (card.subtype ?? "?");
  }
  return "?";
}
