import { describe, expect, it } from "vitest";
import {
  applyAction,
  createGame,
  matrixValue,
  rankPlayers,
  CONFIG,
} from "../src/index";
import type {
  Action,
  Bourbon,
  BrandLine,
  GameState,
  ResourceCard,
  SlotCard,
} from "../src/types";

// ------------------------------------------------------------------
// helpers
// ------------------------------------------------------------------

function ok(state: GameState, action: Action): GameState {
  const res = applyAction(state, action);
  if (!res.ok) throw new Error(`expected ok, got refusal: ${res.reason}`);
  return res.state;
}

function expectRefusal(state: GameState, action: Action): string {
  const res = applyAction(state, action);
  expect(res.ok).toBe(false);
  return res.ok ? "" : res.reason;
}

function makeBourbon(over: Partial<Bourbon> = {}): Bourbon {
  return {
    id: over.id ?? `b_${Math.random().toString(36).slice(2)}`,
    mashBillId: "mb",
    name: over.name ?? "Test Bourbon",
    traits: over.traits ?? [],
    age: over.age ?? 3,
    quality: over.quality ?? "common",
    matrix: over.matrix ?? [[0]],
    createdRound: over.createdRound ?? 0,
    ...over,
  };
}

function makeLine(slotCount: number, over: Partial<BrandLine> = {}): BrandLine {
  const slotCard: SlotCard = {
    id: "sc",
    defId: "sc",
    name: "Test Line",
    slotRewards: Array.from({ length: slotCount }, () => ({ capital: 0, prestige: 0 })),
    ageCeilings: Array.from({ length: slotCount }, () => 99),
    placeholder: true,
  };
  return {
    id: over.id ?? "line1",
    slotCard,
    slots: Array.from({ length: slotCount }, () => null),
    ageCeiling: null,
    marketingCards: [],
    ...over,
  };
}

function resourceOf(state: GameState, kind: ResourceCard["kind"]): ResourceCard | undefined {
  return state.players[0]!.hand.find((c) => c.kind === kind);
}

// ------------------------------------------------------------------
// setup
// ------------------------------------------------------------------

describe("setup", () => {
  it("creates a deterministic, playable initial state", () => {
    const a = createGame({ seed: 42 });
    const b = createGame({ seed: 42 });
    expect(a).toEqual(b); // same seed → identical game

    expect(a.phase).toBe("playing");
    expect(a.players).toHaveLength(1);
    expect(a.demand).toBe(0);
    expect(a.mashBillTray.length).toBe(CONFIG.MASH_BILL_TRAY_SIZE);
    expect(a.demandForecast.length).toBe(CONFIG.FORECAST_VISIBLE);
    expect(a.players[0]!.actionsRemaining).toBe(CONFIG.ACTIONS_PER_ROUND);
  });
});

// ------------------------------------------------------------------
// turn loop / round advance
// ------------------------------------------------------------------

describe("round-robin turn loop", () => {
  it("consumes one action per pass and advances the round when spent", () => {
    let s = createGame({ seed: 1 });
    expect(s.roundNumber).toBe(1);
    for (let i = 0; i < CONFIG.ACTIONS_PER_ROUND; i++) {
      expect(s.players[0]!.actionsRemaining).toBe(CONFIG.ACTIONS_PER_ROUND - i);
      s = ok(s, { type: "DRAW_RESOURCES" });
    }
    // After 6 actions in a solo game the round rolls over.
    expect(s.roundNumber).toBe(2);
    expect(s.players[0]!.actionsRemaining).toBe(CONFIG.ACTIONS_PER_ROUND);
  });

  it("alternates players round-robin in a hot-seat game", () => {
    let s = createGame({ seed: 1, playerNames: ["A", "B"] });
    expect(s.currentPlayerIndex).toBe(0);
    s = ok(s, { type: "DRAW_RESOURCES" });
    expect(s.currentPlayerIndex).toBe(1);
    s = ok(s, { type: "DRAW_RESOURCES" });
    expect(s.currentPlayerIndex).toBe(0);
    expect(s.players[0]!.actionsRemaining).toBe(CONFIG.ACTIONS_PER_ROUND - 1);
  });

  it("ages every barrel by one at end of round", () => {
    let s = createGame({ seed: 1 });
    s.players[0]!.rickhouse = [makeBourbon({ age: 0 })];
    for (let i = 0; i < CONFIG.ACTIONS_PER_ROUND; i++) {
      s = ok(s, { type: "DRAW_RESOURCES" });
    }
    expect(s.players[0]!.rickhouse[0]!.age).toBe(1);
  });
});

