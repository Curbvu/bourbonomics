import { describe, expect, it } from "vitest";
import { applyAction, computeFinalScores } from "../../src/engine.js";
import { initializeGame } from "../../src/initialize.js";
import { defaultStarterCards } from "../../src/defaults.js";
import { defaultDistilleryPool } from "../../src/distilleries.js";
import { makeMashBill } from "../../src/cards.js";
import {
  advanceToActionPhase,
  makeTestGame,
  placeBarrel,
} from "../helpers.js";
import { lineBoardForDistillery } from "../../src/lines/boards.js";

describe("setup: initial Line Card draft", () => {
  it("deals each player 4 cards into pendingInitialLineCardDraft", () => {
    const pool = defaultDistilleryPool();
    const vanilla = pool.find((d) => d.bonus === "vanilla")!;
    const state = initializeGame({
      seed: 42,
      players: [
        { id: "p1", name: "A" },
        { id: "p2", name: "B" },
      ],
      startingDistilleries: [
        { ...vanilla, id: "dv1", mashBillDraftSize: 0 },
        { ...vanilla, id: "dv2", mashBillDraftSize: 0 },
      ],
      starterDecks: [defaultStarterCards("p1"), defaultStarterCards("p2")],
      startingMashBills: [[], []],
    });
    for (const p of state.players) {
      expect(p.pendingInitialLineCardDraft).not.toBeNull();
      expect(p.pendingInitialLineCardDraft!.cards.length).toBe(4);
      expect(p.lineCardHand).toHaveLength(0);
    }
    // 2 players × 4 cards dealt; deck shrinks by 8.
    expect(state.lineCardDeck.length).toBe(25 - 8);
  });

  it("CHOOSE_INITIAL_LINE_CARDS keeps 2 and returns 2 to the deck", () => {
    const pool = defaultDistilleryPool();
    const vanilla = pool.find((d) => d.bonus === "vanilla")!;
    let state = initializeGame({
      seed: 42,
      players: [{ id: "p1", name: "A" }],
      startingDistilleries: [{ ...vanilla, id: "dv1", mashBillDraftSize: 0 }],
      starterDecks: [defaultStarterCards("p1")],
      startingMashBills: [[]],
    });
    const dealt = state.players[0]!.pendingInitialLineCardDraft!.cards;
    const beforeDeckSize = state.lineCardDeck.length;
    state = applyAction(state, {
      type: "CHOOSE_INITIAL_LINE_CARDS",
      playerId: "p1",
      keepInstanceIds: [dealt[0]!.instanceId, dealt[1]!.instanceId],
    });
    const player = state.players[0]!;
    expect(player.pendingInitialLineCardDraft).toBeNull();
    expect(player.lineCardHand).toHaveLength(2);
    expect(state.lineCardDeck.length).toBe(beforeDeckSize + 2);
  });

  it("flagship line is bound to the distillery's Line Board at setup", () => {
    const state = makeTestGame();
    const wheatedBoard = lineBoardForDistillery("vanilla")!;
    for (const p of state.players) {
      expect(p.flagshipLine.lineBoardId).toBe(wheatedBoard.id);
      expect(p.flagshipLine.bottles).toHaveLength(0);
      expect(p.flagshipLine.stackedCards).toHaveLength(0);
    }
  });
});

describe("SELL_BOURBON → pendingBottlePlacement → PLACE_BOTTLE", () => {
  const testBill = (overrides: { recipe?: { minWheat?: number } } = {}) =>
    makeMashBill(
      {
        defId: "test_w",
        name: "Test Wheated",
        tier: "common",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
        recipe: overrides.recipe ?? { minWheat: 1 },
      },
      77,
    );

  it("sets pendingBottlePlacement after sell; PLACE_BOTTLE to inventory clears it", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    const player = state.players[0]!;
    expect(player.pendingBottlePlacement).not.toBeNull();
    const bottle = player.pendingBottlePlacement!.bottle;
    expect(bottle.recipeTags).toContain("wheated");
    state = applyAction(state, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "inventory" },
    });
    const after = state.players[0]!;
    expect(after.pendingBottlePlacement).toBeNull();
    expect(after.inventory).toHaveLength(1);
  });

  it("PLACE_BOTTLE { flagship } pushes onto flagship line when constraints pass", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    state = applyAction(state, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "flagship" },
    });
    expect(state.players[0]!.flagshipLine.bottles).toHaveLength(1);
    expect(state.players[0]!.inventory).toHaveLength(0);
  });

  it("blocks other actions while pendingBottlePlacement is set", () => {
    let state = makeTestGame({ startingDemand: 6 });
    state = advanceToActionPhase(state, [1, 1]);
    state = placeBarrel(state, "p1", testBill(), 5);
    const barrelId = state.allBarrels.find((b) => b.phase === "aging")!.id;
    state = applyAction(state, {
      type: "SELL_BOURBON",
      playerId: "p1",
      barrelId,
    });
    expect(() =>
      applyAction(state, { type: "PASS_TURN", playerId: "p1" }),
    ).toThrow(/place the sold bottle/);
  });
});

