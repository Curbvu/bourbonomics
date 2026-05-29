import { produce, type Draft } from "immer";
import type { GameAction, GameState, ScoreResult, ValidationResult } from "./types";
import { applyRollDemand, validateRollDemand } from "./actions/demand";
import { applyDrawHand, validateDrawHand } from "./actions/draw";
import { applyMakeBourbon, validateMakeBourbon } from "./actions/make-bourbon";
import { applyAgeBourbon, validateAgeBourbon } from "./actions/age-bourbon";
import { applySellBourbon, validateSellBourbon } from "./actions/sell-bourbon";
import { applyBuyFromMarket, validateBuyFromMarket } from "./actions/buy-from-market";
import {
  applyBuyOperationsCard,
  validateBuyOperationsCard,
} from "./actions/buy-operations-card";
import {
  applyDraftPass,
  applyDraftTakeBill,
  applyDraftTakeCard,
  applyInitiateDraftingLoop,
  validateDraftPass,
  validateDraftTakeBill,
  validateDraftTakeCard,
  validateInitiateDraftingLoop,
} from "./actions/drafting-loop";
import { applyTrade, validateTrade } from "./actions/trade";
import { applyPassTurn, validatePassTurn } from "./actions/pass-turn";
import { applySelectDistillery, validateSelectDistillery } from "./actions/select-distillery";
import { applyStarterTrade, validateStarterTrade } from "./actions/starter-trade";
import { applyStarterSwap, validateStarterSwap } from "./actions/starter-swap";
import { applyStarterPass, validateStarterPass } from "./actions/starter-pass";
import {
  applyPlayOperationsCard,
  validatePlayOperationsCard,
} from "./actions/play-operations-card";
import { applySaveCard, validateSaveCard } from "./actions/save-card";
import { applyPlaceBottle, validatePlaceBottle } from "./actions/place-bottle";
import { scoreEndGameLines } from "./lines/scoring";

export class IllegalActionError extends Error {
  constructor(
    message: string,
    public readonly action: GameAction,
  ) {
    super(message);
    this.name = "IllegalActionError";
  }
}

/**
 * Pure validation. Never throws; safe for UI gating.
 */
export function validateAction(state: GameState, action: GameAction): ValidationResult {
  // v2.14: the Drafting Loop is a modal sub-phase. The current picker
  // (not necessarily the current player) may TAKE_BILL / TAKE_CARD /
  // PASS; everything else is rejected until the loop closes.
  if (state.draftingLoop !== null) {
    const draftAllowed = new Set([
      "DRAFT_TAKE_BILL",
      "DRAFT_TAKE_CARD",
      "DRAFT_PASS",
    ]);
    if (!draftAllowed.has(action.type)) {
      return {
        legal: false,
        reason: "must complete the active Drafting Loop first",
      };
    }
  } else {
    // v3.0 Line system — pending placement / draw / initial draft
    // gate the active player to the resolving action. These fire
    // ahead of the demand-roll / age guards so the initial draft
    // (carried over from setup) is resolved before the very first
    // ROLL_DEMAND can fire.
    const current = state.players[state.currentPlayerIndex];
    if (current && current.pendingBottlePlacement) {
      if (action.type !== "PLACE_BOTTLE") {
        return {
          legal: false,
          reason: `${current.id} must place the sold bottle before taking other actions`,
        };
      }
    }
    if (
      // v2.9: in the action phase, the current player must roll demand
      // before doing anything else. PLAY_OPERATIONS_CARD stays free since
      // it's a 0-cost prelude historically. v3.2: PLACE_BOTTLE is
      // exempt since it discharges pending bottle placement that must
      // clear BEFORE the player can roll demand.
      state.phase === "action" &&
      action.type !== "ROLL_DEMAND" &&
      action.type !== "PLAY_OPERATIONS_CARD" &&
      action.type !== "PLACE_BOTTLE"
    ) {
      if (current && current.needsDemandRoll) {
        return {
          legal: false,
          reason: `${current.id} must roll demand before taking other actions`,
        };
      }
      // After the demand roll, the player must commit one card to an
      // aging barrel before sales / buys / trades / new builds. The
      // narrow allow-list (AGE / PASS / SAVE_CARD) lets them satisfy
      // the cost, give up the turn, or save a card (free).
      if (current && current.needsAgeBarrels) {
        const allowedDuringAgePhase = new Set([
          "AGE_BOURBON",
          "PASS_TURN",
          "SAVE_CARD",
        ]);
        if (!allowedDuringAgePhase.has(action.type)) {
          return {
            legal: false,
            reason: `${current.id} must age a barrel before taking other actions`,
          };
        }
      }
    }
  }
  switch (action.type) {
    case "SELECT_DISTILLERY":
      return validateSelectDistillery(state, action);
    case "STARTER_TRADE":
      return validateStarterTrade(state, action);
    case "STARTER_SWAP":
      return validateStarterSwap(state, action);
    case "STARTER_PASS":
      return validateStarterPass(state, action);
    case "ROLL_DEMAND":
      return validateRollDemand(state, action);
    case "DRAW_HAND":
      return validateDrawHand(state, action);
    case "MAKE_BOURBON":
      return validateMakeBourbon(state, action);
    case "AGE_BOURBON":
      return validateAgeBourbon(state, action);
    case "SELL_BOURBON":
      return validateSellBourbon(state, action);
    case "BUY_FROM_MARKET":
      return validateBuyFromMarket(state, action);
    case "BUY_OPERATIONS_CARD":
      return validateBuyOperationsCard(state, action);
    case "INITIATE_DRAFTING_LOOP":
      return validateInitiateDraftingLoop(state, action);
    case "DRAFT_TAKE_BILL":
      return validateDraftTakeBill(state, action);
    case "DRAFT_TAKE_CARD":
      return validateDraftTakeCard(state, action);
    case "DRAFT_PASS":
      return validateDraftPass(state, action);
    case "TRADE":
      return validateTrade(state, action);
    case "PLAY_OPERATIONS_CARD":
      return validatePlayOperationsCard(state, action);
    case "SAVE_CARD":
      return validateSaveCard(state, action);
    case "PASS_TURN":
      return validatePassTurn(state, action);
    case "PLACE_BOTTLE":
      return validatePlaceBottle(state, action);
    default:
      return { legal: false, reason: `unhandled action type: ${(action as { type: string }).type}` };
  }
}

