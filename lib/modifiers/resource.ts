/**
 * Resource card opcode dispatcher.
 *
 * Cards carry an opcode list under `play.on_sell`, `play.on_make_bourbon`, etc.
 * We walk the mash's specialty cards, filter by the lifecycle hook, evaluate the
 * `when` predicate against the current state, and apply each op to an accumulator.
 *
 * Pure: no side effects, no reducer access beyond what's passed in.
 */

import { SPECIALTY_RESOURCES_BY_ID } from "@/lib/catalogs/resource.generated";
import type {
  ResourceCardPlay,
  ResourceWhen,
} from "@/lib/catalogs/types";
import { summarizeMash } from "@/lib/rules/mash";
import type {
  BarrelInstance,
  GameState,
  ResourceCardInstance,
} from "@/lib/engine/state";

// ---------- on_sell ----------

export type SellContext = {
  state: GameState;
  playerId: string;
  barrel: BarrelInstance;
  baseDemand: number;
  baseAge: number;
};

export type SellAccumulator = {
  /** Accumulated additional dollars on top of the grid price. */
  revenueBonus: number;
  /** How many extra bourbon cards to draw during this sale. */
  extraBourbonDraws: number;
  /** Delta to add to the demand used for grid lookup (resource-card effect, not the board demand). */
  demandLookupShift: number;
  /** Delta to the age used for grid lookup. */
  ageLookupShift: number;
};

export function initSellAccumulator(): SellAccumulator {
  return {
    revenueBonus: 0,
    extraBourbonDraws: 0,
    demandLookupShift: 0,
    ageLookupShift: 0,
  };
}

export function applySellOps(ctx: SellContext): SellAccumulator {
  const acc = initSellAccumulator();
  const plays = collectPlays(ctx.barrel.mash);
  const summary = summarizeMash(ctx.barrel.mash);
  const otherBarrelsTotal = countOtherPlayerBarrels(ctx.state, ctx.playerId);

  for (const play of plays) {
    const ops = play.on_sell ?? [];
    for (const op of ops) {
      const when = (op as { when?: ResourceWhen }).when;
      if (when) {
        if (!evalWhen(when, {
          demand: ctx.baseDemand,
          age: ctx.baseAge,
          summary,
          otherBarrelsTotal,
        })) continue;
      }
      switch (op.op) {
        case "revenue_bonus":
          acc.revenueBonus += op.amount;
          break;
        case "demand_lookup_shift":
          acc.demandLookupShift += op.delta;
          break;
        case "age_lookup_shift_years":
          acc.ageLookupShift += op.delta;
          break;
        case "draw_bourbon_cards":
          acc.extraBourbonDraws += op.count;
          break;
        case "noop":
        case "legacy_manual":
          break;
        default:
          // Other ops like market_demand_global_delta are handled by their own hooks.
          break;
      }
    }
  }
  return acc;
}

// ---------- on_make_bourbon ----------

export type MakeContext = {
  state: GameState;
  playerId: string;
  mash: ResourceCardInstance[];
};

export type MakeAccumulator = {
  /** Cash paid from bank directly to the player as a result of making the bourbon. */
  bankPayout: number;
};

export function applyMakeOps(ctx: MakeContext): MakeAccumulator {
  const acc: MakeAccumulator = { bankPayout: 0 };
  const plays = collectPlays(ctx.mash);
  const summary = summarizeMash(ctx.mash);
  const otherBarrelsTotal = countOtherPlayerBarrels(ctx.state, ctx.playerId);
  for (const play of plays) {
    for (const op of play.on_make_bourbon ?? []) {
      const when = (op as { when?: ResourceWhen }).when;
      if (when) {
        if (!evalWhen(when, {
          demand: ctx.state.demand,
          age: 0,
          summary,
          otherBarrelsTotal,
        })) continue;
      }
      if (op.op === "bank_payout") {
        acc.bankPayout += op.amount;
      }
    }
  }
  return acc;
}

// ---------- Helpers ----------

function collectPlays(mash: readonly ResourceCardInstance[]): ResourceCardPlay[] {
  const out: ResourceCardPlay[] = [];
  for (const r of mash) {
    if (!r.specialtyId) continue;
    const def = SPECIALTY_RESOURCES_BY_ID[r.specialtyId];
    if (!def) continue;
    out.push(def.play);
  }
  return out;
}

function countOtherPlayerBarrels(state: GameState, playerId: string): number {
  let n = 0;
  for (const h of state.rickhouses) {
    for (const b of h.barrels) {
      if (b.ownerId !== playerId) n++;
    }
  }
  return n;
}

type WhenContext = {
  demand: number;
  age: number;
  summary: ReturnType<typeof summarizeMash>;
  otherBarrelsTotal: number;
};

function evalWhen(w: ResourceWhen, c: WhenContext): boolean {
  if (w.demand_gte !== undefined && c.demand < w.demand_gte) return false;
  if (w.demand_lte !== undefined && c.demand > w.demand_lte) return false;
  if (w.demand_even && c.demand % 2 !== 0) return false;
  if (w.demand_odd && c.demand % 2 === 0) return false;
  if (w.mash_corn_count_eq !== undefined && c.summary.corn !== w.mash_corn_count_eq) return false;
  if (w.mash_small_grain_count_gte !== undefined && c.summary.grain < w.mash_small_grain_count_gte) return false;
  if (w.mash_small_grain_count_eq !== undefined && c.summary.grain !== w.mash_small_grain_count_eq) return false;
  if (w.mash_includes_rye && c.summary.rye < 1) return false;
  if (w.mash_excludes_rye && c.summary.rye > 0) return false;
  if (w.other_barons_barrelled_gte !== undefined && c.otherBarrelsTotal < w.other_barons_barrelled_gte) return false;
  return true;
}
