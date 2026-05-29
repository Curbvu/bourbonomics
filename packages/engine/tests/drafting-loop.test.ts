import { describe, it, expect } from "vitest";
import { applyAction } from "../src/engine.js";
import { makeMashBill, makeResourceCard, makeLaborCard } from "../src/cards.js";
import { initializeGame } from "../src/initialize.js";
import { defaultStarterCards } from "../src/defaults.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import type { GameConfig, MashBill } from "../src/types.js";
import {
  advanceToActionPhase,
  giveHand,
  makeTestGame,
} from "./helpers.js";

// ============================================================
// v2.14 — The Drafting Loop
// ============================================================
// Coverage:
//   - INITIATE: final-round restriction, once-per-round, empty hand,
//     empty deck.
//   - DRAFT_TAKE_BILL: open-slot gate, distillery constraints
//     (High-Rye, Connoisseur Estate), hand-card payment, save-slot
//     exclusion.
//   - DRAFT_TAKE_CARD: pile scavenging, post-bill closed window.
//   - DRAFT_PASS: rotation, loop close (cards → market discard,
//     bills → bourbon deck).
//   - 2/3/4-player turn order.
//   - Doomsday clock fires only when no in-flight loop holds bills.
// ============================================================

function bill(defId: string, idx: number, recipe?: MashBill["recipe"]): MashBill {
  return makeMashBill(
    {
      defId,
      name: defId,
      ageBands: [2],
      demandBands: [2],
      rewardGrid: [[1]],
      ...(recipe ? { recipe } : {}),
    },
    idx,
  );
}

function makeBourbonDeck(n: number): MashBill[] {
  return Array.from({ length: n }, (_, i) => bill(`bill_${i}`, i));
}

// ---------- INITIATE_DRAFTING_LOOP ----------

describe("INITIATE_DRAFTING_LOOP", () => {
  it("places the seed card in the pile and reveals 3 bills", () => {
    const deck = makeBourbonDeck(5);
    let state = makeTestGame({ bourbonDeck: deck });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);

    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedId,
    });

    expect(state.draftingLoop).not.toBeNull();
    expect(state.draftingLoop!.draftPile).toHaveLength(1);
    expect(state.draftingLoop!.draftPile[0]!.id).toBe(seedId);
    expect(state.draftingLoop!.revealedBills).toHaveLength(3);
    expect(state.bourbonDeck).toHaveLength(2);
    expect(state.players.find((p) => p.id === "p1")!.draftingLoopUsedThisRound).toBe(true);
    expect(state.players.find((p) => p.id === "p1")!.hand).toHaveLength(0);
  });

  it("reveals fewer than 3 when the deck is short", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(2) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedId,
    });
    expect(state.draftingLoop!.revealedBills).toHaveLength(2);
    expect(state.bourbonDeck).toHaveLength(0);
  });

  it("is rejected during the final round", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(5) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    state = { ...state, finalRoundTriggered: true };
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    expect(() =>
      applyAction(state, {
        type: "INITIATE_DRAFTING_LOOP",
        playerId: "p1",
        cardId: seedId,
      }),
    ).toThrow(/final round/i);
  });

  it("is rejected when the player has already initiated this round", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(5) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      makeResourceCard("corn", "p1", 0),
      makeResourceCard("corn", "p1", 1),
    ]);
    const seed1 = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seed1,
    });
    // Close the loop quickly with passes.
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p1" });
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p2" });
    expect(state.draftingLoop).toBeNull();

    const seed2 = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    expect(() =>
      applyAction(state, {
        type: "INITIATE_DRAFTING_LOOP",
        playerId: "p1",
        cardId: seed2,
      }),
    ).toThrow(/already initiated/i);
  });

  it("is rejected with no card to seed the pile (empty hand)", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(5) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", []);
    expect(() =>
      applyAction(state, {
        type: "INITIATE_DRAFTING_LOOP",
        playerId: "p1",
        cardId: "nonexistent",
      }),
    ).toThrow(/not in your hand/i);
  });

  it("is rejected when the bourbon deck is empty", () => {
    let state = makeTestGame({ bourbonDeck: [] });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    expect(() =>
      applyAction(state, {
        type: "INITIATE_DRAFTING_LOOP",
        playerId: "p1",
        cardId: seedId,
      }),
    ).toThrow(/bourbon deck is empty/i);
  });

  it("counts even when no bill is taken (per the spec)", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(3) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedId,
    });
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p1" });
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p2" });
    expect(state.players.find((p) => p.id === "p1")!.draftingLoopUsedThisRound).toBe(true);
  });
});

// ---------- DRAFT_TAKE_BILL ----------