/**
 * Validates and applies an action, returning a new GameState.
 * Throws IllegalActionError if the action is not legal in the current state.
 */
export function applyAction(state: GameState, action: GameAction): GameState {
  const validation = validateAction(state, action);
  if (!validation.legal) {
    throw new IllegalActionError(
      `${action.type}: ${validation.reason ?? "illegal"}`,
      action,
    );
  }
  return produce(state, (draft: Draft<GameState>) => {
    dispatch(draft, action);
    draft.actionHistory.push(action);
  });
}

function dispatch(draft: Draft<GameState>, action: GameAction): void {
  switch (action.type) {
    case "SELECT_DISTILLERY":
      applySelectDistillery(draft, action);
      return;
    case "STARTER_TRADE":
      applyStarterTrade(draft, action);
      return;
    case "STARTER_SWAP":
      applyStarterSwap(draft, action);
      return;
    case "STARTER_PASS":
      applyStarterPass(draft, action);
      return;
    case "ROLL_DEMAND":
      applyRollDemand(draft, action);
      return;
    case "DRAW_HAND":
      applyDrawHand(draft, action);
      return;
    case "MAKE_BOURBON":
      applyMakeBourbon(draft, action);
      return;
    case "AGE_BOURBON":
      applyAgeBourbon(draft, action);
      return;
    case "SELL_BOURBON":
      applySellBourbon(draft, action);
      return;
    case "BUY_FROM_MARKET":
      applyBuyFromMarket(draft, action);
      return;
    case "BUY_OPERATIONS_CARD":
      applyBuyOperationsCard(draft, action);
      return;
    case "INITIATE_DRAFTING_LOOP":
      applyInitiateDraftingLoop(draft, action);
      return;
    case "DRAFT_TAKE_BILL":
      applyDraftTakeBill(draft, action);
      return;
    case "DRAFT_TAKE_CARD":
      applyDraftTakeCard(draft, action);
      return;
    case "DRAFT_PASS":
      applyDraftPass(draft, action);
      return;
    case "TRADE":
      applyTrade(draft, action);
      return;
    case "PLAY_OPERATIONS_CARD":
      applyPlayOperationsCard(draft, action);
      return;
    case "SAVE_CARD":
      applySaveCard(draft, action);
      return;
    case "PASS_TURN":
      applyPassTurn(draft, action);
      return;
    case "PLACE_BOTTLE":
      applyPlaceBottle(draft, action);
      return;
    default:
      throw new IllegalActionError(`unhandled action type: ${(action as { type: string }).type}`, action);
  }
}

export function isGameOver(state: GameState): boolean {
  return state.phase === "ended";
}

/**
 * Final scores (v3.0 — Line system).
 *
 * Sort key (highest first):
 *   1. total (reputation + flagship + Σ secondary + inventory)
 *   2. Fewest cards remaining in deck
 *   3. Most barrels sold
 *
 * The pre-3.0 `reputation` field is preserved as the banked-rep
 * value (sale rewards + placement bonuses + prestige etc.); the new
 * `total` is what ranks players. Ties share rank.
 */
export function computeFinalScores(state: GameState): ScoreResult[] {
  const rows: ScoreResult[] = state.players.map((p) => {
    const breakdown = scoreEndGameLines(p);
    const total = p.reputation + breakdown.total;
    return {
      playerId: p.id,
      reputation: p.reputation,
      deckSize: p.hand.length + p.deck.length + p.discard.length,
      barrelsSold: p.barrelsSold,
      flagshipScore: breakdown.flagshipScore,
      secondaryScores: breakdown.secondaryScores,
      inventoryScore: breakdown.inventoryScore,
      total,
      rank: 0,
    };
  });
  rows.sort((a, b) => {
    if (b.total !== a.total) return b.total - a.total;
    if (a.deckSize !== b.deckSize) return a.deckSize - b.deckSize;
    return b.barrelsSold - a.barrelsSold;
  });
  let rank = 1;
  for (let i = 0; i < rows.length; i++) {
    if (
      i > 0 &&
      (rows[i]!.total !== rows[i - 1]!.total ||
        rows[i]!.deckSize !== rows[i - 1]!.deckSize ||
        rows[i]!.barrelsSold !== rows[i - 1]!.barrelsSold)
    ) {
      rank = i + 1;
    }
    rows[i]!.rank = rank;
  }
  return rows;
}
