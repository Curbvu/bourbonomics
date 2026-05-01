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

  it("speakeasy_tipoff pays $4 at demand>=4, $1 otherwise", () => {
    const hi = game();
    hi.demand = 5;
    const beforeHi = hi.players.p1.cash;
    resolveOperationsEffect(hi, "p1", "speakeasy_tipoff");
    expect(hi.players.p1.cash - beforeHi).toBe(4);

    const lo = game();
    lo.demand = 3;
    const beforeLo = lo.players.p1.cash;
    resolveOperationsEffect(lo, "p1", "speakeasy_tipoff");
    expect(lo.players.p1.cash - beforeLo).toBe(1);
  });

  it("distillers_bonus scales with barrel count, capped at 8", () => {
    const s = game();
    // Seed 10 barrels across rickhouses for p1.
    const ricks = s.rickhouses;
    let placed = 0;
    for (const h of ricks) {
      while (h.barrels.length < h.capacity && placed < 10) {
        h.barrels.push({
          barrelId: `b${placed}`,
          ownerId: "p1",
          rickhouseId: h.id,
          mash: [],
          mashBillId: "test-bill",
          age: 0,
          barreledOnRound: 1,
        });
        placed++;
      }
      if (placed >= 10) break;
    }
    const before = s.players.p1.cash;
    resolveOperationsEffect(s, "p1", "distillers_bonus");
    expect(s.players.p1.cash - before).toBe(8);
  });

  it("coopers_gift pays $4 when the player is thin on barrels", () => {
    const s = game();
    const before = s.players.p1.cash;
    resolveOperationsEffect(s, "p1", "coopers_gift");
    expect(s.players.p1.cash - before).toBe(4);
  });

  it("insurance_payout pays $2 per rickhouse where the player has no barrel (capped)", () => {
    const s = game();
    const before = s.players.p1.cash;
    resolveOperationsEffect(s, "p1", "insurance_payout");
    // All 6 rickhouses empty → 6 × $2 = $12, capped at $6.
    expect(s.players.p1.cash - before).toBe(6);
  });

  it("late_shipment draws 2 resource cards into the hand", () => {
    const s = game();
    const before = s.players.p1.resourceHand.length;
    resolveOperationsEffect(s, "p1", "late_shipment");
    expect(s.players.p1.resourceHand.length - before).toBe(2);
  });

  it("state_fair_demo pays $6 on odd demand, $3 on even", () => {
    const odd = game();
    odd.demand = 5;
    const beforeOdd = odd.players.p1.cash;
    resolveOperationsEffect(odd, "p1", "state_fair_demo");
    expect(odd.players.p1.cash - beforeOdd).toBe(6);

    const even = game();
    even.demand = 6;
    const beforeEven = even.players.p1.cash;
    resolveOperationsEffect(even, "p1", "state_fair_demo");
    expect(even.players.p1.cash - beforeEven).toBe(3);
  });
});
