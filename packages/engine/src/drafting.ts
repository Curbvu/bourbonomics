import type { MashBill } from "./types";

// ============================================================
// Mash-bill snake-draft helpers.
//
// Setup Step 2 deals N×3 mash bills face-up and players snake-draft
// (1-2-3-3-2-1, etc.). These pure helpers encode the snake-order
// math so a UI / runner can drive the draft externally.
//
// Starter-deck composition helpers were retired in v2.4 when the
// starter draft was replaced by the random deal + trading window
// (see `starter-pool.ts`).
// ============================================================

/**
 * Snake-draft player index sequence. With 3 players and 3 picks each, returns:
 *   [0, 1, 2, 2, 1, 0, 0, 1, 2]
 */
export function snakeDraftOrder(numPlayers: number, picksPerPlayer: number): number[] {
  const order: number[] = [];
  for (let round = 0; round < picksPerPlayer; round++) {
    if (round % 2 === 0) {
      for (let p = 0; p < numPlayers; p++) order.push(p);
    } else {
      for (let p = numPlayers - 1; p >= 0; p--) order.push(p);
    }
  }
  return order;
}

/**
 * Apply explicit mash-bill picks to a snake draft.
 * `pickIndices[i]` is the index (into the pool *after* prior picks have been
 * removed) chosen by the i-th drafter in snake order.
 */
export function executeMashBillDraft(
  pool: readonly MashBill[],
  numPlayers: number,
  pickIndices: readonly number[],
): { perPlayer: MashBill[][]; remainingPool: MashBill[] } {
  const picksPerPlayer = pickIndices.length / numPlayers;
  if (!Number.isInteger(picksPerPlayer)) {
    throw new RangeError(
      `pickIndices length (${pickIndices.length}) is not divisible by numPlayers (${numPlayers})`,
    );
  }
  const remainingPool = pool.slice();
  const perPlayer: MashBill[][] = Array.from({ length: numPlayers }, () => []);
  const order = snakeDraftOrder(numPlayers, picksPerPlayer);
  for (let i = 0; i < pickIndices.length; i++) {
    const playerIdx = order[i]!;
    const poolIdx = pickIndices[i]!;
    if (poolIdx < 0 || poolIdx >= remainingPool.length) {
      throw new RangeError(
        `pick index ${poolIdx} out of range (pool size ${remainingPool.length})`,
      );
    }
    const [bill] = remainingPool.splice(poolIdx, 1);
    perPlayer[playerIdx]!.push(bill!);
  }
  return { perPlayer, remainingPool };
}

/**
 * Naive auto-draft: every player picks the top of the remaining pool.
 * Useful for tests and headless game setup; real games should drive picks
 * from the UI.
 */
export function autoDraftMashBills(
  pool: readonly MashBill[],
  numPlayers: number,
  picksPerPlayer: number,
): { perPlayer: MashBill[][]; remainingPool: MashBill[] } {
  const total = numPlayers * picksPerPlayer;
  const indices = new Array<number>(total).fill(0); // always pick the first
  return executeMashBillDraft(pool, numPlayers, indices);
}
