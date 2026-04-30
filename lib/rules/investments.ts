/**
 * Investment lifecycle helpers per GAME_RULES.md §Actions / Investments.
 *
 *   unbuilt → drawn into hand, capital not paid, no effects.
 *   active  → implemented (capital paid). Effects apply immediately. Limited
 *             to MAX_ACTIVE_INVESTMENTS active per player at any time.
 *
 * There is no "funded waiting" state — implementing an investment activates
 * it on the same turn (per current rules).
 */

import type { GameState, InvestmentInstance } from "@/lib/engine/state";

export function resetPerRoundInvestmentUsage(state: GameState): void {
  for (const playerId of state.playerOrder) {
    const p = state.players[playerId];
    for (const inv of p.investments) {
      inv.usedThisRound = false;
    }
  }
}

export function findInvestment(
  state: GameState,
  playerId: string,
  instanceId: string,
): InvestmentInstance | undefined {
  return state.players[playerId]?.investments.find(
    (i) => i.instanceId === instanceId,
  );
}

export function activeInvestmentCount(
  state: GameState,
  playerId: string,
): number {
  const p = state.players[playerId];
  if (!p) return 0;
  return p.investments.filter((i) => i.status === "active").length;
}
