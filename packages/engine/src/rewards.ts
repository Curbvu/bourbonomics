import type { AwardCondition, MashBill } from "./types";

/**
 * Look up the reward for selling a barrel of the given age into the given
 * demand, using the mash bill's grid. Returns 0 for blank cells (or for ages
 * / demands below the bill's lowest band threshold).
 *
 * Per rules:
 *   1. Find the highest age threshold <= barrel age.
 *   2. Find the highest demand threshold <= current demand.
 *   3. The cell at (row, col) is the reward; null means 0.
 *
 * Optional `options` capture sale-time effect modifiers:
 *   - `demandBandOffset` shifts the column index (e.g. Toasted Oak
 *     reads the grid one band higher).
 *   - `gridRepOffset` adds a flat amount to the chosen cell (e.g.
 *     Single Barrel Cask adds +1 to every band).
 */
export function computeReward(
  mashBill: MashBill,
  age: number,
  demand: number,
  options?: { demandBandOffset?: number; gridRepOffset?: number },
): number {
  const row = bandIndex(age, mashBill.ageBands);
  const baseCol = bandIndex(demand, mashBill.demandBands);
  if (row < 0 || baseCol < 0) return 0;
  const colOffset = options?.demandBandOffset ?? 0;
  // Clamp the offset col against the grid's actual width so demand-
  // band buffs on a narrow common-bill grid (1 or 2 cols) still
  // resolve to a real cell.
  const colMax = Math.max(0, mashBill.demandBands.length - 1);
  const col = Math.max(0, Math.min(colMax, baseCol + colOffset));
  const cell = mashBill.rewardGrid[row]?.[col];
  return (cell ?? 0) + (options?.gridRepOffset ?? 0);
}

/**
 * Returns the highest band index whose threshold is ≤ value, or -1
 * if value falls below the lowest threshold. Variable length —
 * commons may pass a single threshold; legendaries might pass four
 * or five.
 */
function bandIndex(value: number, bands: readonly number[]): number {
  let idx = -1;
  for (let i = 0; i < bands.length; i++) {
    if (value >= bands[i]!) idx = i;
    else break;
  }
  return idx;
}

/** All present conditions must be met. Missing fields are treated as no-constraint. */
export function awardConditionMet(
  cond: AwardCondition,
  age: number,
  demand: number,
  reward: number,
): boolean {
  if (cond.minAge !== undefined && age < cond.minAge) return false;
  if (cond.minDemand !== undefined && demand < cond.minDemand) return false;
  if (cond.minReward !== undefined && reward < cond.minReward) return false;
  return true;
}
