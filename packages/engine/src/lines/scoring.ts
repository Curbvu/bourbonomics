import type { Line, PlayerState } from "../types";
import { getLineBoardDef } from "./boards";

// v3.2 — inventory scores zero per the spec. The +1/bottle baseline
// from v3.1 is removed. The Vanilla Standard Master completion bonus
// (+5/inventory bottle) STILL applies if its flag has fired — that's
// a flagship reward, not the baseline rule.
const VANILLA_BONUS_REP_PER_INVENTORY_BOTTLE = 5;

/**
 * v3.2 — end-game score for one Line.
 *
 * Flagship: sums each filled slot's endGameValue from the bound
 * board. No failure penalty — the flagship board was a gift, not a
 * bet.
 *
 * Secondary lines: empty in v3.2 phase 16 (Line Card secondaries are
 * removed; Brand Portfolio secondaries land in a follow-on phase).
 *
 * Slot rewards and the Completion Bonus's immediate rep have already
 * been credited to `player.reputation` during play; they are NOT
 * counted again here.
 *
 * The Connoisseur prestigeScoringDoubled flag remains a no-op until a
 * baseline end-game prestige scoring rule exists.
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
 * v3.2 inventory scoring. **Inventory baseline is zero** (v3.1's
 * +1/bottle is removed). The Vanilla flagship's Standard Master
 * Completion Bonus still adds +5 rep per inventory bottle when its
 * flag has triggered.
 */
export function scoreInventory(player: PlayerState): number {
  if (!player.inventoryBottleBonusActive) return 0;
  return player.inventory.length * VANILLA_BONUS_REP_PER_INVENTORY_BOTTLE;
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