// ------------------------------------------------------------------
// communal resource pool
// ------------------------------------------------------------------

describe("communal resource pool", () => {
  it("reshuffles the discard when the deck empties", () => {
    let s = createGame({ seed: 1 });
    const sample = s.resourceDeck.slice(0, 5);
    s.resourceDeck = sample.slice(0, 2);
    s.resourceDiscard = sample.slice(2); // 3 cards waiting to be reshuffled
    s = ok(s, { type: "DRAW_RESOURCES" }); // draws 3 → forces a reshuffle
    expect(s.players[0]!.hand.length).toBe(3);
    expect(s.log.some((l) => l.includes("reshuffled"))).toBe(true);
  });
});

// ------------------------------------------------------------------
// face-up resource market (pick 3 of 8)
// ------------------------------------------------------------------

describe("resource market", () => {
  it("deals a full face-up market at setup", () => {
    const s = createGame({ seed: 7 });
    expect(s.resourceMarket.length).toBe(CONFIG.RESOURCE_MARKET_SIZE);
  });

  it("takes the chosen cards into hand and refills from the deck", () => {
    let s = createGame({ seed: 7 });
    const picks = s.resourceMarket.slice(0, CONFIG.RESOURCE_DRAW_COUNT);
    const pickIds = picks.map((c) => c.id);
    s = ok(s, { type: "TAKE_MARKET_RESOURCES", cardIds: pickIds });

    // Picked cards are now in hand.
    expect(s.players[0]!.hand.map((c) => c.id)).toEqual(
      expect.arrayContaining(pickIds),
    );
    expect(s.players[0]!.hand.length).toBe(CONFIG.RESOURCE_DRAW_COUNT);
    // Market refilled back to full, and no longer holds the taken cards.
    expect(s.resourceMarket.length).toBe(CONFIG.RESOURCE_MARKET_SIZE);
    for (const id of pickIds) {
      expect(s.resourceMarket.some((c) => c.id === id)).toBe(false);
    }
  });

  it("refuses the wrong number of picks", () => {
    const s = createGame({ seed: 7 });
    const tooFew = s.resourceMarket.slice(0, 2).map((c) => c.id);
    expect(expectRefusal(s, { type: "TAKE_MARKET_RESOURCES", cardIds: tooFew })).toMatch(
      /select exactly/,
    );
  });

  it("refuses ids that are not in the market", () => {
    const s = createGame({ seed: 7 });
    const ids = s.resourceMarket.slice(0, 2).map((c) => c.id);
    expect(
      expectRefusal(s, {
        type: "TAKE_MARKET_RESOURCES",
        cardIds: [...ids, "not_a_real_card"],
      }),
    ).toMatch(/not in the market/);
  });
});

// ------------------------------------------------------------------
// make bourbon / rickhouse cap
// ------------------------------------------------------------------

