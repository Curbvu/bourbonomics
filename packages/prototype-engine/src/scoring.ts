// Bourbonomics — end-game scoring (ground-up revision).
//
// Final score = Capital + Reputation (prestige converted in). The prestige
// SOURCE is 🚧 STUBBED (see GAME_RULES.md): until the engine / collection
// design lands, prestige trickles only from distillery signatures, so most
// scores are Capital-dominated. Scoring itself is final and simple.

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

/** Final score = capital + prestige (converted to Reputation). */
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
