/**
 * Rickhouse fee calculations per GAME_RULES.md §Phase 1 and §Rickhouse.
 *
 *   Rent per barrel = total number of barrels in that rickhouse (all owners).
 *   A baron pays rent for each barrel they own in that rickhouse.
 *   Round 1: skipped entirely.
 *   Monopoly on a capacity-6 rickhouse owned entirely by one baron = no rent there.
 *   The Diaspora Distillery perk waives rent on any rickhouse where the
 *   player is the only baron present (regardless of capacity).
 */

import { DISTILLERY_CARDS_BY_ID } from "@/lib/catalogs/distillery.generated";
import type { GameState, Rickhouse } from "@/lib/engine/state";

export type BarrelFee = {
  barrelId: string;
  rickhouseId: string;
  amount: number;
  monopolyWaived: boolean;
};

export function feesForPlayer(state: GameState, playerId: string): BarrelFee[] {
  const out: BarrelFee[] = [];
  // Market-card surcharge — added to every (non-monopoly-waived) barrel
  // rent paid this round. Defaults to 0 when no card is active.
  const surcharge = state.currentRoundEffects.rentSurchargePerBarrel ?? 0;
  // Diaspora perk: if the player has chosen a Distillery whose perk is
  // `solo_rickhouse_no_rent`, any rickhouse where they're the only
  // baron present waives rent for them.
  const chosen = state.players[playerId]?.chosenDistilleryId;
  const hasSoloPerk =
    chosen != null &&
    DISTILLERY_CARDS_BY_ID[chosen]?.perk.kind === "solo_rickhouse_no_rent";
  for (const h of state.rickhouses) {
    const perBarrelRent = h.barrels.length; // includes this player's and others'
    const monopoly = isMonopolyWaiver(h, playerId);
    const soloWaiver =
      hasSoloPerk && h.barrels.every((b) => b.ownerId === playerId);
    for (const b of h.barrels) {
      if (b.ownerId !== playerId) continue;
      const waived = monopoly || soloWaiver;
      out.push({
        barrelId: b.barrelId,
        rickhouseId: h.id,
        amount: waived ? 0 : perBarrelRent + surcharge,
        monopolyWaived: waived,
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
