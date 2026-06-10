import { describe, expect, it } from "vitest";
import {
  applyAction,
  createGame,
  matrixValue,
  rankPlayers,
  scorePlayer,
  houseStyleBonus,
  buildSlotCardSupply,
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

/**
 * Replace the demand row with a single all-open card whose red line is huge,
 * so the flood cliff never fires and any tag can always sell. Used by tests
 * that exercise placement / rewards rather than the flood engine itself.
 */
function openMarket(s: GameState, slots = 12): void {
  s.demandCards = [
    {
      id: "dm_test",
      defId: "dm_test",
      label: "Open Market",
      tag: "classic",
      slots: Array.from({ length: slots }, () => ({
        tagRestriction: "open" as const,
      })),
      blueCapacity: 0,
      redCapacity: 9999,
      placeholder: true,
    },
  ];
  s.blueLine = 0;
  s.redLine = 9999;
  s.cubesPlaced = 0;
}

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
    expression: over.expression ?? "bourbon",
    recipeTags: over.recipeTags ?? [],
    recipe: over.recipe ?? {},
    built: over.built ?? true,
    age: over.age ?? 3,
    quality: over.quality ?? "common",
    // Default to a single-sale batch so existing single-sale tests are
    // unchanged; setting batchQty alone also seeds salesRemaining.
    batchQty: over.batchQty ?? 1,
    salesRemaining: over.salesRemaining ?? over.batchQty ?? 1,
    matrix: over.matrix ?? [[0]],
    createdRound: over.createdRound ?? 0,
    ...over,
  };
}

