import { describe, expect, it } from "vitest";
import {
  applyAction,
  barrelValue,
  batchQtyForRecipe,
  buildMashBillSupply,
  createGame,
  improvementCost,
  meetsRequirement,
  rankPlayers,
  reputationOf,
  saleBonusForRecipe,
  scorePlayer,
  zoneForCardCount,
  zoneMultiplier,
  CONFIG,
} from "../src/index";
import type {
  Action,
  Bourbon,
  DemandCard,
  GameState,
  Player,
  ResourceKind,
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

/** Advance Demand → Collect → Play, claiming nothing through the collect pass. */
function intoPlay(s: GameState): GameState {
  s = ok(s, { type: "BEGIN_COLLECT" });
  for (let i = 0; i < s.players.length + 1; i++) {
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
    styleTag: over.styleTag ?? "classic",
    recipe: over.recipe ?? {},
    staged: over.staged ?? [],
    built: over.built ?? true,
    age: over.age ?? 3,
    quality: over.quality ?? "common",
    batchQty: over.batchQty ?? 1,
    saleBonus: over.saleBonus ?? 0,
    salesRemaining: over.salesRemaining ?? over.batchQty ?? 1,
    createdRound: over.createdRound ?? 0,
    maturationBoosted: over.maturationBoosted ?? false,
    ...over,
  };
}

function makeDemandCard(over: Partial<DemandCard> = {}): DemandCard {
  const slotsActive = over.slotsActive ?? 1;
  return {
    id: over.id ?? "dm_test",
    defId: over.defId ?? "dm_test",
    label: over.label ?? "Test Order",
    requirement: over.requirement ?? {},
    slotMultiple: over.slotMultiple ?? 1,
    slotsActive,
    filledBy: over.filledBy ?? Array.from({ length: slotsActive }, () => null),
    zoneBonus: over.zoneBonus ?? { low: 2, mid: 4, high: 6 },
    reputation: over.reputation ?? 3,
    placeholder: true,
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
  it("creates a deterministic game in the Demand Phase with the market laid out", () => {
    const a = createGame({ seed: 42 });
    const b = createGame({ seed: 42 });
    expect(a).toEqual(b);

    expect(a.phase).toBe("playing");
    expect(a.roundPhase).toBe("demand");
    expect(a.demandCards.length).toBe(CONFIG.DEMAND_DRAW_PER_ROUND);
    expect(a.collect).toBeNull();
    expect(a.mashBillSupply.length).toBeGreaterThan(0);
    expect(a.players[0]!.capital).toBe(CONFIG.STARTING_CAPITAL);
  });

  it("seeds five non-empty piles with blind quality within each", () => {
    const s = createGame({ seed: 7 });
    for (const k of ["cask", "corn", "rye", "wheat", "barley"] as ResourceKind[]) {
      expect(s.piles[k].length).toBe(CONFIG.PILE_COUNTS[k]);
      expect(s.piles[k].every((c) => c.kind === k)).toBe(true);
      expect(s.piles[k].some((c) => c.quality === "uncommon")).toBe(true);
      expect(s.piles[k].some((c) => c.quality !== "common")).toBe(true);
    }
  });

  it("activates demand slots as a multiple of the player count", () => {
    for (const n of [2, 4, 6]) {
      const g = createGame({ seed: 1, playerNames: Array.from({ length: n }, (_, i) => `p${i}`) });
      for (const c of g.demandCards) {
        expect(c.filledBy.length).toBe(c.slotMultiple * n);
        expect(c.filledBy.length % n).toBe(0); // always a whole player-share
      }
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
    expect(s.collect!.dice.length).toBe(dept(s.players[0]!, "supply").values[0]);
  });

  it("refuses play actions during the Demand Phase", () => {
    const s = createGame({ seed: 1 });
    expect(expectRefusal(s, { type: "DRAW_MASH_BILLS", keepIndexes: [] })).toMatch(/Play Phase/);
  });

  it("a claim-nothing pass through Collect lands in the Play Phase", () => {
    let s = createGame({ seed: 1, playerNames: ["A", "B", "C"] });
    s = intoPlay(s);
    expect(s.roundPhase).toBe("play");
    expect(s.currentPlayerIndex).toBe(s.startPlayerIndex);
  });

  it("END_TURN by every player ends the round, ages barrels, and re-lays demand", () => {
    let s = createGame({ seed: 1, playerNames: ["A", "B"] });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [makeBourbon({ age: 2 })];
    s.players[1]!.rickhouse = [makeBourbon({ age: 0, built: false })];
    s = ok(s, { type: "END_TURN" });
    expect(s.roundPhase).toBe("play"); // still B's turn
    s = ok(s, { type: "END_TURN" });
    expect(s.roundNumber).toBe(2);
    expect(s.roundPhase).toBe("demand");
    expect(s.players[0]!.rickhouse[0]!.age).toBe(3); // built barrel aged +1
    expect(s.players[1]!.rickhouse[0]!.age).toBe(0); // unbuilt held at 0
  });
});

// ------------------------------------------------------------------
// demand market — zones & crash
// ------------------------------------------------------------------

describe("demand market", () => {
  it("computes zones by the number of cards on the table", () => {
    expect(zoneForCardCount(1)).toBe("low");
    expect(zoneForCardCount(4)).toBe("low");
    expect(zoneForCardCount(5)).toBe("mid");
    expect(zoneForCardCount(7)).toBe("mid");
    expect(zoneForCardCount(8)).toBe("high");
    expect(zoneForCardCount(9)).toBe("high");
  });

  it("crashes at the 10th card: a draw that would reach 10 wipes the table", () => {
    let s = createGame({ seed: 4 });
    // Stuff the table to 8; drawing 2 next round would reach 10 → crash.
    s.demandCards = Array.from({ length: 8 }, (_, i) => makeDemandCard({ id: `c${i}` }));
    s = intoPlay(s);
    s = ok(s, { type: "END_TURN" }); // round ends → next Demand Phase draws 2
    expect(s.demandCards.length).toBe(CONFIG.DEMAND_DRAW_PER_ROUND); // reset market
    expect(zoneForCardCount(s.demandCards.length)).toBe("low");
    expect(s.log.some((l) => l.includes("MARKET CRASH"))).toBe(true);
  });

  it("partially-filled cards persist on the table and still count", () => {
    let s = createGame({ seed: 4, playerNames: ["A", "B"] });
    const card = makeDemandCard({ id: "persist", slotsActive: 2 });
    card.filledBy[0] = "p1"; // one slot filled, not complete
    s.demandCards = [card];
    s = intoPlay(s);
    s = ok(s, { type: "END_TURN" });
    s = ok(s, { type: "END_TURN" });
    expect(s.demandCards.some((c) => c.id === "persist")).toBe(true);
  });
});

// ------------------------------------------------------------------
// Collect Phase — dice draft
// ------------------------------------------------------------------

describe("collect dice draft", () => {
  it("claims a typed die and an 'anything' die (pile-chosen), respecting Warehouse cap", () => {
    let s = createGame({ seed: 3 });
    s = ok(s, { type: "BEGIN_COLLECT" });
    s.collect!.dice[0]!.face = "rye";
    s.collect!.dice[1]!.face = "anything";
    s = ok(s, {
      type: "COLLECT_CLAIM",
      claims: [{ dieId: s.collect!.dice[0]!.id }, { dieId: s.collect!.dice[1]!.id, pile: "wheat" }],
    });
    const hand = s.players[0]!.hand;
    expect(hand.length).toBe(2);
    expect(hand.filter((c) => c.kind === "rye").length).toBe(1);
    expect(hand.filter((c) => c.kind === "wheat").length).toBe(1);
    expect(s.roundPhase).toBe("play");
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
    s.collect!.dice[0]!.face = "cask";
    expect(
      expectRefusal(s, { type: "COLLECT_CLAIM", claims: [{ dieId: s.collect!.dice[0]!.id }] }),
    ).toMatch(/Warehouse holds/);
  });

  it("refuses an 'anything' die claimed without a pile", () => {
    let s = createGame({ seed: 3 });
    s = ok(s, { type: "BEGIN_COLLECT" });
    s.collect!.dice[0]!.face = "anything";
    expect(
      expectRefusal(s, { type: "COLLECT_CLAIM", claims: [{ dieId: s.collect!.dice[0]!.id }] }),
    ).toMatch(/needs a pile/);
  });

  it("rerolls once, and refuses a second reroll without the Second Reroll ultimate", () => {
    let s = createGame({ seed: 5 });
    s = ok(s, { type: "BEGIN_COLLECT" });
    expect(s.collect!.maxRerolls).toBe(1);
    const id = s.collect!.dice[0]!.id;
    s = ok(s, { type: "COLLECT_REROLL", diceIds: [id] });
    expect(expectRefusal(s, { type: "COLLECT_REROLL", diceIds: [id] })).toMatch(/no rerolls left/);
  });

  it("the Second Reroll ultimate grants a second reroll", () => {
    let s = createGame({ seed: 5 });
    const sup = dept(s.players[0]!, "supply");
    sup.level = sup.maxLevel;
    sup.chosenUltimate = "secondReroll";
    s = ok(s, { type: "BEGIN_COLLECT" });
    expect(s.collect!.maxRerolls).toBe(2);
  });

  it("most-Capital-first sets the collect pass order", () => {
    let s = createGame({ seed: 5, playerNames: ["A", "B"] });
    s.players[0]!.capital = 1;
    s.players[1]!.capital = 9;
    s = ok(s, { type: "BEGIN_COLLECT" });
    expect(s.collect!.order[0]).toBe(1);
    expect(s.currentPlayerIndex).toBe(1);
  });

  it("Triple Threat discards 2 and takes a die of the chosen face", () => {
    let s = createGame({ seed: 5 });
    const sup = dept(s.players[0]!, "supply");
    sup.level = sup.maxLevel;
    sup.chosenUltimate = "tripleThreat";
    s = ok(s, { type: "BEGIN_COLLECT" });
    const [d0, d1] = [s.collect!.dice[0]!, s.collect!.dice[1]!];
    const before = s.collect!.dice.length;
    s = ok(s, { type: "TRIPLE_THREAT", discardDiceIds: [d0.id, d1.id], face: "cask" });
    expect(s.collect!.dice.length).toBe(before - 1);
    expect(s.collect!.dice.some((d) => d.face === "cask")).toBe(true);
    expect(expectRefusal(s, { type: "TRIPLE_THREAT", discardDiceIds: [], face: "rye" })).toMatch(
      /already used/,
    );
  });
});

// ------------------------------------------------------------------
// Draw Mash Bills
// ------------------------------------------------------------------

describe("draw mash bills", () => {
  it("reveals Mash-Floor-many bills and keeps the chosen ones as resting barrels", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    const supplyBefore = s.mashBillSupply.length;
    s = ok(s, { type: "DRAW_MASH_BILLS", keepIndexes: [0] });
    const p = s.players[0]!;
    expect(p.rickhouse.length).toBe(1);
    expect(p.rickhouse[0]!.built).toBe(false);
    expect(p.rickhouse[0]!.age).toBe(0);
    expect(s.mashBillSupply.length).toBe(supplyBefore - 1);
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
});

// ------------------------------------------------------------------
// Make Bourbon + staging
// ------------------------------------------------------------------

describe("make bourbon", () => {
  it("commits the recipe, builds the barrel, and sets quality from the best card", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "barrel", built: false, age: 0, recipe: { cask: 1, corn: 1 } }),
    ];
    s.players[0]!.hand = [
      { id: "c1", defId: "x", kind: "cask", quality: "rare", name: "cask", placeholder: true },
      { id: "g1", defId: "x", kind: "corn", quality: "common", name: "corn", placeholder: true },
    ];
    const before = totalDiscard(s);
    s = ok(s, { type: "MAKE_BOURBON", barrelId: "barrel", resourceCardIds: ["c1", "g1"] });
    const b = s.players[0]!.rickhouse[0]!;
    expect(b.built).toBe(true);
    expect(b.age).toBe(0);
    expect(b.quality).toBe("rare"); // best of {rare, common}
    expect(totalDiscard(s)).toBe(before + 2);
  });

  it("Char & Toast builds barrels starting at age 1", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    const rh = dept(s.players[0]!, "rickhouse");
    rh.level = rh.maxLevel;
    rh.chosenUltimate = "charToast";
    s.players[0]!.rickhouse = [makeBourbon({ id: "b", built: false, recipe: { cask: 1 } })];
    s.players[0]!.hand = [
      { id: "c1", defId: "x", kind: "cask", quality: "common", name: "cask", placeholder: true },
    ];
    s = ok(s, { type: "MAKE_BOURBON", barrelId: "b", resourceCardIds: ["c1"] });
    expect(s.players[0]!.rickhouse[0]!.age).toBe(CONFIG.ULT_CHAR_TOAST_START_AGE);
  });

  it("stages a recipe-matched card off the Warehouse and builds from it", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [
      makeBourbon({ id: "barrel", built: false, age: 0, recipe: { cask: 1, corn: 1 } }),
    ];
    s.players[0]!.hand = [
      { id: "c1", defId: "x", kind: "cask", quality: "rare", name: "cask", placeholder: true },
      { id: "g1", defId: "x", kind: "corn", quality: "common", name: "corn", placeholder: true },
    ];
    s = ok(s, { type: "STAGE", barrelId: "barrel", resourceCardId: "c1" });
    expect(s.players[0]!.hand.length).toBe(1);
    expect(s.players[0]!.rickhouse[0]!.staged.length).toBe(1);
    s = ok(s, { type: "MAKE_BOURBON", barrelId: "barrel", resourceCardIds: ["g1"] });
    expect(s.players[0]!.rickhouse[0]!.built).toBe(true);
    expect(s.players[0]!.rickhouse[0]!.quality).toBe("rare");
  });

  it("Long Cellar lets a staged card be pulled back; without it, staging is locked", () => {
    let s = createGame({ seed: 3 });
    s = intoPlay(s);
    s.players[0]!.rickhouse = [makeBourbon({ id: "barrel", built: false, recipe: { cask: 1 } })];
    s.players[0]!.hand = [
      { id: "c1", defId: "x", kind: "cask", quality: "common", name: "cask", placeholder: true },
    ];
    s = ok(s, { type: "STAGE", barrelId: "barrel", resourceCardId: "c1" });
    expect(expectRefusal(s, { type: "UNSTAGE", barrelId: "barrel", resourceCardId: "c1" })).toMatch(
      /locked/,
    );
    const wh = dept(s.players[0]!, "warehouse");
    wh.level = wh.maxLevel;
    wh.chosenUltimate = "longCellar";
    s = ok(s, { type: "UNSTAGE", barrelId: "barrel", resourceCardId: "c1" });
    expect(s.players[0]!.hand.length).toBe(1);
    expect(s.players[0]!.rickhouse[0]!.staged.length).toBe(0);
  });
});

