// Bourbonomics PROTOTYPE — end-game scoring.

import { prestigeToCapital } from "./config";
import type { BrandLine, GameState, Player } from "./types";

export interface PlayerScore {
  playerId: string;
  name: string;
  capital: number;
  /** Prestige banked during play PLUS any end-game line bonuses. */
  prestige: number;
  prestigeAsCapital: number;
  total: number;
  bourbonsSold: number;
}

/**
 * Expressions "house-style" end bonus for a single line, checked once here at
 * scoring (not at placement). Pays the card's `houseStyleBonus` prestige iff:
 *   1. every optional slot is filled,
 *   2. all filled optional bottles share one expression, AND
 *   3. each optional bottle's expression DIFFERS from its paired required's.
 * The "differs" clause is what stops a monochrome line from trivially claiming
 * the bonus. Returns 0 for any line without a bonus or that fails a clause.
 */
export function houseStyleBonus(line: BrandLine): number {
  const bonus = line.slotCard.houseStyleBonus;
  if (bonus === undefined) return 0;

  const optionalIdxs = line.slotCard.slots
    .map((s, i) => (s.optional ? i : -1))
    .filter((i) => i >= 0);
  if (optionalIdxs.length === 0) return 0;

  let sharedExpression: string | null = null;
  for (const i of optionalIdxs) {
    const bottle = line.slots[i];
    if (!bottle) return 0; // (1) all optional slots filled
    // (2) all optionals share one expression
    if (sharedExpression === null) sharedExpression = bottle.expression;
    else if (bottle.expression !== sharedExpression) return 0;
    // (3) each optional differs from its paired required's expression
    const pairIdx = line.slotCard.slots[i]!.matchAgeOfSlot;
    if (pairIdx !== undefined) {
      const paired = line.slots[pairIdx];
      if (paired && paired.expression === bottle.expression) return 0;
    }
  }
  return bonus;
}

/** Final score = capital + prestige (converted), incl. end-game line bonuses. */
export function scorePlayer(player: Player): PlayerScore {
  const lineBonus = player.brandLines.reduce(
    (sum, line) => sum + houseStyleBonus(line),
    0,
  );
  const prestige = player.prestige + lineBonus;
  const prestigeAsCapital = prestigeToCapital(prestige);
  return {
    playerId: player.id,
    name: player.name,
    capital: player.capital,
    prestige,
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
