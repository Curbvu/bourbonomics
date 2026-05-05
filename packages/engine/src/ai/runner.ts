import type { GameAction, GameState, PlayerState } from "../types";
import { applyAction, isGameOver } from "../engine";
import { roll2d6 } from "../rng";
import { chooseAction, chooseDistillery, chooseStarterDeck } from "./bot";

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
    if (!action) {
      throw new Error(
        `playFullBotGame stalled: phase=${state.phase} requires human input`,
      );
    }
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
 * Returns null if the game has ended OR if the next pick belongs to a human.
 */
export function stepOrchestrator(
  state: GameState,
): { state: GameState; action: GameAction } | null {
  if (isGameOver(state)) return null;
  const action = nextOrchestratorAction(state);
  if (!action) return null;
  const next = applyOrchestratorStep(state, action);
  return { state: next, action };
}

/**
 * Decide what the orchestrator does next given the current phase.
 * Returns null if the next pick belongs to a non-bot player who hasn't
 * submitted yet.
 */
export function nextOrchestratorAction(state: GameState): GameAction | null {
  switch (state.phase) {
    case "distillery_selection": {
      const nextPickerId = state.distillerySelectionOrder[state.distillerySelectionCursor];
      if (!nextPickerId) {
        throw new Error("distillery selection has no remaining pickers");
      }
      const picker = state.players.find((p) => p.id === nextPickerId);
      if (picker && picker.isBot === false) return null;
      return chooseDistillery(state, nextPickerId);
    }
    case "starter_deck_draft": {
      const nextPickerId = state.starterDeckDraftOrder[state.starterDeckDraftCursor];
      if (!nextPickerId) {
        throw new Error("starter-deck draft has no remaining pickers");
      }
      const picker = state.players.find((p) => p.id === nextPickerId);
      if (picker && picker.isBot === false) return null;
      return chooseStarterDeck(nextPickerId);
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

/**
 * If `state` is in a setup phase that expects human input, returns the
 * `PlayerState` of the player on the clock. Otherwise null.
 */
export function awaitingHumanInput(state: GameState): PlayerState | null {
  if (state.phase === "distillery_selection") {
    const id = state.distillerySelectionOrder[state.distillerySelectionCursor];
    const picker = id ? state.players.find((p) => p.id === id) : undefined;
    if (picker && picker.isBot === false) return picker;
  } else if (state.phase === "starter_deck_draft") {
    const id = state.starterDeckDraftOrder[state.starterDeckDraftCursor];
    const picker = id ? state.players.find((p) => p.id === id) : undefined;
    if (picker && picker.isBot === false) return picker;
  }
  return null;
}

/** Apply the action, plus any out-of-band rng-state updates the action needs. */
function applyOrchestratorStep(state: GameState, action: GameAction): GameState {
  if (action.type === "ROLL_DEMAND") {
    const [, nextRng] = roll2d6(state.rngState);
    return applyAction({ ...state, rngState: nextRng }, action);
  }
  return applyAction(state, action);
}