// ------------------------------------------------------------------
// barrel value — printed age track per (tier, age), value caps by tier
// ------------------------------------------------------------------

describe("barrel value (age track)", () => {
  it("reads value off the per-(tier, age) table", () => {
    expect(barrelValue("common", 2)).toBe(1);
    expect(barrelValue("common", 4)).toBe(2); // cap value
    expect(barrelValue("rare", 3)).toBe(2);
    expect(barrelValue("legendary", 18)).toBe(11); // cap value
  });
  it("is 0 below the minimum sell age and holds the cap value past the cap age", () => {
    expect(barrelValue("common", 1)).toBe(0); // below MIN_SELL_AGE
    expect(barrelValue("common", 99)).toBe(2); // holds Common's cap value (2)
    expect(barrelValue("legendary", 99)).toBe(11); // holds Legendary's cap value (11)
  });
  it("climbs to the cap year with no dead final step", () => {
    expect(barrelValue("epic", 11)).toBeLessThan(barrelValue("epic", 12)); // 6 → 7
  });
});

describe("demand zone multiplier", () => {
  it("is ×1 / ×2 / ×3 for Low / Mid / High", () => {
    expect(zoneMultiplier("low")).toBe(1);
    expect(zoneMultiplier("mid")).toBe(2);
    expect(zoneMultiplier("high")).toBe(3);
  });
});

