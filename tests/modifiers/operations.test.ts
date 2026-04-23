import { describe, expect, it } from "vitest";
import { resolveOperationsEffect } from "@/lib/modifiers/operations";
import { createInitialState } from "@/lib/engine/setup";

function game() {
  return createInitialState({
    id: "g",
    seed: 1,
    seats: [
      { name: "A", kind: "human" },
      { name: "B", kind: "bot", botDifficulty: "easy" },
    ],
  });
}

describe("operations card effects", () => {
  it("county_rebate pays $2 at low demand, $6 at demand >= 6", () => {
    const low = game();
    low.demand = 3;
    const startLow = low.players.p1.cash;
    resolveOperationsEffect(low, "p1", "county_rebate");
    expect(low.players.p1.cash - startLow).toBe(2);

    const high = game();
    high.demand = 8;
    const startHigh = high.players.p1.cash;
    resolveOperationsEffect(high, "p1", "county_rebate");
    expect(high.players.p1.cash - startHigh).toBe(6);
  });

  it("unknown card returns resolved: false", () => {
    const s = game();
    const r = resolveOperationsEffect(s, "p1", "does_not_exist");
    expect(r.resolved).toBe(false);
  });

  it("fire_sale discards a resource and pays $6", () => {
    const s = game();
    const p = s.players.p1;
    const before = p.cash;
    // Give the player a resource card.
    p.resourceHand.push({ instanceId: "r-test", resource: "corn", specialtyId: null });
    const r = resolveOperationsEffect(s, "p1", "fire_sale");
    expect(r.resolved).toBe(true);
    expect(p.cash - before).toBe(6);
    expect(p.resourceHand.length).toBe(0);
  });
});
