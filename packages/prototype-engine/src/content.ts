// Bourbonomics — PLACEHOLDER content (ground-up rebuild).
//
// Everything here is provisional and exists only so a full game is playable
// end to end. Numbers are illustrative, not balanced. The `placeholder: true`
// flag is stamped on every record. CARD CONTENT is placeholder; the STRUCTURE
// (four-section demand cards, seven-branch departments + ultimates) is real.

import { QUALITIES } from "./types";
import type {
  DemandCard,
  Department,
  DepartmentId,
  DistilleryBoard,
  MashBill,
  Quality,
  ResourceCard,
  ResourceKind,
  StyleTag,
  UltimateId,
} from "./types";
import { CONFIG, batchQtyForRecipe, saleBonusForRecipe } from "./config";

// ---------------------------------------------------------------------
// Style tags — map a mash bill's `expression` to its canonical style tag.
// Demand-card requirements match against this.
// ---------------------------------------------------------------------

const EXPRESSION_STYLE: Record<string, StyleTag> = {
  wheated: "wheat",
  "high-rye": "rye",
  "high-corn": "highCorn",
  "four-grain": "fourGrain",
  bourbon: "classic",
};

export function expressionToStyle(expression: string): StyleTag {
  return EXPRESSION_STYLE[expression] ?? "classic";
}

// ---------------------------------------------------------------------
// Mash bills (~10, varied recipes / styles / batch sizes). No payoff matrix.
// ---------------------------------------------------------------------

interface MashBillDef {
  defId: string;
  name: string;
  slogan?: string;
  traits: string[];
  expression: string;
  /**
   * Every recipe follows the bourbon rule: exactly 1 cask + at least 1 corn +
   * at least 1 grain (rye/wheat/barley), then optional extra grains for
   * complexity. batchQty and the per-sale premium are DERIVED from the recipe's
   * complexity (see config) — not set here — so "more resources ⇒ richer
   * bourbon" stays one loose, tunable rule.
   */
  recipe: Partial<Record<ResourceKind, number>>;
}