// ------------------------------------------------------------------
// mash-bill complexity scaling
// ------------------------------------------------------------------

describe("mash-bill complexity scaling", () => {
  it("every shipped bill follows the bourbon rule: 1 cask + ≥1 corn + ≥1 grain", () => {
    for (const bill of buildMashBillSupply()) {
      expect(bill.recipe.cask).toBe(1);
      expect(bill.recipe.corn ?? 0).toBeGreaterThanOrEqual(1);
      const grain = (bill.recipe.rye ?? 0) + (bill.recipe.wheat ?? 0) + (bill.recipe.barley ?? 0);
      expect(grain).toBeGreaterThanOrEqual(1); // no cask/corn-only recipes
    }
  });

  it("more complex recipes yield ≥ batchQty and ≥ per-sale premium", () => {
    const simple = { cask: 1, corn: 1 }; // complexity 2
    const rich = { cask: 1, corn: 1, rye: 1, wheat: 1, barley: 1 }; // complexity 5
    expect(saleBonusForRecipe(simple)).toBe(0);
    expect(saleBonusForRecipe(rich)).toBeGreaterThan(saleBonusForRecipe(simple));
    expect(batchQtyForRecipe(rich)).toBeGreaterThanOrEqual(batchQtyForRecipe(simple));
  });

  it("a sale adds the bourbon's complexity premium to the payoff", () => {
    let s = createGame({ seed: 5 });
    s = intoPlay(s);
    s.players[0]!.capital = 0;
    s.players[0]!.rickhouse = [makeBourbon({ id: "x", quality: "common", age: 3, saleBonus: 2 })];
    s.demandCards = [makeDemandCard({ id: "ord", slotsActive: 1, zoneBonus: { low: 0, mid: 0, high: 0 }, reputation: 1 })];
    const dist = dept(s.players[0]!, "distribution").values[0]!;
    s = ok(s, { type: "SELL", bourbonId: "x", demandCardId: "ord" });
    expect(s.players[0]!.capital).toBe(barrelValue("common", 3) + 2 + dist); // +2 premium
  });
});

