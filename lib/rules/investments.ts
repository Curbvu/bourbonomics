/**
 * Investment lifecycle helpers per GAME_RULES.md §Investment cards.
 *
 *   unbuilt        → drawn, capital not paid
 *   funded_waiting → capital paid, will activate at start of next round
 *   active         → effects apply
 */

import type { GameState, InvestmentInstance } from "@/lib/engine/state";

export function activateFundedInvestmentsAtRoundStart(state: GameState): void {
  for (const playerId of state.playerOrder) {
    const p = state.players[playerId];
    for (const inv of p.investments) {
      if (inv.status !== "funded_waiting") continue;
      if (inv.fundedOnRound === null) continue;
      if (inv.fundedOnRound < state.round) {
        inv.status = "active";
      }
    }
  }
}

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
