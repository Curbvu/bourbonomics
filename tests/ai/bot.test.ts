import { describe, expect, it } from "vitest";
import { createInitialState } from "@/lib/engine/setup";
import { driveBots } from "@/lib/ai/driver";

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
    // Game starts in Round 1 action phase, with the human (p1) up first.
    // The driver should stop on the human's turn.
    expect(s.phase).toBe("action");
    expect(s.currentPlayerId).toBe("p1");
    expect(s.players.p1.kind).toBe("human");
  });
});