// ------------------------------------------------------------------
// Sell (Extract) — glut, card routing, completion
// ------------------------------------------------------------------

describe("sell", () => {
  function base(over: Partial<Bourbon> = {}): GameState {
    let s = createGame({ seed: 5 });
    s = intoPlay(s);
    s.players[0]!.capital = 0;
    s.players[0]!.rickhouse = [makeBourbon({ id: "sellme", age: 3, ...over })];
    return s;
  }

  it("refuses barrels under the minimum sell age and unbuilt barrels", () => {
    expect(expectRefusal(base({ age: 1 }), { type: "SELL", bourbonId: "sellme" })).toContain(
      "aged at least",
    );
    expect(expectRefusal(base({ built: false }), { type: "SELL", bourbonId: "sellme" })).toContain(
      "not built",
    );
  });

  it("refuses a sale with no demand order (the glut is gone)", () => {
    const s = base({ quality: "common", age: 3 });
    expect(expectRefusal(s, { type: "SELL", bourbonId: "sellme" })).toContain("choose a demand order");
  });

  it("routing to a matching card adds the zone effect and completion keeps the card", () => {
    let s = base({ quality: "common", age: 3 });
    const card = makeDemandCard({ id: "ord", slotsActive: 1, zoneBonus: { low: 2, mid: 4, high: 6 }, reputation: 5 });
    s.demandCards = [card]; // length 1 → low zone
    s = ok(s, { type: "SELL", bourbonId: "sellme", demandCardId: "ord" });
    const p = s.players[0]!;
    expect(p.capital).toBe(barrelValue("common", 3) + 2 + dept(p, "distribution").values[0]!);
    expect(p.cardsCompleted).toBe(1);
    expect(p.keptCards.map((c) => c.id)).toContain("ord");
    expect(s.demandCards.length).toBe(0); // completed card left the table
  });

  it("refuses routing to a card whose requirement isn't met", () => {
    let s = base({ styleTag: "classic", age: 3 });
    s.demandCards = [makeDemandCard({ id: "ord", requirement: { styleTag: "rye" } })];
    expect(
      expectRefusal(s, { type: "SELL", bourbonId: "sellme", demandCardId: "ord" }),
    ).toContain("does not meet");
  });

  it("a multi-sale batch banks Capital each sale; the final sale frees the slot", () => {
    let s = base({ batchQty: 2, quality: "common", age: 2 });
    // One open order deep enough for both sales.
    s.demandCards = [makeDemandCard({ id: "ord", slotsActive: 3, zoneBonus: { low: 0, mid: 0, high: 0 }, reputation: 1 })];
    const dist = dept(s.players[0]!, "distribution").values[0]!;
    const v = barrelValue("common", 2);
    s = ok(s, { type: "SELL", bourbonId: "sellme", demandCardId: "ord" }); // intermediate
    expect(s.players[0]!.capital).toBe(v + dist);
    expect(s.players[0]!.rickhouse.length).toBe(1);
    s = ok(s, { type: "SELL", bourbonId: "sellme", demandCardId: "ord" }); // final
    expect(s.players[0]!.capital).toBe(2 * (v + dist));
    expect(s.players[0]!.rickhouse.length).toBe(0);
  });

  it("the demand zone MULTIPLIES the age value; card bonus stays additive", () => {
    let s = base({ quality: "common", age: 2 }); // age value 1
    // 5 cards on the table → Mid zone (×2). Target is first + 4 fillers.
    const target = makeDemandCard({ id: "ord", slotsActive: 1, zoneBonus: { low: 1, mid: 4, high: 9 }, reputation: 1 });
    const fillers = Array.from({ length: 4 }, (_, i) => makeDemandCard({ id: `f${i}`, slotsActive: 1 }));
    s.demandCards = [target, ...fillers];
    expect(zoneForCardCount(s.demandCards.length)).toBe("mid");
    const dist = dept(s.players[0]!, "distribution").values[0]!;
    s = ok(s, { type: "SELL", bourbonId: "sellme", demandCardId: "ord" });
    // (value 1 × mid ×2) + card mid bonus 4 + dist — the ×2 hits value only.
    expect(s.players[0]!.capital).toBe(barrelValue("common", 2) * 2 + 4 + dist);
  });
});

