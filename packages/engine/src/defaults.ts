import type { Card, InvestmentCard, MashBill, StarterBillKey } from "./types";
import {
  makeCapitalCard,
  makeMashBill,
  makePremiumCapital,
  makePremiumResource,
  makeResourceCard,
} from "./cards";

// ============================================================
// Starter mash bills (v2.4) — NOT part of the Bourbon deck. Used
// only for distillery starting barrels. Three "basic" bills cover
// the workhorse, high-rye, and wheated lanes; pre-aged starting
// barrels ship with one of these attached.
// ============================================================

export function buildStarterMashBill(key: StarterBillKey, instance: number): MashBill {
  const specs: Record<StarterBillKey, Parameters<typeof makeMashBill>[0]> = {
    workhorse: {
      defId: "starter_workhorse",
      name: "Backroad Batch",
      slogan: "Built for the long haul.",
      flavorText: "A ship-it-anyway corn-rye workhorse. The bill the founder cooked first.",
      tier: "common",
      ageBands: [2, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [1, 2, 3],
        [2, 3, 4],
        [3, 4, 5],
      ],
    },
    high_rye_basic: {
      defId: "starter_high_rye",
      name: "House High-Rye",
      slogan: "Pepper, pepper, pepper.",
      flavorText: "The estate's standing high-rye recipe. Pungent and predictable.",
      tier: "common",
      ageBands: [2, 4, 6],
      demandBands: [3, 5, 7],
      rewardGrid: [
        [1, 2, 3],
        [2, 4, 5],
        [3, 5, 6],
      ],
      recipe: { minRye: 2 },
    },
    wheated_basic: {
      defId: "starter_wheated",
      name: "Soft Front",
      slogan: "Smooth from the first drop.",
      flavorText: "House wheated bill — the gentle pour.",
      tier: "common",
      ageBands: [2, 4, 6],
      demandBands: [2, 4, 6],
      rewardGrid: [
        [1, 2, 3],
        [2, 3, 5],
        [3, 4, 6],
      ],
      recipe: { minWheat: 1, maxRye: 0 },
    },
  };
  return makeMashBill(specs[key], instance);
}

// ============================================================
// Investment catalog — display-only stub for v2.1. The mechanic ships
// in v2.2; cards in this catalog appear in the MarketCenter Investments
// subsection so the slot is visible and themed.
// Names + slogans ported from the dev branch's investment_catalog.yaml.
// ============================================================

