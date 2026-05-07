/**
 * Server-side orchestrator gate.
 *
 * The engine's `awaitingHumanInput` is opinionated about setup phases
 * only — it returns the on-the-clock human for distillery selection
 * and the starter trade window, but null for draw / action phases.
 * That's intentional for the solo client: with autoplay on, the
 * orchestrator auto-fires DRAW_HAND for humans and runs the bot AI
 * over their action turn, so the user can watch a full game play
 * itself.
 *
 * In multi-player that behaviour is wrong — the server would steal
 * the human's draw click and play their action turn before they ever
 * see the board. This helper answers the stricter MP question:
 *
 *   "Is the cursor on a human seat that needs to act?"
 *
 * If yes, the server should NOT call `stepOrchestrator` — the human
 * will dispatch their own action when ready. Both the inline action
 * handler (`driveBotsForward`) and the cron Tick Lambda use this in
 * place of `awaitingHumanInput`.
 */

import type { GameState, PlayerState } from "@bourbonomics/engine";

export function nextActorIsHuman(state: GameState): boolean {
  switch (state.phase) {
    case "distillery_selection": {
      const id =
        state.distillerySelectionOrder[state.distillerySelectionCursor];
      const picker = id ? state.players.find((p) => p.id === id) : undefined;
      return isHuman(picker);
    }
    case "starter_deck_draft": {
      const next = state.starterDeckDraftOrder
        .map((id) => state.players.find((p) => p.id === id))
        .find(
          (p): p is PlayerState =>
            p !== undefined && !p.starterPassed,
        );
      return isHuman(next);
    }
    case "draw": {
      const next = state.players.find(
        (p) => !state.playerIdsCompletedPhase.includes(p.id),
      );
      return isHuman(next);
    }
    case "action": {
      const current = state.players[state.currentPlayerIndex];
      return isHuman(current);
    }
    case "demand": {
      // Demand-rolling is a once-per-round ceremony the host clicks
      // through via DemandRollModal (only the host sees it in MP).
      // Without this gate the server auto-rolls before the modal can
      // render, and the host never gets the visible roll animation.
      const host = state.players[0];
      return isHuman(host);
    }
    // `setup` / `cleanup` / `ended` aren't states the orchestrator
    // runs during normal play.
    case "setup":
    case "cleanup":
    case "ended":
      return false;
  }
}

function isHuman(player: PlayerState | undefined): boolean {
  return player !== undefined && player.isBot === false;
}
