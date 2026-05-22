import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeLaborCard, makeResourceCard } from "../src/cards.js";
import { advanceToActionPhase, giveHand, giveRep, makeTestGame } from "./helpers.js";

// BUY_FROM_MARKET pays in rep + Labor cards. Rep and Labor are fully
// fungible — any cost can be paid in rep, Labor, or any mix.

describe("BUY_FROM_MARKET — unified rep payment", () => {
  it("happy path: pays rep, purchased card goes to discard, conveyor refills", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const purchased = state.marketConveyor[0]!;
    const cost = purchased.cost ?? 1;
    state = giveRep(state, "p1", 10);
    state = giveHand(state, "p1", []);
    const initialConveyor = state.marketConveyor.length;

    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      rep: cost,
      laborCardIds: [],
    });

    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.discard.some((c) => c.id === purchased.id)).toBe(true);
    expect(p1.reputation).toBe(10 - cost);
    expect(state.marketConveyor.length).toBe(initialConveyor);
    expect(state.marketConveyor.some((c) => c.id === purchased.id)).toBe(false);
  });

  it("rejects insufficient rep", () => {
    let state = makeTestGame({
      marketSupply: [
        makeResourceCard("rye", "supply", 100, true, 1), // cost 1 (premium)
        makeResourceCard("rye", "supply", 101, true, 1),
        makeResourceCard("rye", "supply", 102, true, 1),
        makeResourceCard("rye", "supply", 103, true, 1),
        makeResourceCard("rye", "supply", 104, true, 1),
        makeResourceCard("rye", "supply", 105, true, 1),
      ],
    });
    state = advanceToActionPhase(state);
    state = giveRep(state, "p1", 0);
    state = giveHand(state, "p1", []);
    expect(() =>
      applyAction(state, {
        type: "BUY_FROM_MARKET",
        playerId: "p1",
        marketSlotIndex: 0,
        rep: 1,
        laborCardIds: [],
      }),
    ).toThrow(/not enough reputation/);
  });

  it("Labor card alone pays for a $1 buy (Generic, no rep spent)", () => {
    let state = makeTestGame({
      marketSupply: [
        makeResourceCard("rye", "supply", 100, true, 1),
        makeResourceCard("rye", "supply", 101, true, 1),
        makeResourceCard("rye", "supply", 102, true, 1),
        makeResourceCard("rye", "supply", 103, true, 1),
        makeResourceCard("rye", "supply", 104, true, 1),
        makeResourceCard("rye", "supply", 105, true, 1),
      ],
    });
    state = advanceToActionPhase(state);
    const labor = makeLaborCard({ subtype: "generic", ownerLabel: "p1", index: 0 });
    state = giveRep(state, "p1", 0);
    state = giveHand(state, "p1", [labor]);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      rep: 0,
      laborCardIds: [labor.id],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(0);
    expect(p1.discard.some((c) => c.id === labor.id)).toBe(true);
  });

  it("accepts a Labor-only payment on a ≥$2 buy (rep and Labor are fungible)", () => {
    let state = makeTestGame({
      marketSupply: [
        makeResourceCard("rye", "supply", 100, true, 2),
        makeResourceCard("rye", "supply", 101, true, 2),
        makeResourceCard("rye", "supply", 102, true, 2),
        makeResourceCard("rye", "supply", 103, true, 2),
        makeResourceCard("rye", "supply", 104, true, 2),
        makeResourceCard("rye", "supply", 105, true, 2),
      ],
    });
    state = advanceToActionPhase(state);
    const a = makeLaborCard({ subtype: "generic", ownerLabel: "p1", index: 0 });
    const b = makeLaborCard({ subtype: "generic", ownerLabel: "p1", index: 1 });
    state = giveRep(state, "p1", 0);
    state = giveHand(state, "p1", [a, b]);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      rep: 0,
      laborCardIds: [a.id, b.id],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(0);
    expect(p1.discard.some((c) => c.id === a.id)).toBe(true);
    expect(p1.discard.some((c) => c.id === b.id)).toBe(true);
  });

  it("Cooper Labor contributes +2 toward market resource buys", () => {
    let state = makeTestGame({
      marketSupply: [
        makeResourceCard("rye", "supply", 100, true, 3),
        makeResourceCard("rye", "supply", 101, true, 3),
        makeResourceCard("rye", "supply", 102, true, 3),
        makeResourceCard("rye", "supply", 103, true, 3),
        makeResourceCard("rye", "supply", 104, true, 3),
        makeResourceCard("rye", "supply", 105, true, 3),
      ],
    });
    state = advanceToActionPhase(state);
    const cooper = makeLaborCard({ subtype: "cooper", ownerLabel: "p1", index: 0 });
    state = giveRep(state, "p1", 1);
    state = giveHand(state, "p1", [cooper]);
    // Cost 3 = 1 rep + 1 Cooper (+2).
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      rep: 1,
      laborCardIds: [cooper.id],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(0);
    expect(p1.discard.some((c) => c.id === cooper.id)).toBe(true);
  });

  it("rejects an out-of-range market slot", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = giveRep(state, "p1", 5);
    expect(() =>
      applyAction(state, {
        type: "BUY_FROM_MARKET",
        playerId: "p1",
        marketSlotIndex: 99,
        rep: 1,
        laborCardIds: [],
      }),
    ).toThrow(/market slot/);
  });

  it("conveyor shrinks when supply deck is empty after the buy", () => {
    const supply = Array.from({ length: 10 }, (_, i) =>
      makeResourceCard("corn", "supply", i, true, 1),
    );
    let state = makeTestGame({ marketSupply: supply });
    state = advanceToActionPhase(state);
    expect(state.marketConveyor).toHaveLength(10);
    expect(state.marketSupplyDeck).toHaveLength(0);
    state = giveRep(state, "p1", 5);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      rep: 1,
      laborCardIds: [],
    });
    expect(state.marketConveyor).toHaveLength(9);
  });
});
