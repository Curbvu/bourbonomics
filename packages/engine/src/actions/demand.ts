import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { isCurrentPlayer } from "../state";

type RollDemandAction = Extract<GameAction, { type: "ROLL_DEMAND" }>;

const DEMAND_MAX = 12;

/**
 * v2.9 semantics: demand is rolled by the current player at the top of
 * their own action turn. The roll is gated by `player.needsDemandRoll`
 * (set by the cursor handoff in state.ts), not by a dedicated phase.
 */
export function validateRollDemand(
  state: GameState,
  action: RollDemandAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  if (!player.needsDemandRoll) {
    return { legal: false, reason: "you have already rolled demand this turn" };
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
  // Clear the roll-required flag so the player can take real actions.
  // Phase stays at "action" — demand no longer owns its own phase.
  const player = draft.players.find((p) => p.id === action.playerId)!;
  player.needsDemandRoll = false;
  // v2.9: arm the per-turn aging requirement. The player must commit
  // one card to one of their aging barrels (or abandon one) before
  // the rest of the turn opens up — that's the cost of holding
  // inventory while waiting on demand.
  const hasUnAgedBarrel = draft.allBarrels.some(
    (b) =>
      b.ownerId === action.playerId &&
      b.phase === "aging" &&
      !b.agedThisRound &&
      // A barrel that just finished construction this round can't be
      // aged yet (rule lives in validateAgeBourbon); don't gate the
      // turn on something the engine itself rejects.
      (b.completedInRound == null || draft.round > b.completedInRound),
  );
  player.needsAgeBarrels = hasUnAgedBarrel;
}
