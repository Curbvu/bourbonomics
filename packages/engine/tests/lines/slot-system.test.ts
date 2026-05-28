import { describe, expect, it } from "vitest";
import type {
  Bottle,
  Card,
  DistilleryBonus,
  GameState,
  PlayerState,
} from "../../src/types.js";
import { applyAction, validateAction } from "../../src/engine.js";
import {
  getLineBoardDef,
  lineBoardForDistillery,
} from "../../src/lines/boards.js";
import { bindFlagshipBoard } from "../../src/lines/placement.js";
import { scoreEndGameLines } from "../../src/lines/scoring.js";
import { makeTestGame, advanceToActionPhase } from "../helpers.js";

// ─── Fixture builders ──────────────────────────────────────────

function aBottle(overrides: Partial<Bottle> = {}): Bottle {
  return {
    bottleId: "bottle_test",
    originalBillId: "bill_test",
    billDefId: "bill_def_test",
    name: "Test Bottle",
    recipeTags: ["wheated"],
    primaryRecipeTag: "wheated",
    caskTag: "common-cask",
    rarity: "common",
    ageAtSale: 3,
    demandAtSale: 5,
    placedOnRound: 1,
    ...overrides,
  };
}

/**
 * Build a state with player p1 bound to the given distillery's
 * flagship Board, ready for direct PLACE_BOTTLE dispatch (we synthesize
 * pendingBottlePlacement by mutating the test state — that's an
 * internal slot, but we own this test).
 */
function gameWithFlagship(bonus: DistilleryBonus): GameState {
  const state = makeTestGame();
  const board = lineBoardForDistillery(bonus)!;
  // Rebind p1 to the requested board and seed empty slots.
  return {
    ...state,
    currentPlayerIndex: 0,
    players: state.players.map((p, i) => {
      if (i !== 0) return p;
      const flagshipLine = { ...p.flagshipLine };
      bindFlagshipBoard(flagshipLine, board.id);
      return { ...p, flagshipLine };
    }),
  };
}

/**
 * Inject a pending bottle placement onto p1 and put the cursor on them.
 * The engine's PLACE_BOTTLE validation/apply path then runs as if a
 * fresh SELL_BOURBON had just resolved.
 */
function withPendingBottle(state: GameState, bottle: Bottle): GameState {
  return {
    ...state,
    currentPlayerIndex: 0,
    phase: "action",
    players: state.players.map((p, i) =>
      i === 0
        ? {
            ...p,
            pendingBottlePlacement: { bottle },
            needsDemandRoll: false,
            needsAgeBarrels: false,
          }
        : p,
    ),
  };
}

function place(state: GameState): GameState {
  return applyAction(state, {
    type: "PLACE_BOTTLE",
    playerId: "p1",
    destination: { kind: "flagship" },
  });
}

function placeInventory(state: GameState): GameState {
  return applyAction(state, {
    type: "PLACE_BOTTLE",
    playerId: "p1",
    destination: { kind: "inventory" },
  });
}

function expectIllegalFlagship(state: GameState, reasonSubstring: string) {
  const result = validateAction(state, {
    type: "PLACE_BOTTLE",
    playerId: "p1",
    destination: { kind: "flagship" },
  });
  expect(result.legal).toBe(false);
  expect(result.reason ?? "").toContain(reasonSubstring);
}

// ─── Slot order enforcement ────────────────────────────────────

