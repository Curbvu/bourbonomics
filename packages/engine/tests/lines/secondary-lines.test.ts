import { describe, expect, it } from "vitest";
import type {
  Bottle,
  GameState,
  LineCardInstance,
  PlayerState,
} from "../../src/types.js";
import { applyAction, validateAction } from "../../src/engine.js";
import { allLineCardDefs, getLineCardDef } from "../../src/lines/cards.js";
import { lineBoardForDistillery } from "../../src/lines/boards.js";
import { bindFlagshipBoard } from "../../src/lines/placement.js";
import { scoreEndGameLines } from "../../src/lines/scoring.js";
import { makeTestGame } from "../helpers.js";

// ─── Fixture helpers ───────────────────────────────────────────

function bottleWith(overrides: Partial<Bottle> = {}): Bottle {
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
 * Build a game with player p1 bound to the Vanilla flagship and a
 * known set of Line Card instances seeded into their hand.
 */
function gameWithCardsInHand(defIds: string[]): GameState {
  const state = makeTestGame();
  const board = lineBoardForDistillery("vanilla")!;
  const hand: LineCardInstance[] = defIds.map((defId, i) => ({
    instanceId: `lci_test_${defId}_${i}`,
    defId,
  }));
  return {
    ...state,
    currentPlayerIndex: 0,
    phase: "action",
    players: state.players.map((p, i) => {
      if (i !== 0) return p;
      const flagshipLine = { ...p.flagshipLine };
      bindFlagshipBoard(flagshipLine, board.id);
      return {
        ...p,
        flagshipLine,
        lineCardHand: hand,
        needsDemandRoll: false,
        needsAgeBarrels: false,
      };
    }),
  };
}

function withPendingBottle(state: GameState, bottle: Bottle): GameState {
  return {
    ...state,
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

// ─── PLAY_LINE_CARD ────────────────────────────────────────────

describe("v3.1 PLAY_LINE_CARD", () => {
  it("opening a new secondary requires a slot-1 card", () => {
    let s = gameWithCardsInHand(["lc_heritage_aged"]); // slot 2
    const result = validateAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: s.players[0]!.lineCardHand[0]!.instanceId,
      targetLineId: null,
    });
    expect(result.legal).toBe(false);
    expect(result.reason ?? "").toContain("slot-1");
  });

  it("opening with a slot-1 card creates a 1-slot secondary line", () => {
    let s = gameWithCardsInHand(["lc_daily_sipper"]); // Wild slot 1
    const instId = s.players[0]!.lineCardHand[0]!.instanceId;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: instId,
      targetLineId: null,
    });
    expect(s.players[0]!.secondaryLines.length).toBe(1);
    const line = s.players[0]!.secondaryLines[0]!;
    expect(line.slots?.length).toBe(1);
    expect(line.slots?.[0]!.filled).toBe(false);
    expect(line.stackedCards.length).toBe(1);
    expect(line.stackedCards[0]!.instanceId).toBe(instId);
    expect(s.players[0]!.lineCardHand.length).toBe(0);
  });

  it("extending requires the card's slotPosition to match the line's next-open position", () => {
    let s = gameWithCardsInHand([
      "lc_daily_sipper", // slot 1
      "lc_bartenders_pick", // slot 3 — would skip slot 2
    ]);
    const slot1 = s.players[0]!.lineCardHand[0]!.instanceId;
    const slot3 = s.players[0]!.lineCardHand[1]!.instanceId;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: slot1,
      targetLineId: null,
    });
    const lineId = s.players[0]!.secondaryLines[0]!.id;
    const result = validateAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: slot3,
      targetLineId: lineId,
    });
    expect(result.legal).toBe(false);
    expect(result.reason ?? "").toContain("slot 3");
    expect(result.reason ?? "").toContain("slot 2");
  });

  it("extending in order grows the secondary one slot at a time", () => {
    let s = gameWithCardsInHand([
      "lc_daily_sipper", // 1
      "lc_house_standard", // 2
      "lc_bartenders_pick", // 3
    ]);
    const [slot1, slot2, slot3] = s.players[0]!.lineCardHand.map(
      (c) => c.instanceId,
    );
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: slot1!,
      targetLineId: null,
    });
    const lineId = s.players[0]!.secondaryLines[0]!.id;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: slot2!,
      targetLineId: lineId,
    });
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: slot3!,
      targetLineId: lineId,
    });
    const line = s.players[0]!.secondaryLines[0]!;
    expect(line.slots?.length).toBe(3);
    expect(line.stackedCards.length).toBe(3);
    expect(s.players[0]!.lineCardHand.length).toBe(0);
  });

  it("caps secondary lines at 2 per player", () => {
    let s = gameWithCardsInHand([
      "lc_daily_sipper",
      "lc_open_lot",
      "lc_working_class",
    ]);
    const ids = s.players[0]!.lineCardHand.map((c) => c.instanceId);
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[0]!,
      targetLineId: null,
    });
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[1]!,
      targetLineId: null,
    });
    const result = validateAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[2]!,
      targetLineId: null,
    });
    expect(result.legal).toBe(false);
    expect(result.reason ?? "").toContain("2 secondary");
  });
});

