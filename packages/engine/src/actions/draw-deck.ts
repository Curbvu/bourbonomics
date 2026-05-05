import type { Draft } from "immer";
import type { Card, GameAction, GameState, ValidationResult } from "../types";
import { endPlayerTurn, isCurrentPlayer } from "../state";

type DrawMashBillAction = Extract<GameAction, { type: "DRAW_MASH_BILL" }>;

function checkSpend(state: GameState, action: DrawMashBillAction): ValidationResult | null {
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
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const idx = player.hand.findIndex((c) => c.id === action.spendCardId);
  const [card] = player.hand.splice(idx, 1);
  player.discard.push(card as Card);

  // Top-of-deck = end of the array.
  const mashBill = draft.bourbonDeck.pop()!;
  player.mashBills.push(mashBill);

  // Drawing the last mash bill triggers the final round.
  if (draft.bourbonDeck.length === 0 && !draft.finalRoundTriggered) {
    draft.finalRoundTriggered = true;
    draft.finalRoundTriggerPlayerIndex = draft.currentPlayerIndex;
  }

  endPlayerTurn(draft, action.playerId);
}
