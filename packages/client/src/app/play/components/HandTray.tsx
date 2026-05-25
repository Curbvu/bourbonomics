"use client";

/**
 * HandTray — bottom-of-canvas strip showing the focused player's hand.
 *
 * Every hand item is a portrait-oriented mini card with a type-coloured
 * gradient, a centered glyph, and an accordion-fan layout (cards
 * overlap left-to-right; hover lifts to z-50). Sections from left to
 * right: deck pile · resources + Labor row · ops row · reputation
 * strip (rendered separately above the cards).
 */

import React, { useEffect, useRef, useState } from "react";
import {
  laborContribution,
  type Card,
  type GameState,
  type OperationsCard,
  type PlayerState,
  type ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import ActionBar from "./ActionBar";
import AgeOverlay from "./AgeOverlay";
import MakeOverlay from "./MakeOverlay";
import SellOverlay from "./SellOverlay";
import PlayerSwatch from "./PlayerSwatch";
import { buyDomainForTarget } from "./buyDomain";
import { CornerCost } from "./cardCorners";
import { setMakeDragPayload } from "./dragMake";
import { useZoneFocusClass, useZoneFocusStyle, type FocusZone } from "./pickerFocus";
import {
  CARD_SIZE_CLASS,
  HAND_CARD_OVERLAP,
  LABOR_CHROME,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";
import { MoneyText } from "./money";

export default function HandTray() {
  const { state, seatMeta, multiplayerMode } = useGameStore();
  if (!state) return null;
  // In multiplayer, the tray belongs to whichever seat THIS connection
  // owns — not the first non-bot, which would be the host on every
  // remote screen. Spectators (no claimed seat) see no tray; they
  // observe via the Rickhouse strip + RoomBanner instead.
  const focused = multiplayerMode
    ? multiplayerMode.playerId
      ? state.players.find((p) => p.id === multiplayerMode.playerId) ?? null
      : null
    : focusedPlayer(state);
  if (!focused) {
    if (multiplayerMode) {
      return <SpectatorTray />;
    }
    return null;
  }
  const playerIndex = state.players.findIndex((p) => p.id === focused.id);
  const meta = seatMeta.find((m) => m.id === focused.id);

  // Render hand cards in a single mixed row, sorted by subtype/type so
  // the row reads consistently. Labor sorts last so it sits next to
  // resources but doesn't crowd grain order.
  const handCards = [...focused.hand].sort((a, b) => {
    const order = (c: typeof a) =>
      c.type === "labor" ? 100 : SUBTYPE_ORDER[c.subtype ?? "cask"] ?? 99;
    return order(a) - order(b);
  });

  return (
    <div
      data-hand-tray="true"
      className="bb-panel bb-panel--hand overflow-hidden"
      style={{ gridArea: "hand" }}
    >
      {/* Interactive overlays. Only one of these ever paints at a time
          (each gates on its own mode flag); kept mounted here so the
          mode-pickers can land right above the hand.

          BuyOverlay lives inside DistilleryStage now so it can overlay
          just that section instead of the full screen — `absolute
          inset-0` against the panel rather than `fixed inset-0`
          against the design canvas.

          DrawBillOverlay is mounted at the page root instead, outside
          ScalingHost — it's a true fullscreen modal and the
          `transform: scale(...)` on ScalingHost would otherwise scope
          its `position: fixed` to the design canvas. */}
      <AgeOverlay />
      <SellOverlay />
      <MakeOverlay />

      {/* Action bar — restyled mono brass buttons. */}
      <ActionBar />

      {/* Status strip — context-aware italic sentence tied to the
          active picker mode. Pulled from the new HandStripStatus
          component below to keep the JSX tidy. */}
      <HandStripStatus />

      {/* Identity strip — compact player handle (swatch + name +
          distillery + hand count). Reputation used to live here too
          and carried `data-bb-zone="reputation"`; rep now sits as a
          64px gold numeral on the IdentityPlate next to the crest,
          so the spotlight anchor moved up there. */}
      <div className="flex items-center gap-3 border-b border-[#3b2818] px-[18px] py-1">
        <div className="flex items-center gap-2">
          <PlayerSwatch
            seatIndex={playerIndex}
            logoId={meta?.logoId}
            size="sm"
          />
          <div className="flex items-baseline gap-1.5 leading-tight">
            <span
              className="font-display text-[14px] font-semibold"
              style={{ color: "var(--ink)" }}
            >
              {focused.name}
            </span>
            <span
              className="font-mono text-[12px] uppercase tracking-[.12em]"
              style={{ color: "var(--mute)" }}
            >
              {focused.distillery?.name ?? "no distillery"} · hand{" "}
              {focused.hand.length}/{focused.handSize}
            </span>
          </div>
        </div>
      </div>

      {/* Main row: DeckPile (left) | hand cards (center) | DiscardPile +
          SoldStack (right). Mockup-style deck-builder layout. */}
      <div
        className="grid items-stretch gap-3 overflow-hidden px-[18px] py-2"
        style={{ gridTemplateColumns: "auto 1fr auto" }}
      >
        {/* Deck pile (left) */}
        <DramaticPile label="Deck" count={focused.deck.length} tone="amber" />

        {/* Hand cards (center, fills) — fan-arrange on a shallow arc */}
        <Section
          caption="your hand"
          count={handCards.length}
          grow
          zone="hand-resources"
        >
          {handCards.length === 0 ? (
            <EmptyPill>no cards</EmptyPill>
          ) : (
            <HandFan>
              {handCards.map((c, i) =>
                c.type === "labor" ? (
                  <LaborCard key={c.id} card={c} indexInRow={i} />
                ) : (
                  <ResourceCard key={c.id} card={c} indexInRow={i} />
                ),
              )}
            </HandFan>
          )}
        </Section>

        {/* Right cluster: Ops (if any) → Discard → Sold. Ops sits
            inline with the hand instead of in a separate strip below
            so the bottom of the screen doesn't grow another row. */}
        <div className="flex items-stretch gap-3">
          {focused.operationsHand.length > 0 ? (
            <div
              data-bb-zone="hand-ops"
              className="flex flex-col items-center justify-center gap-1 rounded-md border border-[#3b2818] bg-slate-950/40 px-2 py-1.5"
            >
              <span className="font-mono text-[11px] font-bold uppercase tracking-[.18em] text-amber-300/80">
                Ops · Pending
              </span>
              <div className="relative pointer-events-none">
                <div className="opacity-30 [filter:grayscale(1)_brightness(0.5)]">
                  <CardAccordion>
                    {focused.operationsHand.map((c, i) => (
                      <OpsCard key={c.id} card={c} indexInRow={i} />
                    ))}
                  </CardAccordion>
                </div>
                <div
                  className="pointer-events-none absolute inset-0 flex items-center justify-center"
                  aria-hidden
                >
                  <span className="rotate-[-8deg] rounded border-2 border-amber-400/80 bg-slate-950/90 px-2 py-0.5 font-mono text-[12px] font-bold uppercase tracking-[.16em] text-amber-200 shadow-[0_3px_12px_rgba(0,0,0,.65)]">
                    Pending
                  </span>
                </div>
              </div>
              <span className="font-mono text-[12px] uppercase tracking-[.14em] text-slate-500 tabular-nums">
                {focused.operationsHand.length} cards
              </span>
            </div>
          ) : null}
          <DramaticPile
            label="Discard"
            count={focused.discard.length}
            tone="rose"
            purchaseTarget
          />
          <SoldStack count={focused.barrelsSold} />
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// v3 status strip — context-aware italic line keyed off the active mode
// ─────────────────────────────────────────────────────────────────────

function HandStripStatus() {
  const { buyMode, ageMode, sellMode, drawBillMode, makeMode } = useGameStore();
  let activeKey: string | null = null;
  let label = "Idle";
  let msg = "Choose an action to continue your turn.";
  if (makeMode) {
    activeKey = "make";
    label = "Make";
    msg =
      "Pick the cards you want to commit, then click a slot in your rickhouse.";
  } else if (ageMode) {
    activeKey = "age";
    label = "Age";
    msg =
      "Pick an aging barrel and any hand card — either order, auto-confirms on second pick.";
  } else if (sellMode) {
    activeKey = "sell";
    label = "Sell";
    msg = "Click a saleable barrel to ship it.";
  } else if (buyMode) {
    activeKey = "buy";
    label = "Buy";
    msg = "Pick a market card and a payment from your hand.";
  } else if (drawBillMode) {
    activeKey = "draft";
    label = "Draft";
    msg = "Spend a card to seed the draft pile (initiate the Drafting Loop).";
  }
  const active = activeKey != null;
  return (
    <div
      className="border-b border-[#3b2818] px-[18px] py-[5px] font-display italic"
      style={{
        background: "rgba(20,14,8,.65)",
        fontSize: 13,
        letterSpacing: ".01em",
        color: active ? "var(--gold)" : "var(--ink-muted)",
      }}
    >
      <span
        className="label-sm mr-2.5"
        style={{ color: active ? "var(--gold)" : "var(--mute)" }}
      >
        {label}
      </span>
      {msg}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// v3 dramatic pile — stacked-card layers behind a big count
// ─────────────────────────────────────────────────────────────────────

function DramaticPile({
  label,
  count,
  tone,
  purchaseTarget = false,
}: {
  label: string;
  count: number;
  tone: "amber" | "rose";
  purchaseTarget?: boolean;
}) {
  const palette =
    tone === "amber"
      ? {
          ink: "#f0c970",
          edge: "rgba(240,201,112,.55)",
          glow: "rgba(240,201,112,.40)",
        }
      : {
          ink: "#d96b54",
          edge: "rgba(217,107,84,.45)",
          glow: "rgba(217,107,84,.35)",
        };
  return (
    <div
      className="relative flex flex-col items-center justify-end"
      style={{ width: 84, height: 142 }}
      data-purchase-target={purchaseTarget ? "discard" : undefined}
      title={`${label} · ${count} card${count === 1 ? "" : "s"}`}
    >
      {/* Stacked-card layers behind the top face */}
      {[8, 5, 2, 0].map((off, i) => (
        <span
          key={i}
          aria-hidden
          className="absolute mx-auto rounded-md"
          style={{
            bottom: off,
            left: 0,
            right: 0,
            width: 72,
            height: 108,
            margin: "0 auto",
            background:
              "linear-gradient(180deg, rgba(46,31,21,.95) 0%, rgba(20,14,8,.95) 100%)",
            border: `1px solid ${palette.edge}`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 ${4 + i}px ${10 + i * 2}px rgba(0,0,0,.55)`,
            opacity: 1 - i * 0.08,
          }}
        />
      ))}
      {/* Top face */}
      <div
        className="absolute flex flex-col items-center justify-between rounded-md"
        style={{
          bottom: 8,
          left: 6,
          right: 6,
          height: 108,
          padding: "10px 8px",
          background:
            "radial-gradient(120% 80% at 50% 0%, rgba(240,201,112,.10), transparent 60%), linear-gradient(180deg, #2a1a10, #14100a)",
          border: `1px solid ${palette.edge}`,
          boxShadow: `inset 0 1px 0 rgba(255,255,255,.10), 0 0 16px ${palette.glow}`,
        }}
      >
        <span
          className="label-sm"
          style={{ color: palette.ink, fontSize: 9 }}
        >
          {label}
        </span>
        <span
          className="font-display font-bold leading-none"
          style={{
            fontSize: 38,
            color: palette.ink,
            textShadow: `0 0 12px ${palette.glow}`,
          }}
        >
          {count}
        </span>
        <span
          className="label-sm"
          style={{ fontSize: 8.5, color: "var(--mute)" }}
        >
          cards
        </span>
      </div>
    </div>
  );
}

function SoldStack({ count }: { count: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center gap-1.5 rounded-md border border-dashed"
      style={{
        width: 84,
        height: 142,
        borderColor: "rgba(110,80,50,.45)",
        background: "rgba(20,14,8,.45)",
      }}
    >
      <span className="label-sm">Sold</span>
      <span
        className="font-display font-bold leading-none"
        style={{ fontSize: 32, color: "var(--ink)" }}
      >
        {count}
      </span>
      <span className="label-sm" style={{ fontSize: 8 }}>
        bottles
      </span>
    </div>
  );
}

/** Stable ordering inside the mixed Resources row. */
const SUBTYPE_ORDER: Record<string, number> = {
  cask: 1,
  corn: 2,
  rye: 3,
  barley: 4,
  wheat: 5,
};

/**
 * Two-card silhouette showing the player's deck + discard counts in the
 * dev-branch "cash" position. Self-contained — no clicks. The visuals
 * are intentionally minimal: a stacked deck back + the running totals.
 */
function DeckPile({ deckCount, discardCount }: { deckCount: number; discardCount: number }) {
  // Pulse the discard tile whenever its count grows (purchases land
  // here, sales drop spent + aging cards, etc.). Tracking the count
  // — not `lastPurchase.seq` — keeps the pulse focused on this
  // player's pile and naturally ignores bot purchases.
  const [pulseKey, setPulseKey] = useState(0);
  const prevCountRef = useRef(discardCount);
  useEffect(() => {
    if (discardCount > prevCountRef.current) {
      setPulseKey((k) => k + 1);
    }
    prevCountRef.current = discardCount;
  }, [discardCount]);
  return (
    <div className="flex flex-shrink-0 items-stretch gap-3">
      <div className="flex flex-col items-end justify-between py-1">
        <VerticalCaption>deck</VerticalCaption>
      </div>
      <div className="flex items-end gap-2">
        <PileTile label="Deck" count={deckCount} accent="emerald" />
        <PileTile
          label="Discard"
          count={discardCount}
          accent="amber"
          purchaseTarget
          pulseKey={pulseKey}
        />
      </div>
    </div>
  );
}

function PileTile({
  label,
  count,
  accent,
  purchaseTarget = false,
  pulseKey,
}: {
  label: string;
  count: number;
  accent: "emerald" | "amber";
  /** Marks this tile as the destination for `PurchaseFlight`. */
  purchaseTarget?: boolean;
  /** Bumped (via `lastPurchase.seq`) every time a card lands here. */
  pulseKey?: number;
}) {
  const palette =
    accent === "emerald"
      ? {
          border: "border-emerald-500/70",
          gradient:
            "bg-[linear-gradient(160deg,rgba(6,78,59,.65)_0%,rgba(15,23,42,.95)_75%)]",
          ink: "text-emerald-100",
          label: "text-emerald-300",
        }
      : {
          border: "border-amber-500/70",
          gradient:
            "bg-[linear-gradient(160deg,rgba(120,53,15,.65)_0%,rgba(15,23,42,.95)_75%)]",
          ink: "text-amber-100",
          label: "text-amber-300",
        };
  return (
    <div
      data-purchase-target={purchaseTarget ? "discard" : undefined}
      title={`${label} · ${count} card${count === 1 ? "" : "s"}`}
      className={[
        "relative flex flex-col items-center justify-between overflow-hidden rounded-md border-2 p-1.5 ring-1 ring-white/10",
        palette.border,
        palette.gradient,
        CARD_SIZE_CLASS,
      ].join(" ")}
    >
      {/* Faux stacked-cards depth */}
      <span
        className={`pointer-events-none absolute inset-2 rounded border ${palette.border} opacity-60`}
        aria-hidden
      />
      <span
        className={`pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent`}
        aria-hidden
      />
      {/* Pulse overlay — flashes on every fresh `pulseKey`. Re-keying
          the element re-runs the keyframe so back-to-back purchases
          each get their own flash. */}
      {pulseKey != null ? (
        <span
          key={`pulse-${pulseKey}`}
          className="pointer-events-none absolute inset-0 rounded-md ring-4 ring-amber-300/0 pile-pulse"
          aria-hidden
        />
      ) : null}
      <span className={`mt-0.5 font-mono text-[12px] font-semibold uppercase tracking-[.18em] ${palette.label}`}>
        {label}
      </span>
      <span
        key={pulseKey != null ? `count-${pulseKey}` : undefined}
        className={[
          "font-display text-[40px] font-bold leading-none tabular-nums drop-shadow-[0_3px_6px_rgba(0,0,0,.55)]",
          palette.ink,
          pulseKey != null ? "pile-count-bump" : "",
        ].join(" ")}
      >
        {count}
      </span>
      <span className={`mb-0.5 font-mono text-[11px] uppercase tracking-[.14em] ${palette.label}`}>
        cards
      </span>
      <style>{`
        @keyframes pile-pulse-kf {
          0% { box-shadow: 0 0 0 0 rgba(252, 211, 77, 0); transform: scale(1); }
          30% { box-shadow: 0 0 24px 6px rgba(252, 211, 77, 0.55); transform: scale(1.04); }
          100% { box-shadow: 0 0 0 0 rgba(252, 211, 77, 0); transform: scale(1); }
        }
        .pile-pulse {
          animation: pile-pulse-kf 720ms ease-out 380ms both;
        }
        @keyframes pile-count-bump-kf {
          0% { transform: scale(1); }
          50% { transform: scale(1.18); color: rgb(253, 230, 138); }
          100% { transform: scale(1); }
        }
        .pile-count-bump {
          animation: pile-count-bump-kf 520ms ease-out 480ms both;
        }
      `}</style>
    </div>
  );
}

function focusedPlayer(state: GameState): PlayerState | null {
  if (state.players.length === 0) return null;
  const human = state.players.find((p) => !p.isBot);
  if (human) return human;
  if (state.phase === "action") {
    return state.players[state.currentPlayerIndex] ?? state.players[0]!;
  }
  return state.players[0]!;
}

/**
 * Slim tray shown to multiplayer observers (visitors who joined a
 * room without claiming a seat). Replaces the full hand UI so we
 * don't accidentally leak someone else's cards into the spectator's
 * view; the action board above stays fully visible.
 */
function SpectatorTray() {
  return (
    <div className="border-t border-slate-800 bg-slate-950/90 px-[18px] py-3 text-center">
      <p className="font-mono text-[13px] uppercase tracking-[.18em] text-slate-400">
        ðŸ‘ Spectating
      </p>
      <p className="mt-1 text-[12px] text-slate-400">
        Claim an open seat from the room banner to play.
      </p>
    </div>
  );
}

// -----------------------------
// Layout helpers
// -----------------------------

function Section({
  caption,
  count,
  grow = false,
  zone,
  children,
}: {
  caption: string;
  count?: number;
  /** When true, the section expands to absorb the remaining row width. */
  grow?: boolean;
  /** Picker-focus zone token; when set, dims when not the focused zone. */
  zone?: FocusZone;
  children: React.ReactNode;
}) {
  const focusClass = useZoneFocusClass(zone ?? "hand-resources");
  const focusStyle = useZoneFocusStyle(zone ?? "hand-resources");
  const applyFocus = zone != null;
  return (
    <div
      data-zone={zone}
      className={[
        "flex items-stretch gap-2",
        grow ? "min-w-0 flex-1" : "flex-shrink-0",
        applyFocus ? focusClass : "",
      ].join(" ")}
      style={applyFocus ? focusStyle : undefined}
    >
      <div className="flex flex-col items-end justify-between py-1">
        <VerticalCaption>{caption}</VerticalCaption>
        {count !== undefined ? (
          <span className="font-mono text-[12px] uppercase tracking-[.12em] tabular-nums text-slate-600">
            {count}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

function VerticalCaption({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="self-stretch font-mono text-[12px] uppercase tracking-[.12em] text-slate-500"
      style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
    >
      {children}
    </span>
  );
}

function Divider() {
  return (
    <span
      className="block w-px flex-shrink-0 self-stretch bg-slate-800"
      aria-hidden
    />
  );
}

function EmptyPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="self-center rounded border border-dashed border-slate-700 px-2.5 py-1 font-mono text-[13px] italic text-slate-500">
      {children}
    </span>
  );
}

/**
 * Spread row — children sit side-by-side with a small gap so every
 * card is fully readable without hover. Kept for the ops "pending"
 * row, where the flat overlap matches the muted treatment. Hand cards
 * use `HandFan` instead.
 */
function CardAccordion({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-end overflow-x-auto py-2 pl-2 pr-3">
      <div className="flex min-w-0 items-end gap-2">{children}</div>
    </div>
  );
}

/**
 * Fan-arrange a hand of cards on a shallow arc per the v3 design.
 * Each child sits in an absolutely-positioned `.hand-fan-card` slot
 * with inline `transform: translateY(...) rotate(...)`. CSS picks up
 * the hover override (translateY(-22px) scale(1.04) rotate(0)) to
 * pull the focused card upright at z-index 40.
 *
 * Card width assumed at 100px (matches `CARD_SIZE_CLASS`); the slot
 * "stride" (visible width per card after overlap) is 70px, giving a
 * 30px overlap so an 8-card hand fits comfortably under 800px.
 *
 * Slots stretch the container to `(n - 1) * stride + cardW`, which
 * the parent flex centers via `justify-center`.
 */
function HandFan({ children }: { children: React.ReactNode }) {
  const slots = React.Children.toArray(children);
  const n = slots.length;
  const cardW = 100;
  const stride = 70; // visible width per slot after overlap
  const totalW = n > 0 ? (n - 1) * stride + cardW : 0;
  const mid = (n - 1) / 2;
  return (
    <div className="relative flex min-w-0 flex-1 items-end justify-center py-2 pl-2 pr-3">
      <div
        style={{
          position: "relative",
          width: totalW,
          height: 156,
        }}
      >
        {slots.map((child, i) => {
          const off = i - mid;
          const rot = off * 3.2;
          const lift = Math.abs(off) * 2.4;
          const x = i * stride;
          return (
            <div
              key={
                React.isValidElement(child) && child.key != null
                  ? child.key
                  : i
              }
              className="hand-fan-card"
              style={{
                left: x,
                width: cardW,
                transform: `translateY(${lift}px) rotate(${rot}deg)`,
                zIndex: i,
              }}
            >
              {child}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="flex items-baseline gap-1">
      <span>{label}</span>
      <span className="font-sans text-[12px] tabular-nums text-slate-200">
        {value}
      </span>
    </span>
  );
}

// -----------------------------
// Mini cards
// -----------------------------

const baseCardChrome = `relative flex flex-shrink-0 flex-col overflow-hidden rounded-md border-2 p-1.5 text-left shadow-[0_4px_12px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-all duration-200 ${CARD_SIZE_CLASS}`;

const liftClass =
  "cursor-pointer hover:z-50 hover:-translate-y-3 hover:scale-[1.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300";

function ResourceCard({ card, indexInRow }: { card: Card; indexInRow: number }) {
  const {
    state,
    setInspect,
    buyMode,
    toggleBuySpend,
    ageMode,
    setAgeCard,
    drawBillMode,
    toggleDrawBillSpend,
    makeMode,
    toggleMakeSpend,
    sellMode,
    dragMake,
    startDragMake,
    endDragMake,
    selectedHandCardIds,
    toggleHandSelection,
    commitHandCardImmediate,
    tutorialHandFilter,
  } = useGameStore();
  // Tutorial gate — when an await-action beat narrows the hand (e.g.
  // "resource cards only" for a Make commit), cards that don't pass
  // the predicate mute and become inspect-only. Cards that DO pass
  // get a soft amber tutorial highlight.
  const tutorialLocked = tutorialHandFilter ? !tutorialHandFilter(card) : false;
  const tutorialHighlighted = tutorialHandFilter
    ? tutorialHandFilter(card)
    : false;
  const subtype = card.subtype as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  const count = card.resourceCount ?? 1;
  const cost = card.cost ?? 1;
  const inBuyMode = buyMode != null;
  const inAgeMode = ageMode != null;
  const inDrawBillMode = drawBillMode != null;
  const inMakeMode = makeMode != null;
  const inSellMode = sellMode != null;
  const isBuySelected = inBuyMode && buyMode!.spendCardIds.includes(card.id);
  const isAgeSelected = inAgeMode && ageMode!.pickedCardId === card.id;
  const isDrawSelected =
    inDrawBillMode && drawBillMode!.spendCardIds.includes(card.id);
  const isMakeSelected = inMakeMode && makeMode!.spendCardIds.includes(card.id);
  // v2.10: sell mode no longer has a per-card pick — barrel click
  // auto-fires the sale. Kept the flag so isSellSelected uniformly
  // resolves to false without restructuring the boolean ladder.
  const isSellSelected = false;
  const inAnyPicker = inBuyMode || inAgeMode || inDrawBillMode || inMakeMode || inSellMode;
  // v2.10 multi-select — only meaningful when no picker mode is open;
  // the pickers own selection semantics themselves.
  const isMultiSelected = !inAnyPicker && selectedHandCardIds.includes(card.id);
  const isSelected =
    isBuySelected || isAgeSelected || isDrawSelected || isMakeSelected || isSellSelected || isMultiSelected;
  // v2.14: the draft-initiate picker is a one-step single-card flow —
  // no "step 1 / step 2" distinction. Kept as `drawStep1 = false` so
  // the downstream click-routing path below (which gates seed-tagging
  // on `!drawStep1`) keeps working without renames.
  const drawStep1 = false;
  void drawBillMode;
  // v3.4: when in buy mode WITH a picked target, resource cards can
  // never contribute to payment (only Labor cards can), so they dim
  // out of the way. When no target is picked yet, fall back to the
  // generic "you're in a picker" soft emerald.
  // Dimming uses inline style (not Tailwind utility) because Turbopack
  // + Tailwind v4 wasn't generating opacity-30 / saturate-50 / arbitrary
  // values for these strings at build time — inline `style` is robust.
  const buyTargetPicked = inBuyMode && buyMode!.pickedTarget != null;
  const buyIneligible = buyTargetPicked && !isBuySelected;
  const buyClass = tutorialLocked
    ? "pointer-events-none"
    : tutorialHighlighted && !inAnyPicker && !isMultiSelected
      ? // Soft amber highlight on the cards the active beat wants the
        // player to act on. Skipped when the player has already toggled
        // multi-select on this card (the louder amber-4 ring takes over).
        "ring-2 ring-amber-300/70 shadow-[0_0_12px_rgba(252,211,77,.4)]"
      : !inAnyPicker
        ? isMultiSelected
          ? // v2.10 multi-select — same amber chrome the picker modes use,
            // so the visual is consistent regardless of how the player
            // selected (mode picker or persistent selection).
            "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
          : ""
        : drawStep1
          ? ""
          : isSelected
            ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
            : buyIneligible
              ? "pointer-events-none"
              : inAgeMode
                ? // v2.9: every hand card is a legal age payment, so light
                  // them all up with a soft sky glow — same idiom as the
                  // ageable rickhouse barrels — so the player can see at a
                  // glance that ANY card here commits.
                  "ring-2 ring-sky-300 shadow-[0_0_12px_rgba(125,211,252,.4)]"
                : inDrawBillMode
                  ? "ring-2 ring-sky-400/60"
                  : inSellMode
                    ? "ring-2 ring-amber-300/60"
                    : "ring-2 ring-emerald-400/60";
  const dimStyle =
    tutorialLocked || buyIneligible
      ? { opacity: 0.3, filter: "saturate(0.5)" as const, transition: "none" as const }
      : undefined;
  const onClick = (e: React.MouseEvent) => {
    if (tutorialLocked) {
      setInspect({ kind: "resource", card });
      return;
    }
    // v3 double-click commit: if this is the second click of a fast
    // pair, skip the toggle so the dblclick handler can fire the
    // commit cleanly. Single clicks (detail===1) still toggle.
    if (e.detail >= 2) return;
    if (inMakeMode) toggleMakeSpend(card.id);
    else if (inDrawBillMode && !drawStep1) toggleDrawBillSpend(card.id);
    else if (inAgeMode) setAgeCard(card.id);
    else if (inBuyMode) toggleBuySpend(card.id);
    // v2.10: sell mode is barrel-only; clicks in hand ignore.
    else if (inSellMode) { /* no-op */ }
    // v2.10: outside any picker, left-click toggles the persistent
    // multi-select. Right-click handles inspect (see onContextMenu).
    else toggleHandSelection(card.id);
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    if (tutorialLocked) return;
    e.preventDefault();
    e.stopPropagation();
    commitHandCardImmediate(card.id);
  };
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setInspect({ kind: "resource", card });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
      // v2.6: hand cards are drag sources for the "drag onto a slot
      // barrel to commit" shortcut. v2.10: drag carries the entire
      // multi-select group when this card is part of one. Only
      // active when no picker mode is open (those flows handle
      // selection their own way).
      draggable={!inAnyPicker && !tutorialLocked}
      onDragStart={(e) => {
        const ids =
          isMultiSelected && selectedHandCardIds.length > 0
            ? selectedHandCardIds
            : [card.id];
        setMakeDragPayload(e, ids);
        startDragMake(ids);
      }}
      onDragEnd={endDragMake}
      data-bb-hand-card
      data-card-id={card.id}
      data-drag-source={dragMake === card.id ? "active" : undefined}
      title={
        inMakeMode
          ? `${isMakeSelected ? "Unselect" : "Tag"} this card · double-click to commit it solo`
          : inDrawBillMode
            ? `${isDrawSelected ? "Unselect" : "Sacrifice"} this card to draw the top mash bill`
            : inAgeMode
              ? `${isAgeSelected ? "Unselect" : "Commit"} this card to age the picked barrel · double-click for instant commit`
              : inBuyMode
                ? `${isBuySelected ? "Unselect" : "Select"} this card to pay B$1`
                : inSellMode
                  ? `${isSellSelected ? "Unselect" : "Spend"} this card as the sell-action cost · double-click for instant commit`
                  : `${RESOURCE_LABEL[subtype]}${count > 1 ? ` · counts as ${count}` : ""} — left-click to ${isMultiSelected ? "uncheck" : "check"}, drag the group onto a slot, right-click to inspect`
      }
      className={[
        baseCardChrome,
        chrome.gradient,
        chrome.border,
        overlap,
        liftClass,
        buyClass,
        isSelected ? "bb-hand-selected" : "",
      ].join(" ")}
      style={dimStyle}
    >
      {isSelected ? (
        <span
          className="pointer-events-none absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-slate-950 text-[12px] font-bold shadow-md"
          aria-hidden
        >
          ✓
        </span>
      ) : (
        <CornerCost cost={cost} />
      )}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-center px-7">
        <span className={`text-[13px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          {RESOURCE_LABEL[subtype]}
        </span>
        {count > 1 ? (
          <span className={`ml-1 rounded border px-1 py-px font-mono text-[11px] font-bold uppercase tracking-[.10em] ${chrome.borderSoft} ${chrome.ink}`}>
            ×{count}
          </span>
        ) : null}
      </div>
      <h4 className={`mt-1 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.displayName ?? (count > 1 ? `${count}× ${RESOURCE_LABEL[subtype]}` : RESOURCE_LABEL[subtype])}
      </h4>
      {card.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[11px] italic leading-snug ${chrome.label} opacity-90`}>
          {card.flavor}
        </p>
      ) : null}
      <div
        className={`mt-auto grid h-9 w-9 self-center place-items-center rounded-full border-2 bg-white/10 text-lg shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm ${chrome.border} ${chrome.ink}`}
      >
        {RESOURCE_GLYPH[subtype]}
      </div>
    </button>
  );
}


// `MashBillCard` deleted in v2.6 — bills no longer enter the hand;
// they live in rickhouse slots from draw to sale. The component went
// dormant when `Section caption="Bills"` was removed and stayed
// orphaned until this cleanup pass.

/**
 * Labor card renderer. Labor cards are a separate `type` from
 * resource — they have no `subtype`, so the resource chrome lookup
 * would crash. Layout is centered title + glyph + flavor on the
 * slate `LABOR_CHROME` palette. Generic Labor contributes +1 toward
 * any purchase; Specialty Labor (Marketing / Cooper / Architect)
 * contributes +2 in its matching domain. Both
 * variants are also legal as aging-commit cards.
 */
function LaborCard({ card, indexInRow }: { card: Card; indexInRow: number }) {
  const {
    state,
    setInspect,
    buyMode,
    toggleBuySpend,
    ageMode,
    setAgeCard,
    drawBillMode,
    toggleDrawBillSpend,
    makeMode,
    sellMode,
    selectedHandCardIds,
    toggleHandSelection,
    tutorialHandFilter,
  } = useGameStore();
  const tutorialLocked = tutorialHandFilter ? !tutorialHandFilter(card) : false;
  const tutorialHighlighted = tutorialHandFilter ? tutorialHandFilter(card) : false;
  const chrome = LABOR_CHROME;
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  const contribution = card.laborContribution ?? 1;
  const subtypeLabel =
    card.laborSubtype === "marketing"
      ? "Marketing"
      : card.laborSubtype === "cooper"
        ? "Cooper"
        : card.laborSubtype === "architect"
          ? "Architect"
          : "Worker";
  const cost = card.cost ?? 1;
  const inBuyMode = buyMode != null;
  const inAgeMode = ageMode != null;
  const inDrawBillMode = drawBillMode != null;
  const inMakeMode = makeMode != null;
  const inSellMode = sellMode != null;
  const inAnyPicker = inBuyMode || inAgeMode || inDrawBillMode || inMakeMode || inSellMode;
  const isBuySelected = inBuyMode && buyMode!.spendCardIds.includes(card.id);
  const isAgeSelected = inAgeMode && ageMode!.pickedCardId === card.id;
  const isDrawSelected = inDrawBillMode && drawBillMode!.spendCardIds.includes(card.id);
  const isMultiSelected = !inAnyPicker && selectedHandCardIds.includes(card.id);
  const isSelected = isBuySelected || isAgeSelected || isDrawSelected || isMultiSelected;
  // v3.4: in buy mode WITH a picked target, a Labor card is eligible
  // iff its `laborContribution` for the target's domain is > 0.
  // Eligible Labor stays lit emerald; ineligible (wrong-domain
  // specialty) dims out so the player sees what can actually pay.
  let buyEligibleAndUnpicked = false;
  let buyIneligibleAndUnpicked = false;
  if (inBuyMode && !isBuySelected) {
    const pickedSlot = buyMode!.pickedTarget;
    if (pickedSlot != null) {
      const target = state?.market[pickedSlot.slotIndex];
      if (target) {
        const domain = buyDomainForTarget(target);
        if (laborContribution(card, domain) > 0) {
          buyEligibleAndUnpicked = true;
        } else {
          buyIneligibleAndUnpicked = true;
        }
      }
    }
  }
  // v3.8: Labor cards can never satisfy a mash-bill recipe — dim them
  // in Make mode the same way Buy mode dims ineligible cards. Mirrors
  // the symmetric "what's clickable right now" affordance.
  const makeIneligible = inMakeMode;
  const buyClass = tutorialLocked
    ? "pointer-events-none"
    : tutorialHighlighted && !inAnyPicker && !isMultiSelected
      ? "ring-2 ring-amber-300/70 shadow-[0_0_12px_rgba(252,211,77,.4)]"
      : isSelected
        ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
        : buyIneligibleAndUnpicked || makeIneligible
          ? "pointer-events-none"
          : buyEligibleAndUnpicked
            ? "ring-2 ring-emerald-400/80 shadow-[0_0_14px_rgba(110,231,183,.5)]"
            : inAgeMode
              ? "ring-2 ring-sky-300 shadow-[0_0_12px_rgba(125,211,252,.4)]"
              : inDrawBillMode
                ? "ring-2 ring-sky-400/60"
                : inBuyMode
                  ? "ring-2 ring-emerald-400/60"
                  : "";
  const dimStyle =
    tutorialLocked || buyIneligibleAndUnpicked || makeIneligible
      ? { opacity: 0.3, filter: "saturate(0.5)" as const, transition: "none" as const }
      : undefined;
  const onClick = (e: React.MouseEvent) => {
    if (tutorialLocked) return;
    if (e.detail >= 2) return;
    if (inBuyMode) toggleBuySpend(card.id);
    else if (inDrawBillMode) toggleDrawBillSpend(card.id);
    else if (inAgeMode) setAgeCard(card.id);
    else if (!inAnyPicker) toggleHandSelection(card.id);
  };
  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setInspect({ kind: "labor", card });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${subtypeLabel} Labor — contributes +${contribution} toward matching-domain purchases. Generic Labor also ages barrels.`}
      className={[
        baseCardChrome,
        chrome.gradient,
        chrome.border,
        overlap,
        liftClass,
        buyClass,
        isSelected ? "bb-hand-selected" : "",
      ].join(" ")}
      style={dimStyle}
    >
      {isSelected ? (
        <span
          className="pointer-events-none absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-slate-950 text-[12px] font-bold shadow-md"
          aria-hidden
        >
          ✓
        </span>
      ) : (
        <CornerCost cost={cost} />
      )}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-center px-7">
        <span className={`text-[13px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Labor
        </span>
      </div>
      <h4 className={`mt-0.5 line-clamp-1 font-display text-[14px] font-bold leading-tight ${chrome.ink}`}>
        {card.displayName ?? subtypeLabel}
      </h4>
      {card.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[11px] italic leading-snug ${chrome.label} opacity-90`}>
          {card.flavor}
        </p>
      ) : null}
      <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
        <span
          aria-hidden
          className="font-emoji text-[28px] leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]"
        >
          {laborGlyphFor(card.laborSubtype)}
        </span>
        <span className={`mt-1 font-mono text-[12px] uppercase tracking-[.18em] ${chrome.label}`}>
          +{contribution} · {subtypeLabel === "Worker" ? "any buy" : subtypeLabel.toLowerCase()}
        </span>
      </div>
    </button>
  );
}

function OpsCard({ card, indexInRow }: { card: OperationsCard; indexInRow: number }) {
  const { setInspect } = useGameStore();
  const chrome = OPS_CHROME;
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  return (
    <button
      type="button"
      onClick={() => setInspect({ kind: "operations", card })}
      title={`${card.name} — ${card.description}`}
      className={[baseCardChrome, chrome.gradient, chrome.border, overlap, liftClass].join(" ")}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />
      <div className="flex items-baseline justify-between">
        <span className={`text-[13px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Ops
        </span>
      </div>
      <h4 className={`mt-1 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.name}
      </h4>
      {card.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[11px] italic leading-snug ${chrome.label} opacity-90`}>
          {card.flavor}
        </p>
      ) : null}
      <div className={`mt-auto grid h-9 w-9 self-center place-items-center rounded-full border-2 bg-white/10 text-lg font-bold ${chrome.border} ${chrome.ink}`}>
        ⚡
      </div>
    </button>
  );
}