describe("v3.1 slot order enforcement", () => {
  it("flagship slot 0 fills on first eligible bottle", () => {
    let s = gameWithFlagship("wheated_baron");
    s = withPendingBottle(s, aBottle({ recipeTags: ["wheated"] }));
    s = place(s);
    const flagship = s.players[0]!.flagshipLine;
    expect(flagship.slots?.[0]!.filled).toBe(true);
    expect(flagship.slots?.[1]!.filled).toBe(false);
    expect(flagship.bottles.length).toBe(1);
  });

  it("a single bottle never fills two slots at once", () => {
    let s = gameWithFlagship("wheated_baron");
    s = withPendingBottle(
      s,
      aBottle({
        recipeTags: ["wheated"],
        ageAtSale: 7,
        demandAtSale: 8,
        caskTag: "heritage-cask",
      }),
    );
    s = place(s);
    const slots = s.players[0]!.flagshipLine.slots!;
    expect(slots.filter((s) => s.filled).length).toBe(1);
    expect(slots[0]!.filled).toBe(true);
  });

  it("each sale fills the next unfilled slot left-to-right", () => {
    let s = gameWithFlagship("vanilla");
    // Vanilla ladder: any → aged 3+ → Specialty cask → ...
    s = withPendingBottle(s, aBottle({ bottleId: "b0" }));
    s = place(s);
    s = withPendingBottle(s, aBottle({ bottleId: "b1", ageAtSale: 4 }));
    s = place(s);
    s = withPendingBottle(
      s,
      aBottle({ bottleId: "b2", ageAtSale: 4, caskTag: "specialty-cask" }),
    );
    s = place(s);
    const slots = s.players[0]!.flagshipLine.slots!;
    expect(slots[0]!.filled).toBe(true);
    expect(slots[1]!.filled).toBe(true);
    expect(slots[2]!.filled).toBe(true);
    expect(slots[3]!.filled).toBe(false);
  });
});

// ─── Line Restriction inheritance ──────────────────────────────

describe("v3.1 Line Restriction", () => {
  it("Wheated Baron rejects non-wheated bottles in slot 0", () => {
    let s = gameWithFlagship("wheated_baron");
    s = withPendingBottle(s, aBottle({ recipeTags: ["rye"], primaryRecipeTag: "rye" }));
    expectIllegalFlagship(s, "Line Restriction");
  });

  it("High-Rye House rejects bottles without rye tag", () => {
    let s = gameWithFlagship("high_rye_house");
    s = withPendingBottle(
      s,
      aBottle({
        recipeTags: ["wheated"],
        primaryRecipeTag: "wheated",
        ageAtSale: 5,
      }),
    );
    expectIllegalFlagship(s, "Line Restriction");
  });

  it("Connoisseur Estate rejects bottles whose primary recipe tag is already on the line", () => {
    let s = gameWithFlagship("connoisseur_estate");
    s = withPendingBottle(
      s,
      aBottle({
        bottleId: "b1",
        recipeTags: ["wheated"],
        primaryRecipeTag: "wheated",
      }),
    );
    s = place(s);
    // Slot 0 filled. Slot 1 requires single-grain; a second wheated
    // would also violate the no-repeat-primary-tag restriction.
    s = withPendingBottle(
      s,
      aBottle({
        bottleId: "b2",
        recipeTags: ["wheated", "single-grain"],
        primaryRecipeTag: "wheated",
      }),
    );
    expectIllegalFlagship(s, "Line Restriction");
  });

  it("Vanilla Distillery has no Line Restriction — any bottle is eligible for slot 0", () => {
    let s = gameWithFlagship("vanilla");
    s = withPendingBottle(s, aBottle({ recipeTags: ["rye"], primaryRecipeTag: "rye" }));
    const result = validateAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "flagship" },
    });
    expect(result.legal).toBe(true);
  });
});

// ─── Compound slot requirements ────────────────────────────────