describe("make bourbon", () => {
  it("commits matching resources to the communal discard and rests a barrel", () => {
    let s = createGame({ seed: 3 });
    // Give the player a simple bill and a matching hand.
    const bill = s.mashBillTray[0]!; // recipe varies; build a hand to match it
    s.players[0]!.mashBills = [bill];
    s.players[0]!.hand = [];
    const hand: ResourceCard[] = [];
    let n = 0;
    for (const kind of ["cask", "corn", "grain"] as const) {
      for (let i = 0; i < (bill.recipe[kind] ?? 0); i++) {
        hand.push({
          id: `h${n++}`,
          defId: `res_${kind}`,
          kind,
          quality: kind === "cask" ? "specialty" : "common",
          name: kind,
          placeholder: true,
        });
      }
    }
    s.players[0]!.hand = hand;
    const discardBefore = s.resourceDiscard.length;

    s = ok(s, {
      type: "MAKE_BOURBON",
      mashBillId: bill.id,
      resourceCardIds: hand.map((c) => c.id),
    });

    const p = s.players[0]!;
    expect(p.rickhouse.length).toBe(1);
    expect(p.rickhouse[0]!.age).toBe(0);
    expect(p.hand.length).toBe(0);
    expect(s.resourceDiscard.length).toBe(discardBefore + hand.length);
    // Highest committed tier (specialty cask) sets quality.
    expect(p.rickhouse[0]!.quality).toBe("specialty");
  });

  it("enforces the hard rickhouse capacity", () => {
    const s = createGame({ seed: 3 });
    const bill = s.mashBillTray[0]!;
    s.players[0]!.mashBills = [bill];
    s.players[0]!.rickhouse = Array.from({ length: CONFIG.RICKHOUSE_CAPACITY }, () =>
      makeBourbon(),
    );
    s.players[0]!.hand = [
      { id: "x", defId: "res_corn", kind: "corn", quality: "common", name: "corn", placeholder: true },
    ];
    const reason = expectRefusal(s, {
      type: "MAKE_BOURBON",
      mashBillId: bill.id,
      resourceCardIds: ["x"],
    });
    expect(reason).toContain("full");
  });
});

// ------------------------------------------------------------------
// matrix lookup
// ------------------------------------------------------------------

describe("matrix lookup", () => {
  it("clamps out-of-range age/demand to the grid edges", () => {
    const m = [
      [0, 1, 2],
      [3, 4, 5],
    ];
    expect(matrixValue(m, 1, 2)).toBe(5);
    expect(matrixValue(m, 99, 99)).toBe(5); // clamp high
    expect(matrixValue(m, -5, -5)).toBe(0); // clamp low
  });
});

// ------------------------------------------------------------------
// selling
// ------------------------------------------------------------------

describe("selling", () => {
  function sellScenario(age: number, demand: number, matrix: number[][]) {
    const s = createGame({ seed: 5 });
    s.demand = demand;
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [makeBourbon({ id: "sellme", age, matrix })];
    return s;
  }

  it("refuses barrels under the minimum sell age", () => {
    const s = sellScenario(1, 4, [[0]]);
    const reason = expectRefusal(s, { type: "SELL_BOURBON", bourbonId: "sellme" });
    expect(reason).toContain("aged at least");
  });

  it("banks the age×demand matrix value, drops demand, and places the bottle", () => {
    const matrix = [
      [0, 0, 0, 0, 0], // age 0
      [0, 0, 0, 0, 0], // age 1
      [0, 0, 0, 0, 0], // age 2
      [0, 0, 0, 0, 7], // age 3, demand 4 → 7
    ];
    const s = sellScenario(3, 4, matrix);
    const capBefore = s.players[0]!.capital;
    const out = ok(s, { type: "SELL_BOURBON", bourbonId: "sellme" });
    const p = out.players[0]!;
    expect(p.capital).toBe(capBefore + 7);
    expect(out.demand).toBe(3); // dropped by 1
    expect(p.rickhouse.length).toBe(0);
    expect(p.brandLines[0]!.slots[0]!.id).toBe("sellme");
    expect(p.bourbonsSold).toBe(1);
  });

  it("requires an eligible brand line before a sale can place", () => {
    const s = createGame({ seed: 5 });
    s.demand = 4;
    s.players[0]!.rickhouse = [makeBourbon({ id: "sellme", age: 3 })];
    const reason = expectRefusal(s, { type: "SELL_BOURBON", bourbonId: "sellme" });
    expect(reason).toContain("open a line");
  });
});

// ------------------------------------------------------------------
// brand-line placement order (forgiving, non-decreasing L→R)
// ------------------------------------------------------------------

