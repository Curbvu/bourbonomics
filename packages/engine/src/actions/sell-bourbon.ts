import type { Draft } from "immer";
import type { GameAction, GameState, MashBill, ValidationResult } from "../types";
import { drawWithReshuffle } from "../deck";
import { awardConditionMet, computeReward } from "../rewards";
import { endPlayerTurn, isCurrentPlayer } from "../state";

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
  const value = computeReward(bill, barrel.age, state.demand);
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

  const billForReward = action.goldBourbonId
    ? player.unlockedGoldBourbons.find((m) => m.id === action.goldBourbonId)!
    : attached;
  const reward = computeReward(billForReward, barrel.age, draft.demand);

  // Apply reputation gain.
  player.reputation += action.reputationSplit;

  // Mid-action card draw: drawn cards go straight into hand.
  if (action.cardDrawSplit > 0) {
    const result = drawWithReshuffle(
      player.deck.slice(),
      player.discard.slice(),
      action.cardDrawSplit,
      draft.rngState,
    );
    player.hand.push(...result.drawn);
    player.deck = result.deck;
    player.discard = result.discard;
    draft.rngState = result.rngState;
  }

  // Aging cards return to discard.
  player.discard.push(...barrel.agingCards);

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

  // Demand drops by 1 unless Demand Surge absorbs it.
  if (player.demandSurgeActive) {
    player.demandSurgeActive = false;
  } else if (draft.demand > 0) {
    draft.demand -= 1;
  }

  endPlayerTurn(draft, action.playerId);
}
