import type { Draft } from "immer";
import type { Card, GameAction, GameState, ValidationResult } from "../types.js";
import { drawWithReshuffle } from "../deck.js";
import { endPlayerTurn, isCurrentPlayer } from "../state.js";

type DrawMashBillAction = Extract<GameAction, { type: "DRAW_MASH_BILL" }>;
type DrawInvestmentAction = Extract<GameAction, { type: "DRAW_INVESTMENT" }>;
type DrawOperationsAction = Extract<GameAction, { type: "DRAW_OPERATIONS" }>;

type SpendAction =
  | DrawMashBillAction
  | DrawInvestmentAction
  | DrawOperationsAction;

function checkSpend(state: GameState, action: SpendAction): ValidationResult | null {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  if (!player.hand.find((c) => c.id === action.spendCardId)) {
    return { legal: false, reason: `card ${action.spendCardId} is not in your hand` };
  }
  return null;
}

function spendCard(draft: Draft<GameState>, playerId: string, cardId: string): void {
  const player = draft.players.find((p) => p.id === playerId)!;
  const idx = player.hand.findIndex((c) => c.id === cardId);
  const [card] = player.hand.splice(idx, 1);
  player.discard.push(card as Card);
}

// ---------- DRAW_MASH_BILL ----------

export function validateDrawMashBill(
  state: GameState,
  action: DrawMashBillAction,
): ValidationResult {
  const spendCheck = checkSpend(state, action);
  if (spendCheck) return spendCheck;
  if (state.bourbonDeck.length === 0) {
    return { legal: false, reason: "the bourbon deck is empty" };
  }
  return { legal: true };
}

export function applyDrawMashBill(
  draft: Draft<GameState>,
  action: DrawMashBillAction,
): void {
  spendCard(draft, action.playerId, action.spendCardId);

  // Top-of-deck = end of the array.
  const mashBill = draft.bourbonDeck.pop()!;
  const player = draft.players.find((p) => p.id === action.playerId)!;
  player.mashBills.push(mashBill);

  // Drawing the last mash bill triggers the final round.
  if (draft.bourbonDeck.length === 0 && !draft.finalRoundTriggered) {
    draft.finalRoundTriggered = true;
    draft.finalRoundTriggerPlayerIndex = draft.currentPlayerIndex;
  }

  endPlayerTurn(draft, action.playerId);
}

// ---------- DRAW_INVESTMENT ----------

export function validateDrawInvestment(
  state: GameState,
  action: DrawInvestmentAction,
): ValidationResult {
  const spendCheck = checkSpend(state, action);
  if (spendCheck) return spendCheck;
  if (state.investmentDeck.length === 0 && state.investmentDiscard.length === 0) {
    return { legal: false, reason: "the investment deck is exhausted" };
  }
  return { legal: true };
}

export function applyDrawInvestment(
  draft: Draft<GameState>,
  action: DrawInvestmentAction,
): void {
  spendCard(draft, action.playerId, action.spendCardId);

  // Reshuffle from discard if deck is empty.
  if (draft.investmentDeck.length === 0) {
    const result = drawWithReshuffle(
      draft.investmentDeck.slice(),
      draft.investmentDiscard.slice(),
      0,
      draft.rngState,
    );
    draft.investmentDeck = result.deck;
    draft.investmentDiscard = result.discard;
    draft.rngState = result.rngState;
  }

  const investment = draft.investmentDeck.pop();
  if (investment) {
    const player = draft.players.find((p) => p.id === action.playerId)!;
    player.heldInvestments.push(investment);
  }

  endPlayerTurn(draft, action.playerId);
}

// ---------- DRAW_OPERATIONS ----------

export function validateDrawOperations(
  state: GameState,
  action: DrawOperationsAction,
): ValidationResult {
  const spendCheck = checkSpend(state, action);
  if (spendCheck) return spendCheck;
  if (state.operationsDeck.length === 0 && state.operationsDiscard.length === 0) {
    return { legal: false, reason: "the operations deck is exhausted" };
  }
  return { legal: true };
}

export function applyDrawOperations(
  draft: Draft<GameState>,
  action: DrawOperationsAction,
): void {
  spendCard(draft, action.playerId, action.spendCardId);

  if (draft.operationsDeck.length === 0) {
    const result = drawWithReshuffle(
      draft.operationsDeck.slice(),
      draft.operationsDiscard.slice(),
      0,
      draft.rngState,
    );
    draft.operationsDeck = result.deck;
    draft.operationsDiscard = result.discard;
    draft.rngState = result.rngState;
  }

  const ops = draft.operationsDeck.pop();
  if (ops) {
    const player = draft.players.find((p) => p.id === action.playerId)!;
    player.heldOperations.push(ops);
  }

  endPlayerTurn(draft, action.playerId);
}