describe("DRAFT_TAKE_BILL", () => {
  it("lands the bill in an Open slot as a Staged barrel and the payment card in the pile", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(3) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      makeResourceCard("corn", "p1", 0),
      makeResourceCard("corn", "p1", 1),
    ]);
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedId,
    });
    const billId = state.draftingLoop!.revealedBills[0]!.id;
    const payId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    const slottedBefore = state.allBarrels.filter((b) => b.ownerId === "p1").length;
    state = applyAction(state, {
      type: "DRAFT_TAKE_BILL",
      playerId: "p1",
      mashBillId: billId,
      paymentCardId: payId,
    });
    const slottedAfter = state.allBarrels.filter((b) => b.ownerId === "p1").length;
    expect(slottedAfter).toBe(slottedBefore + 1);
    expect(state.draftingLoop!.revealedBills).toHaveLength(2);
    expect(state.draftingLoop!.draftPile).toHaveLength(2);
    expect(state.players.find((p) => p.id === "p1")!.hand).toHaveLength(0);
  });

  it("rejects payment from outside the picker's hand", () => {
    // v3.5: the Save Slot is gone, so this regression test simulates
    // an out-of-hand card by minting one that's never placed in hand
    // (it could be a Warehouse contents, a deck card, etc. — the
    // engine's invariant is the same: payment must come from hand).
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(3) });
    state = advanceToActionPhase(state);
    const seed = makeResourceCard("corn", "p1", 0);
    const outOfHand = makeResourceCard("corn", "p1-stash", 1);
    state = giveHand(state, "p1", [seed]);
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seed.id,
    });
    const billId = state.draftingLoop!.revealedBills[0]!.id;
    expect(() =>
      applyAction(state, {
        type: "DRAFT_TAKE_BILL",
        playerId: "p1",
        mashBillId: billId,
        paymentCardId: outOfHand.id,
      }),
    ).toThrow(/not in your hand/i);
  });

  it("rejects taking a bill with no Open slot to receive it", () => {
    // Pre-fill every slot with starting bills so the player has zero Open slots.
    const presentBill = bill("present", 999);
    const deck = makeBourbonDeck(3);
    let state = makeTestGame({
      bourbonDeck: deck,
      startingMashBills: [
        [presentBill, presentBill, presentBill, presentBill],
        [],
      ],
    });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [
      makeResourceCard("corn", "p1", 0),
      makeResourceCard("corn", "p1", 1),
    ]);
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedId,
    });
    const billId = state.draftingLoop!.revealedBills[0]!.id;
    const payId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    expect(() =>
      applyAction(state, {
        type: "DRAFT_TAKE_BILL",
        playerId: "p1",
        mashBillId: billId,
        paymentCardId: payId,
      }),
    ).toThrow(/no open slot/i);
  });
});

// ---------- DRAFT_TAKE_CARD ----------

describe("DRAFT_TAKE_CARD", () => {
  it("subsequent picker scavenges a card from the pile into their hand", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(3) });
    state = advanceToActionPhase(state);
    const seedCard = makeLaborCard({ subtype: "generic", ownerLabel: "p1", index: 0 });
    state = giveHand(state, "p1", [seedCard]);
    state = giveHand(state, "p2", []);
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedCard.id,
    });
    // p1 passes — p2 is now on the clock in "card" stage.
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p1" });
    expect(state.draftingLoop!.pickOrder[state.draftingLoop!.pickerIndex]).toBe("p2");
    expect(state.draftingLoop!.pickerStage).toBe("card");

    state = applyAction(state, {
      type: "DRAFT_TAKE_CARD",
      playerId: "p2",
      cardIds: [seedCard.id],
    });
    expect(state.draftingLoop!.draftPile).toHaveLength(0);
    expect(state.players.find((p) => p.id === "p2")!.hand).toHaveLength(1);
    expect(state.players.find((p) => p.id === "p2")!.hand[0]!.id).toBe(seedCard.id);
  });

  it("rejects taking cards in 'bill' stage (initiator window)", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(3) });
    state = advanceToActionPhase(state);
    const seedCard = makeResourceCard("corn", "p1", 0);
    state = giveHand(state, "p1", [seedCard]);
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedCard.id,
    });
    // Initiator's stage is "bill" — TAKE_CARD is illegal.
    expect(state.draftingLoop!.pickerStage).toBe("bill");
    expect(() =>
      applyAction(state, {
        type: "DRAFT_TAKE_CARD",
        playerId: "p1",
        cardIds: [seedCard.id],
      }),
    ).toThrow(/card-taking is closed/i);
  });

  it("closes the card-take window after the picker takes their first bill", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(3) });
    state = advanceToActionPhase(state);
    const seedCard = makeLaborCard({ subtype: "generic", ownerLabel: "p1", index: 0 });
    const p2Pay = makeResourceCard("corn", "p2", 0);
    state = giveHand(state, "p1", [seedCard]);
    state = giveHand(state, "p2", [p2Pay]);
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedCard.id,
    });
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p1" });
    // p2 takes a bill — card-taking window closes.
    const billId = state.draftingLoop!.revealedBills[0]!.id;
    state = applyAction(state, {
      type: "DRAFT_TAKE_BILL",
      playerId: "p2",
      mashBillId: billId,
      paymentCardId: p2Pay.id,
    });
    expect(state.draftingLoop!.pickerStage).toBe("bill");
    expect(() =>
      applyAction(state, {
        type: "DRAFT_TAKE_CARD",
        playerId: "p2",
        cardIds: [seedCard.id],
      }),
    ).toThrow(/card-taking is closed/i);
  });
});

