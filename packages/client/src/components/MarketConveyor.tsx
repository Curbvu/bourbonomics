"use client";

import type { Card } from "@bourbonomics/engine";

const SLOT_COUNT = 6;

export function MarketConveyor({
  cards,
  supplyCount,
}: {
  cards: Card[];
  supplyCount: number;
}) {
  const empties = Math.max(0, SLOT_COUNT - cards.length);
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50">
      <header className="px-4 py-2 border-b border-neutral-800 flex items-center justify-between">
        <div className="flex items-baseline gap-3">
          <h3 className="text-sm font-semibold tracking-wide">Market Conveyor</h3>
          <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            {SLOT_COUNT} face-up slots
          </span>
        </div>
        <span className="text-xs text-neutral-500">
          Supply deck: <span className="text-neutral-300 tabular-nums">{supplyCount}</span>
        </span>
      </header>
      <div className="p-4 flex gap-3 flex-wrap">
        {cards.map((c) => (
          <MarketCard key={c.id} card={c} />
        ))}
        {Array.from({ length: empties }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-24 h-32 rounded border border-dashed border-neutral-800 flex items-center justify-center text-[10px] uppercase tracking-wider text-neutral-700"
          >
            Empty
          </div>
        ))}
      </div>
    </section>
  );
}

function MarketCard({ card }: { card: Card }) {
  const label = cardLabel(card);
  const accentClass =
    card.type === "capital"
      ? "border-emerald-700/50 bg-emerald-950/40"
      : "border-amber-700/40 bg-amber-950/20";
  return (
    <div
      className={`w-24 h-32 rounded border ${accentClass} flex flex-col items-center justify-between py-3 px-2 transition`}
    >
      <span className="text-[9px] uppercase tracking-wider text-neutral-500">
        {card.type}
      </span>
      <span className="text-base font-semibold text-neutral-100 text-center leading-tight">
        {label}
      </span>
      <span className="text-xs text-amber-400 font-semibold">
        cost {card.cost ?? 1}
      </span>
    </div>
  );
}

function cardLabel(card: Card): string {
  if (card.type === "capital") {
    const v = card.capitalValue ?? 1;
    return v === 1 ? "Capital" : `${v}× Capital`;
  }
  if (card.type === "resource") {
    const count = card.resourceCount ?? 1;
    return count > 1 ? `${count}× ${card.subtype}` : (card.subtype ?? "?");
  }
  return "?";
}