// ─── PLACE_BOTTLE onto a secondary slot ────────────────────────

describe("v3.1 placing bottles onto secondary slots", () => {
  it("respects the slot card's individual requirement", () => {
    let s = gameWithCardsInHand([
      "lc_daily_sipper", // slot 1, any
      "lc_house_standard", // slot 2, any
      "lc_bartenders_pick", // slot 3, demand >= 4
    ]);
    const ids = s.players[0]!.lineCardHand.map((c) => c.instanceId);
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[0]!,
      targetLineId: null,
    });
    const lineId = s.players[0]!.secondaryLines[0]!.id;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[1]!,
      targetLineId: lineId,
    });
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[2]!,
      targetLineId: lineId,
    });
    // Fill slots 1 & 2 with low-demand bottles (legal for "any").
    s = withPendingBottle(s, bottleWith({ bottleId: "b1", demandAtSale: 2 }));
    s = applyAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    s = withPendingBottle(s, bottleWith({ bottleId: "b2", demandAtSale: 2 }));
    s = applyAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    // Slot 3 requires demand >= 4; a demand-2 bottle must fail.
    s = withPendingBottle(s, bottleWith({ bottleId: "b3_low", demandAtSale: 2 }));
    const fail = validateAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    expect(fail.legal).toBe(false);
    // A demand-5 bottle should pass.
    s = withPendingBottle(s, bottleWith({ bottleId: "b3_ok", demandAtSale: 5 }));
    s = applyAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    const line = s.players[0]!.secondaryLines[0]!;
    expect(line.slots?.[2]!.filled).toBe(true);
  });

  it("inherits the slot-1 card's Line Restriction onto every slot", () => {
    // Heritage Foundation (slot 1) carries restrictHeritageCask.
    let s = gameWithCardsInHand([
      "lc_heritage_foundation", // slot 1, heritage cask
      "lc_heritage_aged", // slot 2, aged 4+
    ]);
    const ids = s.players[0]!.lineCardHand.map((c) => c.instanceId);
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[0]!,
      targetLineId: null,
    });
    const lineId = s.players[0]!.secondaryLines[0]!.id;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[1]!,
      targetLineId: lineId,
    });
    // Fill slot 1 with a heritage cask.
    s = withPendingBottle(
      s,
      bottleWith({ bottleId: "b1", caskTag: "heritage-cask" }),
    );
    s = applyAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    // Try to fill slot 2 with a common cask (line restriction violation).
    s = withPendingBottle(
      s,
      bottleWith({ bottleId: "b2_common", caskTag: "common-cask", ageAtSale: 5 }),
    );
    const result = validateAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    expect(result.legal).toBe(false);
    expect(result.reason ?? "").toContain("Line Restriction");
  });

  it("fires the slot card's reward on fill", () => {
    let s = gameWithCardsInHand(["lc_working_class"]); // slot 1, +2 rep
    const inst = s.players[0]!.lineCardHand[0]!.instanceId;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: inst,
      targetLineId: null,
    });
    const lineId = s.players[0]!.secondaryLines[0]!.id;
    const repBefore = s.players[0]!.reputation;
    s = withPendingBottle(s, bottleWith({ bottleId: "b1", demandAtSale: 2 }));
    s = applyAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    expect(s.players[0]!.reputation).toBe(repBefore + 2);
  });
});

// ─── End-game scoring for secondaries ──────────────────────────

