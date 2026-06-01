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

import { useEffect, useRef, useState } from "react";
import type {
  Card,
  ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { RESOURCE_LABEL, laborGlyphFor } from "./handCardStyles";
import { useZoneFocusClass, useZoneFocusStyle } from "./pickerFocus";
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
  const {
    state,
    multiplayerMode,
    startBuyMode,
    setBuyTarget,
    buyMode,
    setInspect,
    tutorialSpotlight,
  } = useGameStore();
  if (!state) return null;

  // Tutorial gate — mirrors MarketDrawer: when the spotlight pins a
  // specific market slot, only that slot can be clicked through the
  // persistent shelf. Other slots dim out of the way.
  const tutorialPinnedSlot =
    tutorialSpotlight?.kind === "market-slot"
      ? tutorialSpotlight.slotIndex
      : null;

  // Mirror DistilleryStage's seat-id logic so the affordability check
  // measures the local seat's wallet — never the wrong seat in MP.
  const youId = multiplayerMode
    ? multiplayerMode.playerId
    : state.players.find((p) => !p.isBot)?.id;
  const me = youId ? state.players.find((p) => p.id === youId) : null;
  // v3.3 — wallet read is Capital (the spendable currency).
  const reputation = me?.capital ?? 0;

  // v3.2.1: show the full market inline (no overflow cap). The track
  // still scrolls when the cards overflow the panel width, so a 10-card
  // market is always fully visible — drag the ScrollEdge buttons or use
  // the track scroller to see anything past the right edge.
  const market = state.market;
  // Split out investment cards into a dedicated pool tile — investments
  // are structural / persistent purchases (Bottling Plant, Sales Office,
  // Rickhouse Expansion, etc.) and deserve their own browse surface so
  // the inline shelf stays focused on round-by-round resources + ops.
  // Each card's original slot index is preserved so onCardBuy still
  // dispatches against the engine's actual market[slot] target.
  const investmentEntries = market
    .map((card, slotIndex) => ({ card, slotIndex }))
    .filter((e) => e.card.type === "investment");
  const inlineEntries = market
    .map((card, slotIndex) => ({ card, slotIndex }))
    .filter((e) => e.card.type !== "investment");
  // Pool open/close state — toggled by the InvestmentPool tile's
  // "Open" / "Close" button. Esc closes it; clicking outside the
  // popover anchor also closes it (handled via the backdrop layer).
  const [investmentsOpen, setInvestmentsOpen] = useState(false);
  useEffect(() => {
    if (!investmentsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setInvestmentsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [investmentsOpen]);

  // Inline buy: same path as the drawer's onCardClick. BuyOverlay then
  // drives the payment selection — the row click only fixes the target.
  const onCardBuy = (slotIndex: number, affordable: boolean) => {
    if (!affordable) return;
    if (tutorialPinnedSlot != null && slotIndex !== tutorialPinnedSlot) {
      return;
    }
    startBuyMode();
    setBuyTarget({ slotIndex });
  };

  // `OPEN FULL ↗` + `+N more` open the drawer. We just enter buy mode
  // without setting a target; GameBoard's `marketOpen` derivation
  // (buyMode != null && pickedTarget == null) opens the drawer.
  const onOpenFull = () => {
    startBuyMode();
  };

  // Right-click on any market card → open the inspect modal so the
  // player can read the full card text without committing to a buy.
  // Ops / investments carry their spec on `opSpec` / `investmentSpec`;
  // resources + labor pass through as-is.
  const onCardInspect = (card: Card) => {
    if (card.type === "operations" && card.opSpec) {
      setInspect({ kind: "operations", card: card.opSpec });
    } else if (card.type === "investment" && card.investmentSpec) {
      setInspect({ kind: "investment", card: card.investmentSpec });
    } else if (card.type === "labor") {
      setInspect({ kind: "labor", card });
    } else {
      setInspect({ kind: "resource", card });
    }
  };

  const focusClass = useZoneFocusClass("market-conveyor");
  const focusStyle = useZoneFocusStyle("market-conveyor");

  return (
    <section
      data-bb-zone="market-row"
      className={`bb-panel bb-panel--market flex flex-col gap-2 ${focusClass}`}
      style={{ padding: "8px 16px 10px 16px", ...focusStyle }}
    >
      {/* Header strip */}
      <div className="flex items-baseline gap-3">
        <span className="stage-tag">The Market</span>
        <span
          className="font-display italic"
          style={{ color: "var(--brass)", fontSize: 16 }}
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
          className="rounded-[5px] border border-[#3b2818] px-2.5 py-[3px] font-mono text-[12px] font-semibold uppercase tracking-[.16em]"
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

        {/* Card track — fits the full market (always 10 cards) inside
            the stage column with zero horizontal scroll. Each card uses
            `flex: 1 1 0` with a sane min/max so they share the
            available width evenly; on wider canvases they cap at their
            comfortable 160px width, and on tighter columns they shrink
            together (still readable down to ~80px). Per CLAUDE.md rule
            #1 the gameplay surface never scrolls — `overflow: hidden`
            here enforces that even if a future round sneaks an extra
            card in. */}
        <div
          data-market-conveyor
          className="relative flex"
          style={{
            gap: 8,
            padding: "10px 4px 12px 4px",
            overflow: "visible",
            minWidth: 0,
          }}
        >
          {/* Investments pool tile — always on the left of the shelf
              so the persistent-structure purchases (Bottling Plant,
              Sales Office, Rickhouse Expansion, …) have a dedicated
              browse surface separate from the inline resource +
              operations cards. */}
          <InvestmentPool
            count={investmentEntries.length}
            open={investmentsOpen}
            onToggle={() => setInvestmentsOpen((o) => !o)}
          />
          {/* Subtle divider between the pool tile and the inline shelf
              so the eye reads two regions: pooled (investments) and
              loose (everything else). */}
          {inlineEntries.length > 0 ? (
            <span
              aria-hidden
              className="self-stretch"
              style={{
                width: 1,
                margin: "4px 2px",
                background:
                  "linear-gradient(180deg, transparent, rgba(198,157,82,.3), transparent)",
              }}
            />
          ) : null}
          {inlineEntries.map(({ card, slotIndex }) => (
            <MarketRowCard
              key={card.id}
              card={card}
              slotIndex={slotIndex}
              affordable={reputation >= (card.cost ?? 1)}
              picked={buyMode?.pickedTarget?.slotIndex === slotIndex}
              tutorialBlocked={
                tutorialPinnedSlot != null && slotIndex !== tutorialPinnedSlot
              }
              onBuy={() =>
                onCardBuy(slotIndex, reputation >= (card.cost ?? 1))
              }
              onInspect={() => onCardInspect(card)}
            />
          ))}
          {/* Pool popover — anchored just below the InvestmentPool
              tile when open. Floats over the floor plank so the rest
              of the shelf stays visible underneath. */}
          {investmentsOpen ? (
            <InvestmentPoolPopover
              entries={investmentEntries}
              wallet={reputation}
              tutorialPinnedSlot={tutorialPinnedSlot}
              pickedSlotIndex={buyMode?.pickedTarget?.slotIndex ?? null}
              onBuy={(slotIndex, affordable) => {
                onCardBuy(slotIndex, affordable);
                setInvestmentsOpen(false);
              }}
              onInspect={(card) => onCardInspect(card)}
              onClose={() => setInvestmentsOpen(false)}
            />
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// InvestmentPool — pool tile that lives on the left edge of the
// market row. Reads as "6 ventures · Open" when there are 6
// investments on offer this round; click toggles the popover that
// shows the actual cards. Designed to occupy roughly one MarketRowCard
// slot so the shelf doesn't bloat horizontally.
// ─────────────────────────────────────────────────────────────────────

function InvestmentPool({
  count,
  open,
  onToggle,
}: {
  count: number;
  open: boolean;
  onToggle: () => void;
}) {
  const disabled = count === 0;
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      aria-expanded={open}
      title={
        disabled
          ? "No investments on offer this round."
          : `${count} investment${count === 1 ? "" : "s"} on offer — click to ${open ? "close" : "open"}`
      }
      className="group relative flex flex-shrink-0 cursor-pointer flex-col rounded-[8px] border px-2.5 py-2 text-left transition-all disabled:cursor-default"
      style={{
        width: 130,
        borderColor: open
          ? "var(--gold)"
          : disabled
            ? "rgba(110,80,50,.4)"
            : "rgba(125,166,223,.55)",
        background: open
          ? "radial-gradient(120% 80% at 0% 0%, rgba(125,166,223,.20), transparent 60%), linear-gradient(180deg, rgba(34,23,16,.96), rgba(14,10,6,.98))"
          : "radial-gradient(120% 80% at 0% 0%, rgba(125,166,223,.12), transparent 60%), linear-gradient(180deg, rgba(34,23,16,.92), rgba(14,10,6,.95))",
        boxShadow: open
          ? "0 0 0 1px var(--gold), 0 8px 22px rgba(240,201,112,.25), inset 0 1px 0 rgba(240,201,112,.18)"
          : disabled
            ? "inset 0 1px 0 rgba(255,255,255,.03)"
            : "inset 0 1px 0 rgba(255,255,255,.05), 0 4px 14px rgba(125,166,223,.18)",
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className="grid h-[22px] w-[22px] place-items-center rounded-[5px] border"
          style={{
            borderColor: "rgba(125,166,223,.55)",
            background: "rgba(125,166,223,.14)",
            color: "#7da6df",
            fontSize: 14,
            lineHeight: 1,
          }}
        >
          ↗
        </span>
        <span
          className="font-mono font-bold uppercase"
          style={{
            fontSize: 11,
            letterSpacing: ".14em",
            color: "#7da6df",
          }}
        >
          Invest
        </span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span
          className="font-display font-bold tabular-nums leading-none"
          style={{
            fontSize: 30,
            color: disabled ? "var(--mute)" : "#7da6df",
            textShadow: disabled
              ? "none"
              : "0 0 14px rgba(125,166,223,.4)",
          }}
        >
          {count}
        </span>
        <span
          className="font-display italic"
          style={{ fontSize: 12, color: "var(--mute)" }}
        >
          {count === 1 ? "venture" : "ventures"}
        </span>
      </div>
      <div
        className="mt-1.5 flex items-center justify-between gap-1 border-t pt-1.5 font-mono uppercase"
        style={{
          borderColor: "rgba(110,80,50,.35)",
          fontSize: 9.5,
          letterSpacing: ".14em",
          color: disabled
            ? "var(--mute)"
            : open
              ? "var(--gold)"
              : "var(--brass)",
        }}
      >
        <span>{disabled ? "Empty" : open ? "Close" : "Open"}</span>
        <span aria-hidden style={{ fontSize: 11 }}>
          {open ? "▴" : "▾"}
        </span>
      </div>
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────
// InvestmentPoolPopover — floating panel that drops below the pool
// tile and renders each investment in the pool as a MarketRowCard.
// Click outside (the backdrop) or Esc closes; the wiring lives in
// MarketRow's component state.
// ─────────────────────────────────────────────────────────────────────

function InvestmentPoolPopover({
  entries,
  wallet,
  tutorialPinnedSlot,
  pickedSlotIndex,
  onBuy,
  onInspect,
  onClose,
}: {
  entries: { card: Card; slotIndex: number }[];
  wallet: number;
  tutorialPinnedSlot: number | null;
  pickedSlotIndex: number | null;
  onBuy: (slotIndex: number, affordable: boolean) => void;
  onInspect: (card: Card) => void;
  onClose: () => void;
}) {
  return (
    <>
      {/* Transparent click-catcher so a click outside the panel closes
          it. Sits above the rest of the page (z-40) but below the
          panel itself (z-50). */}
      <div
        aria-hidden
        onClick={onClose}
        className="fixed inset-0 z-40"
        style={{ background: "transparent" }}
      />
      <div
        role="dialog"
        aria-label="Available investments"
        onClick={(e) => e.stopPropagation()}
        className="absolute z-50 flex flex-col gap-2 rounded-[10px] border px-3 py-2"
        style={{
          top: "100%",
          left: 0,
          marginTop: 8,
          minWidth: 380,
          maxWidth: "min(960px, 92vw)",
          borderColor: "rgba(125,166,223,.55)",
          background:
            "radial-gradient(120% 60% at 0% 0%, rgba(125,166,223,.10), transparent 55%), linear-gradient(180deg, rgba(24,16,10,.99), rgba(13,9,5,.99))",
          boxShadow:
            "0 16px 40px rgba(0,0,0,.65), inset 0 1px 0 rgba(125,166,223,.18)",
          animation: "log-in 180ms ease-out",
        }}
      >
        <header className="flex items-baseline gap-3">
          <span
            className="font-mono font-bold uppercase"
            style={{
              fontSize: 11,
              letterSpacing: ".22em",
              color: "#7da6df",
            }}
          >
            Investments
          </span>
          <span
            className="font-display italic"
            style={{ color: "var(--brass)", fontSize: 13 }}
          >
            {entries.length} on the shelf
          </span>
          <span
            aria-hidden
            className="h-px flex-1"
            style={{
              background:
                "linear-gradient(90deg, rgba(198,157,82,.4), transparent)",
            }}
          />
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-slate-700 bg-slate-900/60 px-2 py-[2px] font-mono text-[10px] font-bold uppercase tracking-[.14em] text-slate-300 hover:bg-slate-800/70"
          >
            Close ✕
          </button>
        </header>
        <div className="flex flex-wrap gap-2">
          {entries.map(({ card, slotIndex }) => (
            <MarketRowCard
              key={card.id}
              card={card}
              slotIndex={slotIndex}
              affordable={wallet >= (card.cost ?? 1)}
              picked={pickedSlotIndex === slotIndex}
              tutorialBlocked={
                tutorialPinnedSlot != null && slotIndex !== tutorialPinnedSlot
              }
              onBuy={() => onBuy(slotIndex, wallet >= (card.cost ?? 1))}
              onInspect={() => onInspect(card)}
            />
          ))}
        </div>
      </div>
    </>
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
        padding: "2px 10px 2px 8px",
        borderRadius: 999,
        background: affordable
          ? "linear-gradient(180deg, #f0c970, #c69d52)"
          : "linear-gradient(180deg, #4d4031, #2a1f15)",
        color: affordable ? "#1a120b" : "var(--whisper)",
        fontFamily: "var(--font-mono)",
        fontSize: 14,
        fontWeight: 700,
        boxShadow: affordable
          ? "inset 0 1px 0 rgba(255,255,255,.4), 0 1px 2px rgba(0,0,0,.5)"
          : "inset 0 1px 0 rgba(255,255,255,.05)",
        letterSpacing: ".02em",
      }}
    >
      <span style={{ fontSize: 16, opacity: 0.7 }}>฿</span>
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
  picked,
  tutorialBlocked = false,
  onBuy,
  onInspect,
}: {
  card: Card;
  slotIndex: number;
  affordable: boolean;
  picked: boolean;
  /** When the tutorial is steering the player toward a different slot,
   *  dim this card and gate the left-click. Right-click still opens
   *  inspect so the player can read what's blocked. */
  tutorialBlocked?: boolean;
  onBuy: () => void;
  /** Right-click opens the full inspect modal — never blocked by
   *  affordability, so the player can read about cards they can't buy. */
  onInspect: () => void;
}) {
  const { kindLabel, glyph, subInk, tier } = resolveCardKind(card);
  const tierKey = tierOrCommon(tier);
  const tierInk = TIER_INK[tierKey];
  const tierGlow = TIER_GLOW[tierKey] ?? "rgba(185,166,132,.30)";

  const dim = !affordable || tutorialBlocked;
  const cost = card.cost ?? 1;

  // Resolve display name + slogan. Each card type stores its name in a
  // slightly different field; centralise the lookup here so the
  // template stays clean.
  const name = displayName(card);
  const slogan = flavorText(card);

  // v3.4: when this slot is the picked target in buy mode, lock in
  // amber chrome so the player's eye keeps the "this is what you're
  // buying" anchor as they move to the hand. Hover state skips while
  // picked so it doesn't overwrite the ring.
  const pickedShadow =
    "inset 0 1px 0 rgba(255,255,255,.08), 0 0 0 3px rgba(252,211,77,.85), 0 0 28px rgba(252,211,77,.45)";

  // Hover lift handled inline via style mutation (mockup pattern). The
  // CSS transition declared on the button animates both directions.
  const onMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dim || picked) return;
    e.currentTarget.style.transform = "translateY(-4px)";
    e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,.08), 0 10px 24px ${tierGlow}, 0 0 0 1px ${tierInk}99`;
  };
  const onMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (dim || picked) return;
    e.currentTarget.style.transform = "translateY(0)";
    e.currentTarget.style.boxShadow = `inset 0 1px 0 rgba(255,255,255,.06), 0 4px 12px ${tierGlow}`;
  };

  return (
    <button
      type="button"
      onClick={dim ? undefined : onBuy}
      onContextMenu={(e) => {
        e.preventDefault();
        onInspect();
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      aria-disabled={dim || undefined}
      // Stay un-disabled so contextmenu still fires on unaffordable
      // cards — `disabled` blocks all native pointer events including
      // right-click. We gate the left-click ourselves via `dim`.
      title={
        tutorialBlocked
          ? "Follow the highlighted step first"
          : dim
            ? "Can't afford yet — right-click to inspect"
            : "Left-click to buy · right-click to inspect"
      }
      data-market-slot-index={slotIndex}
      data-market-picked={picked || undefined}
      className="relative flex flex-col text-left"
      style={{
        // Share the track's width evenly with every other card so the
        // full market always fits with no horizontal scroll. The 160px
        // cap preserves the comfortable design size on a wide canvas;
        // the 78px floor keeps the smallest column-width case readable.
        flex: "1 1 0",
        minWidth: 78,
        maxWidth: 160,
        // Card height tightened from 212 to 168 after the bottom
        // pill + Buy → footer was removed — content actually fits in
        // ~156px now and the extra 12px gives the title a comfortable
        // breathing room without bloating the market row's chrome.
        height: 168,
        padding: "11px 10px 12px 10px",
        borderRadius: 9,
        // Tier is the only "what kind of card is this" signal now that
        // the bottom pill is gone — bump the border alpha to ~AA so
        // each tier reads at a glance, and seat a brighter inner
        // top edge that doubles as a tier accent stripe.
        border: `1px solid ${picked ? "rgba(252,211,77,.9)" : dim ? "var(--rule)" : `${tierInk}aa`}`,
        background: dim
          ? "linear-gradient(180deg, rgba(34,23,16,.55), rgba(20,14,8,.85))"
          : // Stronger tier tint (was 1f ≈ 12%, now 38 ≈ 22%) so the
            // top half of the card visibly carries the tier color.
            `linear-gradient(180deg, ${tierInk}38 0%, rgba(20,14,8,.95) 70%)`,
        boxShadow: picked
          ? pickedShadow
          : dim
            ? "inset 0 1px 0 rgba(255,255,255,.04)"
            : // Add an inset top accent stripe (`inset 0 2px 0 ${tierInk}`)
              // so the card reads as "tier-colored ribbon over slate" —
              // mirrors what the bottom pill used to do at the top edge.
              `inset 0 2px 0 ${tierInk}, inset 0 1px 0 rgba(255,255,255,.10), 0 4px 14px ${tierGlow}`,
        transform: picked ? "translateY(-4px)" : undefined,
        color: "var(--ink)",
        cursor: dim ? "not-allowed" : "pointer",
        opacity: dim ? 0.55 : 1,
        // Picked path skips the box-shadow/border transition because
        // an upstream cascade quirk leaves the transitioned values
        // pinned to their start. Transform still animates so the lift
        // reads as a deliberate "selected" affordance.
        transition: picked
          ? "transform 200ms cubic-bezier(.22,1,.36,1)"
          : "transform 200ms cubic-bezier(.22,1,.36,1), box-shadow 200ms ease, border-color 200ms ease",
        scrollSnapAlign: "start",
      }}
    >
      {/* Top row: kind label + price tag. `min-width: 0` on the label
          lets flexbox actually shrink + ellipsize the kind text on
          narrow cards, instead of pushing the PriceTag out the side. */}
      <div className="flex items-baseline justify-between gap-1.5">
        <span
          className="font-mono font-bold uppercase"
          style={{
            fontSize: 16,
            letterSpacing: ".12em",
            color: tierInk,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: "1 1 auto",
          }}
        >
          {kindLabel}
        </span>
        <PriceTag amount={cost} affordable={affordable} />
      </div>

      {/* Glyph block */}
      <div className="mt-1.5 grid place-items-center" style={{ height: 44 }}>
        <span
          className="font-emoji leading-none"
          style={{
            fontSize: 38,
            color: subInk,
            textShadow: dim ? "none" : `0 0 12px ${subInk}55`,
          }}
          aria-hidden
        >
          {glyph}
        </span>
      </div>

      {/* Name — clamped to 2 lines and a hair smaller so it survives
          the narrow-card case (each card is ~84px wide when the full
          market is on a 1080p screen) without spilling out. */}
      <div
        className="mt-1.5 font-display font-semibold"
        style={{
          fontSize: 17,
          color: "var(--ink)",
          lineHeight: 1.15,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          wordBreak: "break-word",
        }}
      >
        {name}
      </div>

      {/* Slogan — clamped to 2 lines so 4-line bios don't break layout */}
      {slogan ? (
        <div
          className="mt-1 font-display italic"
          style={{
            fontSize: 16,
            color: "var(--mute)",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            wordBreak: "break-word",
          }}
        >
          {slogan}
        </div>
      ) : null}

      {/* Tier is now communicated purely through chrome (border color,
          background gradient, glow). No textual "UNCOMMON" pill, no
          "BUY →" hint — the click affordance is implicit and the
          tier reads from the card's hue. */}
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
