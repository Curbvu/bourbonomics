import { describe, expect, it } from "vitest";
import {
  applyAction,
  createGame,
  improvementCost,
  matrixValue,
  rankPlayers,
  scorePlayer,
  CONFIG,
} from "../src/index";
import type { Action, Bourbon, GameState, Player, ResourceKind } from "../src/types";

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

/** Advance Demand → Collect → Play, claiming nothing through the collect pass. */
function intoPlay(s: GameState): GameState {
  s = ok(s, { type: "BEGIN_COLLECT" });
  for (let i = 0; i < s.players.length; i++) {
    if (s.roundPhase !== "collect") break;
    s = ok(s, { type: "COLLECT_CLAIM", claims: [] });
  }
  expect(s.roundPhase).toBe("play");
  return s;
}

function dept(p: Player, id: string) {
  return p.distillery.departments.find((d) => d.id === id)!;
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
    staged: over.staged ?? [],
    built: over.built ?? true,
    age: over.age ?? 3,
    quality: over.quality ?? "common",
    batchQty: over.batchQty ?? 1,
    salesRemaining: over.salesRemaining ?? over.batchQty ?? 1,
    matrix: over.matrix ?? [[0]],
    createdRound: over.createdRound ?? 0,
    ...over,
  };
}

function totalDiscard(s: GameState): number {
  return (Object.keys(s.pileDiscards) as ResourceKind[]).reduce(
    (sum, k) => sum + s.pileDiscards[k].length,
    0,
  );
}

// ------------------------------------------------------------------
// setup
// ------------------------------------------------------------------

describe("setup", () => {
  it("creates a deterministic game in the Demand Phase with demand laid out", () => {
    const a = createGame({ seed: 42 });
    const b = createGame({ seed: 42 });
    expect(a).toEqual(b);

    expect(a.phase).toBe("playing");
    expect(a.roundPhase).toBe("demand");
    expect(a.players).toHaveLength(1);
    expect(a.demandCards.length).toBe(1); // marketing level 0 → 1 card
    expect(a.demand).toBeGreaterThan(0);
    expect(a.collect).toBeNull();
    expect(a.mashBillSupply.length).toBeGreaterThan(0);
  });

  it("seeds five non-empty piles with blind quality within each", () => {
    const s = createGame({ seed: 7 });
    for (const k of ["cask", "corn", "rye", "wheat", "barley"] as ResourceKind[]) {
      expect(s.piles[k].length).toBe(CONFIG.PILE_COUNTS[k]);
      expect(s.piles[k].every((c) => c.kind === k)).toBe(true);
      expect(s.piles[k].some((c) => c.quality === "specialty")).toBe(true);
    }
  });
});

// ------------------------------------------------------------------
// phase machine
// ------------------------------------------------------------------

describe("phase machine", () => {
  it("BEGIN_COLLECT moves Demand → Collect and rolls the first player's dice", () => {
    let s = createGame({ seed: 1 });
    s = ok(s, { type: "BEGIN_COLLECT" });
    expect(s.roundPhase).toBe("collect");
    expect(s.collect).not.toBeNull();
    expect(s.collect!.dice.length).toBe(dept(s.players[0]!, "supply").values[0]);
  });

  it("refuses play actions during the Demand Phase", () => {
    const s = createGame({ seed: 1 });
    expect(expectRefusal(s, { type: "DRAW_MASH_BILLS", keepIndexes: [] })).toMatch(/Play Phase/);
  });

  it("a claim-nothing pass through Collect lands in the Play Phase", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    expect(s.roundPhase).toBe("play");
    expect(s.currentPlayerIndex).toBe(s.startPlayerIndex);
  });

  it("END_TURN by every player ends the round, ages barrels, and re-lays demand", () => {
    let s = createGame({ seed: 1, playerNames: ["A", "B"] });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [makeBourbon({ age: 2 })];
    s.players[1]!.rickhouse = [makeBourbon({ age: 0, built: false })]; // unbuilt: won't age
    s = ok(s, { type: "END_TURN" });
    expect(s.roundPhase).toBe("play"); // still B's turn
    s = ok(s, { type: "END_TURN" });
    expect(s.roundNumber).toBe(2);
    expect(s.roundPhase).toBe("demand"); // new round laid out
    expect(s.players[0]!.rickhouse[0]!.age).toBe(3); // built barrel aged +1
    expect(s.players[1]!.rickhouse[0]!.age).toBe(0); // unbuilt held at 0
  });
});

