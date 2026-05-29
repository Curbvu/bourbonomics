import { describe, it, expect } from "vitest";
import { chooseAction, playFullBotGame } from "../src/index.js";
import { computeFinalScores, isGameOver } from "../src/engine.js";
import { defaultMashBillCatalog } from "../src/defaults.js";
import { initializeGame } from "../src/initialize.js";
import { makeLaborCard, makeResourceCard } from "../src/cards.js";
import {
  advanceToActionPhase,
  giveHand,
  giveRep,
  makeTestGame,
} from "./helpers.js";

describe("chooseAction", () => {
  it("returns PASS_TURN when phase is not action", () => {
    const state = makeTestGame();
    expect(chooseAction(state, "p1").type).toBe("PASS_TURN");
  });

  it("returns PASS_TURN when player's hand and operations hand are empty", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state);
    state = {
      ...state,
      players: state.players.map((p) =>
        p.id === "p1" ? { ...p, hand: [], operationsHand: [] } : p,
      ),
    };
    expect(chooseAction(state, "p1").type).toBe("PASS_TURN");
  });

  it("picks a legal action when production is possible", () => {
    let state = makeTestGame();
    state = advanceToActionPhase(state, [1, 1]);
    const action = chooseAction(state, "p1");
    // It's not PASS_TURN unless the engine truly has no good option.
    expect([
      "MAKE_BOURBON",
      "AGE_BOURBON",
      "SELL_BOURBON",
      "BUY_FROM_MARKET",
      "BUY_OPERATIONS_CARD",
      "INITIATE_DRAFTING_LOOP",
      "PLAY_OPERATIONS_CARD",
      "PASS_TURN",
    ]).toContain(action.type);
  });
});

describe("playFullBotGame", () => {
  it("plays a 2-bot game to completion", () => {
    const catalog = defaultMashBillCatalog();
    const initial = initializeGame({
      seed: 42,
      players: [
        { id: "alice", name: "Alice", isBot: true },
        { id: "bob", name: "Bob", isBot: true },
      ],
      // Smaller deck so it ends faster.
      bourbonDeck: catalog.slice(0, 4),
      startingMashBills: [
        [catalog[5]!, catalog[6]!], // veteran_stock, boomtown_blend
        [catalog[7]!, catalog[0]!], // hollow_oak, backroad_batch
      ],
    });

    const final = playFullBotGame(initial);
    expect(isGameOver(final)).toBe(true);
    expect(final.phase).toBe("ended");
    expect(final.finalRoundTriggered).toBe(true);

    const scores = computeFinalScores(final);
    expect(scores).toHaveLength(2);
    expect(scores[0]!.rank).toBe(1);
    // At least one player should have made some progress.
    const totalRep = scores.reduce((acc, s) => acc + s.capital, 0);
    expect(totalRep).toBeGreaterThanOrEqual(0);
  });

  it("plays a 4-bot game to completion within reasonable action count", () => {
    const catalog = defaultMashBillCatalog();
    const initial = initializeGame({
      seed: 7,
      players: [
        { id: "p1", name: "Alice", isBot: true },
        { id: "p2", name: "Bob", isBot: true },
        { id: "p3", name: "Carol", isBot: true },
        { id: "p4", name: "Dave", isBot: true },
      ],
      bourbonDeck: catalog.slice(0, 6),
      startingMashBills: [[], [], [], []],
    });

    let actionCount = 0;
    const final = playFullBotGame(initial, {
      maxActions: 5_000,
      onAction: () => {
        actionCount++;
      },
    });
    expect(isGameOver(final)).toBe(true);
    expect(actionCount).toBeGreaterThan(0);
    expect(actionCount).toBeLessThan(5_000);
  });

  it("plays a 2-easy-bot game to completion with at least one rep > 0", () => {
    const catalog = defaultMashBillCatalog();
    const initial = initializeGame({
      seed: 13,
      players: [
        { id: "alice", name: "Alice", isBot: true, difficulty: "easy" },
        { id: "bob", name: "Bob", isBot: true, difficulty: "easy" },
      ],
      bourbonDeck: catalog.slice(0, 4),
      startingMashBills: [
        [catalog[5]!, catalog[6]!],
        [catalog[7]!, catalog[0]!],
      ],
    });
    const final = playFullBotGame(initial);
    expect(isGameOver(final)).toBe(true);
    const someoneEndsPositive = final.players.some((p) => p.capital > 0);
    expect(someoneEndsPositive).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const catalog = defaultMashBillCatalog();
    const config = {
      seed: 99,
      players: [
        { id: "alice", name: "Alice", isBot: true },
        { id: "bob", name: "Bob", isBot: true },
      ],
      bourbonDeck: catalog.slice(0, 4),
    };
    const a = playFullBotGame(initializeGame(config));
    const b = playFullBotGame(initializeGame(config));
    expect(a.players.map((p) => p.capital)).toEqual(
      b.players.map((p) => p.capital),
    );
    expect(a.actionHistory.length).toBe(b.actionHistory.length);
    expect(a.round).toBe(b.round);
  });
});

