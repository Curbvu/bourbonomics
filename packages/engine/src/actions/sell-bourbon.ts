import type {
  Barrel,
  Card,
  Distillery,
  GameAction,
  GameState,
  MashBill,
  ValidationResult,
} from "../types";
import { isWheatedBill } from "../types";
import type { Draft } from "immer";
import type { SaleEffectSignals } from "../card-effects";
import { collectSaleSignals } from "../card-effects";
import type { CompositionBuffSignals } from "../composition";
import { computeCompositionBuffs } from "../composition";
import { drawWithReshuffle } from "../deck";
import { awardConditionMet, computeReward } from "../rewards";
import { isCurrentPlayer } from "../state";

type SellBourbonAction = Extract<GameAction, { type: "SELL_BOURBON" }>;

const MIN_SELL_AGE = 2;

/**
 * Compute the grid reward for a barrel with all sale-time offsets
 * folded in: themed-card sale signals (Toasted Oak, Single Barrel
 * Cask), barrel-attached offsets (Master Distiller), and v2.4
 * composition buffs (single-grain demand-band shift).
 *
 * Used by both validate (to derive the expected split total) and
 * apply (to score the actual reward) — keeping them in sync.
 */
function computeSaleGridReward(
  bill: MashBill,
  barrel: Pick<Barrel, "age" | "gridRepOffset" | "demandBandOffset">,
  demand: number,
  signals: SaleEffectSignals,
  composition: CompositionBuffSignals,
): number {
  return computeReward(bill, barrel.age, demand, {
    demandBandOffset:
      signals.gridDemandBandOffset +
      barrel.demandBandOffset +
      composition.gridDemandBandOffset,
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
  if (barrel.age < MIN_SELL_AGE) {
    return { legal: false, reason: `barrel must be aged at least ${MIN_SELL_AGE} years` };
  }

  // v2.4 Old-Line constraint: first sale must clear the distillery's
  // first-sale minimum age. After `firstSaleResolved` flips on apply,
  // subsequent sales pass through.
  const firstSaleMin = player.distillery?.firstSaleMinAge;
  if (firstSaleMin && !player.firstSaleResolved && barrel.age < firstSaleMin) {
    return {
      legal: false,
      reason: `your first sale must be a barrel aged ${firstSaleMin}+ years (this one is age ${barrel.age})`,
    };
  }

  const reward = chooseRewardBill(
    state,
    action,
    barrel.attachedMashBill,
    player.unlockedGoldBourbons,
    player.distillery,
  );
  if (!reward.legal) return reward;

  if (
    !Number.isInteger(action.reputationSplit) ||
    !Number.isInteger(action.cardDrawSplit)
  ) {
    return { legal: false, reason: "splits must be integers" };
  }
  if (action.reputationSplit < 0 || action.cardDrawSplit < 0) {
    return { legal: false, reason: "splits must be non-negative" };
  }
  if (action.reputationSplit + action.cardDrawSplit !== reward.value) {
    return {
      legal: false,
      reason: `splits sum to ${
        action.reputationSplit + action.cardDrawSplit
      }, expected reward of ${reward.value}`,
    };
  }

  return { legal: true };
}

interface RewardChoice extends ValidationResult {
  value: number;
  bill: MashBill;
}

function chooseRewardBill(
  state: GameState,
  action: SellBourbonAction,
  attached: MashBill,
  unlocked: MashBill[],
  distillery: Distillery | null,
): RewardChoice {
  let bill = attached;
  if (action.goldBourbonId) {
    const gold = unlocked.find((m) => m.id === action.goldBourbonId);
    if (!gold) {
      return {
        legal: false,
        reason: `gold bourbon ${action.goldBourbonId} is not unlocked`,
        value: 0,
        bill: attached,
      };
    }
    bill = gold;
  }
  const barrel = state.allBarrels.find((b) => b.id === action.barrelId)!;
  const signals = collectSaleSignals(barrel, { demand: state.demand });
  const composition = computeCompositionBuffs(barrel, distillery);
  const value = computeSaleGridReward(bill, barrel, state.demand, signals, composition);
  return { legal: true, value, bill };
}

/** Distillery sale-mod: +N rep when selling a high-rye / wheated bill. */
function distillerySaleBonusRep(distillery: Distillery | null, bill: MashBill): number {
  const mod = distillery?.saleMods?.bonusRepOnBill;
  if (!mod) return 0;
  if (mod.kind === "wheated" && isWheatedBill(bill)) return mod.rep;
  if (mod.kind === "high_rye" && (bill.recipe?.minRye ?? 0) >= 2) return mod.rep;
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

  // Collect themed-card sale signals BEFORE any mutation so the
  // computed reward + bonus rep + return-to-hand list match what
  // validation accepted. v2.4 composition buffs read the same
  // committed-card pile and contribute parallel signals.
  const signals = collectSaleSignals(barrel, { demand: draft.demand });
  const composition = computeCompositionBuffs(barrel, player.distillery);

  const billForReward = action.goldBourbonId
    ? player.unlockedGoldBourbons.find((m) => m.id === action.goldBourbonId)!
    : attached;
  const reward = computeSaleGridReward(
    billForReward,
    barrel,
    draft.demand,
    signals,
    composition,
  );

  // Apply reputation gain. Five components stack on top of the
  // player-driven split: themed-card flat bonuses, themed-card
  // conditional bonuses (already in `signals.bonusRep`), the
  // pre-played Rating Boost flag, v2.4 composition buffs (3+ cask,
  // all-four-grains), and v2.4 distillery sale mods (e.g. High-Rye
  // House: +1 rep on a high-rye bill).
  const ratingBoost = player.pendingRatingBoost;
  const distilleryBonusRep = distillerySaleBonusRep(player.distillery, billForReward);
  player.reputation +=
    action.reputationSplit +
    signals.bonusRep +
    ratingBoost +
    composition.bonusRep +
    distilleryBonusRep;
  // Consume the boost — one-shot per sale.
  if (ratingBoost > 0) player.pendingRatingBoost = 0;

  // Mid-action card draw: drawn cards go straight into hand.
  // `bonusDraw` from sale effects (e.g. Six-Row Barley) and the
  // v2.4 composition 3+ corn buff both stack here.
  const drawCount =
    action.cardDrawSplit + signals.bonusDraw + composition.bonusDraw;
  if (drawCount > 0) {
    const result = drawWithReshuffle(
      player.deck.slice(),
      player.discard.slice(),
      drawCount,
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

  // Award resolution against the ATTACHED bill (not the optional gold one used).
  const goldEligible =
    attached.goldAward &&
    awardConditionMet(attached.goldAward, barrel.age, draft.demand, reward);
  const silverEligible =
    attached.silverAward &&
    awardConditionMet(attached.silverAward, barrel.age, draft.demand, reward);

  if (goldEligible) {
    player.unlockedGoldBourbons.push(attached);
  } else if (silverEligible) {
    player.mashBills.push(attached);
  } else {
    draft.bourbonDiscard.push(attached);
  }

  // Remove the barrel.
  draft.allBarrels.splice(barrelIdx, 1);
  player.barrelsSold += 1;
  // Mark first sale resolved (clears Old-Line's first-sale-min-age gate).
  player.firstSaleResolved = true;

  // Demand drops by 1 unless Demand Surge absorbs it, a sale-effect
  // (Heirloom Wheat's `skip_demand_drop`) cancels the drop, or the
  // v2.4 composition 2+ capital buff cancels it.
  if (player.demandSurgeActive) {
    player.demandSurgeActive = false;
  } else if (signals.skipDemandDrop || composition.skipDemandDrop) {
    // No-op — drop cancelled.
  } else if (draft.demand > 0) {
    draft.demand -= 1;
  }
  // v2.2: selling does NOT end the player's turn.
}