// ------------------------------------------------------------------
// Collect Phase — dice draft
// ------------------------------------------------------------------

describe("collect dice draft", () => {
  it("claims a typed die and an 'anything' die (pile-chosen), respecting Warehouse cap", () => {
    let s = createGame({ seed: 3 });
    s = ok(s, { type: "BEGIN_COLLECT" });
    const d0 = s.collect!.dice[0]!;
    const d1 = s.collect!.dice[1]!;
    d0.face = "rye";
    d1.face = "anything";
    s = ok(s, {
      type: "COLLECT_CLAIM",
      claims: [{ dieId: d0.id }, { dieId: d1.id, pile: "wheat" }],
    });
    const hand = s.players[0]!.hand;
    expect(hand.length).toBe(2);
    expect(hand.filter((c) => c.kind === "rye").length).toBe(1);
    expect(hand.filter((c) => c.kind === "wheat").length).toBe(1);
    expect(s.roundPhase).toBe("play"); // solo: pass complete
  });

  it("refuses claiming beyond the Warehouse cap", () => {
    let s = createGame({ seed: 3 });
    s = ok(s, { type: "BEGIN_COLLECT" });
    const cap = dept(s.players[0]!, "warehouse").values[0]!;
    s.players[0]!.hand = Array.from({ length: cap }, (_, i) => ({
      id: `h${i}`,
      defId: "x",
      kind: "cask" as const,
      quality: "common" as const,
      name: "x",
      placeholder: true as const,
    }));
    const die = s.collect!.dice[0]!;
    die.face = "cask";
    expect(expectRefusal(s, { type: "COLLECT_CLAIM", claims: [{ dieId: die.id }] })).toMatch(
      /Warehouse holds/,
    );
  });

  it("refuses an 'anything' die claimed without a pile", () => {
    let s = createGame({ seed: 3 });
    s = ok(s, { type: "BEGIN_COLLECT" });
    const die = s.collect!.dice[0]!;
    die.face = "anything";
    expect(expectRefusal(s, { type: "COLLECT_CLAIM", claims: [{ dieId: die.id }] })).toMatch(
      /needs a pile/,
    );
  });

  it("rerolls chosen dice once, and refuses a second reroll without a Supply upgrade", () => {
    let s = createGame({ seed: 5 });
    s = ok(s, { type: "BEGIN_COLLECT" });
    expect(s.collect!.maxRerolls).toBe(1);
    const id = s.collect!.dice[0]!.id;
    s = ok(s, { type: "COLLECT_REROLL", diceIds: [id] });
    expect(s.collect!.rerollsUsed).toBe(1);
    expect(expectRefusal(s, { type: "COLLECT_REROLL", diceIds: [id] })).toMatch(/no rerolls left/);
  });

  it("a Supply upgrade grants a second reroll", () => {
    let s = createGame({ seed: 5 });
    dept(s.players[0]!, "supply").level = 1; // upgraded
    s = ok(s, { type: "BEGIN_COLLECT" });
    expect(s.collect!.maxRerolls).toBe(2);
  });

  it("most-Capital-first sets the collect pass order", () => {
    let s = createGame({ seed: 5, playerNames: ["A", "B"] });
    s.players[0]!.capital = 1;
    s.players[1]!.capital = 9; // B richer → goes first
    s = ok(s, { type: "BEGIN_COLLECT" });
    expect(s.collect!.order[0]).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
  });

  it("passes unclaimed dice to the next player as inheritance", () => {
    let s = createGame({ seed: 5, playerNames: ["A", "B"] });
    s.players[0]!.capital = 9; // A first
    s.players[1]!.capital = 0;
    s = ok(s, { type: "BEGIN_COLLECT" });
    const firstDice = s.collect!.dice.length;
    s = ok(s, { type: "COLLECT_CLAIM", claims: [] }); // A passes all dice
    expect(s.currentPlayerIndex).toBe(1);
    expect(s.collect!.dice.length).toBeGreaterThanOrEqual(firstDice);
  });
});

// ------------------------------------------------------------------
// Draw Mash Bills
// ------------------------------------------------------------------

