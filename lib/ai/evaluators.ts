/**
 * Heuristic evaluators for the bot. Each function returns an approximate
 * expected-dollar value for the move it describes — higher is better.
 */

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { evaluateAward } from "@/lib/rules/awards";
import { feesForPlayer } from "@/lib/rules/fees";
import { lookupSalePrice } from "@/lib/rules/pricing";
import { currentActionCost } from "@/lib/engine/checks";
import type { BarrelInstance, GameState, Player } from "@/lib/engine/state";
import type { RickhouseId } from "@/lib/engine/rickhouses";

/** Player's owned barrels across all rickhouses. */
export function ownedBarrels(state: GameState, playerId: string) {
  const out: Array<{ rickhouseId: RickhouseId; barrel: (typeof state.rickhouses)[number]["barrels"][number] }> = [];
  for (const h of state.rickhouses) {
    for (const b of h.barrels) {
      if (b.ownerId === playerId) out.push({ rickhouseId: h.id, barrel: b });
    }
  }
  return out;
}

/**
 * Estimated payout if the player sold this barrel now. With mash bills
 * locked at production we can use the barrel's actual bill grid to look
 * up an exact sale price.
 */
export function estimateSalePayout(
  state: GameState,
  barrel: { age: number; mashBillId: string },
): number {
  if (barrel.age < 2) return 0;
  const card = BOURBON_CARDS_BY_ID[barrel.mashBillId];
  if (!card) {
    // Conservative fallback for unknown mash bill ids.
    return 10;
  }
  return lookupSalePrice(card, barrel.age, state.demand).price;
}

/**
 * Best Gold-Bourbon alt payout for selling this barrel, or null if no
 * unlocked Gold qualifies / none pays more than the attached bill.
 * Used by the bot at decision time and by the human Sell button to
 * auto-apply the best legal Gold whenever it strictly improves the
 * payout. (The rules say it's optional; nobody declines free money.)
 */
export function pickBestGoldAlt(
  state: GameState,
  player: Player,
  barrel: BarrelInstance,
): { goldId: string; payout: number } | null {
  if (player.goldBourbons.length === 0) return null;
  const attached = BOURBON_CARDS_BY_ID[barrel.mashBillId];
  if (!attached) return null;
  const attachedPrice = lookupSalePrice(attached, barrel.age, state.demand).price;

  let bestId: string | null = null;
  let bestPrice = -Infinity;
  for (const goldId of player.goldBourbons) {
    const altCard = BOURBON_CARDS_BY_ID[goldId];
    if (!altCard) continue;
    const altAward = evaluateAward(
      altCard,
      barrel.mash,
      barrel.age,
      // Reference price for Gold-criteria eligibility = alt's grid max.
      Math.max(...altCard.grid.flatMap((row) => row)),
    );
    if (!altAward.gold) continue;
    const altPrice = lookupSalePrice(altCard, barrel.age, state.demand).price;
    if (altPrice > bestPrice) {
      bestPrice = altPrice;
      bestId = goldId;
    }
  }
  if (!bestId) return null;
  if (bestPrice <= attachedPrice) return null;
  return { goldId: bestId, payout: bestPrice };
}

/**
 * Pick the best owned barrel to sell right now.
 *
 * Considers every owned age-≥2 barrel and returns the one with the
 * highest projected payout, accounting for any Gold Bourbon alt-payout
 * that strictly beats the attached bill's grid. Returns null when the
 * player has no sellable barrel.
 *
 * Used by:
 *   - the HandTray "Sell ↵" shortcut (sell the obvious best one),
 *   - any "did I miss a better sale?" hint in the UI,
 *   - tests that lock the contract independently of bot scoring code.
 */
export function pickBestSellable(
  state: GameState,
  player: Player,
): {
  barrel: BarrelInstance;
  rickhouseId: RickhouseId;
  payout: number;
  goldAlt: { goldId: string; payout: number } | null;
} | null {
  let bestPayout = -Infinity;
  let best:
    | {
        barrel: BarrelInstance;
        rickhouseId: RickhouseId;
        payout: number;
        goldAlt: { goldId: string; payout: number } | null;
      }
    | null = null;
  for (const { rickhouseId, barrel } of ownedBarrels(state, player.id)) {
    if (barrel.age < 2) continue;
    const basePayout = estimateSalePayout(state, barrel);
    const altPick = pickBestGoldAlt(state, player, barrel);
    const payout = altPick ? altPick.payout : basePayout;
    if (payout > bestPayout) {
      bestPayout = payout;
      best = { barrel, rickhouseId, payout, goldAlt: altPick };
    }
  }
  return best;
}

export function expectedFeesNextRound(state: GameState, playerId: string): number {
  const fees = feesForPlayer(state, playerId);
  return fees.reduce((s, f) => s + f.amount, 0);
}

export function hasLegalMash(player: Player): boolean {
  const hand = player.resourceHand;
  const hasCask = hand.some((r) => r.resource === "cask");
  const hasCorn = hand.some((r) => r.resource === "corn");
  const hasGrain = hand.some((r) => r.resource === "rye" || r.resource === "wheat" || r.resource === "barley");
  return hasCask && hasCorn && hasGrain;
}

export function firstOpenRickhouse(state: GameState): RickhouseId | null {
  for (const h of state.rickhouses) {
    if (h.barrels.length < h.capacity) return h.id;
  }
  return null;
}

export function investmentCapital(cardId: string): number {
  return INVESTMENT_CARDS_BY_ID[cardId]?.capital ?? 0;
}

export function totalInvestmentValue(player: Player): number {
  let n = 0;
  for (const inv of player.investments) {
    if (inv.status === "active") n += investmentCapital(inv.cardId) * 0.6;
    // Unbuilt investments contribute their face value as paper assets.
    else n += investmentCapital(inv.cardId) * 0.2;
  }
  return n;
}

export function actionCostNow(state: GameState, playerId?: string): number {
  return currentActionCost(state, playerId);
}
