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
  pickOpeningCommit,
  pickOpeningKeep,
} from "./bot";

const MAX_AUTOMATIC_STEPS = 200;

export function driveBots(initial: GameState): GameState {
  let state = initial;
  for (let steps = 0; steps < MAX_AUTOMATIC_STEPS; steps++) {
    if (state.phase === "gameover") return state;

    const current = state.players[state.currentPlayerId];
    const needsHuman = current?.kind === "human" && !current.eliminated;

    switch (state.phase) {
      case "opening": {
        if (needsHuman) {
          const needsKeep = current.openingDraft !== null;
          if (needsKeep) return state;
          const needsCommit = current.openingKeptBeforeAuction !== null;
          if (needsCommit) return state;
          // Human is fully opened; keep stepping for other players.
        }
        const p = current;
        if (!p || p.eliminated) return state;
        if (p.openingDraft !== null) {
          state = reduce(state, {
            t: "OPENING_KEEP",
            playerId: p.id,
            keptIds: pickOpeningKeep(p),
          });
          continue;
        }
        if (p.openingKeptBeforeAuction !== null) {
          state = reduce(state, {
            t: "OPENING_COMMIT",
            playerId: p.id,
            decisions: pickOpeningCommit(p),
          });
          continue;
        }
        // Player fully opened; advance by nudging currentPlayerId.
        state = {
          ...state,
          currentPlayerId: nextPlayer(state),
        };
        continue;
      }

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
        // Each not-yet-resolved bot rolls.
        const nextUnresolved = state.playerOrder.find(
          (id) =>
            !state.players[id].eliminated &&
            !state.players[id].marketResolved,
        );
        if (!nextUnresolved) return state;
        const p = state.players[nextUnresolved];
        if (p.kind === "human") return state;
        state = reduce(state, pickMarketMove(state, p.id));
        continue;
      }

      default:
        return state;
    }
  }
  return state;
}

function nextPlayer(state: GameState): string {
  const order = state.playerOrder;
  const idx = order.indexOf(state.currentPlayerId);
  for (let i = 1; i <= order.length; i++) {
    const cand = order[(idx + i) % order.length];
    if (!state.players[cand].eliminated) return cand;
  }
  return state.currentPlayerId;
}
