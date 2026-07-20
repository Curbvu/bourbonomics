// Bourbonomics: Map Game — tile content (brief v3 §14b, §13).
//
// 31 tile kinds (41 tiles with copies). WILDCARD tiles (LOYALTY/KEYSTONE) carry
// an ownership slot and an owner Push-defense bonus; every other tile uses plain
// LIVE-DP control. Blocking tiles hold no DPs and wall the board. All [PH].

import { CONFIG } from "../config";
import { age, bonded, premium, rye, singleBarrel, smallBatch, traditional, wheat, type Tag } from "../tags";
import type { Reward, TileCategory, TileDef, TokenType } from "../types";

const cap = (amount: number): Reward => ({ kind: "CAPITAL", amount });
const tok = (token: TokenType): Reward => ({ kind: "TOKEN", token });

interface Seed {
  category: TileCategory;
  name: string;
  tags: Tag[];
  copies: number;
  reward?: Reward;
  defenseBonus?: number;
  keystoneTokensPerAge?: number;
  convertsToLoyalty?: boolean;
  ownershipSlot?: boolean;
}

const SEEDS: Seed[] = [
  // ── PURE PREFERENCE ──
  { category: "PURE_PREFERENCE", name: "Traditional Drinkers", tags: [traditional()], copies: 2 },
  { category: "PURE_PREFERENCE", name: "Rye Drinkers", tags: [rye()], copies: 2 },
  { category: "PURE_PREFERENCE", name: "Wheat Drinkers", tags: [wheat()], copies: 2 },
  { category: "PURE_PREFERENCE", name: "Rye Country", tags: [rye(), rye()], copies: 1, reward: tok("DISTRIBUTION") },
  { category: "PURE_PREFERENCE", name: "Wheat Country", tags: [wheat(), wheat()], copies: 1, reward: tok("SOURCING") },

  // ── OFF-PREMISE ──
  { category: "OFF_PREMISE", name: "Grocery Store", tags: [traditional(), age(4)], copies: 2 },
  { category: "OFF_PREMISE", name: "Corner Liquor", tags: [traditional()], copies: 2 },
  { category: "OFF_PREMISE", name: "Big-Box Retail", tags: [rye(), traditional(), age(4)], copies: 2 },
  { category: "OFF_PREMISE", name: "Warehouse Club", tags: [traditional(), smallBatch(), age(6)], copies: 2 },
  { category: "OFF_PREMISE", name: "Bottle Shop", tags: [singleBarrel(), age(10)], copies: 1 },
  { category: "OFF_PREMISE", name: "Specialty Store", tags: [rye(), bonded(), age(8)], copies: 1, reward: cap(2) },
  { category: "OFF_PREMISE", name: "Premium Retailer", tags: [wheat(), age(12), premium()], copies: 1, reward: tok("MARKETING") },

  // ── ON-PREMISE ──
  { category: "ON_PREMISE", name: "Bar", tags: [traditional()], copies: 2 },
  { category: "ON_PREMISE", name: "Cocktail Lounge", tags: [rye(), smallBatch()], copies: 2 },
  { category: "ON_PREMISE", name: "Speakeasy", tags: [rye(), bonded(), age(8)], copies: 1, reward: tok("SALES") },
  { category: "ON_PREMISE", name: "Fine Dining", tags: [wheat(), age(12), premium()], copies: 1, reward: tok("DISTILL") },

  // ── EXPERIENTIAL ──
  { category: "EXPERIENTIAL", name: "Distillery Tour", tags: [singleBarrel(), bonded(), premium()], copies: 1, reward: tok("MARKETING") },
  { category: "EXPERIENTIAL", name: "Tasting Room", tags: [wheat(), age(8), premium()], copies: 1, reward: tok("SALES") },
  { category: "EXPERIENTIAL", name: "Gift Shop Exclusive", tags: [singleBarrel(), bonded(), age(10), premium()], copies: 1, reward: cap(3) },
  { category: "EXPERIENTIAL", name: "Duty-Free", tags: [wheat(), age(15), premium()], copies: 1, reward: tok("DISTILL") },

  // ── EXPORT ──
  { category: "EXPORT", name: "Export - Asia", tags: [singleBarrel(), age(12), premium()], copies: 1, reward: tok("BUSINESS_DEV") },
  { category: "EXPORT", name: "Export - Japan", tags: [wheat(), age(18), premium()], copies: 1, reward: cap(2) },
  { category: "EXPORT", name: "Collector Auction", tags: [smallBatch(), age(23), premium()], copies: 1, reward: cap(3) },

  // ── LOYALTY (WILDCARD, ownership slot) ──
  { category: "LOYALTY", name: "Loyal Fanbase", tags: [], copies: 2, defenseBonus: CONFIG.DEFENSE_BONUS_LOYALTY, ownershipSlot: true },
  { category: "LOYALTY", name: "Cult Following", tags: [], copies: 1, reward: cap(2), defenseBonus: CONFIG.DEFENSE_BONUS_CULT_FOLLOWING, ownershipSlot: true },
  { category: "LOYALTY", name: "Word of Mouth", tags: [], copies: 1, reward: tok("SALES"), defenseBonus: CONFIG.DEFENSE_BONUS_LOYALTY, convertsToLoyalty: true, ownershipSlot: true },

  // ── KEYSTONE (State Capital) ──
  { category: "KEYSTONE", name: "State Capital", tags: [], copies: 1, reward: tok("ANY"), defenseBonus: CONFIG.DEFENSE_BONUS_KEYSTONE, keystoneTokensPerAge: CONFIG.KEYSTONE_TOKENS_PER_AGE, ownershipSlot: true },
];

const BLOCKING_NAMES = ["Dry County", "Blue Laws", "Moist County", "Local Option"];

export function buildTileDefs(): TileDef[] {
  const demand: TileDef[] = [];
  let n = 0;
  for (const s of SEEDS) {
    for (let c = 0; c < s.copies; c++) {
      n += 1;
      demand.push({
        defId: `tile_${n}`,
        name: s.name,
        category: s.category,
        tags: s.tags,
        reward: s.reward ?? null,
        defenseBonus: s.defenseBonus ?? 0,
        keystoneTokensPerAge: s.keystoneTokensPerAge ?? 0,
        convertsToLoyalty: s.convertsToLoyalty ?? false,
        ownershipSlot: s.ownershipSlot ?? false,
      });
    }
  }

  const blocking: TileDef[] = BLOCKING_NAMES.slice(0, CONFIG.BLOCKING_TILE_COUNT).map((name, i) => ({
    defId: `block_${i + 1}`,
    name,
    category: "BLOCKING" as const,
    tags: [],
    reward: null,
    defenseBonus: 0,
    keystoneTokensPerAge: 0,
    convertsToLoyalty: false,
    ownershipSlot: false,
  }));

  return [...demand, ...blocking];
}

/** Demand (niche-eligible) tile defs — everything but blocking. */
export function demandTileDefs(): TileDef[] {
  return buildTileDefs().filter((t) => t.category !== "BLOCKING");
}
