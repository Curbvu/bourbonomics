/**
 * Heuristic evaluators for the bot. Each function returns an approximate
 * expected-dollar value for the move it describes — higher is better.
 */

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { feesForPlayer } from "@/lib/rules/fees";
import { lookupSalePrice } from "@/lib/rules/pricing";
import { currentActionCost } from "@/lib/engine/checks";
import type { GameState, Player } from "@/lib/engine/state";
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
 * Estimated payout if the player sold this barrel now. Uses the current face-up
 * bourbon card if available; otherwise the median grid cell of the deck.
 */
export function estimateSalePayout(state: GameState, barrelAge: number): number {
  const cardId = state.market.bourbonFaceUp;
  const card = cardId ? BOURBON_CARDS_BY_ID[cardId] : null;
  if (!card) {
    // Conservative fallback.
    return 10;
  }
  if (barrelAge < 2) return 0;
  return lookupSalePrice(card, barrelAge, state.demand).price;
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
    else if (inv.status === "funded_waiting") n += investmentCapital(inv.cardId) * 0.3;
  }
  return n;
}

export function actionCostNow(state: GameState): number {
  return currentActionCost(state);
}
