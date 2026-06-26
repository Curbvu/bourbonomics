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
import { CONFIG } from "./config";

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
   * at least 1 grain (rye/wheat/barley), then optional extra grains. The
   * per-sale premium is DERIVED from complexity; batchQty is derived from the
   * BUILT quality (see config), not the recipe.
   */
  recipe: Partial<Record<ResourceKind, number>>;
  /** Matchable tags; defaults to [styleTag]. Override for multi-tag bourbons. `[PH]`. */
  tags?: StyleTag[];
  /** Off-curve batchQty adjustment vs. the quality baseline (variance). `[PH]`. */
  batchQtyBias?: number;
  /** Prime age window [start,end] (inclusive). Defaults to a complexity-based band. `[PH]`. */
  prime?: [number, number];
}

const MASH_BILL_DEFS: MashBillDef[] = [
  // ── complexity 3 — the simplest legal bourbons (1 cask + 1 corn + 1 grain) ──
  { defId: "mb_single_barrel", name: "Single Barrel Select", slogan: "One barrel. No apologies.", traits: ["clean"], expression: "bourbon", recipe: { cask: 1, corn: 1, rye: 1 }, batchQtyBias: 1 },
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
  { defId: "mb_masterpiece", name: "Master Distiller's Bill", slogan: "The whole grain library, in one glass.", traits: ["complex", "heritage", "bold"], expression: "four-grain", recipe: { cask: 1, corn: 2, rye: 2, wheat: 1 }, batchQtyBias: 1 },
];