describe("v3.1 compound slot requirements", () => {
  it("Wheated Baron slot 5 (Vintage Reserve) demands Heritage + aged 7+ AND prior 4 slots filled", () => {
    let s = gameWithFlagship("wheated_baron");
    // Fill slots 0..3 with bottles that meet each gate.
    // Slot 0: any wheated
    s = withPendingBottle(
      s,
      aBottle({ bottleId: "b0", recipeTags: ["wheated"], ageAtSale: 2 }),
    );
    s = place(s);
    // Slot 1: aged 3+
    s = withPendingBottle(
      s,
      aBottle({ bottleId: "b1", recipeTags: ["wheated"], ageAtSale: 4 }),
    );
    s = place(s);
    // Slot 2: demand 5+
    s = withPendingBottle(
      s,
      aBottle({
        bottleId: "b2",
        recipeTags: ["wheated"],
        ageAtSale: 4,
        demandAtSale: 6,
      }),
    );
    s = place(s);
    // Slot 3: Heritage cask
    s = withPendingBottle(
      s,
      aBottle({
        bottleId: "b3",
        recipeTags: ["wheated"],
        caskTag: "heritage-cask",
        ageAtSale: 5,
      }),
    );
    s = place(s);

    // Slot 4: Heritage + aged 7+. Try a bottle missing one piece.
    s = withPendingBottle(
      s,
      aBottle({
        bottleId: "b4_partial",
        recipeTags: ["wheated"],
        caskTag: "heritage-cask",
        ageAtSale: 5, // too young
      }),
    );
    expectIllegalFlagship(s, "slot's requirement");

    // Now a fully qualified slot-4 bottle.
    s = withPendingBottle(
      s,
      aBottle({
        bottleId: "b4_ok",
        recipeTags: ["wheated"],
        caskTag: "heritage-cask",
        ageAtSale: 8,
      }),
    );
    s = place(s);
    expect(s.players[0]!.flagshipLine.slots![4]!.filled).toBe(true);
  });

  it("a bottle missing Heritage cask cannot fill the cask-gated slot even if other gates pass", () => {
    let s = gameWithFlagship("vanilla");
    // Fill 0 (any), 1 (aged 3+), 2 (specialty cask).
    s = withPendingBottle(s, aBottle({ bottleId: "b0", ageAtSale: 2 }));
    s = place(s);
    s = withPendingBottle(s, aBottle({ bottleId: "b1", ageAtSale: 4 }));
    s = place(s);
    s = withPendingBottle(
      s,
      aBottle({ bottleId: "b2", caskTag: "specialty-cask", ageAtSale: 4 }),
    );
    s = place(s);

    // Slot 3 demands Heritage cask + aged 5+. Common cask should fail
    // even when age is fine.
    s = withPendingBottle(
      s,
      aBottle({ bottleId: "b3_common", caskTag: "common-cask", ageAtSale: 6 }),
    );
    expectIllegalFlagship(s, "slot's requirement");
  });
});

// ─── Slot rewards fire once ────────────────────────────────────

describe("v3.1 slot rewards", () => {
  it("the slot reward fires the moment the slot transitions empty → filled", () => {
    let s = gameWithFlagship("vanilla");
    const repBefore = s.players[0]!.reputation;
    s = withPendingBottle(s, aBottle());
    s = place(s);
    // Vanilla slot 0 reward: +1 rep.
    expect(s.players[0]!.reputation).toBe(repBefore + 1);
    expect(s.players[0]!.flagshipLine.slots![0]!.rewardFired).toBe(true);
  });

  it("the slot reward does not fire twice if state is dispatched a second time", () => {
    let s = gameWithFlagship("vanilla");
    s = withPendingBottle(s, aBottle({ bottleId: "b0" }));
    s = place(s);
    const repAfterFirst = s.players[0]!.reputation;
    // Place a SECOND bottle — fills slot 1 (a different slot). Slot 0's
    // reward must NOT fire again. Vanilla slot 1 reward = +1 rep, so
    // total delta from this second place is exactly +1.
    s = withPendingBottle(s, aBottle({ bottleId: "b1", ageAtSale: 4 }));
    s = place(s);
    expect(s.players[0]!.reputation).toBe(repAfterFirst + 1);
  });

  it("compound rewards (rep + draw + prestige) all fire on a single fill", () => {
    let s = gameWithFlagship("wheated_baron");
    // Fast-forward to slot 4 (Baron's Vintage Reserve). Fill slots 0-3
    // with minimal-qualifier bottles.
    const wheatedAged = (id: string, age: number, demand = 4, cask = "common-cask") =>
      aBottle({
        bottleId: id,
        recipeTags: ["wheated"],
        ageAtSale: age,
        demandAtSale: demand,
        caskTag: cask,
      });
    s = withPendingBottle(s, wheatedAged("b0", 2));
    s = place(s);
    s = withPendingBottle(s, wheatedAged("b1", 4));
    s = place(s);
    s = withPendingBottle(s, wheatedAged("b2", 4, 6));
    s = place(s);
    s = withPendingBottle(s, wheatedAged("b3", 5, 4, "heritage-cask"));
    s = place(s);
    // Pre-slot-4 snapshot.
    const repBeforeSlot4 = s.players[0]!.reputation;
    const prestigeBefore = s.players[0]!.prestige;
    const handSizeBefore = s.players[0]!.hand.length;
    // Slot 4: heritage + aged 7+ + prior all filled.
    s = withPendingBottle(s, wheatedAged("b4", 8, 4, "heritage-cask"));
    // Seed deck so draw 3 has cards to pull.
    s = {
      ...s,
      players: s.players.map((p, i) =>
        i === 0
          ? {
              ...p,
              deck: [
                { id: "d1", type: "resource", subtype: "corn" } as Card,
                { id: "d2", type: "resource", subtype: "corn" } as Card,
                { id: "d3", type: "resource", subtype: "corn" } as Card,
              ],
            }
          : p,
      ),
    };
    s = place(s);
    // Slot 4 reward: +5 rep, +2 prestige, draw 3 cards.
    // Slot 4 is also the FINAL slot → Wheated Baron completion bonus
    // also fires: +10 rep, plus set commonSalesIgnoreDemandDrop.
    // Net rep delta = 5 (slot) + 10 (completion) = 15.
    expect(s.players[0]!.reputation).toBe(repBeforeSlot4 + 15);
    expect(s.players[0]!.prestige).toBe(prestigeBefore + 2);
    expect(s.players[0]!.hand.length).toBe(handSizeBefore + 3);
  });
});

