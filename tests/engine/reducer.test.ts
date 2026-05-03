import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { reduce } from "@/lib/engine/reducer";
import { DEFAULT_STARTING_CASH } from "@/lib/engine/state";
import { pastDistilleryDraft } from "@/tests/helpers/state";

/** Fresh game advanced past the Distillery draft (most tests want round-1 action). */
function newGame() {
  return pastDistilleryDraft(
    createInitialState({
      id: "g1",
      seed: 1,
      seats: [
        { name: "Alice", kind: "human" },
        { name: "Bob", kind: "bot", botDifficulty: "easy" },
      ],
    }),
  );
}

/** Raw initial state — keeps `phase: "distillery_draft"` for tests that need to assert it. */
function rawNewGame() {
  return createInitialState({
    id: "g1",
    seed: 1,
    seats: [
      { name: "Alice", kind: "human" },
      { name: "Bob", kind: "bot", botDifficulty: "easy" },
    ],
  });
}

describe("reducer — initial state", () => {
  it("starts directly in Round 1 action phase (Phase 1 is skipped in Round 1)", () => {
    const s = newGame();
    expect(s.phase).toBe("action");
    expect(s.round).toBe(1);
    expect(s.players.p1.investments).toEqual([]);
    expect(s.players.p2.investments).toEqual([]);
  });

  it("each player gets the configured starting cash (post-distillery-bonus delta is checked elsewhere)", () => {
    const s = rawNewGame();
    expect(s.players.p1.cash).toBe(DEFAULT_STARTING_CASH);
    expect(s.players.p2.cash).toBe(DEFAULT_STARTING_CASH);
  });

  it("loan flags start unset", () => {
    const s = newGame();
    expect(s.players.p1.loanRemaining).toBe(0);
    expect(s.players.p1.loanSiphonActive).toBe(false);
    expect(s.players.p1.loanUsed).toBe(false);
  });

  it("game starts in the distillery_draft phase with 2 cards dealt to each baron", () => {
    const s = rawNewGame();
    expect(s.phase).toBe("distillery_draft");
    expect(s.players.p1.dealtDistilleryIds?.length).toBe(2);
    expect(s.players.p2.dealtDistilleryIds?.length).toBe(2);
    expect(s.players.p1.chosenDistilleryId).toBeUndefined();
  });

  it("DISTILLERY_CONFIRM locks the chosen card", () => {
    let s = rawNewGame();
    const dealt = s.players.p1.dealtDistilleryIds!;
    const chosen = dealt[0];
    s = reduce(s, { t: "DISTILLERY_CONFIRM", playerId: "p1", chosenId: chosen });
    expect(s.players.p1.chosenDistilleryId).toBe(chosen);
  });
});

describe("reducer — action phase paid-action ladder", () => {
  it("first pass records firstPasserId but free window stays open until end of lap", () => {
    let s = newGame();
    expect(s.actionPhase.freeWindowActive).toBe(true);
    expect(s.actionPhase.paidLapTier).toBe(0);

    const firstPlayer = s.currentPlayerId;
    s = reduce(s, { t: "PASS_ACTION", playerId: firstPlayer });
    expect(s.firstPasserId).toBe(firstPlayer);
    // Lap is not over yet — the other player can still act for free.
    expect(s.actionPhase.freeWindowActive).toBe(true);
    expect(s.actionPhase.paidLapTier).toBe(0);
  });

  it("free window closes at end of the first-pass lap; next-lap tier becomes $1", () => {
    let s = newGame();
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    // Both passed in a single lap → phase ends.
    expect(s.phase).toBe("market");
    expect(s.actionPhase.freeWindowActive).toBe(false);
    expect(s.actionPhase.paidLapTier).toBe(1);
  });
});

describe("reducer — market phase (draw 2, keep 1)", () => {
  it("each player draws 2 then keeps 1; demand resolves; advances to next round fees", () => {
    let s = newGame();
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    s = reduce(s, { t: "PASS_ACTION", playerId: s.currentPlayerId });
    expect(s.phase).toBe("market");

    // First player draws 2 then keeps the first.
    let cur = s.currentPlayerId;
    s = reduce(s, { t: "MARKET_DRAW", playerId: cur });
    expect(s.marketPhase[cur]?.drawnCardIds.length).toBe(2);
    let drawn = s.marketPhase[cur]!.drawnCardIds;
    s = reduce(s, { t: "MARKET_KEEP", playerId: cur, keptCardId: drawn[0] });
    expect(s.players[cur].marketResolved).toBe(true);

    // Second player draws + keeps.
    cur = s.currentPlayerId;
    s = reduce(s, { t: "MARKET_DRAW", playerId: cur });
    drawn = s.marketPhase[cur]!.drawnCardIds;
    s = reduce(s, { t: "MARKET_KEEP", playerId: cur, keptCardId: drawn[0] });

    // Both resolved → advance to round 2 fees.
    expect(s.round).toBe(2);
    expect(s.phase).toBe("fees");
    expect(s.demand).toBeGreaterThanOrEqual(0);
    expect(s.demand).toBeLessThanOrEqual(12);
  });
});