// ------------------------------------------------------------------
// Improve Distillery — ramp, discounts, ultimate selection
// ------------------------------------------------------------------

describe("improve distillery", () => {
  it("charges the linear ramp and advances the department level", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    s.players[0]!.capital = 10;
    s = ok(s, { type: "IMPROVE", departmentId: "warehouse" });
    expect(dept(s.players[0]!, "warehouse").level).toBe(1);
    expect(s.players[0]!.capital).toBe(10 - improvementCost(0));
    expect(s.players[0]!.improvements).toBe(1);
  });

  it("each improvement costs more than the last", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    s.players[0]!.capital = 100;
    let c = s.players[0]!.capital;
    s = ok(s, { type: "IMPROVE", departmentId: "warehouse" });
    const spent1 = c - s.players[0]!.capital;
    c = s.players[0]!.capital;
    s = ok(s, { type: "IMPROVE", departmentId: "supply" });
    const spent2 = c - s.players[0]!.capital;
    expect(spent2).toBeGreaterThan(spent1);
  });

  it("requires choosing an offered ultimate at the top of a branch", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    s.players[0]!.capital = 1000;
    s = ok(s, { type: "IMPROVE", departmentId: "warehouse" }); // → 1
    s = ok(s, { type: "IMPROVE", departmentId: "warehouse" }); // → 2
    expect(expectRefusal(s, { type: "IMPROVE", departmentId: "warehouse" })).toMatch(
      /choose an ultimate/,
    );
    s = ok(s, { type: "IMPROVE", departmentId: "warehouse", ultimateId: "grandWarehouse" });
    const wh = dept(s.players[0]!, "warehouse");
    expect(wh.level).toBe(wh.maxLevel);
    expect(wh.chosenUltimate).toBe("grandWarehouse");
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

  it("the Counting House discounts later improvements", () => {
    let s = createGame({ seed: 1 });
    s = intoPlay(s);
    s.players[0]!.capital = 1000;
    s = ok(s, { type: "IMPROVE", departmentId: "countingHouse" }); // level 1 → discount 1
    const made = s.players[0]!.improvements;
    let c = s.players[0]!.capital;
    s = ok(s, { type: "IMPROVE", departmentId: "supply" });
    const spent = c - s.players[0]!.capital;
    expect(spent).toBe(improvementCost(made, 1));
  });
});

