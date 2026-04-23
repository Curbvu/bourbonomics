/**
 * Investment modifier application.
 *
 * Investments in the `active` state contribute modifiers (defined in
 * lib/catalogs/types.ts as InvestmentModifier). We expose small helpers that:
 *
 *   - Compute the effective cost of the current action after discounts.
 *   - Compute the net rickhouse fee for a player after discounts.
 *   - Compute the bonus resource draws on a market buy.
 *
 * Each helper mutates the per-round `usedThisRound` flag on the investments it
 * consumed, so `oncePerRound` semantics are honoured.
 */

import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import type {
  InvestmentInstance,
  Player,
} from "@/lib/engine/state";

function activeInvestments(player: Player): Array<{
  inst: InvestmentInstance;
  modifiers: ReturnType<typeof modifiersFor>;
}> {
  return player.investments
    .filter((i) => i.status === "active")
    .map((inst) => ({ inst, modifiers: modifiersFor(inst) }));
}

function modifiersFor(inst: InvestmentInstance) {
  return INVESTMENT_CARDS_BY_ID[inst.cardId]?.modifiers ?? [];
}

// ---------- Action cost discount ----------

/**
 * Returns { cost, consume } where `cost` is the final cost and `consume` is a
 * callback the caller should invoke after actually spending the cash, so the
 * `usedThisRound` flag flips for any oncePerRound discount that was applied.
 *
 * Does NOT mutate the player directly.
 */
export function applyActionCostDiscount(
  player: Player,
  baseCost: number,
  takingAsFirstPaidThisRound: boolean,
): { cost: number; consume: () => void } {
  let best: { inst: InvestmentInstance; amount: number } | null = null;
  for (const { inst, modifiers } of activeInvestments(player)) {
    if (inst.usedThisRound) continue;
    for (const mod of modifiers) {
      if (mod.kind !== "action_cost_discount") continue;
      if (mod.scope === "per_round_first_paid" && !takingAsFirstPaidThisRound) continue;
      // next_action scope applies any turn; for MVP we treat it as per-round.
      if (!best || mod.amount > best.amount) {
        best = { inst, amount: mod.amount };
      }
    }
  }
  if (!best) return { cost: baseCost, consume: () => undefined };
  const cost = Math.max(0, baseCost - best.amount);
  return {
    cost,
    consume: () => {
      if (best) best.inst.usedThisRound = true;
    },
  };
}

// ---------- Rickhouse fee discount ----------

export function applyRickhouseFeeDiscount(
  player: Player,
  baseTotal: number,
): { total: number; consume: () => void } {
  let best: { inst: InvestmentInstance; amount: number } | null = null;
  for (const { inst, modifiers } of activeInvestments(player)) {
    if (inst.usedThisRound) continue;
    for (const mod of modifiers) {
      if (mod.kind !== "rickhouse_fee_discount") continue;
      if (!best || mod.amount > best.amount) {
        best = { inst, amount: mod.amount };
      }
    }
  }
  if (!best) return { total: baseTotal, consume: () => undefined };
  const total = Math.max(0, baseTotal - best.amount);
  return {
    total,
    consume: () => {
      if (best) best.inst.usedThisRound = true;
    },
  };
}

// ---------- Market buy bonus ----------

export function applyMarketBuyBonus(player: Player): {
  extraCards: number;
  consume: () => void;
} {
  let best: { inst: InvestmentInstance; extra: number } | null = null;
  for (const { inst, modifiers } of activeInvestments(player)) {
    if (inst.usedThisRound) continue;
    for (const mod of modifiers) {
      if (mod.kind !== "market_buy_bonus_cards") continue;
      if (!best || mod.extra > best.extra) {
        best = { inst, extra: mod.extra };
      }
    }
  }
  if (!best) return { extraCards: 0, consume: () => undefined };
  return {
    extraCards: best.extra,
    consume: () => {
      if (best) best.inst.usedThisRound = true;
    },
  };
}
