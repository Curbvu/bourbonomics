"use client";

/**
 * v3.2 MarketRow — persistent shelf above the distillery.
 *
 * Per the v2 handoff (§ 8 MarketRow), the market is no longer hidden
 * behind a drawer click. A horizontal, scrollable strip of buyable
 * cards sits above the distillery so the player can read what's for
 * sale at a glance. Up to 8 cards inline; the rest are accessible via
 * the `OPEN FULL ↗` button or the `+N more` overflow tile, both of
 * which open the existing MarketDrawer.
 *
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ THE MARKET   What the table is selling…  ──────  OPEN FULL ↗│
 *   │ ┌──────────────────────────────────────────────────────────┐│
 *   │ │ ‹ │ [card] [card] [card] [card] [card] [card] [card] +N │ ›│
 *   │ └──────────────────────────────────────────────────────────┘│
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Card click:
 *   - Affordable card → `startBuyMode()` + `setBuyTarget({ slotIndex })`
 *     → BuyOverlay engages with the slot pre-targeted (same path as
 *     the drawer's onCardClick).
 *   - Disabled card (rep < cost) → no-op.
 *   - `OPEN FULL ↗` / `+N more` → `startBuyMode()` (no target) → the
 *     drawer opens via GameBoard's `marketOpen` derivation.
 *
 * Preserves `data-market-conveyor` + `data-market-slot-index={i}` for
 * the tutorial spotlight and the existing drop-target CSS rules.
 */

