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
import { validateAction } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { TIER_INK, tierOrCommon, type TierChrome } from "./tierStyles";
import { dragCarriesMakeCard, readMakeDragPayload } from "./dragMake";
import { RESOURCE_GLYPH } from "./handCardStyles";

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
  const { state, multiplayerMode } = useGameStore();
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
  if (!distillery) return null;

  return (
    <section
      data-bb-zone="distillery-stage"
      className="bb-panel bb-panel--stage flex min-h-0 flex-col gap-3.5 px-[22px] py-4"
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
        rep={player.reputation}
        sold={player.barrelsSold}
      />

      {/* 3. Rickhouse stage */}
      <Rickhouse
        slots={player.rickhouseSlots}
        barrels={myBarrels}
        state={state}
        isHumanRow={true}
      />
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
}: {
  name: string;
  flavor: string;
  ability: string;
  rep: number;
  sold: number;
}) {
  return (
    <div
      className="relative grid items-center gap-[22px] overflow-hidden rounded-[12px] border border-[#3b2818] px-[22px] py-[14px]"
      style={{
        gridTemplateColumns: "auto 1fr auto",
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

      {/* Stats */}
      <div
        className="flex items-stretch gap-3.5 pl-[18px]"
        style={{ borderLeft: "1px dashed rgba(110,80,50,.45)" }}
      >
        <Stat label="Reputation" value={rep} big />
        <Stat label="Sold" value={sold} />
      </div>
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
}: {
  slots: RickhouseSlot[];
  barrels: Barrel[];
  state: GameState;
  isHumanRow: boolean;
}) {
  return (
    <div
      className="relative flex-1 overflow-hidden rounded-[14px] border border-[#3b2818] px-[26px] pb-[18px] pt-[26px]"
      style={{
        minHeight: 280,
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
        className="absolute left-1/2 top-[-2px] -translate-x-1/2 rounded-b-[6px] px-3.5 py-[3px] font-mono text-[9px] font-bold uppercase tracking-[.22em]"
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
        className="relative mt-1.5 grid items-end gap-[22px]"
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
          return (
            <EmptySlot
              key={slot.id}
              slot={slot}
              state={state}
              isHumanRow={isHumanRow}
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

  const onClick = () => {
    if (barrel && saleable) {
      setSellBarrel(barrel.id);
      return;
    }
    if (barrel && ageable) {
      setAgeBarrel(barrel.id);
      return;
    }
    if (isLegalClickMake) {
      try {
        dispatch({
          type: "MAKE_BOURBON",
          playerId: ownerId,
          slotId: slot.id,
          cardIds: selectedHandCardIds,
        });
        clearHandSelection();
      } catch {
        /* swallow */
      }
      return;
    }
    if (isLegalClickAge && barrel) {
      try {
        dispatch({
          type: "AGE_BOURBON",
          playerId: ownerId,
          barrelId: barrel.id,
          cardId: selectedHandCardIds[0]!,
        });
        clearHandSelection();
      } catch {
        /* swallow */
      }
      return;
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
    if (!isLegalForDrag) return;
    if (!dragCarriesMakeCard(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragHover) setDragHover(true);
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
    if (canDropAge && barrel) {
      if (cardIds.length !== 1) return;
      const action = {
        type: "AGE_BOURBON" as const,
        playerId: ownerId,
        barrelId: barrel.id,
        cardId: cardIds[0]!,
      };
      if (!validateAction(state, action).legal) return;
      try {
        dispatch(action);
        clearHandSelection();
      } catch {
        /* swallow */
      }
      return;
    }
    const action = {
      type: "MAKE_BOURBON" as const,
      playerId: ownerId,
      slotId: slot.id,
      cardIds,
    };
    if (!validateAction(state, action).legal) return;
    try {
      dispatch(action);
      clearHandSelection();
    } catch {
      /* swallow */
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
            resources stack on barrels waiting for cards. */}
        {isAging ? (
          <span
            aria-hidden
            className="ember absolute left-1/2 top-1/2 grid h-[50px] w-[50px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, #f0c970, #c69d52 60%, #6b3d1d 100%)",
              boxShadow: `inset 0 2px 3px rgba(255,255,255,.4), inset 0 -2px 4px rgba(0,0,0,.5), 0 0 12px ${band.glow}`,
            }}
          >
            <span
              className="font-display text-[22px] font-bold leading-none"
              style={{ color: "#2a1a10" }}
            >
              {barrel.age}
            </span>
            <span
              className="absolute bottom-[5px] font-mono text-[7px] font-bold tracking-[.2em]"
              style={{ color: "#2a1a10" }}
            >
              YR
            </span>
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

type SubKey = "cask" | "corn" | "rye" | "barley" | "wheat";

interface BarrelNeed {
  subtype: SubKey;
  count: number;
}

/**
 * What's still required to advance this barrel to aging — recipe
 * minimums minus already-committed cards. Mirrors MashPips' tally
 * logic but returns the OUTSTANDING counts only (positives) so the
 * caller can render a compact "still needs" overlay.
 *
 * Subtypes appear in the canonical cask→corn→rye→barley→wheat order
 * so multiple barrels read consistently.
 */
function computeBarrelNeeds(barrel: Barrel): BarrelNeed[] {
  const tally: Record<SubKey, number> = {
    cask: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
  };
  for (const c of barrel.productionCards) {
    if (c.type !== "resource" || !c.subtype) continue;
    const n = c.resourceCount ?? 1;
    if (c.subtype in tally) tally[c.subtype as SubKey] += n;
  }
  const recipe = barrel.attachedMashBill?.recipe ?? {};
  const mins: Record<SubKey, number> = {
    cask: 1,
    corn: Math.max(1, recipe.minCorn ?? 0),
    rye: recipe.minRye ?? 0,
    barley: recipe.minBarley ?? 0,
    wheat: recipe.minWheat ?? 0,
  };
  const out: BarrelNeed[] = [];
  for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as SubKey[]) {
    const need = Math.max(0, mins[sub] - tally[sub]);
    if (need > 0) out.push({ subtype: sub, count: need });
  }
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
        className="absolute left-1/2 top-1/2 grid h-[58px] w-[58px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
        style={{
          background:
            "radial-gradient(circle at 35% 30%, rgba(125,166,223,.55), rgba(50,80,120,.55) 65%, rgba(20,30,50,.55) 100%)",
          boxShadow:
            "inset 0 2px 3px rgba(255,255,255,.2), inset 0 -2px 4px rgba(0,0,0,.5), 0 0 10px rgba(125,166,223,.4)",
        }}
      >
        <span className="font-display text-[24px] font-bold text-sky-100">?</span>
      </span>
    );
  }
  return (
    <span
      aria-hidden
      className="absolute left-1/2 top-1/2 flex max-w-[120px] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-[3px] rounded-md px-2 py-1.5"
      style={{
        background:
          "linear-gradient(180deg, rgba(8,10,14,.86), rgba(4,6,10,.94))",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.10), inset 0 -1px 0 rgba(0,0,0,.6), 0 2px 8px rgba(0,0,0,.55)",
        border: "1px solid rgba(125,166,223,.55)",
      }}
    >
      <span
        className="font-mono text-[10px] font-bold uppercase tracking-[.16em] text-sky-200/90"
      >
        Needs
      </span>
      {needs.slice(0, 4).map((n) => (
        <span
          key={n.subtype}
          className="flex items-center gap-1.5 font-mono text-[14px] font-bold leading-none"
          style={{ color: SUB_INK[n.subtype] }}
        >
          <span className="tabular-nums">{n.count}×</span>
          <span className="flex h-4 w-4 items-center justify-center text-[14px]">
            {RESOURCE_GLYPH[n.subtype]}
          </span>
        </span>
      ))}
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
          style={{ color: band.ink, fontSize: 10.5, letterSpacing: ".16em" }}
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
            style={{ color: band.ink, opacity: 0.75, fontSize: 11 }}
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
        fontSize: 10.5,
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
  const tally: Record<string, number> = {
    cask: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
  };
  for (const c of barrel.productionCards) {
    if (c.type !== "resource" || !c.subtype) continue;
    const n = c.resourceCount ?? 1;
    if (c.subtype in tally) tally[c.subtype] = (tally[c.subtype] ?? 0) + n;
  }
  const recipe = barrel.attachedMashBill?.recipe ?? {};
  const minimums = {
    cask: 1,
    corn: Math.max(1, recipe.minCorn ?? 0),
    rye: recipe.minRye ?? 0,
    barley: recipe.minBarley ?? 0,
    wheat: recipe.minWheat ?? 0,
  } as Record<string, number>;
  const recipeSatisfied = barrel.phase === "aging";

  const pips: ReactNode[] = [];
  for (const sub of ["cask", "corn", "rye", "barley", "wheat"] as const) {
    const have = tally[sub] ?? 0;
    const need = recipeSatisfied ? 0 : minimums[sub] ?? 0;
    const slots = Math.max(have, need);
    for (let i = 0; i < slots; i++) {
      const filled = i < have;
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
}: {
  slot: RickhouseSlot;
  state: GameState;
  isHumanRow: boolean;
}) {
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
              className="grid h-[18px] w-[18px] place-items-center rounded-full font-display text-[11px]"
              style={{
                border: "1px solid var(--whisper)",
                color: "var(--mute)",
              }}
            >
              +
            </span>
            <span
              className="font-mono text-[9px] font-bold uppercase tracking-[.24em]"
              style={{ color: "var(--whisper)" }}
            >
              Open
            </span>
          </div>
        </div>
      </div>
      <div
        className="mt-3 w-full rounded-[9px] border text-center font-mono uppercase"
        style={{
          padding: "12px 12px",
          fontSize: 12,
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