describe("v3.1 secondary line end-game scoring", () => {
  it("a secondary with both slots filled scores the sum of their endGameValues", () => {
    let s = gameWithCardsInHand([
      "lc_daily_sipper", // slot 1, value 1
      "lc_house_standard", // slot 2, value 2
    ]);
    const ids = s.players[0]!.lineCardHand.map((c) => c.instanceId);
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[0]!,
      targetLineId: null,
    });
    const lineId = s.players[0]!.secondaryLines[0]!.id;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[1]!,
      targetLineId: lineId,
    });
    s = withPendingBottle(s, bottleWith({ bottleId: "b1" }));
    s = applyAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    s = withPendingBottle(s, bottleWith({ bottleId: "b2" }));
    s = applyAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    const breakdown = scoreEndGameLines(s.players[0]!);
    expect(breakdown.secondaryScores).toEqual([1 + 2]);
  });

  it("empty Line Card slots pay −2 rep each at end of game", () => {
    let s = gameWithCardsInHand([
      "lc_daily_sipper", // slot 1, value 1
      "lc_house_standard", // slot 2, value 2 (empty at end)
      "lc_bartenders_pick", // slot 3, value 3 (empty at end)
    ]);
    const ids = s.players[0]!.lineCardHand.map((c) => c.instanceId);
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[0]!,
      targetLineId: null,
    });
    const lineId = s.players[0]!.secondaryLines[0]!.id;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[1]!,
      targetLineId: lineId,
    });
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[2]!,
      targetLineId: lineId,
    });
    // Fill slot 1 only.
    s = withPendingBottle(s, bottleWith({ bottleId: "b1" }));
    s = applyAction(s, {
      type: "PLACE_BOTTLE",
      playerId: "p1",
      destination: { kind: "secondary", lineId },
    });
    // 1 filled (value 1) - 2 empty * 2 = 1 - 4 = -3.
    const breakdown = scoreEndGameLines(s.players[0]!);
    expect(breakdown.secondaryScores).toEqual([1 - 4]);
  });

  it("a secondary with no filled slots scores -2N for N stacked cards", () => {
    let s = gameWithCardsInHand([
      "lc_daily_sipper",
      "lc_house_standard",
    ]);
    const ids = s.players[0]!.lineCardHand.map((c) => c.instanceId);
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[0]!,
      targetLineId: null,
    });
    const lineId = s.players[0]!.secondaryLines[0]!.id;
    s = applyAction(s, {
      type: "PLAY_LINE_CARD",
      playerId: "p1",
      lineCardInstanceId: ids[1]!,
      targetLineId: lineId,
    });
    const breakdown = scoreEndGameLines(s.players[0]!);
    expect(breakdown.secondaryScores).toEqual([-4]);
  });
});

// ─── Catalog integrity ─────────────────────────────────────────

describe("v3.1 Line Card catalog", () => {
  it("ships exactly 25 cards across 5 theme families × 5 slot positions", () => {
    const defs = allLineCardDefs();
    expect(defs.length).toBe(25);

    const families = new Set(defs.map((d) => d.themeFamily));
    expect(families.size).toBe(5);

    const slotCounts = new Map<number, number>();
    for (const def of defs) {
      slotCounts.set(def.slotPosition, (slotCounts.get(def.slotPosition) ?? 0) + 1);
    }
    expect(slotCounts.get(1)).toBe(5);
    expect(slotCounts.get(2)).toBe(5);
    expect(slotCounts.get(3)).toBe(5);
    expect(slotCounts.get(4)).toBe(5);
    expect(slotCounts.get(5)).toBe(5);
  });

  it("every slot-1 card carries a Line Restriction except the universal ones", () => {
    const slot1Cards = allLineCardDefs().filter((d) => d.slotPosition === 1);
    // 3 families (Heritage / High-Rye / Counter-Cyclical) lock in a
    // restriction; Volume + Wild slot-1 cards are universal.
    const withRestriction = slot1Cards.filter((d) => d.lineRestriction);
    expect(withRestriction.length).toBe(3);
  });

  it("every Line Card has a positive endGameValue", () => {
    for (const def of allLineCardDefs()) {
      expect(def.endGameValue).toBeGreaterThan(0);
    }
  });
});

// ─── EXTEND_LINE retired ───────────────────────────────────────

describe("v3.1 EXTEND_LINE retirement", () => {
  it("validateAction rejects EXTEND_LINE with a PLAY_LINE_CARD directive", () => {
    const s = gameWithCardsInHand(["lc_daily_sipper"]);
    const result = validateAction(s, {
      type: "EXTEND_LINE",
      playerId: "p1",
      targetLineId: s.players[0]!.flagshipLine.id,
      lineCardInstanceId: s.players[0]!.lineCardHand[0]!.instanceId,
    });
    expect(result.legal).toBe(false);
    expect(result.reason ?? "").toContain("PLAY_LINE_CARD");
  });
});
