import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { fit } from "../fit";
import { SUITS, SUIT_ACTIONS, type Suit } from "../types";
import { ACTION_DECK_SIZE, buildActionDeck } from "./actionDeck";
import { buildBourbonDefs, isPremiumDef } from "./bourbons";
import { buildTileDefs, bonusTileDefs, demandTileDefs } from "./tiles";

describe("action deck (brief v3 §5, §14c)", () => {
  const deck = buildActionDeck();

  it("is 45 cards with unique ids", () => {
    expect(deck.length).toBe(ACTION_DECK_SIZE);
    expect(new Set(deck.map((c) => c.id)).size).toBe(45);
  });

  it("has cards in every suit", () => {
    for (const suit of SUITS) expect(deck.some((c) => c.suit === suit)).toBe(true);
  });

  it("Push lives in SALES + MARKETING (brief §6)", () => {
    const pushSuits = SUITS.filter((s) => SUIT_ACTIONS[s].includes("PUSH"));
    expect(pushSuits).toEqual(["SALES", "MARKETING"]);
  });

  it("Refresh NEVER shares a suit with Push (HARD RULE §18.8)", () => {
    const pushSuits = SUITS.filter((s) => SUIT_ACTIONS[s].includes("PUSH"));
    const refreshSuits = SUITS.filter((s) => SUIT_ACTIONS[s].includes("REFRESH"));
    expect(refreshSuits).toEqual(["SOURCING", "DISTILL"]);
    expect(pushSuits.some((s) => refreshSuits.includes(s as Suit))).toBe(false);
  });

  it("every capability appears in EXACTLY 2 suits (brief §6, §18.17)", () => {
    // capability → the action types that realise it
    const CAPS: Record<string, string[]> = {
      DP: ["BUILD_DP", "REPAIR_DP"],
      Push: ["PUSH"],
      Niche: ["ADD_NICHE_FLAG", "REMOVE_NICHE_FLAG"],
      Expand: ["EXPAND_MARKET"],
      Bourbon: ["BID", "REFRESH"],
    };
    for (const [cap, actions] of Object.entries(CAPS)) {
      const suits = SUITS.filter((s) => actions.some((a) => SUIT_ACTIONS[s].includes(a as never)));
      expect(suits.length, `${cap} should be in 2 suits, is in ${suits.join("+")}`).toBe(2);
    }
  });

  it("every card honors the action floor of 2 pips", () => {
    for (const c of deck) expect(c.pips).toBeGreaterThanOrEqual(CONFIG.ACTION_FLOOR);
  });

  it("the initiative icon sits only on low-power cards (pips <= 3)", () => {
    for (const c of deck) if (c.icon) expect(c.pips).toBeLessThanOrEqual(3);
  });
});

