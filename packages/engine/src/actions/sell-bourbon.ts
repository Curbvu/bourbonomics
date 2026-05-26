import type {
  Barrel,
  Card,
  Distillery,
  GameAction,
  GameState,
  MashBill,
  ValidationResult,
} from "../types";
import { isWheatedBill, saleFloorForBill } from "../types";
import type { Draft } from "immer";
import type { SaleEffectSignals } from "../card-effects";
import { collectSaleSignals } from "../card-effects";
import { drawWithReshuffle } from "../deck";
import { awardConditionMet, computeReward } from "../rewards";
import { isCurrentPlayer } from "../state";

type SellBourbonAction = Extract<GameAction, { type: "SELL_BOURBON" }>;

const MIN_SELL_AGE = 2;

/**
 * Compute the grid reward for a barrel with all sale-time offsets
 * folded in: themed-card sale signals (Toasted Oak, Single Barrel
 * Cask) and barrel-attached offsets (Master Distiller).
 *
 * Used by both validate (to derive the expected split total) and
 * apply (to score the actual reward) — keeping them in sync.
 */
function computeSaleGridReward(
  bill: MashBill,
  barrel: Pick<Barrel, "age" | "gridRepOffset" | "demandBandOffset">,
  demand: number,
  signals: SaleEffectSignals,
): number {
  return computeReward(bill, barrel.age, demand, {
    demandBandOffset: signals.gridDemandBandOffset + barrel.demandBandOffset,
    gridRepOffset: barrel.gridRepOffset,
  });
}

export function validateSellBourbon(
  state: GameState,
  action: SellBourbonAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const barrel = state.allBarrels.find((b) => b.id === action.barrelId);
  if (!barrel) return { legal: false, reason: `barrel ${action.barrelId} not found` };
  if (barrel.ownerId !== action.playerId) {
    return { legal: false, reason: "you do not own that barrel" };
  }
  // v2.6: only aging-phase barrels can be sold. Ready/construction
  // barrels haven't aged.
  if (barrel.phase !== "aging") {
    return { legal: false, reason: "barrel is still under construction" };
  }
  if (barrel.age < MIN_SELL_AGE) {
    return { legal: false, reason: `barrel must be aged at least ${MIN_SELL_AGE} years` };
  }
  // v2.10: round-gap rule. A barrel must have been in Aging phase for
  // at least one full round before it can sell. Pre-aged starters ship
  // with completedInRound = 0 so they're eligible from round 1 onward.
  if (barrel.completedInRound != null && state.round <= barrel.completedInRound) {
    return {
      legal: false,
      reason: "this barrel finished aging too recently — it can sell starting next round",
    };
  }

  // Sale is single-step. There are no player-facing choices on Silver
  // or Gold any more — both outcomes resolve automatically in apply.
  return { legal: true };
}

/** Distillery sale-mod: +N rep when selling a high-rye / wheated bill. */
function distillerySaleBonusRep(distillery: Distillery | null, bill: MashBill): number {
  const mod = distillery?.saleMods?.bonusRepOnBill;
  if (!mod) return 0;
  if (mod.kind === "wheated" && isWheatedBill(bill)) return mod.rep;
  // v2.10 High-Rye House: any bill with minRye ≥ 1 qualifies (was ≥ 2).
  if (mod.kind === "high_rye" && (bill.recipe?.minRye ?? 0) >= 1) return mod.rep;
  return 0;
}