/** A test brand line of `slotCount` empty flat-reward slots. */
function makeLine(slotCount: number, over: Partial<BrandLine> = {}): BrandLine {
  const slotCard: SlotCard = {
    id: "sc",
    defId: "sc",
    name: "Test Line",
    slots: Array.from({ length: slotCount }, () => ({
      reward: { kind: "flat" as const, reward: {} },
    })),
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

/** A real brand line built from one of the five frozen v2 slot-card designs. */
function lineFromDef(defId: string, id = "line1"): BrandLine {
  const card = buildSlotCardSupply().find((c) => c.defId === defId)!;
  return {
    id,
    slotCard: card,
    slots: card.slots.map(() => null),
    ageCeiling: null,
    marketingCards: [],
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
    expect(a.demand).toBe(CONFIG.DEMAND_START);
    expect(a.mashBillTray.length).toBe(CONFIG.MASH_BILL_TRAY_SIZE);
    // Solo: one demand card drawn, with positive flood lines.
    expect(a.demandCards.length).toBe(1);
    expect(a.redLine).toBeGreaterThan(a.blueLine);
    expect(a.cubesPlaced).toBe(0);
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
  it("commits matching resources to the communal discard and builds the resting barrel", () => {
    let s = createGame({ seed: 3 });
    // An UNBUILT barrel rests in the rickhouse showing the recipe it needs.
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "barrel", built: false, age: 0, recipe: { cask: 1, corn: 1 } }),
    ];
    s.players[0]!.hand = [
      { id: "c1", defId: "res_cask", kind: "cask", quality: "specialty", name: "cask", placeholder: true },
      { id: "g1", defId: "res_corn", kind: "corn", quality: "common", name: "corn", placeholder: true },
    ];
    const discardBefore = s.resourceDiscard.length;

    s = ok(s, {
      type: "MAKE_BOURBON",
      barrelId: "barrel",
      resourceCardIds: ["c1", "g1"],
    });

    const p = s.players[0]!;
    expect(p.rickhouse.length).toBe(1);
    const b = p.rickhouse[0]!;
    expect(b.built).toBe(true);
    expect(b.age).toBe(0); // aging starts now
    expect(p.hand.length).toBe(0);
    expect(s.resourceDiscard.length).toBe(discardBefore + 2);
    // Highest committed tier (specialty cask) sets quality.
    expect(b.quality).toBe("specialty");
  });

  it("refuses building when the committed resources don't satisfy the recipe", () => {
    const s = createGame({ seed: 3 });
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "barrel", built: false, age: 0, recipe: { cask: 2 } }),
    ];
    s.players[0]!.hand = [
      { id: "c1", defId: "res_cask", kind: "cask", quality: "common", name: "cask", placeholder: true },
    ];
    const reason = expectRefusal(s, {
      type: "MAKE_BOURBON",
      barrelId: "barrel",
      resourceCardIds: ["c1"],
    });
    expect(reason).toContain("needs 2 cask");
  });

  it("refuses building a barrel that is already built", () => {
    const s = createGame({ seed: 3 });
    s.players[0]!.rickhouse = [makeBourbon({ id: "barrel", built: true, recipe: {} })];
    const reason = expectRefusal(s, {
      type: "MAKE_BOURBON",
      barrelId: "barrel",
      resourceCardIds: [],
    });
    expect(reason).toContain("already built");
  });

  it("DRAW_MASH_BILLS refuses to lay a barrel when the rickhouse is full", () => {
    const s = createGame({ seed: 3 });
    // Capacity now comes from the rickhouse station's current tier.
    const cap = s.players[0]!.distillery.stations.find((st) => st.id === "rickhouse")!.levels[0]!;
    s.players[0]!.rickhouse = Array.from({ length: cap }, () => makeBourbon());
    const reason = expectRefusal(s, { type: "DRAW_MASH_BILLS", keepIndex: 0 });
    expect(reason).toContain("full");
  });

  it("DRAW_MASH_BILLS lays an unbuilt barrel that does not age", () => {
    let s = createGame({ seed: 3 });
    s.players[0]!.rickhouse = [];
    s = ok(s, { type: "DRAW_MASH_BILLS", keepIndex: 0 });
    const b = s.players[0]!.rickhouse[0]!;
    expect(b.built).toBe(false);
    expect(b.age).toBe(0);
    expect(Object.keys(b.recipe).length).toBeGreaterThan(0); // shows requirements
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
    openMarket(s); // flood-free: isolate placement/reward behavior from the cliff
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [makeBourbon({ id: "sellme", age, matrix })];
    return s;
  }

  it("refuses barrels under the minimum sell age", () => {
    const s = sellScenario(1, 4, [[0]]);
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "sellme",
      brandLineId: "line1",
      slotIndex: 0,
    });
    expect(reason).toContain("aged at least");
  });

  it("refuses selling a barrel that is not built yet", () => {
    const s = sellScenario(3, 4, [[0]]);
    s.players[0]!.rickhouse[0]!.built = false;
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "sellme",
      brandLineId: "line1",
      slotIndex: 0,
    });
    expect(reason).toContain("not built");
  });

  it("banks the age×demand matrix value and places the bottle (no flat cool)", () => {
    const matrix = [
      [0, 0, 0, 0, 0], // age 0
      [0, 0, 0, 0, 0], // age 1
      [0, 0, 0, 0, 0], // age 2
      [0, 0, 0, 0, 7], // age 3, demand 4 → 7
    ];
    const s = sellScenario(3, 4, matrix);
    const capBefore = s.players[0]!.capital;
    const out = ok(s, {
      type: "EXTRACT",
      bourbonId: "sellme",
      brandLineId: "line1",
      slotIndex: 0,
    });
    const p = out.players[0]!;
    expect(p.capital).toBe(capBefore + 7 + CONFIG.COMPLETION_BONUS);
    // One sale far below the (open-market) red line → no cliff, demand holds.
    expect(out.demand).toBe(4);
    expect(out.cubesPlaced).toBe(1);
    expect(p.rickhouse.length).toBe(0);
    expect(p.brandLines[0]!.slots[0]!.id).toBe("sellme");
    expect(p.bourbonsSold).toBe(1);
  });

  it("requires an eligible brand line before a sale can place", () => {
    const s = createGame({ seed: 5 });
    s.demand = 4;
    s.players[0]!.rickhouse = [makeBourbon({ id: "sellme", age: 3 })];
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "sellme",
      brandLineId: "nope",
      slotIndex: 0,
    });
    expect(reason).toContain("open a line");
  });

  it("refuses a slot index that is out of range", () => {
    const s = sellScenario(3, 4, [[0]]);
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "sellme",
      brandLineId: "line1",
      slotIndex: 9,
    });
    expect(reason).toContain("out of range");
  });

  it("refuses placing into an already-filled slot", () => {
    const s = sellScenario(3, 4, [[0]]);
    s.players[0]!.brandLines[0]!.slots[0] = makeBourbon({ id: "occupant", age: 3 });
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "sellme",
      brandLineId: "line1",
      slotIndex: 0,
    });
    expect(reason).toContain("already filled");
  });
});

// ------------------------------------------------------------------
// batch extraction (multi-sale): B1 + B7
// ------------------------------------------------------------------

