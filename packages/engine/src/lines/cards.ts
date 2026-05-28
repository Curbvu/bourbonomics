import type { Draft } from "immer";
import type {
  GameState,
  LineCardInstance,
  PlayerState,
} from "../types";
import type { LineCardDef } from "./defs";
import { drawOneFor } from "./boards";

/**
 * Helper: bump the player's prestige by N. Prestige is monotonic
 * (see PlayerState.prestige docs), so this only ever adds.
 */
function addPrestige(player: Draft<PlayerState>, n: number): void {
  player.prestige += n;
}

/** Helper: grant flat rep immediately on placement. */
function addRep(player: Draft<PlayerState>, n: number): void {
  player.reputation += n;
}

/** Helper: bump global demand by N (clamped to 0..12). */
function bumpDemand(draft: Draft<GameState>, n: number): void {
  draft.demand = Math.max(0, Math.min(12, draft.demand + n));
}

/**
 * Cap a line's per-card scoring contribution from a given card so a
 * single high-multiplier card can't run away. `actualCount` is the
 * number of qualifying bottles; `perBottle` is the rep per bottle;
 * `maxBottles` is the cap on counted bottles for this card.
 */
function cappedPerBottle(
  actualCount: number,
  perBottle: number,
  maxBottles: number,
): number {
  return Math.min(actualCount, maxBottles) * perBottle;
}

/**
 * The 25 base-game Line Card definitions.
 *
 * Categories:
 *   - Recipe (8)
 *   - Quality / Cask (5)
 *   - Age / Maturity (5)
 *   - Market / Demand (4)
 *   - Volume / Breadth (3)
 *
 * Cards are referenced by `defId`. Multiple instances of the same
 * defId may exist in the shared deck (see `buildLineCardDeck` for
 * the base copy counts).
 */
