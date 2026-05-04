import type { Draft } from "immer";
import type { Card, GameAction, GameState, ValidationResult } from "../types.js";
import { capitalUnits } from "../cards.js";
import { endPlayerTurn, isCurrentPlayer } from "../state.js";

type ImplementInvestmentAction = Extract<GameAction, { type: "IMPLEMENT_INVESTMENT" }>;

const MAX_ACTIVE_INVESTMENTS = 3;

export function validateImplementInvestment(
  state: GameState,
  action: ImplementInvestmentAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  if (player.activeInvestments.length >= MAX_ACTIVE_INVESTMENTS) {
    return { legal: false, reason: `cannot have more than ${MAX_ACTIVE_INVESTMENTS} active investments` };
  }

  const investment = player.heldInvestments.find((i) => i.id === action.investmentId);
  if (!investment) {
    return { legal: false, reason: `investment ${action.investmentId} is not in your held cards` };
  }

  // Spend cards must be capital and meet the cost.
  const spendIds = action.capitalCardIds;
  if (new Set(spendIds).size !== spendIds.length) {
    return { legal: false, reason: "duplicate capital card id" };
  }
  let total = 0;
  for (const id of spendIds) {
    const card = player.hand.find((c) => c.id === id);
    if (!card) return { legal: false, reason: `card ${id} is not in your hand` };
    if (card.type !== "capital") {
      return { legal: false, reason: `${id} is not a capital card` };
    }
    total += capitalUnits(card);
  }
  if (total < investment.capitalCost) {
    return {
      legal: false,
      reason: `paid capital is ${total}, need ${investment.capitalCost}`,
    };
  }

  return { legal: true };
}

export function applyImplementInvestment(
  draft: Draft<GameState>,
  action: ImplementInvestmentAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;

  // Pay: move spent capital cards to discard.
  const spendSet = new Set(action.capitalCardIds);
  const newHand: Card[] = [];
  const spent: Card[] = [];
  for (const card of player.hand) {
    if (spendSet.has(card.id)) spent.push(card);
    else newHand.push(card);
  }
  player.hand = newHand;
  player.discard.push(...spent);

  // Move from heldInvestments → activeInvestments.
  const idx = player.heldInvestments.findIndex((i) => i.id === action.investmentId);
  const [investment] = player.heldInvestments.splice(idx, 1);
  player.activeInvestments.push(investment!);

  // Apply the immediate-effect part of the investment.
  applyImmediateInvestmentEffect(player, investment!.effect);

  endPlayerTurn(draft, action.playerId);
}

function applyImmediateInvestmentEffect(
  player: Draft<GameState>["players"][number],
  effect: GameState["players"][number]["activeInvestments"][number]["effect"],
): void {
  switch (effect.kind) {
    case "hand_size_plus":
      player.handSize += effect.amount;
      return;
    case "free_trash_per_round":
      player.freeTrashRemaining += effect.amount;
      return;
    // Other kinds (carry_over_cards, demand_plus_per_round, free_age_per_round,
    // draw_mashbill_per_round, capital_to_reputation) take effect at round
    // boundaries — handled in runCleanupPhase / round-start hooks.
    case "carry_over_cards":
    case "demand_plus_per_round":
    case "capital_to_reputation":
    case "free_age_per_round":
    case "draw_mashbill_per_round":
      return;
  }
}
