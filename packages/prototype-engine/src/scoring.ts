// Bourbonomics — end-game scoring (ground-up rebuild).
//
// Final score = Capital + Reputation. Reputation is the sum of the demand cards
// a player COMPLETED and kept — the sole prestige source. Scoring is final and
// simple; the tiebreak is most cards completed (then most bourbons sold). `[PH]`.

import type { GameState, Player } from "./types";

export interface PlayerScore {
  playerId: string;
  name: string;
  capital: number;
  /** Sum of kept demand cards' Reputation values. */
  reputation: number;
  total: number;
  cardsCompleted: number;
  bourbonsSold: number;
}

/** Reputation a player has banked from completed-and-kept demand cards. */
export function reputationOf(player: Player): number {
  return player.keptCards.reduce((sum, c) => sum + c.reputation, 0);
}

/** Final score = Capital + Reputation. */
export function scorePlayer(player: Player): PlayerScore {
  const reputation = reputationOf(player);
  return {
    playerId: player.id,
    name: player.name,
    capital: player.capital,
    reputation,
    total: player.capital + reputation,
    cardsCompleted: player.cardsCompleted,
    bourbonsSold: player.bourbonsSold,
  };
}

/** Ranked high→low. Tiebreak: most cards completed, then most bourbons sold. */
export function rankPlayers(state: GameState): PlayerScore[] {
  return state.players
    .map(scorePlayer)
    .sort(
      (a, b) =>
        b.total - a.total ||
        b.cardsCompleted - a.cardsCompleted ||
        b.bourbonsSold - a.bourbonsSold,
    );
}
