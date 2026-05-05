import type { Card, MashBill } from "./types";
import { makeCapitalCard, makeMashBill, makeResourceCard } from "./cards";

// ============================================================
// Default starter deck — 16 plain cards.
// 4 cask + 4 corn + 4 grain (2 rye, 1 barley, 1 wheat) + 4 capital.
// ============================================================

export const STARTER_DECK_SIZE = 16;

export function defaultStarterCards(playerLabel: string): Card[] {
  const cards: Card[] = [];
  let idx = 0;
  for (let i = 0; i < 4; i++) cards.push(makeResourceCard("cask", playerLabel, idx++));
  for (let i = 0; i < 4; i++) cards.push(makeResourceCard("corn", playerLabel, idx++));
  for (let i = 0; i < 2; i++) cards.push(makeResourceCard("rye", playerLabel, idx++));
  cards.push(makeResourceCard("barley", playerLabel, idx++));
  cards.push(makeResourceCard("wheat", playerLabel, idx++));
  for (let i = 0; i < 4; i++) cards.push(makeCapitalCard(playerLabel, idx++));
  return cards;
}

// ============================================================
// Default mash bill catalog — handful of varied bills.
// ============================================================

export function defaultMashBillCatalog(): MashBill[] {
  return [
    makeMashBill(
      {
        defId: "backroad_batch",
        name: "Backroad Batch",
        flavorText: "Honest workhorse bill. No surprises, no fireworks.",
        tier: "common",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 4, 5],
          [3, 5, 6],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "quick_pour",
        name: "Quick Pour",
        flavorText: "Rewards moving young product into a hot market.",
        tier: "common",
        ageBands: [2, 3, 5],
        demandBands: [4, 6, 8],
        rewardGrid: [
          [2, 3, 4],
          [3, 4, 5],
          [3, 4, 5],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "high_rye_reserve",
        name: "High Rye Reserve",
        flavorText: "Spicy, demanding, and pays handsomely when it lands.",
        tier: "rare",
        ageBands: [3, 5, 7],
        demandBands: [3, 6, 9],
        rewardGrid: [
          [1, 3, 5],
          [2, 5, 7],
          [3, 6, 9],
        ],
        recipe: { minRye: 3 },
        silverAward: { minAge: 5, minDemand: 6 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "wheat_whisper",
        name: "Wheat Whisper",
        flavorText: "Soft, mellow, and never sees a grain of rye.",
        tier: "uncommon",
        ageBands: [2, 4, 6],
        demandBands: [2, 5, 8],
        rewardGrid: [
          [1, 3, 4],
          [2, 4, 6],
          [3, 5, 7],
        ],
        recipe: { minWheat: 1, maxRye: 0 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "four_grain",
        name: "Four Grain",
        flavorText: "Every grain in the silo, every flavor in the glass.",
        tier: "epic",
        ageBands: [3, 5, 7],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [2, 3, 5],
          [3, 5, 7],
          [4, 6, 8],
        ],
        recipe: { minBarley: 1, minRye: 1, minWheat: 1 },
        silverAward: { minAge: 5 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "veteran_stock",
        name: "Veteran Stock",
        flavorText: "Patience required. Patience rewarded.",
        tier: "legendary",
        ageBands: [4, 6, 8],
        demandBands: [4, 7, 10],
        rewardGrid: [
          [2, 4, 6],
          [4, 7, 10],
          [6, 9, 12],
        ],
        goldAward: { minAge: 8, minDemand: 8, minReward: 9 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "boomtown_blend",
        name: "Boomtown Blend",
        flavorText: "Made for a thirsty city. Quiet years, quiet payouts.",
        tier: "uncommon",
        ageBands: [2, 4, 6],
        demandBands: [5, 7, 9],
        rewardGrid: [
          [null, 2, 3],
          [1, 3, 5],
          [2, 4, 7],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "hollow_oak",
        name: "Hollow Oak",
        flavorText: "Long shelf life. Low ceiling. Reliable.",
        tier: "common",
        ageBands: [2, 5, 8],
        demandBands: [2, 4, 7],
        rewardGrid: [
          [1, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
        ],
        silverAward: { minAge: 8 },
      },
      0,
    ),
  ];
}

// ============================================================
// Default market supply — premium and capital cards.
// ============================================================

export function defaultMarketSupply(): Card[] {
  const cards: Card[] = [];
  let idx = 0;
  // Premium resource cards (2x of a single subtype)
  for (let i = 0; i < 3; i++) cards.push(makeResourceCard("rye", "supply", idx++, true, 2));
  for (let i = 0; i < 3; i++) cards.push(makeResourceCard("corn", "supply", idx++, true, 2));
  for (let i = 0; i < 2; i++) cards.push(makeResourceCard("wheat", "supply", idx++, true, 2));
  for (let i = 0; i < 2; i++) cards.push(makeResourceCard("barley", "supply", idx++, true, 2));
  // High-value capital
  for (let i = 0; i < 4; i++) cards.push(makeCapitalCard("supply", idx++, 2));
  for (let i = 0; i < 2; i++) cards.push(makeCapitalCard("supply", idx++, 3));
  // Plain backups
  for (let i = 0; i < 3; i++) cards.push(makeResourceCard("corn", "supply", idx++));
  for (let i = 0; i < 3; i++) cards.push(makeResourceCard("rye", "supply", idx++));
  for (let i = 0; i < 3; i++) cards.push(makeCapitalCard("supply", idx++));
  return cards;
}