const MASH_BILL_DEFS: MashBillDef[] = [
  // ── complexity 3 — the simplest legal bourbons (1 cask + 1 corn + 1 grain) ──
  { defId: "mb_single_barrel", name: "Single Barrel Select", slogan: "One barrel. No apologies.", traits: ["clean"], expression: "bourbon", recipe: { cask: 1, corn: 1, rye: 1 } },
  { defId: "mb_classic", name: "Knob's End 90", slogan: "The bottle on every back bar.", traits: ["balanced"], expression: "bourbon", recipe: { cask: 1, corn: 1, barley: 1 } },
  { defId: "mb_wheat_whisper", name: "Wheat Whisper", slogan: "Soft-spoken, long-remembered.", traits: ["wheated", "smooth"], expression: "wheated", recipe: { cask: 1, corn: 1, wheat: 1 } },
  { defId: "mb_first_rick", name: "First Rick", slogan: "Where every distiller starts.", traits: ["clean", "young"], expression: "bourbon", recipe: { cask: 1, corn: 1, barley: 1 } },
  { defId: "mb_little_rye", name: "Little Rye Riot", slogan: "A small spark of spice.", traits: ["rye-heavy", "spiced"], expression: "high-rye", recipe: { cask: 1, corn: 1, rye: 1 } },
  // ── complexity 4 — an extra grain or extra corn (a richer pour) ──
  { defId: "mb_cornbread", name: "Cornbread Line", slogan: "Straight off the griddle.", traits: ["high-corn", "sweet"], expression: "high-corn", recipe: { cask: 1, corn: 2, barley: 1 } },
  { defId: "mb_stave_story", name: "Stave & Story", slogan: "Every char has a tale.", traits: ["rye-heavy", "spiced"], expression: "high-rye", recipe: { cask: 1, corn: 1, rye: 2 } },
  { defId: "mb_heritage_wheat", name: "Wheated Estate", slogan: "An old name, gently aged.", traits: ["wheated", "heritage"], expression: "wheated", recipe: { cask: 1, corn: 1, wheat: 2 } },
  { defId: "mb_coopers_quorum", name: "Cooper's Quorum", slogan: "Four grains, one vote.", traits: ["complex"], expression: "four-grain", recipe: { cask: 1, corn: 1, rye: 1, wheat: 1 } },
  { defId: "mb_amber_sunday", name: "Amber Sunday", slogan: "Worth waking up slow for.", traits: ["balanced", "smooth"], expression: "bourbon", recipe: { cask: 1, corn: 2, rye: 1 } },
  { defId: "mb_high_meadow", name: "High Meadow Wheat", slogan: "Grassy, golden, unhurried.", traits: ["wheated", "smooth"], expression: "wheated", recipe: { cask: 1, corn: 2, wheat: 1 } },
  { defId: "mb_barley_mow", name: "The Barley Mow", slogan: "A nutty, malt-forward classic.", traits: ["malty", "balanced"], expression: "bourbon", recipe: { cask: 1, corn: 1, barley: 2 } },
  // ── complexity 5 — the rich, premium-paying bourbons ──
  { defId: "mb_bonded_bold", name: "Bonded & Bold", slogan: "100 proof of intent.", traits: ["bonded", "bold"], expression: "bourbon", recipe: { cask: 1, corn: 2, rye: 1, barley: 1 } },
  { defId: "mb_rye_ladder", name: "Rye Ladder 95", slogan: "Climb the spice, rung by rung.", traits: ["rye-heavy", "spiced", "complex"], expression: "high-rye", recipe: { cask: 1, corn: 1, rye: 3 } },
  { defId: "mb_small_batch", name: "Mash Bill No. 7", slogan: "Seven for luck, four for grain.", traits: ["balanced", "complex"], expression: "four-grain", recipe: { cask: 1, corn: 1, rye: 1, wheat: 1, barley: 1 } },
  { defId: "mb_winter_wheat", name: "Winter Wheat Reserve", slogan: "Laid down before the frost.", traits: ["wheated", "heritage", "complex"], expression: "wheated", recipe: { cask: 1, corn: 1, wheat: 3 } },
  { defId: "mb_county_fair", name: "County Fair Gold", slogan: "Blue-ribbon corn, every jar.", traits: ["high-corn", "sweet", "complex"], expression: "high-corn", recipe: { cask: 1, corn: 3, barley: 1 } },
  { defId: "mb_foreman", name: "The Foreman's Cut", slogan: "Built by the floor crew.", traits: ["bold", "complex"], expression: "four-grain", recipe: { cask: 1, corn: 2, rye: 1, wheat: 1 } },
  // ── complexity 6 — the showpieces (top batch size & premium) ──
  { defId: "mb_governors", name: "Governor's Reserve", slogan: "Reserved for the occasion.", traits: ["bonded", "bold", "complex"], expression: "four-grain", recipe: { cask: 1, corn: 2, rye: 1, wheat: 1, barley: 1 } },
  { defId: "mb_centennial", name: "Centennial Rye", slogan: "A hundred years of spice.", traits: ["rye-heavy", "spiced", "complex"], expression: "high-rye", recipe: { cask: 1, corn: 1, rye: 4 } },
  { defId: "mb_masterpiece", name: "Master Distiller's Bill", slogan: "The whole grain library, in one glass.", traits: ["complex", "heritage", "bold"], expression: "four-grain", recipe: { cask: 1, corn: 2, rye: 2, wheat: 1 } },
];

export function buildMashBillSupply(): MashBill[] {
  const bills: MashBill[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const def of MASH_BILL_DEFS) {
      bills.push({
        id: `${def.defId}#${copy}`,
        defId: def.defId,
        name: def.name,
        slogan: def.slogan,
        traits: [...def.traits],
        expression: def.expression,
        styleTag: expressionToStyle(def.expression),
        recipe: { ...def.recipe },
        batchQty: batchQtyForRecipe(def.recipe),
        saleBonus: saleBonusForRecipe(def.recipe),
        placeholder: true,
      });
    }
  }
  return bills;
}

// ---------------------------------------------------------------------
// Resource piles (five, face-down): cask / corn / rye / wheat / barley.
// ---------------------------------------------------------------------

const KIND_LABEL: Record<ResourceKind, string> = {
  cask: "Cask", corn: "Corn", rye: "Rye", wheat: "Wheat", barley: "Barley",
};
/** Tier prefix on a resource's display name (Common has none). */
const QUALITY_PREFIX: Record<Quality, string> = {
  common: "", uncommon: "Select", rare: "Estate", epic: "Reserve", legendary: "Heirloom",
};
function resourceName(kind: ResourceKind, quality: Quality): string {
  const prefix = QUALITY_PREFIX[quality];
  return prefix ? `${prefix} ${KIND_LABEL[kind]}` : KIND_LABEL[kind];
}

export const PILE_KINDS: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];

/** Split a pile's total into per-tier counts (remainder lands in Common). */
function qualityCounts(total: number): Record<Quality, number> {
  const split = CONFIG.PILE_QUALITY_SPLIT;
  const counts = {} as Record<Quality, number>;
  let assigned = 0;
  for (const q of QUALITIES) {
    if (q === "common") continue;
    counts[q] = Math.round(total * split[q]);
    assigned += counts[q];
  }
  counts.common = Math.max(0, total - assigned);
  return counts;
}