export function defaultInvestmentCatalog(): InvestmentCard[] {
  const specs: Omit<InvestmentCard, "id">[] = [
    {
      defId: "grain_elevator",
      name: "Grain Elevator",
      capital: 2,
      cost: 4,
      short: "Cheap market bump",
      effect:
        "While active, once per round your market buy draws one extra resource card on that action.",
      tier: "cheap",
    },
    {
      defId: "family_recipe",
      name: "Family Recipe",
      capital: 2,
      cost: 4,
      short: "One cheaper action",
      effect:
        "Your very next distillery action this round costs $1 less (minimum $0).",
      tier: "cheap",
    },
    {
      defId: "tourism_board",
      name: "Tourism Board Seat",
      capital: 3,
      cost: 5,
      short: "First paid action cheaper",
      effect: "The first paid action you take each round costs $1 less.",
      tier: "cheap",
    },
    {
      defId: "rickhouse_expansion",
      name: "Rickhouse Expansion",
      capital: 3,
      cost: 6,
      short: "Lighter rent each round",
      effect:
        "Once per round subtract $1 from your total rickhouse fees (minimum $0).",
      tier: "cheap",
    },
    {
      defId: "second_shift",
      name: "Second Shift",
      capital: 3,
      cost: 5,
      short: "Standard cheap-action repeat",
      effect: "Your very next distillery action this round costs $1 less.",
      tier: "cheap",
    },
    {
      defId: "climate_tier",
      name: "Climate-Controlled Tier",
      capital: 5,
      cost: 8,
      short: "Steady aging, steadier books",
      effect:
        "First paid action each round costs $1 less AND once per round shave $1 off rickhouse fees.",
      tier: "medium",
    },
    {
      defId: "private_label",
      name: "Private Label Deal",
      capital: 6,
      cost: 9,
      short: "Premium sale bump",
      effect: "Once per round, your next sale gains +$2 reputation.",
      tier: "medium",
    },
    {
      defId: "master_blender",
      name: "Master Blender",
      capital: 7,
      cost: 10,
      short: "Mash-bill recipe relief",
      effect: "Your wheated and high-rye recipes need 1 fewer matching grain.",
      tier: "medium",
    },
    {
      defId: "press_circuit",
      name: "Press Circuit",
      capital: 10,
      cost: 14,
      short: "Demand pumper",
      effect:
        "Once per round, before rolling demand you may add +1 to the result (capped at 12).",
      tier: "expensive",
    },
    {
      defId: "private_warehouse",
      name: "Private Warehouse",
      capital: 11,
      cost: 16,
      short: "+1 rickhouse slot",
      effect:
        "Adds a permanent +1 slot to your rickhouse.",
      tier: "expensive",
    },
    {
      defId: "barrel_cooperage",
      name: "Barrel Cooperage",
      capital: 12,
      cost: 17,
      short: "Free a cask each barrel",
      effect:
        "Once per round, when you Make Bourbon, one cask returns to your hand instead of discard.",
      tier: "expensive",
    },
    {
      defId: "national_brand",
      name: "National Brand",
      capital: 12,
      cost: 18,
      short: "Late-game scoring engine",
      effect:
        "At end of game, gain +1 reputation per barrel you sold (caps at +10).",
      tier: "expensive",
    },
  ];
  return specs.map((s, i) => ({ ...s, id: `inv_${s.defId}_${i}` }));
}

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
    // Names + slogans inspired by the dev branch's bourbon_cards.yaml.
    makeMashBill(
      {
        defId: "knobs_end_90",
        name: "Knob's End 90",
        slogan: "Last knob in the rack.",
        flavorText: "Bottled barrel-proof, sold at 90. The end of a long dump day.",
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
        defId: "bardstown_boiler",
        name: "Bardstown Boiler",
        slogan: "Where the steam never sleeps.",
        flavorText: "Bardstown's main street, bottled. Workhorse pour at weeknight pricing.",
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
        defId: "rye_ladder_95",
        name: "Rye Ladder 95",
        slogan: "Climb to the spice.",
        flavorText: "Ninety-five percent rye — pepper, mint, and a long ladder down the throat.",
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
        slogan: "Soft, slow, certain.",
        flavorText: "Wheated mash bill that doesn't argue.",
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
        defId: "mash_bill_no_7",
        name: "Mash Bill No. 7",
        slogan: "Lucky number, regular price.",
        flavorText: "Reliable corn-rye-malt at 70/20/10. The seventh recipe, the first standard.",
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
        defId: "high_rickhouse_select",
        name: "High Rickhouse Select",
        slogan: "Top of the rack, top of the bill.",
        flavorText: "Pulled from the seventh story. Hotter summers, faster aging, premium ask.",
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
        defId: "stave_and_story",
        name: "Stave & Story",
        slogan: "One barrel, one tale.",
        flavorText: "Each stave numbered, each pour narrated.",
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
        defId: "warehouse_e_batch",
        name: "Warehouse E Batch",
        slogan: "E for excellent. Or extra.",
        flavorText: "Whatever the rickhouse manager grabbed last. Consistent enough to ship.",
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
    // ────────── Extended pool — keeps the bourbon deck stocked ──────────
    makeMashBill(
      {
        defId: "mammoth_cave_malt",
        name: "Mammoth Cave Malt",
        slogan: "Aged in the dark.",
        flavorText: "Limestone water, malted barley, and one very large echo.",
        tier: "common",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 3, 4],
          [2, 4, 5],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "limestone_ledger",
        name: "Limestone Ledger",
        slogan: "Filtered through Kentucky.",
        flavorText: "Hard water, soft mouthfeel, accountant's clarity.",
        tier: "common",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 2],
          [2, 3, 4],
          [3, 4, 5],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "foggy_bottom_forge",
        name: "Foggy Bottom Forge",
        slogan: "Distilled in the river fog.",
        flavorText: "Bottled when the cooper couldn't see the next building.",
        tier: "common",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [1, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "cornbread_line",
        name: "Cornbread Line",
        slogan: "Sweet, hot, simple.",
        flavorText: "Eighty percent corn, twenty percent everything else.",
        tier: "common",
        ageBands: [2, 4, 6],
        demandBands: [2, 4, 6],
        rewardGrid: [
          [2, 2, 3],
          [2, 3, 4],
          [3, 4, 5],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "charred_oak_exchange",
        name: "Charred Oak Exchange",
        slogan: "Trade in the burn.",
        flavorText: "A blender's standby — char level four, vanilla up front.",
        tier: "uncommon",
        ageBands: [2, 4, 7],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [1, 3, 4],
          [2, 4, 5],
          [3, 5, 7],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "riverbend_rye_signal",
        name: "Riverbend Rye Signal",
        slogan: "When the rye whistles, drink.",
        flavorText: "Spicy rye-forward bend with a citrus undercurrent.",
        tier: "uncommon",
        ageBands: [3, 5, 7],
        demandBands: [3, 5, 7],
        rewardGrid: [
          [1, 3, 4],
          [2, 4, 6],
          [3, 5, 7],
        ],
        recipe: { minRye: 2 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "barley_bastion",
        name: "Barley Bastion",
        slogan: "Holding the malt line.",
        flavorText: "Barley-heavy pot still that refuses to be subtle.",
        tier: "uncommon",
        ageBands: [3, 5, 7],
        demandBands: [3, 5, 7],
        rewardGrid: [
          [2, 3, 4],
          [3, 4, 5],
          [3, 5, 6],
        ],
        recipe: { minBarley: 2 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "coopers_quorum",
        name: "Cooper's Quorum",
        slogan: "Five staves agreed.",
        flavorText: "Built by hand, voted on by committee. The cooperage's house pour.",
        tier: "rare",
        ageBands: [3, 5, 7],
        demandBands: [3, 6, 8],
        rewardGrid: [
          [2, 3, 5],
          [3, 5, 7],
          [4, 6, 8],
        ],
        silverAward: { minAge: 5 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "two_charring_points",
        name: "Two Charring Points",
        slogan: "Twice toasted, never burnt.",
        flavorText: "Char two on the staves, char three on the heads.",
        tier: "rare",
        ageBands: [4, 6, 8],
        demandBands: [3, 6, 8],
        rewardGrid: [
          [2, 4, 5],
          [3, 5, 7],
          [4, 6, 9],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "angels_trace",
        name: "Angel's Trace",
        slogan: "What evaporated, signed in.",
        flavorText: "The barrel left a watermark in the air. The bottle preserves what stayed.",
        tier: "rare",
        ageBands: [4, 6, 8],
        demandBands: [4, 6, 9],
        rewardGrid: [
          [2, 3, 5],
          [3, 5, 7],
          [4, 7, 9],
        ],
        silverAward: { minAge: 6, minDemand: 6 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "bonded_and_bold",
        name: "Bonded & Bold",
        slogan: "Four years, one distillery, one season.",
        flavorText: "Bottled-in-bond standard with a heavier proof.",
        tier: "epic",
        ageBands: [4, 6, 8],
        demandBands: [4, 6, 9],
        rewardGrid: [
          [3, 5, 7],
          [4, 7, 9],
          [5, 8, 11],
        ],
        silverAward: { minAge: 6 },
        goldAward: { minAge: 8, minDemand: 8 },
      },
      0,
    ),
  ];
}

// ============================================================
// Default market supply — premium and capital cards.
// ============================================================

export function defaultMarketSupply(): Card[] {
  // Mirrors `packages/engine/content/resources.yaml`. See that file for
  // per-card design notes. Distribution intent: commons majority,
  // uncommons meaningful minority, rares very rare (1 copy each).
  //
  // Themed-card effects are wired here via `card.effect` and resolved
  // by `src/card-effects.ts` at the appropriate commit/sale/spend
  // window (see `Barrel.productionCards` / `Barrel.gridRepOffset` for
  // the persistent state used by sale-time math).
  const cards: Card[] = [];
  let idx = 0;

  // ── Commons (majority): 1-of-subtype basics + $1 capitals ────────
  for (let i = 0; i < 6; i++) cards.push(makeResourceCard("cask", "supply", idx++));
  for (let i = 0; i < 6; i++) cards.push(makeResourceCard("corn", "supply", idx++));
  for (let i = 0; i < 6; i++) cards.push(makeResourceCard("rye", "supply", idx++));
  for (let i = 0; i < 5; i++) cards.push(makeResourceCard("barley", "supply", idx++));
  for (let i = 0; i < 5; i++) cards.push(makeResourceCard("wheat", "supply", idx++));
  for (let i = 0; i < 6; i++) cards.push(makeCapitalCard("supply", idx++));

  // ── Uncommons (minority): named themed premiums ─────────────────
  // Barley · Engine acceleration
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "two_row_barley",
        displayName: "Two-Row Barley",
        flavor: "A leaner stalk, cycles your hand.",
        subtype: "barley",
        resourceCount: 1,
        cost: 3,
        effect: { kind: "draw_cards", when: "on_commit_production", n: 1 },
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "malted_barley",
        displayName: "Malted Barley",
        flavor: "Sweet conversion mid-aging.",
        subtype: "barley",
        resourceCount: 1,
        cost: 3,
        effect: { kind: "draw_cards", when: "on_commit_aging", n: 1 },
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "heritage_barley",
        displayName: "Heritage Barley",
        flavor: "Heirloom strain, double yield.",
        subtype: "barley",
        resourceCount: 2,
        cost: 5,
        effect: { kind: "draw_cards", when: "on_commit_production", n: 1 },
        index: idx++,
      }),
    );

  // Wheat · Time manipulation
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "soft_red_wheat",
        displayName: "Soft Red Wheat",
        flavor: "A barrel born already aging.",
        subtype: "wheat",
        resourceCount: 1,
        cost: 4,
        effect: { kind: "barrel_starts_aged", when: "on_commit_production", age: 1 },
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "winter_wheat",
        displayName: "Winter Wheat",
        flavor: "Two winters in one season.",
        subtype: "wheat",
        resourceCount: 1,
        cost: 4,
        effect: { kind: "aging_card_doubled", when: "on_commit_aging", years: 2 },
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "white_wheat",
        displayName: "White Wheat",
        flavor: "Patient grain rewards a long sleep.",
        subtype: "wheat",
        resourceCount: 2,
        cost: 5,
        effect: { kind: "rep_on_sale_if_age_gte", when: "on_sale", age: 5, rep: 1 },
        index: idx++,
      }),
    );

  // Rye · Reputation amplification
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "heritage_rye",
        displayName: "Heritage Rye",
        flavor: "Twice the spice, twice the bag.",
        subtype: "rye",
        resourceCount: 2,
        cost: 4,
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "spicy_rye",
        displayName: "Spicy Rye",
        flavor: "The pepper that lingers in the bottle.",
        subtype: "rye",
        resourceCount: 1,
        cost: 4,
        effect: { kind: "rep_on_sale_flat", when: "on_sale", rep: 1 },
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "high_proof_rye",
        displayName: "High-Proof Rye",
        flavor: "Hot demand, hot rye.",
        subtype: "rye",
        resourceCount: 2,
        cost: 5,
        effect: { kind: "rep_on_sale_if_demand_gte", when: "on_sale", demand: 7, rep: 2 },
        index: idx++,
      }),
    );

  // Cask · Quality
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "toasted_oak",
        displayName: "Toasted Oak",
        flavor: "Reads the demand grid one band higher.",
        subtype: "cask",
        resourceCount: 1,
        cost: 5,
        effect: { kind: "grid_demand_band_offset", when: "on_sale", offset: 1 },
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "heavy_char",
        displayName: "Heavy Char",
        flavor: "Older barrels open up under the burn.",
        subtype: "cask",
        resourceCount: 1,
        cost: 4,
        effect: { kind: "rep_on_sale_if_age_gte", when: "on_sale", age: 4, rep: 2 },
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumResource({
        defId: "used_bourbon_cask",
        displayName: "Used Bourbon Cask",
        flavor: "A second life — back to your hand.",
        subtype: "cask",
        resourceCount: 1,
        cost: 4,
        effect: { kind: "returns_to_hand_on_sale", when: "on_sale" },
        index: idx++,
      }),
    );

  // Capital · Leverage
  for (let i = 0; i < 4; i++)
    cards.push(
      makePremiumCapital({
        defId: "cellar_stipend",
        displayName: "Cellar Stipend",
        flavor: "Two coins for the cooper.",
        capitalValue: 2,
        index: idx++,
      }),
    );
  for (let i = 0; i < 3; i++)
    cards.push(
      makePremiumCapital({
        defId: "brand_loan",
        displayName: "Brand Loan",
        flavor: "Three on credit, due in glory.",
        capitalValue: 3,
        index: idx++,
      }),
    );
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumCapital({
        defId: "bourbon_bond",
        displayName: "Bourbon Bond",
        flavor: "Pay it forward — gain reputation now.",
        capitalValue: 2,
        cost: 5,
        effect: { kind: "rep_on_commit_aging", when: "on_commit_aging", rep: 1 },
        index: idx++,
      }),
    );

  // ── Rares (very rare): 1 copy each ──────────────────────────────
  cards.push(
    makePremiumResource({
      defId: "six_row_barley",
      displayName: "Six-Row Barley",
      flavor: "Endless rows, endless cards.",
      subtype: "barley",
      resourceCount: 2,
      cost: 7,
      effect: {
        kind: "composite",
        effects: [
          { kind: "draw_cards", when: "on_commit_production", n: 2 },
          { kind: "draw_cards", when: "on_sale", n: 1 },
        ],
      },
      index: idx++,
    }),
  );
  cards.push(
    makePremiumResource({
      defId: "heirloom_wheat",
      displayName: "Heirloom Wheat",
      flavor: "A pre-aged barrel that holds the line.",
      subtype: "wheat",
      resourceCount: 2,
      cost: 7,
      effect: {
        kind: "composite",
        effects: [
          { kind: "barrel_starts_aged", when: "on_commit_production", age: 2 },
          { kind: "skip_demand_drop", when: "on_sale" },
        ],
      },
      index: idx++,
    }),
  );
  cards.push(
    makePremiumResource({
      defId: "distillers_reserve_rye",
      displayName: "Distiller's Reserve Rye",
      flavor: "Three bushels, every word a headline.",
      subtype: "rye",
      resourceCount: 3,
      cost: 8,
      effect: {
        kind: "composite",
        effects: [
          { kind: "bump_demand", when: "on_commit_production", delta: 1 },
          { kind: "rep_on_sale_flat", when: "on_sale", rep: 2 },
        ],
      },
      index: idx++,
    }),
  );
  cards.push(
    makePremiumResource({
      defId: "single_barrel_cask",
      displayName: "Single Barrel Cask",
      flavor: "Every band of this barrel pays one more.",
      subtype: "cask",
      resourceCount: 1,
      cost: 7,
      effect: { kind: "grid_rep_offset", when: "on_commit_production", offset: 1 },
      index: idx++,
    }),
  );
  cards.push(
    makePremiumCapital({
      defId: "lenders_note",
      displayName: "Lender's Note",
      flavor: "A reputation discount on every spend.",
      capitalValue: 4,
      cost: 8,
      effect: { kind: "rep_on_market_spend", when: "on_spend", rep: 1 },
      index: idx++,
    }),
  );

  return cards;
}
