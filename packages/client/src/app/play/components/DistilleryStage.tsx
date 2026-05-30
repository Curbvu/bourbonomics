"use client";

/**
 * v3 DistilleryStage — the hero of the play screen.
 *
 * Three stacked blocks:
 *
 *   1. Stage tag strip — "YOUR DISTILLERY" + hairline rule + slot
 *      occupancy.
 *   2. Identity plate — brass crest + name + flavor + ability + rep
 *      stat block. Frames the player's whole identity in one panel.
 *   3. Rickhouse stage — wooden cellar with brass plaque + slot grid
 *      of barrels (or empty silhouettes) + floor plank.
 *
 * Each `BarrelCell` renders the barrel as a physical object: 5 brass
 * hoops on a 122×148 ellipse, brass year medallion (animated `ember`
 * when aging), aging-glow halo, caption card with phase stamp + mash
 * pips below. The BarrelCell preserves all click + drop semantics
 * from the v2 BarrelChip (make-bourbon drop, age-bourbon drop,
 * sell/age picker auto-engage, inspect on right-click) — the visual
 * layer changed, the interaction layer didn't.
 *
 * Stamps `data-bb-zone="distillery-stage"` on the root for tutorial
 * Spotlight anchoring, `data-slot-id={slotId}` on every barrel +
 * empty-slot cell for MakeFlight / SaleFlight / AgeFlight landings.
 */

import { useState, useMemo, type ReactNode } from "react";
import type { Barrel, GameState, MashBill, RickhouseSlot } from "@bourbonomics/engine";
import { computeRecipeFloors, validateAction } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import BuyOverlay from "./BuyOverlay";
import LineStrip from "./LineStrip";
import { TIER_INK, tierOrCommon, type TierChrome } from "./tierStyles";
import { dragCarriesMakeCard, readMakeDragPayload } from "./dragMake";
import { RESOURCE_GLYPH } from "./handCardStyles";
import { useZoneFocusClass, useZoneFocusStyle } from "./pickerFocus";

// ─────────────────────────────────────────────────────────────────────
// Subtype palette for mash pips. Warm bourbon set; mirrors the tokens
// in globals.css so the pip color matches the rest of the canvas.
// ─────────────────────────────────────────────────────────────────────
const SUB_INK: Record<string, string> = {
  cask: "#d59650",
  corn: "#e9c46e",
  rye: "#d96b54",
  barley: "#82c9a3",
  wheat: "#7da6df",
  labor: "#c69d52",
  // Wildcard grain — neutral slate so it reads as "any subtype works"
  // and stays visually distinct from every named grain ink above.
  any: "#b7c2d3",
};

const TIER_BAND: Record<
  string,
  { ink: string; glow: string; label: string }
> = {
  common: { ink: "#b9a684", glow: "rgba(185,166,132,.30)", label: "Common" },
  uncommon: { ink: "#82c9a3", glow: "rgba(130,201,163,.40)", label: "Uncommon" },
  rare: { ink: "#7da6df", glow: "rgba(125,166,223,.50)", label: "Rare" },
  epic: { ink: "#c69df0", glow: "rgba(198,157,240,.55)", label: "Epic" },
  legendary: { ink: "#f0b070", glow: "rgba(240,176,112,.65)", label: "Legendary" },
};

