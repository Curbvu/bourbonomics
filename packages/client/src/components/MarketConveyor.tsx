import type { Card } from "@bourbonomics/engine";

export function MarketConveyor({
  cards,
  supplyCount,
}: {
  cards: Card[];
  supplyCount: number;
}) {
  return (
    <div>
      <div className="flex gap-2 flex-wrap mb-3">
        {cards.map((c) => (
          <MarketCard key={c.id} card={c} />
        ))}
        {Array.from({ length: 6 - cards.length }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="w-20 h-24 rounded border border-dashed border-neutral-800"
          />
        ))}
      </div>
      <div className="text-xs text-neutral-500">
        Supply deck: {supplyCount}
      </div>
    </div>
  );
}

function MarketCard({ card }: { card: Card }) {
  const label = cardLabel(card);
  return (
    <div className="w-20 h-24 rounded border border-neutral-700 bg-neutral-800 flex flex-col items-center justify-between py-2 px-1">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
        {card.type}
      </span>
      <span className="text-sm font-medium text-center leading-tight">
        {label}
      </span>
      <span className="text-xs text-amber-400 font-semibold">
        {card.cost ?? 1}¢
      </span>
    </div>
  );
}

function cardLabel(card: Card): string {
  if (card.type === "capital") {
    return `${card.capitalValue ?? 1}-cap`;
  }
  if (card.type === "resource") {
    const count = card.resourceCount ?? 1;
    return count > 1 ? `${count}× ${card.subtype}` : card.subtype ?? "?";
  }
  return "?";
}
