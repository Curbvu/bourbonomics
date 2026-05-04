import { describe, it, expect } from "vitest";
import {
  shuffleCards,
  drawCards,
  reshuffleDiscard,
  drawWithReshuffle,
} from "../src/deck.js";

const make = (n: number): string[] => Array.from({ length: n }, (_, i) => `c${i}`);

describe("shuffleCards", () => {
  it("preserves all cards (no loss or duplication)", () => {
    const input = make(50);
    const { shuffled } = shuffleCards(input, 42);
    expect(shuffled).toHaveLength(input.length);
    expect([...shuffled].sort()).toEqual([...input].sort());
  });

  it("does not mutate the input array", () => {
    const input = make(20);
    const snapshot = [...input];
    shuffleCards(input, 42);
    expect(input).toEqual(snapshot);
  });

  it("is deterministic for the same seed", () => {
    const a = shuffleCards(make(20), 42);
    const b = shuffleCards(make(20), 42);
    expect(a.shuffled).toEqual(b.shuffled);
    expect(a.rngState).toEqual(b.rngState);
  });

  it("produces different orders for different seeds", () => {
    const a = shuffleCards(make(20), 42);
    const b = shuffleCards(make(20), 43);
    expect(a.shuffled).not.toEqual(b.shuffled);
  });

  it("handles empty and single-element decks", () => {
    expect(shuffleCards([], 1).shuffled).toEqual([]);
    expect(shuffleCards(["only"], 1).shuffled).toEqual(["only"]);
  });
});

describe("drawCards", () => {
  it("draws from the top (end) of the deck", () => {
    const deck = ["bottom", "middle", "top"];
    const { drawn, remaining } = drawCards(deck, 1);
    expect(drawn).toEqual(["top"]);
    expect(remaining).toEqual(["bottom", "middle"]);
  });

  it("draws multiple cards top-first", () => {
    const deck = ["a", "b", "c", "d", "e"];
    const { drawn, remaining } = drawCards(deck, 3);
    expect(drawn).toEqual(["e", "d", "c"]);
    expect(remaining).toEqual(["a", "b"]);
  });

  it("returns all cards when n exceeds deck size", () => {
    const deck = ["a", "b"];
    const { drawn, remaining } = drawCards(deck, 5);
    expect(drawn).toHaveLength(2);
    expect(remaining).toEqual([]);
  });

  it("returns nothing for n <= 0", () => {
    const deck = ["a", "b"];
    expect(drawCards(deck, 0).drawn).toEqual([]);
    expect(drawCards(deck, -3).drawn).toEqual([]);
  });

  it("preserves cards (drawn + remaining = input)", () => {
    const deck = make(10);
    const { drawn, remaining } = drawCards(deck, 4);
    expect([...drawn, ...remaining].sort()).toEqual([...deck].sort());
  });
});

describe("reshuffleDiscard", () => {
  it("moves all discard cards into the deck", () => {
    const result = reshuffleDiscard([], make(5), 42);
    expect(result.deck).toHaveLength(5);
    expect(result.discard).toHaveLength(0);
  });

  it("preserves existing top-of-deck cards on top after reshuffle", () => {
    const result = reshuffleDiscard(["topA", "topB"], ["d1", "d2", "d3"], 42);
    expect(result.deck).toHaveLength(5);
    expect(result.deck.slice(-2)).toEqual(["topA", "topB"]);
  });

  it("is a no-op when discard is empty", () => {
    const result = reshuffleDiscard(["a", "b"], [], 42);
    expect(result.deck).toEqual(["a", "b"]);
    expect(result.discard).toEqual([]);
    expect(result.rngState).toBe(42);
  });

  it("is deterministic", () => {
    const a = reshuffleDiscard(["x"], make(8), 99);
    const b = reshuffleDiscard(["x"], make(8), 99);
    expect(a).toEqual(b);
  });
});

describe("drawWithReshuffle", () => {
  it("draws from the deck without reshuffling when sufficient", () => {
    const result = drawWithReshuffle(make(10), make(5), 3, 42);
    expect(result.drawn).toHaveLength(3);
    expect(result.deck).toHaveLength(7);
    expect(result.discard).toHaveLength(5);
  });

  it("reshuffles the discard mid-draw when the deck runs out", () => {
    const deck = ["a", "b"];
    const discard = ["c", "d", "e"];
    const result = drawWithReshuffle(deck, discard, 4, 42);
    expect(result.drawn).toHaveLength(4);
    expect(result.discard).toHaveLength(0);
    expect(result.deck.length + result.drawn.length).toBe(5);
  });

  it("returns fewer cards when both deck and discard exhaust", () => {
    const result = drawWithReshuffle(["a"], [], 5, 42);
    expect(result.drawn).toHaveLength(1);
    expect(result.deck).toHaveLength(0);
    expect(result.discard).toHaveLength(0);
  });

  it("conserves total card count", () => {
    const deck = make(7);
    const discard = make(8).map((c) => c + "_d");
    const total = deck.length + discard.length;
    const result = drawWithReshuffle(deck, discard, 10, 99);
    const after = result.drawn.length + result.deck.length + result.discard.length;
    expect(after).toBe(total);
  });

  it("is deterministic given a seed", () => {
    const deck = make(3);
    const discard = make(7).map((c) => c + "_d");
    const a = drawWithReshuffle(deck, discard, 6, 99);
    const b = drawWithReshuffle(deck, discard, 6, 99);
    expect(a).toEqual(b);
  });
});