const CARDS: LineCardDef[] = [
  // ─── Recipe (8) ──────────────────────────────────────────────
  {
    id: "lc_high_rye_line",
    name: "High-Rye Line",
    flavorText: "Pepper at the front. Always.",
    themeTag: "rye",
    predicate: (b) => b.recipeTags.includes("rye"),
    perBottleBonus: ({ draft, player }) => drawOneFor(draft, player),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.recipeTags.includes("rye")).length,
  },
  {
    id: "lc_wheated_line",
    name: "Wheated Line",
    flavorText: "Soft pour, slow burn.",
    themeTag: "wheated",
    predicate: (b) => b.recipeTags.includes("wheated"),
    perBottleBonus: ({ draft }) => bumpDemand(draft, 1),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.recipeTags.includes("wheated")).length,
  },
  {
    id: "lc_barley_forward_line",
    name: "Barley-Forward Line",
    flavorText: "Toast, bread, butter on the back.",
    themeTag: "barley",
    predicate: (b) => b.recipeTags.includes("barley"),
    // Brief: "gain 1 generic Labor from supply". We don't model an
    // unbounded labor supply mid-action — settle for +1 rep as the
    // closest implementable approximation. Tuned conservatively.
    perBottleBonus: ({ player }) => addRep(player, 1),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.recipeTags.includes("barley")).length,
  },
  {
    id: "lc_pure_corn_line",
    name: "Pure Corn Line",
    flavorText: "Sweetcorn, butter, nothing else.",
    themeTag: "pure-corn",
    predicate: (b) => b.recipeTags.includes("pure-corn"),
    perBottleBonus: ({ player }) => addRep(player, 1),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.recipeTags.includes("pure-corn")).length * 2,
  },
  {
    id: "lc_triple_grain_line",
    name: "Triple Grain Line",
    flavorText: "All three grains — bold flavor.",
    themeTag: "triple-grain",
    predicate: (b) => b.recipeTags.includes("triple-grain"),
    perBottleBonus: ({ draft, player }) => {
      drawOneFor(draft, player);
      drawOneFor(draft, player);
    },
    endGameScore: (line) =>
      line.bottles.filter((b) => b.recipeTags.includes("triple-grain")).length * 5,
  },
  {
    id: "lc_high_rye_tradition_card",
    name: "High-Rye Tradition",
    flavorText: "Three parts pepper to one part everything else.",
    themeTag: "high-rye",
    predicate: (b) => b.recipeTags.includes("high-rye"),
    perBottleBonus: ({ player }) => addPrestige(player, 1),
    endGameScore: (line) =>
      cappedPerBottle(
        line.bottles.filter((b) => b.recipeTags.includes("high-rye")).length,
        3,
        4,
      ),
  },
  {
    id: "lc_bourbon_heritage_line",
    name: "Bourbon Heritage Line",
    flavorText: "Corn-forward classics from the back of the rickhouse.",
    themeTag: "heritage-recipe",
    predicate: (b) =>
      // minCorn >= 3 isn't directly tagged; approximate via NOT
      // pure-corn (which gates ≥4 corn + no grain) and via rarity
      // common/uncommon. The intent is "heritage everyman bills"; the
      // cask grade is not part of this predicate (Heritage Cask Line
      // covers that axis).
      (b.rarity === "common" || b.rarity === "uncommon") &&
      !b.recipeTags.includes("triple-grain"),
    perBottleBonus: () => {
      // No per-placement bonus.
    },
    endGameScore: (line) =>
      line.bottles.filter(
        (b) =>
          (b.rarity === "common" || b.rarity === "uncommon") &&
          !b.recipeTags.includes("triple-grain"),
      ).length,
  },
  {
    id: "lc_single_grain_line",
    name: "Single Grain Line",
    flavorText: "One grain, one voice.",
    themeTag: "single-grain",
    predicate: (b) => b.recipeTags.includes("single-grain"),
    perBottleBonus: ({ player }) => addRep(player, 1),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.recipeTags.includes("single-grain")).length * 2,
  },

  // ─── Quality / Cask (5) ──────────────────────────────────────
  {
    id: "lc_heritage_cask_line",
    name: "Heritage Cask Line",
    flavorText: "Cooper's reserve, decades-seasoned.",
    themeTag: "heritage-cask",
    predicate: (b) => b.caskTag === "heritage-cask",
    perBottleBonus: ({ player }) => addRep(player, 2),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.caskTag === "heritage-cask").length * 2,
  },
  {
    id: "lc_specialty_cask_line",
    name: "Specialty Cask Line",
    flavorText: "Single-farm cooperage upgrades.",
    themeTag: "specialty-cask",
    predicate: (b) => b.caskTag === "specialty-cask",
    perBottleBonus: ({ player }) => addRep(player, 1),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.caskTag === "specialty-cask").length,
  },
  {
    id: "lc_premium_line",
    name: "Premium Line",
    flavorText: "Top-shelf, allocated, hard to find.",
    themeTag: "premium",
    predicate: (b) =>
      b.rarity === "rare" || b.rarity === "epic" || b.rarity === "legendary",
    perBottleBonus: ({ player }) => addPrestige(player, 1),
    endGameScore: (line) =>
      cappedPerBottle(
        line.bottles.filter(
          (b) =>
            b.rarity === "rare" ||
            b.rarity === "epic" ||
            b.rarity === "legendary",
        ).length,
        3,
        4,
      ),
  },
  {
    id: "lc_boutique_line",
    name: "Boutique Line",
    flavorText: "Two bottles a year. Three if the weather holds.",
    themeTag: "boutique",
    predicate: (b) => b.rarity === "epic" || b.rarity === "legendary",
    perBottleBonus: ({ player }) => addPrestige(player, 2),
    endGameScore: (line) =>
      cappedPerBottle(
        line.bottles.filter(
          (b) => b.rarity === "epic" || b.rarity === "legendary",
        ).length,
        8,
        2,
      ),
  },
  {
    id: "lc_common_cask_line",
    name: "Common Cask Line",
    flavorText: "The everyman pour. Cheap and steady.",
    themeTag: "common-cask",
    predicate: (b) => b.caskTag === "common-cask",
    perBottleBonus: () => {
      // No bonus.
    },
    endGameScore: (line) => {
      const matching = line.bottles.filter(
        (b) => b.caskTag === "common-cask",
      ).length;
      return matching + (line.bottles.length >= 4 ? 3 : 0);
    },
  },

  // ─── Age / Maturity (5) ──────────────────────────────────────
  {
    id: "lc_reserve_line",
    name: "Reserve Line",
    flavorText: "Patient stock, ready when called.",
    themeTag: "aged-4",
    predicate: (b) => b.ageAtSale >= 4,
    perBottleBonus: ({ player }) => addRep(player, 1),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.ageAtSale >= 4).length * 2,
  },
  {
    id: "lc_vintage_line",
    name: "Vintage Line",
    flavorText: "Six summers under, every drop earned.",
    themeTag: "aged-6",
    predicate: (b) => b.ageAtSale >= 6,
    perBottleBonus: ({ player }) => addRep(player, 2),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.ageAtSale >= 6).length * 3,
  },
  {
    id: "lc_single_barrel_select",
    name: "Single Barrel Select",
    flavorText: "One stave, one signature.",
    themeTag: "aged-8",
    predicate: (b) => b.ageAtSale >= 8,
    perBottleBonus: ({ player }) => addPrestige(player, 1),
    endGameScore: (line) =>
      cappedPerBottle(
        line.bottles.filter((b) => b.ageAtSale >= 8).length,
        5,
        3,
      ),
  },
  {
    id: "lc_young_stock_line",
    name: "Young Stock Line",
    flavorText: "Bright, hot, ready early.",
    themeTag: "aged-young",
    predicate: (b) => b.ageAtSale >= 2 && b.ageAtSale <= 3,
    perBottleBonus: ({ draft, player }) => drawOneFor(draft, player),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.ageAtSale >= 2 && b.ageAtSale <= 3).length,
  },
  {
    id: "lc_aged_excellence_line",
    name: "Aged Excellence Line",
    flavorText: "Five-plus, and the buyers know it.",
    themeTag: "aged-5",
    predicate: (b) => b.ageAtSale >= 5,
    perBottleBonus: ({ player }) => addPrestige(player, 1),
    endGameScore: (line) => {
      const matching = line.bottles.filter((b) => b.ageAtSale >= 5).length;
      return matching * 2 + (matching >= 3 ? 5 : 0);
    },
  },

  // ─── Market / Demand (4) ─────────────────────────────────────
  {
    id: "lc_high_demand_line",
    name: "High-Demand Line",
    flavorText: "The phone's been ringing for a month.",
    themeTag: "demand-high",
    predicate: (b) => b.demandAtSale >= 7,
    perBottleBonus: ({ player }) => addRep(player, 1),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.demandAtSale >= 7).length * 2,
  },
  {
    id: "lc_counter_cyclical_line",
    name: "Counter-Cyclical Line",
    flavorText: "When the room walks away, we walk in.",
    themeTag: "demand-low",
    predicate: (b) => b.demandAtSale <= 3,
    perBottleBonus: ({ player }) => addRep(player, 2),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.demandAtSale <= 3).length * 2,
  },
  {
    id: "lc_premium_press_line",
    name: "Premium Press Line",
    flavorText: "Reviewed, awarded, allocated.",
    themeTag: "premium-press",
    predicate: (b) =>
      b.demandAtSale >= 5 &&
      (b.rarity === "rare" || b.rarity === "epic" || b.rarity === "legendary"),
    perBottleBonus: ({ player }) => addPrestige(player, 1),
    endGameScore: (line) =>
      cappedPerBottle(
        line.bottles.filter(
          (b) =>
            b.demandAtSale >= 5 &&
            (b.rarity === "rare" ||
              b.rarity === "epic" ||
              b.rarity === "legendary"),
        ).length,
        5,
        3,
      ),
  },
  {
    id: "lc_market_leader_line",
    name: "Market Leader Line",
    flavorText: "First on every shelf this week.",
    themeTag: "demand-leader",
    // Brief calls for "sold at the highest demand this round". We
    // don't track per-round demand maxima yet; approximate with
    // demandAtSale >= 8 (top third of the 0..12 band).
    predicate: (b) => b.demandAtSale >= 8,
    perBottleBonus: ({ player }) => addRep(player, 2),
    endGameScore: (line) =>
      line.bottles.filter((b) => b.demandAtSale >= 8).length * 3,
  },

  // ─── Volume / Breadth (3) ────────────────────────────────────
  {
    id: "lc_volume_series",
    name: "Volume Series",
    flavorText: "More bottles, more shelves.",
    themeTag: "volume",
    predicate: () => true,
    perBottleBonus: () => {
      // No bonus.
    },
    endGameScore: (line) =>
      line.bottles.length + (line.bottles.length >= 5 ? 5 : 0),
  },
  {
    id: "lc_depth_line",
    name: "Depth Line",
    flavorText: "One bill, deep as the well.",
    themeTag: "depth",
    predicate: (b, line) =>
      line.bottles.length === 0 ||
      line.bottles[0]!.primaryRecipeTag === b.primaryRecipeTag,
    perBottleBonus: () => {
      // No bonus.
    },
    endGameScore: (line) => {
      // Each bottle scores rep equal to its 1-based position, capped at 5.
      let total = 0;
      for (let i = 0; i < line.bottles.length; i++) {
        total += Math.min(i + 1, 5);
      }
      return total;
    },
  },
  {
    id: "lc_variety_line",
    name: "Variety Line",
    flavorText: "Different bill, every label.",
    themeTag: "variety",
    predicate: (b, line) =>
      !line.bottles.some((x) => x.primaryRecipeTag === b.primaryRecipeTag),
    perBottleBonus: ({ draft, player }) => drawOneFor(draft, player),
    endGameScore: (line) => {
      const unique = new Set(line.bottles.map((b) => b.primaryRecipeTag));
      return unique.size * 3;
    },
  },
];

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export function getLineCardDef(defId: string): LineCardDef | undefined {
  return BY_ID.get(defId);
}

export function allLineCardDefs(): readonly LineCardDef[] {
  return CARDS;
}

/**
 * Base copies per Line Card defId. The brief calls for ~25 cards in
 * the base game — exactly 25 unique defs with 1 copy each. Future
 * expansions can mint multiples via this table.
 */
const BASE_DECK_COPIES: ReadonlyMap<string, number> = new Map(
  CARDS.map((c) => [c.id, 1] as const),
);

/**
 * Build the initial Line Card deck as instances. Caller is
 * responsible for shuffling. Convention matches `bourbonDeck`:
 * top-of-deck = end of array.
 */
export function buildLineCardInstances(): LineCardInstance[] {
  const out: LineCardInstance[] = [];
  let idx = 0;
  for (const [defId, copies] of BASE_DECK_COPIES.entries()) {
    for (let i = 0; i < copies; i++) {
      out.push({
        instanceId: `lci_${defId}_${idx++}`,
        defId,
      });
    }
  }
  return out;
}
