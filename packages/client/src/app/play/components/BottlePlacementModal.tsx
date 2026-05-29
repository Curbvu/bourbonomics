"use client";

/**
 * v3.2 BottlePlacementModal — slot picker for a sold bottle.
 *
 * After a sale, the engine sets `player.pendingBottlePlacement` and
 * blocks every other action until the bottle is placed. This modal
 * renders both portfolios with their tier-grouped slots, glows the
 * eligible open ones (via `eligibleSlotsForBottle`), and dispatches
 * `PLACE_BOTTLE` when the player clicks a slot. `Stash` is always
 * available — inventory is a legal destination per the rulebook.
 *
 * Layout (page-root mount; uses the full viewport so its `fixed
 * inset-0` backdrop covers everything):
 *
 *   ┌────────────────────────────────────────────────────────┐
 *   │ SALE RESOLVED · PLACE {bottleName}            [Stash ↗] │
 *   │ ┌────────┐ {bottle stats: age · cask · corn · demand}  │
 *   │ │ ▥ chip │                                              │
 *   │ └────────┘                                              │
 *   │ ┌────────────────────────────────────────────────────┐  │
 *   │ │ FLAGSHIP · {name}                                   │ │
 *   │ │ T1 [slot][slot] | T2 [slot] | T3 [slot][slot]       │ │
 *   │ └────────────────────────────────────────────────────┘  │
 *   │ ┌────────────────────────────────────────────────────┐  │
 *   │ │ SECOND · {name}   (only if drafted)                 │ │
 *   │ │ T1 [slot]        | T2 [slot]                        │ │
 *   │ └────────────────────────────────────────────────────┘  │
 *   │ {N} eligible · click a glowing slot, or stash           │
 *   └────────────────────────────────────────────────────────┘
 */

