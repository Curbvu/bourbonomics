"use client";

import type { ResourceCard } from "@bourbonomics/prototype-engine";
import CardTile from "./CardTile";

/**
 * The Market — a face-up shelf of resource cards the cooperage is
 * selling. The communal deck deals MARKET_SIZE (8) cards face-up; the
 * player selects `takeCount` (3) of them into their hand and the shelf
 * refills from the deck (take-and-refill, like the mash-bill tray). The
 * cards use the canonical CardTile look (CLAUDE.md rule #3) and sit on a
 * wood rail + floor plank recreated from the live game's MarketRow.
 */

export default function MarketShelf({
  market,
  selected,
  takeCount,
  deckCount,
  disabled = false,
  onToggle,
  onTake,
}: {
  market: ResourceCard[];
  selected: Set<string>;
  takeCount: number;
  deckCount: number;
  disabled?: boolean;
  onToggle: (id: string) => void;
  onTake: () => void;
}) {
  const empty = market.length <= 0;
  // You take min(takeCount, market size) — the market may run low late-game.
  const need = Math.min(takeCount, market.length);
  const ready = selected.size === need && need > 0;
  const blocked = disabled || empty;

  return (
    <section
      className="bb-panel bb-panel--market flex flex-col gap-1.5 overflow-hidden"
      style={{ padding: "8px 14px 12px 14px" }}
    >
      {/* Header strip */}
      <div className="flex items-baseline gap-2">
        <span className="stage-tag">The Market</span>
        <span
          className="font-display italic"
          style={{ color: "var(--brass)", fontSize: 13 }}
        >
          What the cooperage is selling — pick {takeCount} for your hand.
        </span>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{ background: "linear-gradient(90deg, var(--rule), transparent)" }}
        />
        <span
          className="font-mono text-[10px] uppercase tracking-[.12em]"
          style={{ color: "var(--mute)" }}
        >
          {selected.size}/{need} picked · {deckCount} in deck
        </span>
        <button
          type="button"
          onClick={blocked || !ready ? undefined : onTake}
          disabled={blocked || !ready}
          className="rounded-[6px] border border-[var(--gold)] bg-gradient-to-b from-[#f0c970] to-[#c69d52] px-3 py-[5px] font-mono text-[11px] font-bold uppercase tracking-[.14em] text-[#1a120b] transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-[var(--rule)] disabled:from-[#4d4031] disabled:to-[#2a1f15] disabled:text-[var(--whisper)]"
        >
          {empty ? "Market empty" : `Take ${need} →`}
        </button>
      </div>

      {/* Shelf body */}
      <div className="relative flex-1">
        {/* Top shelf rail — wood + brass-edge lip. */}
        <div
          aria-hidden
          className="wood brass-edge absolute left-0 right-0"
          style={{ top: -3, height: 5, borderRadius: 3 }}
        />
        {/* Floor plank. */}
        <div
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            bottom: -3,
            height: 5,
            borderRadius: 3,
            background: "linear-gradient(180deg, #2a1a10, #110a06)",
            boxShadow: "inset 0 1px 0 rgba(240,201,112,.15)",
          }}
        />

        <div className="flex h-full items-center justify-center gap-1.5" style={{ padding: "6px 2px" }}>
          {empty ? (
            <span className="text-[13px] italic text-[var(--mute)]">
              The cooperage is sold out.
            </span>
          ) : (
            market.map((c) => {
              const isSel = selected.has(c.id);
              // Once `need` are picked, dim the rest so the choice reads clearly.
              const dimUnpicked = !isSel && selected.size >= need;
              return (
                <CardTile
                  key={c.id}
                  kind={c.kind}
                  quality={c.quality}
                  name={c.name}
                  size="sm"
                  selected={isSel}
                  interactive={!disabled}
                  dim={dimUnpicked}
                  onClick={() => onToggle(c.id)}
                />
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
