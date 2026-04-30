import { describe, expect, it } from "vitest";
import {
  applyActionCostDiscount,
  applyMarketBuyBonus,
  applyRickhouseFeeDiscount,
} from "@/lib/modifiers/investment";
import type { Player } from "@/lib/engine/state";

function player(investments: Player["investments"]): Player {
  return {
    id: "p1",
    name: "A",
    kind: "human",
    seatIndex: 0,
    cash: 20,
    resourceHand: [],
    bourbonHand: [],
    investments,
    operations: [],
    silverAwards: [],
    goldAwards: [],
    eliminated: false,
    marketResolved: false,
    hasTakenPaidActionThisRound: false,
    loanOutstanding: false,
    loanUsed: false,
  };
}

describe("investment modifiers", () => {
  it("active rickhouse_fee_discount reduces total by the modifier amount", () => {
    const p = player([
      {
        instanceId: "i1",
        cardId: "inv_rickhouse",
        status: "active",
        usedThisRound: false,
      },
    ]);
    const r = applyRickhouseFeeDiscount(p, 5);
    expect(r.total).toBe(4);
    r.consume();
    expect(p.investments[0].usedThisRound).toBe(true);
    // Already used → no further discount.
    const again = applyRickhouseFeeDiscount(p, 5);
    expect(again.total).toBe(5);
  });

  it("floor at 0 — discount never makes fees negative", () => {
    const p = player([
      {
        instanceId: "i1",
        cardId: "inv_rickhouse",
        status: "active",
        usedThisRound: false,
      },
    ]);
    const r = applyRickhouseFeeDiscount(p, 0);
    expect(r.total).toBe(0);
  });

  it("unbuilt investments do NOT apply", () => {
    const p = player([
      {
        instanceId: "i2",
        cardId: "inv_rickhouse",
        status: "unbuilt",
        usedThisRound: false,
      },
    ]);
    const r = applyRickhouseFeeDiscount(p, 5);
    expect(r.total).toBe(5);
  });

  it("action cost discount applies only on first paid action when scope=per_round_first_paid", () => {
    const p = player([
      {
        instanceId: "i1",
        cardId: "inv_climate",
        status: "active",
        usedThisRound: false,
      },
    ]);
    const first = applyActionCostDiscount(p, 2, true);
    expect(first.cost).toBe(1);
    first.consume();
    const next = applyActionCostDiscount(p, 2, true);
    expect(next.cost).toBe(2); // already used
  });

  it("market buy bonus returns extra cards and consumes the flag", () => {
    const p = player([
      {
        instanceId: "i1",
        cardId: "inv_corn_futures",
        status: "active",
        usedThisRound: false,
      },
    ]);
    const r = applyMarketBuyBonus(p);
    expect(r.extraCards).toBe(1);
    r.consume();
    expect(p.investments[0].usedThisRound).toBe(true);
  });
});