describe("batch extraction (multi-sale)", () => {
  // A built, sellable batch with a flat matrix (every cell = 5) so each
  // extraction banks exactly 5 regardless of age/demand clamping.
  function batchScenario(batchQty: number): GameState {
    const s = createGame({ seed: 5 });
    s.demand = 4;
    openMarket(s); // flood-free: isolate the multi-sale loop from the cliff
    s.players[0]!.capital = 0;
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "batch", age: 3, batchQty, matrix: [[5]] }),
    ];
    return s;
  }

  it("intermediate extractions bank capital but don't cool demand or place a bottle", () => {
    let s = batchScenario(3);
    s = ok(s, { type: "EXTRACT", bourbonId: "batch" }); // 3 → 2
    let p = s.players[0]!;
    expect(p.capital).toBe(5);
    expect(s.demand).toBe(4); // NOT cooled
    expect(p.rickhouse.length).toBe(1); // still resting
    expect(p.rickhouse[0]!.salesRemaining).toBe(2);
    expect(p.brandLines[0]!.slots.every((x) => x === null)).toBe(true); // no bottle

    s = ok(s, { type: "EXTRACT", bourbonId: "batch" }); // 2 → 1, still intermediate
    p = s.players[0]!;
    expect(p.capital).toBe(10);
    expect(s.demand).toBe(4);
    expect(p.rickhouse[0]!.salesRemaining).toBe(1);
  });

  it("the final extraction pays the flat completion bonus, frees capacity, and places the bottle", () => {
    let s = batchScenario(2);
    s = ok(s, { type: "EXTRACT", bourbonId: "batch" }); // intermediate
    s = ok(s, {
      type: "EXTRACT",
      bourbonId: "batch",
      brandLineId: "line1",
      slotIndex: 0,
    }); // final
    const p = s.players[0]!;
    expect(p.capital).toBe(5 + 5 + CONFIG.COMPLETION_BONUS); // 2 sales + flat bonus
    // Demand cooling is the flood meter's job; below the red line it holds.
    expect(s.demand).toBe(4);
    expect(s.cubesPlaced).toBe(2); // both sales flooded the market
    expect(p.rickhouse.length).toBe(0); // slot freed
    expect(p.brandLines[0]!.slots[0]!.id).toBe("batch"); // bottle placed
    expect(p.bourbonsSold).toBe(2); // every extraction counts as a sale
  });

  it("dumping a whole batch at once earns the bonus only once (not per unit)", () => {
    // Sell all of a batchQty-3 batch in one round: 3×5 matrix + ONE bonus.
    let s = batchScenario(3);
    s = ok(s, { type: "EXTRACT", bourbonId: "batch" });
    s = ok(s, { type: "EXTRACT", bourbonId: "batch" });
    s = ok(s, { type: "EXTRACT", bourbonId: "batch", brandLineId: "line1", slotIndex: 0 });
    expect(s.players[0]!.capital).toBe(15 + CONFIG.COMPLETION_BONUS);
  });

  it("refuses a final extraction with no placement target", () => {
    let s = batchScenario(2);
    s = ok(s, { type: "EXTRACT", bourbonId: "batch" }); // down to salesRemaining 1
    const reason = expectRefusal(s, { type: "EXTRACT", bourbonId: "batch" });
    expect(reason).toContain("must be placed");
  });

  it("a single-sale batch (batchQty 1) sells and places in one extraction", () => {
    let s = batchScenario(1);
    s = ok(s, { type: "EXTRACT", bourbonId: "batch", brandLineId: "line1", slotIndex: 0 });
    const p = s.players[0]!;
    expect(p.capital).toBe(5 + CONFIG.COMPLETION_BONUS);
    expect(s.demand).toBe(4); // single sale, open market → no cliff
    expect(p.rickhouse.length).toBe(0);
    expect(p.brandLines[0]!.slots[0]!.id).toBe("batch");
  });

  it("a batch laid down from a mash bill carries its batchQty + derived tags", () => {
    let s = createGame({ seed: 3 });
    s.players[0]!.rickhouse = [];
    s = ok(s, { type: "DRAW_MASH_BILLS", keepIndex: 0 });
    const b = s.players[0]!.rickhouse[0]!;
    expect(b.batchQty).toBeGreaterThanOrEqual(1);
    expect(b.salesRemaining).toBe(b.batchQty);
    expect(b.recipeTags.length).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------
// demand flood engine (B2 + B3)
// ------------------------------------------------------------------

describe("demand flood engine", () => {
  /** A single broad (all-open) demand card with explicit flood lines. */
  function broadCard(blue: number, red: number) {
    return {
      id: "dm_x",
      defId: "dm_broad",
      label: "Broad",
      tag: "classic" as const,
      slots: Array.from({ length: 6 }, () => ({ tagRestriction: "open" as const })),
      blueCapacity: blue,
      redCapacity: red,
      placeholder: true as const,
    };
  }

  it("the cube reaching the red line drops demand immediately, and cashes at the reduced level", () => {
    const s = createGame({ seed: 5 });
    s.demand = 5;
    s.demandCards = [broadCard(1, 2)]; // red line 2 → the 2nd cube tips the cliff
    s.blueLine = 1;
    s.redLine = 2;
    s.cubesPlaced = 0;
    s.players[0]!.capital = 0;
    // age-3 row reads value == demand, so we can watch the cut land.
    const matrix = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0, 0, 0]);
    matrix[3] = [0, 1, 2, 3, 4, 5, 6];
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [makeBourbon({ id: "batch", age: 3, batchQty: 3, matrix })];

    // 1st cube < red → no cliff; banks at level 5.
    let out = ok(s, { type: "EXTRACT", bourbonId: "batch" });
    expect(out.demand).toBe(5);
    expect(out.players[0]!.capital).toBe(5);
    // 2nd cube === red → cliff fires BEFORE banking → level 4, banks 4.
    out = ok(out, { type: "EXTRACT", bourbonId: "batch" });
    expect(out.demand).toBe(4);
    expect(out.players[0]!.capital).toBe(5 + 4);
    expect(out.cubesPlaced).toBe(2);
  });

  it("dumping a whole batch in one round trips the cliff", () => {
    const s = createGame({ seed: 5 });
    s.demand = 6;
    s.demandCards = [broadCard(1, 3)]; // red 3 → the 3rd (final) cube tips it
    s.blueLine = 1;
    s.redLine = 3;
    s.cubesPlaced = 0;
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [makeBourbon({ id: "batch", age: 3, batchQty: 3, matrix: [[5]] })];
    let out = ok(s, { type: "EXTRACT", bourbonId: "batch" });
    out = ok(out, { type: "EXTRACT", bourbonId: "batch" });
    out = ok(out, { type: "EXTRACT", bourbonId: "batch", brandLineId: "line1", slotIndex: 0 });
    expect(out.demand).toBe(5); // dropped once at the cliff
  });

  it("Year Pass: underserved demand (cubes < blue) rises +1", () => {
    let s = createGame({ seed: 1 });
    s.demand = 5;
    s.players[0]!.actionsRemaining = 1; // end the round in one action
    s.actionsRemaining = 1;
    s.blueLine = 3;
    s.redLine = 6;
    s.cubesPlaced = 0; // underserved
    s = ok(s, { type: "DRAW_RESOURCES" }); // round 1 ends → Year Pass
    expect(s.roundNumber).toBe(2);
    expect(s.demand).toBe(6); // +1; round 1 is odd, so no global rise
  });

  it("Year Pass: a moderate flood (blue ≤ cubes < red) drops demand 1", () => {
    let s = createGame({ seed: 1 });
    s.demand = 5;
    s.players[0]!.actionsRemaining = 1;
    s.actionsRemaining = 1;
    s.blueLine = 1;
    s.redLine = 6;
    s.cubesPlaced = 3; // moderate
    s = ok(s, { type: "DRAW_RESOURCES" });
    expect(s.demand).toBe(4);
  });

  it("the global rising trend adds +1 on top of the band every DEMAND_RISE_EVERY rounds", () => {
    let s = createGame({ seed: 1 });
    s.roundNumber = 2; // even round → global rise fires at its Year Pass
    s.demand = 5;
    s.players[0]!.actionsRemaining = 1;
    s.actionsRemaining = 1;
    s.blueLine = 3;
    s.redLine = 6;
    s.cubesPlaced = 0; // underserved band +1
    s = ok(s, { type: "DRAW_RESOURCES" });
    expect(s.demand).toBe(7); // band +1 plus global rise +1
  });

  it("refuses a sale when the batch's style isn't demanded this round", () => {
    const s = createGame({ seed: 1 });
    s.demandCards = [
      {
        id: "d",
        defId: "dm_rye",
        label: "Rye",
        tag: "rye",
        slots: [{ tagRestriction: "rye" }, { tagRestriction: "rye" }],
        blueCapacity: 2,
        redCapacity: 3,
        placeholder: true,
      },
    ];
    s.blueLine = 2;
    s.redLine = 3;
    s.cubesPlaced = 0;
    s.players[0]!.brandLines = [makeLine(2)];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "w", age: 3, recipeTags: ["wheat"], matrix: [[5]] }),
    ];
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "w",
      brandLineId: "line1",
      slotIndex: 0,
    });
    expect(reason).toContain("no demand");
  });

  it("allows the sale when a matching focused card is on the table", () => {
    let s = createGame({ seed: 1 });
    s.demandCards = [
      {
        id: "d",
        defId: "dm_wheat",
        label: "Wheat",
        tag: "wheat",
        slots: [{ tagRestriction: "wheat" }, { tagRestriction: "wheat" }],
        blueCapacity: 2,
        redCapacity: 3,
        placeholder: true,
      },
    ];
    s.blueLine = 2;
    s.redLine = 3;
    s.cubesPlaced = 0;
    s.players[0]!.brandLines = [makeLine(2)];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "w", age: 3, recipeTags: ["wheat"], matrix: [[5]] }),
    ];
    s = ok(s, { type: "EXTRACT", bourbonId: "w", brandLineId: "line1", slotIndex: 0 });
    expect(s.players[0]!.brandLines[0]!.slots[0]!.id).toBe("w");
  });
});

