import type { Line, PlayerState } from "../types";
import { getLineBoardDef } from "./boards";
import { getLineCardDef } from "./cards";

const EMPTY_LINE_PENALTY_PER_CARD = -2;
const INVENTORY_REP_PER_BOTTLE = 1;

/**
 * End-game score for one line.
 *
 * Empty lines (0 bottles) pay −2 rep per stacked Line Card; the Line
 * Board itself contributes 0 in that case (it was pre-claimed at
 * setup, not actively chosen, so the brief is explicit it never
 * scores negative).
 *
 * Non-empty lines: Line Board's rule + each stacked card's rule, all
 * summed. Unknown defIds (corrupted save) contribute 0.
 */
export function scoreLine(line: Line, player: PlayerState): number {
  if (line.bottles.length === 0) {
    if (line.stackedCards.length === 0) return 0;
    return line.stackedCards.length * EMPTY_LINE_PENALTY_PER_CARD;
  }
  let total = 0;
  if (line.lineBoardId) {
    const board = getLineBoardDef(line.lineBoardId);
    if (board) total += board.endGameScore(line, player);
  }
  for (const cardInstance of line.stackedCards) {
    const def = getLineCardDef(cardInstance.defId);
    if (def) total += def.endGameScore(line, player);
  }
  return total;
}

/** Bottles in inventory each score 1 rep at end of game. */
export function scoreInventory(player: PlayerState): number {
  return player.inventory.length * INVENTORY_REP_PER_BOTTLE;
}

/**
 * Full Line-system end-game contribution for a player. Returns the
 * breakdown alongside the total so `computeFinalScores` can populate
 * the `ScoreResult` rows.
 */
export function scoreEndGameLines(player: PlayerState): {
  flagshipScore: number;
  secondaryScores: number[];
  inventoryScore: number;
  total: number;
} {
  const flagshipScore = scoreLine(player.flagshipLine, player);
  const secondaryScores = player.secondaryLines.map((l) => scoreLine(l, player));
  const inventoryScore = scoreInventory(player);
  const total =
    flagshipScore +
    secondaryScores.reduce((a, b) => a + b, 0) +
    inventoryScore;
  return { flagshipScore, secondaryScores, inventoryScore, total };
}
