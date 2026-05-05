import type {
  Card,
  GameAction,
  GameState,
  MashBill,
  ValidationResult,
} from "../types";
import type { Draft } from "immer";
import { collectSaleSignals } from "../card-effects";
import { drawWithReshuffle } from "../deck";
import { awardConditionMet, computeReward } from "../rewards";
import { isCurrentPlayer } from "../state";

type SellBourbonAction = Extract<GameAction, { type: "SELL_BOURBON" }>;

const MIN_SELL_AGE = 2;

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

  const reward = chooseRewardBill(state, action, barrel.attachedMashBill, player.unlockedGoldBourbons);
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
  // Master Distiller bakes a permanent demand-band offset onto the
  // barrel; it stacks additively with any sale-card offsets (Toasted Oak).
  const value = computeReward(bill, barrel.age, state.demand, {
    demandBandOffset: signals.gridDemandBandOffset + barrel.demandBandOffset,
    gridRepOffset: barrel.gridRepOffset,
  });
  return { legal: true, value, bill };
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
  // validation accepted.
  const signals = collectSaleSignals(barrel, { demand: draft.demand });

  const billForReward = action.goldBourbonId
    ? player.unlockedGoldBourbons.find((m) => m.id === action.goldBourbonId)!
    : attached;
  const reward = computeReward(billForReward, barrel.age, draft.demand, {
    demandBandOffset: signals.gridDemandBandOffset + barrel.demandBandOffset,
    gridRepOffset: barrel.gridRepOffset,
  });

  // Apply reputation gain. Three components stack on top of the
  // player-driven split: themed-card flat bonuses, themed-card
  // conditional bonuses (already in `signals.bonusRep`), and the
  // pre-played Rating Boost flag (Pre-played ops).
  const ratingBoost = player.pendingRatingBoost;
  player.reputation += action.reputationSplit + signals.bonusRep + ratingBoost;
  // Consume the boost — one-shot per sale.
  if (ratingBoost > 0) player.pendingRatingBoost = 0;

  // Mid-action card draw: drawn cards go straight into hand.
  // `bonusDraw` from sale effects (e.g. Six-Row Barley) stacks here.
  const drawCount = action.cardDrawSplit + signals.bonusDraw;
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

  // Demand drops by 1 unless Demand Surge absorbs it OR a sale-effect
  // (Heirloom Wheat's `skip_demand_drop`) cancels the drop.
  if (player.demandSurgeActive) {
    player.demandSurgeActive = false;
  } else if (signals.skipDemandDrop) {
    // No-op — themed card cancelled the drop.
  } else if (draft.demand > 0) {
    draft.demand -= 1;
  }
  // v2.2: selling does NOT end the player's turn.
}