describe("draw mash bills", () => {
  it("reveals Distilling-Office-many bills and keeps the chosen ones as resting barrels", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    const office = dept(s.players[0]!, "mashFloor").values[0]!;
    const supplyBefore = s.mashBillSupply.length;
    s = ok(s, { type: "DRAW_MASH_BILLS", keepIndexes: [0] });
    const p = s.players[0]!;
    expect(p.rickhouse.length).toBe(1);
    expect(p.rickhouse[0]!.built).toBe(false);
    expect(p.rickhouse[0]!.age).toBe(0);
    expect(s.mashBillSupply.length).toBe(supplyBefore - 1); // one kept drains the clock
    expect(office).toBeGreaterThanOrEqual(2);
  });

  it("is once per turn", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s = ok(s, { type: "DRAW_MASH_BILLS", keepIndexes: [] });
    expect(expectRefusal(s, { type: "DRAW_MASH_BILLS", keepIndexes: [] })).toMatch(/already drawn/);
  });

  it("refuses keeping more bills than the rickhouse can hold", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    const cap = dept(s.players[0]!, "rickhouse").values[0]!;
    s.players[0]!.rickhouse = Array.from({ length: cap }, () => makeBourbon());
    expect(expectRefusal(s, { type: "DRAW_MASH_BILLS", keepIndexes: [0] })).toMatch(/room for/);
  });

  it("resets the once-per-turn gate on the next round", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s = ok(s, { type: "DRAW_MASH_BILLS", keepIndexes: [] });
    s = ok(s, { type: "END_TURN" }); // round ends (solo) → new round
    s = intoPlay(s);
    expect(s.players[0]!.drewMashBillsThisTurn).toBe(false);
    s = ok(s, { type: "DRAW_MASH_BILLS", keepIndexes: [] });
    expect(s.players[0]!.drewMashBillsThisTurn).toBe(true);
  });
});

// ------------------------------------------------------------------
// Make Bourbon
// ------------------------------------------------------------------

describe("make bourbon", () => {
  it("commits the exact recipe, builds the barrel, and sets quality from the best card", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "barrel", built: false, age: 0, recipe: { cask: 1, corn: 1 } }),
    ];
    s.players[0]!.hand = [
      { id: "c1", defId: "x", kind: "cask", quality: "specialty", name: "cask", placeholder: true },
      { id: "g1", defId: "x", kind: "corn", quality: "common", name: "corn", placeholder: true },
    ];
    const before = totalDiscard(s);
    s = ok(s, { type: "MAKE_BOURBON", barrelId: "barrel", resourceCardIds: ["c1", "g1"] });
    const b = s.players[0]!.rickhouse[0]!;
    expect(b.built).toBe(true);
    expect(b.age).toBe(0);
    expect(b.quality).toBe("specialty");
    expect(s.players[0]!.hand.length).toBe(0);
    expect(totalDiscard(s)).toBe(before + 2);
  });

  it("refuses when the committed resources don't satisfy the recipe", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [makeBourbon({ id: "barrel", built: false, recipe: { cask: 2 } })];
    s.players[0]!.hand = [
      { id: "c1", defId: "x", kind: "cask", quality: "common", name: "cask", placeholder: true },
    ];
    expect(
      expectRefusal(s, { type: "MAKE_BOURBON", barrelId: "barrel", resourceCardIds: ["c1"] }),
    ).toContain("needs 2 cask");
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
    expect(matrixValue(m, 99, 99)).toBe(5);
    expect(matrixValue(m, -5, -5)).toBe(0);
  });
});

// ------------------------------------------------------------------
// Sell (Extract)
// ------------------------------------------------------------------

