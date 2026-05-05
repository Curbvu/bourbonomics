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
  const col = Math.max(0, Math.min(2, baseCol + colOffset));
  const cell = mashBill.rewardGrid[row]?.[col];
  return (cell ?? 0) + (options?.gridRepOffset ?? 0);
}

function bandIndex(value: number, bands: readonly [number, number, number]): number {
  if (value < bands[0]!) return -1;
  if (value < bands[1]!) return 0;
  if (value < bands[2]!) return 1;
  return 2;
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