import type {
  Bottle,
  GameAction,
  Portfolio,
  PortfolioSlotDef,
  PortfolioState,
} from "@bourbonomics/engine";
import {
  eligibleSlotsForBottle,
  getPortfolio,
  slotEligibleForFill,
  tierUnlockedAt,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import BottleChip from "./BottleChip";

export default function BottlePlacementModal() {
  const { state, humanSeatPlayerId, dispatch } = useGameStore();
  const seatId = humanSeatPlayerId;
  const player = seatId
    ? state?.players.find((p) => p.id === seatId)
    : null;
  if (!state || !player) return null;
  const pending = player.pendingBottlePlacement;
  if (!pending) return null;
  const bottle = pending.bottle;

  const flagship = getPortfolio(player.flagshipPortfolio.portfolioId);
  const second = player.secondPortfolio
    ? getPortfolio(player.secondPortfolio.portfolioId) ?? null
    : null;

  // Eligible (slot-order + tier + requirement) — drives the "glow"
  // state on each slot button. We also need to know how many eligible
  // slots exist overall to display the count + decide whether Stash
  // is the obviously-correct fallback.
  const eligible = eligibleSlotsForBottle(bottle, player);
  const eligibleCount = eligible.length;
  const eligibleByKindAndIndex = new Set(
    eligible.map((e) => `${e.kind}:${e.slotIndex}`),
  );

  const placeOnSlot = (kind: "flagship" | "second", slotIndex: number) => {
    const action: GameAction = {
      type: "PLACE_BOTTLE",
      playerId: player.id,
      destination: { kind, slotIndex },
    };
    dispatch(action);
  };

  const stash = () => {
    const action: GameAction = {
      type: "PLACE_BOTTLE",
      playerId: player.id,
      destination: { kind: "inventory" },
    };
    dispatch(action);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Place your bottle"
      className="fixed inset-0 z-[56] flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur"
    >
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[1180px] flex-col gap-3 overflow-hidden rounded-xl border border-amber-700/50 bg-gradient-to-b from-slate-950 to-slate-900/95 px-5 py-4 shadow-[0_24px_64px_rgba(0,0,0,.55)]">
        {/* Header */}
        <div className="flex flex-shrink-0 items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12px] uppercase tracking-[.18em] text-amber-300">
              Sale resolved · place this bottle
            </div>
            <div className="mt-1 truncate font-display text-2xl font-semibold text-amber-100">
              {bottle.name}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[.12em] text-slate-400">
              {eligibleCount > 0
                ? `${eligibleCount} eligible slot${eligibleCount === 1 ? "" : "s"} · click a glowing slot to place — placement is permanent`
                : "No slot can take this bottle right now — stash it in inventory and retrieve it later for 1 Generic Labor"}
            </div>
          </div>
          <button
            type="button"
            onClick={stash}
            className="flex-shrink-0 rounded-md border border-slate-600 bg-slate-800/70 px-4 py-2 font-mono text-[12px] font-semibold uppercase tracking-[.14em] text-slate-100 hover:bg-slate-700/60"
          >
            Stash in inventory →
          </button>
        </div>

        {/* Bottle preview — chip + stats */}
        <BottlePreview bottle={bottle} />

        {/* Portfolio bodies. Both share the same flex column so the
            taller one (flagship usually has more slots) dictates the
            scale-host's content height — no overflow inside the
            section because each row is sized to its content. */}
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          {flagship ? (
            <PortfolioBoard
              kind="flagship"
              portfolio={flagship}
              state={player.flagshipPortfolio}
              eligibleSet={eligibleByKindAndIndex}
              onSlotClick={(slotIndex) => placeOnSlot("flagship", slotIndex)}
              hero
            />
          ) : null}
          {second && player.secondPortfolio ? (
            <PortfolioBoard
              kind="second"
              portfolio={second}
              state={player.secondPortfolio}
              eligibleSet={eligibleByKindAndIndex}
              onSlotClick={(slotIndex) => placeOnSlot("second", slotIndex)}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Bottle preview — chip + stat strip
// ─────────────────────────────────────────────────────────────────────

function BottlePreview({ bottle }: { bottle: Bottle }) {
  return (
    <div className="flex flex-shrink-0 items-center gap-4 rounded-lg border border-amber-700/40 bg-slate-950/60 px-3 py-2">
      <BottleChip bottle={bottle} size="sm" />
      <div className="flex flex-wrap items-baseline gap-4">
        <Stat label="Age" value={`${bottle.ageAtSale}y`} />
        <Stat label="Cask" value={caskLabel(bottle.caskTag)} />
        <Stat label="Corn" value={String(bottle.cornCount)} />
        <Stat label="Demand" value={String(bottle.demandAtSale)} />
        <Stat label="Tier" value={bottle.rarity} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[.16em] text-slate-500">
        {label}
      </span>
      <span className="font-mono text-[13px] font-semibold text-amber-100">
        {value}
      </span>
    </span>
  );
}

function caskLabel(caskTag: string): string {
  if (caskTag === "heritage-cask") return "Heritage";
  if (caskTag === "specialty-cask") return "Specialty";
  return "Common";
}

// ─────────────────────────────────────────────────────────────────────
// PortfolioBoard — one player's portfolio with tier-grouped slot row
// ─────────────────────────────────────────────────────────────────────

function PortfolioBoard({
  kind,
  portfolio,
  state,
  eligibleSet,
  onSlotClick,
  hero,
}: {
  kind: "flagship" | "second";
  portfolio: Portfolio;
  state: PortfolioState;
  eligibleSet: Set<string>;
  onSlotClick: (slotIndex: number) => void;
  hero?: boolean;
}) {
  // Group slots by tier index, preserving the order each tier
  // declares its slotIndices in.
  const tiers = portfolio.tiers.map((tier) => ({
    index: tier.index,
    slotDefs: tier.slotIndices
      .map((i) => portfolio.slots[i])
      .filter((s): s is PortfolioSlotDef => !!s),
    unlocked: tierUnlockedAt(portfolio, state, tier.index),
  }));

  return (
    <section
      className={[
        "flex flex-col gap-2 rounded-lg border px-3 py-2",
        hero
          ? "border-amber-600/50 bg-gradient-to-b from-amber-950/30 to-slate-950/60"
          : "border-slate-700/60 bg-slate-950/55",
      ].join(" ")}
    >
      <header className="flex items-baseline gap-3">
        <span
          className="font-mono text-[11px] font-bold uppercase tracking-[.18em]"
          style={{ color: hero ? "var(--gold)" : "var(--brass)" }}
        >
          {kind === "flagship" ? "Flagship Portfolio" : "Second Portfolio"}
        </span>
        <span className="font-display text-[18px] font-semibold leading-none text-amber-100">
          {portfolio.name}
        </span>
        {portfolio.brandRestriction ? (
          <span className="font-mono text-[10.5px] italic text-slate-500">
            theme: {portfolio.brandRestriction.label}
          </span>
        ) : null}
      </header>

      <div className="flex flex-wrap items-stretch gap-3">
        {tiers.map((tier, ti) => (
          <div key={tier.index} className="flex items-stretch gap-3">
            {ti > 0 ? (
              <span
                aria-hidden
                className="w-px self-stretch"
                style={{
                  background:
                    "linear-gradient(180deg, transparent, rgba(198,157,82,.35) 20%, rgba(198,157,82,.35) 80%, transparent)",
                }}
              />
            ) : null}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="font-mono text-[9.5px] font-bold uppercase tracking-[.16em]"
                  style={{
                    color: tier.unlocked
                      ? "var(--brass)"
                      : "var(--ink-muted)",
                  }}
                >
                  Tier {tier.index + 1}
                </span>
                <span
                  className={[
                    "rounded border px-1.5 py-[1px] font-mono text-[9px] font-bold uppercase tracking-[.10em]",
                    tier.unlocked
                      ? "border-emerald-500/60 bg-emerald-900/20 text-emerald-200"
                      : "border-slate-700/50 bg-slate-900/40 text-slate-500",
                  ].join(" ")}
                >
                  {tier.unlocked ? "Unlocked" : "Locked"}
                </span>
              </div>
              <div className="flex gap-1.5">
                {tier.slotDefs.map((slotDef) => {
                  const slotState = state.slots[slotDef.index];
                  if (!slotState) return null;
                  const isEligible = eligibleSet.has(
                    `${kind}:${slotDef.index}`,
                  );
                  const isOpen = slotEligibleForFill(
                    portfolio,
                    state,
                    slotDef.index,
                  );
                  return (
                    <SlotCell
                      key={slotDef.index}
                      slotDef={slotDef}
                      filled={slotState.filled}
                      bottle={slotState.bottle}
                      isOpen={isOpen}
                      isEligible={isEligible}
                      onClick={
                        isEligible ? () => onSlotClick(slotDef.index) : undefined
                      }
                    />
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SlotCell — one named slot. Filled vs eligible-open vs open vs locked.
// ─────────────────────────────────────────────────────────────────────

function SlotCell({
  slotDef,
  filled,
  bottle,
  isOpen,
  isEligible,
  onClick,
}: {
  slotDef: PortfolioSlotDef;
  filled: boolean;
  bottle: Bottle | null;
  isOpen: boolean;
  isEligible: boolean;
  onClick?: () => void;
}) {
  const locked = !filled && !isOpen;
  const borderStyle = slotDef.required ? "solid" : "dashed";
  // Color ladder: filled = brass, eligible = gold (interactable),
  // open-but-bottle-doesn't-fit = soft amber, locked = dim brown.
  const borderColor = filled
    ? "rgba(198,157,82,.6)"
    : isEligible
      ? "var(--gold)"
      : isOpen
        ? "rgba(198,157,82,.4)"
        : "rgba(110,80,50,.4)";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!isEligible}
      title={`${slotDef.name}${slotDef.required ? " · required" : " · optional"} · +${slotDef.endGameValue} rep`}
      className={[
        "group relative flex w-[148px] flex-col gap-1 rounded-lg px-2 py-2 text-left transition-all",
        isEligible
          ? "cursor-pointer hover:-translate-y-[2px] hover:brightness-110"
          : "cursor-default",
        locked ? "opacity-55" : "",
      ].join(" ")}
      style={{
        borderWidth: 1.5,
        borderStyle,
        borderColor,
        background: filled
          ? "linear-gradient(180deg, rgba(58,40,24,.7), rgba(26,18,11,.9))"
          : isEligible
            ? "radial-gradient(70% 80% at 50% 30%, rgba(240,201,112,.18), rgba(20,14,8,.85) 65%)"
            : "linear-gradient(180deg, rgba(28,18,11,.7), rgba(16,11,7,.9))",
        boxShadow: isEligible
          ? "0 0 0 2px rgba(240,201,112,.55), 0 8px 22px rgba(240,201,112,.3)"
          : filled
            ? "inset 0 1px 0 rgba(240,201,112,.12)"
            : "none",
      }}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className="font-mono text-[8.5px] font-bold uppercase tracking-[.12em]"
          style={{
            color: slotDef.required ? "var(--brass)" : "var(--mute)",
          }}
        >
          {slotDef.required ? "Required" : "Optional"}
        </span>
        <span
          className="font-mono text-[10px] font-bold tabular-nums"
          style={{
            color: filled || isEligible ? "var(--gold)" : "var(--mute)",
          }}
        >
          +{slotDef.endGameValue}
        </span>
      </div>
      <div className="font-display text-[13px] font-semibold leading-tight text-amber-100">
        {slotDef.name}
      </div>
      <div className="mt-0.5 font-mono text-[9.5px] leading-tight text-slate-400">
        {slotDef.requirement.label}
      </div>
      <div className="mt-auto flex items-center justify-between gap-1 border-t border-slate-800/70 pt-1.5">
        {filled && bottle ? (
          <>
            <BottleChip bottle={bottle} size="xs" />
            <span className="truncate font-display text-[11px] italic text-slate-400">
              {bottle.name}
            </span>
          </>
        ) : locked ? (
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-600">
            🔒 Locked
          </span>
        ) : isEligible ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[.14em] text-amber-300">
            ↓ Place here
          </span>
        ) : (
          <span className="font-mono text-[9px] uppercase tracking-[.14em] text-slate-500">
            Open · doesn't fit
          </span>
        )}
      </div>
    </button>
  );
}
