import type {
  Barrel,
  Bottle,
  GameState,
  Line,
  MashBill,
  PlayerState,
  Portfolio,
  PortfolioState,
} from "../types";
import {
  buildEmptyPortfolioState,
  flagshipPortfolioForDistillery,
  getPortfolio,
} from "./boards";
import { deriveBottleProfile } from "./tags";

// ─── v3.2 portfolio placement helpers ──────────────────────────

/**
 * The next-open REQUIRED slot index for left-to-right enforcement.
 * Returns -1 when every required slot is filled (or there are none).
 *
 * Optional slots do not appear here; they are eligible via
 * `tierUnlockedAt`.
 */
export function nextOpenRequiredSlotIndex(
  portfolio: Portfolio,
  state: PortfolioState,
): number {
  for (const slotDef of portfolio.slots) {
    if (!slotDef.required) continue;
    if (!state.slots[slotDef.index]!.filled) return slotDef.index;
  }
  return -1;
}

/**
 * True if a given tier has unlocked. Tier T is unlocked when its
 * first REQUIRED slot is filled (per the v3.2 spec). Tiers with no
 * required slots unlock as soon as the previous tier's required
 * slots are all filled — i.e., when the tier becomes "current."
 */
export function tierUnlockedAt(
  portfolio: Portfolio,
  state: PortfolioState,
  tierIndex: number,
): boolean {
  const tier = portfolio.tiers[tierIndex];
  if (!tier) return false;
  const requiredInTier = tier.slotIndices
    .map((i) => portfolio.slots[i]!)
    .filter((s) => s.required);
  if (requiredInTier.length > 0) {
    // Unlocked when its FIRST required slot is filled.
    const first = requiredInTier[0]!;
    return state.slots[first.index]!.filled;
  }
  // No required slots in this tier. Unlocked once every prior tier's
  // required slots are filled (i.e., the tier is "current").
  for (let t = 0; t < tierIndex; t++) {
    const prev = portfolio.tiers[t]!;
    for (const idx of prev.slotIndices) {
      const def = portfolio.slots[idx]!;
      if (def.required && !state.slots[idx]!.filled) return false;
    }
  }
  return true;
}

/**
 * True if the given slot is eligible to receive a bottle right now,
 * ignoring the bottle's content (i.e., just slot-order / tier
 * eligibility).
 *
 * - Required slots: must be the next-open required slot.
 * - Optional slots: their tier must have unlocked.
 */
export function slotEligibleForFill(
  portfolio: Portfolio,
  state: PortfolioState,
  slotIndex: number,
): boolean {
  const slotDef = portfolio.slots[slotIndex];
  if (!slotDef) return false;
  if (state.slots[slotIndex]!.filled) return false;
  if (slotDef.required) {
    return nextOpenRequiredSlotIndex(portfolio, state) === slotIndex;
  }
  return tierUnlockedAt(portfolio, state, slotDef.tierIndex);
}

/**
 * True iff the bottle satisfies the slot's individual requirement AND
 * the slot is currently eligible (order / tier rules).
 *
 * The Brand Restriction is NOT checked here — it's a soft scoring
 * guideline (Theme tier), never a placement gate.
 */
export function canPlaceInPortfolioSlot(args: {
  bottle: Bottle;
  portfolio: Portfolio;
  state: PortfolioState;
  slotIndex: number;
  player: PlayerState;
}): boolean {
  const { bottle, portfolio, state, slotIndex, player } = args;
  if (!slotEligibleForFill(portfolio, state, slotIndex)) return false;
  const slotDef = portfolio.slots[slotIndex];
  if (!slotDef) return false;
  return slotDef.requirement.check({
    bottle,
    portfolio: state,
    slotIndex,
    player,
  });
}

/**
 * Enumerate every (portfolioKind, slotIndex) eligible for the bottle
 * across the player's flagship and second portfolio. Returns plain
 * objects so the caller can build placement options for UI / bot.
 */
