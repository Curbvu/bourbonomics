import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import {
  makeCapitalCard,
  makeMashBill,
  makePremiumCapital,
  makePremiumResource,
  makeResourceCard,
} from "../src/cards.js";
import type { Card } from "../src/types.js";
import {
  advanceToActionPhase,
  giveHand,
  makeTestGame,
  placeBarrel,
  slotForBill,
  spendCardId,
} from "./helpers.js";

// ============================================================
// Themed-card effect tests
//
// One test per effect kind, hitting the resolver via the canonical
// MAKE / AGE / SELL / BUY actions (no direct calls into card-effects.ts).
// ============================================================

const standardBill = () =>
  makeMashBill(
    {
      defId: "card_effect_test_bill",
      name: "Effect Test Bill",
      ageBands: [2, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [1, 2, 3],
        [2, 4, 5],
        [3, 5, 6],
      ],
    },
    100,
  );

/** Seed both hand AND deck (giveHand clears the deck — draw tests need it). */
function giveHandAndDeck(
  state: ReturnType<typeof makeTestGame>,
  playerId: string,
  hand: Card[],
  deck: Card[],
): ReturnType<typeof makeTestGame> {
  return {
    ...state,
    players: state.players.map((p) =>
      p.id === playerId
        ? { ...p, hand: hand.slice(), deck: deck.slice(), discard: [] }
        : p,
    ),
  };
}

// ─────────────────────────────────────────────────────────────────
// on_commit_production
// ─────────────────────────────────────────────────────────────────

describe("Card effect — draw_cards on_commit_production", () => {
  it("draws cards into hand when used as production fuel", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const cask = makeResourceCard("cask", "p1", 0);
    // Two-Row Barley: 1 barley, draw 1 on production commit.
    const barley = makePremiumResource({
      defId: "two_row_barley",
      displayName: "Two-Row Barley",
      subtype: "barley",
      resourceCount: 1,
      cost: 3,
      effect: { kind: "draw_cards", when: "on_commit_production", n: 1 },
      ownerLabel: "p1",
      index: 0,
    });
    const corn = makeResourceCard("corn", "p1", 1);
    // Seed a single card in the deck so the draw effect has fuel.
    const filler = makeResourceCard("corn", "p1", 99);
    state = giveHandAndDeck(state, "p1", [cask, barley, corn], [filler]);

    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: [cask.id, barley.id, corn.id],      slotId: slotForBill(state, "p1", mbId),
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // Spent 3 cards into barrel; drew 1 from deck → hand has the drawn filler.
    expect(p1.hand.length).toBe(1);
    expect(p1.hand[0]?.id).toBe(filler.id);
  });
});

describe("Card effect — bump_demand on_commit_production", () => {
  it("raises demand by delta when committed", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    const cask = makeResourceCard("cask", "p1", 0);
    const corn = makeResourceCard("corn", "p1", 1);
    // Distiller's Reserve Rye: 3 rye + composite [bump_demand +1, +2 rep on sale].
    const rye = makePremiumResource({
      defId: "distillers_reserve_rye",
      displayName: "Distiller's Reserve Rye",
      subtype: "rye",
      resourceCount: 3,
      cost: 8,
      effect: {
        kind: "composite",
        effects: [
          { kind: "bump_demand", when: "on_commit_production", delta: 1 },
          { kind: "rep_on_sale_flat", when: "on_sale", rep: 2 },
        ],
      },
      ownerLabel: "p1",
      index: 0,
    });
    state = giveHand(state, "p1", [cask, corn, rye]);

    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: [cask.id, corn.id, rye.id],      slotId: slotForBill(state, "p1", mbId),
    });
    expect(state.demand).toBe(6);
  });
});

describe("Card effect — barrel_starts_aged on_commit_production", () => {
  it("seeds the barrel's age at commit time", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    const cask = makeResourceCard("cask", "p1", 0);
    const corn = makeResourceCard("corn", "p1", 1);
    // Soft Red Wheat: 1 wheat, barrel starts at age 1.
    const wheat = makePremiumResource({
      defId: "soft_red_wheat",
      displayName: "Soft Red Wheat",
      subtype: "wheat",
      resourceCount: 1,
      cost: 4,
      effect: { kind: "barrel_starts_aged", when: "on_commit_production", age: 1 },
      ownerLabel: "p1",
      index: 0,
    });
    state = giveHand(state, "p1", [cask, corn, wheat]);

    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: [cask.id, corn.id, wheat.id],      slotId: slotForBill(state, "p1", mbId),
    });
    const barrel = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!;
    expect(barrel.age).toBe(1);
  });
});

