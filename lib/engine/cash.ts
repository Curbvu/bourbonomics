/**
 * Cash crediting helper that enforces the Distressed Distiller's Loan
 * siphon (GAME_RULES.md §Distressed Distiller's Loan).
 *
 * When `loanSiphonActive` is on, every dollar of NEW income owed to the
 * player is intercepted: as much as possible is paid to the bank against
 * `loanRemaining`, and only the residual lands in the player's cash pool.
 * Once the loan clears, siphon mode automatically deactivates.
 *
 * Use this for every income site: sale proceeds, operations payouts,
 * resource-modifier bank_payout, etc. Direct cash debits (rent, capital,
 * action cost) bypass this — they're outflows, not credits.
 *
 * The companion `canSpend()` predicate enforces the "frozen out of
 * cash flow" half of the punishment: while the siphon is active the
 * player cannot spend on actions, capital, or rent.
 */

import { logEvent } from "./phases";
import type { GameState } from "./state";

/**
 * Credit `amount` cash to the player, applying the loan siphon if it's
 * active. `source` is a free-form tag for the log entry (e.g. "sale",
 * "ops:county_rebate", "make_bourbon_bank_payout"). Negative or zero
 * amounts are no-ops.
 */
export function creditCash(
  state: GameState,
  playerId: string,
  amount: number,
  source: string,
): void {
  if (amount <= 0) return;
  const player = state.players[playerId];
  if (!player) return;

  let toLoan = 0;
  let toCash = amount;
  if (player.loanSiphonActive && player.loanRemaining > 0) {
    toLoan = Math.min(amount, player.loanRemaining);
    toCash = amount - toLoan;
    player.loanRemaining -= toLoan;
    logEvent(state, "loan_siphon", {
      playerId,
      amount: toLoan,
      source,
      remaining: player.loanRemaining,
    });
    if (player.loanRemaining === 0) {
      player.loanSiphonActive = false;
      logEvent(state, "loan_cleared", { playerId });
    }
  }
  if (toCash > 0) player.cash += toCash;
}

/**
 * Returns true when the player is allowed to spend cash. Players in
 * loan-siphon mode are frozen out of all spending (rent, capital,
 * action cost) until the loan clears.
 */
export function canSpend(state: GameState, playerId: string): boolean {
  const p = state.players[playerId];
  if (!p) return false;
  return !p.loanSiphonActive;
}