describe("brand-line placement", () => {
  it("keeps ages non-decreasing left→right and sets the ceiling to the max", () => {
    let s = createGame({ seed: 7 });
    s.demand = 6;
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "old", age: 6, matrix: [[0]] }),
      makeBourbon({ id: "young", age: 2, matrix: [[0]] }),
    ];
    // Young sells into slot 0; the older one then anchors slot 1 to its right.
    s = ok(s, { type: "SELL_BOURBON", bourbonId: "young" });
    s = ok(s, { type: "SELL_BOURBON", bourbonId: "old" });
    const slots = s.players[0]!.brandLines[0]!.slots;
    const ages = slots.map((b) => (b ? b.age : null));
    const filled = ages.filter((a): a is number => a !== null);
    const sorted = [...filled].sort((x, y) => x - y);
    expect(filled).toEqual(sorted); // non-decreasing
    expect(s.players[0]!.brandLines[0]!.ageCeiling).toBe(6);
  });

  it("refuses (rather than breaks) a placement that would violate L→R order", () => {
    let s = createGame({ seed: 7 });
    s.demand = 6;
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "old", age: 6, matrix: [[0]] }),
      makeBourbon({ id: "young", age: 2, matrix: [[0]] }),
    ];
    // Greedy auto-place: old lands in slot 0, leaving no non-decreasing
    // home for the younger bottle.
    s = ok(s, { type: "SELL_BOURBON", bourbonId: "old" });
    const reason = expectRefusal(s, { type: "SELL_BOURBON", bourbonId: "young" });
    expect(reason).toContain("no eligible");
  });

  it("does not block 'bad' placements — a high-quality young bourbon still places", () => {
    let s = createGame({ seed: 7 });
    s.demand = 6;
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "premium-young", age: 2, quality: "heritage", matrix: [[0]] }),
    ];
    s = ok(s, { type: "SELL_BOURBON", bourbonId: "premium-young" });
    expect(s.players[0]!.brandLines[0]!.slots[0]!.id).toBe("premium-young");
  });
});

// ------------------------------------------------------------------
// slot + marketing rewards
// ------------------------------------------------------------------

describe("slot and marketing rewards", () => {
  it("fires the printed slot reward on placement", () => {
    const s = createGame({ seed: 9 });
    s.demand = 5;
    const line = makeLine(2);
    line.slotCard.slotRewards = [
      { capital: 5, prestige: 2 },
      { capital: 0 },
    ];
    s.players[0]!.brandLines = [line];
    s.players[0]!.capital = 0;
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 3, matrix: [[0]] })];
    const out = ok(s, { type: "SELL_BOURBON", bourbonId: "x" });
    const p = out.players[0]!;
    expect(p.capital).toBe(5); // matrix 0 + slot capital 5
    expect(p.prestige).toBe(2);
  });

  it("fires trait-matched marketing and ignores off-trait bourbons", () => {
    const s = createGame({ seed: 9 });
    s.demand = 5;
    const line = makeLine(2);
    line.marketingCards = [
      {
        id: "m1",
        defId: "m1",
        name: "Rye Ads",
        requiredTraits: ["rye-heavy"],
        exclusiveGroup: "grain",
        prestigeOnMatch: 3,
        placeholder: true,
      },
    ];
    s.players[0]!.brandLines = [line];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "match", age: 3, traits: ["rye-heavy"], matrix: [[0]] }),
      makeBourbon({ id: "off", age: 3, traits: ["wheated"], matrix: [[0]] }),
    ];
    let out = ok(s, { type: "SELL_BOURBON", bourbonId: "match" });
    expect(out.players[0]!.prestige).toBe(3);
    out = ok(out, { type: "SELL_BOURBON", bourbonId: "off" });
    expect(out.players[0]!.prestige).toBe(3); // unchanged — off-trait fires nothing
  });
});

// ------------------------------------------------------------------
// marketing draw rules
// ------------------------------------------------------------------