describe("sell", () => {
  function sellScenario(over: Partial<Bourbon> = {}): GameState {
    let s = createGame({ seed: 5 });
    s = intoPlay(s);
    s.demand = 4;
    s.players[0]!.capital = 0;
    s.players[0]!.rickhouse = [makeBourbon({ id: "sellme", age: 3, ...over })];
    return s;
  }

  it("refuses barrels under the minimum sell age", () => {
    const s = sellScenario({ age: 1 });
    expect(expectRefusal(s, { type: "SELL", bourbonId: "sellme" })).toContain("aged at least");
  });

  it("refuses selling an unbuilt barrel", () => {
    const s = sellScenario({ built: false });
    expect(expectRefusal(s, { type: "SELL", bourbonId: "sellme" })).toContain("not built");
  });

  it("banks the age×demand matrix value plus the Distribution bonus", () => {
    const matrix = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 7], // age 3, demand 4 → 7
    ];
    let s = sellScenario({ matrix });
    dept(s.players[0]!, "distribution").level = 1;
    const bonus = dept(s.players[0]!, "distribution").values[1]!;
    s = ok(s, { type: "SELL", bourbonId: "sellme" });
    const p = s.players[0]!;
    expect(p.capital).toBe(7 + bonus + CONFIG.COMPLETION_BONUS);
    expect(p.rickhouse.length).toBe(0);
    expect(p.bourbonsSold).toBe(1);
  });

  it("a multi-sale batch keeps resting until the final sale frees the slot", () => {
    let s = sellScenario({ batchQty: 2, matrix: [[5]] });
    // Distribution pays its base bonus on every sale.
    const dist = dept(s.players[0]!, "distribution").values[0]!;
    s = ok(s, { type: "SELL", bourbonId: "sellme" }); // intermediate
    let p = s.players[0]!;
    expect(p.capital).toBe(5 + dist);
    expect(p.rickhouse.length).toBe(1);
    expect(p.rickhouse[0]!.salesRemaining).toBe(1);
    s = ok(s, { type: "SELL", bourbonId: "sellme" }); // final
    p = s.players[0]!;
    expect(p.capital).toBe(10 + 2 * dist + CONFIG.COMPLETION_BONUS);
    expect(p.rickhouse.length).toBe(0);
  });
});

// ------------------------------------------------------------------
// Staging onto resting barrels
// ------------------------------------------------------------------

describe("staging", () => {
  it("stages a recipe-matched card off the Warehouse and builds from it", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "barrel", built: false, age: 0, recipe: { cask: 1, corn: 1 } }),
    ];
    s.players[0]!.hand = [
      { id: "c1", defId: "x", kind: "cask", quality: "specialty", name: "cask", placeholder: true },
      { id: "g1", defId: "x", kind: "corn", quality: "common", name: "corn", placeholder: true },
    ];
    s = ok(s, { type: "STAGE", barrelId: "barrel", resourceCardId: "c1" });
    expect(s.players[0]!.hand.length).toBe(1); // staged card left the hand
    expect(s.players[0]!.rickhouse[0]!.staged.length).toBe(1);
    // Build using the remaining loose card + the staged one.
    s = ok(s, { type: "MAKE_BOURBON", barrelId: "barrel", resourceCardIds: ["g1"] });
    const b = s.players[0]!.rickhouse[0]!;
    expect(b.built).toBe(true);
    expect(b.quality).toBe("specialty"); // best of staged + loose
    expect(b.staged.length).toBe(0);
  });

  it("refuses staging a card the recipe doesn't need", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "barrel", built: false, recipe: { cask: 1 } }),
    ];
    s.players[0]!.hand = [
      { id: "r1", defId: "x", kind: "rye", quality: "common", name: "rye", placeholder: true },
    ];
    expect(
      expectRefusal(s, { type: "STAGE", barrelId: "barrel", resourceCardId: "r1" }),
    ).toContain("doesn't need");
  });
});

// ------------------------------------------------------------------
// Improve Distillery — linear ramp + discounts
// ------------------------------------------------------------------

describe("improve distillery", () => {
  it("charges the linear ramp and advances the department level", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    s.players[0]!.capital = 10;
    const first = improvementCost(0);
    s = ok(s, { type: "IMPROVE", departmentId: "warehouse" });
    expect(dept(s.players[0]!, "warehouse").level).toBe(1);
    expect(s.players[0]!.capital).toBe(10 - first);
    expect(s.players[0]!.improvements).toBe(1);
  });

  it("each improvement costs more than the last (the ramp)", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    s.players[0]!.capital = 100;
    const c0 = s.players[0]!.capital;
    s = ok(s, { type: "IMPROVE", departmentId: "warehouse" });
    const spent1 = c0 - s.players[0]!.capital;
    const c1 = s.players[0]!.capital;
    s = ok(s, { type: "IMPROVE", departmentId: "supply" });
    const spent2 = c1 - s.players[0]!.capital;
    expect(spent2).toBeGreaterThan(spent1);
  });

  it("refuses an improvement the player can't afford", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    s.players[0]!.capital = 0;
    expect(expectRefusal(s, { type: "IMPROVE", departmentId: "warehouse" })).toContain("costs");
  });

  it("refuses improving a fully-grown department", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    s.players[0]!.capital = 1000;
    const max = dept(s.players[0]!, "distribution").maxLevel;
    for (let i = 0; i < max; i++) s = ok(s, { type: "IMPROVE", departmentId: "distribution" });
    expect(expectRefusal(s, { type: "IMPROVE", departmentId: "distribution" })).toContain(
      "fully grown",
    );
  });

  it("a distillery discount makes its cheap path cost less than the base ramp", () => {
    const base = improvementCost(0, 0);
    const discounted = improvementCost(0, 1);
    expect(discounted).toBeLessThan(base);
    const s = createGame({ seed: 1, distilleryIds: ["oldoak"] });
    expect(dept(s.players[0]!, "distribution").discount).toBe(1);
  });
});

