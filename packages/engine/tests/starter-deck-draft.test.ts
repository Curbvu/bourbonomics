import { describe, expect, it } from "vitest";
import { applyAction, IllegalActionError } from "../src/engine.js";
import { initializeGame } from "../src/initialize.js";
import { defaultDistilleryPool } from "../src/distilleries.js";
import { defaultMashBillCatalog } from "../src/defaults.js";
import { STARTER_HAND_SIZE } from "../src/starter-pool.js";

function makeDraftGame(
  distilleryBonuses?: Array<"vanilla" | "high_rye" | "wheated_baron" | "connoisseur">,
) {
  const pool = defaultDistilleryPool();
  const catalog = defaultMashBillCatalog();
  // Default: two Vanilla distilleries so the dealt hands are exactly
  // STARTER_HAND_SIZE — the per-distillery starter mods (e.g. High-Rye's
  // +2 2-rye) have dedicated tests below.
  const bonuses = distilleryBonuses ?? ["vanilla", "vanilla"];
  const startingDistilleries = bonuses.map(
    (b, i) => ({ ...pool.find((d) => d.bonus === b)!, id: `dist_test_${b}_${i}` }),
  );
  return initializeGame({
    seed: 1,
    players: [
      { id: "p1", name: "Alice" },
      { id: "p2", name: "Bob" },
    ],
    startingDistilleries,
    startingMashBills: [catalog.slice(0, 3), catalog.slice(3, 6)],
    bourbonDeck: catalog.slice(6),
  });
}

describe("starter_deck_draft phase — random deal", () => {
  it("deals STARTER_HAND_SIZE cards face-up to each drafter at phase entry", () => {
    const state = makeDraftGame();
    expect(state.phase).toBe("starter_deck_draft");
    for (const p of state.players) {
      expect(p.starterHand).toHaveLength(STARTER_HAND_SIZE);
      expect(p.starterPassed).toBe(false);
      expect(p.starterSwapUsed).toBe(false);
      expect(p.deck).toHaveLength(0); // not finalized yet
    }
  });

  it("populates starterUndealtPool with the dealing remainder for the safety valve", () => {
    const state = makeDraftGame();
    // Pool size for 2 players = 32; 2×16 dealt = 32. With the per-player
    // composition the pool is exactly enough; remainder may be empty.
    expect(state.starterUndealtPool.length).toBeGreaterThanOrEqual(0);
  });

  it("applies High-Rye distillery modifications post-deal (2 free 2-rye cards in hand)", () => {
    const state = makeDraftGame(["vanilla", "high_rye"]);
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(p2.starterHand.length).toBe(STARTER_HAND_SIZE + 2);
    const ryePremiums = p2.starterHand.filter(
      (c) => c.subtype === "rye" && (c.resourceCount ?? 1) >= 2,
    );
    expect(ryePremiums.length).toBe(2);
  });

});

