/**
 * Operations card effect dispatcher.
 *
 * The YAML catalog carries prose rules. We ship a starter set of hand-coded
 * opcodes keyed by card id so that a subset of ops cards has real mechanical
 * effects — the rest resolve as a no-op with a log entry (authorable later).
 */

import type { GameState } from "@/lib/engine/state";

type OpsEffect = (state: GameState, playerId: string) => { summary: string };

const OPS_EFFECTS: Record<string, OpsEffect> = {
  county_rebate(state, playerId) {
    const gain = state.demand >= 6 ? 6 : 2;
    state.players[playerId].cash += gain;
    return { summary: `Gained $${gain} (demand ${state.demand})` };
  },

  fire_sale(state, playerId) {
    const p = state.players[playerId];
    let discarded = false;
    if (p.resourceHand.length > 0) {
      const r = p.resourceHand.shift()!;
      const pile = state.market[r.resource as "cask" | "corn" | "barley" | "rye" | "wheat"];
      if (pile) pile.unshift(r);
      discarded = true;
    }
    p.cash += 6;
    return {
      summary: discarded
        ? `Discarded 1 resource; gained $6`
        : `Gained $6 (no resource to discard)`,
    };
  },

  angels_share_cash(state, playerId) {
    const p = state.players[playerId];
    let oldestAge = 0;
    for (const h of state.rickhouses) {
      for (const b of h.barrels) {
        if (b.ownerId === playerId && b.age > oldestAge) oldestAge = b.age;
      }
    }
    const gain = Math.min(10, oldestAge * 2);
    p.cash += gain;
    return { summary: `Gained $${gain} from oldest barrel (age ${oldestAge})` };
  },

  tour_bus_tips(state, playerId) {
    const p = state.players[playerId];
    const rickhousesWithMine = new Set<string>();
    for (const h of state.rickhouses) {
      if (h.barrels.some((b) => b.ownerId === playerId)) rickhousesWithMine.add(h.id);
    }
    const gain = 3 + Math.min(6, rickhousesWithMine.size);
    p.cash += gain;
    return {
      summary: `Gained $${gain} (3 + ${rickhousesWithMine.size} rickhouse)`,
    };
  },
};

export function resolveOperationsEffect(
  state: GameState,
  playerId: string,
  cardId: string,
): { resolved: boolean; summary: string } {
  const effect = OPS_EFFECTS[cardId];
  if (!effect) {
    return {
      resolved: false,
      summary: `${cardId}: prose-only, no mechanical effect wired yet`,
    };
  }
  const result = effect(state, playerId);
  return { resolved: true, summary: result.summary };
}

export function hasMechanicalEffect(cardId: string): boolean {
  return cardId in OPS_EFFECTS;
}
