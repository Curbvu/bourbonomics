"use client";

/**
 * Per-player rickhouse panel — one card per player.
 *
 * Replaces the standalone "Barons" tab: each panel now folds in the
 * player's full status (reputation, distillery name, hand/deck/discard
 * counts, bills/ops/gold/sold counters) on top of the slot grid.
 *
 * v2.2: bonded/upper tier distinction removed — flat single-row slot grid. Visual tells
 * highlight the current player (action phase) and the round-end rank
 * once the game is over.
 */

import type { Barrel, Card, GameState, RickhouseSlot } from "@bourbonomics/engine";
import { validateAction } from "@bourbonomics/engine";
import { useState } from "react";
import { useGameStore } from "@/lib/store/game";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";
import PlayerSwatch from "./PlayerSwatch";
import { useZoneFocusClass } from "./pickerFocus";
import { TIER_CHROME, tierOrCommon } from "./tierStyles";
import { dragCarriesMakeCard, readMakeDragPayload } from "./dragMake";

export default function RickhouseRow() {
  const { state } = useGameStore();
  if (!state) return null;

  return (
    <section data-rickhouse-row="true" className="flex flex-col gap-1">
      {/* Per-panel min adjusted for the 100×140 silhouette: 4 slots +
          3 gaps + panel padding ≈ 460px. Auto-fit so a 2-player game
          gets wider panels and a 4-player game wraps rather than
          cramming. */}
      <div className="grid gap-1.5 [grid-template-columns:repeat(auto-fit,minmax(460px,1fr))]">
        {state.players.map((p, i) => (
          <PlayerRickhouse key={p.id} state={state} playerId={p.id} seatIndex={i} />
        ))}
      </div>
    </section>
  );
}

function PlayerRickhouse({
  state,
  playerId,
  seatIndex,
}: {
  state: GameState;
  playerId: string;
  seatIndex: number;
}) {
  const { seatMeta, scores } = useGameStore();
  const player = state.players.find((p) => p.id === playerId)!;
  const palIdx = paletteIndex(seatIndex);
  const myBarrels = state.allBarrels.filter((b) => b.ownerId === playerId);
  const allSlots = player.rickhouseSlots;
  const isCurrent = state.phase === "action" && state.players[state.currentPlayerIndex]?.id === playerId;
  const meta = seatMeta.find((m) => m.id === playerId);
  const rank = scores?.find((s) => s.playerId === playerId)?.rank;
  // Barrels in this row are clickable in age mode iff they belong to the
  // human player and are currently ageable (not inspected, not already
  // aged this round unless a Rushed Shipment bonus is available).
  const isHumanRow = !player.isBot;
  const selfFocus = useZoneFocusClass("rickhouse-self");
  const othersFocus = useZoneFocusClass("rickhouse-others");
  const focusClass = isHumanRow ? selfFocus : othersFocus;
  const zoneAttr = isHumanRow ? "rickhouse-self" : "rickhouse-others";

  return (
    <div
      data-zone={zoneAttr}
      // v2.6 drag-and-drop: opponent rickhouses dim out of the way
      // during a make-card drag (CSS rule keys off this attribute).
      data-bb-zone={isHumanRow ? undefined : "opponent-rickhouse"}
      className={[
        "flex flex-col gap-1 rounded-lg border bg-slate-900/60 px-2 py-1 transition-colors",
        isCurrent ? "border-amber-500/70 bg-amber-700/[0.10]" : "border-slate-800",
        focusClass,
      ].join(" ")}
    >
      {/* Identity strip — single line: name + distillery + rep + slots
          + counters. Was three stacked rows; collapsed for vertical
          density. */}
      <header className="flex items-center gap-2 text-[9px] font-mono uppercase tracking-[.10em] text-slate-500">
        <PlayerSwatch seatIndex={seatIndex} logoId={meta?.logoId} size="sm" />
        <div className="flex min-w-0 items-baseline gap-1.5">
          <span className="truncate font-display text-[13px] font-semibold normal-case tracking-normal text-slate-100">
            {player.name}
          </span>
          {rank != null ? (
            <span className="rounded bg-amber-700/30 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[.06em] text-amber-200">
              #{rank}
            </span>
          ) : null}
          <span className="truncate text-slate-500">
            {player.distillery?.name ?? "no distillery"}
          </span>
        </div>
        <span className="flex-1" />
        <span className="text-amber-300/80">{myBarrels.length}/{player.rickhouseSlots.length}</span>
        {/* v2.6: bills are slot-bound — the slot count above already
            includes them. unlockedGoldBourbons removed (Gold awards
            now manipulate slots). */}
        <span className="text-slate-300">🛢{player.barrelsSold}</span>
        <span className="font-display text-[18px] font-bold normal-case tabular-nums tracking-normal text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,.45)]">
          {player.reputation}
        </span>
      </header>

      {/* Flat slot grid. */}
      <SlotRow
        slots={allSlots}
        barrels={myBarrels}
        state={state}
        palIdx={palIdx}
        isHumanRow={isHumanRow}
      />
    </div>
  );
}