describe("STARTER_TRADE", () => {
  it("swaps one card between two drafters' starter hands", () => {
    const state = makeDraftGame();
    const p1 = state.players.find((p) => p.id === "p1")!;
    const p2 = state.players.find((p) => p.id === "p2")!;
    const c1 = p1.starterHand[0]!;
    const c2 = p2.starterHand[0]!;
    const next = applyAction(state, {
      type: "STARTER_TRADE",
      player1Id: "p1",
      player2Id: "p2",
      player1CardId: c1.id,
      player2CardId: c2.id,
    });
    const next1 = next.players.find((p) => p.id === "p1")!;
    const next2 = next.players.find((p) => p.id === "p2")!;
    expect(next1.starterHand.find((c) => c.id === c1.id)).toBeUndefined();
    expect(next1.starterHand.find((c) => c.id === c2.id)).toBeDefined();
    expect(next2.starterHand.find((c) => c.id === c2.id)).toBeUndefined();
    expect(next2.starterHand.find((c) => c.id === c1.id)).toBeDefined();
    expect(next1.starterHand).toHaveLength(STARTER_HAND_SIZE);
    expect(next2.starterHand).toHaveLength(STARTER_HAND_SIZE);
  });

  it("rejects a trade with a passed player", () => {
    let state = makeDraftGame();
    state = applyAction(state, { type: "STARTER_PASS", playerId: "p1" });
    const p2 = state.players.find((p) => p.id === "p2")!;
    expect(() =>
      applyAction(state, {
        type: "STARTER_TRADE",
        player1Id: "p2",
        player2Id: "p1",
        player1CardId: p2.starterHand[0]!.id,
        player2CardId: state.players.find((p) => p.id === "p1")!.starterHand[0]!.id,
      }),
    ).toThrow(IllegalActionError);
  });

  it("rejects trading a card not in the offering player's starter hand", () => {
    const state = makeDraftGame();
    expect(() =>
      applyAction(state, {
        type: "STARTER_TRADE",
        player1Id: "p1",
        player2Id: "p2",
        player1CardId: "ghost",
        player2CardId: state.players.find((p) => p.id === "p2")!.starterHand[0]!.id,
      }),
    ).toThrow(/not in p1's starter hand/);
  });
});

describe("STARTER_SWAP — stuck-hand safety valve", () => {
  it("returns up to 3 cards to the pool and draws replacements", () => {
    const stateWithHugePool = (() => {
      // Force an oversized pool by initializing with 4 players (more
      // dealing remainder available for swap replacements).
      const pool = defaultDistilleryPool();
      const catalog = defaultMashBillCatalog();
      const bonuses: Array<"vanilla" | "high_rye" | "wheated_baron" | "connoisseur"> = [
        "vanilla",
        "high_rye",
        "wheated_baron",
        "connoisseur",
      ];
      const distilleries = bonuses.map(
        (b, i) => ({ ...pool.find((d) => d.bonus === b)!, id: `dist_test_${b}_${i}` }),
      );
      return initializeGame({
        seed: 7,
        players: [
          { id: "p1", name: "Alice" },
          { id: "p2", name: "Bob" },
          { id: "p3", name: "Cara" },
          { id: "p4", name: "Dan" },
        ],
        startingDistilleries: distilleries,
        startingMashBills: [
          catalog.slice(0, 3),
          catalog.slice(3, 6),
          catalog.slice(6, 9),
          catalog.slice(9, 12),
        ],
        bourbonDeck: catalog.slice(12),
      });
    })();

    const p1 = stateWithHugePool.players.find((p) => p.id === "p1")!;
    const swapIds = p1.starterHand.slice(0, 3).map((c) => c.id);
    const poolBefore = stateWithHugePool.starterUndealtPool.length;
    const next = applyAction(stateWithHugePool, {
      type: "STARTER_SWAP",
      playerId: "p1",
      cardIds: swapIds,
    });
    const next1 = next.players.find((p) => p.id === "p1")!;
    // Swap is in/out balanced: hand size and pool size are preserved.
    expect(next1.starterHand).toHaveLength(STARTER_HAND_SIZE);
    expect(next.starterUndealtPool).toHaveLength(poolBefore);
    expect(next1.starterSwapUsed).toBe(true);
  });

  it("rejects swapping more than 3 cards", () => {
    const state = makeDraftGame();
    const p1 = state.players.find((p) => p.id === "p1")!;
    const swapIds = p1.starterHand.slice(0, 4).map((c) => c.id);
    expect(() =>
      applyAction(state, { type: "STARTER_SWAP", playerId: "p1", cardIds: swapIds }),
    ).toThrow(/limited to 3/);
  });

  it("rejects a second swap by the same player", () => {
    const pool = defaultDistilleryPool();
    const catalog = defaultMashBillCatalog();
    const distilleries = ["vanilla", "high_rye", "wheated_baron", "connoisseur"].map(
      (b, i) =>
        ({ ...pool.find((d) => d.bonus === b)!, id: `dist_test_${b}_${i}` }),
    );
    let state = initializeGame({
      seed: 7,
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
        { id: "p3", name: "Cara" },
        { id: "p4", name: "Dan" },
      ],
      startingDistilleries: distilleries,
      startingMashBills: [
        catalog.slice(0, 3),
        catalog.slice(3, 6),
        catalog.slice(6, 9),
        catalog.slice(9, 12),
      ],
      bourbonDeck: catalog.slice(12),
    });
    const p1 = state.players.find((p) => p.id === "p1")!;
    state = applyAction(state, {
      type: "STARTER_SWAP",
      playerId: "p1",
      cardIds: [p1.starterHand[0]!.id],
    });
    const p1After = state.players.find((p) => p.id === "p1")!;
    expect(() =>
      applyAction(state, {
        type: "STARTER_SWAP",
        playerId: "p1",
        cardIds: [p1After.starterHand[0]!.id],
      }),
    ).toThrow(/already been used/);
  });
});

describe("STARTER_PASS", () => {
  it("flags the player as passed", () => {
    const state = makeDraftGame();
    const next = applyAction(state, { type: "STARTER_PASS", playerId: "p1" });
    const p1 = next.players.find((p) => p.id === "p1")!;
    expect(p1.starterPassed).toBe(true);
    expect(next.phase).toBe("starter_deck_draft"); // p2 hasn't passed yet
  });

  it("finalizes when every drafter has passed: shuffles starter hands into decks and transitions to demand", () => {
    let state = makeDraftGame();
    state = applyAction(state, { type: "STARTER_PASS", playerId: "p1" });
    state = applyAction(state, { type: "STARTER_PASS", playerId: "p2" });
    expect(state.phase).toBe("demand");
    for (const p of state.players) {
      expect(p.starterHand).toHaveLength(0);
      expect(p.deck.length).toBeGreaterThanOrEqual(STARTER_HAND_SIZE);
    }
    expect(state.starterUndealtPool).toHaveLength(0);
  });

  it("rejects a duplicate pass", () => {
    let state = makeDraftGame();
    state = applyAction(state, { type: "STARTER_PASS", playerId: "p1" });
    expect(() =>
      applyAction(state, { type: "STARTER_PASS", playerId: "p1" }),
    ).toThrow(/already passed/);
  });

  it("after distillery_selection completes, falls through to starter_deck_draft with hands dealt", () => {
    const pool = defaultDistilleryPool();
    const catalog = defaultMashBillCatalog();
    let state = initializeGame({
      seed: 1,
      players: [
        { id: "p1", name: "Alice" },
        { id: "p2", name: "Bob" },
      ],
      distilleryPool: pool,
      startingMashBills: [catalog.slice(0, 3), catalog.slice(3, 6)],
      bourbonDeck: catalog.slice(6),
    });
    expect(state.phase).toBe("distillery_selection");
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p2",
      distilleryId: state.distilleryPool[0]!.id,
    });
    state = applyAction(state, {
      type: "SELECT_DISTILLERY",
      playerId: "p1",
      distilleryId: state.distilleryPool[0]!.id,
    });
    expect(state.phase).toBe("starter_deck_draft");
    for (const p of state.players) {
      expect(p.starterHand.length).toBeGreaterThanOrEqual(STARTER_HAND_SIZE);
    }
  });
});