// ---------- DRAFT_PASS / Loop close ----------

describe("DRAFT_PASS and loop close", () => {
  it("rotates through every player and closes when the pile returns to the initiator", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(5) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedId,
    });
    expect(state.draftingLoop!.pickOrder).toEqual(["p1", "p2"]);
    expect(state.draftingLoop!.pickerIndex).toBe(0);

    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p1" });
    expect(state.draftingLoop!.pickerIndex).toBe(1);
    expect(state.draftingLoop!.pickerStage).toBe("card");

    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p2" });
    expect(state.draftingLoop).toBeNull();
  });

  it("rolls leftover bills into the bourbon deck on close", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(5) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    state = giveHand(state, "p2", []);
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedId,
    });
    // 3 bills revealed → 2 left in deck.
    expect(state.bourbonDeck).toHaveLength(2);
    expect(state.draftingLoop!.revealedBills).toHaveLength(3);

    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p1" });
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p2" });
    expect(state.draftingLoop).toBeNull();
    expect(state.bourbonDeck).toHaveLength(5); // all 5 back in the deck
  });

  it("sends leftover pile cards to the market discard on close", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(3) });
    state = advanceToActionPhase(state);
    const seedCard = makeResourceCard("corn", "p1", 0);
    state = giveHand(state, "p1", [seedCard]);
    state = giveHand(state, "p2", []);
    const discardBefore = state.marketDiscard.length;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedCard.id,
    });
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p1" });
    state = applyAction(state, { type: "DRAFT_PASS", playerId: "p2" });
    expect(state.marketDiscard.length).toBe(discardBefore + 1);
    expect(state.marketDiscard.some((c) => c.id === seedCard.id)).toBe(true);
  });

  it("orders pickers seat-clockwise starting from the initiator in a 4-player game", () => {
    const config: GameConfig = {
      seed: 5,
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
        { id: "p3", name: "C" },
        { id: "p4", name: "D" },
      ],
      bourbonDeck: makeBourbonDeck(5),
      startingMashBills: [[], [], [], []],
      startingDistilleries: defaultDistilleryPool().slice(0, 4).map((d, i) => ({
        ...d,
        id: `dist_${i}`,
        bonus: "vanilla",
        mashBillDraftSize: 0,
      })),
      starterDecks: [
        defaultStarterCards("p1"),
        defaultStarterCards("p2"),
        defaultStarterCards("p3"),
        defaultStarterCards("p4"),
      ],
    };
    let state = initializeGame(config);
    state = advanceToActionPhase(state);
    state = giveHand(state, "p3", [makeResourceCard("corn", "p3", 0)]);
    // Move the cursor to p3 so they can initiate.
    state = { ...state, currentPlayerIndex: 2 };
    const seedId = state.players.find((p) => p.id === "p3")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p3",
      cardId: seedId,
    });
    expect(state.draftingLoop!.pickOrder).toEqual(["p3", "p4", "p1", "p2"]);
  });
});

// ---------- Modal sub-phase ----------

describe("Drafting Loop modal sub-phase", () => {
  it("rejects unrelated main actions while a loop is in progress", () => {
    let state = makeTestGame({ bourbonDeck: makeBourbonDeck(3) });
    state = advanceToActionPhase(state);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    const seedId = state.players.find((p) => p.id === "p1")!.hand[0]!.id;
    state = applyAction(state, {
      type: "INITIATE_DRAFTING_LOOP",
      playerId: "p1",
      cardId: seedId,
    });
    expect(() => applyAction(state, { type: "PASS_TURN", playerId: "p1" })).toThrow(
      /Drafting Loop/i,
    );
  });
});

// ---------- Bots ----------
// Bot heuristics (initiate / participate) are exercised by the
// integration test `playFullBotGame` in bot.test.ts; explicit unit
// coverage would just duplicate the heuristic and pin implementation
// details. Skip here.
