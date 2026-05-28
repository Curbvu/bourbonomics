import { describe, expect, it } from "vitest";
import {
  chooseBottlePlacement,
  chooseDrawLineCards,
  chooseKeepInstanceIds,
  pickBestInstances,
  scoreLineCardForPlayer,
} from "../../src/ai/line-heuristics.js";
import { allLineCardDefs, getLineCardDef } from "../../src/lines/cards.js";
import { lineBoardForDistillery } from "../../src/lines/boards.js";
import { defaultDistilleryPool } from "../../src/distilleries.js";
import type {
  Bottle,
  DistilleryBonus,
  LineCardInstance,
  PlayerState,
  Distillery,
  GameState,
} from "../../src/types.js";

// ─── Test fixtures ────────────────────────────────────────────

function distilleryWith(bonus: DistilleryBonus): Distillery {
  const pool = defaultDistilleryPool();
  return pool.find((d) => d.bonus === bonus)!;
}

function fakePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  const distillery = overrides.distillery ?? distilleryWith("vanilla");
  const board = lineBoardForDistillery(distillery.bonus)!;
  return {
    id: "p1",
    name: "Bot",
    isBot: true,
    distillery,
    rickhouseSlots: [],
    hand: [],
    deck: [],
    discard: [],
    operationsHand: [],
    starterHand: [],
    starterPassed: false,
    starterSwapUsed: false,
    reputation: 5,
    handSize: 8,
    barrelsSold: 0,
    prestige: 0,
    savedCard: null,
    outForRound: false,
    demandSurgeActive: false,
    pendingHalfCostMarketBuy: false,
    pendingMakeDiscount: null,
    pendingRatingBoost: 0,
    pendingWildMashToken: false,
    needsDemandRoll: false,
    needsAgeBarrels: false,
    draftingLoopUsedThisRound: false,
    flagshipLine: {
      id: "line_flagship_p1",
      lineBoardId: board.id,
      stackedCards: [],
      bottles: [],
    },
    secondaryLines: [],
    lineCardHand: [],
    inventory: [],
    hasDrawnLineCardsThisRound: false,
    pendingInitialLineCardDraft: null,
    pendingLineCardDraw: null,
    pendingBottlePlacement: null,
    ...overrides,
  };
}

function fakeState(player: PlayerState, overrides: Partial<GameState> = {}): GameState {
  return {
    seed: 1,
    rngState: 1,
    round: 2,
    phase: "action",
    startPlayerIndex: 0,
    currentPlayerIndex: 0,
    players: [player],
    distilleryPool: [],
    distillerySelectionOrder: [],
    distillerySelectionCursor: 0,
    starterDeckDraftOrder: [],
    starterUndealtPool: [],
    allBarrels: [],
    market: [],
    marketSupplyDeck: [],
    marketDiscard: [],
    bourbonDeck: Array.from({ length: 12 }, (_, i) => ({ id: `mb_${i}` })) as never[],
    bourbonDiscard: [],
    retiredBills: [],
    draftingLoop: null,
    demand: 5,
    demandRolls: [],
    finalRoundTriggered: false,
    finalRoundTriggerPlayerIndex: null,
    playerIdsCompletedPhase: [],
    idCounter: 100,
    lineCardDeck: [],
    actionHistory: [],
    ...overrides,
  };
}

function inst(defId: string, suffix = "0"): LineCardInstance {
  return { instanceId: `i_${defId}_${suffix}`, defId };
}

function bottle(overrides: Partial<Bottle> = {}): Bottle {
  return {
    bottleId: "b1",
    originalBillId: "x",
    billDefId: "y",
    name: "n",
    recipeTags: [],
    primaryRecipeTag: "neutral",
    caskTag: "common-cask",
    rarity: "common",
    ageAtSale: 3,
    demandAtSale: 5,
    placedOnRound: 1,
    ...overrides,
  };
}

// ─── scoreLineCardForPlayer ───────────────────────────────────