// ─── Line Completion Bonus ─────────────────────────────────────

describe("v3.1 Line Completion Bonus", () => {
  it("does NOT fire when an interior slot fills", () => {
    let s = gameWithFlagship("vanilla");
    s = withPendingBottle(s, aBottle({ bottleId: "b0" }));
    s = place(s);
    expect(s.players[0]!.flagshipLine.completionBonusTriggered).toBe(false);
    expect(s.players[0]!.inventoryBottleBonusActive).toBe(false);
  });

  it("fires exactly once when the final slot fills", () => {
    let s = gameWithFlagship("vanilla");
    // Vanilla slot ladder: any → aged 3+ → Specialty cask → Heritage+aged 5 → Heritage+aged 7+demand 5.
    s = withPendingBottle(s, aBottle({ bottleId: "b0" }));
    s = place(s);
    s = withPendingBottle(s, aBottle({ bottleId: "b1", ageAtSale: 4 }));
    s = place(s);
    s = withPendingBottle(
      s,
      aBottle({ bottleId: "b2", caskTag: "specialty-cask", ageAtSale: 4 }),
    );
    s = place(s);
    s = withPendingBottle(
      s,
      aBottle({ bottleId: "b3", caskTag: "heritage-cask", ageAtSale: 6 }),
    );
    s = place(s);
    const repBeforeFinal = s.players[0]!.reputation;
    s = withPendingBottle(
      s,
      aBottle({
        bottleId: "b4",
        caskTag: "heritage-cask",
        ageAtSale: 8,
        demandAtSale: 6,
      }),
    );
    s = place(s);
    // Vanilla final slot reward = +5 rep, +2 prestige.
    // Completion bonus = +10 rep, set inventoryBottleBonusActive.
    expect(s.players[0]!.reputation).toBe(repBeforeFinal + 15);
    expect(s.players[0]!.inventoryBottleBonusActive).toBe(true);
    expect(s.players[0]!.flagshipLine.completionBonusTriggered).toBe(true);
  });

  it("Wheated Baron completion sets the commonSalesIgnoreDemandDrop flag", () => {
    let s = gameWithFlagship("wheated_baron");
    // Fast-fill the 5 slots.
    const wb = (id: string, age: number, demand = 6, cask = "common-cask") =>
      aBottle({
        bottleId: id,
        recipeTags: ["wheated"],
        ageAtSale: age,
        demandAtSale: demand,
        caskTag: cask,
      });
    s = withPendingBottle(s, wb("b0", 2));
    s = place(s);
    s = withPendingBottle(s, wb("b1", 4));
    s = place(s);
    s = withPendingBottle(s, wb("b2", 4, 6));
    s = place(s);
    s = withPendingBottle(s, wb("b3", 5, 4, "heritage-cask"));
    s = place(s);
    s = withPendingBottle(s, wb("b4", 8, 4, "heritage-cask"));
    s = place(s);
    expect(s.players[0]!.commonSalesIgnoreDemandDrop).toBe(true);
  });
});