import { useRef } from "react";
import type {
  Card,
  ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { RESOURCE_LABEL, laborGlyphFor } from "./handCardStyles";
import { TIER_INK, tierOrCommon } from "./tierStyles";

// ─────────────────────────────────────────────────────────────────────
// Subtype glyph set used on the row card glyph block. Mirrors the
// mockup's `SUB_GLYPH_R` map (cask ⌬, corn ✺, rye ✦, barley ❦, wheat
// ❉, labor ⚒) so the row and the drawer agree on glyph for each kind.
// ─────────────────────────────────────────────────────────────────────
const RESOURCE_GLYPH_R: Record<ResourceSubtype, string> = {
  cask: "⌬",
  corn: "✺",
  rye: "✦",
  barley: "❦",
  wheat: "❉",
};

// Subtype-ink palette (same hex values as the mash pip palette in
// DistilleryStage). Drives the glyph color + bottom-strip caption.
const SUB_INK: Record<string, string> = {
  cask: "#d59650",
  corn: "#e9c46e",
  rye: "#d96b54",
  barley: "#82c9a3",
  wheat: "#7da6df",
  labor: "#c69d52",
};

// Tier glow values keyed by ink. Mirrors `tierStyles.ts` glow column
// but exposed as raw `rgba()` strings so the inline box-shadow can
// reach for them directly.
const TIER_GLOW: Record<string, string> = {
  common: "rgba(185,166,132,.30)",
  uncommon: "rgba(130,201,163,.40)",
  rare: "rgba(125,166,223,.50)",
  epic: "rgba(198,157,240,.55)",
  legendary: "rgba(240,176,112,.65)",
};

export default function MarketRow() {
  const { state, multiplayerMode, startBuyMode, setBuyTarget } = useGameStore();
  if (!state) return null;

  // Mirror DistilleryStage's seat-id logic so the affordability check
  // measures the local seat's wallet — never the wrong seat in MP.
  const youId = multiplayerMode
    ? multiplayerMode.playerId
    : state.players.find((p) => !p.isBot)?.id;
  const me = youId ? state.players.find((p) => p.id === youId) : null;
  const reputation = me?.reputation ?? 0;

  const market = state.market;
  const inline = market.slice(0, 8);
  const overflow = Math.max(0, market.length - inline.length);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const scrollBy = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 360, behavior: "smooth" });
  };

  // Inline buy: same path as the drawer's onCardClick. BuyOverlay then
  // drives the payment selection — the row click only fixes the target.
  const onCardBuy = (slotIndex: number, affordable: boolean) => {
    if (!affordable) return;
    startBuyMode();
    setBuyTarget({ slotIndex });
  };

  // `OPEN FULL ↗` + `+N more` open the drawer. We just enter buy mode
  // without setting a target; GameBoard's `marketOpen` derivation
  // (buyMode != null && pickedTarget == null) opens the drawer.
  const onOpenFull = () => {
    startBuyMode();
  };

  return (
    <section
      data-bb-zone="market-row"
      className="bb-panel bb-panel--market flex flex-col gap-2"
      style={{ padding: "12px 16px 14px 16px" }}
    >
      {/* Header strip */}
      <div className="flex items-baseline gap-3">
        <span className="stage-tag">The Market</span>
        <span
          className="font-display italic"
          style={{ color: "var(--brass)", fontSize: 12.5 }}
        >
          What the table is selling, this round.
        </span>
        <span
          aria-hidden
          className="h-px flex-1"
          style={{
            background: "linear-gradient(90deg, var(--rule), transparent)",
          }}
        />
        <button
          type="button"
          onClick={onOpenFull}
          className="rounded-[5px] border border-[#3b2818] px-2.5 py-[3px] font-mono text-[9px] font-semibold uppercase tracking-[.16em]"
          style={{
            background: "rgba(34,23,16,.6)",
            color: "var(--ink-muted)",
          }}
        >
          Open Full ↗
        </button>
      </div>

      {/* Shelf body */}
      <div className="relative">
        {/* Top shelf rail — wood + brass-edge lip. Sells the
            "this is a shelf you buy off of" metaphor. */}
        <div
          aria-hidden
          className="wood brass-edge absolute left-0 right-0"
          style={{
            top: -3,
            height: 6,
            borderRadius: 3,
          }}
        />
        {/* Floor plank — warm wood gradient + gold inset highlight. */}
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

        {/* Scroll edge buttons (fade affordances). */}
        <ScrollEdge side="left" onClick={() => scrollBy(-1)} />
        <ScrollEdge side="right" onClick={() => scrollBy(1)} />

        {/* Card track */}
        <div
          ref={scrollerRef}
          data-market-conveyor
          className="scroll-thin flex"
          style={{
            gap: 8,
            padding: "10px 36px 12px 36px",
            overflowX: "auto",
            overflowY: "visible",
            scrollSnapType: "x proximity",
          }}
        >
          {inline.map((card, i) => (
            <MarketRowCard
              key={card.id}
              card={card}
              slotIndex={i}
              affordable={reputation >= (card.cost ?? 1)}
              onBuy={() => onCardBuy(i, reputation >= (card.cost ?? 1))}
            />
          ))}
          {overflow > 0 ? (
            <button
              type="button"
              onClick={onOpenFull}
              className="flex flex-col items-center justify-center gap-1.5"
              style={{
                flexShrink: 0,
                width: 92,
                borderRadius: 8,
                border: "1px dashed rgba(110,80,50,.45)",
                background: "rgba(20,14,8,.5)",
                color: "var(--ink-muted)",
                fontFamily: "var(--font-mono)",
                fontSize: 9.5,
                letterSpacing: ".14em",
                textTransform: "uppercase",
                fontWeight: 600,
                cursor: "pointer",
                scrollSnapAlign: "end",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 26,
                  fontWeight: 700,
                  color: "var(--brass)",
                  lineHeight: 1,
                }}
              >
                +{overflow}
              </span>
              <span>more</span>
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/**
 * Left/right fade affordance — scrolls the card track by ±360px on
 * click. Positioned absolutely so the gradient overlays the leftmost /
 * rightmost cards (and hints there's more to scroll into view).
 */
function ScrollEdge({
  side,
  onClick,
}: {
  side: "left" | "right";
  onClick: () => void;
}) {
  const isLeft = side === "left";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={isLeft ? "scroll market left" : "scroll market right"}
      className="absolute grid place-items-center"
      style={{
        top: 0,
        bottom: 0,
        [isLeft ? "left" : "right"]: 0,
        width: 32,
        background: `linear-gradient(${
          isLeft ? "90deg" : "270deg"
        }, rgba(12,8,5,.92), rgba(12,8,5,0))`,
        border: 0,
        cursor: "pointer",
        zIndex: 2,
        color: "var(--brass)",
        fontFamily: "var(--font-display)",
        fontSize: 26,
        lineHeight: 1,
      }}
    >
      {isLeft ? "‹" : "›"}
    </button>
  );
}

/**
 * Brass medallion price tag. Affordable: brass gradient + ink. Not
 * affordable: dark slate fill + whisper ink. The `฿` rune sits before
 * the amount at 9px / opacity .7 per the mockup's PriceTag.
 */
function PriceTag({
  amount,
  affordable,
}: {
  amount: number;
  affordable: boolean;
}) {
  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: 3,
        padding: "1px 7px 1px 5px",
        borderRadius: 999,
        background: affordable
          ? "linear-gradient(180deg, #f0c970, #c69d52)"
          : "linear-gradient(180deg, #4d4031, #2a1f15)",
        color: affordable ? "#1a120b" : "var(--whisper)",
        fontFamily: "var(--font-mono)",
        fontSize: 10.5,
        fontWeight: 700,
        boxShadow: affordable
          ? "inset 0 1px 0 rgba(255,255,255,.4), 0 1px 2px rgba(0,0,0,.5)"
          : "inset 0 1px 0 rgba(255,255,255,.05)",
        letterSpacing: ".02em",
      }}
    >
      <span style={{ fontSize: 9, opacity: 0.7 }}>฿</span>
      {amount}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Card kind resolution. Each market entry can be a resource, labor,
// operations card, or investment. Drives the top-row kind label, the
// glyph in the center, and the bottom-strip tier pill.
// ─────────────────────────────────────────────────────────────────────
function resolveCardKind(card: Card): {
  kindLabel: string;
  glyph: string;
  subInk: string;
  tier: "common" | "uncommon" | "rare" | "epic" | "legendary";
} {
  if (card.type === "labor") {
    const sub = card.laborSubtype;
    const kindLabel =
      sub === "marketing"
        ? "Marketing"
        : sub === "cooper"
          ? "Cooper"
          : sub === "architect"
            ? "Architect"
            : "Labor";
    return {
      kindLabel,
      glyph: laborGlyphFor(sub),
      subInk: SUB_INK.labor ?? "#c69d52",
      tier: "common",
    };
  }
  if (card.type === "operations") {
    return {
      kindLabel: "Ops",
      glyph: "⚡",
      // Warm violet — slightly cooler than brass so ops cards read as
      // "special" without looking out of place on the bourbon shelf.
      subInk: "#c69df0",
      tier: "uncommon",
    };
  }
  if (card.type === "investment") {
    return {
      kindLabel: "Invest",
      glyph: "📈",
      // Verdigris — matches the existing investment chrome in
      // MarketDrawer (also uses #82c9a3 ink for the kind label).
      subInk: "#82c9a3",
      tier: "uncommon",
    };
  }
  // Resource
  const subtype = card.subtype as ResourceSubtype;
  const subInk = SUB_INK[subtype] ?? "#d59650";
  return {
    kindLabel: RESOURCE_LABEL[subtype] ?? "Resource",
    glyph: RESOURCE_GLYPH_R[subtype] ?? "◇",
    subInk,
    tier: card.specialty ? "uncommon" : "common",
  };
}

/**
 * One buyable card in the persistent row. Tier-colored border + glow,
 * brass PriceTag in the top-right, subtype glyph centered, name +
 * slogan, and a footer with the tier pill + a `Buy →` hint when
 * affordable.
 */
function MarketRowCard({
  card,
  slotIndex,
  affordable,
  onBuy,
}: {
  card: Card;
  slotIndex: number;
  affordable: boolean;
  onBuy: () => void;
}) {
  const { kindLabel, glyph, subInk, tier } = resolveCardKind(card);
  const tierKey = tierOrCommon(tier);
  const tierInk = TIER_INK[tierKey];
  const tierGlow = TIER_GLOW[tierKey] ?? "rgba(185,166,132,.30)";

  const dim = !affordable;
  const cost = card.cost ?? 1;

  // Resolve display name + slogan. Each card type stores its name in a
  // slightly different field; centralise the lookup here so the
  // template stays clean.
  const name = displayName(card);
  const slogan = flavorText(card);

  // Hover lift handled inline via style mutation (mockup pattern). The
  // CSS transition declared on the button animates both directions.
  const onMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dim) return;
    e.currentTarget.style.transform = "translateY(-4px)";
    e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,.08), 0 10px 24px ${tierGlow}, 0 0 0 1px ${tierInk}99`;
  };
  const onMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dim) return;
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,.06), 0 4px 12px ${tierGlow}`;
  };

  return (
    <button
      type="button"
      onClick={onBuy}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      disabled={dim}
      data-market-slot-index={slotIndex}
      className="relative flex flex-col text-left"
      style={{
        flexShrink: 0,
        width: 130,
        height: 158,
        padding: "9px 9px 10px 9px",
        borderRadius: 8,
        border: `1px solid ${dim ? "var(--rule)" : `${tierInk}66`}`,
        background: dim
          ? "linear-gradient(180deg, rgba(34,23,16,.55), rgba(20,14,8,.85))"
          : `linear-gradient(180deg, ${tierInk}1f 0%, rgba(20,14,8,.95) 70%)`,
        boxShadow: dim
          ? "inset 0 1px 0 rgba(255,255,255,.04)"
          : `inset 0 1px 0 rgba(255,255,255,.06), 0 4px 12px ${tierGlow}`,
        color: "var(--ink)",
        cursor: dim ? "not-allowed" : "pointer",
        opacity: dim ? 0.55 : 1,
        transition:
          "transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease, border-color 200ms ease",
        scrollSnapAlign: "start",
      }}
    >
      {/* Top row: kind label + price tag */}
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono font-bold uppercase"
          style={{
            fontSize: 8,
            letterSpacing: ".16em",
            color: tierInk,
          }}
        >
          {kindLabel}
        </span>
        <PriceTag amount={cost} affordable={affordable} />
      </div>

      {/* Glyph block */}
      <div className="mt-1 grid place-items-center" style={{ height: 30 }}>
        <span
          className="font-emoji leading-none"
          style={{
            fontSize: 26,
            color: subInk,
            textShadow: dim ? "none" : `0 0 10px ${subInk}55`,
          }}
          aria-hidden
        >
          {glyph}
        </span>
      </div>

      {/* Name */}
      <div
        className="mt-0.5 font-display font-semibold"
        style={{
          fontSize: 13,
          color: "var(--ink)",
          lineHeight: 1.1,
        }}
      >
        {name}
      </div>

      {/* Slogan — clamped to 2 lines so 4-line bios don't break layout */}
      {slogan ? (
        <div
          className="mt-0.5 font-display italic"
          style={{
            fontSize: 10,
            color: "var(--mute)",
            lineHeight: 1.25,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {slogan}
        </div>
      ) : null}

      {/* Footer: tier pill + Buy → hint */}
      <div
        className="mt-auto flex items-center justify-between pt-1.5"
        style={{
          borderTop: "1px dotted rgba(110,80,50,.3)",
        }}
      >
        <span
          className="font-mono font-bold uppercase"
          style={{
            padding: "0 5px",
            borderRadius: 3,
            border: `1px solid ${tierInk}`,
            color: tierInk,
            fontSize: 7.5,
            letterSpacing: ".12em",
          }}
        >
          {tierKey === "uncommon"
            ? "Uncommon"
            : tierKey === "rare"
              ? "Rare"
              : tierKey === "epic"
                ? "Epic"
                : tierKey === "legendary"
                  ? "Legendary"
                  : "Common"}
        </span>
        {!dim ? (
          <span
            className="font-mono font-bold uppercase"
            style={{
              fontSize: 8,
              letterSpacing: ".14em",
              color: "var(--gold)",
            }}
          >
            Buy →
          </span>
        ) : null}
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Display name + flavor lookup. Each card type stores its name in a
// slightly different field. Centralised here so MarketRowCard's
// template stays focused on layout.
// ─────────────────────────────────────────────────────────────────────
function displayName(card: Card): string {
  if (card.type === "labor") {
    const sub = card.laborSubtype;
    const fallback =
      sub === "marketing"
        ? "Marketing Labor"
        : sub === "cooper"
          ? "Cooper Labor"
          : sub === "architect"
            ? "Architect Labor"
            : "Generic Labor";
    return card.displayName ?? fallback;
  }
  if (card.type === "operations" && card.opSpec) return card.opSpec.name;
  if (card.type === "investment" && card.investmentSpec)
    return card.investmentSpec.name;
  // Resource
  const subtype = card.subtype as ResourceSubtype;
  const count = card.resourceCount ?? 1;
  return (
    card.displayName ??
    `${count > 1 ? `${count}× ` : ""}${RESOURCE_LABEL[subtype] ?? "Resource"}`
  );
}

function flavorText(card: Card): string {
  if (card.type === "labor") return card.flavor ?? "";
  if (card.type === "operations") return card.opSpec?.flavor ?? "";
  if (card.type === "investment") return card.investmentSpec?.short ?? "";
  return card.flavor ?? "";
}
