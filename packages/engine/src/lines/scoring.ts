import type {
  PlayerState,
  Portfolio,
  PortfolioState,
} from "../types";
import { getPortfolio } from "./boards";
import {
  bourbonHallOfFameBonus,
  secondPortfolioPenalty,
} from "../investments";

/**
 * v3.2 — end-game score for one Brand Portfolio.
 *
 * Scoring is cumulative across three tiers:
 *   - Slot end-game values: sum of `endGameValue` over filled slots
 *     (required + optional), plus +2 per slot whose Signature Bonus
 *     matched (the spec's tuning starting point — see GAME_RULES.md).
 *   - Completion tier: if every required slot is filled, add
 *     `completionBonus`.
 *   - Theme tier: if Completion AND every filled slot's bottle
 *     satisfies the portfolio's BrandRestriction, add `themeBonus`.
 *     A portfolio with `brandRestriction: null` (e.g., Vanilla)
 *     auto-reaches Theme on Completion.
 *   - Mastery tier: if Theme AND every filled slot satisfies the
 *     MasteryCondition, add `masteryBonus`.
 */
export function scorePortfolio(
  portfolio: Portfolio,
  state: PortfolioState,
  player: PlayerState,
): {
  slotValues: number;
  signatureBonuses: number;
  completionBonus: number;
  themeBonus: number;
  masteryBonus: number;
  total: number;
  tier: "none" | "completion" | "theme" | "mastery";
} {
  // Slot values + signature bonuses.
  let slotValues = 0;
  let signatureBonuses = 0;
  for (const slotDef of portfolio.slots) {
    const slotState = state.slots[slotDef.index]!;
    if (!slotState.filled) continue;
    slotValues += slotDef.endGameValue;
    if (slotState.signatureMatched) signatureBonuses += 2;
  }

  // Completion check.
  const allRequiredFilled = portfolio.slots
    .filter((s) => s.required)
    .every((s) => state.slots[s.index]!.filled);
  let completionBonus = 0;
  let themeBonus = 0;
  let masteryBonus = 0;
  let tier: "none" | "completion" | "theme" | "mastery" = "none";

  if (allRequiredFilled) {
    completionBonus = portfolio.completionBonus;
    tier = "completion";

    // Theme check — every FILLED slot's bottle must satisfy the
    // Brand Restriction. Empty optional slots don't count against.
    const filledStates = state.slots.filter((s) => s.filled && s.bottle);
    let themeReached = true;
    if (portfolio.brandRestriction) {
      themeReached = filledStates.every((s) =>
        portfolio.brandRestriction!.check({
          bottle: s.bottle!,
          portfolio: state,
          player,
        }),
      );
    }
    if (themeReached) {
      themeBonus = portfolio.themeBonus;
      tier = "theme";

      // Mastery check — every filled slot satisfies the strict
      // Mastery Condition.
      const masteryReached = filledStates.every((s) =>
        portfolio.masteryCondition.check({
          bottle: s.bottle!,
          portfolio: state,
          player,
        }),
      );
      if (masteryReached) {
        masteryBonus = portfolio.masteryBonus;
        tier = "mastery";
      }
    }
  }

  const total =
    slotValues + signatureBonuses + completionBonus + themeBonus + masteryBonus;
  return {
    slotValues,
    signatureBonuses,
    completionBonus,
    themeBonus,
    masteryBonus,
    total,
    tier,
  };
}

/**
 * Failure penalty for the second portfolio: −2 rep per unfilled
 * required slot, capped at −10. Only applies if the player drafted
 * a second portfolio AND did not reach Completion on it. Flagship
 * has no failure penalty.
 *
 * v3.6 Estate Bottling halves the bite: −1 per unfilled slot, cap −5.
 * The `secondPortfolioPenalty` helper returns a positive magnitude
 * (Estate-aware); we negate it here.
 */
function secondPortfolioFailurePenalty(
  player: PlayerState,
): number {
  if (!player.secondPortfolioDrafted) return 0;
  if (!player.secondPortfolio) return 0;
  const portfolio = getPortfolio(player.secondPortfolio.portfolioId);
  if (!portfolio) return 0;
  const completionReached = portfolio.slots
    .filter((s) => s.required)
    .every((s) => player.secondPortfolio!.slots[s.index]!.filled);
  if (completionReached) return 0;
  const unfilledRequired = portfolio.slots
    .filter((s) => s.required)
    .filter((s) => !player.secondPortfolio!.slots[s.index]!.filled).length;
  return -secondPortfolioPenalty(player, unfilledRequired);
}

/**
 * v3.2 — inventory scores zero. Retained as a function so the
 * end-game breakdown shape stays stable for UI consumers.
 */
export function scoreInventory(_player: PlayerState): number {
  return 0;
}

/**
 * Full Brand Portfolio end-game contribution for a player. Returns
 * the same breakdown shape v3.1 used so computeFinalScores stays
 * stable; flagshipScore + secondaryScores + inventoryScore + total.
 */
export function scoreEndGameLines(player: PlayerState): {
  flagshipScore: number;
  secondaryScores: number[];
  inventoryScore: number;
  total: number;
} {
  let flagshipScore = 0;
  const flagship = getPortfolio(player.flagshipPortfolio.portfolioId);
  if (flagship) {
    const result = scorePortfolio(flagship, player.flagshipPortfolio, player);
    flagshipScore = result.total;
  }

  const secondaryScores: number[] = [];
  if (player.secondPortfolio) {
    const second = getPortfolio(player.secondPortfolio.portfolioId);
    if (second) {
      const result = scorePortfolio(second, player.secondPortfolio, player);
      // Apply the second-portfolio failure penalty (if any) inline.
      const penalty = secondPortfolioFailurePenalty(player);
      secondaryScores.push(result.total + penalty);
    }
  }

  const inventoryScore = scoreInventory(player);
  // v3.6 Bourbon Hall of Fame — +1 Reputation per distinct bill sold,
  // cap +6. Folded into the player's portfolio total.
  const hallOfFameBonus = bourbonHallOfFameBonus(player);
  const total =
    flagshipScore +
    secondaryScores.reduce((a, b) => a + b, 0) +
    inventoryScore +
    hallOfFameBonus;
  return { flagshipScore, secondaryScores, inventoryScore, total };
}

/**
 * @deprecated v3.1 — alias retained for any in-flight callers.
 */
export function scoreLine(): number {
  return 0;
}
