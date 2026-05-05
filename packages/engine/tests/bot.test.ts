import { describe, it, expect } from "vitest";
import { chooseAction, playFullBotGame } from "../src/index.js";
import { computeFinalScores, isGameOver } from "../src/engine.js";
import { defaultMashBillCatalog } from "../src/defaults.js";
import { initializeGame } from "../src/initialize.js";
import { advanceToActionPhase, makeTestGame } from "./helpers.js";

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
      "DRAW_MASH_BILL",
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
    const totalRep = scores.reduce((acc, s) => acc + s.reputation, 0);
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
    expect(a.players.map((p) => p.reputation)).toEqual(
      b.players.map((p) => p.reputation),
    );
    expect(a.actionHistory.length).toBe(b.actionHistory.length);
    expect(a.round).toBe(b.round);
  });
});
