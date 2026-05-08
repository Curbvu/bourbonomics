"use client";

/**
 * HandTray — bottom-of-canvas strip showing the focused player's hand.
 *
 * Visual idiom ported from the dev branch: every hand item is a
 * portrait-oriented mini card (112×128) with a type-coloured gradient,
 * a centered glyph, and an accordion-fan layout (cards overlap left-to-
 * right; hover lifts and lifts to z-50). Three sections are stacked:
 * Resources / Capital / Bourbon-bills · Ops / Reputation summary.
 *
 * v2 is computer-driven during the action phase, so cards aren't click
 * targets — they're informational. The setup-phase modals own all human
 * input.
 */

import { useEffect, useRef, useState } from "react";
import {
  paymentValue,
  type Card,
  type GameState,
  type OperationsCard,
  type PlayerState,
  type ResourceSubtype,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import ActionBar from "./ActionBar";
import BuyOverlay from "./BuyOverlay";
import AgeOverlay from "./AgeOverlay";
import DrawBillOverlay from "./DrawBillOverlay";
import MakeOverlay from "./MakeOverlay";
import SellOverlay from "./SellOverlay";
import PlayerSwatch from "./PlayerSwatch";
import { CornerCost, CornerValue } from "./cardCorners";
import { setMakeDragPayload } from "./dragMake";
import { useZoneFocusClass, type FocusZone } from "./pickerFocus";
import {
  CAPITAL_CHROME,
  CARD_SIZE_CLASS,
  HAND_CARD_OVERLAP,
  OPS_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
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

  // Capital is a resource — render them in a single mixed row, sorted
  // so the row reads consistently (capital first, then by subtype).
  const handCards = [...focused.hand].sort((a, b) => {
    const order = (c: typeof a) =>
      c.type === "capital" ? 0 : SUBTYPE_ORDER[c.subtype ?? "cask"] ?? 99;
    return order(a) - order(b);
  });

  return (
    <div data-hand-tray="true" className="border-t border-slate-800 bg-slate-950/90">
      {/* Interactive Buy mode — sticky bar above the action bar; only
          paints when the player has clicked Buy market. */}
      <BuyOverlay />
      {/* Interactive Age mode — same idiom; only paints when the player
          has clicked "Age barrel" and is picking a barrel + pay-card. */}
      <AgeOverlay />
      {/* Interactive Sell mode — auto-fires once both barrel and spend
          card are picked. Status bar shows the running rep estimate. */}
      <SellOverlay />
      {/* Interactive Draw-bill mode — single-select card-pay picker;
          blind draw of the top mash bill. */}
      <DrawBillOverlay />
      {/* Interactive Make mode — pick a mash bill, then tag the cards
          to commit. */}
      <MakeOverlay />
      {/* Action bar — controls for the human seat during the action phase. */}
      <ActionBar />

      {/* Identity + reputation strip — compacted: smaller logo, single
          line for everything, slimmer Y padding. */}
      <div className="flex items-center gap-3 border-b border-slate-900 px-[18px] py-1">
        <div className="flex items-center gap-2">
          <PlayerSwatch
            seatIndex={playerIndex}
            logoId={meta?.logoId}
            size="sm"
          />
          <div className="flex items-baseline gap-1.5 leading-tight">
            <span className="font-display text-[14px] font-semibold text-slate-100">
              {focused.name}
            </span>
            <span className="font-mono text-[9px] uppercase tracking-[.12em] text-slate-500">
              {focused.distillery?.name ?? "no distillery"} · hand {focused.hand.length}/{focused.handSize}
            </span>
          </div>
        </div>
        <span className="mx-1 h-[20px] w-px bg-slate-800" aria-hidden />
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-[9px] uppercase tracking-[.18em] text-amber-300/80">
            Rep
          </span>
          <span className="font-display text-[22px] font-bold leading-none tabular-nums text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,.55)]">
            {focused.reputation}
          </span>
        </div>
        <span className="flex-1" />
        <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[.10em] text-slate-500">
          <Stat label="deck" value={focused.deck.length} />
          <Stat label="disc" value={focused.discard.length} />
          <Stat label="sold" value={focused.barrelsSold} />
          {/* v2.6: unlockedGoldBourbons removed — Gold awards now manipulate slots. */}
        </div>
      </div>

      {/* Card sections — laid out left-to-right with the deck pile
          anchored at the far-left, and the (mixed) Resources accordion
          taking the remaining space. No horizontal scrollbar: the
          accordion clips overflow and the cards fan tighter via
          HAND_CARD_OVERLAP. */}
      <div className="flex items-stretch gap-[10px] overflow-hidden px-[14px] py-1.5">
        {/* Deck pile — far left. Two stacked counters: deck + discard. */}
        <DeckPile deckCount={focused.deck.length} discardCount={focused.discard.length} />

        <Divider />

        {/* Resources (capital folded in — capital is a resource). Takes
            the remaining space; flex-1 + min-w-0 lets it shrink instead
            of overflowing the row. */}
        <Section caption="resources" count={handCards.length} grow zone="hand-resources">
          {handCards.length === 0 ? (
            <EmptyPill>no cards</EmptyPill>
          ) : (
            <CardAccordion>
              {handCards.map((c, i) =>
                c.type === "capital" ? (
                  <CapitalCard key={c.id} card={c} indexInRow={i} />
                ) : (
                  <ResourceCard key={c.id} card={c} indexInRow={i} />
                ),
              )}
            </CardAccordion>
          )}
        </Section>

        <Divider />

        {/* v2.6: bills no longer live in the hand. They're slot-bound
            from the moment they're drawn and rendered on each
            rickhouse slot in `RickhouseRow`. */}

        {/* Operations — pending future release: hand display kept for
            visual consistency but rendered fully greyscale + dim with
            an overlay sash so the "feature off" status reads at a glance. */}
        <Section caption="ops · pending" count={focused.operationsHand.length} zone="hand-ops">
          <div className="relative pointer-events-none [filter:grayscale(1)_brightness(0.5)] opacity-30">
            {focused.operationsHand.length === 0 ? (
              <EmptyPill>pending future release</EmptyPill>
            ) : (
              <CardAccordion>
                {focused.operationsHand.map((c, i) => (
                  <OpsCard key={c.id} card={c} indexInRow={i} />
                ))}
              </CardAccordion>
            )}
            <div
              className="pointer-events-none absolute inset-0 flex items-center justify-center [filter:grayscale(0)] opacity-100"
              aria-hidden
            >
              <span className="rotate-[-8deg] rounded border-2 border-amber-400/80 bg-slate-950/85 px-2.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[.16em] text-amber-200 shadow-[0_3px_12px_rgba(0,0,0,.65)]">
                Pending
              </span>
            </div>
          </div>
        </Section>
      </div>
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
      <span className={`mt-0.5 font-mono text-[9px] font-semibold uppercase tracking-[.18em] ${palette.label}`}>
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
      <span className={`mb-0.5 font-mono text-[8px] uppercase tracking-[.14em] ${palette.label}`}>
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
      <p className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-400">
        👁 Spectating
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
  const applyFocus = zone != null;
  return (
    <div
      data-zone={zone}
      className={[
        "flex items-stretch gap-2",
        grow ? "min-w-0 flex-1" : "flex-shrink-0",
        applyFocus ? focusClass : "",
      ].join(" ")}
    >
      <div className="flex flex-col items-end justify-between py-1">
        <VerticalCaption>{caption}</VerticalCaption>
        {count !== undefined ? (
          <span className="font-mono text-[9px] uppercase tracking-[.12em] tabular-nums text-slate-600">
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
      className="self-stretch font-mono text-[10px] uppercase tracking-[.12em] text-slate-500"
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
    <span className="self-center rounded border border-dashed border-slate-700 px-2.5 py-1 font-mono text-[11px] italic text-slate-500">
      {children}
    </span>
  );
}

/**
 * Spread row — children sit side-by-side with a small gap so every
 * card is fully readable without hover. The outer wrapper allows the
 * row to overflow horizontally when the hand grows past the available
 * width (rather than crushing the cards into an accordion fan).
 */
function CardAccordion({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-1 items-end overflow-x-auto py-2 pl-2 pr-3">
      <div className="flex min-w-0 items-end gap-2">{children}</div>
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
    setSellSpendCard,
    dragMake,
    startDragMake,
    endDragMake,
  } = useGameStore();
  const subtype = card.subtype as ResourceSubtype;
  const chrome = RESOURCE_CHROME[subtype];
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
  const count = card.resourceCount ?? 1;
  const value = paymentValue(card);
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
  const isSellSelected = inSellMode && sellMode!.pickedSpendCardId === card.id;
  const isSelected =
    isBuySelected || isAgeSelected || isDrawSelected || isMakeSelected || isSellSelected;
  const inAnyPicker = inBuyMode || inAgeMode || inDrawBillMode || inMakeMode || inSellMode;
  // In draw-bill step 1 (no target picked yet), hand cards are NOT
  // tag-clickable — only the bourbon row is. Click should fall through
  // to inspect.
  const drawStep1 =
    inDrawBillMode &&
    !drawBillMode!.blind &&
    !drawBillMode!.pickedMashBillId;
  const buyClass = !inAnyPicker || drawStep1
    ? ""
    : isSelected
      ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
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
  const onClick = () => {
    if (inMakeMode) toggleMakeSpend(card.id);
    else if (inDrawBillMode && !drawStep1) toggleDrawBillSpend(card.id);
    else if (inAgeMode) setAgeCard(card.id);
    else if (inBuyMode) toggleBuySpend(card.id);
    else if (inSellMode) setSellSpendCard(card.id);
    else setInspect({ kind: "resource", card });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      // v2.6: hand cards are drag sources for the "drag onto a slot
      // barrel to commit" shortcut. Only active when no picker mode
      // is open (otherwise the click flow handles selection).
      draggable={!inAnyPicker}
      onDragStart={(e) => {
        setMakeDragPayload(e, card.id);
        startDragMake(card.id);
      }}
      onDragEnd={endDragMake}
      data-bb-hand-card
      data-drag-source={dragMake === card.id ? "active" : undefined}
      title={
        inMakeMode
          ? `${isMakeSelected ? "Unselect" : "Tag"} this card for production`
          : inDrawBillMode
            ? `${isDrawSelected ? "Unselect" : "Sacrifice"} this card to draw the top mash bill`
            : inAgeMode
              ? `${isAgeSelected ? "Unselect" : "Commit"} this card to age the picked barrel`
              : inBuyMode
                ? `${isBuySelected ? "Unselect" : "Select"} this card to pay B$1`
                : inSellMode
                  ? `${isSellSelected ? "Unselect" : "Spend"} this card as the sell-action cost`
                  : `${RESOURCE_LABEL[subtype]}${count > 1 ? ` · counts as ${count}` : ""} — drag onto a barrel to commit, or click to inspect`
      }
      className={[baseCardChrome, chrome.gradient, chrome.border, overlap, liftClass, buyClass].join(" ")}
    >
      <CornerValue value={value} />
      {isSelected ? (
        <span
          className="pointer-events-none absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold shadow-md"
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
        <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          {RESOURCE_LABEL[subtype]}
        </span>
        {count > 1 ? (
          <span className={`ml-1 rounded border px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[.10em] ${chrome.borderSoft} ${chrome.ink}`}>
            ×{count}
          </span>
        ) : null}
      </div>
      <h4 className={`mt-1 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.displayName ?? (count > 1 ? `${count}× ${RESOURCE_LABEL[subtype]}` : RESOURCE_LABEL[subtype])}
      </h4>
      {card.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[8.5px] italic leading-snug ${chrome.label} opacity-90`}>
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

function CapitalCard({ card, indexInRow }: { card: Card; indexInRow: number }) {
  const {
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
    setSellSpendCard,
    dragMake,
    startDragMake,
    endDragMake,
  } = useGameStore();
  const value = paymentValue(card);
  const cost = card.cost ?? card.capitalValue ?? 1;
  const chrome = CAPITAL_CHROME;
  const overlap = indexInRow === 0 ? "" : HAND_CARD_OVERLAP;
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
  const isSellSelected = inSellMode && sellMode!.pickedSpendCardId === card.id;
  const isSelected =
    isBuySelected || isAgeSelected || isDrawSelected || isMakeSelected || isSellSelected;
  const inAnyPicker = inBuyMode || inAgeMode || inDrawBillMode || inMakeMode || inSellMode;
  const drawStep1 =
    inDrawBillMode &&
    !drawBillMode!.blind &&
    !drawBillMode!.pickedMashBillId;
  const buyClass = !inAnyPicker || drawStep1
    ? ""
    : isSelected
      ? "ring-4 ring-amber-300 ring-offset-1 ring-offset-slate-950 shadow-[0_0_24px_rgba(252,211,77,.55)]"
      : inAgeMode
        ? // Match the resource-card age glow so capitals don't look
          // second-class as age payments — they're equally valid.
          "ring-2 ring-sky-300 shadow-[0_0_12px_rgba(125,211,252,.4)]"
        : inDrawBillMode
          ? "ring-2 ring-sky-400/60"
          : inSellMode
            ? "ring-2 ring-amber-300/60"
            : "ring-2 ring-emerald-400/60";
  const onClick = () => {
    if (inMakeMode) toggleMakeSpend(card.id);
    else if (inDrawBillMode && !drawStep1) toggleDrawBillSpend(card.id);
    else if (inAgeMode) setAgeCard(card.id);
    else if (inBuyMode) toggleBuySpend(card.id);
    else if (inSellMode) setSellSpendCard(card.id);
    else setInspect({ kind: "capital", card });
  };
  return (
    <button
      type="button"
      onClick={onClick}
      // v2.6: hand cards are drag sources for the "drag onto a slot
      // barrel to commit" shortcut (capital cards count as a free-1
      // resource in production, same as elsewhere).
      draggable={!inAnyPicker}
      onDragStart={(e) => {
        setMakeDragPayload(e, card.id);
        startDragMake(card.id);
      }}
      onDragEnd={endDragMake}
      data-bb-hand-card
      data-drag-source={dragMake === card.id ? "active" : undefined}
      title={
        inMakeMode
          ? `${isMakeSelected ? "Unselect" : "Tag"} this B$${value} capital for production (counts as 1 in conversion only)`
          : inDrawBillMode
            ? `${isDrawSelected ? "Unselect" : "Sacrifice"} this B$${value} capital to draw the top mash bill`
            : inAgeMode
              ? `${isAgeSelected ? "Unselect" : "Commit"} this B$${value} capital to age the picked barrel`
              : inBuyMode
                ? `${isBuySelected ? "Unselect" : "Select"} this B$${value} capital card to spend`
                : inSellMode
                  ? `${isSellSelected ? "Unselect" : "Spend"} this B$${value} capital as the sell-action cost`
                  : `Capital · pays B$${value} at the market — drag onto a barrel to commit`
      }
      className={[baseCardChrome, chrome.gradient, chrome.border, overlap, liftClass, buyClass].join(" ")}
    >
      <CornerValue value={value} />
      {isSelected ? (
        <span
          className="pointer-events-none absolute right-1 top-1 z-10 grid h-5 w-5 place-items-center rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold shadow-md"
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
        <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Capital
        </span>
      </div>
      {card.displayName ? (
        <h4 className={`mt-0.5 line-clamp-1 font-display text-[14px] font-bold leading-tight ${chrome.ink}`}>
          {card.displayName}
        </h4>
      ) : null}
      {card.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[8.5px] italic leading-snug ${chrome.label} opacity-90`}>
          {card.flavor}
        </p>
      ) : null}
      <div className={`mt-auto flex flex-col items-center ${chrome.ink}`}>
        <MoneyText
          n={value}
          className="font-display text-[28px] font-bold leading-none drop-shadow-[0_2px_6px_rgba(0,0,0,.45)]"
        />
        <span className={`mt-1 font-mono text-[9px] uppercase tracking-[.18em] ${chrome.label}`}>
          spend
        </span>
      </div>
    </button>
  );
}

// `MashBillCard` deleted in v2.6 — bills no longer enter the hand;
// they live in rickhouse slots from draw to sale. The component went
// dormant when `Section caption="Bills"` was removed and stayed
// orphaned until this cleanup pass.

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
        <span className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${chrome.label}`}>
          Ops
        </span>
      </div>
      <h4 className={`mt-1 line-clamp-2 font-display text-[15px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.ink}`}>
        {card.name}
      </h4>
      {card.flavor ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[8.5px] italic leading-snug ${chrome.label} opacity-90`}>
          {card.flavor}
        </p>
      ) : null}
      <div className={`mt-auto grid h-9 w-9 self-center place-items-center rounded-full border-2 bg-white/10 text-lg font-bold ${chrome.border} ${chrome.ink}`}>
        ⚡
      </div>
    </button>
  );
}