describe("tiles (brief v3 §13, §14b)", () => {
  const all = buildTileDefs();
  const demand = demandTileDefs();

  it("blocking tiles are fixed terrain with no tags/rewards", () => {
    const blocking = all.filter((t) => t.category === "BLOCKING");
    expect(blocking.length).toBe(CONFIG.BLOCKING_TILE_COUNT);
    for (const b of blocking) {
      expect(b.tags.length).toBe(0);
      expect(b.reward).toBeNull();
      expect(b.ownershipSlot).toBe(false);
    }
  });

  it("has an ownership slot exactly on LOYALTY + KEYSTONE (WILDCARD) tiles", () => {
    for (const t of all) {
      const isWild = t.category === "LOYALTY" || t.category === "KEYSTONE";
      expect(t.ownershipSlot).toBe(isWild);
      if (isWild) expect(t.tags.length).toBe(0); // wildcard — owner declares
    }
  });

  it("has one Keystone paying an ANY token each age with defense +2", () => {
    const keystones = all.filter((t) => t.category === "KEYSTONE");
    expect(keystones.length).toBe(1);
    expect(keystones[0]!.keystoneTokensPerAge).toBe(CONFIG.KEYSTONE_TOKENS_PER_AGE);
    expect(keystones[0]!.defenseBonus).toBe(CONFIG.DEFENSE_BONUS_KEYSTONE);
    expect(keystones[0]!.reward).toEqual({ kind: "TOKEN", token: "ANY" });
  });

  it("has loyalty tiles: a +2 Cult Following and a converting Word of Mouth", () => {
    const loyal = all.filter((t) => t.category === "LOYALTY");
    expect(loyal.some((t) => t.defenseBonus === CONFIG.DEFENSE_BONUS_CULT_FOLLOWING)).toBe(true);
    expect(loyal.some((t) => t.convertsToLoyalty)).toBe(true);
  });

  it("has the two doubled-grain depth tiles", () => {
    const grainCount = (name: string) =>
      all.find((t) => t.name === name)!.tags.filter((t) => t.kind === "GRAIN").length;
    expect(grainCount("Rye Country")).toBe(2);
    expect(grainCount("Wheat Country")).toBe(2);
  });

  it("has 49 tiles: 45 demand copies + 4 blocking (brief v4 §15b)", () => {
    expect(demand.length).toBe(45);
    expect(all.length).toBe(45 + CONFIG.BLOCKING_TILE_COUNT);
  });
});

describe("bourbons (brief v4 §15a)", () => {
  const bourbons = buildBourbonDefs();

  it("has 25 bourbons, 8 of them premium (32%)", () => {
    expect(bourbons.length).toBe(25);
    expect(bourbons.filter(isPremiumDef).length).toBe(8);
  });

  it("17 non-premium bourbons are draftable at setup", () => {
    expect(bourbons.filter((b) => !isPremiumDef(b)).length).toBe(17);
  });
});

describe("tiles (brief v4 §15b) — reward mix + seed pool", () => {
  const demand = demandTileDefs();

  it("reward mix is 13 Capital + 12 token + 20 plain (45 copies)", () => {
    const capital = demand.filter((t) => t.reward?.kind === "CAPITAL").length;
    const token = demand.filter((t) => t.reward?.kind === "TOKEN").length;
    const plain = demand.filter((t) => t.reward === null).length;
    expect([capital, token, plain]).toEqual([13, 12, 20]);
  });

  it("the seed (BONUS) pool is exactly the reward-bearing demand tiles", () => {
    expect(bonusTileDefs().length).toBe(25); // 13 + 12
    expect(bonusTileDefs().every((t) => t.reward !== null)).toBe(true);
  });

  it("no tile demands AGE above 15 (brief §3 cap)", () => {
    for (const t of demand) {
      for (const tag of t.tags) if (tag.kind === "AGE") expect(tag.value).toBeLessThanOrEqual(15);
    }
  });
});

describe("depth: doubled bourbon vs doubled tile", () => {
  it("Rye Bomb scores 2 on Rye Country, 1 on a single-rye tile", () => {
    const ryeBomb = buildBourbonDefs().find((b) => b.name === "Rye Bomb")!;
    const ryeCountry = buildTileDefs().find((t) => t.name === "Rye Country")!;
    const ryeDrinkers = buildTileDefs().find((t) => t.name === "Rye Drinkers")!; // single [RYE]
    expect(fit(ryeBomb.tags, ryeCountry.tags)).toBe(2);
    expect(fit(ryeBomb.tags, ryeDrinkers.tags)).toBe(1);
  });
});

describe("coverage: every tagged demand tile has a bourbon that fits it", () => {
  it("no tagged demand tile is unservable", () => {
    const bourbons = buildBourbonDefs();
    for (const tile of demandTileDefs()) {
      if (tile.tags.length === 0) continue; // wildcard tiles have no tags
      const best = Math.max(...bourbons.map((b) => fit(b.tags, tile.tags)));
      expect(best, `tile ${tile.name} has no fitting bourbon`).toBeGreaterThan(0);
    }
  });
});