describe("marketing draw", () => {
  function withLine(seed: number): GameState {
    const s = createGame({ seed });
    s.players[0]!.brandLines = [makeLine(2)];
    return s;
  }

  it("first marketing draw is free, subsequent draws cost capital", () => {
    let s = withLine(11);
    s.players[0]!.capital = 1;
    s = ok(s, { type: "DRAW_MARKETING", keepIndex: 0, brandLineId: "line1" });
    expect(s.players[0]!.usedFreeMarketing).toBe(true);
    expect(s.players[0]!.capital).toBe(1); // free
    // Second attach (different exclusive group needed) costs capital.
    // Find a tray card whose group differs from the attached one.
    const attachedGroup = s.players[0]!.brandLines[0]!.marketingCards[0]!.exclusiveGroup;
    const idx = s.marketingTray.findIndex((c) => c.exclusiveGroup !== attachedGroup);
    expect(idx).toBeGreaterThanOrEqual(0);
    s = ok(s, { type: "DRAW_MARKETING", keepIndex: idx, brandLineId: "line1" });
    expect(s.players[0]!.capital).toBe(0); // paid 1
  });

  it("enforces mutual exclusivity within a line", () => {
    let s = withLine(12);
    s.players[0]!.capital = 10;
    const first = s.marketingTray[0]!;
    s = ok(s, { type: "DRAW_MARKETING", keepIndex: 0, brandLineId: "line1" });
    const conflictIdx = s.marketingTray.findIndex(
      (c) => c.exclusiveGroup === first.exclusiveGroup,
    );
    if (conflictIdx >= 0) {
      const reason = expectRefusal(s, {
        type: "DRAW_MARKETING",
        keepIndex: conflictIdx,
        brandLineId: "line1",
      });
      expect(reason).toContain("conflicting");
    }
  });

  it("enforces the marketing stack cap", () => {
    const s = withLine(13);
    const line = s.players[0]!.brandLines[0]!;
    line.marketingCards = Array.from({ length: CONFIG.MARKETING_STACK_CAP }, (_, i) => ({
      id: `cap${i}`,
      defId: `cap${i}`,
      name: "x",
      requiredTraits: [],
      exclusiveGroup: `g${i}`,
      prestigeOnMatch: 1,
      placeholder: true,
    }));
    s.players[0]!.capital = 10;
    const reason = expectRefusal(s, {
      type: "DRAW_MARKETING",
      keepIndex: 0,
      brandLineId: "line1",
    });
    expect(reason).toContain("cap");
  });
});

// ------------------------------------------------------------------
// opening lines (escalating cost)
// ------------------------------------------------------------------

describe("opening brand lines", () => {
  it("charges an escalating capital cost per additional line", () => {
    let s = createGame({ seed: 15 });
    s.players[0]!.capital = 10;
    s = ok(s, { type: "DRAW_SLOT_CARD" });
    s = ok(s, { type: "DRAW_SLOT_CARD" });
    const slot1 = s.players[0]!.slotCards[0]!.id;
    const capStart = s.players[0]!.capital;
    s = ok(s, { type: "OPEN_BRAND_LINE", slotCardId: slot1 });
    expect(s.players[0]!.capital).toBe(capStart - 1); // first line: base 1
    const slot2 = s.players[0]!.slotCards[0]!.id;
    s = ok(s, { type: "OPEN_BRAND_LINE", slotCardId: slot2 });
    expect(s.players[0]!.capital).toBe(capStart - 1 - 2); // second line: 2
  });
});

// ------------------------------------------------------------------
// end condition + scoring
// ------------------------------------------------------------------

describe("end of game", () => {
  it("a full solo game runs to completion when bills run out", () => {
    let s = createGame({ seed: 21 });
    let guard = 0;
    while (s.phase === "playing" && guard < 1000) {
      guard++;
      // Prefer draining the bill supply; fall back to resources when it empties.
      const res = applyAction(s, { type: "DRAW_MASH_BILLS", keepIndex: 0 });
      s = res.ok ? res.state : ok(s, { type: "DRAW_RESOURCES" });
    }
    expect(s.phase).toBe("ended");
    expect(s.finalRound).not.toBeNull();
    expect(s.log.some((l) => l.includes("Game over"))).toBe(true);
  });

  it("scores capital + converted prestige, tiebreaks on bourbons sold", () => {
    const s = createGame({ seed: 1, playerNames: ["A", "B"] });
    s.players[0]!.capital = 10;
    s.players[0]!.prestige = 0;
    s.players[0]!.bourbonsSold = 1;
    s.players[1]!.capital = 8;
    s.players[1]!.prestige = 2; // 8 + 2 = 10, tie on total
    s.players[1]!.bourbonsSold = 5;
    const ranked = rankPlayers(s);
    expect(ranked[0]!.total).toBe(10);
    expect(ranked[1]!.total).toBe(10);
    // Tie broken by bourbons sold → B first.
    expect(ranked[0]!.name).toBe("B");
  });
});
