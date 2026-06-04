// Bourbonomics PROTOTYPE — end-game scoring.

import { prestigeToCapital } from "./config";
import type { GameState, Player } from "./types";

export interface PlayerScore {
  playerId: string;
  name: string;
  capital: number;
  prestige: number;
  prestigeAsCapital: number;
  total: number;
  bourbonsSold: number;
}

/** Final score = capital + prestige (converted). */
export function scorePlayer(player: Player): PlayerScore {
  const prestigeAsCapital = prestigeToCapital(player.prestige);
  return {
    playerId: player.id,
    name: player.name,
    capital: player.capital,
    prestige: player.prestige,
    prestigeAsCapital,
    total: player.capital + prestigeAsCapital,
    bourbonsSold: player.bourbonsSold,
  };
}

/** Ranked high→low. Tiebreak: most bourbons sold. */
export function rankPlayers(state: GameState): PlayerScore[] {
  return state.players
    .map(scorePlayer)
    .sort((a, b) => b.total - a.total || b.bourbonsSold - a.bourbonsSold);
}