export function applySellBourbon(
  draft: Draft<GameState>,
  action: SellBourbonAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const barrelIdx = draft.allBarrels.findIndex((b) => b.id === action.barrelId);
  const barrel = draft.allBarrels[barrelIdx]!;
  const attached = barrel.attachedMashBill;

  // v2.10: sell action no longer costs a card from hand. Mandatory
  // per-turn aging (v2.9) is the sole holding cost.

  // Collect themed-card sale signals BEFORE any mutation so the
  // computed reward + bonus rep + return-to-hand list match what
  // validation accepted.
  const signals = collectSaleSignals(barrel, { demand: draft.demand });
  const reward = computeSaleGridReward(attached, barrel, draft.demand, signals);

  // single-step sale. Sum everything that adds
  // rep at sale — grid reward, themed-card per-card bonuses, Rating
  // Boost, distillery sale mods (e.g. High-Rye +1) — then clamp to
  // the bill's tier floor (3/4/5) so every sale clears its baseline.
  const ratingBoost = player.pendingRatingBoost;
  const distilleryBonusRep = distillerySaleBonusRep(player.distillery, attached);
  const rawTotal = reward + signals.bonusRep + ratingBoost + distilleryBonusRep;
  const floor = saleFloorForBill(attached);
  // Prestige is added AFTER the tier floor, never below it. It only
  // applies when Silver or Gold triggers this sale; base sales (no
  // award) ignore prestige entirely.
  const goldEligible =
    attached.goldAward != null &&
    awardConditionMet(attached.goldAward, barrel.age, draft.demand, reward);
  const silverEligible =
    !goldEligible &&
    attached.silverAward != null &&
    awardConditionMet(attached.silverAward, barrel.age, draft.demand, reward);
  const prestigeBonus =
    (goldEligible || silverEligible) ? player.prestige : 0;
  const total = Math.max(rawTotal, floor) + prestigeBonus;
  player.reputation += total;
  // Consume the boost — one-shot per sale.
  if (ratingBoost > 0) player.pendingRatingBoost = 0;

  // Themed-card on-sale draw bonuses (e.g. a future Heritage card
  // declaring `draw_cards on_sale`). Kept independent of the rep
  // total so themed effects still fire under unified rep.
  if (signals.bonusDraw > 0) {
    const result = drawWithReshuffle(
      player.deck.slice(),
      player.discard.slice(),
      signals.bonusDraw,
      draft.rngState,
    );
    player.hand.push(...result.drawn);
    player.deck = result.deck;
    player.discard = result.discard;
    draft.rngState = result.rngState;
  }

  // Cards under the barrel return home: those flagged
  // `returns_to_hand_on_sale` go back to hand; everything else hits
  // the discard pile.
  const allBarrelCards: Card[] = [...barrel.productionCards, ...barrel.agingCards];
  for (const c of allBarrelCards) {
    if (signals.returnsToHand.has(c.id)) {
      player.hand.push(c);
    } else {
      player.discard.push(c);
    }
  }

  // ---------------------------------------------------------------
  // Prestige-era Award resolution
  // ---------------------------------------------------------------
  // Silver: bill → bourbon discard, slot opens, no prestige.
  // Gold:   bill is RETIRED (out of the game entirely), slot opens,
  //         player gains +1 prestige.
  // None:   bill → bourbon discard, slot opens.
  //
  // Connoisseur Estate's permanent ability: +1 extra prestige on
  // Silver (0 → 1) and +1 extra on Gold (1 → 2). The distillery is
  // the prestige specialist.
  const isConnoisseur = player.distillery?.bonus === "connoisseur_estate";
  if (goldEligible) {
    // Gold: retire the bill — never returns to deck, discard, or
    // any other zone. Slot opens, player gains prestige.
    draft.retiredBills.push(attached);
    draft.allBarrels.splice(barrelIdx, 1);
    player.prestige += isConnoisseur ? 2 : 1;
  } else if (silverEligible) {
    // Silver: bill cycles into the bourbon discard, slot opens.
    // Connoisseur picks up +1 prestige.
    draft.bourbonDiscard.push(attached);
    draft.allBarrels.splice(barrelIdx, 1);
    if (isConnoisseur) player.prestige += 1;
  } else {
    // No award — bill to discard, slot opens fully.
    draft.bourbonDiscard.push(attached);
    draft.allBarrels.splice(barrelIdx, 1);
  }

  player.barrelsSold += 1;

  // Demand drops by 1 unless Demand Surge absorbs it or a sale-
  // effect (Heirloom Wheat's `skip_demand_drop`) cancels the drop.
  if (player.demandSurgeActive) {
    player.demandSurgeActive = false;
  } else if (signals.skipDemandDrop) {
    // No-op — drop cancelled.
  } else if (draft.demand > 0) {
    draft.demand -= 1;
  }
  // v2.2: selling does NOT end the player's turn.
}
