import type { Draft } from "immer";
import type { GameAction, GameState, PlayerState, ValidationResult } from "../types";

type StarterTradeAction = Extract<GameAction, { type: "STARTER_TRADE" }>;

function findDrafter(state: GameState, playerId: string): PlayerState | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  if (!state.starterDeckDraftOrder.includes(playerId)) return null;
  return player;
}

export function validateStarterTrade(
  state: GameState,
  action: StarterTradeAction,
): ValidationResult {
  if (state.phase !== "starter_deck_draft") {
    return { legal: false, reason: `phase is "${state.phase}", expected "starter_deck_draft"` };
  }
  if (action.player1Id === action.player2Id) {
    return { legal: false, reason: "cannot trade with yourself" };
  }
  const p1 = findDrafter(state, action.player1Id);
  const p2 = findDrafter(state, action.player2Id);
  if (!p1) return { legal: false, reason: `${action.player1Id} is not a starter drafter` };
  if (!p2) return { legal: false, reason: `${action.player2Id} is not a starter drafter` };
  if (p1.starterPassed) {
    return { legal: false, reason: `${action.player1Id} has already passed` };
  }
  if (p2.starterPassed) {
    return { legal: false, reason: `${action.player2Id} has already passed` };
  }
  if (!p1.starterHand.some((c) => c.id === action.player1CardId)) {
    return { legal: false, reason: `${action.player1CardId} is not in ${action.player1Id}'s starter hand` };
  }
  if (!p2.starterHand.some((c) => c.id === action.player2CardId)) {
    return { legal: false, reason: `${action.player2CardId} is not in ${action.player2Id}'s starter hand` };
  }
  if (action.player1CardId === action.player2CardId) {
    return { legal: false, reason: "trade card ids must be distinct" };
  }
  return { legal: true };
}

export function applyStarterTrade(
  draft: Draft<GameState>,
  action: StarterTradeAction,
): void {
  const p1 = draft.players.find((p) => p.id === action.player1Id)!;
  const p2 = draft.players.find((p) => p.id === action.player2Id)!;

  const i1 = p1.starterHand.findIndex((c) => c.id === action.player1CardId);
  const i2 = p2.starterHand.findIndex((c) => c.id === action.player2CardId);

  const [c1] = p1.starterHand.splice(i1, 1);
  const [c2] = p2.starterHand.splice(i2, 1);
  p1.starterHand.push(c2!);
  p2.starterHand.push(c1!);
}