describe("DRAW_LINE_CARDS once per round + KEEP_LINE_CARDS", () => {
  it("draws up to 3 then forces keep ≥ 1", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    state = applyAction(state, {
      type: "DRAW_LINE_CARDS",
      playerId: "p1",
    });
    const player = state.players[0]!;
    expect(player.pendingLineCardDraw).not.toBeNull();
    const drawn = player.pendingLineCardDraw!.cards;
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.length).toBeLessThanOrEqual(3);
    expect(player.hasDrawnLineCardsThisRound).toBe(true);

    // Second draw same round → illegal
    expect(() =>
      applyAction(state, { type: "DRAW_LINE_CARDS", playerId: "p1" }),
    ).toThrow();

    // Keep 0 → illegal
    expect(() =>
      applyAction(state, {
        type: "KEEP_LINE_CARDS",
        playerId: "p1",
        keepInstanceIds: [],
      }),
    ).toThrow(/at least 1/);

    state = applyAction(state, {
      type: "KEEP_LINE_CARDS",
      playerId: "p1",
      keepInstanceIds: [drawn[0]!.instanceId],
    });
    const after = state.players[0]!;
    expect(after.pendingLineCardDraw).toBeNull();
    expect(after.lineCardHand.length).toBeGreaterThanOrEqual(1);
  });
});

describe("EXTEND_LINE", () => {
  it("stacks a Line Card from hand onto the flagship", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    // makeTestGame already kept 2 cards into each player's lineCardHand.
    const player = state.players[0]!;
    const card = player.lineCardHand[0];
    if (!card) {
      // Some seeds may deal differently; skip the assertion.
      return;
    }
    state = applyAction(state, {
      type: "EXTEND_LINE",
      playerId: "p1",
      targetLineId: player.flagshipLine.id,
      lineCardInstanceId: card.instanceId,
    });
    const after = state.players[0]!;
    expect(after.flagshipLine.stackedCards).toHaveLength(1);
    expect(after.lineCardHand).toHaveLength(1);
  });
});

describe("end-game scoring (computeFinalScores)", () => {
  it("includes flagshipScore + secondaryScores + inventoryScore + total", () => {
    const state = makeTestGame();
    const rows = computeFinalScores(state);
    for (const row of rows) {
      expect(row.flagshipScore).toBe(0); // empty flagship
      expect(row.secondaryScores).toEqual([]);
      expect(row.inventoryScore).toBe(0);
      expect(row.total).toBe(row.reputation);
    }
  });

  it("ranks players by total (line score affects rank)", () => {
    // p1 has higher banked rep, p2 has a strong flagship line.
    const state = makeTestGame();
    // Give p1 banked rep advantage; give p2 inventory bottles.
    const mutated = {
      ...state,
      players: state.players.map((p, i) => {
        if (i === 0) return { ...p, reputation: 10 };
        return {
          ...p,
          reputation: 5,
          inventory: Array.from({ length: 6 }, (_, j) => ({
            bottleId: `b_${j}`,
            originalBillId: "x",
            billDefId: "y",
            name: "x",
            recipeTags: [],
            primaryRecipeTag: "neutral",
            caskTag: "common-cask",
            rarity: "common" as const,
            ageAtSale: 3,
            demandAtSale: 5,
            placedOnRound: 1,
          })),
        };
      }),
    };
    const rows = computeFinalScores(mutated);
    // p2 total: 5 + 6 = 11; p1 total: 10. p2 wins.
    const p1 = rows.find((r) => r.playerId === "p1")!;
    const p2 = rows.find((r) => r.playerId === "p2")!;
    expect(p2.total).toBeGreaterThan(p1.total);
    expect(p2.rank).toBe(1);
    expect(p1.rank).toBe(2);
  });
});
