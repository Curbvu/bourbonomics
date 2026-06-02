import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";
import {
  claimRoundUse,
  hasInvestment,
  investmentUsedThisRound,
} from "../investments";

type ShiftDemandAction = Extract<GameAction, { type: "SHIFT_DEMAND" }>;

const DEMAND_MIN = 0;
const DEMAND_MAX = 12;

/**
 * v3.6 Trade Lobby investment — once per round, nudge the shared demand
 * track by ±1. Optional free action; must be taken after the player has
 * rolled demand this round (the roll is the per-turn gate). Clamped to
 * the 0..12 track bounds.
 */
export function validateShiftDemand(
  state: GameState,
  action: ShiftDemandAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!hasInvestment(player, "trade_lobby")) {
    return { legal: false, reason: "you do not own the Trade Lobby investment" };
  }
  if (action.delta !== 1 && action.delta !== -1) {
    return { legal: false, reason: "delta must be +1 or -1" };
  }
  if (investmentUsedThisRound(player, "trade_lobby")) {
    return {
      legal: false,
      reason: "Trade Lobby has already shifted demand this round",
    };
  }
  return { legal: true };
}

export function applyShiftDemand(
  draft: Draft<GameState>,
  action: ShiftDemandAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  if (!claimRoundUse(player, "trade_lobby")) return;
  draft.demand = Math.max(
    DEMAND_MIN,
    Math.min(DEMAND_MAX, draft.demand + action.delta),
  );
}