// ------------------------------------------------------------------
// distillery stations (B4 + B5: rickhouse capacity, tasting, bottling)
// ------------------------------------------------------------------

describe("distillery stations", () => {
  function station(s: GameState, id: string) {
    return s.players[0]!.distillery.stations.find((st) => st.id === id)!;
  }

  it("BUILD_UPGRADE pays Capital and advances the station tier", () => {
    let s = createGame({ seed: 1 });
    s.players[0]!.capital = 10;
    const before = station(s, "rickhouse").builtTier;
    const cost = station(s, "rickhouse").costs[before + 1]!;
    s = ok(s, { type: "BUILD_UPGRADE", stationId: "rickhouse" });
    expect(station(s, "rickhouse").builtTier).toBe(before + 1);
    expect(s.players[0]!.capital).toBe(10 - cost);
  });

  it("refuses an upgrade the player can't afford", () => {
    const s = createGame({ seed: 1 });
    s.players[0]!.capital = 0;
    const reason = expectRefusal(s, { type: "BUILD_UPGRADE", stationId: "rickhouse" });
    expect(reason).toContain("costs");
  });

  it("refuses upgrading a fully-built station", () => {
    let s = createGame({ seed: 1 });
    s.players[0]!.capital = 100;
    const max = station(s, "tastingRoom").maxTier;
    while (station(s, "tastingRoom").builtTier < max) {
      s = ok(s, { type: "BUILD_UPGRADE", stationId: "tastingRoom" });
    }
    const reason = expectRefusal(s, { type: "BUILD_UPGRADE", stationId: "tastingRoom" });
    expect(reason).toContain("fully upgraded");
  });

  it("upgrading the rickhouse raises the barrel capacity", () => {
    let s = createGame({ seed: 3 });
    s.players[0]!.capital = 100;
    const base = station(s, "rickhouse").levels[0]!;
    s.players[0]!.rickhouse = Array.from({ length: base }, () => makeBourbon());
    // Full at the base tier → the draw is refused.
    expect(expectRefusal(s, { type: "DRAW_MASH_BILLS", keepIndex: 0 })).toContain("full");
    // Upgrade once → capacity grows, so the draw now succeeds.
    s = ok(s, { type: "BUILD_UPGRADE", stationId: "rickhouse" });
    s = ok(s, { type: "DRAW_MASH_BILLS", keepIndex: 0 });
    expect(s.players[0]!.rickhouse.length).toBe(base + 1);
  });

  it("the tasting room pays prestige on the final sale", () => {
    let s = createGame({ seed: 5 });
    openMarket(s);
    s.players[0]!.capital = 100;
    s = ok(s, { type: "BUILD_UPGRADE", stationId: "tastingRoom" }); // tier 1 → +1 prestige
    s.players[0]!.prestige = 0;
    s.players[0]!.brandLines = [makeLine(2)];
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 3, batchQty: 1, matrix: [[0]] })];
    s = ok(s, { type: "EXTRACT", bourbonId: "x", brandLineId: "line1", slotIndex: 0 });
    expect(s.players[0]!.prestige).toBe(1);
  });

  it("the bottling line raises the completion bonus", () => {
    let s = createGame({ seed: 5 });
    openMarket(s);
    s.players[0]!.capital = 100;
    s = ok(s, { type: "BUILD_UPGRADE", stationId: "bottling" }); // tier 1 → +1 bonus
    const bonus = CONFIG.COMPLETION_BONUS + station(s, "bottling").levels[1]!;
    s.players[0]!.capital = 0;
    s.players[0]!.brandLines = [makeLine(2)];
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 3, batchQty: 1, matrix: [[0]] })];
    s = ok(s, { type: "EXTRACT", bourbonId: "x", brandLineId: "line1", slotIndex: 0 });
    expect(s.players[0]!.capital).toBe(bonus); // matrix 0 + completion bonus
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
    // Young into slot 0; older into slot 1 to its right — non-decreasing.
    s = ok(s, { type: "EXTRACT", bourbonId: "young", brandLineId: "line1", slotIndex: 0 });
    s = ok(s, { type: "EXTRACT", bourbonId: "old", brandLineId: "line1", slotIndex: 1 });
    const slots = s.players[0]!.brandLines[0]!.slots;
    const ages = slots.map((b) => (b ? b.age : null));
    const filled = ages.filter((a): a is number => a !== null);
    const sorted = [...filled].sort((x, y) => x - y);
    expect(filled).toEqual(sorted); // non-decreasing
    expect(s.players[0]!.brandLines[0]!.ageCeiling).toBe(6);
  });

  it("refuses a placement that would violate L→R order (the staircase)", () => {
    let s = createGame({ seed: 7 });
    s.demand = 6;
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "old", age: 6, matrix: [[0]] }),
      makeBourbon({ id: "young", age: 2, matrix: [[0]] }),
    ];
    // Old anchored at slot 0 leaves no non-decreasing home for the younger
    // bottle to its right.
    s = ok(s, { type: "EXTRACT", bourbonId: "old", brandLineId: "line1", slotIndex: 0 });
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "young",
      brandLineId: "line1",
      slotIndex: 1,
    });
    expect(reason).toContain("staircase");
  });

  it("does not block 'bad' placements — a high-quality young bourbon still places", () => {
    let s = createGame({ seed: 7 });
    s.demand = 6;
    s.players[0]!.brandLines = [makeLine(3)];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "premium-young", age: 2, quality: "heritage", matrix: [[0]] }),
    ];
    s = ok(s, {
      type: "EXTRACT",
      bourbonId: "premium-young",
      brandLineId: "line1",
      slotIndex: 0,
    });
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
    line.slotCard.slots = [
      { reward: { kind: "flat", reward: { capital: 5, prestige: 2 } } },
      { reward: { kind: "flat", reward: {} } },
    ];
    s.players[0]!.brandLines = [line];
    s.players[0]!.capital = 0;
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 3, matrix: [[0]] })];
    const out = ok(s, {
      type: "EXTRACT",
      bourbonId: "x",
      brandLineId: "line1",
      slotIndex: 0,
    });
    const p = out.players[0]!;
    expect(p.capital).toBe(5 + CONFIG.COMPLETION_BONUS); // matrix 0 + slot 5 + final-sale bonus
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
    let out = ok(s, {
      type: "EXTRACT",
      bourbonId: "match",
      brandLineId: "line1",
      slotIndex: 0,
    });
    expect(out.players[0]!.prestige).toBe(3);
    out = ok(out, {
      type: "EXTRACT",
      bourbonId: "off",
      brandLineId: "line1",
      slotIndex: 1,
    });
    expect(out.players[0]!.prestige).toBe(3); // unchanged — off-trait fires nothing
  });
});

