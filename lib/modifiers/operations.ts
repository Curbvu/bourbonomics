/**
 * Operations card effect dispatcher.
 *
 * The YAML catalog carries prose rules. We ship a starter set of hand-coded
 * opcodes keyed by card id so that a subset of ops cards has real mechanical
 * effects — the rest resolve as a no-op with a log entry (authorable later).
 *
 * Every cash payout is routed through `creditCash` so that an active
 * Distressed-Loan siphon claims the income first (GAME_RULES.md §Distressed
 * Distiller's Loan).
 */

import { creditCash } from "@/lib/engine/cash";
import type { GameState } from "@/lib/engine/state";

type OpsEffect = (state: GameState, playerId: string) => { summary: string };

const OPS_EFFECTS: Record<string, OpsEffect> = {
  county_rebate(state, playerId) {
    const gain = state.demand >= 6 ? 6 : 2;
    creditCash(state, playerId, gain, "ops:county_rebate");
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
    creditCash(state, playerId, 6, "ops:fire_sale");
    return {
      summary: discarded
        ? `Discarded 1 resource; gained $6`
        : `Gained $6 (no resource to discard)`,
    };
  },

  angels_share_cash(state, playerId) {
    let oldestAge = 0;
    for (const h of state.rickhouses) {
      for (const b of h.barrels) {
        if (b.ownerId === playerId && b.age > oldestAge) oldestAge = b.age;
      }
    }
    const gain = Math.min(10, oldestAge * 2);
    creditCash(state, playerId, gain, "ops:angels_share_cash");
    return { summary: `Gained $${gain} from oldest barrel (age ${oldestAge})` };
  },

  tour_bus_tips(state, playerId) {
    const rickhousesWithMine = new Set<string>();
    for (const h of state.rickhouses) {
      if (h.barrels.some((b) => b.ownerId === playerId)) rickhousesWithMine.add(h.id);
    }
    const gain = 3 + Math.min(6, rickhousesWithMine.size);
    creditCash(state, playerId, gain, "ops:tour_bus_tips");
    return {
      summary: `Gained $${gain} (3 + ${rickhousesWithMine.size} rickhouse)`,
    };
  },

  distillers_bonus(state, playerId) {
    const barrels = state.rickhouses.reduce(
      (n, h) => n + h.barrels.filter((b) => b.ownerId === playerId).length,
      0,
    );
    const gain = Math.min(8, barrels);
    creditCash(state, playerId, gain, "ops:distillers_bonus");
    return { summary: `Gained $${gain} ($1 per barrel × ${barrels}, max $8)` };
  },

  speakeasy_tipoff(state, playerId) {
    const gain = state.demand >= 4 ? 4 : 1;
    creditCash(state, playerId, gain, "ops:speakeasy_tipoff");
    return { summary: `Gained $${gain} (demand ${state.demand})` };
  },

  copper_salvage(state, playerId) {
    let youngestAge: number | null = null;
    for (const h of state.rickhouses) {
      for (const b of h.barrels) {
        if (b.ownerId !== playerId) continue;
        if (youngestAge === null || b.age < youngestAge) youngestAge = b.age;
      }
    }
    if (youngestAge === null) {
      return { summary: "No barrels to salvage from — gained $0" };
    }
    const gain = Math.min(6, youngestAge * 2);
    creditCash(state, playerId, gain, "ops:copper_salvage");
    return { summary: `Gained $${gain} from youngest barrel (age ${youngestAge})` };
  },

  blenders_touch(state, playerId) {
    let bonusQualifies = false;
    for (const h of state.rickhouses) {
      for (const b of h.barrels) {
        if (b.ownerId !== playerId) continue;
        const types = new Set<string>();
        for (const r of b.mash) {
          if (r.resource === "barley" || r.resource === "rye" || r.resource === "wheat") {
            types.add(r.resource);
          }
        }
        if (types.size >= 2) {
          bonusQualifies = true;
          break;
        }
      }
      if (bonusQualifies) break;
    }
    const gain = bonusQualifies ? 5 : 3;
    creditCash(state, playerId, gain, "ops:blenders_touch");
    return {
      summary: bonusQualifies
        ? `Gained $${gain} (≥3 grain types in a barrel)`
        : `Gained $${gain}`,
    };
  },

  late_shipment(state, playerId) {
    const p = state.players[playerId];
    const candidates: Array<keyof typeof state.market & ("cask" | "corn" | "barley" | "rye" | "wheat")> = [
      "cask",
      "corn",
      "barley",
      "rye",
      "wheat",
    ];
    let bestPile = candidates[0];
    for (const pile of candidates) {
      if (state.market[pile].length > state.market[bestPile].length) bestPile = pile;
    }
    let drawn = 0;
    for (let i = 0; i < 2 && state.market[bestPile].length > 0; i++) {
      const card = state.market[bestPile].pop()!;
      p.resourceHand.push(card);
      drawn++;
    }
    return { summary: `Drew ${drawn} resource card(s) from ${bestPile} pile` };
  },

  coopers_gift(state, playerId) {
    const barrels = state.rickhouses.reduce(
      (n, h) => n + h.barrels.filter((b) => b.ownerId === playerId).length,
      0,
    );
    const gain = barrels < 2 ? 4 : 2;
    creditCash(state, playerId, gain, "ops:coopers_gift");
    return {
      summary:
        barrels < 2
          ? `Gained $${gain} (mercy bonus — only ${barrels} barrel${barrels === 1 ? "" : "s"})`
          : `Gained $${gain}`,
    };
  },

  state_fair_demo(state, playerId) {
    const odd = state.demand % 2 === 1;
    const gain = odd ? 6 : 3;
    creditCash(state, playerId, gain, "ops:state_fair_demo");
    return { summary: `Gained $${gain} (demand ${state.demand} is ${odd ? "odd" : "even"})` };
  },

  insurance_payout(state, playerId) {
    const empty = state.rickhouses.filter(
      (h) => !h.barrels.some((b) => b.ownerId === playerId),
    ).length;
    const gain = Math.min(6, empty * 2);
    creditCash(state, playerId, gain, "ops:insurance_payout");
    return { summary: `Gained $${gain} ($2 per empty-to-you rickhouse × ${empty}, max $6)` };
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
