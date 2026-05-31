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
import type {
  Barrel,
  GameState,
  MashBill,
  PlayerState,
  RickhouseSlot,
} from "@bourbonomics/engine";
import {
  computeRecipeFloors,
  computeReward,
  getPortfolio,
  validateAction,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import BuyOverlay from "./BuyOverlay";
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
        {/* Stage tag strip ("Your Distillery" + filled/total slots)
             retired — the distillery name renders directly on the
             IdentityPlate below, and the slot occupancy is implicit
             from the rickhouse rendering. */}

        {/* 1. Identity plate — capital + rep on the left, distillery
             name + flavor + ability in the middle, the compact Brand
             Portfolio chip + sold/prestige/warehouse readouts on the
             right. The old bottom-of-stage roomy LineStrip got rolled
             into the chip; players click the chip to open the
             BrandPortfolioDrawer for the full board. */}
        <IdentityPlate
          name={distillery.name}
          flavor={distillery.flavorText ?? ""}
          ability={distillery.cardText ?? ""}
          capital={player.capital}
          reputation={player.reputation}
          sold={player.barrelsSold}
          prestige={player.prestige}
          warehouseUnlocked={player.warehouseUnlocked}
          warehouseFilled={player.warehouseSlot != null}
          player={player}
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
  capital,
  reputation,
  sold,
  prestige,
  warehouseUnlocked,
  warehouseFilled,
  player,
}: {
  name: string;
  flavor: string;
  ability: string;
  /** Mid-game spendable + 1:1 final-score number. The big gold readout. */
  capital: number;
  /** End-game accumulator — Brand Portfolio events fire here. Smaller
   *  readout next to capital so the player can track both scoreboards. */
  reputation: number;
  sold: number;
  prestige: number;
  /** v3.5 — true once the player buys the Warehouse investment. */
  warehouseUnlocked: boolean;
  /** v3.5 — true when something is currently stored in the warehouse. */
  warehouseFilled: boolean;
  /** Threaded down for the PortfolioChip — needs flagship state +
   *  inventory count to render the diminished summary. */
  player: PlayerState;
}) {
  return (
    <div
      className="relative grid items-center gap-[18px] overflow-hidden rounded-[12px] border border-[#3b2818] px-[22px] py-[8px]"
      style={{
        // crest · Capital+Rep · name+ability · sold/prestige/warehouse · portfolio chip
        gridTemplateColumns: "auto auto 1fr auto auto",
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

      {/* Capital + Rep — side-by-side scoreboard between the crest
          and the title. Capital is the spendable wallet + 1:1 final
          score (the big gold number); Reputation is the end-game-only
          accumulator that fires from Brand Portfolio events (smaller,
          brass-tinted). Dashed right rule mirrors the divider before
          the Sold column. `data-bb-zone="reputation"` anchors the
          tutorial spotlight here. */}
      <div
        data-bb-zone="reputation"
        className="flex items-end gap-[14px] leading-none"
        style={{
          paddingRight: 18,
          borderRight: "1px dashed rgba(110,80,50,.45)",
        }}
      >
        <div className="flex flex-col items-center justify-center leading-none">
          <span
            className="font-display font-bold tracking-[.01em]"
            style={{
              fontSize: 56,
              lineHeight: 0.9,
              color: "var(--gold)",
              textShadow:
                "0 1px 0 rgba(0,0,0,.5), 0 0 22px rgba(240,201,112,.35)",
            }}
          >
            {capital}
          </span>
          <span
            className="label-sm mt-1.5"
            style={{ color: "var(--brass)" }}
          >
            Capital
          </span>
        </div>
        <div className="flex flex-col items-center justify-center leading-none">
          <span
            className="font-display font-bold tracking-[.01em]"
            style={{
              fontSize: 36,
              lineHeight: 0.9,
              color: "var(--ink)",
              textShadow: "0 1px 0 rgba(0,0,0,.5)",
            }}
            title="End-game reputation — Brand Portfolio scoring fires here"
          >
            {reputation}
          </span>
          <span
            className="label-sm mt-1.5"
            style={{ color: "var(--mute)" }}
          >
            Rep
          </span>
        </div>
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

      {/* Diminished Brand Portfolio chip — replaces the old roomy
          LineStrip at the bottom of the stage. Click opens the
          BrandPortfolioDrawer for the full tier board + slot picker.
          Stamps `data-bb-zone="prestige"`-adjacent — the chip itself
          is a single click target, no inner tooltips to fight. */}
      <PortfolioChip player={player} />
    </div>
  );
}

/**
 * Compact one-click Brand Portfolio entry chip — lives in the top-right
 * of the IdentityPlate. Two-row layout: top reads as a riveted brass
 * placard with the brand mark + flagship name + CTA, bottom is a
 * data row carrying slot dots + filled count + a labeled inventory
 * readout. The full board (tier groups, slot details, second
 * portfolio) lives in the drawer the chip opens.
 *
 * When the player has a `pendingBottlePlacement`, the chip pulses
 * gold + swaps its CTA to "Place →" so the player can't miss that
 * the sale is mid-resolution and a placement choice is owed.
 */
function PortfolioChip({ player }: { player: PlayerState }) {
  const { setPortfolioDrawerOpen } = useGameStore();
  const flagshipId = player.flagshipPortfolio.portfolioId;
  const flagship = flagshipId ? getPortfolio(flagshipId) : null;
  if (!flagship) return null;
  const slots = player.flagshipPortfolio.slots;
  const filled = slots.filter((s) => s.filled).length;
  const total = slots.length;
  const inventory = player.inventory.length;
  const pending = player.pendingBottlePlacement != null;
  // Short version of the flagship name — keeps the chip from blowing
  // out the IdentityPlate's right column when the name is long. Picks
  // off the redundant "Reserve"/"Collection"/"Lineup" suffix.
  const shortName = flagship.name
    .replace(/\s+(Reserve|Collection|Lineup|Selection|Vault)$/, "")
    .slice(0, 22);
  return (
    <button
      type="button"
      onClick={() => setPortfolioDrawerOpen(true)}
      title={
        pending
          ? "Place your sold bottle — click to open the portfolio board"
          : `Open your Brand Portfolio · ${flagship.name} · ${filled}/${total} slots filled · ${inventory} bottle${inventory === 1 ? "" : "s"} in inventory`
      }
      className={`group relative flex flex-col items-stretch gap-[3px] rounded-[8px] border px-3 py-1.5 text-left transition-all hover:-translate-y-[1px] hover:brightness-[1.08] ${
        pending ? "bb-onclock-pulse" : ""
      }`}
      style={{
        minWidth: 220,
        borderColor: pending ? "var(--gold)" : "rgba(198,157,82,.55)",
        background:
          "radial-gradient(140% 120% at 0% 0%, rgba(240,201,112,.16), transparent 60%), linear-gradient(180deg, rgba(58,40,24,.92), rgba(20,14,8,.95))",
        boxShadow: pending
          ? "0 0 0 1px rgba(240,201,112,.55), 0 6px 18px rgba(240,201,112,.28), inset 0 1px 0 rgba(240,201,112,.25)"
          : "inset 0 1px 0 rgba(240,201,112,.22), inset 0 -1px 0 rgba(0,0,0,.45), 0 4px 14px rgba(0,0,0,.4)",
      }}
    >
      {/* Brass corner ornament — mirrors the IdentityPlate's own
          corner detail so the chip reads as a sibling of the plate
          rather than a foreign tile. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 h-5 w-5"
        style={{
          background:
            "linear-gradient(135deg, rgba(240,201,112,.45), transparent 65%)",
          borderTopLeftRadius: 8,
        }}
      />

      {/* Row 1 — brand mark + label + flagship name + CTA */}
      <div className="flex items-center gap-2 leading-none">
        <span
          aria-hidden
          className="font-display"
          style={{
            fontSize: 13,
            color: "var(--gold)",
            textShadow: "0 0 8px rgba(240,201,112,.55)",
          }}
        >
          ⌬
        </span>
        <span
          className="font-mono font-bold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: ".22em",
            color: "var(--brass)",
          }}
        >
          Brand Portfolio
        </span>
        <span
          aria-hidden
          className="h-2.5 w-px self-center"
          style={{ background: "rgba(198,157,82,.4)" }}
        />
        <span
          className="truncate font-display"
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink)",
            maxWidth: 110,
            textShadow: "0 0 6px rgba(240,201,112,.25)",
          }}
        >
          {shortName}
        </span>
        <span
          className="ml-auto rounded border px-1.5 py-[2px] font-mono font-bold uppercase"
          style={{
            fontSize: 9,
            letterSpacing: ".14em",
            borderColor: pending ? "var(--gold)" : "rgba(198,157,82,.55)",
            background: pending
              ? "linear-gradient(180deg, rgba(240,201,112,.35), rgba(176,106,56,.18))"
              : "linear-gradient(180deg, rgba(240,201,112,.16), rgba(34,23,16,.65))",
            color: "var(--gold)",
          }}
        >
          {pending ? "Place →" : "Open ↗"}
        </span>
      </div>

      {/* Row 2 — slot dots + filled/total · inventory readout */}
      <div className="flex items-center gap-2.5 leading-none">
        <span className="flex items-center gap-[4px]">
          {slots.map((s, i) => (
            <span
              key={i}
              aria-hidden
              className="inline-block h-[7px] w-[7px] rounded-full"
              style={{
                background: s.filled
                  ? "radial-gradient(circle at 35% 30%, #f0c970, #6b3d1d 90%)"
                  : "transparent",
                border: s.filled ? "0" : "1px solid rgba(198,157,82,.55)",
                boxShadow: s.filled
                  ? "0 0 6px rgba(240,201,112,.55)"
                  : "none",
              }}
            />
          ))}
        </span>
        <span
          className="font-mono font-bold tabular-nums"
          style={{
            fontSize: 11,
            color: "var(--gold)",
          }}
        >
          {filled}/{total}
        </span>
        <span
          aria-hidden
          className="h-2.5 w-px"
          style={{ background: "rgba(198,157,82,.4)" }}
        />
        {/* Inventory readout — promoted from "▥ 0" to a labeled,
            two-element pair so the count reads as inventory at a
            glance. Number gets a tabular gold treatment, label sits
            beside it in mono uppercase. */}
        <span
          className="flex items-baseline gap-1"
          title={`${inventory} bottle${inventory === 1 ? "" : "s"} in inventory`}
        >
          <span aria-hidden style={{ color: "var(--brass)", fontSize: 11 }}>
            ▥
          </span>
          <span
            className="font-display font-bold tabular-nums"
            style={{
              fontSize: 13,
              color: inventory > 0 ? "var(--gold)" : "var(--ink-muted)",
              textShadow:
                inventory > 0 ? "0 0 6px rgba(240,201,112,.4)" : "none",
            }}
          >
            {inventory}
          </span>
          <span
            className="font-mono font-bold uppercase"
            style={{
              fontSize: 8.5,
              letterSpacing: ".18em",
              color: "var(--brass)",
            }}
          >
            Inventory
          </span>
        </span>
      </div>
    </button>
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
  const { sellBarrelNow } = useGameStore();
  const tier = tierOrCommon(barrel.attachedMashBill?.tier);
  const band = TIER_BAND[tier]!;
  const bill = barrel.attachedMashBill;
  const selected = interaction.isSellPicked || interaction.isAgePicked;
  const titleText = `${bill?.name ?? "in progress"} · age ${barrel.age}${
    barrel.phase === "aging" ? "" : ` (${barrel.phase})`
  }`;

  // Outer was a <button> but now contains the on-barrel Sell button —
  // nested-button is invalid HTML. Switched to <div role="button"> with
  // keyboard support so the cell still acts as a single clickable
  // target while permitting an inline interactive Sell control.
  return (
    <div
      role="button"
      tabIndex={0}
      data-slot-id={slot.id}
      data-drop-target={interaction.dropTargetState}
      onClick={interaction.onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          interaction.onClick();
        }
      }}
      onContextMenu={interaction.onContextMenu}
      onDragOver={interaction.onDragOver}
      onDragEnter={interaction.onDragEnter}
      onDragLeave={interaction.onDragLeave}
      onDrop={interaction.onDrop}
      title={titleText}
      className="group relative flex cursor-pointer flex-col items-stretch border-0 bg-transparent p-0 text-left transition-transform focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
      style={{
        transform: selected ? "translateY(-6px)" : "translateY(0)",
      }}
    >
      <Barrel barrel={barrel} band={band} selected={selected} />

      {/* On-barrel one-click Sell button — the cell's last child so it
          reads as the barrel's plinth. Renders only when saleable
          (`age >= 2`, aging, not sale-locked this round) AND a bill is
          attached (the engine can't pay without a recipe). Label spells
          out the *projected* capital payout via `computeReward` so the
          player can compare barrels at a glance — engine recomputes
          on apply with tier-floor + bonuses, so this is a baseline
          (actual ≥ shown).

          `stopPropagation` keeps the cell's own onClick (which engages
          age mode or opens inspect) from firing alongside. */}
      {isHumanRow && interaction.saleable && bill ? (
        <button
          type="button"
          data-bb-action="sell-barrel"
          onClick={(e) => {
            e.stopPropagation();
            sellBarrelNow(barrel.id);
          }}
          title={`Sell this barrel — projected ${computeReward(bill, barrel.age, state.demand, { demandBandOffset: barrel.demandBandOffset, gridRepOffset: barrel.gridRepOffset })} capital. Pick inventory or a portfolio slot on the popup that follows.`}
          className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-md border px-2.5 py-1.5 font-mono font-bold uppercase tracking-[.16em] transition-colors"
          style={{
            fontSize: 13,
            borderColor: "var(--gold)",
            background:
              "linear-gradient(180deg, rgba(240,201,112,.18), rgba(176,106,56,.12))",
            color: "var(--gold)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.10)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(180deg, #f0c970, #c69d52)";
            e.currentTarget.style.color = "#1a120b";
            e.currentTarget.style.boxShadow =
              "inset 0 1px 0 rgba(255,255,255,.4), 0 4px 12px rgba(240,201,112,.35)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background =
              "linear-gradient(180deg, rgba(240,201,112,.18), rgba(176,106,56,.12))";
            e.currentTarget.style.color = "var(--gold)";
            e.currentTarget.style.boxShadow =
              "inset 0 1px 0 rgba(255,255,255,.10)";
          }}
        >
          Sell for{" "}
          {computeReward(bill, barrel.age, state.demand, {
            demandBandOffset: barrel.demandBandOffset,
            gridRepOffset: barrel.gridRepOffset,
          })}{" "}
          capital
        </button>
      ) : null}
    </div>
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
  const bill = barrel.attachedMashBill;
  // Rep range — min/max of the bill's reward grid, used on the bottom
  // burned-in plate. Cheap inline scan (rewardGrid is small) so the
  // plate doesn't need a separate caption component.
  let floor = 0;
  let peak = 0;
  if (bill) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const row of bill.rewardGrid) {
      for (const c of row) {
        if (c == null) continue;
        if (c < lo) lo = c;
        if (c > hi) hi = c;
      }
    }
    if (lo !== Infinity) {
      floor = lo;
      peak = hi;
    }
  }
  return (
    <div className="relative grid h-[208px] w-full place-items-center">
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
          height: 200,
          borderRadius: "44% / 16%",
          // `overflow: hidden` clips the charred chime rims (added
          // below) to the ellipse so the burnt ends don't square off
          // the outside of the barrel.
          overflow: "hidden",
          background: isAging
            ? // 1) curved stave shading — lit center, dark edges (the
              //    "belly") so the barrel reads as a 3D round object
              //    instead of a flat vertical board.
              "linear-gradient(90deg," +
                "rgba(0,0,0,.55) 0%, rgba(0,0,0,.12) 14%," +
                "rgba(255,236,200,.10) 42%, rgba(255,236,200,.14) 50%," +
                "rgba(255,236,200,.10) 58%," +
                "rgba(0,0,0,.12) 86%, rgba(0,0,0,.55) 100%)," +
              // 2) fine stave seams — vertical 1px lines every 17px so
              //    the eye reads individual staves, not a solid board.
              "repeating-linear-gradient(90deg," +
                "rgba(0,0,0,.45) 0px, rgba(0,0,0,.45) 1px," +
                "transparent 1px, transparent 17px)," +
              // 3) wood-grain streaks — subtle near-horizontal noise so
              //    the wood reads as a natural surface.
              "repeating-linear-gradient(86deg," +
                "rgba(0,0,0,.05) 0px, rgba(0,0,0,.05) 2px," +
                "rgba(255,220,170,.03) 2px, rgba(255,220,170,.03) 5px)," +
              // 4) base oak — charred (darker) toward the ends, mid-
              //    body warmer where the curve picks up light.
              "linear-gradient(180deg,#1f130a 0%,#3a2414 14%,#4a341f 50%,#3a2414 86%,#1f130a 100%)"
            : // Neutral grey staves — reads as "raw / under construction"
              // and clearly distinct from aging's charred-bourbon wood.
              "repeating-linear-gradient(90deg," +
              "#3a3d42 0px, #3a3d42 14px," +
              "#25272a 14px, #25272a 16px," +
              "#4a4e54 16px, #4a4e54 30px," +
              "#2e3034 30px, #2e3034 32px)," +
              "linear-gradient(180deg, #444851 0%, #1d1f22 100%)",
          boxShadow: isAging
            ? // Heavier inset shadows on the edges + bottom so the
              //    curvature of the belly reads strongly.
              "inset 0 6px 10px rgba(255,255,255,.10)," +
              "inset 0 -10px 20px rgba(0,0,0,.6)," +
              "inset 18px 0 22px rgba(0,0,0,.6)," +
              "inset -18px 0 22px rgba(0,0,0,.6)," +
              "0 14px 26px rgba(0,0,0,.6)"
            : // No warm inner glow; outer shadow stays so it still
              // looks like a 3D object.
              "inset 0 4px 8px rgba(255,255,255,.05), inset 0 -10px 22px rgba(0,0,0,.65), inset 10px 0 14px rgba(0,0,0,.55), inset -10px 0 14px rgba(0,0,0,.55), 0 8px 16px rgba(0,0,0,.55)",
        }}
      >
        {/* Four riveted hoops — thicker outer bands at the chime ends,
            thinner inner bands at the quarter points. Brass on aging,
            iron-grey on non-aging. Dropped the old mid `top="50%"`
            hoop — reads cleaner with the new sheen stripe below. */}
        <Hoop top={8} thick={9} dim={!isAging} />
        <Hoop top={26} thick={6} dim={!isAging} />
        <Hoop bottom={26} thick={6} dim={!isAging} />
        <Hoop bottom={8} thick={9} dim={!isAging} />

        {/* Charred chime rims (top + bottom burnt-oak caps) + a soft
            vertical sheen down the belly. Aging-only — the grey
            "needs resources" body keeps its raw look. The medallion
            below sits on top of these at the same z-level. */}
        {isAging ? (
          <>
            <span
              aria-hidden
              className="absolute inset-x-0 top-0 h-4"
              style={{
                background:
                  "linear-gradient(180deg,#0f0805 0%,#241509 70%,transparent 100%)",
                boxShadow: "inset 0 2px 3px rgba(255,255,255,.08)",
              }}
            />
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-4"
              style={{
                background:
                  "linear-gradient(0deg,#0f0805 0%,#241509 70%,transparent 100%)",
              }}
            />
            <span
              aria-hidden
              className="absolute"
              style={{
                top: "8%",
                bottom: "8%",
                left: "38%",
                width: "12%",
                background:
                  "linear-gradient(90deg,transparent,rgba(255,240,210,.14),transparent)",
                filter: "blur(3px)",
                pointerEvents: "none",
              }}
            />
          </>
        ) : null}

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

        {/* Top burned-in plate — tier label + bill name, branded onto
            the barrel face. Aging barrels carry the full plate; non-
            aging barrels skip it so the BarrelNeedsPlate (which
            already takes the center stage) reads as the single focal
            point and the bill name surfaces via hover/inspect. */}
        {isAging ? (
          <span
            className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center justify-center gap-[2px]"
            style={{
              top: 24,
              width: "80%",
              padding: "4px 6px",
              borderRadius: 4,
              background:
                "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(20,8,4,.78) 100%)",
              boxShadow: `inset 0 1px 2px rgba(0,0,0,.85), inset 0 -1px 0 rgba(255,220,170,.10), 0 0 0 1px ${band.ink}55, 0 1px 0 rgba(255,236,200,.12)`,
            }}
          >
            <span
              className="font-mono font-bold uppercase leading-none"
              style={{
                fontSize: 8.5,
                letterSpacing: ".22em",
                color: band.ink,
                textShadow: `0 0 6px ${band.glow}`,
              }}
            >
              {band.label}
            </span>
            <span
              className="font-display font-semibold leading-tight"
              style={{
                fontSize: 12,
                color: selected ? "var(--gold)" : "var(--ink)",
                maxWidth: "100%",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                textShadow: "0 1px 0 rgba(0,0,0,.7), 0 0 4px rgba(0,0,0,.55)",
              }}
            >
              {bill?.name ?? "in progress"}
            </span>
          </span>
        ) : null}

        {/* Bottom burned-in plate — rep range + mash pips. Aging only
            (pip progress on non-aging is already conveyed by the
            BarrelNeedsPlate). */}
        {isAging ? (
          <span
            className="absolute left-1/2 flex -translate-x-1/2 items-center justify-between"
            style={{
              bottom: 24,
              width: "82%",
              padding: "4px 8px",
              borderRadius: 4,
              gap: 6,
              background:
                "linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(20,8,4,.78) 100%)",
              boxShadow: `inset 0 1px 2px rgba(0,0,0,.85), inset 0 -1px 0 rgba(255,220,170,.10), 0 0 0 1px ${band.ink}55, 0 1px 0 rgba(255,236,200,.12)`,
            }}
          >
            <span
              className="font-display font-bold leading-none"
              style={{
                fontSize: 13,
                color: band.ink,
                textShadow: `0 0 6px ${band.glow}`,
              }}
            >
              {bill ? `${floor}–${peak}` : "—"}
            </span>
            <MashPips barrel={barrel} />
          </span>
        ) : null}

        {/* Center plate — year medallion on aging barrels, needed-
            resources stack on barrels waiting for cards.
            Positioned via `inset:0 + margin:auto` so the medallion
            sits dead-center of the barrel body without fighting the
            ember-needs keyframe's own transform (translate-based
            centering was being eaten by the animation and rendering
            the medallion offset to the top). Sized at ~59% of the
            barrel width so it reads as a stamp on the front face,
            not an orb. */}
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
  thick = 6,
  dim = false,
}: {
  top?: number | string;
  bottom?: number | string;
  /** Band height in px. Use ~9 for the outer quarter-hoops, ~6 for inner. */
  thick?: number;
  /** Iron-grey band for non-aging (raw) barrels — no brass shine. */
  dim?: boolean;
}) {
  const d = Math.max(4, thick - 2); // rivet diameter
  const rivet = (left: string): React.CSSProperties => ({
    position: "absolute",
    top: "50%",
    left,
    transform: "translate(-50%,-50%)",
    width: d,
    height: d,
    borderRadius: 999,
    background: dim
      ? "radial-gradient(circle at 35% 30%, #cfc6b6, #6e6457 55%, #1f1c17 100%)"
      : "radial-gradient(circle at 35% 30%, #fff6df, #b8945a 55%, #4a2f15 100%)",
    boxShadow:
      "inset 0 -1px 1px rgba(0,0,0,.5), 0 1px 1px rgba(0,0,0,.45)",
  });
  return (
    <span
      aria-hidden
      className="absolute -left-[2%] -right-[2%] rounded-[2px]"
      style={{
        height: thick,
        top:
          top != null ? (typeof top === "number" ? `${top}px` : top) : undefined,
        bottom:
          bottom != null
            ? typeof bottom === "number"
              ? `${bottom}px`
              : bottom
            : undefined,
        background: dim
          ? "linear-gradient(180deg, #6e6457 0%, #4a4338 50%, #1f1c17 100%)"
          : // Polished steel/brass band — bright top highlight,
            // deep bottom shadow, warm brass tone in the middle.
            "linear-gradient(180deg, #6a4a2a 0%, #cdb27e 18%, #f3e2b4 38%, #b89358 60%, #5c3c1f 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,.55), inset 0 -1px 0 rgba(0,0,0,.6), 0 1px 2px rgba(0,0,0,.5)",
      }}
    >
      <span style={rivet("8%")} />
      <span style={rivet("92%")} />
    </span>
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

// CaptionCard / BarrelTopCaption / BarrelBottomCaption / PhaseStamp all
// retired — the bill name + tier label and the rep range + mash pips
// now sit on burned-in plates inside the barrel body itself (see the
// Barrel component above). The phase chip was dropped: the barrel's
// own silhouette (charred-oak vs. cold-grey staves, medallion vs.
// needs plate) already says "Aging" vs. "Building" louder than a chip.

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
        <div className="relative grid h-[208px] w-full place-items-center">
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
            className="relative grid h-[200px] w-[122px] place-items-center"
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
            fontSize: 16,
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
      <div className="relative grid h-[208px] w-full place-items-center">
        <div
          className="shelf-breathe relative grid h-[200px] w-[122px] place-items-center"
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
          fontSize: 16,
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