// ------------------------------------------------------------------
// the five frozen v2 slot-card designs
// ------------------------------------------------------------------

describe("Standard Line", () => {
  it("slot-5 choice pays the chosen branch (capital vs resources)", () => {
    const base = createGame({ seed: 7 });
    base.demand = 0;
    base.players[0]!.brandLines = [lineFromDef("slot_standard")];
    base.players[0]!.capital = 0;
    base.players[0]!.hand = [];
    base.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 6, matrix: [[0]] })];

    // Branch 0 → +2 capital.
    const cap = ok(base, {
      type: "EXTRACT",
      bourbonId: "x",
      brandLineId: "line1",
      slotIndex: 4,
      rewardChoice: 0,
    });
    expect(cap.players[0]!.capital).toBe(2 + CONFIG.COMPLETION_BONUS);
    expect(cap.players[0]!.hand.length).toBe(0);

    // Branch 1 → +5 resources to hand.
    const res = ok(base, {
      type: "EXTRACT",
      bourbonId: "x",
      brandLineId: "line1",
      slotIndex: 4,
      rewardChoice: 1,
    });
    expect(res.players[0]!.capital).toBe(0 + CONFIG.COMPLETION_BONUS);
    expect(res.players[0]!.hand.length).toBe(5);
  });

  it("the slot-5 anchor caps the line via the staircase", () => {
    let s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_standard")];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "young", age: 2, matrix: [[0]] }),
      makeBourbon({ id: "old", age: 6, matrix: [[0]] }),
    ];
    // Anchoring a young bottle in the final slot blocks older bottles to its left.
    s = ok(s, { type: "EXTRACT", bourbonId: "young", brandLineId: "line1", slotIndex: 4 });
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "old",
      brandLineId: "line1",
      slotIndex: 0,
    });
    expect(reason).toContain("staircase");
  });

  it("refuses a reward choice index out of range", () => {
    const s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_standard")];
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 6, matrix: [[0]] })];
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "x",
      brandLineId: "line1",
      slotIndex: 4,
      rewardChoice: 9,
    });
    expect(reason).toContain("reward choice");
  });
});

