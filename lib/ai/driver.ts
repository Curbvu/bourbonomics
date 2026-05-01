/**
 * Bot driver — auto-advances state through consecutive bot turns.
 *
 * Call `driveBots(state)` after any human-facing transition. It repeatedly
 * dispatches bot actions while `currentPlayerId` is a bot (or while the phase
 * is one where bots resolve on their own — fees, market). Returns the new state
 * when the next human decision is required OR the game is over.
 */

import { reduce } from "@/lib/engine/reducer";
import type { GameState } from "@/lib/engine/state";
import {
  pickActionPhaseMove,
  pickFeePayment,
  pickMarketMove,
} from "./bot";

const MAX_AUTOMATIC_STEPS = 200;

export function driveBots(initial: GameState): GameState {
  let state = initial;
  for (let steps = 0; steps < MAX_AUTOMATIC_STEPS; steps++) {
    if (state.phase === "gameover") return state;

    const current = state.players[state.currentPlayerId];
    const needsHuman = current?.kind === "human" && !current.eliminated;

    switch (state.phase) {
      case "fees": {
        // Fees resolve per-player in seat order.
        const nextUnresolved = state.playerOrder.find(
          (id) =>
            !state.players[id].eliminated &&
            !state.feesPhase.resolvedPlayerIds.includes(id),
        );
        if (!nextUnresolved) return state;
        const p = state.players[nextUnresolved];
        if (p.kind === "human") return state;
        state = reduce(state, {
          t: "PAY_FEES",
          playerId: p.id,
          barrelIds: pickFeePayment(state, p.id),
        });
        continue;
      }

      case "action": {
        if (needsHuman) return state;
        const p = current;
        if (!p) return state;
        state = reduce(state, pickActionPhaseMove(state, p.id));
        continue;
      }

      case "market": {
        // Use currentPlayerId, NOT playerOrder.find. The reducer's MARKET_DRAW
        // guard requires `state.currentPlayerId === action.playerId`, and
        // `advanceToNextMarketResolver` keeps currentPlayerId pointing at the
        // next-to-resolve player. Picking a different unresolved baron via
        // playerOrder.find dispatches for someone other than currentPlayerId
        // and the reducer silently rejects → driver loops forever → market
        // phase appears "stuck" with no cards drawn.
        const cur = state.players[state.currentPlayerId];
        if (!cur || cur.eliminated || cur.marketResolved) {
          // Defensive: if currentPlayerId is somehow at a resolved /
          // eliminated player, the reducer's advance logic should have moved
          // it. Bail and let the next state update reconcile.
          return state;
        }
        if (cur.kind === "human") return state;
        state = reduce(state, pickMarketMove(state, state.currentPlayerId));
        continue;
      }

      default:
        return state;
    }
  }
  return state;
}