describe("Card effect — grid_rep_offset on_commit_production", () => {
  it("attaches a persistent +N rep adder to the barrel grid", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    // Single Barrel Cask: +1 rep at every grid band.
    const cask = makePremiumResource({
      defId: "single_barrel_cask",
      displayName: "Single Barrel Cask",
      subtype: "cask",
      resourceCount: 1,
      cost: 7,
      effect: { kind: "grid_rep_offset", when: "on_commit_production", offset: 1 },
      ownerLabel: "p1",
      index: 0,
    });
    const corn = makeResourceCard("corn", "p1", 1);
    const rye = makeResourceCard("rye", "p1", 2);
    state = giveHand(state, "p1", [cask, corn, rye]);

    const mbId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "ready")!.attachedMashBill.id;
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      cardIds: [cask.id, corn.id, rye.id],      slotId: slotForBill(state, "p1", mbId),
    });
    const barrel = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!;
    expect(barrel.gridRepOffset).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// on_commit_aging
// ─────────────────────────────────────────────────────────────────

describe("Card effect — draw_cards on_commit_aging", () => {
  it("draws when used as an aging card", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state);
    state = placeBarrel(state, "p1", standardBill(), 0);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    // Malted Barley: aging-commit draw 1.
    const aging = makePremiumResource({
      defId: "malted_barley",
      displayName: "Malted Barley",
      subtype: "barley",
      resourceCount: 1,
      cost: 3,
      effect: { kind: "draw_cards", when: "on_commit_aging", n: 1 },
      ownerLabel: "p1",
      index: 0,
    });
    const filler = makeResourceCard("corn", "p1", 99);
    state = giveHandAndDeck(state, "p1", [aging], [filler]);
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: aging.id,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // Spent the 1 aging card and drew 1 from deck → hand has the filler.
    expect(p1.hand.length).toBe(1);
    expect(p1.hand[0]?.id).toBe(filler.id);
  });
});

describe("Card effect — aging_card_doubled on_commit_aging", () => {
  it("adds 2 years instead of 1", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = placeBarrel(state, "p1", standardBill(), 0);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    const winter = makePremiumResource({
      defId: "winter_wheat",
      displayName: "Winter Wheat",
      subtype: "wheat",
      resourceCount: 1,
      cost: 4,
      effect: { kind: "aging_card_doubled", when: "on_commit_aging", years: 2 },
      ownerLabel: "p1",
      index: 0,
    });
    state = giveHand(state, "p1", [winter]);
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: winter.id,
    });
    const barrel = state.allBarrels.find((b) => b.id === barrelId)!;
    expect(barrel.age).toBe(2);
  });
});

describe("Card effect — rep_on_commit_aging", () => {
  it("grants reputation immediately on aging", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = placeBarrel(state, "p1", standardBill(), 0);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    const bond = makePremiumCapital({
      defId: "bourbon_bond",
      displayName: "Bourbon Bond",
      capitalValue: 2,
      cost: 5,
      effect: { kind: "rep_on_commit_aging", when: "on_commit_aging", rep: 1 },
      ownerLabel: "p1",
      index: 0,
    });
    state = giveHand(state, "p1", [bond]);
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "AGE_BOURBON",
      playerId: "p1",
      barrelId,
      cardId: bond.id,
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(beforeRep + 1);
  });
});

// ─────────────────────────────────────────────────────────────────
// on_sale
// ─────────────────────────────────────────────────────────────────

function placeBarrelWithProductionCard(
  state: ReturnType<typeof makeTestGame>,
  ownerId: string,
  age: number,
  productionCard: Card,
): ReturnType<typeof makeTestGame> {
  // placeBarrel doesn't accept productionCards; mutate the result.
  const next = placeBarrel(state, ownerId, standardBill(), age);
  const barrel = next.allBarrels[next.allBarrels.length - 1]!;
  return {
    ...next,
    allBarrels: next.allBarrels.map((b) =>
      b.id === barrel.id
        ? { ...b, productionCards: [...b.productionCards, productionCard] }
        : b,
    ),
  };
}

describe("Card effect — rep_on_sale_flat", () => {
  it("adds flat reputation on sale", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    const spicy: Card = {
      id: "card_p1_spicy_rye_t",
      cardDefId: "spicy_rye",
      type: "resource",
      subtype: "rye",
      resourceCount: 1,
      cost: 4,
      effect: { kind: "rep_on_sale_flat", when: "on_sale", rep: 1 },
    };
    state = placeBarrelWithProductionCard(state, "p1", 4, spicy);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    // Standard bill at age 4, demand 5: row 1, col 1 → reward 4.
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 4,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    // 4 from the grid + 1 bonus from spicy_rye = 5.
    expect(p1.reputation).toBe(beforeRep + 5);
  });
});

describe("Card effect — rep_on_sale_if_age_gte", () => {
  it("triggers when the barrel's age meets the threshold", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    const heavyChar: Card = {
      id: "card_p1_heavy_char_t",
      cardDefId: "heavy_char",
      type: "resource",
      subtype: "cask",
      resourceCount: 1,
      cost: 4,
      effect: { kind: "rep_on_sale_if_age_gte", when: "on_sale", age: 4, rep: 2 },
    };
    state = placeBarrelWithProductionCard(state, "p1", 5, heavyChar);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    // age 5 → row 1 (band 4-5), demand 5 → col 1, reward 4. +2 from heavy_char.
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 4,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(beforeRep + 4 + 2);
  });

  it("does not trigger below the age threshold", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    const heavyChar: Card = {
      id: "card_p1_heavy_char_under_t",
      cardDefId: "heavy_char",
      type: "resource",
      subtype: "cask",
      resourceCount: 1,
      cost: 4,
      effect: { kind: "rep_on_sale_if_age_gte", when: "on_sale", age: 4, rep: 2 },
    };
    state = placeBarrelWithProductionCard(state, "p1", 3, heavyChar);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    // age 3 → row 0, demand 5 → col 1 (band 4-5), reward = 2. No bonus.
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 2,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(beforeRep + 2);
  });
});

