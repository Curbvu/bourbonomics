import type { Draft } from "immer";
import type { Barrel, Card, GameState, PlayerState } from "./types";

export function findPlayer(state: GameState, id: string): PlayerState | undefined {
  return state.players.find((p) => p.id === id);
}

export function findPlayerIndex(state: GameState, id: string): number {
  return state.players.findIndex((p) => p.id === id);
}

export function requirePlayer(state: GameState, id: string): PlayerState {
  const p = findPlayer(state, id);
  if (!p) throw new Error(`Player ${id} not found`);
  return p;
}

export function getCurrentPlayer(state: GameState): PlayerState | undefined {
  return state.players[state.currentPlayerIndex];
}

export function isCurrentPlayer(state: GameState, playerId: string): boolean {
  return getCurrentPlayer(state)?.id === playerId;
}

export function findCardInHand(player: PlayerState, cardId: string): Card | undefined {
  return player.hand.find((c) => c.id === cardId);
}

export function findBarrel(state: GameState, barrelId: string): Barrel | undefined {
  return state.allBarrels.find((b) => b.id === barrelId);
}

export function getPlayerBarrels(state: GameState, playerId: string): Barrel[] {
  return state.allBarrels.filter((b) => b.ownerId === playerId);
}

export function playerRickhouseFull(state: GameState, playerId: string): boolean {
  const player = findPlayer(state, playerId);
  if (!player) return false;
  const occupied = state.allBarrels.filter((b) => b.ownerId === playerId).length;
  return occupied >= player.rickhouseSlots.length && player.rickhouseSlots.length > 0;
}

/**
 * v2.6 "open slot" — a slot id that holds NO barrel at all. Distinct
 * from a "ready" slot (bill present, no commits) which is taken from
 * a draw-target perspective. DRAW_MASH_BILL targets open slots only.
 */
export function emptySlotsFor(state: GameState, playerId: string): string[] {
  const player = findPlayer(state, playerId);
  if (!player) return [];
  const taken = new Set(state.allBarrels.filter((b) => b.ownerId === playerId).map((b) => b.slotId));
  return player.rickhouseSlots.filter((s) => !taken.has(s.id)).map((s) => s.id);
}

/** Number of slots currently bound to a bill (any phase: ready / construction / aging). */
export function slottedBillCount(state: GameState, playerId: string): number {
  return state.allBarrels.filter((b) => b.ownerId === playerId).length;
}

/**
 * Find the next player index whose `outForRound` is false, walking
 * clockwise (seat order +1 mod n) from `fromIndex`. Returns -1 if all
 * players are out for the round.
 */
export function nextActivePlayerIndex(state: GameState, fromIndex: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (!state.players[idx]!.outForRound) return idx;
  }
  return -1;
}

/** Action phase is complete once every player has ended their turn. */
export function actionPhaseComplete(state: GameState): boolean {
  return state.players.every((p) => p.outForRound);
}

/**
 * End the active player's full turn for the round. Marks them out, clears
 * any "this turn" flags, and either advances the cursor to the next active
 * seat or — if every player is now out — runs the cleanup phase.
 *
 * Under v2.2 a turn ends only when the player explicitly passes (PASS_TURN)
 * or — for hand-empty players whose turn must still be advanced — when an
 * action handler determines no further play is available. Individual main
 * actions (Make / Age / Sell / Buy / Draw / Trade) do NOT end the turn.
 */
export function endPlayerTurn(draft: Draft<GameState>, playerId: string): void {
  const player = draft.players.find((p) => p.id === playerId)!;
  player.outForRound = true;
  // Insider Buyer's half-cost is a "this turn" effect — drop it on
  // turn end so an unused discount can't carry forward.
  player.pendingHalfCostMarketBuy = false;
  // v2.5: clear the per-turn commit gate on every barrel this player
  // owns so the next time they're on the clock they can commit again.
  for (const b of draft.allBarrels) {
    if (b.ownerId === playerId) b.committedThisTurn = false;
  }

  if (actionPhaseComplete(draft)) {
    runCleanupPhase(draft);
    return;
  }
  draft.currentPlayerIndex = nextActivePlayerIndex(draft, draft.currentPlayerIndex);
}

/**
 * Cleanup: discard remaining hand cards, reset per-round flags, rotate
 * the start player one seat counter-clockwise, and advance to the next
 * round (or end the game if the final round was triggered).
 *
 * Operations cards are NOT discarded at end of round — they persist across
 * rounds until played.
 */
export function runCleanupPhase(draft: Draft<GameState>): void {
  draft.phase = "cleanup";

  for (const p of draft.players) {
    if (p.hand.length > 0) {
      p.discard.push(...p.hand);
      p.hand = [];
    }
    p.outForRound = false;
    p.demandSurgeActive = false;
    p.pendingHalfCostMarketBuy = false;
  }

  for (const b of draft.allBarrels) {
    b.agedThisRound = false;
    b.inspectedThisRound = false;
    b.extraAgesAvailable = 0;
    b.committedThisTurn = false;
  }

  if (draft.finalRoundTriggered) {
    draft.phase = "ended";
    return;
  }

  // Rotate the start player one seat counter-clockwise. The player who
  // ended their turn last in round N becomes the first player in round
  // N+1 (the "bookend" — see GAME_RULES.md §Turn Order and the Bookend).
  const n = draft.players.length;
  draft.startPlayerIndex = (draft.startPlayerIndex - 1 + n) % n;

  draft.round += 1;
  draft.phase = "demand";
  draft.currentPlayerIndex = draft.startPlayerIndex;
  draft.playerIdsCompletedPhase = [];
}