describe("Flagship Line", () => {
  it("slot 1 pays prestige equal to the bottle's age (uncapped)", () => {
    let s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_flagship")];
    s.players[0]!.prestige = 0;
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 9, matrix: [[0]] })];
    s = ok(s, { type: "EXTRACT", bourbonId: "x", brandLineId: "line1", slotIndex: 0 });
    expect(s.players[0]!.prestige).toBe(9);
  });

  it("optional prestige slots can be filled directly and pay their flat prestige", () => {
    let s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_flagship")];
    s.players[0]!.prestige = 0;
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 8, matrix: [[0]] })];
    // Slot index 4 is optional, prestige 5 — reachable with the others empty.
    s = ok(s, { type: "EXTRACT", bourbonId: "x", brandLineId: "line1", slotIndex: 4 });
    expect(s.players[0]!.prestige).toBe(5);
  });
});

describe("Expressions Line", () => {
  it("an optional slot refuses until its paired required is filled", () => {
    const s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_expressions")];
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 3, matrix: [[0]] })];
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "x",
      brandLineId: "line1",
      slotIndex: 1, // optional, paired to empty slot 0
    });
    expect(reason).toContain("paired");
  });

  it("an optional slot refuses an age that doesn't match the paired required", () => {
    let s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_expressions")];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "req", age: 2, matrix: [[0]] }),
      makeBourbon({ id: "opt", age: 4, matrix: [[0]] }),
    ];
    s = ok(s, { type: "EXTRACT", bourbonId: "req", brandLineId: "line1", slotIndex: 0 });
    const reason = expectRefusal(s, {
      type: "EXTRACT",
      bourbonId: "opt",
      brandLineId: "line1",
      slotIndex: 1,
    });
    expect(reason).toContain("match the paired");
  });

  it("an optional slot accepts a bottle matching the paired required's age", () => {
    let s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_expressions")];
    s.players[0]!.prestige = 0;
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "req", age: 3, matrix: [[0]] }),
      makeBourbon({ id: "opt", age: 3, matrix: [[0]] }),
    ];
    s = ok(s, { type: "EXTRACT", bourbonId: "req", brandLineId: "line1", slotIndex: 0 });
    s = ok(s, { type: "EXTRACT", bourbonId: "opt", brandLineId: "line1", slotIndex: 1 });
    expect(s.players[0]!.prestige).toBe(1); // slot 1 pays prestige 1
  });

  it("pays the +5 house-style bonus when all optionals share one differing expression", () => {
    const line = lineFromDef("slot_expressions");
    line.slots = [
      makeBourbon({ age: 2, expression: "bourbon" }),
      makeBourbon({ age: 2, expression: "rye" }),
      makeBourbon({ age: 4, expression: "bourbon" }),
      makeBourbon({ age: 4, expression: "rye" }),
      makeBourbon({ age: 6, expression: "bourbon" }),
      makeBourbon({ age: 6, expression: "rye" }),
    ];
    expect(houseStyleBonus(line)).toBe(5);
  });

  it("denies the house-style bonus when an optional matches its paired required", () => {
    const line = lineFromDef("slot_expressions");
    line.slots = [
      makeBourbon({ age: 2, expression: "rye" }),
      makeBourbon({ age: 2, expression: "rye" }), // matches paired → fail
      makeBourbon({ age: 4, expression: "bourbon" }),
      makeBourbon({ age: 4, expression: "rye" }),
      makeBourbon({ age: 6, expression: "bourbon" }),
      makeBourbon({ age: 6, expression: "rye" }),
    ];
    expect(houseStyleBonus(line)).toBe(0);
  });

  it("denies the house-style bonus when the optionals aren't all one expression", () => {
    const line = lineFromDef("slot_expressions");
    line.slots = [
      makeBourbon({ age: 2, expression: "bourbon" }),
      makeBourbon({ age: 2, expression: "rye" }),
      makeBourbon({ age: 4, expression: "bourbon" }),
      makeBourbon({ age: 4, expression: "wheated" }), // different from the others
      makeBourbon({ age: 6, expression: "bourbon" }),
      makeBourbon({ age: 6, expression: "rye" }),
    ];
    expect(houseStyleBonus(line)).toBe(0);
  });

  it("denies the house-style bonus when an optional slot is empty", () => {
    const line = lineFromDef("slot_expressions");
    line.slots = [
      makeBourbon({ age: 2, expression: "bourbon" }),
      null,
      makeBourbon({ age: 4, expression: "bourbon" }),
      makeBourbon({ age: 4, expression: "rye" }),
      makeBourbon({ age: 6, expression: "bourbon" }),
      makeBourbon({ age: 6, expression: "rye" }),
    ];
    expect(houseStyleBonus(line)).toBe(0);
  });

  it("scorePlayer folds the house-style bonus into prestige", () => {
    const s = createGame({ seed: 1 });
    const line = lineFromDef("slot_expressions");
    line.slots = [
      makeBourbon({ age: 2, expression: "bourbon" }),
      makeBourbon({ age: 2, expression: "rye" }),
      makeBourbon({ age: 4, expression: "bourbon" }),
      makeBourbon({ age: 4, expression: "rye" }),
      makeBourbon({ age: 6, expression: "bourbon" }),
      makeBourbon({ age: 6, expression: "rye" }),
    ];
    s.players[0]!.brandLines = [line];
    s.players[0]!.prestige = 1;
    const score = scorePlayer(s.players[0]!);
    expect(score.prestige).toBe(1 + 5);
  });
});

