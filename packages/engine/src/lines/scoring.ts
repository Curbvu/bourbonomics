import type { Line, PlayerState } from "../types";
import { getLineBoardDef } from "./boards";

const INVENTORY_REP_PER_BOTTLE = 1;
const VANILLA_BONUS_REP_PER_INVENTORY_BOTTLE = 5;

/**
 * v3.1 — end-game score for one Line. Sums each filled slot's
 * `endGameValue` from the bound board definition. Secondary lines
 * (no `slots` field in phase 5) score 0. Unknown board ids score 0.
 *
 * Slot rewards and the Completion Bonus's immediate rep have already
 * been credited to `player.reputation` during play; they are NOT
 * counted again here.
 *
 * Phase 5 deliberately omits secondary line failure penalties (no
 * secondaries to penalize) and the persistent end-game multipliers
 * like Connoisseur's `prestigeScoringDoubled` (those land alongside
 * end-game prestige scoring in phase 8).
 */
export function scoreLine(line: Line, _player: PlayerState): number {
  if (!line.slots) return 0;
  if (!line.lineBoardId) return 0;
  const board = getLineBoardDef(line.lineBoardId);
  if (!board) return 0;
  let total = 0;
  for (let i = 0; i < line.slots.length; i++) {
    if (line.slots[i]!.filled) {
      total += board.slots[i]?.endGameValue ?? 0;
    }
  }
  return total;
}

/**
 * v3.1 inventory scoring. Baseline +1 rep per bottle, plus +5 rep per
 * bottle if Vanilla's Standard Master Completion Bonus has triggered.
 */
export function scoreInventory(player: PlayerState): number {
  const baseline = player.inventory.length * INVENTORY_REP_PER_BOTTLE;
  if (!player.inventoryBottleBonusActive) return baseline;
  return baseline + player.inventory.length * VANILLA_BONUS_REP_PER_INVENTORY_BOTTLE;
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
