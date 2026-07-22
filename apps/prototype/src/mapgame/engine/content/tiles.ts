// Bourbonomics: Map Game — tile content (brief v4 §15b).
//
// 45 non-blocking copies (13 Capital = 29%, 12 token = 27%, 20 plain = 44%).
// Ordinary demand tiles lean on ANYGRAIN / ANYBATCH wildcards (the combat floor).
// WILDCARD tiles (LOYALTY/KEYSTONE) carry an ownership slot and an owner Push
// defense bonus; every other tile uses plain LIVE-DP control. Blocking tiles hold
// no DPs and wall the board. Age demand caps at 15. All [PH].

import { CONFIG } from "../config";
import {
  age,
  anyBatch,
  anyGrain,
  bonded,
  premium,
  rye,
  singleBarrel,
  traditional,
  wheat,
  type Tag,
} from "../tags";
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
  { category: "PURE_PREFERENCE", name: "Traditional Drinkers", tags: [anyGrain(), age(2)], copies: 2 },
  { category: "PURE_PREFERENCE", name: "Rye Drinkers", tags: [rye(), age(2)], copies: 2 },
  { category: "PURE_PREFERENCE", name: "Wheat Drinkers", tags: [wheat(), age(2)], copies: 2 },
  { category: "PURE_PREFERENCE", name: "Rye Country", tags: [rye(), rye(), age(4)], copies: 1, reward: tok("DISTRIBUTION") },
  { category: "PURE_PREFERENCE", name: "Wheat Country", tags: [wheat(), wheat(), age(4)], copies: 1, reward: tok("SOURCING") },
  { category: "PURE_PREFERENCE", name: "Home Bar", tags: [anyGrain(), age(4)], copies: 1, reward: cap(1) },
  { category: "PURE_PREFERENCE", name: "Craft Scene", tags: [anyGrain(), anyBatch(), age(4)], copies: 1, reward: tok("SOURCING") },

  // ── OFF-PREMISE ──
  { category: "OFF_PREMISE", name: "Grocery Store", tags: [anyGrain(), age(4)], copies: 2 },
  { category: "OFF_PREMISE", name: "Corner Liquor", tags: [anyGrain(), age(2)], copies: 2 },
  { category: "OFF_PREMISE", name: "Big-Box Retail", tags: [anyGrain(), age(4)], copies: 2 },
  { category: "OFF_PREMISE", name: "Warehouse Club", tags: [anyGrain(), anyBatch(), age(4)], copies: 2 },
  { category: "OFF_PREMISE", name: "Bottle Shop", tags: [anyBatch(), age(6)], copies: 1, reward: cap(1) },
  { category: "OFF_PREMISE", name: "Specialty Store", tags: [rye(), bonded(), age(8)], copies: 1, reward: cap(2) },
  { category: "OFF_PREMISE", name: "Premium Retailer", tags: [wheat(), premium(), age(12)], copies: 1, reward: cap(2) },
  { category: "OFF_PREMISE", name: "Package Store", tags: [anyGrain(), age(4)], copies: 1, reward: cap(1) },
  { category: "OFF_PREMISE", name: "Gas Station", tags: [anyGrain(), age(2)], copies: 1, reward: cap(1) },
  { category: "OFF_PREMISE", name: "Discount Chain", tags: [anyGrain(), age(4)], copies: 1, reward: tok("DISTRIBUTION") },

  // ── ON-PREMISE ──
  { category: "ON_PREMISE", name: "Bar", tags: [anyGrain(), age(2)], copies: 2 },
  { category: "ON_PREMISE", name: "Cocktail Lounge", tags: [anyGrain(), anyBatch(), age(4)], copies: 2 },
  { category: "ON_PREMISE", name: "Speakeasy", tags: [rye(), bonded(), age(8)], copies: 1, reward: tok("SALES") },
  { category: "ON_PREMISE", name: "Fine Dining", tags: [wheat(), premium(), age(12)], copies: 1, reward: tok("DISTILL") },
  { category: "ON_PREMISE", name: "Tavern", tags: [anyGrain(), age(2)], copies: 1, reward: cap(1) },
  { category: "ON_PREMISE", name: "Sports Bar", tags: [anyGrain(), anyBatch(), age(2)], copies: 1, reward: cap(1) },

  // ── EXPERIENTIAL ──
  { category: "EXPERIENTIAL", name: "Distillery Tour", tags: [anyBatch(), premium(), bonded(), age(8)], copies: 1, reward: tok("MARKETING") },
  { category: "EXPERIENTIAL", name: "Tasting Room", tags: [wheat(), premium(), age(8)], copies: 1, reward: cap(1) },
  { category: "EXPERIENTIAL", name: "Gift Shop Exclusive", tags: [premium(), singleBarrel(), bonded(), age(12)], copies: 1, reward: cap(3) },
  { category: "EXPERIENTIAL", name: "Duty-Free", tags: [wheat(), premium(), age(15)], copies: 1, reward: tok("DISTILL") },

  // ── EXPORT ──
  { category: "EXPORT", name: "Export - Asia", tags: [singleBarrel(), premium(), age(12)], copies: 1, reward: tok("BUSINESS_DEV") },
  { category: "EXPORT", name: "Export - Japan", tags: [wheat(), premium(), age(15)], copies: 1, reward: cap(3) },
  { category: "EXPORT", name: "Export - Europe", tags: [wheat(), premium(), age(12)], copies: 1, reward: tok("BUSINESS_DEV") },
  { category: "EXPORT", name: "Collector Auction", tags: [rye(), singleBarrel(), premium(), age(15)], copies: 1, reward: cap(3) },

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

/** Reward-bearing ("BONUS") demand tiles — the pool the 3-tile seed line draws
 *  from (brief §5.1). Excludes blocking and plain (reward-less) tiles. */
export function bonusTileDefs(): TileDef[] {
  return demandTileDefs().filter((t) => t.reward !== null);
}
