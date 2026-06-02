import type { Draft } from "immer";
import type { BillTag, GameState, PlayerState } from "./types";

// ============================================================
// Investment effect helpers (v3.6)
//
// Centralizes the "does this player own investment X / how many" reads
// plus the per-round rate-limit bookkeeping shared by the on-sell /
// on-make / on-buy / turn-start hooks. The actual effect resolution
// lives in the individual action handlers (they import these helpers);
// this module is the single place that knows the investment-ownership
// shape so a future storage refactor only touches one file.
// ============================================================

/** True if the player owns at least one copy of the given investment. */
export function hasInvestment(
  player: Pick<PlayerState, "investments">,
  defId: string,
): boolean {
  return player.investments.some((inv) => inv.defId === defId);
}

/** Number of copies of the given investment the player owns. */
export function countInvestment(
  player: Pick<PlayerState, "investments">,
  defId: string,
): number {
  return player.investments.filter((inv) => inv.defId === defId).length;
}

/**
 * Per-round rate limiting. Several investments fire "the first time
 * each round" (Grain Contract, Cooperage, Bottling Line, Yeast Lab,
 * Rail Spur). We track which defIds have already discharged their
 * once-per-round effect in `player.investmentRoundUses`, cleared at
 * cleanup. `claimRoundUse` atomically checks-and-marks: it returns
 * true exactly once per round (and marks the use), false thereafter.
 */
export function investmentUsedThisRound(
  player: Pick<PlayerState, "investmentRoundUses">,
  defId: string,
): boolean {
  return player.investmentRoundUses.includes(defId);
}

export function claimRoundUse(
  player: Draft<PlayerState>,
  defId: string,
): boolean {
  if (player.investmentRoundUses.includes(defId)) return false;
  player.investmentRoundUses.push(defId);
  return true;
}

/**
 * Distillery Tour Program — the owner reads demand as at least 4 for
 * their own sales and grid lookups. Returns the effective demand to
 * use for this player's grid read. Other interactions (award checks,
 * the shared demand track) are untouched by the caller.
 */
export function effectiveSaleDemand(
  player: Pick<PlayerState, "investments">,
  demand: number,
): number {
  if (hasInvestment(player, "distillery_tour_program")) {
    return Math.max(demand, 4);
  }
  return demand;
}

/**
 * Climate immunity — is the given slot protected from negative aging
 * ops (Regulatory Inspection, Forced Cure, Slow Pour)? True when the
 * player owns Climate-Controlled Rickhouse (all slots) OR the slot is
 * individually designated climate-controlled.
 */
export function slotIsAgingImmune(
  player: Pick<
    PlayerState,
    "investments" | "climateControlledSlotIds"
  >,
  slotId: string,
): boolean {
  if (hasInvestment(player, "climate_controlled_rickhouse")) return true;
  return player.climateControlledSlotIds.includes(slotId);
}

/** Second-portfolio failure penalty: −1/slot cap −5 with Estate Bottling, else −2/slot cap −10. */
export function secondPortfolioPenalty(
  player: Pick<PlayerState, "investments">,
  unfilledRequiredSlots: number,
): number {
  if (hasInvestment(player, "estate_bottling")) {
    return Math.min(unfilledRequiredSlots, 5);
  }
  return Math.min(unfilledRequiredSlots * 2, 10);
}

/**
 * Bourbon Hall of Fame — +1 Reputation per distinct bill sold, capped
 * at +6. Returns 0 when the player doesn't own the card.
 */
export function bourbonHallOfFameBonus(
  player: Pick<PlayerState, "investments" | "soldBillDefIds">,
): number {
  if (!hasInvestment(player, "bourbon_hall_of_fame")) return 0;
  return Math.min(player.soldBillDefIds.length, 6);
}

/** Valid tag choices for Master Distiller. */
export const MASTER_DISTILLER_TAGS: BillTag[] = [
  "wheated",
  "rye-heavy",
  "single-grain",
  "triple-grain",
];

/** Resolve the player that an action targets, or undefined. */
export function findOwner(
  state: GameState,
  playerId: string,
): PlayerState | undefined {
  return state.players.find((p) => p.id === playerId);
}
