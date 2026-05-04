import type { Card, MashBill, ResourceSubtype, ValidationResult } from "./types";
import { makeCapitalCard, makeResourceCard } from "./cards";

const DEFAULT_STARTER_SIZE = 14;

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

// ---- Starter Deck Composition ----

export interface StarterDeckComposition {
  cask?: number;
  corn?: number;
  rye?: number;
  barley?: number;
  wheat?: number;
  capital?: number;
}

export function totalCards(composition: StarterDeckComposition): number {
  return (
    (composition.cask ?? 0) +
    (composition.corn ?? 0) +
    (composition.rye ?? 0) +
    (composition.barley ?? 0) +
    (composition.wheat ?? 0) +
    (composition.capital ?? 0)
  );
}

export function validateStarterComposition(
  composition: StarterDeckComposition,
  expectedSize: number = DEFAULT_STARTER_SIZE,
): ValidationResult {
  const t = totalCards(composition);
  if (t !== expectedSize) {
    return { legal: false, reason: `composition totals ${t}, expected ${expectedSize}` };
  }
  for (const key of Object.keys(composition) as (keyof StarterDeckComposition)[]) {
    const v = composition[key] ?? 0;
    if (v < 0 || !Number.isInteger(v)) {
      return { legal: false, reason: `${key} must be a non-negative integer (got ${v})` };
    }
  }
  return { legal: true };
}

const RESOURCE_ORDER: ResourceSubtype[] = ["cask", "corn", "rye", "barley", "wheat"];

/**
 * Build a starter deck from a composition spec. Card IDs are deterministic
 * (rooted in ownerLabel) so tests can reference them.
 */
export function buildStarterDeck(
  composition: StarterDeckComposition,
  ownerLabel: string,
  expectedSize: number = DEFAULT_STARTER_SIZE,
): Card[] {
  const check = validateStarterComposition(composition, expectedSize);
  if (!check.legal) {
    throw new Error(`buildStarterDeck: ${check.reason}`);
  }
  const cards: Card[] = [];
  let idx = 0;
  for (const subtype of RESOURCE_ORDER) {
    const count = composition[subtype] ?? 0;
    for (let i = 0; i < count; i++) {
      cards.push(makeResourceCard(subtype, ownerLabel, idx++));
    }
  }
  for (let i = 0; i < (composition.capital ?? 0); i++) {
    cards.push(makeCapitalCard(ownerLabel, idx++));
  }
  return cards;
}

/** A reasonable balanced default: 3 cask + 4 corn + 4 grain (2 rye/1 barley/1 wheat) + 3 capital. */
export const DEFAULT_BALANCED_COMPOSITION: StarterDeckComposition = {
  cask: 3,
  corn: 4,
  rye: 2,
  barley: 1,
  wheat: 1,
  capital: 3,
};
