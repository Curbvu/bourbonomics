import { describe, expect, it } from "vitest";
import { initializeGame } from "../src/initialize.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { defaultMashBillCatalog, defaultStarterCards } from "../src/defaults.js";
import { applyAction } from "../src/engine.js";
import { makeMashBill, makeResourceCard } from "../src/cards.js";
import type { Distillery, GameState } from "../src/types.js";
import {
  advanceToActionPhase,
  giveHand,
  placeBarrel,
} from "./helpers.js";

function pickDistillery(bonus: Distillery["bonus"]): Distillery {
  const pool = defaultDistilleryPool();
  const dist = pool.find((d) => d.bonus === bonus);
  if (!dist) throw new Error(`distillery bonus ${bonus} not in pool`);
  return { ...dist, id: `dist_test_${bonus}` };
}

function gameWithDistilleries(bonuses: Distillery["bonus"][]): GameState {
  const catalog = defaultMashBillCatalog();
  return initializeGame({
    seed: 1,
    players: bonuses.map((_, i) => ({ id: `p${i + 1}`, name: `P${i + 1}` })),
    startingDistilleries: bonuses.map(pickDistillery),
    bourbonDeck: catalog,
    starterDecks: bonuses.map((_, i) => defaultStarterCards(`p${i + 1}`)),
  });
}

describe("v2.10 â€” Distillery roster", () => {
  it("ships four distilleries: vanilla, high_rye_house, wheated_baron, connoisseur_estate", () => {
    const pool = defaultDistilleryPool();
    const bonuses = pool.map((d) => d.bonus).sort();
    expect(bonuses).toEqual(
      ["connoisseur_estate", "high_rye_house", "vanilla", "wheated_baron"].sort(),
    );
  });

  it("Vanilla starts with 4 open slots, no slotted bills", () => {
    const state = gameWithDistilleries(["vanilla", "vanilla"]);
    expect(state.players[0]!.rickhouseSlots).toHaveLength(4);
    const myBarrels = state.allBarrels.filter((b) => b.ownerId === "p1");
    expect(myBarrels).toHaveLength(0);
  });

  it("High-Rye House starts with one pre-aged rye barrel + 2 Specialty Rye in deck", () => {
    const state = gameWithDistilleries(["high_rye_house", "vanilla"]);
    const p1 = state.players[0]!;
    const myBarrels = state.allBarrels.filter((b) => b.ownerId === "p1");
    expect(myBarrels).toHaveLength(1);
    expect(myBarrels[0]!.phase).toBe("aging");
    expect(myBarrels[0]!.age).toBe(1);
    expect(myBarrels[0]!.completedInRound).toBe(0);
    expect(myBarrels[0]!.attachedMashBill.defId).toBe("starter_high_rye");
    // The deck shuffles in the bonus Specialty Ryes â€” check across
    // hand + deck (initialize seeds the deck, then runs the trade
    // window for human-driven games; here we used `starterDecks` so
    // bonuses are applied to the deck before shuffle).
    const allCards = [...p1.hand, ...p1.deck, ...p1.discard];
    const specialtyRyes = allCards.filter(
      (c) => c.specialty && c.subtype === "rye",
    );
    expect(specialtyRyes.length).toBeGreaterThanOrEqual(2);
  });

  it("Wheated Baron starts with one pre-aged wheated barrel", () => {
    const state = gameWithDistilleries(["wheated_baron", "vanilla"]);
    const myBarrels = state.allBarrels.filter((b) => b.ownerId === "p1");
    expect(myBarrels).toHaveLength(1);
    expect(myBarrels[0]!.attachedMashBill.defId).toBe("starter_wheated");
    expect(myBarrels[0]!.age).toBe(1);
  });

  it("Connoisseur Estate drafts 4 bills, capped at 4 slotted bills", () => {
    const state = gameWithDistilleries(["connoisseur_estate", "vanilla"]);
    const myBarrels = state.allBarrels.filter((b) => b.ownerId === "p1");
    expect(myBarrels).toHaveLength(4);
    expect(myBarrels.every((b) => b.phase === "ready")).toBe(true);
    expect(state.players[0]!.distillery?.maxSlottedBills).toBe(4);
  });
});