describe("Card effect — rep_on_sale_if_demand_gte", () => {
  it("triggers when demand meets the threshold", () => {
    let state = makeTestGame({ startingDemand: 7 });
    state = advanceToActionPhase(state, [1, 1]);
    const highProof: Card = {
      id: "card_p1_high_proof_t",
      cardDefId: "high_proof_rye",
      type: "resource",
      subtype: "rye",
      resourceCount: 2,
      cost: 5,
      effect: { kind: "rep_on_sale_if_demand_gte", when: "on_sale", demand: 7, rep: 2 },
    };
    state = placeBarrelWithProductionCard(state, "p1", 5, highProof);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    // age 5 → row 1 (band 4-5), demand 7 → col 2 (band 6+), reward = 5. +2 from high_proof.
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(beforeRep + 5 + 2);
  });
});

describe("Card effect — grid_demand_band_offset on_sale", () => {
  it("Toasted Oak reads the grid one demand band higher", () => {
    let state = makeTestGame({ startingDemand: 4 });
    state = advanceToActionPhase(state, [1, 1]);
    const toastedOak: Card = {
      id: "card_p1_toasted_oak_t",
      cardDefId: "toasted_oak",
      type: "resource",
      subtype: "cask",
      resourceCount: 1,
      cost: 5,
      effect: { kind: "grid_demand_band_offset", when: "on_sale", offset: 1 },
    };
    state = placeBarrelWithProductionCard(state, "p1", 4, toastedOak);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    // age 4 → row 1; demand 4 → col 1 (reward 4). With offset, col 2 (reward 5).
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 5,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    expect(state.players.find((p) => p.id === "p1")!.reputation).toBeGreaterThanOrEqual(5);
  });
});

describe("Card effect — skip_demand_drop on_sale", () => {
  it("cancels the post-sale demand drop", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    const heirloom: Card = {
      id: "card_p1_heirloom_wheat_t",
      cardDefId: "heirloom_wheat",
      type: "resource",
      subtype: "wheat",
      resourceCount: 2,
      cost: 7,
      effect: {
        kind: "composite",
        effects: [
          { kind: "barrel_starts_aged", when: "on_commit_production", age: 2 },
          { kind: "skip_demand_drop", when: "on_sale" },
        ],
      },
    };
    state = placeBarrelWithProductionCard(state, "p1", 4, heirloom);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 4,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    expect(state.demand).toBe(5);
  });
});

describe("Card effect — returns_to_hand_on_sale", () => {
  it("Used Bourbon Cask comes back to hand on sale", () => {
    let state = makeTestGame({ startingDemand: 5 });
    state = advanceToActionPhase(state, [1, 1]);
    const usedCask: Card = {
      id: "card_p1_used_cask_t",
      cardDefId: "used_bourbon_cask",
      type: "resource",
      subtype: "cask",
      resourceCount: 1,
      cost: 4,
      effect: { kind: "returns_to_hand_on_sale", when: "on_sale" },
    };
    state = placeBarrelWithProductionCard(state, "p1", 4, usedCask);
    const barrelId = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
      reputationSplit: 4,
      cardDrawSplit: 0,
      spendCardId: spendCardId(state, "p1"),
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.hand.some((c) => c.id === usedCask.id)).toBe(true);
    expect(p1.discard.some((c) => c.id === usedCask.id)).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────
// on_spend (capital)
// ─────────────────────────────────────────────────────────────────

describe("Card effect — rep_on_market_spend", () => {
  it("Lender's Note grants +1 rep when spent on a market purchase", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    // Pick a 1¢-cost card from the conveyor for a clean test.
    const target = state.marketConveyor.find((c) => (c.cost ?? 1) === 1);
    if (!target) return; // skip if mix didn't surface a 1¢ card
    const slotIdx = state.marketConveyor.findIndex((c) => c.id === target.id);

    const lender = makePremiumCapital({
      defId: "lenders_note",
      displayName: "Lender's Note",
      capitalValue: 4,
      cost: 8,
      effect: { kind: "rep_on_market_spend", when: "on_spend", rep: 1 },
      ownerLabel: "p1",
      index: 0,
    });
    state = giveHand(state, "p1", [lender]);
    const beforeRep = state.players.find((p) => p.id === "p1")!.reputation;
    state = applyAction(state, {
      type: "BUY_FROM_MARKET",
      playerId: "p1",
      marketSlotIndex: slotIdx,
      spendCardIds: [lender.id],
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    expect(p1.reputation).toBe(beforeRep + 1);
  });
});

// Suppress unused-warning when bundling.
void makeCapitalCard;
