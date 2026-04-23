/**
 * Rickhouse fee calculations per GAME_RULES.md §Phase 1 and §Rickhouse.
 *
 *   Rent per barrel = total number of barrels in that rickhouse (all owners).
 *   A baron pays rent for each barrel they own in that rickhouse.
 *   Round 1: skipped entirely.
 *   Monopoly on a capacity-6 rickhouse owned entirely by one baron = no rent there.
 */

import type { GameState, Rickhouse } from "@/lib/engine/state";

export type BarrelFee = {
  barrelId: string;
  rickhouseId: string;
  amount: number;
  monopolyWaived: boolean;
};

export function feesForPlayer(state: GameState, playerId: string): BarrelFee[] {
  const out: BarrelFee[] = [];
  for (const h of state.rickhouses) {
    const perBarrelRent = h.barrels.length; // includes this player's and others'
    const monopoly = isMonopolyWaiver(h, playerId);
    for (const b of h.barrels) {
      if (b.ownerId !== playerId) continue;
      out.push({
        barrelId: b.barrelId,
        rickhouseId: h.id,
        amount: monopoly ? 0 : perBarrelRent,
        monopolyWaived: monopoly,
      });
    }
  }
  return out;
}

export function totalFeesForPlayer(state: GameState, playerId: string): number {
  return feesForPlayer(state, playerId).reduce((sum, f) => sum + f.amount, 0);
}

function isMonopolyWaiver(rickhouse: Rickhouse, playerId: string): boolean {
  if (rickhouse.capacity !== 6) return false;
  if (rickhouse.barrels.length !== rickhouse.capacity) return false;
  return rickhouse.barrels.every((b) => b.ownerId === playerId);
}