function SlotRow({
  slots,
  barrels,
  state,
  palIdx,
  isHumanRow,
}: {
  slots: RickhouseSlot[];
  barrels: Barrel[];
  state: GameState;
  palIdx: number;
  isHumanRow: boolean;
}) {
  const renderSlot = (s: RickhouseSlot) => {
    const barrel = barrels.find((b) => b.slotId === s.id);
    if (!barrel) {
      return (
        <div
          key={s.id}
          data-slot-id={s.id}
          className="grid h-[140px] w-[100px] flex-shrink-0 place-items-center rounded-md border border-dashed border-slate-700/60 bg-slate-950/30 font-mono text-[10px] uppercase tracking-[.16em] text-slate-700"
          title="empty slot"
        >
          empty
        </div>
      );
    }
    return (
      <BarrelChip
        key={barrel.id}
        barrel={barrel}
        state={state}
        palIdx={palIdx}
        isHumanRow={isHumanRow}
      />
    );
  };

  return <div className="flex items-center gap-1">{slots.map(renderSlot)}</div>;
}

function BarrelChip({
  barrel,
  state,
  palIdx,
  isHumanRow,
}: {
  barrel: Barrel;
  state: GameState;
  palIdx: number;
  isHumanRow: boolean;
}) {
  const {
    ageMode,
    setAgeBarrel,
    sellMode,
    setSellBarrel,
    setInspect,
    dispatch,
    dragMake,
    endDragMake,
  } = useGameStore();
  const owner = state.players.find((p) => p.id === barrel.ownerId);
  const ringHints: string[] = [];
  if (barrel.agedThisRound) ringHints.push("aged this round");
  if (barrel.inspectedThisRound) ringHints.push("under inspection");
  if (barrel.extraAgesAvailable > 0) ringHints.push("rushed shipment");

  // v2.6 drag-and-drop: the human can drag a hand card straight onto
  // a slot barrel to commit it (single-card MAKE_BOURBON). Only their
  // own ready / construction slots are valid drop targets. v2.7 lets
  // a slot accept multiple commits in one turn, so the per-turn gate
  // is no longer part of `canDropMake`.
  const [dragHover, setDragHover] = useState(false);
  const canDropMake =
    isHumanRow &&
    state.phase === "action" &&
    state.players[state.currentPlayerIndex]?.id === barrel.ownerId &&
    barrel.phase !== "aging";
  // Whether this slot would actually accept the in-flight card under
  // the engine's rules (caps on cask / rye / wheat). The CSS pulse
  // only fires when the engine would also accept the drop, so the
  // player isn't lured into an illegal target.
  const isLegalForDrag =
    canDropMake &&
    dragMake != null &&
    validateAction(state, {
      type: "MAKE_BOURBON",
      playerId: barrel.ownerId,
      slotId: barrel.slotId,
      cardIds: [dragMake],
    }).legal;
  const dropTargetState = !dragMake
    ? undefined
    : isLegalForDrag
      ? dragHover
        ? "hover"
        : "valid"
      : undefined;

  // Age-mode interactivity: in age mode, the human's ageable barrels
  // light up as click targets. Clicking sets `pickedBarrelId` in the
  // store; AgeOverlay reads it and prompts the user to pick a hand card.
  // Mirrors the engine's `validateAgeBourbon` checks so highlighting and
  // legality stay in lockstep — barrels that the engine would reject
  // (still under construction, just-completed this round, inspected,
  // already aged) never light up.
  const inAgeMode = ageMode != null && isHumanRow;
  const completedThisRound =
    barrel.completedInRound != null && state.round <= barrel.completedInRound;
  const ageable =
    inAgeMode &&
    barrel.phase === "aging" &&
    !completedThisRound &&
    !barrel.inspectedThisRound &&
    (!barrel.agedThisRound || barrel.extraAgesAvailable > 0);
  const isAgePicked = inAgeMode && ageMode!.pickedBarrelId === barrel.id;

  // Sell-mode interactivity — mirrors age mode. The human's saleable
  // barrels light up (aging-phase, age ≥2, has a bill). Clicking sets
  // `pickedBarrelId` in the store; the auto-fire kicks in when the
  // hand-card pick lands.
  const inSellMode = sellMode != null && isHumanRow;
  const saleable =
    inSellMode &&
    barrel.phase === "aging" &&
    barrel.age >= 2 &&
    barrel.attachedMashBill != null;
  const isSellPicked = inSellMode && sellMode!.pickedBarrelId === barrel.id;

  // CSS keyframe (drop-target-active / drop-target-pulse) owns the
  // ring + glow + sparkle when this slot is the drag target — so we
  // skip the static ring class in that case to avoid double-styling.
  const isDragTarget = dropTargetState != null;
  const ringClass = isDragTarget
    ? ""
    : isSellPicked
      ? "ring-4 ring-amber-300 shadow-[0_0_18px_rgba(252,211,77,.6)]"
      : saleable
        ? "ring-2 ring-amber-300/70 hover:ring-amber-200 cursor-pointer"
        : isAgePicked
          ? "ring-4 ring-amber-300 shadow-[0_0_18px_rgba(252,211,77,.6)]"
          : ageable
            ? "ring-2 ring-sky-400/70 hover:ring-sky-200"
            : barrel.inspectedThisRound
              ? "ring-2 ring-rose-300/70"
              : barrel.agedThisRound
                ? "ring-2 ring-amber-300/70"
                : "";

  // Match the hand's MashBillCard idiom: WoW-style tier chrome based on
  // the attached bill's rarity. Construction-phase barrels without a
  // bill yet fall back to the slate "common" chrome but advertise their
  // unfinished state via the phase badge below.
  const tier = tierOrCommon(barrel.attachedMashBill?.tier);
  const chrome = TIER_CHROME[tier];
  const baseClass = [
    "relative flex h-[140px] w-[100px] flex-shrink-0 flex-col items-stretch overflow-hidden rounded-md border-2 p-1.5 text-left shadow-[0_4px_12px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-shadow",
    chrome.gradient,
    chrome.border,
    chrome.glow,
    ringClass,
  ].join(" ");
  const billLabel = barrel.attachedMashBill?.name ?? "no bill yet";
  const phaseLabel =
    barrel.phase === "construction"
      ? " (building)"
      : barrel.phase === "ready"
        ? " (staged)"
        : "";
  const titleText = `${owner?.name ?? "?"} · ${billLabel} · age ${barrel.age}${phaseLabel}${
    ringHints.length ? " (" + ringHints.join(", ") + ")" : ""
  }${ageable ? " — click to age this barrel" : ""}`;

  // Click behaviour:
  //   - Sell mode + barrel is saleable → pick it as the sell target.
  //     Auto-fires once the hand card is also picked.
  //   - Age mode + barrel is a legal age target → pick it. Auto-fires
  //     once the hand card is also picked.
  //   - Otherwise → open the inspect modal so the player can see
  //     mash bill, age, committed cards, awards, etc.
  const onClick = () => {
    if (saleable) setSellBarrel(barrel.id);
    else if (ageable) setAgeBarrel(barrel.id);
    else setInspect({ kind: "barrel", barrel, ownerName: owner?.name });
  };
  // Drag-and-drop handlers — gated on isLegalForDrag so opponents'
  // slots, finished barrels, slots already touched this turn, and
  // slots that would over-fill a recipe cap never accept the drop.
  // The engine validates again at dispatch time as a final guard.
  const onDragOver = (e: React.DragEvent) => {
    if (!isLegalForDrag) return;
    if (!dragCarriesMakeCard(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragHover) setDragHover(true);
  };
  const onDragLeave = () => {
    if (dragHover) setDragHover(false);
  };
  const onDrop = (e: React.DragEvent) => {
    setDragHover(false);
    endDragMake();
    if (!canDropMake) return;
    const cardId = readMakeDragPayload(e);
    if (!cardId) return;
    e.preventDefault();
    const action = {
      type: "MAKE_BOURBON" as const,
      playerId: barrel.ownerId,
      slotId: barrel.slotId,
      cardIds: [cardId],
    };
    if (!validateAction(state, action).legal) return;
    try {
      dispatch(action);
    } catch {
      // Defensive — validation passed but apply threw. Keep the UI
      // alive; the player can try a different card.
    }
  };

  return (
    <button
      type="button"
      title={
        canDropMake
          ? `${titleText} — drag a hand card here to commit, or click to inspect`
          : ageable
            ? titleText
            : `${titleText} — click to inspect`
      }
      data-slot-id={barrel.slotId}
      data-drop-target={dropTargetState}
      onClick={onClick}
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`${baseClass} cursor-pointer hover:brightness-110`}
    >
      <BarrelChipInner barrel={barrel} chrome={chrome} palIdx={palIdx} />
    </button>
  );
}

