import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  ValidationResult,
} from "../types";
import { isCurrentPlayer } from "../state";
import {
  buildEmptyPortfolioState,
  getPortfolio,
} from "../lines/boards";

type DraftSecondPortfolioAction = Extract<
  GameAction,
  { type: "DRAFT_SECOND_PORTFOLIO" }
>;

/**
 * v3.2 — Claim one of the face-up secondary portfolios from the
 * shared drafting pool. Free action, once per game per player,
 * illegal in the final round. Costs 1 Generic Labor from hand.
 */
export function validateDraftSecondPortfolio(
  state: GameState,
  action: DraftSecondPortfolioAction,
): ValidationResult {
  if (state.phase !== "action") {
    return {
      legal: false,
      reason: `phase is "${state.phase}", expected "action"`,
    };
  }
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) {
    return { legal: false, reason: `unknown player ${action.playerId}` };
  }
  if (state.finalRoundTriggered) {
    return {
      legal: false,
      reason: "Draft Second Portfolio is illegal in the final round",
    };
  }
  if (player.secondPortfolioDrafted) {
    return {
      legal: false,
      reason: "you have already drafted your second portfolio this game",
    };
  }
  if (!state.secondPortfolioDraftPool.includes(action.portfolioId)) {
    return {
      legal: false,
      reason: `portfolio ${action.portfolioId} is not currently in the face-up drafting pool`,
    };
  }
  const portfolio = getPortfolio(action.portfolioId);
  if (!portfolio) {
    return {
      legal: false,
      reason: `portfolio ${action.portfolioId} is not in the catalog`,
    };
  }
  // Must have a free Generic Labor in hand.
  const labor = findGenericLabor(player.hand, action.laborCardId);
  if (!labor) {
    return {
      legal: false,
      reason: `Generic Labor card ${action.laborCardId} is not in your hand`,
    };
  }
  return { legal: true };
}

export function applyDraftSecondPortfolio(
  draft: Draft<GameState>,
  action: DraftSecondPortfolioAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;

  // Spend the worker.
  const laborIdx = player.hand.findIndex((c) => c.id === action.laborCardId);
  if (laborIdx < 0) return;
  const [labor] = player.hand.splice(laborIdx, 1);
  if (labor) player.discard.push(labor);

  // Take the portfolio out of the face-up pool.
  const poolIdx = draft.secondPortfolioDraftPool.indexOf(action.portfolioId);
  if (poolIdx < 0) return;
  draft.secondPortfolioDraftPool.splice(poolIdx, 1);

  // Bind the new portfolio state.
  const portfolio = getPortfolio(action.portfolioId);
  if (!portfolio) return;
  player.secondPortfolio = buildEmptyPortfolioState(portfolio);
  player.secondPortfolioDrafted = true;
}

function findGenericLabor(hand: Card[], cardId: string): Card | undefined {
  return hand.find(
    (c) =>
      c.id === cardId &&
      c.type === "labor" &&
      (c.laborSubtype === "generic" || c.cardDefId === "generic_labor"),
  );
}
