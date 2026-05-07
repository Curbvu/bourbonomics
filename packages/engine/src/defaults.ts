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
// Default mash bill catalog — v2.7 difficulty/payoff curve.
// Pool is split roughly into thirds:
//   Tier 1 (starters)    — universal rule only or one easy constraint.
//                          Spread 2-3, peak ≤ 6, payout from age 2.
//   Tier 2 (mid)         — one real constraint. Spread 3-5, peak 8-9,
//                          best payouts at age 4+.
//   Tier 3 (specialty)   — multi-constraint and/or skewed demand. Spread
//                          5-8, peak 10-12, best payouts gated at age 6+.
// Awards correlate with tier (Gold lives almost exclusively in Tier 3).
// ============================================================

export function defaultMashBillCatalog(): MashBill[] {
  return [
    // ──────────────── Tier 1 — Starter bills ────────────────
    // Forgiving payouts, low age thresholds, no recipe constraints
    // beyond the universal rule. Reward range ~2-3, peak ≤ 6.
    makeMashBill(
      {
        defId: "knobs_end_90",
        name: "Knob's End 90",
        slogan: "Last knob in the rack.",
        flavorText: "Bottled barrel-proof, sold at 90. The end of a long dump day.",
        tier: "common",
        complexityTier: 1,
        // 2×2 — gentle payouts, low age threshold.
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 3],
          [3, 4],
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
        complexityTier: 1,
        // 2×2 — universal-rule starter, range 2-4.
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 3],
          [3, 5],
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
        complexityTier: 1,
        // 2×2 — flat starter, payout from age 2.
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 3],
          [3, 5],
        ],
      },
      0,
    ),
    makeMashBill(
      {
        defId: "mammoth_cave_malt",
        name: "Mammoth Cave Malt",
        slogan: "Aged in the dark.",
        flavorText: "Limestone water, malted barley, and one very large echo.",
        tier: "common",
        complexityTier: 1,
        // 2×2 — gentle aging starter; one easy constraint (rye allowed
        // but not required).
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 3],
          [3, 4],
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
        complexityTier: 1,
        // 2×2 — universal rule only, range 2-4.
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 3],
          [3, 4],
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
        complexityTier: 1,
        // 2×2 — older payouts come a notch higher; still no recipe.
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 3],
          [4, 5],
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
        complexityTier: 1,
        // 2×2 — one easy constraint (corn-forward), gentle range.
        ageBands: [2, 4],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 4],
          [3, 5],
        ],
        recipe: { minCorn: 2 },
      },
      0,
    ),

    // ──────────────── Tier 2 — Mid bills ────────────────
    // One real constraint (rye ≥ 2-3, wheat ≥ 1, no rye, etc.). Best
    // payouts pushed to age 4+. Demand bands matter. Spread ~3-5.
    // Peak 8-9. Silver awards live mostly here.
    makeMashBill(
      {
        defId: "wheat_whisper",
        name: "Wheat Whisper",
        slogan: "Soft, slow, certain.",
        flavorText: "Wheated mash bill that doesn't argue.",
        tier: "uncommon",
        complexityTier: 2,
        // 2×3 — demand-driven payout; wheated constraint.
        ageBands: [3, 5],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [2, 4, 5],
          [3, 6, 8],
        ],
        recipe: { minWheat: 1, maxRye: 0 },
        silverAward: { minAge: 5, minDemand: 6 },
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
        complexityTier: 2,
        // 2×3 — needs hot demand AND age to peak; mild rye gate.
        ageBands: [3, 5],
        demandBands: [3, 6, 8],
        rewardGrid: [
          [2, 3, 5],
          [3, 5, 8],
        ],
        recipe: { minRye: 1 },
        silverAward: { minAge: 5 },
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
        complexityTier: 2,
        // 2×3 — flat age curve, demand drives reward; one barley gate.
        ageBands: [3, 5],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [2, 4, 6],
          [3, 5, 8],
        ],
        recipe: { minBarley: 1 },
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
        complexityTier: 2,
        // 2×3 — meaningful rye gate, smoother demand response.
        ageBands: [3, 5],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [2, 4, 5],
          [3, 6, 8],
        ],
        recipe: { minRye: 2 },
        silverAward: { minAge: 5, minDemand: 5 },
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
        complexityTier: 2,
        // 3×2 — aging-forward; demand-modest. Barley constraint.
        ageBands: [2, 4, 6],
        demandBands: [3, 6],
        rewardGrid: [
          [2, 3],
          [4, 6],
          [6, 8],
        ],
        recipe: { minBarley: 2 },
        silverAward: { minAge: 6 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "knob_creek_cousin",
        name: "Knob Creek Cousin",
        slogan: "Aging gracefully, charging accordingly.",
        flavorText: "Two stories down from the namesake. Same patience, friendlier ask.",
        tier: "uncommon",
        complexityTier: 2,
        // 2×3 — wide reward range across demand; gentle rye/barley gate.
        ageBands: [4, 6],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [3, 5, 7],
          [4, 6, 9],
        ],
        recipe: { minRye: 1, minBarley: 1 },
        silverAward: { minAge: 6 },
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
        complexityTier: 2,
        // 3×2 — age-driven, with an upper-end skew.
        ageBands: [4, 6, 8],
        demandBands: [3, 7],
        rewardGrid: [
          [3, 5],
          [4, 7],
          [5, 9],
        ],
        silverAward: { minAge: 6 },
      },
      0,
    ),

    // ──────────────── Tier 3 — Specialty bills ────────────────
    // Multi-constraint or sharply skewed demand. Best payouts gated
    // behind age 6+. Spread ~5-8, peak 10-12. Most Gold awards live
    // here.
    makeMashBill(
      {
        defId: "rye_ladder_95",
        name: "Rye Ladder 95",
        slogan: "Climb to the spice.",
        flavorText: "Ninety-five percent rye — pepper, mint, and a long ladder down the throat.",
        tier: "rare",
        complexityTier: 3,
        // 3×3 — climbs hard with age; high-rye gate.
        ageBands: [3, 5, 7],
        demandBands: [3, 6, 8],
        rewardGrid: [
          [2, 4, 5],
          [3, 6, 8],
          [4, 8, 11],
        ],
        recipe: { minRye: 3 },
        silverAward: { minAge: 5, minDemand: 6 },
        goldAward: { minAge: 7, minDemand: 8 },
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
        complexityTier: 3,
        // 3×3 — three-grain commitment; pays smoothly across demand,
        // peaks at high age.
        ageBands: [3, 5, 7],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [2, 4, 5],
          [3, 6, 8],
          [5, 8, 10],
        ],
        recipe: { minRye: 1, minBarley: 1, minWheat: 1 },
        silverAward: { minAge: 5 },
        goldAward: { minAge: 7, minDemand: 6 },
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
        complexityTier: 3,
        // 3×3 — punishingly age-locked; rewards only above demand 6.
        ageBands: [4, 6, 8],
        demandBands: [3, 6, 9],
        rewardGrid: [
          [2, 4, 6],
          [3, 6, 9],
          [4, 8, 11],
        ],
        recipe: { minWheat: 1, minBarley: 1 },
        silverAward: { minAge: 6, minDemand: 6 },
        goldAward: { minAge: 8, minDemand: 8 },
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
        complexityTier: 3,
        // 3×3 — multi-grain four-way; flagship spread.
        ageBands: [3, 5, 7],
        demandBands: [3, 5, 8],
        rewardGrid: [
          [2, 4, 6],
          [3, 6, 9],
          [4, 8, 11],
        ],
        recipe: { minBarley: 1, minRye: 1, minWheat: 1 },
        silverAward: { minAge: 5 },
        goldAward: { minAge: 7, minDemand: 8 },
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
        complexityTier: 3,
        // 3×3 — age-skewed; only pays huge at age 6+ and demand 8+.
        ageBands: [4, 6, 8],
        demandBands: [3, 6, 8],
        rewardGrid: [
          [2, 5, 7],
          [3, 7, 10],
          [4, 8, 12],
        ],
        recipe: { minBarley: 1, minRye: 1 },
        silverAward: { minAge: 6 },
        goldAward: { minAge: 8, minDemand: 8 },
      },
      0,
    ),
    makeMashBill(
      {
        defId: "wheated_estate",
        name: "Wheated Estate",
        slogan: "Soft on the palate, sharp at the till.",
        flavorText: "An estate-only wheated reserve. Demand a real summer to peak.",
        tier: "epic",
        complexityTier: 3,
        // 3×3 — wheated specialty; sharp demand skew (low demand pays
        // poorly, high demand pays enormously).
        ageBands: [4, 6, 8],
        demandBands: [4, 7, 10],
        rewardGrid: [
          [1, 4, 7],
          [2, 6, 10],
          [3, 8, 12],
        ],
        recipe: { minWheat: 2, maxRye: 0 },
        silverAward: { minAge: 6, minDemand: 7 },
        goldAward: { minAge: 8, minDemand: 10 },
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
        complexityTier: 3,
        // 4×4 — flagship four-grain; the catalog's tallest peak.
        ageBands: [3, 5, 7, 9],
        demandBands: [3, 5, 8, 11],
        rewardGrid: [
          [1, 2, 3, 5],
          [2, 4, 6, 8],
          [4, 6, 9, 11],
          [6, 9, 11, 12],
        ],
        recipe: { minRye: 1, minBarley: 1, minWheat: 1, minTotalGrain: 4 },
        silverAward: { minAge: 7, minDemand: 8 },
        goldAward: { minAge: 8, minDemand: 8, minReward: 9 },
      },
      0,
    ),
  ];
}