export default function DistilleryStage() {
  const { state, multiplayerMode, startDraftingLoopMode } = useGameStore();
  if (!state) return null;

  // Mirror HandTray's seat-id logic so the hero plate always renders
  // the local player's distillery — never the wrong seat in MP.
  const youId = multiplayerMode
    ? multiplayerMode.playerId
    : state.players.find((p) => !p.isBot)?.id;
  const player = youId ? state.players.find((p) => p.id === youId) : null;
  if (!player) return null;

  const myBarrels = state.allBarrels.filter((b) => b.ownerId === player.id);
  const slotsTotal = player.rickhouseSlots.length;
  const filled = myBarrels.length;
  const distillery = player.distillery;
  const focusClass = useZoneFocusClass("rickhouse-self");
  const focusStyle = useZoneFocusStyle("rickhouse-self");
  if (!distillery) return null;

  // Drafting Loop launcher gating — mirrors ActionBar.canEnterDraftingLoopMode
  // so the on-barrel "+" button only lights up when the human can
  // actually initiate the loop right now.
  const isHumanTurn =
    state.phase === "action" &&
    state.players[state.currentPlayerIndex]?.id === player.id;
  const canDraftBill =
    isHumanTurn &&
    state.draftingLoop == null &&
    !state.finalRoundTriggered &&
    !player.draftingLoopUsedThisRound &&
    player.hand.length > 0 &&
    state.bourbonDeck.length > 0;

  return (
    <section
      data-bb-zone="distillery-stage"
      className="bb-panel bb-panel--stage flex min-h-0 flex-col"
    >
      {/* Content wrapper takes the picker-focus dim. The section
          itself stays at opacity:1 so children rendered outside this
          wrapper (the BuyOverlay) aren't multiplied by the rickhouse
          dim — CSS `opacity` builds a stacking context and would
          otherwise drag the modal down to 30% during a buy. */}
      <div
        className={`flex min-h-0 flex-1 flex-col gap-2 px-[22px] py-2 ${focusClass}`}
        style={focusStyle}
      >
        {/* 1. Stage tag strip */}
        <div className="flex items-baseline gap-3">
          <span className="stage-tag">Your Distillery</span>
          <span
            aria-hidden
            className="h-px flex-1"
            style={{
              background: "linear-gradient(90deg, var(--rule), transparent)",
            }}
          />
          <span className="label-sm">
            <span style={{ color: "var(--gold)" }}>{filled}</span>
            <span style={{ color: "var(--mute)" }}>/{slotsTotal} slots</span>
          </span>
        </div>

        {/* 2. Identity plate */}
        <IdentityPlate
          name={distillery.name}
          flavor={distillery.flavorText ?? ""}
          ability={distillery.cardText ?? ""}
          rep={player.capital}
          sold={player.barrelsSold}
          prestige={player.prestige}
          warehouseUnlocked={player.warehouseUnlocked}
          warehouseFilled={player.warehouseSlot != null}
        />

        {/* 3. Rickhouse stage */}
        <Rickhouse
          slots={player.rickhouseSlots}
          barrels={myBarrels}
          state={state}
          isHumanRow={true}
          canDraftBill={canDraftBill}
          onDraftBill={startDraftingLoopMode}
        />

        {/* 4. v3.0 Line system — roomy strip for the human's own
             brand portfolio. Renders nothing until there's something
             to show (board bound, bottles placed, cards in hand). */}
        <LineStrip player={player} state={state} density="roomy" />
      </div>

      {/* Buy-purchase panel — sibling of the dim-wrapper so its
          `absolute inset-0` covers the section without inheriting
          the picker-focus opacity. */}
      <BuyOverlay />
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Identity plate
// ─────────────────────────────────────────────────────────────────────

function IdentityPlate({
  name,
  flavor,
  ability,
  rep,
  sold,
  prestige,
  warehouseUnlocked,
  warehouseFilled,
}: {
  name: string;
  flavor: string;
  ability: string;
  rep: number;
  sold: number;
  prestige: number;
  /** v3.5 — true once the player buys the Warehouse investment. */
  warehouseUnlocked: boolean;
  /** v3.5 — true when something is currently stored in the warehouse. */
  warehouseFilled: boolean;
}) {
  return (
    <div
      className="relative grid items-center gap-[22px] overflow-hidden rounded-[12px] border border-[#3b2818] px-[22px] py-[8px]"
      style={{
        // crest · BIG REP · name+ability · sold
        gridTemplateColumns: "auto auto 1fr auto",
        background:
          "linear-gradient(180deg, rgba(58,40,24,.75) 0%, rgba(34,23,16,.85) 65%, rgba(20,14,8,.85) 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(240,201,112,.18), inset 0 -1px 0 rgba(0,0,0,.5), 0 6px 20px rgba(0,0,0,.4)",
      }}
    >
      {/* Brass corner ornament */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-9 w-9"
        style={{
          background:
            "linear-gradient(135deg, rgba(240,201,112,.5), transparent 60%)",
          borderTopLeftRadius: 12,
        }}
      />

      {/* Crest */}
      <div
        className="relative grid h-16 w-16 place-items-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, #f0c970 0%, #c69d52 35%, #6b3d1d 80%, #2a1a10 100%)",
          boxShadow:
            "inset 0 2px 4px rgba(255,255,255,.25), inset 0 -3px 6px rgba(0,0,0,.55), 0 4px 16px rgba(176,106,56,.45)",
        }}
      >
        <span
          className="font-display text-[32px] font-bold italic leading-none"
          style={{
            color: "#3a1f10",
            textShadow: "0 1px 0 rgba(255,255,255,.18)",
          }}
        >
          {name.charAt(0)}
        </span>
        {/* Candle ember above the crest */}
        <span
          aria-hidden
          className="flicker absolute left-1/2 -top-1.5 h-3.5 w-2 -translate-x-1/2"
          style={{
            background:
              "radial-gradient(50% 90% at 50% 70%, #ffe7a4 0%, #f0a040 60%, transparent 80%)",
            borderRadius: "50% 50% 40% 40% / 60% 60% 40% 40%",
            filter: "blur(.3px)",
          }}
        />
      </div>

      {/* BIG Reputation — between the crest and the title. Reads as
          the scoreboard for the whole match. Dashed right rule
          mirrors the divider before the Sold column on the far side.
          `data-bb-zone="reputation"` anchors the tutorial spotlight
          here (it used to live on the player-handle strip in
          HandTray before rep moved up). */}
      <div
        data-bb-zone="reputation"
        className="flex flex-col items-center justify-center leading-none"
        style={{
          paddingRight: 22,
          borderRight: "1px dashed rgba(110,80,50,.45)",
        }}
      >
        <span
          className="font-display font-bold tracking-[.01em]"
          style={{
            fontSize: 64,
            lineHeight: 0.9,
            color: "var(--gold)",
            textShadow:
              "0 1px 0 rgba(0,0,0,.5), 0 0 22px rgba(240,201,112,.35)",
          }}
        >
          {rep}
        </span>
        <span
          className="label-sm mt-1.5"
          style={{ color: "var(--brass)" }}
        >
          Capital
        </span>
      </div>

      {/* Name + flavor + ability */}
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <h1
            className="m-0 font-display text-[36px] font-bold leading-tight tracking-[.01em]"
            style={{ color: "var(--ink)" }}
          >
            {name}
          </h1>
          {flavor ? (
            <span
              className="font-display italic"
              style={{ fontSize: 16, color: "var(--brass)" }}
            >
              {flavor}
            </span>
          ) : null}
        </div>
        {ability ? (
          <p
            className="mt-1 max-w-[720px] font-sans text-[12.5px] leading-[1.55]"
            style={{ color: "var(--ink-muted)" }}
          >
            {ability}
          </p>
        ) : null}
      </div>

      {/* Stats — Reputation now lives inline next to the crest. Sold
          stays here, promoted to `big` so the right column doesn't
          visually collapse. Prestige sits beside Sold as a small star
          badge; it only appears once the player has earned at least
          one prestige point (Gold sale, or Silver for Connoisseur).
          Warehouse (v3.5) sits beside Prestige and only renders once
          the player has bought the Warehouse investment card. */}
      <div
        className="flex items-stretch gap-3.5 pl-[18px]"
        style={{ borderLeft: "1px dashed rgba(110,80,50,.45)" }}
      >
        <Stat label="Sold" value={sold} big />
        {prestige > 0 ? <PrestigeBadge value={prestige} /> : null}
        {warehouseUnlocked ? <WarehouseBadge filled={warehouseFilled} /> : null}
      </div>
    </div>
  );
}

/**
 * Warehouse badge (v3.5) — small icon + filled/empty indicator,
 * shown only when the player owns the Warehouse investment. The
 * Warehouse can hold at most one card across rounds; the engine's
 * in/out flow is `implemented: false` in v3.5 (lands in v3.6), so
 * this widget is presentation-only — it surfaces that the player has
 * the slot and whether something's stored.
 */
function WarehouseBadge({ filled }: { filled: boolean }) {
  return (
    <div
      className="flex flex-col items-center justify-center leading-none"
      title={
        filled
          ? "Warehouse — 1 card stored across rounds"
          : "Warehouse — empty (capacity 1; persists across rounds)"
      }
      data-bb-zone="warehouse"
    >
      <span
        className="font-display font-bold tracking-[.01em]"
        style={{
          fontSize: 26,
          color: filled ? "var(--gold)" : "var(--mute)",
          textShadow: filled
            ? "0 0 12px rgba(240,201,112,.45)"
            : "none",
        }}
      >
        📦{filled ? "1" : "0"}
      </span>
      <span className="label-sm mt-1" style={{ color: "var(--brass)" }}>
        Warehouse
      </span>
    </div>
  );
}

/**
 * Prestige badge — small star + count, shown only when prestige > 0.
 * Visually distinct from Sold (smaller, brass-gold gradient, "★" mark)
 * so a player at 2 prestige and 7 sold reads as "two awards, seven
 * total sales" at a glance.
 */
function PrestigeBadge({ value }: { value: number }) {
  return (
    <div
      className="flex flex-col items-center justify-center leading-none"
      title="Prestige — adds +1 Capital to every future Silver or Gold sale"
      data-bb-zone="prestige"
    >
      <span
        className="font-display font-bold tracking-[.01em]"
        style={{
          fontSize: 26,
          color: "var(--gold)",
          textShadow: "0 0 12px rgba(240,201,112,.45)",
        }}
      >
        ★{value}
      </span>
      <span className="label-sm mt-1" style={{ color: "var(--brass)" }}>
        Prestige
      </span>
    </div>
  );
}

function Stat({
  label,
  value,
  big = false,
}: {
  label: string;
  value: number;
  big?: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center leading-none">
      <span
        className="font-display font-bold tracking-[.01em]"
        style={{
          fontSize: big ? 40 : 24,
          color: big ? "var(--gold)" : "var(--ink)",
          textShadow: big
            ? "0 1px 0 rgba(0,0,0,.4), 0 0 14px rgba(240,201,112,.25)"
            : "none",
        }}
      >
        {value}
      </span>
      <span className="label-sm mt-1">{label}</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Rickhouse — wooden stage with brass plaque + slot grid
// ─────────────────────────────────────────────────────────────────────

function Rickhouse({
  slots,
  barrels,
  state,
  isHumanRow,
  canDraftBill = false,
  onDraftBill,
}: {
  slots: RickhouseSlot[];
  barrels: Barrel[];
  state: GameState;
  isHumanRow: boolean;
  /** True iff the human can initiate the Drafting Loop right now. Only
   *  meaningful on the human's own rickhouse. */
  canDraftBill?: boolean;
  /** Click handler for the "+ Draft Mash Bill" launcher rendered on
   *  the first empty slot. */
  onDraftBill?: () => void;
}) {
  // Find the slot id of the first (leftmost) empty slot, so EmptySlot
  // can decide whether to render the green draft-launcher chrome or
  // the regular dashed "open" silhouette. Bots' rickhouses never light
  // up the launcher (`canDraftBill` stays false off the human row).
  const firstEmptySlotId = (() => {
    for (const slot of slots) {
      if (!barrels.some((b) => b.slotId === slot.id)) return slot.id;
    }
    return null;
  })();
  return (
    <div
      className="relative flex-1 overflow-hidden rounded-[14px] border border-[#3b2818] px-[26px] pb-[12px] pt-[18px]"
      style={{
        minHeight: 240,
        background:
          "radial-gradient(120% 70% at 50% 0%, rgba(240,201,112,.10), transparent 55%), radial-gradient(80% 80% at 50% 110%, rgba(176,106,56,.12), transparent 65%), linear-gradient(180deg, #1e140c 0%, #150e08 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(240,201,112,.12), inset 0 -1px 0 rgba(0,0,0,.55), 0 12px 32px rgba(0,0,0,.5)",
      }}
    >
      {/* Top shelf rail */}
      <div
        aria-hidden
        className="wood brass-edge absolute left-4 right-4 top-2 h-2.5 rounded"
      />
      {/* Plaque */}
      <div
        aria-hidden
        className="absolute left-1/2 top-[-2px] -translate-x-1/2 rounded-b-[6px] px-3.5 py-[3px] font-mono text-[12px] font-bold uppercase tracking-[.22em]"
        style={{
          background: "linear-gradient(180deg, #f0c970, #b06a38)",
          color: "#2a1a10",
          boxShadow:
            "inset 0 1px 0 rgba(255,255,255,.35), 0 3px 6px rgba(0,0,0,.45)",
        }}
      >
        Rickhouse №1
      </div>

      {/* Slot grid */}
      <div
        className="relative mt-1.5 grid items-stretch gap-[22px]"
        style={{
          gridTemplateColumns: `repeat(${slots.length}, minmax(0, 1fr))`,
          minHeight: 220,
        }}
      >
        {slots.map((slot) => {
          const barrel = barrels.find((b) => b.slotId === slot.id);
          if (barrel) {
            return (
              <BarrelCell
                key={barrel.id}
                slot={slot}
                barrel={barrel}
                state={state}
                isHumanRow={isHumanRow}
              />
            );
          }
          const isDraftLauncher =
            isHumanRow &&
            canDraftBill &&
            slot.id === firstEmptySlotId &&
            onDraftBill != null;
          return (
            <EmptySlot
              key={slot.id}
              slot={slot}
              state={state}
              isHumanRow={isHumanRow}
              isDraftLauncher={isDraftLauncher}
              onDraftBill={onDraftBill}
            />
          );
        })}
      </div>

      {/* Floor plank */}
      <div
        aria-hidden
        className="absolute bottom-2 left-4 right-4 h-1.5 rounded"
        style={{
          background: "linear-gradient(180deg, #2a1a10, #110a06)",
          boxShadow:
            "inset 0 1px 0 rgba(240,201,112,.15), 0 4px 10px rgba(0,0,0,.6)",
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Hooks shared by BarrelCell + EmptySlot — drag-and-drop legality
// + click commit. Lifted from RickhouseRow's BarrelChip with the
// visual layer pulled out so we can wrap whatever chrome we want
// around the same interaction surface.
// ─────────────────────────────────────────────────────────────────────

interface SlotInteraction {
  /** Should this cell currently render as a valid/hover drop target? */
  dropTargetState: "valid" | "hover" | undefined;
  /** Drag handlers — wire to the cell's outer container. */
  onDragOver: (e: React.DragEvent) => void;
  onDragEnter: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  /** Click handler — handles age/sell pick, click-commit, auto-engage. */
  onClick: () => void;
  /** Right-click — always inspect (when there's a barrel) or no-op. */
  onContextMenu: (e: React.MouseEvent) => void;
  /** Whether this slot is the picked sell target right now. */
  isSellPicked: boolean;
  /** Whether this slot is the picked age target right now. */
  isAgePicked: boolean;
  /** Whether this barrel is ageable this turn (drives ring chrome). */
  ageable: boolean;
  /** Whether this barrel is saleable this turn. */
  saleable: boolean;
}

function useSlotInteraction(
  slot: RickhouseSlot,
  barrel: Barrel | null,
  state: GameState,
  isHumanRow: boolean,
): SlotInteraction {
  const {
    ageMode,
    setAgeBarrel,
    startAgeMode,
    sellMode,
    setSellBarrel,
    setInspect,
    dispatch,
    dragMake,
    dragMakeIds,
    endDragMake,
    selectedHandCardIds,
    clearHandSelection,
    tutorialSpotlight,
  } = useGameStore();

  const [dragHover, setDragHover] = useState(false);
  const owner = barrel
    ? state.players.find((p) => p.id === barrel.ownerId)
    : null;
  const ownerId = barrel?.ownerId ?? slot.ownerId;
  const isMyTurn =
    state.phase === "action" &&
    state.players[state.currentPlayerIndex]?.id === ownerId;

  // Drop legality — barrel-attached or empty slot.
  const canDropMake =
    isHumanRow && isMyTurn && (!barrel || barrel.phase !== "aging");
  const canDropAge =
    isHumanRow && isMyTurn && barrel != null && barrel.phase === "aging";
  const draggedIds =
    dragMakeIds.length > 0 ? dragMakeIds : dragMake ? [dragMake] : [];

  const isLegalMakeDrag =
    canDropMake &&
    draggedIds.length > 0 &&
    validateAction(state, {
      type: "MAKE_BOURBON",
      playerId: ownerId,
      slotId: slot.id,
      cardIds: draggedIds,
    }).legal;
  const isLegalAgeDrag =
    canDropAge &&
    barrel != null &&
    draggedIds.length === 1 &&
    validateAction(state, {
      type: "AGE_BOURBON",
      playerId: ownerId,
      barrelId: barrel.id,
      cardId: draggedIds[0]!,
    }).legal;
  const isLegalForDrag = isLegalMakeDrag || isLegalAgeDrag;

  const isLegalClickMake =
    canDropMake &&
    selectedHandCardIds.length > 0 &&
    validateAction(state, {
      type: "MAKE_BOURBON",
      playerId: ownerId,
      slotId: slot.id,
      cardIds: selectedHandCardIds,
    }).legal;
  const isLegalClickAge =
    canDropAge &&
    barrel != null &&
    selectedHandCardIds.length === 1 &&
    validateAction(state, {
      type: "AGE_BOURBON",
      playerId: ownerId,
      barrelId: barrel.id,
      cardId: selectedHandCardIds[0]!,
    }).legal;
  const isLegalForClickCommit = isLegalClickMake || isLegalClickAge;

  const dropTargetState: "valid" | "hover" | undefined = dragMake
    ? isLegalForDrag
      ? dragHover
        ? "hover"
        : "valid"
      : undefined
    : isLegalForClickCommit
      ? "valid"
      : undefined;

  // Picker mode + auto-engage logic.
  const inAgeMode = ageMode != null && isHumanRow;
  const inSellMode = sellMode != null && isHumanRow;
  const completedThisRound =
    barrel?.completedInRound != null && state.round <= barrel.completedInRound;
  const ageable =
    inAgeMode &&
    barrel != null &&
    barrel.phase === "aging" &&
    !completedThisRound &&
    !barrel.inspectedThisRound &&
    (!barrel.agedThisRound || barrel.extraAgesAvailable > 0);
  const isAgePicked =
    inAgeMode && barrel != null && ageMode!.pickedBarrelId === barrel.id;
  const saleable =
    inSellMode &&
    barrel != null &&
    barrel.phase === "aging" &&
    barrel.age >= 2 &&
    barrel.attachedMashBill != null &&
    (barrel.completedInRound == null || state.round > barrel.completedInRound);
  const isSellPicked =
    inSellMode && barrel != null && sellMode!.pickedBarrelId === barrel.id;
  const inAnyPickerMode = inAgeMode || inSellMode;
  const canAutoAge =
    !inAnyPickerMode &&
    barrel != null &&
    barrel.phase === "aging" &&
    isMyTurn &&
    !completedThisRound &&
    !barrel.inspectedThisRound &&
    (!barrel.agedThisRound || barrel.extraAgesAvailable > 0);

  // Tutorial sticky-pick: when a tutorial spotlight is anchored on
  // this rickhouse slot AND the player has already engaged the picker
  // on this same barrel, swallow a repeat click. Without this the
  // toggle-off behavior in setAgeBarrel / setSellBarrel turns a
  // double-click into a "stuck — barrel got un-picked, popup still
  // says pick a card" state.
  const spotlitSlotId =
    tutorialSpotlight?.kind === "rickhouse-slot"
      ? `slot_${tutorialSpotlight.ownerId}_${tutorialSpotlight.slotIndex}`
      : null;
  const tutorialAnchoredToThisSlot =
    isHumanRow &&
    tutorialSpotlight != null &&
    ((spotlitSlotId != null && spotlitSlotId === slot.id) ||
      (tutorialSpotlight.kind === "rickhouse-row" &&
        tutorialSpotlight.ownerId === ownerId));

  const onClick = () => {
    if (barrel && saleable) {
      if (tutorialAnchoredToThisSlot && isSellPicked) return;
      setSellBarrel(barrel.id);
      return;
    }
    if (barrel && ageable) {
      if (tutorialAnchoredToThisSlot && isAgePicked) return;
      setAgeBarrel(barrel.id);
      return;
    }
    // v3.10: if hand cards are selected, treat the click as an attempted
    // commit and let the engine validate. Silent fall-through to inspect
    // used to hide the rejection reason ("must age a barrel first",
    // "recipe requires exactly 2 total grain", etc.) — now the engine's
    // toast pipeline surfaces it.
    if (selectedHandCardIds.length > 0 && (canDropMake || canDropAge)) {
      if (canDropAge && barrel && selectedHandCardIds.length === 1) {
        try {
          dispatch({
            type: "AGE_BOURBON",
            playerId: ownerId,
            barrelId: barrel.id,
            cardId: selectedHandCardIds[0]!,
          });
          clearHandSelection();
        } catch {
          /* swallow — engine pushed the toast */
        }
        return;
      }
      if (canDropMake) {
        try {
          dispatch({
            type: "MAKE_BOURBON",
            playerId: ownerId,
            slotId: slot.id,
            cardIds: selectedHandCardIds,
          });
          clearHandSelection();
        } catch {
          /* swallow — engine pushed the toast */
        }
        return;
      }
    }
    if (canAutoAge && barrel) {
      startAgeMode();
      setAgeBarrel(barrel.id);
      return;
    }
    if (barrel) {
      setInspect({ kind: "barrel", barrel, ownerName: owner?.name });
    }
  };

  const onContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    if (barrel) {
      setInspect({ kind: "barrel", barrel, ownerName: owner?.name });
    }
  };

  const onDragOver = (e: React.DragEvent) => {
    // v3.10: accept the drop on any plausible target (owned slot, on
    // turn, non-aging for MAKE / aging for AGE). The legal/illegal
    // green highlight still comes from `isLegalForDrag` via
    // `dropTargetState` — but the drop itself fires either way so the
    // engine can push a toast if the player's drop turns out to be
    // illegal. Silent rejection on drop is the bug we're fixing.
    if (!canDropMake && !canDropAge) return;
    if (!dragCarriesMakeCard(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (isLegalForDrag && !dragHover) setDragHover(true);
  };
  const onDragEnter = onDragOver;
  const onDragLeave = () => {
    if (dragHover) setDragHover(false);
  };
  const onDrop = (e: React.DragEvent) => {
    setDragHover(false);
    endDragMake();
    if (!canDropMake && !canDropAge) return;
    const cardIds = readMakeDragPayload(e);
    if (cardIds.length === 0) return;
    e.preventDefault();
    // No pre-flight validate — dispatch unconditionally and let the
    // engine's rejection path push a toast with the actual reason.
    if (canDropAge && barrel) {
      if (cardIds.length !== 1) return;
      try {
        dispatch({
          type: "AGE_BOURBON",
          playerId: ownerId,
          barrelId: barrel.id,
          cardId: cardIds[0]!,
        });
        clearHandSelection();
      } catch {
        /* swallow — engine pushed the toast */
      }
      return;
    }
    try {
      dispatch({
        type: "MAKE_BOURBON",
        playerId: ownerId,
        slotId: slot.id,
        cardIds,
      });
      clearHandSelection();
    } catch {
      /* swallow — engine pushed the toast */
    }
  };

  return {
    dropTargetState,
    onDragOver,
    onDragEnter,
    onDragLeave,
    onDrop,
    onClick,
    onContextMenu,
    isSellPicked,
    isAgePicked,
    ageable: ageable ?? false,
    saleable: saleable ?? false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// BarrelCell — physical wooden barrel + caption card
// ─────────────────────────────────────────────────────────────────────

function BarrelCell({
  slot,
  barrel,
  state,
  isHumanRow,
}: {
  slot: RickhouseSlot;
  barrel: Barrel;
  state: GameState;
  isHumanRow: boolean;
}) {
  const interaction = useSlotInteraction(slot, barrel, state, isHumanRow);
  const tier = tierOrCommon(barrel.attachedMashBill?.tier);
  const band = TIER_BAND[tier]!;
  const bill = barrel.attachedMashBill;
  const selected = interaction.isSellPicked || interaction.isAgePicked;
  const titleText = `${bill?.name ?? "in progress"} · age ${barrel.age}${
    barrel.phase === "aging" ? "" : ` (${barrel.phase})`
  }`;

  return (
    <button
      type="button"
      data-slot-id={slot.id}
      data-drop-target={interaction.dropTargetState}
      onClick={interaction.onClick}
      onContextMenu={interaction.onContextMenu}
      onDragOver={interaction.onDragOver}
      onDragEnter={interaction.onDragEnter}
      onDragLeave={interaction.onDragLeave}
      onDrop={interaction.onDrop}
      title={titleText}
      className="relative flex cursor-pointer flex-col items-stretch border-0 bg-transparent p-0 text-left transition-transform"
      style={{
        transform: selected ? "translateY(-6px)" : "translateY(0)",
      }}
    >
      <Barrel barrel={barrel} band={band} selected={selected} />
      <CaptionCard barrel={barrel} band={band} selected={selected} />
    </button>
  );
}

function Barrel({
  barrel,
  band,
  selected,
}: {
  barrel: Barrel;
  band: { ink: string; glow: string; label: string };
  selected: boolean;
}) {
  const isAging = barrel.phase === "aging";
  // Within `aging`, split on whether this barrel has eaten its age
  // card this round — drives the medallion's two animation states
  // (urgent pulse vs. settled glow).
  const needsAgeThisRound = isAging && !barrel.agedThisRound;
  // "needs resources" covers `ready` (bill placed, no commits yet) and
  // `construction` (partially committed). These barrels are visibly
  // different from aging ones: cooler/desaturated wood, dim hoops, no
  // halo, no glowing medallion. Instead the body carries an "open"
  // staves treatment so the eye reads it as "raw, waiting on cards."
  const needs = isAging ? [] : computeBarrelNeeds(barrel);
  return (
    <div className="relative grid h-[156px] w-full place-items-center">
      {/* Ground shadow */}
      <span
        aria-hidden
        className="absolute bottom-[-2px] left-[12%] right-[12%] h-2 rounded-full"
        style={{
          background:
            "radial-gradient(50% 100% at 50% 30%, rgba(0,0,0,.65), transparent 70%)",
          filter: "blur(2px)",
        }}
      />
      {/* Aging halo — only on aging barrels. */}
      {isAging ? (
        <span
          aria-hidden
          className="absolute inset-0 transition-opacity"
          style={{
            background: `radial-gradient(50% 60% at 50% 50%, ${band.glow}, transparent 70%)`,
            filter: "blur(8px)",
            opacity: selected ? 1 : 0.7,
          }}
        />
      ) : null}
      {/* "Needs resources" call-out ring — sits behind a non-aging
          barrel so the eye knows this slot is waiting on the player.
          Pulses softly so the eye snaps to "build me." */}
      {!isAging ? (
        <span
          aria-hidden
          className="bb-construction-glow absolute inset-0"
          style={{
            background:
              "radial-gradient(48% 56% at 50% 52%, rgba(125,166,223,.42), transparent 72%)",
            filter: "blur(10px)",
          }}
        />
      ) : null}
      {/* Barrel body — warm chocolate when aging, cool slate when
          waiting on cards. The hoops also lose their brass shine on
          non-aging so the whole silhouette reads as "raw." */}
      <div
        className="relative"
        style={{
          width: 122,
          height: 148,
          borderRadius: "44% / 16%",
          background: isAging
            ? "repeating-linear-gradient(90deg," +
              "#3a2515 0px, #3a2515 14px," +
              "#2a1a10 14px, #2a1a10 16px," +
              "#43321f 16px, #43321f 30px," +
              "#321f12 30px, #321f12 32px)," +
              "linear-gradient(180deg, #4a341f 0%, #2a1a0e 100%)"
            : // Neutral grey staves — reads as "raw / under construction"
              // and clearly distinct from aging's charred-bourbon wood.
              "repeating-linear-gradient(90deg," +
              "#3a3d42 0px, #3a3d42 14px," +
              "#25272a 14px, #25272a 16px," +
              "#4a4e54 16px, #4a4e54 30px," +
              "#2e3034 30px, #2e3034 32px)," +
              "linear-gradient(180deg, #444851 0%, #1d1f22 100%)",
          boxShadow: isAging
            ? "inset 0 4px 8px rgba(255,255,255,.10), inset 0 -8px 18px rgba(0,0,0,.55), inset 10px 0 14px rgba(0,0,0,.55), inset -10px 0 14px rgba(0,0,0,.55), 0 8px 16px rgba(0,0,0,.55)"
            : // No warm inner glow; outer shadow stays so it still
              // looks like a 3D object.
              "inset 0 4px 8px rgba(255,255,255,.05), inset 0 -10px 22px rgba(0,0,0,.65), inset 10px 0 14px rgba(0,0,0,.55), inset -10px 0 14px rgba(0,0,0,.55), 0 8px 16px rgba(0,0,0,.55)",
        }}
      >
        {/* Five hoops — brass on aging, iron-grey on non-aging. */}
        <Hoop top={8} dim={!isAging} />
        <Hoop top={26} dim={!isAging} />
        <Hoop top="50%" dim={!isAging} />
        <Hoop bottom={26} dim={!isAging} />
        <Hoop bottom={8} dim={!isAging} />

        {/* Top lid — kept on aging, "open" (gap with darker void)
            on non-aging so it reads as "fillable." */}
        {isAging ? (
          <span
            aria-hidden
            className="absolute left-1/2 top-1 -translate-x-1/2"
            style={{
              width: "86%",
              height: 14,
              borderRadius: "50%",
              background:
                "radial-gradient(60% 100% at 50% 30%, #3d2615 0%, #1c1108 100%)",
              boxShadow:
                "inset 0 2px 3px rgba(255,255,255,.15), inset 0 -3px 4px rgba(0,0,0,.5)",
            }}
          />
        ) : (
          <span
            aria-hidden
            className="absolute left-1/2 top-1 -translate-x-1/2"
            style={{
              width: "86%",
              height: 14,
              borderRadius: "50%",
              background:
                "radial-gradient(60% 100% at 50% 60%, #050403 0%, #0a0805 75%, #1a1410 100%)",
              boxShadow:
                "inset 0 2px 4px rgba(0,0,0,.85), inset 0 -1px 2px rgba(0,0,0,.5)",
            }}
          />
        )}

        {/* Center plate — year medallion on aging barrels, needed-
            resources stack on barrels waiting for cards.
            Positioned via `inset:0 + margin:auto` so the medallion
            sits dead-center of the 122×148 barrel body without
            fighting the ember-needs keyframe's own transform
            (translate-based centering was being eaten by the
            animation and rendering the medallion offset to the
            top). Sized at ~59% of the barrel width so it reads as
            a stamp on the front face, not an orb. */}
        {isAging ? (
          <span
            aria-hidden
            className={`${needsAgeThisRound ? "ember-needs" : "ember-aged"} block rounded-full`}
            style={{
              position: "absolute",
              inset: 0,
              margin: "auto",
              width: 72,
              height: 72,
              background:
                "radial-gradient(circle at 35% 30%, #f0c970, #c69d52 60%, #6b3d1d 100%)",
              boxShadow: `inset 0 2px 3px rgba(255,255,255,.4), inset 0 -2px 4px rgba(0,0,0,.5), 0 0 10px ${band.glow}`,
            }}
          >
            {/* Digit + YR are absolutely positioned with explicit
                top/bottom offsets so the two never overlap regardless
                of the digit's font metrics. The grid+place-items-center
                approach centered both as a single column and ended up
                pinning YR against the digit's descender. */}
            <span
              className="absolute left-1/2 top-[6px] -translate-x-1/2 font-display text-[38px] font-bold leading-none"
              style={{ color: "#2a1a10" }}
            >
              {barrel.age}
            </span>
            <span
              className="absolute bottom-[5px] left-1/2 -translate-x-1/2 font-mono text-[9.5px] font-bold tracking-[.18em]"
              style={{ color: "#2a1a10" }}
            >
              YR
            </span>
            {/* Aged barrels get a green check badge so the "done"
                state is unmistakable at a glance even before the
                viewer notices the dimmer/desaturated medallion. */}
            {!needsAgeThisRound ? (
              <span className="ember-aged-check" aria-label="Aged this round" />
            ) : null}
          </span>
        ) : (
          <BarrelNeedsPlate needs={needs} />
        )}
      </div>
    </div>
  );
}

function Hoop({
  top,
  bottom,
  dim = false,
}: {
  top?: number | string;
  bottom?: number | string;
  /** When true, render an iron-grey hoop (used on non-aging barrels)
   *  so the barrel reads as "raw" — no brass shine. */
  dim?: boolean;
}) {
  return (
    <span
      aria-hidden
      className="absolute -left-[2%] -right-[2%] h-[5px] rounded-[2px]"
      style={{
        top: top != null ? (typeof top === "number" ? `${top}px` : top) : undefined,
        bottom:
          bottom != null
            ? typeof bottom === "number"
              ? `${bottom}px`
              : bottom
            : undefined,
        background: dim
          ? "linear-gradient(180deg, #6e6457 0%, #4a4338 50%, #1f1c17 100%)"
          : "linear-gradient(180deg, #f0c970 0%, #c69d52 50%, #6b3d1d 100%)",
        boxShadow: dim
          ? "inset 0 1px 0 rgba(255,255,255,.18), inset 0 -1px 0 rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.4)"
          : "inset 0 1px 0 rgba(255,255,255,.35), inset 0 -1px 0 rgba(0,0,0,.5), 0 1px 2px rgba(0,0,0,.4)",
      }}
    />
  );
}

// ─────────────────────────────────────────────────────────────────────
// Needs helpers — compute what the barrel is still waiting on and
// render them as a stack of `[count]× [glyph]` rows on the barrel.
// ─────────────────────────────────────────────────────────────────────

type SubKey = "cask" | "corn" | "rye" | "barley" | "wheat" | "any";

interface BarrelNeed {
  subtype: SubKey;
  count: number;
  /** True for a `recipe.minSpecialty.<sub>` shortfall — the player must
   *  commit a Specialty/Heritage-flagged card of this subtype, not a
   *  plain one. Rendered with a ★ marker so the distinction is
   *  unmissable. */
  specialty?: boolean;
}

/**
 * What's still required to advance this barrel to aging — recipe
 * minimums (basic + specialty) minus already-committed cards. Mirrors
 * MashPips' tally logic but returns the OUTSTANDING counts only
 * (positives) so the caller can render a compact "still needs" overlay.
 *
 * Specialty rows come first so the player sees the strictest
 * requirements at the top of the limited 4-row plate — a recipe with
 * `minSpecialty.cask: 1` reads as "1 Specialty Cask" rather than the
 * looser "1 cask" the engine will then reject.
 */
function computeBarrelNeeds(barrel: Barrel): BarrelNeed[] {
  type NamedKey = "cask" | "corn" | "rye" | "barley" | "wheat";
  const tally: Record<NamedKey, number> = {
    cask: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
  };
  const specialtyTally: Record<NamedKey, number> = {
    cask: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
  };
  for (const c of barrel.productionCards) {
    if (c.type !== "resource" || !c.subtype) continue;
    const n = c.resourceCount ?? 1;
    if (c.subtype in tally) {
      tally[c.subtype as NamedKey] += n;
      if (c.specialty) specialtyTally[c.subtype as NamedKey] += n;
    }
  }
  const f = computeRecipeFloors(barrel.attachedMashBill?.recipe);

  const specialtyRows: BarrelNeed[] = [];
  const plainRows: BarrelNeed[] = [];
  let namedGrainShortfall = 0;
  for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as NamedKey[]) {
    // Specialty shortfall first — engine treats a specialty card as
    // satisfying BOTH the specialty floor AND the basic per-subtype min.
    const specialtyNeed = Math.max(0, f[sub].specialty - specialtyTally[sub]);
    if (specialtyNeed > 0) {
      specialtyRows.push({ subtype: sub, count: specialtyNeed, specialty: true });
    }
    // Specialty-first fill: only specialty commits up to the specialty
    // floor are "consumed" by the specialty quota — the rest spill
    // over and count toward the plain shortfall, mirroring the engine's
    // per-subtype total check (tally[sub] >= max(basic, specialty)).
    const specialtyCounted = Math.min(specialtyTally[sub], f[sub].specialty);
    const plainHave = tally[sub] - specialtyCounted;
    const plainNeed = Math.max(0, f[sub].plain - plainHave);
    if (plainNeed > 0) {
      plainRows.push({ subtype: sub, count: plainNeed });
    }
    if (sub === "rye" || sub === "barley" || sub === "wheat") {
      // For the wildcard tally below — total per-grain shortfall,
      // counting both plain and specialty needs.
      namedGrainShortfall += specialtyNeed + plainNeed;
    }
  }
  // Wildcard grain — minTotalGrain (rye+barley+wheat only) over the
  // sum of effective named non-corn grain floors, less any grain the
  // player has already committed past those floors.
  const committedGrain = tally.rye + tally.barley + tally.wheat;
  const wildNeed = Math.max(
    0,
    f.grain.total - committedGrain - namedGrainShortfall,
  );
  const out: BarrelNeed[] = [...specialtyRows, ...plainRows];
  if (wildNeed > 0) out.push({ subtype: "any", count: wildNeed });
  return out;
}

/**
 * Center plate shown on non-aging barrels in place of the year
 * medallion — a stack of "Nx [glyph]" rows for every resource the
 * barrel is still missing. Falls back to a soft "?" disc when there
 * are no outstanding needs (covers the unlikely race where the
 * barrel transitions out of aging or has a recipe with everything
 * already committed).
 */
function BarrelNeedsPlate({ needs }: { needs: BarrelNeed[] }) {
  if (needs.length === 0) {
    return (
      <span
        aria-hidden
        className="absolute left-1/2 top-1/2 grid h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(125,166,223,.55), rgba(50,80,120,.55) 65%, rgba(20,30,50,.55) 100%)",
          boxShadow:
            "inset 0 2px 4px rgba(255,255,255,.2), inset 0 -2px 6px rgba(0,0,0,.5), 0 0 14px rgba(125,166,223,.45)",
        }}
      >
        <span className="font-display text-[44px] font-bold leading-none text-sky-100">?</span>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="absolute left-1/2 top-1/2 flex w-[108px] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-2 rounded-lg px-2 py-3"
      style={{
        background:
          "linear-gradient(180deg, rgba(8,10,14,.92), rgba(4,6,10,.97))",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.12), inset 0 -1px 0 rgba(0,0,0,.65), 0 4px 14px rgba(0,0,0,.6)",
        border: "1.5px solid rgba(125,166,223,.7)",
        minHeight: 116,
      }}
    >
      <span className="font-mono text-[13px] font-bold uppercase tracking-[.18em] text-sky-200">
        Needs
      </span>
      {needs.slice(0, 4).map((n) => {
        const isSpecialty = !!n.specialty;
        const label =
          n.subtype === "any"
            ? "any grain"
            : isSpecialty
              ? `Specialty ${n.subtype}`
              : n.subtype;
        return (
          <span
            key={`${n.specialty ? "sp-" : ""}${n.subtype}`}
            title={label}
            className="flex items-center gap-2 font-mono text-[20px] font-bold leading-none"
            style={{ color: SUB_INK[n.subtype] }}
          >
            <span className="tabular-nums">{n.count}×</span>
            <span
              className="relative flex h-6 w-6 items-center justify-center text-[20px] leading-none"
              style={
                isSpecialty
                  ? {
                      borderRadius: "999px",
                      boxShadow:
                        "0 0 0 1.5px rgba(252,211,77,.9), 0 0 8px rgba(252,211,77,.45)",
                    }
                  : undefined
              }
            >
              {n.subtype === "any" ? "✱" : RESOURCE_GLYPH[n.subtype]}
              {isSpecialty ? (
                <span
                  aria-hidden
                  className="pointer-events-none absolute -right-1.5 -top-1.5 font-display text-[10px] font-bold leading-none"
                  style={{
                    color: "rgba(252,211,77,1)",
                    textShadow: "0 0 4px rgba(252,211,77,.8)",
                  }}
                >
                  ★
                </span>
              ) : null}
            </span>
          </span>
        );
      })}
    </span>
  );
}

function CaptionCard({
  barrel,
  band,
  selected,
}: {
  barrel: Barrel;
  band: { ink: string; glow: string; label: string };
  selected: boolean;
}) {
  const bill = barrel.attachedMashBill;
  const cells: number[] = [];
  if (bill) {
    for (const row of bill.rewardGrid) {
      for (const c of row) if (c !== null) cells.push(c);
    }
  }
  const peak = cells.length ? Math.max(...cells) : 0;
  const floor = cells.length ? Math.min(...cells) : 0;
  return (
    <div
      className="mt-3 w-full rounded-[9px] border text-left"
      style={{
        padding: "10px 12px 11px 12px",
        borderColor: selected ? "var(--gold)" : `${band.ink}55`,
        background:
          "linear-gradient(180deg, rgba(34,23,16,.85), rgba(20,14,8,.95))",
        boxShadow: selected
          ? "0 0 0 2px rgba(240,201,112,.35), 0 6px 18px rgba(240,201,112,.25)"
          : "inset 0 1px 0 rgba(255,255,255,.05)",
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span
          className="label-sm"
          style={{ color: band.ink, fontSize: 13, letterSpacing: ".16em" }}
        >
          {band.label}
        </span>
        <PhaseStamp phase={barrel.phase} age={barrel.age} />
      </div>
      <div
        className="mt-1.5 font-display font-semibold leading-tight"
        style={{ color: "var(--ink)", fontSize: 20 }}
      >
        {bill?.name ?? "in progress"}
      </div>
      {bill?.slogan ? (
        <div
          className="mt-1 font-display italic"
          style={{ color: "var(--mute)", fontSize: 13.5, lineHeight: 1.35 }}
        >
          {bill.slogan}
        </div>
      ) : null}
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span
          className="font-display font-bold tracking-[.01em]"
          style={{ color: band.ink, fontSize: 20 }}
        >
          {bill ? `${floor}–${peak}` : "—"}{" "}
          <span
            className="label-sm"
            style={{ color: band.ink, opacity: 0.75, fontSize: 13 }}
          >
            rep
          </span>
        </span>
        <MashPips barrel={barrel} />
      </div>
    </div>
  );
}

function PhaseStamp({ phase, age }: { phase: Barrel["phase"]; age: number }) {
  const map: Record<
    Barrel["phase"],
    { label: string; ink: string; bg: string; border: string }
  > = {
    aging: {
      label: `Aging · ${age}y`,
      ink: "var(--gold)",
      bg: "rgba(240,201,112,.18)",
      border: "rgba(240,201,112,.45)",
    },
    construction: {
      label: "Building",
      ink: "var(--sky)",
      bg: "rgba(125,166,223,.18)",
      border: "rgba(125,166,223,.45)",
    },
    ready: {
      label: "Staged",
      ink: "var(--ink-muted)",
      bg: "rgba(110,80,50,.18)",
      border: "rgba(110,80,50,.45)",
    },
  };
  const s = map[phase];
  return (
    <span
      className="font-mono font-bold uppercase"
      style={{
        fontSize: 13,
        letterSpacing: ".14em",
        padding: "2px 8px",
        borderRadius: 5,
        border: `1px solid ${s.border}`,
        background: s.bg,
        color: s.ink,
      }}
    >
      {s.label}
    </span>
  );
}

/** Pip row from the barrel's production cards + recipe minimums. */
function MashPips({ barrel }: { barrel: Barrel }) {
  // Aggregate committed subtypes (from productionCards) and overlay the
  // recipe minimum so the player sees both "what I've put in" and
  // "what's still required". Mirrors the v2 RickhouseRow mashPip logic
  // but recolored to the warm subtype ink palette.
  type SubKey = "cask" | "corn" | "rye" | "barley" | "wheat";
  const tally: Record<SubKey, number> = {
    cask: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
  };
  // Specialty-only tally — counts cards flagged `c.specialty === true`
  // so we can render the per-subtype specialty floor as its own pip
  // distinct from the plain count. Without this a Specialty-Cask
  // recipe would show one indistinguishable "cask" pip and the player
  // would commit a plain cask, then get a silent engine rejection.
  const specialtyTally: Record<SubKey, number> = {
    cask: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
  };
  for (const c of barrel.productionCards) {
    if (c.type !== "resource" || !c.subtype) continue;
    const n = c.resourceCount ?? 1;
    if (c.subtype in tally) {
      tally[c.subtype as SubKey] += n;
      if (c.specialty) specialtyTally[c.subtype as SubKey] += n;
    }
  }
  const recipe = barrel.attachedMashBill?.recipe;
  const f = computeRecipeFloors(recipe);
  const recipeSatisfied = barrel.phase === "aging";

  const pips: ReactNode[] = [];
  for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as const) {
    // Specialty-first fill (matches RecipeProgress + BarrelNeedsPlate):
    // specialty commits beyond the specialty floor render as plain
    // pips, so a second Specialty Rye on a `minRye:2 + minSpec.rye:1`
    // recipe fills the second slot of the plain row instead of piling
    // an "extra" ★ pip past the specialty floor.
    const specialtyCounted = Math.min(specialtyTally[sub], f[sub].specialty);
    const plainNeed = recipeSatisfied ? 0 : f[sub].plain;
    const plainHave = Math.max(0, tally[sub] - specialtyCounted);
    const plainSlots = Math.max(plainHave, plainNeed);
    for (let i = 0; i < plainSlots; i++) {
      const filled = i < plainHave;
      pips.push(
        <span
          key={`${sub}-${i}`}
          title={sub}
          className="inline-block h-[9px] w-[9px] rounded-full"
          style={{
            background: filled ? SUB_INK[sub] : "transparent",
            boxShadow: filled
              ? `0 0 6px ${SUB_INK[sub]}66`
              : `inset 0 0 0 1.5px ${SUB_INK[sub]}88`,
          }}
        />,
      );
    }
    // Specialty pips — slightly larger, with an amber halo + ★ so the
    // player sees at a glance that this slot demands a market-only
    // Specialty / Heritage card. Capped at the specialty floor so
    // overflow shows up as plain pips above instead.
    const specialtyNeed = recipeSatisfied ? 0 : f[sub].specialty;
    const specialtyHave = specialtyCounted;
    const specialtySlots = Math.max(specialtyHave, specialtyNeed);
    for (let i = 0; i < specialtySlots; i++) {
      const filled = i < specialtyHave;
      pips.push(
        <span
          key={`sp-${sub}-${i}`}
          title={`Specialty ${sub}`}
          className="relative inline-block h-[11px] w-[11px] rounded-full"
          style={{
            background: filled ? SUB_INK[sub] : "transparent",
            boxShadow: filled
              ? `0 0 6px ${SUB_INK[sub]}66, 0 0 0 1px rgba(252,211,77,.9)`
              : `inset 0 0 0 1.5px ${SUB_INK[sub]}88, 0 0 0 1px rgba(252,211,77,.6)`,
          }}
        >
          <span
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[8px] font-bold leading-none"
            style={{ color: filled ? "#2a1a10" : "rgba(252,211,77,.95)" }}
            aria-hidden
          >
            ★
          </span>
        </span>,
      );
    }
  }
  // Wildcard "any grain" pips — recipes whose minTotalGrain exceeds the
  // sum of named-grain floors have extra slots the player can fill with
  // any grain. Mirrors RecipePips' hollow-ring treatment and the
  // BarrelNeedsPlate's "✱" callout so the caption strip stays honest.
  // `f.grain.wildSlots` already accounts for effective named-grain
  // floors (max of basic and specialty) so a recipe like
  // `minRye:1 + minSpecialty.rye:2` reads as needing 2 rye minimum
  // before any wildcard slot opens up.
  const wildSlots = f.grain.wildSlots;
  if (wildSlots > 0) {
    // Engine's minTotalGrain counts rye+barley+wheat only (corn is its
    // own track), so the wildcard tally excludes corn.
    const grainCommitted =
      (tally.rye ?? 0) + (tally.barley ?? 0) + (tally.wheat ?? 0);
    const grainCountedAgainstNamed =
      Math.min(tally.rye, f.rye.effective) +
      Math.min(tally.barley, f.barley.effective) +
      Math.min(tally.wheat, f.wheat.effective);
    const overflow = Math.max(0, grainCommitted - grainCountedAgainstNamed);
    const filledWild = recipeSatisfied
      ? wildSlots
      : Math.min(wildSlots, overflow);
    for (let i = 0; i < wildSlots; i++) {
      const filled = i < filledWild;
      pips.push(
        <span
          key={`any-${i}`}
          title="any grain"
          className="inline-block h-[9px] w-[9px] rounded-full"
          style={{
            background: filled ? SUB_INK.any : "transparent",
            boxShadow: filled
              ? `0 0 6px ${SUB_INK.any}66`
              : `inset 0 0 0 1.5px ${SUB_INK.any}88`,
          }}
        />,
      );
    }
  }
  return <div className="flex gap-[3px]">{pips}</div>;
}

// ─────────────────────────────────────────────────────────────────────
// EmptySlot — dashed barrel silhouette + caption
// ─────────────────────────────────────────────────────────────────────

function EmptySlot({
  slot,
  state,
  isHumanRow,
  isDraftLauncher = false,
  onDraftBill,
}: {
  slot: RickhouseSlot;
  state: GameState;
  isHumanRow: boolean;
  /** When true, this is the "next available" empty slot for the human
   *  player AND they can currently initiate the Drafting Loop — render
   *  the green "+" launcher button instead of the dashed silhouette. */
  isDraftLauncher?: boolean;
  onDraftBill?: () => void;
}) {
  // Render the on-barrel draft launcher in place of the regular slot
  // interaction. Drag-drop/click-commit are intentionally bypassed here
  // — a slot with no mash bill has no legal MAKE/AGE drop, so we lose
  // nothing by reserving the click for the draft action.
  if (isDraftLauncher && onDraftBill) {
    return (
      <button
        type="button"
        data-slot-id={slot.id}
        data-bb-action="draw-bill"
        onClick={onDraftBill}
        title="Draft a new mash bill into this barrel"
        className="group relative flex cursor-pointer flex-col items-stretch border-0 bg-transparent p-0 text-left transition-transform hover:-translate-y-[3px]"
      >
        <div className="relative grid h-[156px] w-full place-items-center">
          {/* Emerald halo so the call-to-action reads at a glance. */}
          <span
            aria-hidden
            className="absolute inset-0 transition-opacity group-hover:opacity-100"
            style={{
              background:
                "radial-gradient(50% 60% at 50% 50%, rgba(52,211,153,.45), transparent 70%)",
              filter: "blur(10px)",
              opacity: 0.8,
            }}
          />
          <div
            className="relative grid h-[148px] w-[122px] place-items-center"
            style={{
              borderRadius: "44% / 16%",
              border: "2px solid rgba(52,211,153,.75)",
              background:
                "radial-gradient(60% 60% at 50% 45%, rgba(52,211,153,.20), rgba(8,30,22,.85) 78%)",
              boxShadow:
                "inset 0 1px 0 rgba(167,243,208,.35), 0 0 0 1px rgba(52,211,153,.25), 0 6px 22px rgba(16,185,129,.35)",
            }}
          >
            <div className="flex flex-col items-center gap-2">
              <span
                aria-hidden
                className="grid h-10 w-10 place-items-center rounded-full font-display text-[26px] font-bold leading-none"
                style={{
                  background: "linear-gradient(180deg, #34d399, #059669)",
                  color: "#052b1d",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,.45), 0 2px 10px rgba(16,185,129,.55)",
                }}
              >
                +
              </span>
              <span
                className="text-center font-mono text-[10.5px] font-bold uppercase leading-tight tracking-[.18em]"
                style={{ color: "#a7f3d0" }}
              >
                Draft
                <br />
                Mash Bill
              </span>
            </div>
          </div>
        </div>
        <div
          className="mt-3 flex w-full flex-1 items-center justify-center rounded-[9px] border text-center font-mono uppercase"
          style={{
            // `flex-1` grows the caption to fill the remaining row
            // height so the grid's items-stretch keeps this slot's
            // visual at the same Y as the BarrelCells' barrels.
            padding: "12px",
            fontSize: 13,
            letterSpacing: ".22em",
            borderColor: "rgba(52,211,153,.7)",
            background:
              "linear-gradient(180deg, rgba(16,185,129,.20), rgba(6,40,28,.7))",
            color: "#a7f3d0",
            boxShadow: "0 0 12px rgba(16,185,129,.20)",
          }}
        >
          Draft Bill
        </div>
      </button>
    );
  }

  const interaction = useSlotInteraction(slot, null, state, isHumanRow);
  const selected = interaction.dropTargetState != null;
  return (
    <button
      type="button"
      data-slot-id={slot.id}
      data-drop-target={interaction.dropTargetState}
      onClick={interaction.onClick}
      onContextMenu={interaction.onContextMenu}
      onDragOver={interaction.onDragOver}
      onDragEnter={interaction.onDragEnter}
      onDragLeave={interaction.onDragLeave}
      onDrop={interaction.onDrop}
      title="Awaiting mash bill"
      className="relative flex cursor-pointer flex-col items-stretch border-0 bg-transparent p-0 text-left transition-transform"
      style={{
        transform: selected ? "translateY(-3px)" : "translateY(0)",
      }}
    >
      <div className="relative grid h-[156px] w-full place-items-center">
        <div
          className="shelf-breathe relative grid h-[148px] w-[122px] place-items-center"
          style={{
            borderRadius: "44% / 16%",
            border: "1.5px dashed rgba(198,157,82,.35)",
            background:
              "radial-gradient(60% 60% at 50% 50%, rgba(240,201,112,.05), transparent 70%)",
          }}
        >
          <div className="flex flex-col items-center gap-1">
            <span
              className="grid h-[18px] w-[18px] place-items-center rounded-full font-display text-[13px]"
              style={{
                border: "1px solid var(--whisper)",
                color: "var(--mute)",
              }}
            >
              +
            </span>
            <span
              className="font-mono text-[12px] font-bold uppercase tracking-[.24em]"
              style={{ color: "var(--whisper)" }}
            >
              Open
            </span>
          </div>
        </div>
      </div>
      <div
        className="mt-3 flex w-full flex-1 items-center justify-center rounded-[9px] border text-center font-mono uppercase"
        style={{
          // `flex-1` grows the caption to fill the remaining row
          // height so the grid's items-stretch keeps this slot's
          // silhouette at the same Y as the BarrelCells' barrels.
          padding: "12px",
          fontSize: 13,
          letterSpacing: ".22em",
          borderColor: selected ? "var(--gold)" : "rgba(110,80,50,.45)",
          borderStyle: "dashed",
          background: "rgba(20,14,8,.5)",
          color: "var(--mute)",
        }}
      >
        Awaiting mash bill
      </div>
    </button>
  );
}
