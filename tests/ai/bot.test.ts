import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { driveBots } from "@/lib/ai/driver";
import type { GameState } from "@/lib/engine/state";

describe("bot driver", () => {
  it("drives an all-bot game through multiple rounds without deadlock", () => {
    const s0 = createInitialState({
      id: "g",
      seed: 12345,
      seats: [
        { name: "Alpha", kind: "bot", botDifficulty: "normal" },
        { name: "Beta", kind: "bot", botDifficulty: "normal" },
      ],
    });
    const s = driveBots(s0);
    // Either a winner was declared or the driver hit its safety cap.
    // Round should have advanced from 1.
    expect(s.round).toBeGreaterThan(1);
    // Phase should be a valid terminal or steady-state value.
    expect(["fees", "action", "market", "gameover"]).toContain(s.phase);
  });

  it("is deterministic — same seed yields the same end state", () => {
    const mk = () =>
      createInitialState({
        id: "g",
        seed: 42,
        seats: [
          { name: "A", kind: "bot", botDifficulty: "hard" },
          { name: "B", kind: "bot", botDifficulty: "hard" },
        ],
      });
    const a = driveBots(mk());
    const b = driveBots(mk());
    expect(a.round).toBe(b.round);
    expect(a.phase).toBe(b.phase);
    expect(a.demand).toBe(b.demand);
    expect(a.players.p1.cash).toBe(b.players.p1.cash);
    expect(a.players.p2.cash).toBe(b.players.p2.cash);
  });

  it("stops at a human decision point", () => {
    const s0 = createInitialState({
      id: "g",
      seed: 7,
      seats: [
        { name: "You", kind: "human" },
        { name: "Bot", kind: "bot", botDifficulty: "easy" },
      ],
    });
    const s = driveBots(s0);
    // The driver should stop at the Distillery draft for the human —
    // they need to pick before round 1's action phase begins.
    expect(s.phase).toBe("distillery_draft");
    expect(s.players.p1.kind).toBe("human");
    expect(s.players.p1.chosenDistilleryId).toBeUndefined();
    // The bot should already have confirmed (auto-pick = first dealt).
    expect(s.players.p2.chosenDistilleryId).toBeDefined();
  });

  it("market phase: drives a bot through draw + keep when it's the current player", () => {
    // Regression: previously the driver picked the next-unresolved player
    // via `playerOrder.find` rather than `currentPlayerId`. When the
    // human was earlier in seat order than the current bot (e.g. a bot
    // had passed first in the action phase, so `enterMarketPhase` set
    // currentPlayerId to that bot), the driver dispatched MARKET_DRAW
    // for the human — the reducer rejected it for a currentPlayerId
    // mismatch and the market phase soft-locked.
    const fresh = createInitialState({
      id: "g",
      seed: 100,
      seats: [
        { name: "You", kind: "human" },
        { name: "Clyde", kind: "bot", botDifficulty: "easy" },
      ],
    });

    // Manually engineer a market-phase state where currentPlayerId is a
    // bot (Clyde, p2) and the human (p1) is earlier in seat order. This
    // mirrors the live state after `enterMarketPhase` runs with
    // firstPasserId set to a bot.
    const market: GameState = {
      ...fresh,
      phase: "market",
      currentPlayerId: "p2",
      firstPasserId: "p2",
      actionPhase: {
        ...fresh.actionPhase,
        freeWindowActive: false,
        paidLapTier: 1,
        consecutivePasses: 2,
        passedPlayerIds: ["p2", "p1"],
        actionsThisLapPlayerIds: [],
      },
      marketPhase: {},
    };
    // Reset marketResolved on both players just in case.
    market.players = {
      p1: { ...fresh.players.p1, marketResolved: false },
      p2: { ...fresh.players.p2, marketResolved: false },
    };

    // Now drive — this is the path that used to soft-lock.
    const final = driveBots(market);

    // Bot fully resolved its market draw; control passed to the human.
    expect(final.players.p2.marketResolved).toBe(true);
    expect(final.players.p1.marketResolved).toBe(false);
    expect(final.currentPlayerId).toBe("p1");
    expect(final.phase).toBe("market");
  });
});