// ─── End-game scoring (minimal v3.1 rollup) ────────────────────

describe("v3.1 end-game scoring", () => {
  it("flagship scores the sum of filled slot endGameValues", () => {
    let s = gameWithFlagship("vanilla");
    // Fill slots 0 and 1 (values +2 and +3). Total flagship score = 5.
    s = withPendingBottle(s, aBottle({ bottleId: "b0" }));
    s = place(s);
    s = withPendingBottle(s, aBottle({ bottleId: "b1", ageAtSale: 4 }));
    s = place(s);
    const breakdown = scoreEndGameLines(s.players[0]!);
    expect(breakdown.flagshipScore).toBe(2 + 3);
  });

  it("inventory scores +1/bottle baseline", () => {
    let s = gameWithFlagship("vanilla");
    s = withPendingBottle(s, aBottle({ bottleId: "b0" }));
    s = placeInventory(s);
    s = withPendingBottle(s, aBottle({ bottleId: "b1" }));
    s = placeInventory(s);
    const breakdown = scoreEndGameLines(s.players[0]!);
    expect(breakdown.inventoryScore).toBe(2);
  });

  it("inventory scores +6/bottle (1 baseline + 5 bonus) after Vanilla completion fires", () => {
    let state = gameWithFlagship("vanilla");
    // Flip the flag directly (the completion-bonus path is exercised
    // by the previous suite).
    state = {
      ...state,
      players: state.players.map((p, i) =>
        i === 0 ? { ...p, inventoryBottleBonusActive: true } : p,
      ),
    };
    state = withPendingBottle(state, aBottle({ bottleId: "b0" }));
    state = placeInventory(state);
    state = withPendingBottle(state, aBottle({ bottleId: "b1" }));
    state = placeInventory(state);
    const breakdown = scoreEndGameLines(state.players[0]!);
    expect(breakdown.inventoryScore).toBe(2 * 6);
  });
});

// ─── Board lookups ─────────────────────────────────────────────

describe("v3.1 flagship board lookups", () => {
  it("returns the canonical board for each distillery", () => {
    const cases: { bonus: DistilleryBonus; id: string }[] = [
      { bonus: "wheated_baron", id: "lb_barons_lineup" },
      { bonus: "high_rye_house", id: "lb_house_lineup" },
      { bonus: "connoisseur_estate", id: "lb_estate_collection" },
      { bonus: "vanilla", id: "lb_vanilla_standard" },
    ];
    for (const { bonus, id } of cases) {
      const board = lineBoardForDistillery(bonus);
      expect(board?.id).toBe(id);
      expect(board?.slots.length).toBe(5);
    }
  });

  it("every board's slot endGameValues are positive integers", () => {
    for (const id of [
      "lb_barons_lineup",
      "lb_house_lineup",
      "lb_estate_collection",
      "lb_vanilla_standard",
    ]) {
      const board = getLineBoardDef(id)!;
      for (const slot of board.slots) {
        expect(slot.endGameValue).toBeGreaterThan(0);
      }
    }
  });
});

// ─── Smoke: tests/helpers integration still works ──────────────

describe("v3.1 helpers integration", () => {
  it("makeTestGame + advanceToActionPhase leaves the flagship with seeded empty slots", () => {
    const state = advanceToActionPhase(makeTestGame());
    const flagship = state.players[0]!.flagshipLine;
    expect(flagship.slots?.length).toBe(5);
    expect(flagship.slots!.every((s) => !s.filled)).toBe(true);
    expect(flagship.completionBonusTriggered).toBe(false);
  });
});