// ============================================================
// Default market supply — v2.7 four-band resource economy + 3-tier
// capital ladder.
//
// Resources are sorted into four pricing bands. Recipes read
// `resourceCount` straight through, so a Double counts as 2 units.
// Specialties carry a uniform `+1 reputation on sale` flat bonus —
// luxury upgrades that thicken the payout rather than add bulk:
//
//   Common ($1)             1 unit, basic
//   Double ($3)             2 units
//   Specialty ($3)          1 unit + on-sale +1 rep
//   Double Specialty ($6)   2 units + on-sale +1 rep
//
// Capitals collapse onto $1 / $3 / $5 face values; cost == value.
//
// Distribution intent across the resource portion of the supply:
//   ~50% Common, ~25% Double, ~20% Specialty, ~5% Double Specialty.
//
// The themed-card effects from earlier builds (draw, demand-band
// shift, etc.) are deliberately retired — the v2.7 economy bets
// that a uniform Specialty rule reads cleaner. The effect resolver
// in `card-effects.ts` is unchanged; old card defs simply no longer
// mint here.
// ============================================================

const SPECIALTY_BONUS = {
  kind: "rep_on_sale_flat",
  when: "on_sale",
  rep: 1,
} as const;

interface BandCardSpec {
  defId: string;
  displayName: string;
  flavor: string;
  subtype: "cask" | "corn" | "rye" | "barley" | "wheat";
  copies: number;
}