// ------------------------------------------------------------------
// asymmetric distilleries (signatures)
// ------------------------------------------------------------------

describe("asymmetric distilleries", () => {
  // Every sale also banks the Distribution base bonus; isolate the signature.
  const DIST = createGame({ seed: 1 }).players[0]!.distillery.departments.find(
    (d) => d.id === "distribution",
  )!.values[0]!;

  function sellWith(distilleryId: string, over: Partial<Bourbon>): Player {
    let s = createGame({ seed: 5, distilleryIds: [distilleryId] });
    s = intoPlay(s);
    s.demand = 0;
    s.players[0]!.capital = 0;
    s.players[0]!.prestige = 0;
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", matrix: [[0]], ...over })];
    return ok(s, { type: "SELL", bourbonId: "x" }).players[0]!;
  }

  it("volumeBonus pays +Capital on every sale", () => {
    expect(sellWith("ironhill", { batchQty: 2 }).capital).toBe(DIST + CONFIG.VOLUME_BONUS);
  });

  it("ryeBonus pays only on rye batches", () => {
    expect(sellWith("ryerevival", { batchQty: 2, recipeTags: ["rye"] }).capital).toBe(
      DIST + CONFIG.RYE_BONUS,
    );
    expect(sellWith("ryerevival", { batchQty: 2, recipeTags: ["wheat"] }).capital).toBe(DIST);
  });

  it("agedPrestige pays prestige completing a well-aged batch only", () => {
    expect(sellWith("oldoak", { age: CONFIG.AGED_PRESTIGE_MIN_AGE }).prestige).toBe(
      CONFIG.AGED_PRESTIGE,
    );
    expect(sellWith("oldoak", { age: 3 }).prestige).toBe(0);
  });

  it("assigns the chosen distillery per player", () => {
    const s = createGame({
      seed: 1,
      playerNames: ["A", "B"],
      distilleryIds: ["ryerevival", "ironhill"],
    });
    expect(s.players[0]!.distillery.distilleryId).toBe("ryerevival");
    expect(s.players[1]!.distillery.distilleryId).toBe("ironhill");
  });
});

// ------------------------------------------------------------------
// the clock + scoring
// ------------------------------------------------------------------

describe("clock and scoring", () => {
  it("scorePlayer totals capital + prestige (converted)", () => {
    const s = createGame({ seed: 1 });
    s.players[0]!.capital = 12;
    s.players[0]!.prestige = 3;
    const sc = scorePlayer(s.players[0]!);
    expect(sc.total).toBe(12 + 3 * CONFIG.PRESTIGE_TO_CAPITAL_RATE);
  });

  it("ranks players high→low, tiebreak by bourbons sold", () => {
    const s = createGame({ seed: 1, playerNames: ["A", "B"] });
    s.players[0]!.capital = 5;
    s.players[1]!.capital = 5;
    s.players[1]!.bourbonsSold = 2;
    expect(rankPlayers(s)[0]!.name).toBe("B");
  });

  it("empties the supply over play and ends one round later", () => {
    let s = createGame({ seed: 2 });
    s = intoPlay(s);
    // Leave exactly Distilling-Office-many bills, then KEEP them all so the
    // supply drains (rejected bills cycle back, so keeping nothing won't empty it).
    const office = dept(s.players[0]!, "mashFloor").values[0]!;
    s.mashBillSupply = s.mashBillSupply.slice(0, office);
    s = ok(s, {
      type: "DRAW_MASH_BILLS",
      keepIndexes: Array.from({ length: office }, (_, i) => i),
    });
    expect(s.mashBillSupply.length).toBe(0);
    expect(s.finalRound).toBe(s.roundNumber + 1);
    s = ok(s, { type: "END_TURN" }); // round ends → next (final) round
    expect(s.roundPhase).toBe("demand");
    s = intoPlay(s);
    s = ok(s, { type: "END_TURN" }); // final round completes
    expect(s.phase).toBe("ended");
    expect(s.log.some((l) => l.includes("Game over"))).toBe(true);
  });
});