// ------------------------------------------------------------------
// scoring + the clock
// ------------------------------------------------------------------

describe("scoring and the clock", () => {
  it("score = Capital + Reputation (kept cards)", () => {
    const s = createGame({ seed: 1 });
    s.players[0]!.capital = 12;
    s.players[0]!.keptCards = [makeDemandCard({ reputation: 3 }), makeDemandCard({ reputation: 5 })];
    expect(reputationOf(s.players[0]!)).toBe(8);
    expect(scorePlayer(s.players[0]!).total).toBe(20);
  });

  it("ranks players high→low, tiebreak by cards completed", () => {
    const s = createGame({ seed: 1, playerNames: ["A", "B"] });
    s.players[0]!.capital = 5;
    s.players[1]!.capital = 5;
    s.players[1]!.cardsCompleted = 2;
    expect(rankPlayers(s)[0]!.name).toBe("B");
  });

  it("ends the game when the demand deck is exhausted", () => {
    let s = createGame({ seed: 2 });
    s = intoPlay(s);
    // Drain the demand pool so the next Demand Phase can't draw.
    s.demandDeck = [];
    s.demandDiscard = [];
    s = ok(s, { type: "END_TURN" }); // round ends → next Demand Phase → schedules final round
    expect(s.finalRound).not.toBeNull();
    s = intoPlay(s);
    s = ok(s, { type: "END_TURN" }); // final round completes
    expect(s.phase).toBe("ended");
    expect(s.log.some((l) => l.includes("Game over"))).toBe(true);
  });
});

// ------------------------------------------------------------------
// requirement matching
// ------------------------------------------------------------------

describe("requirement matching", () => {
  it("matches style tag, minimum age, and minimum quality (floors)", () => {
    const b = makeBourbon({ styleTag: "rye", age: 5, quality: "rare" });
    expect(meetsRequirement(b, {})).toBe(true);
    expect(meetsRequirement(b, { styleTag: "rye" })).toBe(true);
    expect(meetsRequirement(b, { styleTag: "wheat" })).toBe(false);
    expect(meetsRequirement(b, { minAge: 4 })).toBe(true);
    expect(meetsRequirement(b, { minAge: 6 })).toBe(false);
    expect(meetsRequirement(b, { quality: "common" })).toBe(true); // rare ≥ common
    expect(meetsRequirement(b, { quality: "uncommon" })).toBe(true); // rare ≥ uncommon
    expect(meetsRequirement(b, { quality: "legendary" })).toBe(false);
  });
});