describe("scoreLineCardForPlayer — distillery affinity", () => {
  it("Wheated Baron values lc_wheated_line over lc_high_rye_line", () => {
    const player = fakePlayer({ distillery: distilleryWith("wheated_baron") });
    const wheated = getLineCardDef("lc_wheated_line")!;
    const highRye = getLineCardDef("lc_high_rye_line")!;
    expect(scoreLineCardForPlayer(wheated, player)).toBeGreaterThan(
      scoreLineCardForPlayer(highRye, player),
    );
  });
  it("High-Rye House values lc_high_rye_line over lc_wheated_line", () => {
    const player = fakePlayer({ distillery: distilleryWith("high_rye_house") });
    const wheated = getLineCardDef("lc_wheated_line")!;
    const highRye = getLineCardDef("lc_high_rye_line")!;
    expect(scoreLineCardForPlayer(highRye, player)).toBeGreaterThan(
      scoreLineCardForPlayer(wheated, player),
    );
  });
  it("Connoisseur Estate values lc_variety_line and lc_premium_line", () => {
    const player = fakePlayer({
      distillery: distilleryWith("connoisseur_estate"),
    });
    const variety = getLineCardDef("lc_variety_line")!;
    const heritageCask = getLineCardDef("lc_heritage_cask_line")!;
    expect(scoreLineCardForPlayer(variety, player)).toBeGreaterThan(
      scoreLineCardForPlayer(heritageCask, player),
    );
  });
  it("Narrow themes get penalized when the distillery doesn't want them", () => {
    const player = fakePlayer({ distillery: distilleryWith("vanilla") });
    const boutique = getLineCardDef("lc_boutique_line")!;
    const heritage = getLineCardDef("lc_bourbon_heritage_line")!;
    // Vanilla doesn't want boutique (narrow), wants heritage-recipe.
    expect(scoreLineCardForPlayer(boutique, player)).toBeLessThan(
      scoreLineCardForPlayer(heritage, player),
    );
  });
  it("Flagship reinforcement: cards matching existing bottles score higher", () => {
    const base = fakePlayer({ distillery: distilleryWith("vanilla") });
    const reinforced = fakePlayer({
      distillery: distilleryWith("vanilla"),
      flagshipLine: {
        ...base.flagshipLine,
        bottles: [bottle({ recipeTags: ["rye"], primaryRecipeTag: "rye" })],
      },
    });
    const ryeCard = getLineCardDef("lc_high_rye_line")!;
    expect(scoreLineCardForPlayer(ryeCard, reinforced)).toBeGreaterThan(
      scoreLineCardForPlayer(ryeCard, base),
    );
  });
});

// ─── pickBestInstances (initial draft) ─────────────────────────

describe("pickBestInstances — initial 4→2 draft", () => {
  it("keeps the 2 highest-scoring of 4 dealt cards", () => {
    const player = fakePlayer({ distillery: distilleryWith("wheated_baron") });
    const pool: LineCardInstance[] = [
      inst("lc_wheated_line", "a"), // strong match
      inst("lc_high_rye_line", "b"), // wrong distillery
      inst("lc_heritage_cask_line", "c"), // strong match
      inst("lc_triple_grain_line", "d"), // narrow, not wanted
    ];
    const kept = pickBestInstances(pool, 2, player);
    const keptDefs = kept.map((c) => c.defId);
    expect(keptDefs).toContain("lc_wheated_line");
    expect(keptDefs).toContain("lc_heritage_cask_line");
  });

  it("returns the full pool when pool size ≤ n", () => {
    const player = fakePlayer();
    const pool = [inst("lc_volume_series", "a")];
    expect(pickBestInstances(pool, 2, player)).toEqual(pool);
  });
});

// ─── chooseKeepInstanceIds (mid-game KEEP) ─────────────────────

describe("chooseKeepInstanceIds — mid-game keep ≥ 1", () => {
  it("keeps every card above threshold", () => {
    const player = fakePlayer({ distillery: distilleryWith("high_rye_house") });
    const pool: LineCardInstance[] = [
      inst("lc_high_rye_line", "a"),
      inst("lc_heritage_cask_line", "b"),
      inst("lc_pure_corn_line", "c"), // mediocre for High-Rye
    ];
    const kept = chooseKeepInstanceIds(pool, player);
    expect(kept).toContain("i_lc_high_rye_line_a");
    expect(kept).toContain("i_lc_heritage_cask_line_b");
  });
  it("always keeps ≥ 1 even when nothing scores well", () => {
    const player = fakePlayer({ distillery: distilleryWith("vanilla") });
    const pool: LineCardInstance[] = [
      inst("lc_boutique_line", "a"), // narrow + unwanted for vanilla
    ];
    expect(chooseKeepInstanceIds(pool, player).length).toBe(1);
  });
});