const DOUBLE_SPECS: BandCardSpec[] = [
  { defId: "double_cask", displayName: "Double Cask", flavor: "Two staves stacked, one barrel filled.", subtype: "cask", copies: 2 },
  { defId: "double_corn", displayName: "Double Corn", flavor: "Sweet load, twice the haul.", subtype: "corn", copies: 2 },
  { defId: "double_rye", displayName: "Double Rye", flavor: "Pepper, doubled.", subtype: "rye", copies: 3 },
  { defId: "double_barley", displayName: "Double Barley", flavor: "The malt house's overshare.", subtype: "barley", copies: 2 },
  { defId: "double_wheat", displayName: "Double Wheat", flavor: "Smooth, then smoother.", subtype: "wheat", copies: 2 },
];

const SPECIALTY_SPECS: BandCardSpec[] = [
  { defId: "superior_cask", displayName: "Superior Cask", flavor: "Hand-picked stave, certified char.", subtype: "cask", copies: 2 },
  { defId: "superior_corn", displayName: "Superior Corn", flavor: "Heirloom kernels, single-farm.", subtype: "corn", copies: 2 },
  { defId: "superior_rye", displayName: "Superior Rye", flavor: "Reserve cut, sharper edge.", subtype: "rye", copies: 2 },
  { defId: "superior_barley", displayName: "Superior Barley", flavor: "Floor-malted, water-blessed.", subtype: "barley", copies: 2 },
  { defId: "superior_wheat", displayName: "Superior Wheat", flavor: "Estate harvest, soft as silk.", subtype: "wheat", copies: 2 },
];

