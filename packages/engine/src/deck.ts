import { nextRng } from "./rng.js";

/**
 * Convention: the "top" of a deck is the END of the array (index length-1).
 * Drawing pops from the end. Reshuffling pushes the shuffled discard onto
 * the BOTTOM of the deck (front of the array) so any pre-existing top cards
 * are drawn first.
 */

/** Fisher-Yates shuffle. Returns a new array; original is untouched. */
export function shuffleCards<T>(
  cards: readonly T[],
  rngState: number,
): { shuffled: T[]; rngState: number } {
  const result = cards.slice();
  let state = rngState;
  for (let i = result.length - 1; i > 0; i--) {
    const [v, next] = nextRng(state);
    const j = Math.floor(v * (i + 1));
    const tmp = result[i]!;
    result[i] = result[j]!;
    result[j] = tmp;
    state = next;
  }
  return { shuffled: result, rngState: state };
}

/** Draw up to `n` cards from the top of `deck`. Top-of-deck card is first in `drawn`. */
export function drawCards<T>(
  deck: readonly T[],
  n: number,
): { drawn: T[]; remaining: T[] } {
  const drawCount = Math.min(Math.max(0, n), deck.length);
  if (drawCount === 0) return { drawn: [], remaining: deck.slice() };
  const start = deck.length - drawCount;
  const drawn = deck.slice(start).reverse();
  const remaining = deck.slice(0, start);
  return { drawn, remaining };
}

/** Reshuffle discard pile under the existing deck. No-op if discard is empty. */
export function reshuffleDiscard<T>(
  deck: readonly T[],
  discard: readonly T[],
  rngState: number,
): { deck: T[]; discard: T[]; rngState: number } {
  if (discard.length === 0) {
    return { deck: deck.slice(), discard: [], rngState };
  }
  const { shuffled, rngState: nextState } = shuffleCards(discard, rngState);
  return { deck: [...shuffled, ...deck], discard: [], rngState: nextState };
}

/**
 * Draw `n` cards, reshuffling the discard pile if the deck is exhausted.
 * If both deck and discard run out, returns fewer than `n`.
 */
export function drawWithReshuffle<T>(
  deck: readonly T[],
  discard: readonly T[],
  n: number,
  rngState: number,
): { drawn: T[]; deck: T[]; discard: T[]; rngState: number } {
  let currentDeck = deck.slice();
  let currentDiscard = discard.slice();
  let currentRng = rngState;
  const drawn: T[] = [];

  while (drawn.length < n) {
    if (currentDeck.length === 0) {
      if (currentDiscard.length === 0) break;
      const reshuffled = reshuffleDiscard(currentDeck, currentDiscard, currentRng);
      currentDeck = reshuffled.deck;
      currentDiscard = reshuffled.discard;
      currentRng = reshuffled.rngState;
    }
    const need = n - drawn.length;
    const result = drawCards(currentDeck, need);
    drawn.push(...result.drawn);
    currentDeck = result.remaining;
  }

  return { drawn, deck: currentDeck, discard: currentDiscard, rngState: currentRng };
}