describe("v2.10 â€” Distillery ability hooks", () => {
  it("Wheated Baron: -1 wheat floor on wheated bills (minWheat 2 â†’ 1)", () => {
    // Wheated bill needing 2 wheat. Vanilla would need 2 wheat
    // committed; Baron satisfies with cask + corn + 1 wheat.
    const wheatedBill = makeMashBill(
      {
        defId: "test_wheated",
        name: "Test Wheated",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [[1, 1, 1], [2, 2, 2], [3, 3, 3]],
        recipe: { minWheat: 2, maxRye: 0 },
      },
      300,
    );
    let state = initializeGame({
      seed: 1,
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      startingDistilleries: [pickDistillery("wheated_baron"), pickDistillery("vanilla")],
      startingMashBills: [[wheatedBill], []],
      bourbonDeck: defaultMashBillCatalog(),
      starterDecks: [defaultStarterCards("p1"), defaultStarterCards("p2")],
    });
    state = advanceToActionPhase(state, [1, 1]);
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, needsAgeBarrels: false })),
    };
    const slot = state.allBarrels.find(
      (b) => b.ownerId === "p1" && b.attachedMashBill.id === wheatedBill.id,
    )!;
    // Commit cask + corn + 1 wheat. Without the discount this would
    // fail recipe (needs 2 wheat).
    const cask = makeResourceCard("cask", "p1", 800);
    const corn = makeResourceCard("corn", "p1", 801);
    const wheat = makeResourceCard("wheat", "p1", 802);
    state = giveHand(state, "p1", [cask, corn, wheat]);
    state = applyAction(state, {
      type: "MAKE_BOURBON",
      playerId: "p1",
      slotId: slot.slotId,
      cardIds: [cask.id, corn.id, wheat.id],
    });
    const after = state.allBarrels.find((b) => b.id === slot.id)!;
    expect(after.phase).toBe("aging");
  });

  it("Wheated Baron: rejects rye commits", () => {
    let state = gameWithDistilleries(["wheated_baron", "vanilla"]);
    state = advanceToActionPhase(state, [1, 1]);
    // Clear v2.9 per-turn age gate â€” these tests don't exercise it.
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, needsAgeBarrels: false })),
    };
    // The Baron's pre-aged starter is already aging â€” we need a
    // ready/construction slot to commit to. The Baron has 0
    // additional slotted bills, so place a bill directly via test
    // helper.
    const billCard = makeMashBill(
      {
        defId: "test_bill_rye_check",
        name: "Test",
        ageBands: [2],
        demandBands: [2],
        rewardGrid: [[1]],
        recipe: {},
      },
      400,
    );
    state = placeBarrel(state, "p1", billCard, 0);
    // Convert that placed barrel into a ready slot.
    state = {
      ...state,
      allBarrels: state.allBarrels.map((b) =>
        b.attachedMashBill.id === billCard.id
          ? { ...b, phase: "ready", age: 0, completedInRound: null, agingCards: [] }
          : b,
      ),
    };
    const slot = state.allBarrels.find((b) => b.attachedMashBill.id === billCard.id)!;
    const rye = makeResourceCard("rye", "p1", 900);
    state = giveHand(state, "p1", [rye]);
    expect(() =>
      applyAction(state, {
        type: "MAKE_BOURBON",
        playerId: "p1",
        slotId: slot.slotId,
        cardIds: [rye.id],
      }),
    ).toThrow(/Wheated Baron cannot commit rye/);
  });

  it("High-Rye House: rejects taking wheated bills via the Drafting Loop", () => {
    const wheated = makeMashBill(
      {
        defId: "test_wheated2",
        name: "Wheated2",
        ageBands: [2],
        demandBands: [2],
        rewardGrid: [[1]],
        recipe: { minWheat: 1, maxRye: 0 },
      },
      500,
    );
    let state = initializeGame({
      seed: 1,
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      startingDistilleries: [pickDistillery("high_rye_house"), pickDistillery("vanilla")],
      startingMashBills: [[], []],
      bourbonDeck: [wheated, ...defaultMashBillCatalog()],
      starterDecks: [defaultStarterCards("p1"), defaultStarterCards("p2")],
    });
    state = advanceToActionPhase(state, [1, 1]);
    // Clear the v2.9 per-turn age gate — these tests don't exercise it.
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, needsAgeBarrels: false })),
    };
    // Stand up a loop directly with the wheated bill in the revealed
    // set so we can try (and fail) to take it as High-Rye House. The
    // pile is non-empty so the validator's hand-membership check on
    // payment cards is exercised normally.
    const seedCard = state.players.find((p) => p.id === "p1")!.hand[0]!;
    const payCard = state.players.find((p) => p.id === "p1")!.hand[1]!;
    state = {
      ...state,
      draftingLoop: {
        initiatorId: "p1",
        pickOrder: ["p1", "p2"],
        pickerIndex: 0,
        pickerStage: "bill",
        draftPile: [seedCard],
        revealedBills: [wheated],
      },
    };
    expect(() =>
      applyAction(state, {
        type: "DRAFT_TAKE_BILL",
        playerId: "p1",
        mashBillId: wheated.id,
        paymentCardId: payCard.id,
      }),
    ).toThrow(/wheated/i);
  });

  it("Connoisseur Estate: Gold Convert lands the Gold bill in an Open slot", () => {
    const goldBill = makeMashBill(
      {
        defId: "test_gold_open",
        name: "Gold Open",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [[1, 2, 3], [2, 4, 5], [3, 5, 6]],
        goldAward: { minAge: 5, minDemand: 5 },
      },
      600,
    );
    let state = initializeGame({
      seed: 1,
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      startingDistilleries: [
        pickDistillery("connoisseur_estate"),
        pickDistillery("vanilla"),
      ],
      startingMashBills: [[], []],
      bourbonDeck: defaultMashBillCatalog(),
      starterDecks: [defaultStarterCards("p1"), defaultStarterCards("p2")],
      startingDemand: 6,
    });
    state = advanceToActionPhase(state, [1, 1]);
    // Clear v2.9 per-turn age gate â€” these tests don't exercise it.
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, needsAgeBarrels: false })),
    };
    // Clear Connoisseur's auto-drafted barrels so we have at least
    // one open slot besides the sale slot.
    state = {
      ...state,
      allBarrels: state.allBarrels.filter((b) => b.ownerId !== "p1"),
    };
    // Place an age-5 barrel for p1 with the Gold bill attached.
    // placeBarrel defaults completedInRound to 0 (round-gap satisfied).
    state = placeBarrel(state, "p1", goldBill, 5);
    const selling = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!;
    // Find a different open slot.
    const occupied = new Set(state.allBarrels.map((b) => b.slotId));
    const openSlot = state.players[0]!.rickhouseSlots.find((s) => !occupied.has(s.id))!;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId: selling.id,