describe("Workhorse Line", () => {
  it("pays flat rewards regardless of slot position", () => {
    let s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.capital = 0;
    s.players[0]!.hand = [];
    s.players[0]!.brandLines = [lineFromDef("slot_workhorse")];
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "a", age: 2, matrix: [[0]] }),
      makeBourbon({ id: "b", age: 3, matrix: [[0]] }),
    ];
    s = ok(s, { type: "EXTRACT", bourbonId: "a", brandLineId: "line1", slotIndex: 0 }); // resources:1
    s = ok(s, { type: "EXTRACT", bourbonId: "b", brandLineId: "line1", slotIndex: 1 }); // capital:1
    expect(s.players[0]!.capital).toBe(1 + 2 * CONFIG.COMPLETION_BONUS); // slot capital + two final-sale bonuses
    expect(s.players[0]!.hand.length).toBe(1);
  });
});

describe("Single Barrel Line", () => {
  it("pays the hit reward when the gate passes", () => {
    let s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.capital = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_single_barrel")];
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 5, quality: "common", matrix: [[0]] })];
    s = ok(s, { type: "EXTRACT", bourbonId: "x", brandLineId: "line1", slotIndex: 0 });
    expect(s.players[0]!.capital).toBe(2 + CONFIG.COMPLETION_BONUS); // minAge 4 met → hit
  });

  it("pays the fallback (miss) when the gate fails, never blocking the sale", () => {
    let s = createGame({ seed: 7 });
    s.demand = 0;
    s.players[0]!.capital = 0;
    s.players[0]!.brandLines = [lineFromDef("slot_single_barrel")];
    // age 3 fails the minAge-4 gate but clears MIN_SELL_AGE, so it still sells.
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", age: 3, quality: "common", matrix: [[0]] })];
    s = ok(s, { type: "EXTRACT", bourbonId: "x", brandLineId: "line1", slotIndex: 0 });
    expect(s.players[0]!.capital).toBe(1 + CONFIG.COMPLETION_BONUS); // gate miss → fallback 1
  });

  it("the premium slot rewards a heritage bottle and falls back otherwise", () => {
    const heritage = createGame({ seed: 7 });
    heritage.demand = 0;
    heritage.players[0]!.capital = 0;
    heritage.players[0]!.brandLines = [lineFromDef("slot_single_barrel")];
    heritage.players[0]!.rickhouse = [
      makeBourbon({ id: "h", age: 6, quality: "heritage", matrix: [[0]] }),
    ];
    const hit = ok(heritage, {
      type: "EXTRACT",
      bourbonId: "h",
      brandLineId: "line1",
      slotIndex: 2,
    });
    expect(hit.players[0]!.capital).toBe(5 + CONFIG.COMPLETION_BONUS);

    const common = createGame({ seed: 7 });
    common.demand = 0;
    common.players[0]!.capital = 0;
    common.players[0]!.brandLines = [lineFromDef("slot_single_barrel")];
    common.players[0]!.rickhouse = [
      makeBourbon({ id: "c", age: 6, quality: "common", matrix: [[0]] }),
    ];
    const miss = ok(common, {
      type: "EXTRACT",
      bourbonId: "c",
      brandLineId: "line1",
      slotIndex: 2,
    });
    expect(miss.players[0]!.capital).toBe(2 + CONFIG.COMPLETION_BONUS);
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
      // Prefer draining the bill supply; keeping a bill rests a barrel, so
      // clear the rickhouse when it fills (and fall back to resources if the
      // keep is otherwise refused, e.g. an empty tray).
      const res = applyAction(s, { type: "DRAW_MASH_BILLS", keepIndex: 0 });
      if (res.ok) {
        s = res.state;
      } else {
        s.players[s.currentPlayerIndex]!.rickhouse = [];
        s = ok(s, { type: "DRAW_RESOURCES" });
      }
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
