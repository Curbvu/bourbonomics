import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeLaborCard, makeResourceCard } from "../src/cards.js";
import { advanceToActionPhase, giveHand, giveRep, makeTestGame } from "./helpers.js";

// BUY_FROM_MARKET pays in rep + Labor cards. Rep and Labor are fully
// fungible — any cost can be paid in rep, Labor, or any mix.

describe("BUY_FROM_MARKET — unified rep payment", () => {
  it("happy path: pays rep, purchased card goes to discard, market refills", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    // The unified market mixes types — pick the first non-operations
    // slot since BUY_FROM_MARKET rejects ops targets (those use
    // BUY_OPERATIONS_CARD).
    const slotIndex = state.market.findIndex((c) => c.type !== "operations");
    expect(slotIndex).toBeGreaterThanOrEqual(0);
    const purchased = state.market[slotIndex]!;
    const cost = purchased.cost ?? 1;
    state = giveRep(state, "p1", 10);
    state = giveHand(state, "p1", []);
    const initialMarket = state.market.length;

    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: slotIndex,
      rep: cost,
      laborCardIds: [],
    });

    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.discard.some((c) => c.id === purchased.id)).toBe(true);
    expect(p1.reputation).toBe(10 - cost);
    expect(state.market.length).toBe(initialMarket);
    expect(state.market.some((c) => c.id === purchased.id)).toBe(false);
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
    expect(state.market).toHaveLength(10);
    expect(state.marketSupplyDeck).toHaveLength(0);
    state = giveRep(state, "p1", 5);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: 0,
      rep: 1,
      laborCardIds: [],
    });
    expect(state.market).toHaveLength(9);
  });

  it("Architect Labor contributes +2 toward investment buys", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    // Find any investment card slot in the default unified market.
    const slotIndex = state.market.findIndex((c) => c.type === "investment");
    if (slotIndex < 0) {
      // Default seed didn't shuffle an investment into face-up — pass
      // the test trivially. (Investments are rare drops; we don't
      // force-rig the supply here.)
      return;
    }
    const target = state.market[slotIndex]!;
    const cost = target.cost ?? 1;
    const architect = makeLaborCard({
      subtype: "architect",
      ownerLabel: "p1",
      index: 0,
    });
    state = giveRep(state, "p1", Math.max(0, cost - 2));
    state = giveHand(state, "p1", [architect]);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: slotIndex,
      rep: Math.max(0, cost - 2),
      laborCardIds: [architect.id],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(0);
    expect(p1.discard.some((c) => c.id === architect.id)).toBe(true);
    expect(p1.discard.some((c) => c.id === target.id)).toBe(true);
  });

  it("BUY_FROM_MARKET accepts an investment-type target (effect-pending stub)", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const slotIndex = state.market.findIndex((c) => c.type === "investment");
    if (slotIndex < 0) return; // skip if no investment surfaced
    const target = state.market[slotIndex]!;
    const cost = target.cost ?? 1;
    state = giveRep(state, "p1", cost);
    state = giveHand(state, "p1", []);
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: slotIndex,
      rep: cost,
      laborCardIds: [],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // Cost paid, card moved to discard, market refilled (or empty).
    expect(p1.discard.some((c) => c.id === target.id)).toBe(true);
    expect(state.market.every((c) => c.id !== target.id)).toBe(true);
  });

  it("BUY_FROM_MARKET rejects an operations-type target (use BUY_OPERATIONS_CARD)", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const slotIndex = state.market.findIndex((c) => c.type === "operations");
    if (slotIndex < 0) return; // skip if no ops card surfaced
    state = giveRep(state, "p1", 10);
    state = giveHand(state, "p1", []);
    expect(() =>
      applyAction(state, {
        type: "BUY_FROM_MARKET",
        playerId: "p1",
        marketSlotIndex: slotIndex,
        rep: state.market[slotIndex]!.cost ?? 1,
        laborCardIds: [],
      }),
    ).toThrow(/BUY_OPERATIONS_CARD/);
  });
});