/**
 * Barrel face — same idiom as `MashBillCard` (tier chrome, name +
 * slogan + reward range) with three barrel-specific overlays:
 *
 *   1. **Owner stripe** along the top edge in the player's seat colour
 *      so you can tell whose barrel this is even when the tier chrome
 *      is the same as a neighbour's.
 *   2. **Phase·age stamp** in the top-right (where MashBillCard puts
 *      the gold/silver award icon). Three states:
 *        - "STAGED"    — bill present, no commits yet (slate badge)
 *        - "BUILDING"  — partial commits, recipe not yet met (sky badge)
 *        - "AGING · Ny"— recipe complete, barrel maturing (amber badge)
 *   3. **Composition pips** along the bottom showing every committed
 *      card by subtype colour (filled for production, ring-only for
 *      aging cards). Lets the player audit the recipe at a glance
 *      without flipping the barrel.
 */
function BarrelChipInner({
  barrel,
  chrome,
  palIdx,
}: {
  barrel: Barrel;
  chrome: (typeof TIER_CHROME)[keyof typeof TIER_CHROME];
  palIdx: number;
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
  const phaseStamp =
    barrel.phase === "aging"
      ? {
          label: `Aging · ${barrel.age}y`,
          className:
            "rounded border border-amber-400/60 bg-amber-700/30 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[.10em] text-amber-200",
        }
      : barrel.phase === "construction"
        ? {
            label: "Building",
            className:
              "rounded border border-sky-400/60 bg-sky-700/30 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[.10em] text-sky-200",
          }
        : {
            // "ready" — bill in slot, no committed cards yet.
            label: "Staged",
            className:
              "rounded border border-slate-500/70 bg-slate-700/40 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[.10em] text-slate-200",
          };

  return (
    <>
      {/* Owner stripe — thin band of the player's seat colour pinned to
          the top edge so identity reads even at a glance. */}
      <div
        className={`pointer-events-none absolute inset-x-0 top-0 h-1 ${PLAYER_BG_CLASS[palIdx]!} opacity-90`}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-1 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
        aria-hidden
      />
      {/* Tier label (left) + phase·age stamp (right). The stamp lives
          where MashBillCard puts its gold/silver award icon. */}
      <div className="mt-1 flex items-baseline justify-between gap-1">
        <span className={`text-[10px] font-semibold uppercase tracking-[0.16em] ${chrome.label}`}>
          {chrome.label_text}
        </span>
        <span className={phaseStamp.className}>{phaseStamp.label}</span>
      </div>
      {/* Mash bill name — same font/size as MashBillCard. */}
      <h4 className={`mt-0.5 line-clamp-2 font-display text-[13px] font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${chrome.titleInk}`}>
        {bill?.name ?? "in progress"}
      </h4>
      {/* Slogan / construction hint. */}
      {bill?.slogan ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[8px] italic leading-snug ${chrome.label} opacity-90`}>
          {bill.slogan}
        </p>
      ) : !bill ? (
        <p className={`mt-0.5 line-clamp-2 font-display text-[8px] italic leading-snug ${chrome.label} opacity-90`}>
          attach a bill on a future commit
        </p>
      ) : null}
      {/* Reward range (mash bill grid). Anchored at the bottom-third
          like MashBillCard, but slightly tighter to leave room for the
          composition pips. */}
      <div className="mt-auto flex items-baseline justify-center gap-1">
        <span className={`font-display text-[14px] font-bold leading-none tabular-nums ${chrome.titleInk}`}>
          {bill ? `${floor}–${peak}` : "—"}
        </span>
        <span className={`font-mono text-[7.5px] uppercase tracking-[.16em] ${chrome.label}`}>
          rep
        </span>
      </div>
      {/* Mash pips (production-only, recipe legibility).
          - **Required** ingredients (from the attached bill's recipe +
            the universal min) appear as **hollow rings** in the
            subtype's colour. As production cards are committed they
            "fill in".
          - **Committed** production cards beyond the recipe minimum
            appear as extra **filled** pips (over-commits don't
            increase the payout but the visual record stays). */}
      <div className="mt-1 flex min-h-[14px] flex-wrap items-end justify-center gap-[3px] rounded bg-black/35 px-1 py-0.5">
        {renderMashPips(barrel)}
      </div>
      {/* Aging row (years committed). Visually distinct from the mash
          row above — amber whisky dots on a slightly tinted track —
          so production-pile vs aging-pile can never be misread as the
          same composition. Hidden when the barrel hasn't aged. */}
      {barrel.agingCards.length > 0 || barrel.phase === "aging" ? (
        <div
          className="mt-0.5 flex min-h-[12px] items-center justify-center gap-[3px] rounded bg-amber-950/40 px-1 py-0.5"
          title={`Aged ${barrel.age} year${barrel.age === 1 ? "" : "s"}`}
        >
          {renderAgingPips(barrel)}
        </div>
      ) : null}
    </>
  );
}

const PIP_COLORS: Record<string, string> = {
  cask: "bg-amber-400",
  corn: "bg-yellow-300",
  rye: "bg-red-400",
  barley: "bg-teal-300",
  wheat: "bg-cyan-300",
};

const PIP_RING: Record<string, string> = {
  cask: "ring-amber-400/70",
  corn: "ring-yellow-300/70",
  rye: "ring-red-400/70",
  barley: "ring-teal-300/70",
  wheat: "ring-cyan-300/70",
};

const SUBTYPE_ORDER = ["cask", "corn", "rye", "barley", "wheat"] as const;
type Sub = (typeof SUBTYPE_ORDER)[number];

interface Tally {
  cask: number;
  corn: number;
  rye: number;
  barley: number;
  wheat: number;
}

function emptyTally(): Tally {
  return { cask: 0, corn: 0, rye: 0, barley: 0, wheat: 0 };
}

/**
 * Tally subtype counts in a card list, honouring `resourceCount`
 * (premium 2-rye etc.) but treating cask sources as a binary
 * "1 cask required" — extras land in `cask` as additional units that
 * the renderer can still show.
 */
function tallySubtypes(cards: Card[]): Tally {
  const t = emptyTally();
  for (const c of cards) {
    if (c.type !== "resource" || !c.subtype) continue;
    const n = c.resourceCount ?? 1;
    if (c.subtype === "cask") t.cask += n;
    else if (c.subtype === "corn") t.corn += n;
    else if (c.subtype === "rye") t.rye += n;
    else if (c.subtype === "barley") t.barley += n;
    else if (c.subtype === "wheat") t.wheat += n;
  }
  return t;
}

/**
 * Required ingredient minimums for an attached bill, factoring in the
 * universal rule (1 cask, ≥1 corn, ≥1 grain). Returns `null` for an
 * unattached bill — nothing is required yet.
 */
function recipeMinimums(barrel: Barrel): Tally | null {
  if (!barrel.attachedMashBill) return null;
  const r = barrel.attachedMashBill.recipe ?? {};
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;
  const namedGrain = minRye + minBarley + minWheat;
  // Universal min-1-grain rule: if no named grain is required, assume
  // 1 wild grain (we surface it under whichever grain is not banned).
  const wildGrain = Math.max(0, (r.minTotalGrain ?? 0) - namedGrain);
  const minimums: Tally = {
    cask: 1,
    corn: Math.max(1, r.minCorn ?? 0),
    rye: minRye,
    barley: minBarley,
    wheat: minWheat,
  };
  // Fold any wild-grain requirement into a non-banned grain bucket so
  // the player sees pips. Prefer barley (rarely banned), then wheat,
  // then rye.
  const banned = new Set<Sub>();
  if (r.maxRye === 0) banned.add("rye");
  if (r.maxWheat === 0) banned.add("wheat");
  let wildLeft = wildGrain;
  if (namedGrain === 0 && wildLeft === 0) wildLeft = 1;
  for (const sub of ["barley", "wheat", "rye"] as const) {
    if (wildLeft <= 0) break;
    if (banned.has(sub)) continue;
    minimums[sub] += wildLeft;
    wildLeft = 0;
  }
  return minimums;
}

/**
 * Mash pips — production-pile only. Aging cards have their own row
 * below (renderAgingPips) so the two phases never share a track and
 * a player can read recipe progress without filtering out aging dots.
 */
function renderMashPips(barrel: Barrel) {
  const committed = tallySubtypes(barrel.productionCards);
  const required = recipeMinimums(barrel);

  const pips: React.ReactNode[] = [];
  for (const sub of SUBTYPE_ORDER) {
    const have = committed[sub];
    const need = required ? required[sub] : 0;
    const slots = Math.max(have, need);
    for (let i = 0; i < slots; i++) {
      const isFilled = i < have;
      pips.push(
        <span
          key={`${sub}-${i}`}
          className={[
            "inline-block h-2 w-2 rounded-full",
            isFilled
              ? PIP_COLORS[sub]
              : `bg-transparent ring-2 ${PIP_RING[sub]}`,
          ].join(" ")}
          aria-hidden
        />,
      );
    }
  }

  if (pips.length === 0) {
    return (
      <span className="font-mono text-[7px] uppercase tracking-[.10em] text-slate-500">
        empty
      </span>
    );
  }
  return <>{pips}</>;
}

/**
 * Aging pips — one amber dot per year aged on this barrel. Dedicated
 * row in its own track so it can't be confused with the mash row's
 * recipe pips. Skinnier and a different color (whisky amber) than the
 * mash pips for unmistakable visual separation.
 */
function renderAgingPips(barrel: Barrel) {
  const years = barrel.age;
  if (years <= 0) {
    return (
      <span className="font-mono text-[7px] uppercase tracking-[.10em] text-amber-300/60">
        not aged
      </span>
    );
  }
  const pips: React.ReactNode[] = [];
  for (let i = 0; i < years; i++) {
    pips.push(
      <span
        key={`aging-${i}`}
        className="inline-block h-1.5 w-3 rounded-full bg-amber-300 shadow-[0_0_4px_rgba(252,211,77,.55)]"
        aria-hidden
      />,
    );
  }
  return (
    <>
      {pips}
      <span className="ml-1 font-mono text-[8px] font-semibold uppercase tracking-[.10em] text-amber-200/85 tabular-nums">
        {years}y
      </span>
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-1 rounded bg-slate-950/40 px-1.5 py-0.5">
      <span>{label}</span>
      <span className="font-sans text-[11px] tabular-nums text-slate-200">{value}</span>
    </div>
  );
}