export function eligibleSlotsForBottle(
  bottle: Bottle,
  player: PlayerState,
): Array<{ kind: "flagship" | "second"; slotIndex: number; portfolioId: string }> {
  const out: Array<{
    kind: "flagship" | "second";
    slotIndex: number;
    portfolioId: string;
  }> = [];
  const flagship = getPortfolio(player.flagshipPortfolio.portfolioId);
  if (flagship) {
    for (const slotDef of flagship.slots) {
      if (
        canPlaceInPortfolioSlot({
          bottle,
          portfolio: flagship,
          state: player.flagshipPortfolio,
          slotIndex: slotDef.index,
          player,
        })
      ) {
        out.push({
          kind: "flagship",
          slotIndex: slotDef.index,
          portfolioId: flagship.id,
        });
      }
    }
  }
  if (player.secondPortfolio) {
    const second = getPortfolio(player.secondPortfolio.portfolioId);
    if (second) {
      for (const slotDef of second.slots) {
        if (
          canPlaceInPortfolioSlot({
            bottle,
            portfolio: second,
            state: player.secondPortfolio,
            slotIndex: slotDef.index,
            player,
          })
        ) {
          out.push({
            kind: "second",
            slotIndex: slotDef.index,
            portfolioId: second.id,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Create a Bottle from the sold bill + barrel. Derives recipe tags
 * + cask tag + corn count and freezes them onto the Bottle.
 */
export function createBottleFromSale(
  bill: MashBill,
  barrel: Pick<Barrel, "productionCards">,
  demandAtSale: number,
  ageAtSale: number,
  round: number,
  bottleId: string,
): Bottle {
  const profile = deriveBottleProfile(bill, barrel);
  const cornCount = barrel.productionCards.filter(
    (c) => c.type === "resource" && c.subtype === "corn",
  ).length;
  return {
    bottleId,
    originalBillId: bill.id,
    billDefId: bill.defId,
    name: bill.name,
    recipeTags: profile.recipeTags,
    primaryRecipeTag: profile.primaryRecipeTag,
    caskTag: profile.caskTag,
    rarity: bill.tier ?? "common",
    ageAtSale,
    demandAtSale,
    cornCount,
    placedOnRound: round,
    // v3.4 — Inherit the bill's v3.4 tag set verbatim. Legacy
    // `recipeTags` above stays in place during the migration.
    tags: bill.tags ?? [],
  };
}

/** Mint a fresh bottle id from the game's idCounter. */
export function mintBottleId(draft: { idCounter: number }): string {
  return `bottle_${draft.idCounter++}`;
}

/**
 * True if the player is blocked by a pending bottle placement (the
 * only mid-turn gate in v3.2).
 */
export function isPlayerBlockedByLinePending(player: PlayerState): boolean {
  return player.pendingBottlePlacement !== null;
}

/**
 * Build the initial flagship PortfolioState for a player. Returns
 * `null` for players without a distillery (pre-selection state); the
 * caller should bind via `bindFlagshipPortfolio` once the distillery
 * is picked.
 */
export function buildInitialFlagshipPortfolio(
  player: { distillery: { bonus: string } | null },
): PortfolioState {
  if (!player.distillery) {
    return {
      portfolioId: "",
      slots: [],
      completionReached: false,
    };
  }
  const flagship = flagshipPortfolioForDistillery(
    player.distillery.bonus as Parameters<typeof flagshipPortfolioForDistillery>[0],
  );
  if (!flagship) {
    return {
      portfolioId: "",
      slots: [],
      completionReached: false,
    };
  }
  return buildEmptyPortfolioState(flagship);
}

/**
 * Rebind a player's flagship to a distillery's portfolio. Called by
 * SELECT_DISTILLERY when a player picks (or is preassigned) their
 * distillery. Resets slot state.
 */
export function bindFlagshipPortfolio(
  player: { flagshipPortfolio: PortfolioState; distillery: { bonus: string } | null },
): void {
  player.flagshipPortfolio = buildInitialFlagshipPortfolio(player);
}

// ─── v3.1 compatibility (transitional) ─────────────────────────

/**
 * @deprecated v3.1 — accepting a Line shape. Always returns false;
 * v3.2 placement routes through `canPlaceInPortfolioSlot` instead.
 */
export function canPlaceInFlagshipSlot(
  _bottle: Bottle,
  _line: Line,
  _slotIndex: number,
  _player: PlayerState,
): boolean {
  return false;
}

/**
 * @deprecated v3.1 — always returns false. Replaced by
 * `canPlaceInPortfolioSlot`.
 */
export function canPlaceOnLine(
  _bottle: Bottle,
  _line: Line,
  _player: PlayerState,
): boolean {
  return false;
}

/**
 * @deprecated v3.1 — always returns -1. Replaced by
 * `nextOpenRequiredSlotIndex`.
 */
export function nextOpenSlotIndex(_line: Line): number {
  return -1;
}

/**
 * @deprecated v3.1 — returns an empty stub Line. Initialize the new
 * `flagshipPortfolio` field on PlayerState instead.
 */
export function buildFlagshipLine(_lineBoardId: string, playerId: string): Line {
  return {
    id: `line_flagship_${playerId}`,
    lineBoardId: null,
    stackedCards: [],
    bottles: [],
    completionBonusTriggered: false,
  };
}

/**
 * @deprecated v3.1 — no-op stub.
 */
export function bindFlagshipBoard(_line: Line, _lineBoardId: string): void {
  // no-op
}

export type { GameState };
