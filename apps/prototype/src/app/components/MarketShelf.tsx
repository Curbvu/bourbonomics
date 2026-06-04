"use client";

import type { ResourceKind } from "@bourbonomics/prototype-engine";
import CardTile from "./CardTile";

/**
 * The Market — a persistent shelf the player draws resources off of,
 * recreated from the live game's MarketRow (wood rail + floor plank +
 * "what the table is selling" header). The prototype engine draws the
 * top `drawCount` cards off a shared communal deck rather than buying a
 * specific card, so the shelf shows the cooperage stock (one preview
 * per resource kind, in the canonical CardTile look) with a single
 * prominent "Draw N →" affordance. The draw pile and the button both
 * fire `onDraw`.
 */

const STOCK: { kind: ResourceKind; name: string }[] = [
  { kind: "cask", name: "Oak Cask" },
  { kind: "corn", name: "Corn" },
  { kind: "grain", name: "Grain" },
];

export default function MarketShelf({
  deckCount,
  drawCount,
  disabled = false,
  onDraw,
}: {
  deckCount: number;
  drawCount: number;
  disabled?: boolean;
  onDraw: () => void;
}) {
  const empty = deckCount <= 0;
  const blocked = disabled || empty;

  return (
    <section
      className="bb-panel bb-panel--market flex flex-col gap-2 overflow-hidden"
      style={{ padding: "8px 14px 12px 14px" }}
    >
      {/* Header strip */}
      <div className="flex items-baseline gap-2">
        <span className="stage-tag">The Market</span>
        <span
          className="font-display italic"
          style={{ color: "var(--brass)", fontSize: 13 }}
        >
          What the cooperage is selling — draw three.
        </span>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{ background: "linear-gradient(90deg, var(--rule), transparent)" }}
        />
        <button
          type="button"
          onClick={blocked ? undefined : onDraw}
          disabled={blocked}
          className="rounded-[6px] border border-[var(--gold)] bg-gradient-to-b from-[#f0c970] to-[#c69d52] px-3 py-[5px] font-mono text-[11px] font-bold uppercase tracking-[.14em] text-[#1a120b] transition hover:brightness-110 disabled:cursor-not-allowed disabled:border-[var(--rule)] disabled:from-[#4d4031] disabled:to-[#2a1f15] disabled:text-[var(--whisper)]"
        >
          {empty ? "Deck empty" : `Draw ${drawCount} →`}
        </button>
      </div>

      {/* Shelf body */}
      <div className="relative flex-1">
        {/* Top shelf rail — wood + brass-edge lip. */}
        <div
          aria-hidden
          className="wood brass-edge absolute left-0 right-0"
          style={{ top: -3, height: 6, borderRadius: 3 }}
        />
        {/* Floor plank. */}
        <div
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            bottom: -3,
            height: 6,
            borderRadius: 3,
            background: "linear-gradient(180deg, #2a1a10, #110a06)",
            boxShadow: "inset 0 1px 0 rgba(240,201,112,.15)",
          }}
        />

        <div className="flex h-full items-center gap-3" style={{ padding: "8px 2px" }}>
          {/* Draw pile — stacked card-backs + count. */}
          <button
            type="button"
            onClick={blocked ? undefined : onDraw}
            disabled={blocked}
            title={empty ? "The communal deck is empty" : `Draw ${drawCount} resources`}
            className="group relative h-[120px] w-[88px] shrink-0 cursor-pointer rounded-md transition disabled:cursor-not-allowed"
          >
            {/* back layers */}
            <span
              aria-hidden
              className="absolute inset-0 -rotate-6 rounded-md border-2 border-[#5a3a1e] bg-gradient-to-b from-[#3a2412] to-[#1a0f06]"
            />
            <span
              aria-hidden
              className="absolute inset-0 rotate-3 rounded-md border-2 border-[#6b4423] bg-gradient-to-b from-[#4a3018] to-[#1a0f06]"
            />
            <span
              className={[
                "absolute inset-0 flex flex-col items-center justify-center rounded-md border-2 bg-gradient-to-b from-[#5a3a1e] to-[#1a0f06] transition",
                blocked
                  ? "border-[var(--rule)] opacity-50"
                  : "border-[#a07142] group-hover:-translate-y-1 group-hover:brightness-110",
              ].join(" ")}
            >
              <span className="text-[22px] leading-none">🛢</span>
              <span className="mt-1 font-display text-[16px] font-bold text-[var(--gold)]">
                {deckCount}
              </span>
              <span className="label-sm" style={{ color: "var(--mute)", fontSize: 8.5 }}>
                in deck
              </span>
            </span>
          </button>

          {/* Stock preview — one canonical card per kind. */}
          <div className="flex flex-1 items-center justify-center gap-3">
            {STOCK.map((s) => (
              <CardTile
                key={s.kind}
                kind={s.kind}
                quality="common"
                name={s.name}
                size="sm"
                interactive={false}
                dim
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