goldChoice: "convert",
      goldConvertTargetSlotId: openSlot.id,
    });
    // The open slot now holds a ready barrel with the Gold bill.
    const landed = state.allBarrels.find((b) => b.slotId === openSlot.id);
    expect(landed).toBeDefined();
    expect(landed!.phase).toBe("ready");
    expect(landed!.attachedMashBill.id).toBe(goldBill.id);
    // Selling slot opens fully.
    expect(state.allBarrels.some((b) => b.slotId === selling.slotId)).toBe(false);
  });

  it("High-Rye House: +1 rep stacks on rye bills (minRye â‰¥ 1)", () => {
    const ryeBill = makeMashBill(
      {
        defId: "test_high_rye_bonus",
        name: "Rye Bonus",
        ageBands: [2],
        demandBands: [2],
        rewardGrid: [[3]],
        recipe: { minRye: 1 },
      },
      700,
    );
    let state = initializeGame({
      seed: 1,
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      startingDistilleries: [
        pickDistillery("high_rye_house"),
        pickDistillery("vanilla"),
      ],
      startingMashBills: [[], []],
      bourbonDeck: defaultMashBillCatalog(),
      starterDecks: [defaultStarterCards("p1"), defaultStarterCards("p2")],
      startingDemand: 2,
    });
    state = advanceToActionPhase(state, [1, 1]);
    // Clear v2.9 per-turn age gate â€” these tests don't exercise it.
    state = {
      ...state,
      players: state.players.map((p) => ({ ...p, needsAgeBarrels: false })),
    };
    // Remove the auto pre-aged starter so we can place a fresh
    // testable barrel without slot collisions.
    state = {
      ...state,
      allBarrels: state.allBarrels.filter((b) => b.ownerId !== "p1"),
    };
    state = placeBarrel(state, "p1", ryeBill, 2);
    const barrel = state.allBarrels.find((b) => b.ownerId === "p1" && b.phase === "aging")!;
    const beforeRep = state.players[0]!.reputation;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId: barrel.id,
});
    // v2.11: grid pays 3 rep + 1 from High-Rye distillery bonus = 4.
    // (Tier-1 floor is 3, so the +1 distillery bonus drives the total
    // above floor cleanly.)
    expect(state.players[0]!.reputation - beforeRep).toBe(4);
  });
});
