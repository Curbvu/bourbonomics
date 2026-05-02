import { describe, expect, it } from "vitest";
import { feesForPlayer, totalFeesForPlayer } from "@/lib/rules/fees";
import { createInitialState } from "@/lib/engine/setup";
import type { GameState } from "@/lib/engine/state";

function gs() {
  return createInitialState({
    id: "g1",
    seed: 1,
    seats: [
      { name: "Alice", kind: "human" },
      { name: "Bot", kind: "bot", botDifficulty: "easy" },
    ],
  });
}

function placeBarrel(state: GameState, ownerId: string, rickhouseIdx: number, age: number) {
  const r = state.rickhouses[rickhouseIdx];
  r.barrels.push({
    barrelId: `b-${r.id}-${r.barrels.length}`,
    ownerId,
    rickhouseId: r.id,
    mash: [],
    mashBillId: "test-bill",
    age,
    barreledOnRound: 1,
  });
}

// Capacities per current rules: Northern 3, Louisville 5, Central 4, Lexington 5, Bardstown 6, Western 3.
// rickhouse-4 (Bardstown) is the cap-6 rickhouse for monopoly tests.

describe("rickhouse fees", () => {
  it("rent equals total barrels in the rickhouse", () => {
    const s = gs();
    placeBarrel(s, "p1", 1, 0); // Louisville (cap 5): p1 has 1 barrel
    placeBarrel(s, "p2", 1, 0); // p2 has 1 barrel — total 2
    const fees = feesForPlayer(s, "p1");
    expect(fees).toHaveLength(1);
    expect(fees[0].amount).toBe(2); // 2 barrels in the rickhouse
    expect(totalFeesForPlayer(s, "p1")).toBe(2);
  });

  it("multiple barrels in one rickhouse pay for each", () => {
    const s = gs();
    for (let i = 0; i < 3; i++) placeBarrel(s, "p1", 1, 0); // 3 of p1 in Louisville
    expect(totalFeesForPlayer(s, "p1")).toBe(9); // 3 barrels × 3 rent each
  });

  it("monopoly on the cap-6 rickhouse waives all rent for that house", () => {
    const s = gs();
    // rickhouse-4 is the cap-6 Bardstown.
    for (let i = 0; i < 6; i++) placeBarrel(s, "p1", 4, 0);
    placeBarrel(s, "p1", 1, 0); // p1 has one elsewhere too
    const fees = feesForPlayer(s, "p1");
    const bardstown = fees.filter((f) => f.rickhouseId === "rickhouse-4");
    expect(bardstown.every((f) => f.amount === 0 && f.monopolyWaived)).toBe(true);
    const louisville = fees.filter((f) => f.rickhouseId === "rickhouse-1");
    expect(louisville).toHaveLength(1);
    expect(louisville[0].amount).toBe(1); // only p1's 1 barrel in Louisville
  });

  it("monopoly waiver is voided if the rickhouse is not full", () => {
    const s = gs();
    for (let i = 0; i < 5; i++) placeBarrel(s, "p1", 4, 0); // 5/6, not full
    const fees = feesForPlayer(s, "p1");
    expect(fees.every((f) => !f.monopolyWaived)).toBe(true);
    expect(fees[0].amount).toBe(5);
  });

  it("monopoly waiver does not apply to non-cap-6 rickhouses", () => {
    const s = gs();
    // rickhouse-1 is the cap-5 Louisville. Fill it entirely with one player.
    for (let i = 0; i < 5; i++) placeBarrel(s, "p1", 1, 0);
    const fees = feesForPlayer(s, "p1");
    expect(fees.every((f) => !f.monopolyWaived)).toBe(true);
    expect(fees[0].amount).toBe(5);
  });
});
