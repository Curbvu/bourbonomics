import type { Draft } from "immer";
import type { Barrel, Card, GameState, MashBill, PlayerState } from "./types";

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

export function findMashBillInHand(player: PlayerState, mashBillId: string): MashBill | undefined {
  return player.mashBills.find((m) => m.id === mashBillId);
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

export function emptySlotsFor(state: GameState, playerId: string): string[] {
  const player = findPlayer(state, playerId);
  if (!player) return [];
  const taken = new Set(state.allBarrels.filter((b) => b.ownerId === playerId).map((b) => b.slotId));
  return player.rickhouseSlots.filter((s) => !taken.has(s.id)).map((s) => s.id);
}

/**
 * Find the next player index whose `outForRound` is false.
 * Returns -1 if all players are out.
 */
export function nextActivePlayerIndex(state: GameState, fromIndex: number): number {
  const n = state.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (fromIndex + step) % n;
    if (!state.players[idx]!.outForRound) return idx;
  }
  return -1;
}

/** Action phase is complete once every player is marked out (or has empty hand). */
export function actionPhaseComplete(state: GameState): boolean {
  return state.players.every((p) => p.outForRound || p.hand.length === 0);
}

/**
 * Advance the turn after a player completes an action. If the player's hand is
 * empty, mark them out. If everyone is out, transition to cleanup → next round
 * (or to "ended" if the final round was triggered).
 */
export function endPlayerTurn(draft: Draft<GameState>, playerId: string): void {
  const player = draft.players.find((p) => p.id === playerId)!;
  if (player.hand.length === 0) {
    player.outForRound = true;
  }
  if (actionPhaseComplete(draft)) {
    runCleanupPhase(draft);
    return;
  }
  draft.currentPlayerIndex = nextActivePlayerIndex(draft, draft.currentPlayerIndex);
}

/**
 * Cleanup: discard remaining hand cards, reset per-round flags, and advance
 * to the next round (or end the game if the final round was triggered).
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
    p.brokerFreeTradeUsed = false;
    p.pendingHalfCostMarketBuy = false;
  }

  for (const b of draft.allBarrels) {
    b.agedThisRound = false;
    b.inspectedThisRound = false;
    b.extraAgesAvailable = 0;
  }

  if (draft.finalRoundTriggered) {
    draft.phase = "ended";
    return;
  }

  draft.round += 1;
  draft.phase = "demand";
  draft.currentPlayerIndex = 0;
  draft.playerIdsCompletedPhase = [];
}
