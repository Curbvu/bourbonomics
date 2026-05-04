import type { GameAction, GameState } from "../types.js";
import { applyAction, isGameOver } from "../engine.js";
import { roll2d6 } from "../rng.js";
import { chooseAction } from "./bot.js";

/**
 * Drive a game where every player is a bot. Returns the final state.
 *
 * The orchestrator advances the engine deterministically:
 *   - During the demand phase, it rolls 2d6 from state.rngState.
 *   - During the draw phase, it issues DRAW_HAND for every player in turn.
 *   - During the action phase, it asks the current player's bot to choose.
 *   - The game ends when the engine reports phase === "ended".
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

/** Decide what the orchestrator does next given the current phase. */
function nextOrchestratorAction(state: GameState): GameAction {
  switch (state.phase) {
    case "demand": {
      const [roll] = roll2d6(state.rngState);
      return { type: "ROLL_DEMAND", roll };
    }
    case "draw": {
      // Find the next player who hasn't drawn yet.
      const next = state.players.find(
        (p) => !state.playerIdsCompletedPhase.includes(p.id),
      );
      if (!next) {
        // Shouldn't happen — the engine auto-advances on the last DRAW_HAND.
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
    // ROLL_DEMAND consumes a 2d6 from the RNG, but the engine reducer only
    // sees the roll value — we have to advance state.rngState ourselves so
    // subsequent rolls don't reuse the same state.
    const [, nextRng] = roll2d6(state.rngState);
    return applyAction({ ...state, rngState: nextRng }, action);
  }
  return applyAction(state, action);
}