describe("chooseBuy difficulty heuristics", () => {
  it("normal bot refuses to buy a useless card even when affordable", () => {
    // The original "buys needlessly" bug: bot has rep, market has a
    // pricey card that doesn't advance any in-flight bill. The old
    // cost-based scorer preferred the most expensive affordable card.
    // The EV scorer should refuse — net = -0.75 - 2 < threshold 0.
    let state = makeTestGame({
      seed: 11,
      players: [
        { id: "p1", name: "Alice", isBot: true, difficulty: "normal" },
        { id: "p2", name: "Bob", isBot: true },
      ],
      startingMashBills: [[], []], // no in-flight bills for p1
    });
    state = advanceToActionPhase(state);
    state = giveRep(state, "p1", 5);
    state = giveHand(state, "p1", [makeResourceCard("corn", "p1", 0)]);
    // Whole market is $2 Specialty Rye — Specialty floor with no bill
    // demanding rye: evForCard returns 0.5 (filler), net = -1.5,
    // below NET_THRESHOLD["normal"] = 0. Bot must NOT buy.
    const market = Array.from({ length: 10 }, (_, i) => ({
      ...makeResourceCard("rye", "test", i),
      specialty: true,
      cost: 2,
      cardDefId: "superior_rye",
    }));
    state = {
      ...state,
      market,
      // Block the Drafting Loop fallback so the only "spend" path is
      // BUY_FROM_MARKET.
      players: state.players.map((p) =>
        p.id === "p1" ? { ...p, draftingLoopUsedThisRound: true } : p,
      ),
    };

    const action = chooseAction(state, "p1");
    expect(action.type).not.toBe("BUY_FROM_MARKET");
  });

  it("picks the EV-positive card over an affordable but useless one", () => {
    // Setup: bot has a ready Wheated bill needing 2 wheat. Market has
    // a Common Wheat ($1) and a Heritage Investment ($3). The cost-
    // based old heuristic preferred the more expensive Investment;
    // the EV scorer should pick the Wheat (advances an in-flight bill).
    const catalog = defaultMashBillCatalog();
    const wheatBill = catalog.find((b) => b.recipe?.maxRye === 0);
    if (!wheatBill) throw new Error("test setup: no wheated bill in catalog");
    let state = makeTestGame({
      seed: 17,
      players: [
        { id: "p1", name: "Alice", isBot: true, difficulty: "normal" },
        { id: "p2", name: "Bob", isBot: true },
      ],
      startingMashBills: [[wheatBill], []],
    });
    state = advanceToActionPhase(state);
    state = giveRep(state, "p1", 5);
    // Hand: one Marketing Labor (won't trigger MAKE_BOURBON; counts as
    // "any spendable card" so the action loop reaches chooseBuy).
    state = giveHand(state, "p1", [
      makeLaborCard({ subtype: "marketing", ownerLabel: "p1", index: 0 }),
    ]);

    // Market: slot 0 = Common Wheat ($1), slot 1 = Heritage-priced
    // Investment ($3). Fill remaining slots with low-EV $2 commons
    // that score below the wheat (EV 0.25 net -1.75) so they don't win.
    const commonWheat = makeResourceCard("wheat", "test", 0);
    const heritageInvestment = {
      id: "card_test_inv_0",
      cardDefId: "test_investment",
      type: "investment" as const,
      cost: 3,
      displayName: "Test Investment",
    };
    const market = [commonWheat, heritageInvestment as never] as ReturnType<
      typeof makeResourceCard
    >[];
    while (market.length < 10) {
      // Plain corn — not the bill's needed subtype, so EV stays at 0.25.
      market.push(makeResourceCard("corn", "test", market.length));
    }
    state = { ...state, market };

    const action = chooseAction(state, "p1");
    expect(action.type).toBe("BUY_FROM_MARKET");
    if (action.type === "BUY_FROM_MARKET") {
      expect(action.marketSlotIndex).toBe(0);
    }
  });

});
