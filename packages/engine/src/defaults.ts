import type { Card, Investment, MashBill, OperationsCard, Rickhouse } from "./types.js";
import {
  makeCapitalCard,
  makeInvestment,
  makeMashBill,
  makeOperations,
  makeResourceCard,
} from "./cards.js";

// ============================================================
// Rickhouses — six KY Bourbon Trail regions, total capacity 26.
// ============================================================

export function defaultRickhouses(): Rickhouse[] {
  return [
    { id: "rh_northern", name: "Northern", capacity: 3 },
    { id: "rh_louisville", name: "Louisville", capacity: 5 },
    { id: "rh_central", name: "Central", capacity: 4 },
    { id: "rh_lexington", name: "Lexington", capacity: 5 },
    { id: "rh_bardstown", name: "Bardstown", capacity: 6 },
    { id: "rh_western", name: "Western", capacity: 3 },
  ];
}

// ============================================================
// Default starter deck — 14 plain cards.
// 3 cask + 4 corn + 4 grain (2 rye, 1 barley, 1 wheat) + 3 capital.
// Players are free to specialize during draft (Phase 8).
// ============================================================

export function defaultStarterCards(playerLabel: string): Card[] {
  const cards: Card[] = [];
  let idx = 0;
  for (let i = 0; i < 3; i++) cards.push(makeResourceCard("cask", playerLabel, idx++));
  for (let i = 0; i < 4; i++) cards.push(makeResourceCard("corn", playerLabel, idx++));
  for (let i = 0; i < 2; i++) cards.push(makeResourceCard("rye", playerLabel, idx++));
  cards.push(makeResourceCard("barley", playerLabel, idx++));
  cards.push(makeResourceCard("wheat", playerLabel, idx++));
  for (let i = 0; i < 3; i++) cards.push(makeCapitalCard(playerLabel, idx++));
  return cards;
}

// ============================================================
// Default mash bill catalog — handful of varied bills.
// More diverse content lives in packages/content (Phase 6+).
// ============================================================

export function defaultMashBillCatalog(): MashBill[] {
  return [
    makeMashBill(
      {
        defId: "backroad_batch",
        name: "Backroad Batch",
        flavorText: "Honest workhorse bill. No surprises, no fireworks.",
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
// Default market supply — premium cards available for purchase.
// ============================================================

export function defaultMarketSupply(): Card[] {
  const cards: Card[] = [];
  let idx = 0;
  // Premium resource cards (2x of a single subtype)
  for (let i = 0; i < 3; i++) cards.push(makeResourceCard("rye", "supply", idx++, true, 2));
  for (let i = 0; i < 3; i++) cards.push(makeResourceCard("corn", "supply", idx++, true, 2));
  for (let i = 0; i < 2; i++) cards.push(makeResourceCard("cask", "supply", idx++, true, 2));
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

// ============================================================
// Default investments and operations.
// ============================================================

export function defaultInvestments(): Investment[] {
  return [
    makeInvestment(
      {
        defId: "larger_distillery",
        name: "Larger Distillery",
        flavorText: "More copper, more bourbon.",
        capitalCost: 4,
        effect: { kind: "hand_size_plus", amount: 1 },
      },
      0,
    ),
    makeInvestment(
      {
        defId: "master_distiller",
        name: "Master Distiller",
        flavorText: "Knows when to dump a batch.",
        capitalCost: 3,
        effect: { kind: "free_trash_per_round", amount: 1 },
      },
      0,
    ),
    makeInvestment(
      {
        defId: "bottling_line",
        name: "Bottling Line",
        flavorText: "A little something always set aside.",
        capitalCost: 3,
        effect: { kind: "carry_over_cards", amount: 1 },
      },
      0,
    ),
    makeInvestment(
      {
        defId: "marketing_campaign",
        name: "Marketing Campaign",
        flavorText: "Putting your bottle in every back bar.",
        capitalCost: 5,
        effect: { kind: "demand_plus_per_round", amount: 1 },
      },
      0,
    ),
    makeInvestment(
      {
        defId: "tasting_room",
        name: "Tasting Room",
        flavorText: "Visitors leave with stories — and bottles.",
        capitalCost: 3,
        effect: {
          kind: "capital_to_reputation",
          capitalCost: 1,
          reputationGained: 2,
          perRound: 1,
        },
      },
      0,
    ),
    makeInvestment(
      {
        defId: "storage_expansion",
        name: "Storage Expansion",
        flavorText: "More rickhouse, more time.",
        capitalCost: 4,
        effect: { kind: "free_age_per_round" },
      },
      0,
    ),
    makeInvestment(
      {
        defId: "scout_network",
        name: "Scout Network",
        flavorText: "Always sniffing out the next great mash bill.",
        capitalCost: 2,
        effect: { kind: "draw_mashbill_per_round", amount: 1 },
      },
      0,
    ),
  ];
}

export function defaultOperations(): OperationsCard[] {
  const list: OperationsCard[] = [];
  let idx = 0;
  list.push(
    makeOperations({ defId: "bourbon_boom", name: "Bourbon Boom", effect: { kind: "demand_delta", amount: 2 } }, idx++),
    makeOperations({ defId: "bourbon_boom", name: "Bourbon Boom", effect: { kind: "demand_delta", amount: 2 } }, idx++),
    makeOperations(
      { defId: "bottle_shortage", name: "Bottle Shortage", effect: { kind: "demand_delta", amount: -2 } },
      idx++,
    ),
    makeOperations(
      { defId: "bottle_shortage", name: "Bottle Shortage", effect: { kind: "demand_delta", amount: -2 } },
      idx++,
    ),
    makeOperations(
      { defId: "quality_audit", name: "Quality Audit", effect: { kind: "trash_opponent_hand_card" } },
      idx++,
    ),
    makeOperations(
      { defId: "industry_acquisition", name: "Industry Acquisition", effect: { kind: "steal_from_discard", amount: 1 } },
      idx++,
    ),
    makeOperations(
      { defId: "press_coverage", name: "Press Coverage", effect: { kind: "draw_cards", amount: 3 } },
      idx++,
    ),
    makeOperations(
      { defId: "press_coverage", name: "Press Coverage", effect: { kind: "draw_cards", amount: 3 } },
      idx++,
    ),
  );
  return list;
}
