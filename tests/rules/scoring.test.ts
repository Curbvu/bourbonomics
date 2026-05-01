/**
 * Final-round scoring: cash + active investments install cost + Gold trophy
 * brand value. Cards in hand and unsold barrels score 0.
 */

import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import {
  brandValueFor,
  computeFinalScores,
  pickWinners,
  scorePlayer,
} from "@/lib/rules/scoring";
import { DEFAULT_GOLD_BRAND_VALUE } from "@/lib/engine/state";
import {
  BOURBON_CARDS_BY_ID,
  INVESTMENT_CARDS_BY_ID,
} from "@/lib/engine/decks";

const REAL_BOURBON_IDS = Object.keys(BOURBON_CARDS_BY_ID);
// Pick two Gold-capable cards so the test exercises real brandValue values.
const GOLD_CAPABLE_IDS = REAL_BOURBON_IDS.filter(
  (id) => BOURBON_CARDS_BY_ID[id].awards?.gold,
);

function gs() {
  return createInitialState({
    id: "g1",
    seed: 1,
    seats: [
      { name: "Alice", kind: "human" },
      { name: "Bob", kind: "bot", botDifficulty: "easy" },
    ],
  });
}

describe("scoring — scorePlayer", () => {
  it("baseline: only cash counts", () => {
    const s = gs();
    const score = scorePlayer(s.players.p1);
    expect(score.cash).toBe(40);
    expect(score.investments).toBe(0);
    expect(score.goldBourbons).toBe(0);
    expect(score.goldCount).toBe(0);
    expect(score.total).toBe(40);
  });

  it("active investments score their installation cost", () => {
    const s = gs();
    // Pick an arbitrary investment from the catalog.
    const sampleId = Object.keys(INVESTMENT_CARDS_BY_ID)[0];
    const sample = INVESTMENT_CARDS_BY_ID[sampleId];
    s.players.p1.investments.push({
      instanceId: "inv-1",
      cardId: sampleId,
      status: "active",
      usedThisRound: false,
    });
    s.players.p1.investments.push({
      instanceId: "inv-2",
      cardId: sampleId,
      status: "unbuilt",
      usedThisRound: false,
    });
    const score = scorePlayer(s.players.p1);
    // Only the active one counts.
    expect(score.investments).toBe(sample.capital);
    expect(score.total).toBe(40 + sample.capital);
  });

  it("Gold Bourbons score per-card brand value (catalog-derived)", () => {
    const s = gs();
    expect(GOLD_CAPABLE_IDS.length).toBeGreaterThanOrEqual(2);
    const [a, b] = GOLD_CAPABLE_IDS;
    s.players.p1.goldBourbons.push(a, b);
    const expected = brandValueFor(a) + brandValueFor(b);
    const score = scorePlayer(s.players.p1);
    expect(score.goldCount).toBe(2);
    expect(score.goldBourbons).toBe(expected);
    expect(score.total).toBe(40 + expected);
    // Plumbed brandValue must be at LEAST the default fallback for any
    // Gold-capable card (the generator only ever assigns values >= 25).
    expect(brandValueFor(a)).toBeGreaterThanOrEqual(DEFAULT_GOLD_BRAND_VALUE);
  });

  it("cards in hand and unsold barrels score $0", () => {
    const s = gs();
    // bourbonHand started with 4 cards; verify it adds $0 to score.
    expect(s.players.p1.bourbonHand.length).toBeGreaterThan(0);
    const score = scorePlayer(s.players.p1);
    expect(score.total).toBe(40);
  });
});

describe("scoring — pickWinners tie-breaks", () => {
  it("highest total wins", () => {
    const s = gs();
    s.players.p2.cash = 100; // p2 has more.
    const scores = computeFinalScores(s);
    expect(pickWinners(s, scores)).toEqual(["p2"]);
  });

  it("on a total tie, more Gold Bourbons wins", () => {
    const s = gs();
    const goldId = GOLD_CAPABLE_IDS[0];
    const goldValue = brandValueFor(goldId);
    s.players.p1.cash = 50;
    s.players.p1.goldBourbons.push(goldId);
    s.players.p2.cash = 50 + goldValue;
    // p1 has $50 + brand, p2 has $50 + brand — same total.
    const scores = computeFinalScores(s);
    expect(scores.p1.total).toBe(scores.p2.total);
    expect(pickWinners(s, scores)).toEqual(["p1"]);
  });

  it("complete tie produces a shared win", () => {
    const s = gs();
    // both players default to $40 cash and 0 golds.
    const scores = computeFinalScores(s);
    const winners = pickWinners(s, scores);
    expect(winners.sort()).toEqual(["p1", "p2"]);
  });
});
