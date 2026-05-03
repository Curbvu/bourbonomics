/**
 * Bot driver — auto-advances state through consecutive bot turns.
 *
 * Call `driveBots(state)` after any human-facing transition. It repeatedly
 * dispatches bot actions while `currentPlayerId` is a bot (or while the phase
 * is one where bots resolve on their own — fees, market). Returns the new state
 * when the next human decision is required OR the game is over.
 */

import { reduce } from "@/lib/engine/reducer";
import type { GameState, Player } from "@/lib/engine/state";
import { totalFeesForPlayer } from "@/lib/rules/fees";
import {
  pickActionPhaseMove,
  pickFeePayment,
  pickMarketMove,
} from "./bot";
import { ownedBarrels } from "./evaluators";

const MAX_AUTOMATIC_STEPS = 200;

/**
 * Should the bot take a distressed loan before paying fees?
 *
 * Yes when ALL of:
 *   - the loan is available (never used, no debt outstanding)
 *   - they can't cover rent on cash alone
 *   - they own at least one barrel worth aging (age + 1 < max useful age)
 *
 * The default fee-payment AI silently skips barrels it can't pay for —
 * those barrels then don't age that round. A bot that consistently
 * skips fees never gets aged barrels, never sells, and gets stuck at $0
 * forever. The loan ($10 in, $15 out next Phase 1) lets the bot age
 * its way to a real sale that clears the debt. Taking it once per
 * game is the difference between a frozen opponent and a real one.
 */
function shouldTakeLoan(state: GameState, p: Player): boolean {
  if (p.loanUsed) return false;
  if (p.loanRemaining > 0) return false;
  const owed = totalFeesForPlayer(state, p.id);
  if (p.cash >= owed) return false;
  // Need at least one barrel worth keeping alive — otherwise the loan is
  // just deferred pain. "Worth aging" = exists and not already at the
  // stale 12y+ ceiling.
  const barrels = ownedBarrels(state, p.id);
  if (barrels.length === 0) return false;
  return barrels.some(({ barrel }) => barrel.age < 12);
}

export function driveBots(initial: GameState): GameState {
  let state = initial;
  for (let steps = 0; steps < MAX_AUTOMATIC_STEPS; steps++) {
    if (state.phase === "gameover") return state;

    const current = state.players[state.currentPlayerId];
    const needsHuman = current?.kind === "human" && !current.eliminated;

    switch (state.phase) {
      case "distillery_draft": {
        // Confirm distilleries for every bot that hasn't yet chosen,
        // independent of seat order. The draft isn't turn-based — each
        // baron decides simultaneously — so a human in seat 1 should not
        // block a bot in seat 2 from auto-picking. Choice is intentionally
        // simple (always the first dealt card) so seeded games stay
        // deterministic; smarter draft AI is a follow-up.
        const nextBot = state.playerOrder.find(
          (id) =>
            !state.players[id].eliminated &&
            !state.players[id].chosenDistilleryId &&
            state.players[id].kind === "bot",
        );
        if (nextBot) {
          const p = state.players[nextBot];
          const dealt = p.dealtDistilleryIds ?? [];
          if (dealt.length === 0) return state;
          state = reduce(state, {
            t: "DISTILLERY_CONFIRM",
            playerId: p.id,
            chosenId: dealt[0],
          });
          continue;
        }
        // No bot left to confirm — either the human still owes a pick
        // (return so the modal renders) or everyone's done and the
        // reducer has already advanced the phase.
        return state;
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
        // Take a one-time loan before paying if the bot is short on cash
        // and has barrels worth keeping alive. Without this, bots silently
        // skip rent → barrels never age → no sales → stuck at $0 forever.
        if (shouldTakeLoan(state, p)) {
          state = reduce(state, {
            t: "TAKE_DISTRESSED_LOAN",
            playerId: p.id,
          });
          continue;
        }
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