export function buildMashBillSupply(): MashBill[] {
  const bills: MashBill[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const def of MASH_BILL_DEFS) {
      // Prime window: explicit, else a complexity-derived band (simple bills
      // drink young, showpieces prime late).
      const complexity = (Object.values(def.recipe) as (number | undefined)[]).reduce<number>((s, n) => s + (n ?? 0), 0);
      const prime: [number, number] = def.prime ?? (complexity <= 3 ? [5, 7] : complexity >= 6 ? [7, 9] : [6, 8]);
      bills.push({
        id: `${def.defId}#${copy}`,
        defId: def.defId,
        name: def.name,
        slogan: def.slogan,
        traits: [...def.traits],
        expression: def.expression,
        styleTag: expressionToStyle(def.expression),
        tags: def.tags ?? [expressionToStyle(def.expression)],
        recipe: { ...def.recipe },
        batchQtyBias: def.batchQtyBias ?? 0,
        primeStart: prime[0],
        primeEnd: prime[1],
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
// Demand deck — 🚧 PLACEHOLDER content, REAL structure.
// requirement = what a bourbon must be to fill a slot; reputation = the Prestige
// kept by whoever completes the card. Each filled slot banks that sale's value
// (age-phase value × zone) — there is no separate per-order bonus.
//
// The deck is ~50% OPEN ("any bourbon") + ~50% GATED (tags / quality / age):
//   • OPEN cards are the no-lockout floor — anyone fills them, low Prestige.
//   • GATED cards are the competition layer — only the matching bourbon fills
//     them, and they keep MORE Prestige (the reason to specialize). Premium
//     cards also gate on harder production (quality+ / age+). All `[PH]`.
// ---------------------------------------------------------------------

interface DemandCardDef {
  defId: string;
  label: string;
  requirement: { tags?: StyleTag[]; minAge?: number; quality?: Quality };
  /** Fills per player (1 = player count slots; 2 = twice that). `[PH]`. */
  slotMultiple: number;
  reputation: number;
  count: number;
}

const DEMAND_CARD_DEFS: DemandCardDef[] = [
  // ── OPEN floor (~50%) — any bourbon, low Prestige, no lockout ──
  { defId: "dm_house", label: "House Pour", requirement: {}, slotMultiple: 1, reputation: 1, count: 10 },
  { defId: "dm_rail", label: "Bar Rail", requirement: {}, slotMultiple: 1, reputation: 2, count: 8 },
  // ── GATED — tag competition layer (higher Prestige) ──
  { defId: "dm_rye", label: "Rye Revival", requirement: { tags: ["rye"] }, slotMultiple: 1, reputation: 4, count: 3 },
  { defId: "dm_wheat", label: "Wheated Wishlist", requirement: { tags: ["wheat"] }, slotMultiple: 1, reputation: 4, count: 3 },
  { defId: "dm_corn", label: "Sweet-Corn Craze", requirement: { tags: ["highCorn"] }, slotMultiple: 1, reputation: 4, count: 2 },
  { defId: "dm_fourgrain", label: "Four-Grain Feature", requirement: { tags: ["fourGrain"] }, slotMultiple: 1, reputation: 5, count: 2 },
  // ── GATED — premium tier (harder production: quality+/age+), top Prestige ──
  { defId: "dm_aged", label: "Aged-Stock Order", requirement: { minAge: 4 }, slotMultiple: 1, reputation: 5, count: 3 },
  { defId: "dm_premium", label: "Connoisseur Order", requirement: { quality: "rare" }, slotMultiple: 1, reputation: 6, count: 2 },
  { defId: "dm_collector", label: "Collector's Cellar", requirement: { quality: "epic", minAge: 6 }, slotMultiple: 1, reputation: 9, count: 2 },
];

export function buildDemandDeck(): DemandCard[] {
  const cards: DemandCard[] = [];
  for (const def of DEMAND_CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      cards.push({
        id: `${def.defId}#${i}`,
        defId: def.defId,
        label: def.label,
        requirement: { ...def.requirement, ...(def.requirement.tags ? { tags: [...def.requirement.tags] } : {}) },
        slotMultiple: def.slotMultiple,
        slotsActive: def.slotMultiple, // re-set to slotMultiple × players at lay-out
        filledBy: [],
        reputation: def.reputation,
        placeholder: true,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------
// Distillery boards — the FIVE departments on a per-player linear ramp.
// The department MENU (names, effect levels, full ultimate menu) is shared; a
// distillery differs by its STARTING STATS (start above or below base, or a
// CAP via a shorter values array), which ultimates it OFFERS per branch, and an
// optional passive signature. All `[PH]`.
// ---------------------------------------------------------------------

/** Branch shape Base → +1 → +1 → Ultimate (Marketing is the shorter Base → +1 → Ultimate). */
const DEPARTMENT_TEMPLATE: Record<
  DepartmentId,
  { name: string; blurb: string; values: number[] }
> = {
  rickhouse: { name: "The Rickhouse", blurb: "Total barrel capacity (resting + aging).", values: [3, 4, 5, 5] },
  supply: { name: "The Supply Room", blurb: "Resource dice you roll into the draft each Collect.", values: [4, 5, 6, 6] },
  warehouse: { name: "The Warehouse", blurb: "Loose resource cards you may hold.", values: [4, 5, 6, 6] },
  mashFloor: { name: "The Mash Floor", blurb: "Mash bills you may draw per Draw action.", values: [2, 3, 4, 4] },
  marketing: { name: "Marketing Dept.", blurb: "Demand cards drawn each Demand Phase; ultimate = a Private Demand Card.", values: [1, 2, 2] },
};

/** The full ultimate menu per branch. A distillery offers a subset. */
export const ULTIMATE_MENU: Record<DepartmentId, UltimateId[]> = {
  rickhouse: ["megaExpansion", "climateControlled", "charToast", "doubleMaturation", "warehouseTasting"],
  supply: ["secondReroll", "overflowRoll", "prospector", "tripleThreat"],
  warehouse: ["grandWarehouse", "qualitySort", "longCellar"],
  mashFloor: ["masterRecipe", "houseBlend", "openBill"],
  marketing: ["privateCard"],
};

const DEPARTMENT_ORDER: DepartmentId[] = ["rickhouse", "supply", "warehouse", "mashFloor", "marketing"];

interface DistilleryDef {
  id: string;
  name: string;
  blurb: string;
  /** Per-department starting LEVEL (start one step in for a strength). Omitted = 0. `[PH]`. */
  startLevels?: Partial<Record<DepartmentId, number>>;
  /**
   * Per-department values-array OVERRIDE — express a starting stat BELOW base (a
   * weakness) or a CAP (a shorter array can't climb as far). Omitted = the
   * shared template. `[PH]`.
   */
  valuesOverride?: Partial<Record<DepartmentId, number[]>>;
  /** Ultimates offered per branch (asymmetry). Omitted = the full menu. `[PH]`. */
  ultimates?: Partial<Record<DepartmentId, UltimateId[]>>;
  /** Passive distillery signature applied in the engine. `[PH]`. */
  signature?: "copperPlus1" | null;
}

// Each non-Standard distillery trades a real weakness (start below base / a cap)
// for a real strength (start above base / signature / offered ultimates). The
// weakness pushes toward the strength's archetype; Standard is the baseline.
const DISTILLERY_DEFS: DistilleryDef[] = [
  {
    id: "standard",
    name: "Standard Distillery",
    blurb: "Balanced generalist — all base stats, full ultimate menus. The tuning baseline.",
  },
  {
    id: "oldoak",
    name: "Old Oak Rickhouse",
    blurb: "Patient & tall — starts with an extra barrel and aging ultimates, but a thin Supply.",
    startLevels: { rickhouse: 1 }, // start Rickhouse 4
    valuesOverride: { supply: [3, 4, 5, 5] }, // weak: start Supply 3
    ultimates: { rickhouse: ["climateControlled", "charToast", "doubleMaturation", "megaExpansion"] },
  },
  {
    id: "ironhill",
    name: "Ironhill Volume",
    blurb: "Volume & churn — big Supply and Warehouse head start, but the Rickhouse caps at 4.",
    startLevels: { supply: 1, warehouse: 1 }, // start Supply 5 & Warehouse 5
    valuesOverride: { rickhouse: [3, 4] }, // weak: Rickhouse capped at 4
    ultimates: { supply: ["overflowRoll", "secondReroll", "tripleThreat"], warehouse: ["grandWarehouse", "qualitySort"] },
  },
  {
    id: "hollowcrane",
    name: "Hollow & Crane",
    blurb: "Market-maker — Marketing starts a step in, best path to the Private Card, but can't hoard.",
    startLevels: { marketing: 1 }, // Marketing one step in (draws 2)
    valuesOverride: { warehouse: [3, 4, 5, 5] }, // weak: start Warehouse 3
  },
  {
    id: "copperline",
    name: "Copperline Craft",
    blurb: "Craft & quality — signature +1-quality claim and quality ultimates, but a tight Rickhouse.",
    valuesOverride: { rickhouse: [2, 3, 4, 4] }, // weak: start Rickhouse 2
    ultimates: { supply: ["prospector", "secondReroll", "overflowRoll"], warehouse: ["qualitySort", "grandWarehouse", "longCellar"] },
    signature: "copperPlus1",
  },
  {
    id: "coopersmith",
    name: "Coopersmith & Sons",
    blurb: "Recipe specialist — best mash-bill selection (Master Recipe / House Blend), but a thin Warehouse.",
    startLevels: { mashFloor: 1 }, // start Mash Floor 3
    valuesOverride: { warehouse: [3, 4, 5, 5] }, // weak: start Warehouse 3
    ultimates: { mashFloor: ["masterRecipe", "houseBlend"] },
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
    signature: def.signature ?? null,
    departments: DEPARTMENT_ORDER.map((id): Department => {
      const t = DEPARTMENT_TEMPLATE[id];
      const values = def.valuesOverride?.[id] ?? t.values;
      const maxLevel = values.length - 1;
      const start = def.startLevels?.[id] ?? 0;
      return {
        id,
        name: t.name,
        blurb: t.blurb,
        level: Math.min(start, maxLevel),
        maxLevel,
        values: [...values],
        discount: 0,
        ultimateOptions: def.ultimates?.[id] ?? [...ULTIMATE_MENU[id]],
        chosenUltimate: null,
        ultimatePile: null,
      };
    }),
  };
}