const DOUBLE_SPECIALTY_SPECS: Omit<BandCardSpec, "copies">[] = [
  { defId: "double_superior_cask", displayName: "Double Superior Cask", flavor: "Cooper's two-stave reserve.", subtype: "cask" },
  { defId: "double_superior_rye", displayName: "Double Superior Rye", flavor: "Headline rye, headline pour.", subtype: "rye" },
  { defId: "double_superior_wheat", displayName: "Double Superior Wheat", flavor: "Estate wheat by the bushel.", subtype: "wheat" },
];

export function defaultMarketSupply(): Card[] {
  const cards: Card[] = [];
  let idx = 0;

  // ── Common ($1, 1 unit) — basic 5 subtypes ─────────────────────
  for (let i = 0; i < 5; i++) cards.push(makeResourceCard("cask", "supply", idx++));
  for (let i = 0; i < 5; i++) cards.push(makeResourceCard("corn", "supply", idx++));
  for (let i = 0; i < 5; i++) cards.push(makeResourceCard("rye", "supply", idx++));
  for (let i = 0; i < 5; i++) cards.push(makeResourceCard("barley", "supply", idx++));
  for (let i = 0; i < 5; i++) cards.push(makeResourceCard("wheat", "supply", idx++));

  // ── Double ($3, 2 units) — bulk plays.
  for (const spec of DOUBLE_SPECS) {
    for (let i = 0; i < spec.copies; i++) {
      cards.push(
        makePremiumResource({
          defId: spec.defId,
          displayName: spec.displayName,
          flavor: spec.flavor,
          subtype: spec.subtype,
          resourceCount: 2,
          cost: 3,
          index: idx++,
        }),
      );
    }
  }

  // ── Specialty ($3, 1 unit + Specialty bonus) — luxury upgrades.
  //   Each committed Specialty grants +1 rep on sale.
  for (const spec of SPECIALTY_SPECS) {
    for (let i = 0; i < spec.copies; i++) {
      cards.push(
        makePremiumResource({
          defId: spec.defId,
          displayName: spec.displayName,
          flavor: spec.flavor,
          subtype: spec.subtype,
          resourceCount: 1,
          cost: 3,
          effect: SPECIALTY_BONUS,
          index: idx++,
        }),
      );
    }
  }

  // ── Double Specialty ($6, 2 units + Specialty bonus) — flagship.
  for (const spec of DOUBLE_SPECIALTY_SPECS) {
    cards.push(
      makePremiumResource({
        defId: spec.defId,
        displayName: spec.displayName,
        flavor: spec.flavor,
        subtype: spec.subtype,
        resourceCount: 2,
        cost: 6,
        effect: SPECIALTY_BONUS,
        index: idx++,
      }),
    );
  }

  // ── Capital ladder: $1 / $3 / $5 ─────────────────────────────
  // $1 — basic Petty Cash (also serves as the Common-band capital).
  for (let i = 0; i < 6; i++) cards.push(makeCapitalCard("supply", idx++));
  // $3 — Brand Loan, plain face-value capital.
  for (let i = 0; i < 4; i++)
    cards.push(
      makePremiumCapital({
        defId: "brand_loan",
        displayName: "Brand Loan",
        flavor: "Three on credit, due in glory.",
        capitalValue: 3,
        cost: 3,
        index: idx++,
      }),
    );
  // $5 — House Backer, the big-ticket capital. Cost matches face value.
  for (let i = 0; i < 2; i++)
    cards.push(
      makePremiumCapital({
        defId: "house_backer",
        displayName: "House Backer",
        flavor: "Five at the till, no questions asked.",
        capitalValue: 5,
        cost: 5,
        index: idx++,
      }),
    );

  return cards;
}
