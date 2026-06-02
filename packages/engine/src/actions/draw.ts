import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { runCleanupPhase } from "../state";

type DrawHandAction = Extract<GameAction, { type: "DRAW_HAND" }>;

export function validateDrawHand(
  state: GameState,
  action: DrawHandAction,
): ValidationResult {
  if (state.phase !== "draw") {
    return { legal: false, reason: `phase is "${state.phase}", expected "draw"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (state.playerIdsCompletedPhase.includes(action.playerId)) {
    return { legal: false, reason: `${action.playerId} has already drawn this round` };
  }
  return { legal: true };
}

export function applyDrawHand(
  draft: Draft<GameState>,
  action: DrawHandAction,
): void {
  // v3.10 — DRAW_HAND is pure orchestration. The single hand-refresh
  // action in the game is end-of-turn (PASS_TURN), which discards the
  // resource + Labor hand and redraws to handSize. The initial round-
  // 1 deal happens in setup (`dealInitialHands`), not here. This
  // action's only job is to mark the player phase-complete so the
  // round can hand off the cursor to the action phase.

  draft.playerIdsCompletedPhase.push(action.playerId);

  if (draft.playerIdsCompletedPhase.length === draft.players.length) {
    draft.phase = "action";
    draft.playerIdsCompletedPhase = [];
    for (const p of draft.players) {
      // Players with no cards in hand AND no playable ops can be marked
      // out immediately — the action loop will skip them. Players with
      // an empty resource hand but ops in hand still get a turn (they
      // can play ops cards as free actions before passing).
      p.outForRound = p.hand.length === 0 && p.operationsHand.length === 0;
    }
    if (draft.players.every((p) => p.outForRound)) {
      // No one has any cards — bounce straight through to next round (or end).
      runCleanupPhase(draft);
      return;
    }
    // Action phase begins with the rotated start player. If they happen
    // to be marked out (no cards to play at all), walk forward to the
    // first active seat in turn order.
    const start = draft.startPlayerIndex;
    if (!draft.players[start]!.outForRound) {
      draft.currentPlayerIndex = start;
    } else {
      const n = draft.players.length;
      for (let step = 1; step <= n; step++) {
        const idx = (start + step) % n;
        if (!draft.players[idx]!.outForRound) {
          draft.currentPlayerIndex = idx;
          break;
        }
      }
    }
    // v2.9: arm the first action-phase seat to roll demand. Subsequent
    // seats are armed by `endPlayerTurn` as the cursor hands off.
    const first = draft.players[draft.currentPlayerIndex];
    if (first) first.needsDemandRoll = true;
  }
}
