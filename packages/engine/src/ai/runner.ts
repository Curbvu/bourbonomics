import type { GameAction, GameState } from "../types";
import { applyAction, isGameOver } from "../engine";
import { roll2d6 } from "../rng";
import { chooseAction, chooseDistillery } from "./bot";

/**
 * Drive a game where every player is a bot. Returns the final state.
 *
 * The orchestrator advances the engine deterministically through every phase
 * including distillery selection.
 *
 * `maxActions` is a safety cap to prevent runaway loops if a bot keeps emitting
 * no-op actions; default is generous (10,000) for any reasonable game length.
 */
export function playFullBotGame(
  initial: GameState,
  options: { maxActions?: number; onAction?: (state: GameState, action: GameAction) => void } = {},
): GameState {
  const { maxActions = 10_000, onAction } = options;
  let state = initial;
  let count = 0;

  while (!isGameOver(state) && count < maxActions) {
    const action = nextOrchestratorAction(state);
    state = applyOrchestratorStep(state, action);
    if (onAction) onAction(state, action);
    count++;
  }

  if (count >= maxActions) {
    throw new Error(
      `playFullBotGame exceeded maxActions=${maxActions} (round=${state.round}, phase=${state.phase})`,
    );
  }

  return state;
}

/**
 * Single-step the orchestrator: pick the next action and apply it.
 * Returns null if the game has ended. Useful for UIs that want a "step"
 * button or per-frame animation.
 */
export function stepOrchestrator(
  state: GameState,
): { state: GameState; action: GameAction } | null {
  if (isGameOver(state)) return null;
  const action = nextOrchestratorAction(state);
  const next = applyOrchestratorStep(state, action);
  return { state: next, action };
}

/** Decide what the orchestrator does next given the current phase. */
export function nextOrchestratorAction(state: GameState): GameAction {
  switch (state.phase) {
    case "distillery_selection": {
      const nextPickerId = state.distillerySelectionOrder[state.distillerySelectionCursor];
      if (!nextPickerId) {
        throw new Error("distillery selection has no remaining pickers");
      }
      return chooseDistillery(state, nextPickerId);
    }
    case "demand": {
      const [roll] = roll2d6(state.rngState);
      return { type: "ROLL_DEMAND", roll };
    }
    case "draw": {
      const next = state.players.find(
        (p) => !state.playerIdsCompletedPhase.includes(p.id),
      );
      if (!next) {
        throw new Error("draw phase has no remaining players");
      }
      return { type: "DRAW_HAND", playerId: next.id };
    }
    case "action": {
      const current = state.players[state.currentPlayerIndex];
      if (!current) throw new Error("no current player in action phase");
      return chooseAction(state, current.id);
    }
    case "setup":
    case "cleanup":
    case "ended":
      throw new Error(`orchestrator cannot step from phase="${state.phase}"`);
  }
}

/** Apply the action, plus any out-of-band rng-state updates the action needs. */
function applyOrchestratorStep(state: GameState, action: GameAction): GameState {
  if (action.type === "ROLL_DEMAND") {
    const [, nextRng] = roll2d6(state.rngState);
    return applyAction({ ...state, rngState: nextRng }, action);
  }
  return applyAction(state, action);
}