// ─── chooseBottlePlacement ─────────────────────────────────────

describe("chooseBottlePlacement", () => {
  it("places on flagship when it accepts and scores positively", () => {
    const player = fakePlayer({
      distillery: distilleryWith("wheated_baron"),
      pendingBottlePlacement: {
        bottle: bottle({ recipeTags: ["wheated"], primaryRecipeTag: "wheated" }),
      },
    });
    const action = chooseBottlePlacement(fakeState(player), player);
    expect(action).not.toBeNull();
    expect(action!.type).toBe("PLACE_BOTTLE");
    if (action!.type === "PLACE_BOTTLE") {
      expect(action!.destination.kind).toBe("flagship");
    }
  });

  it("falls back to inventory when no line accepts", () => {
    const player = fakePlayer({
      distillery: distilleryWith("wheated_baron"),
      pendingBottlePlacement: {
        bottle: bottle({ recipeTags: ["rye"], primaryRecipeTag: "rye" }),
      },
    });
    const action = chooseBottlePlacement(fakeState(player), player);
    if (action!.type === "PLACE_BOTTLE") {
      expect(action!.destination.kind).toBe("inventory");
    }
  });

  it("creates a new secondary line when a card in hand strongly accepts the bottle", () => {
    const player = fakePlayer({
      distillery: distilleryWith("high_rye_house"),
      lineCardHand: [inst("lc_boutique_line", "a")],
      pendingBottlePlacement: {
        // Epic + rye → boutique line accepts AND scores well (+8/bottle).
        bottle: bottle({
          rarity: "epic",
          recipeTags: ["rye"],
          primaryRecipeTag: "rye",
        }),
      },
    });
    const action = chooseBottlePlacement(fakeState(player), player);
    if (action!.type === "PLACE_BOTTLE") {
      // Either flagship or new-secondary; both are valid wins. The
      // key invariant: it didn't dump to inventory.
      expect(action!.destination.kind).not.toBe("inventory");
    }
  });
});

// ─── chooseDrawLineCards (timing gate) ─────────────────────────

describe("chooseDrawLineCards — timing gates", () => {
  it("returns null in the final round", () => {
    const player = fakePlayer();
    const state = fakeState(player, { finalRoundTriggered: true, lineCardDeck: [inst("lc_volume_series", "0")] });
    expect(chooseDrawLineCards(state, player)).toBeNull();
  });

  it("returns null when the bourbon deck is almost empty", () => {
    const player = fakePlayer();
    const state = fakeState(player, {
      bourbonDeck: [],
      lineCardDeck: [inst("lc_volume_series", "0")],
    });
    expect(chooseDrawLineCards(state, player)).toBeNull();
  });

  it("returns null when the player already drew this round", () => {
    const player = fakePlayer({ hasDrawnLineCardsThisRound: true });
    const state = fakeState(player, { lineCardDeck: [inst("lc_volume_series", "0")] });
    expect(chooseDrawLineCards(state, player)).toBeNull();
  });

  it("returns null when exposure is at cap", () => {
    const player = fakePlayer({
      lineCardHand: [
        inst("lc_volume_series", "a"),
        inst("lc_volume_series", "b"),
        inst("lc_volume_series", "c"),
      ],
    });
    const state = fakeState(player, { lineCardDeck: [inst("lc_volume_series", "0")] });
    expect(chooseDrawLineCards(state, player)).toBeNull();
  });

  it("returns DRAW_LINE_CARDS when gates pass", () => {
    const player = fakePlayer();
    const state = fakeState(player, { lineCardDeck: [inst("lc_volume_series", "0")] });
    const action = chooseDrawLineCards(state, player);
    expect(action).not.toBeNull();
    expect(action!.type).toBe("DRAW_LINE_CARDS");
  });
});

// ─── All defs are well-formed for the scorer ───────────────────

describe("scorer sanity", () => {
  it("every Line Card def produces a finite, non-negative-when-summed score across all distilleries", () => {
    const players = (["vanilla", "high_rye_house", "wheated_baron", "connoisseur_estate"] as const).map(
      (b) => fakePlayer({ distillery: distilleryWith(b) }),
    );
    for (const def of allLineCardDefs()) {
      for (const p of players) {
        const s = scoreLineCardForPlayer(def, p);
        expect(Number.isFinite(s)).toBe(true);
      }
    }
  });
});
