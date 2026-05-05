import { describe, it, expect } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
import { makeCapitalCard, makeResourceCard } from "../src/cards.js";
import { advanceToActionPhase, giveHand, makeTestGame } from "./helpers.js";

describe("BUY_FROM_MARKET", () => {
  it("happy path: purchase a card, both go to discard, conveyor refills", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 100, 1), makeCapitalCard("p1", 101, 1)]);
    const initialConveyor = state.marketConveyor.length;
    const purchased = state.marketConveyor[0]!;
    const cost = purchased.cost ?? 1;

    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      spendCardIds: cost <= 1 ? ["card_p1_cap1_100"] : ["card_p1_cap1_100", "card_p1_cap1_101"],
    });

    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.discard.some((c) => c.id === purchased.id)).toBe(true);
    expect(p1.discard.some((c) => c.id === "card_p1_cap1_100")).toBe(true);
    expect(p1.hand.some((c) => c.id === purchased.id)).toBe(false);
    // Conveyor refilled (or stayed the same length if supply was full).
    expect(state.marketConveyor.length).toBe(initialConveyor);
    // The purchased card is no longer in the conveyor.
    expect(state.marketConveyor.some((c) => c.id === purchased.id)).toBe(false);
  });

  it("rejects insufficient capital", () => {
    let state = makeTestGame({
      marketSupply: [
        // craft a known supply: 6 conveyor + 1 extra; index 0 will be a 2-cost card
        ...Array.from({ length: 5 }, (_, i) => makeCapitalCard("supply", i, 1)),
        makeResourceCard("rye", "supply", 100, true, 2), // cost 2
        makeCapitalCard("supply", 200, 1),               // remains in supply
      ],
    });
    state = advanceToActionPhase(state);
    // Find the 2-cost rye in the conveyor
    const slotIdx = state.marketConveyor.findIndex((c) => c.cost === 2);
    expect(slotIdx).toBeGreaterThanOrEqual(0);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0, 1)]);
    expect(() =>
      applyAction(state, {
        type: "BUY_FROM_MARKET",
        playerId: "p1",
        marketSlotIndex: slotIdx,
        spendCardIds: ["card_p1_cap1_0"],
      }),
    ).toThrow(/spent capital is 1.*need 2/);
  });

  it("rejects spending non-capital cards", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    expect(() =>
      applyAction(state, {
        type: "BUY_FROM_MARKET",
        playerId: "p1",
        marketSlotIndex: 0,
        spendCardIds: ["card_p1_corn_0"],
      }),
    ).toThrow(/capital/);
  });

  it("rejects an out-of-range or empty market slot", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    expect(() =>
      applyAction(state, {
        type: "BUY_FROM_MARKET",
        playerId: "p1",
        marketSlotIndex: 99,
        spendCardIds: ["card_p1_cap1_0"],
      }),
    ).toThrow(/market slot/);
  });

  it("conveyor shrinks when supply deck is empty", () => {
    // Custom supply: exactly 10 cards (fills conveyor; supply empty).
    let state = makeTestGame({
      marketSupply: Array.from({ length: 10 }, (_, i) => makeCapitalCard("supply", i, 1)),
    });
    state = advanceToActionPhase(state);
    expect(state.marketConveyor).toHaveLength(10);
    expect(state.marketSupplyDeck).toHaveLength(0);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      spendCardIds: ["card_p1_cap1_0"],
    });
    expect(state.marketConveyor).toHaveLength(9);
  });

  it("draws from supply to refill the freed slot", () => {
    // Custom supply: 11 cards. 10 to conveyor, 1 in supply for the refill.
    const supply = Array.from({ length: 11 }, (_, i) => makeCapitalCard("supply", i, 1));
    let state = makeTestGame({ marketSupply: supply });
    state = advanceToActionPhase(state);
    expect(state.marketSupplyDeck).toHaveLength(1);
    state = giveHand(state, "p1", [makeCapitalCard("p1", 0)]);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      spendCardIds: ["card_p1_cap1_0"],
    });
    expect(state.marketConveyor).toHaveLength(10);
    expect(state.marketSupplyDeck).toHaveLength(0);
  });
});
