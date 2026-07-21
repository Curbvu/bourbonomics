import { describe, expect, it } from "vitest";
import { CONFIG } from "../config";
import { fit } from "../fit";
import { SUITS, SUIT_ACTIONS, type Suit } from "../types";
import { ACTION_DECK_SIZE, buildActionDeck } from "./actionDeck";
import { buildBourbonDefs } from "./bourbons";
import { buildTileDefs, demandTileDefs } from "./tiles";

describe("action deck (brief v3 §5, §14c)", () => {
  const deck = buildActionDeck();

  it("is 45 cards with unique ids", () => {
    expect(deck.length).toBe(ACTION_DECK_SIZE);
    expect(new Set(deck.map((c) => c.id)).size).toBe(45);
  });

  it("has cards in every suit", () => {
    for (const suit of SUITS) expect(deck.some((c) => c.suit === suit)).toBe(true);
  });

  it("Push lives only in SALES; Bid never shares a suit with Push (§17.8)", () => {
    const pushSuits = SUITS.filter((s) => SUIT_ACTIONS[s].includes("PUSH"));
    const bidSuits = SUITS.filter((s) => SUIT_ACTIONS[s].includes("BID"));
    expect(pushSuits).toEqual(["SALES"]);
    expect(pushSuits.some((s) => bidSuits.includes(s as Suit))).toBe(false);
  });

  it("Refresh lives only in DISTILL (breadth-2 Bid + Refresh)", () => {
    const refreshSuits = SUITS.filter((s) => SUIT_ACTIONS[s].includes("REFRESH"));
    expect(refreshSuits).toEqual(["DISTILL"]);
    expect(SUIT_ACTIONS.DISTILL).toEqual(["BID", "REFRESH"]);
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
    expect(all.find((t) => t.name === "Rye Country")!.tags.length).toBe(2);
    expect(all.find((t) => t.name === "Wheat Country")!.tags.length).toBe(2);
  });

  it("has 41 tiles (copies expanded)", () => {
    expect(all.length).toBe(41);
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