/** Build one face-down, type-pure pile seeded with the quality distribution (unshuffled). */
export function buildPile(kind: ResourceKind): ResourceCard[] {
  const total = CONFIG.PILE_COUNTS[kind];
  const counts = qualityCounts(total);
  const cards: ResourceCard[] = [];
  for (const quality of QUALITIES) {
    for (let i = 0; i < counts[quality]; i++) {
      cards.push({
        id: `res_${kind}_${quality}#${i}`,
        defId: `res_${kind}_${quality}`,
        kind,
        quality,
        name: resourceName(kind, quality),
        placeholder: true,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------
// Demand deck — 🚧 PLACEHOLDER content, REAL four-section structure.
// requirement = what fills a slot; orderValue = the On Fill reward (added to
// the bourbon's value before the zone ×1/×2/×3); reputation = the On Completed
// reward kept by the completer.
// ---------------------------------------------------------------------

interface DemandCardDef {
  defId: string;
  label: string;
  requirement: { styleTag?: StyleTag; minAge?: number; quality?: Quality };
  /** Fills per player (1 = player count slots; 2 = twice that). `[PH]`. */
  slotMultiple: number;
  /** Capital added to the bourbon's value before the demand-zone multiplier. `[PH]`. */
  orderValue: number;
  reputation: number;
  count: number;
}

const DEMAND_CARD_DEFS: DemandCardDef[] = [
  { defId: "dm_house", label: "House Pour", requirement: {}, slotMultiple: 2, orderValue: 1, reputation: 2, count: 8 },
  { defId: "dm_corn", label: "Sweet-Corn Craze", requirement: { styleTag: "highCorn" }, slotMultiple: 1, orderValue: 1, reputation: 3, count: 4 },
  { defId: "dm_rye", label: "Rye Revival", requirement: { styleTag: "rye" }, slotMultiple: 1, orderValue: 2, reputation: 3, count: 5 },
  { defId: "dm_wheat", label: "Wheated Wishlist", requirement: { styleTag: "wheat" }, slotMultiple: 1, orderValue: 2, reputation: 3, count: 5 },
  { defId: "dm_fourgrain", label: "Four-Grain Feature", requirement: { styleTag: "fourGrain" }, slotMultiple: 1, orderValue: 3, reputation: 5, count: 3 },
  { defId: "dm_aged", label: "Aged-Stock Order", requirement: { minAge: 4 }, slotMultiple: 1, orderValue: 2, reputation: 4, count: 5 },
  { defId: "dm_premium", label: "Connoisseur Order", requirement: { quality: "rare" }, slotMultiple: 1, orderValue: 3, reputation: 5, count: 4 },
  { defId: "dm_collector", label: "Collector's Cellar", requirement: { quality: "epic", minAge: 6 }, slotMultiple: 1, orderValue: 4, reputation: 8, count: 3 },
];

export function buildDemandDeck(): DemandCard[] {
  const cards: DemandCard[] = [];
  for (const def of DEMAND_CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      cards.push({
        id: `${def.defId}#${i}`,
        defId: def.defId,
        label: def.label,
        requirement: { ...def.requirement },
        slotMultiple: def.slotMultiple,
        slotsActive: def.slotMultiple, // re-set to slotMultiple × players at lay-out
        filledBy: [],
        orderValue: def.orderValue,
        reputation: def.reputation,
        placeholder: true,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------
// Distillery boards — the seven departments on a per-player linear ramp.
// The department MENU (names, effect levels, full ultimate menu) is shared; a
// distillery differs by per-department cost DISCOUNT (which branches are cheap),
// optional starting levels, and which ultimates it OFFERS per branch. All `[PH]`.
// ---------------------------------------------------------------------

/** The full ultimate menu per branch. A distillery offers a subset. */
export const ULTIMATE_MENU: Record<DepartmentId, UltimateId[]> = {
  rickhouse: ["megaExpansion", "climateControlled", "charToast", "doubleMaturation", "warehouseTasting"],
  supply: ["secondReroll", "overflowRoll", "prospector", "tripleThreat"],
  warehouse: ["grandWarehouse", "qualitySort", "longCellar"],
  // Unbuilt branches — ultimate menus are `[PH]` stubs.
  mashFloor: ["ph"],
  marketing: ["ph"],
  distribution: ["ph"],
  countingHouse: ["ph"],
};

const DEPARTMENT_TEMPLATE: Record<
  DepartmentId,
  { name: string; blurb: string; values: number[] }
> = {
  // Base → +1 → +1 → Ultimate (the ultimate step keeps the prior magnitude; the
  // qualitative effect comes from chosenUltimate, applied in the engine).
  rickhouse: { name: "The Rickhouse", blurb: "Total barrel capacity (resting + aging).", values: [3, 4, 5, 5] },
  supply: { name: "The Supply Room", blurb: "Resource dice you roll into the draft each Collect.", values: [5, 6, 7, 7] },
  warehouse: { name: "The Warehouse", blurb: "Loose resource cards you may hold.", values: [5, 6, 7, 7] },
  mashFloor: { name: "The Mash Floor", blurb: "Mash bills you may draw per Draw action.", values: [3, 4, 5, 5] },
  marketing: { name: "Marketing Dept.", blurb: "Demand cards drawn each Demand Phase (shapes the market).", values: [2, 3, 4, 4] },
  distribution: { name: "The Loading Dock", blurb: "Bonus Capital on every sale (sell-side throughput).", values: [0, 1, 2, 3] },
  countingHouse: { name: "The Counting House", blurb: "Capital efficiency — a discount on every improvement.", values: [0, 1, 2, 3] },
};

const DEPARTMENT_ORDER: DepartmentId[] = [
  "rickhouse",
  "supply",
  "warehouse",
  "mashFloor",
  "marketing",
  "distribution",
  "countingHouse",
];

interface DistilleryDef {
  id: string;
  name: string;
  blurb: string;
  /** Per-department Capital discount off the ramp (the asymmetry). `[PH]`. */
  discounts: Partial<Record<DepartmentId, number>>;
  /** Per-department starting level overrides. Omitted = 0. `[PH]`. */
  startLevels: Partial<Record<DepartmentId, number>>;
  /**
   * Ultimates offered per branch (the asymmetric differentiation). Omitted =
   * the full menu for that branch. `[PH]` — for the skeleton most distilleries
   * offer the full menu so every built ultimate is reachable.
   */
  ultimates?: Partial<Record<DepartmentId, UltimateId[]>>;
}

const DISTILLERY_DEFS: DistilleryDef[] = [
  {
    id: "standard",
    name: "Standard Distillery",
    blurb: "Balanced, beginner-friendly — full ultimate menus, no cost tilt.",
    discounts: {},
    startLevels: {},
  },
  {
    id: "oldoak",
    name: "Old Oak Rickhouse",
    blurb: "Patience tilt — cheap Rickhouse; aging & maturation ultimates.",
    discounts: { rickhouse: 1 },
    startLevels: { rickhouse: 1 },
    ultimates: { rickhouse: ["megaExpansion", "climateControlled", "charToast", "doubleMaturation"] },
  },
  {
    id: "ironhill",
    name: "Ironhill Volume",
    blurb: "Throughput tilt — cheap Warehouse & a Supply head start.",
    discounts: { warehouse: 1, supply: 1 },
    startLevels: { supply: 1 },
    ultimates: { supply: ["overflowRoll", "secondReroll", "tripleThreat"], warehouse: ["grandWarehouse", "qualitySort"] },
  },
  {
    id: "ryerevival",
    name: "Rye Revival Co.",
    blurb: "Specialist tilt — cheap Mash Floor; Prospector & Long Cellar.",
    discounts: { mashFloor: 1 },
    startLevels: {},
    ultimates: { supply: ["prospector", "secondReroll", "overflowRoll"], warehouse: ["longCellar", "grandWarehouse", "qualitySort"] },
  },
];

/** Lightweight roster for the new-game picker (no department data). */
export const DISTILLERY_ROSTER = DISTILLERY_DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  blurb: d.blurb,
}));

/** Build a fresh distillery board for the given id (defaults to "standard"). */
export function buildDistilleryBoard(distilleryId = "standard"): DistilleryBoard {
  const def = DISTILLERY_DEFS.find((d) => d.id === distilleryId) ?? DISTILLERY_DEFS[0]!;
  return {
    distilleryId: def.id,
    name: def.name,
    blurb: def.blurb,
    departments: DEPARTMENT_ORDER.map((id): Department => {
      const t = DEPARTMENT_TEMPLATE[id];
      const start = def.startLevels[id] ?? 0;
      const maxLevel = t.values.length - 1;
      return {
        id,
        name: t.name,
        blurb: t.blurb,
        level: Math.min(start, maxLevel),
        maxLevel,
        values: [...t.values],
        discount: def.discounts[id] ?? 0,
        ultimateOptions: def.ultimates?.[id] ?? [...ULTIMATE_MENU[id]],
        chosenUltimate: null,
        ultimatePile: null,
      };
    }),
  };
}
