import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types.js";

type RollDemandAction = Extract<GameAction, { type: "ROLL_DEMAND" }>;

const DEMAND_MAX = 12;

export function validateRollDemand(
  state: GameState,
  action: RollDemandAction,
): ValidationResult {
  if (state.phase !== "demand") {
    return { legal: false, reason: `phase is "${state.phase}", expected "demand"` };
  }
  const [a, b] = action.roll;
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    return { legal: false, reason: "roll values must be integers" };
  }
  if (a < 1 || a > 6 || b < 1 || b > 6) {
    return { legal: false, reason: "roll values must each be in [1, 6]" };
  }
  return { legal: true };
}

export function applyRollDemand(
  draft: Draft<GameState>,
  action: RollDemandAction,
): void {
  const [a, b] = action.roll;
  const sum = a + b;
  const result: "rise" | "hold" = sum > draft.demand ? "rise" : "hold";

  if (result === "rise" && draft.demand < DEMAND_MAX) {
    draft.demand += 1;
  }

  draft.demandRolls.push({ round: draft.round, roll: action.roll, result });
  draft.phase = "draw";
  draft.playerIdsCompletedPhase = [];
}
