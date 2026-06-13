// Bourbonomics — PLACEHOLDER content (ground-up revision).
//
// Everything here is provisional and exists only so a full game is playable
// end to end. Numbers are illustrative, not balanced. The `placeholder: true`
// flag is stamped on every record. The mash bills and the age×demand payoff
// matrix carry forward unchanged from the prior version.

import { CONFIG } from "./config";
import type {
  AbilityId,
  DemandCard,
  Department,
  DepartmentId,
  DistilleryBoard,
  MashBill,
  Quality,
  ResourceCard,
  ResourceKind,
  Tag,
} from "./types";

/**
 * Map a mash bill's canonical `expression` to its house-style tag(s). Drives a
 * batch's `recipeTags`. Unknown expressions fall back to "classic". Reserved
 * for the 🚧 STUBBED collection engine; not yet scored.
 */
const EXPRESSION_TAGS: Record<string, Tag> = {
  wheated: "wheat",
  "high-rye": "rye",
  "high-corn": "highCorn",
  "four-grain": "fourGrain",
  bourbon: "classic",
};

export function expressionToTags(expression: string): Tag[] {
  return [EXPRESSION_TAGS[expression] ?? "classic"];
}

/** Highest age row we materialize in every payoff matrix. */
export const MAX_MATRIX_AGE = 10;

/**
 * Build a concrete age×demand payoff grid. A barrel sold young or into low
 * demand pays almost nothing; the same barrel aged into high demand multiplies.
 * `peak` scales the top-right cell.
 */
function buildMatrix(peak: number): number[][] {
  const rows: number[][] = [];
  for (let age = 0; age <= MAX_MATRIX_AGE; age++) {
    const row: number[] = [];
    const ageFactor =
      age < CONFIG.MIN_SELL_AGE
        ? 0
        : Math.min(1, (age - CONFIG.MIN_SELL_AGE + 1) / 6);
    for (let demand = 0; demand <= CONFIG.DEMAND_CAP; demand++) {
      const demandFactor = demand / CONFIG.DEMAND_CAP;
      row.push(Math.round(peak * ageFactor * demandFactor));
    }
    rows.push(row);
  }
  return rows;
}

// ---------------------------------------------------------------------
// Mash bills (~10, varied traits / qualities / matrices)
// ---------------------------------------------------------------------

interface MashBillDef {
  defId: string;
  name: string;
  traits: string[];
  /** Single canonical house-style tag. */
  expression: string;
  recipe: Partial<Record<ResourceKind, number>>;
  /** Sales the batch yields. Mostly 2–3; premium/single-barrel bills = 1. `[PH]`. */
  batchQty: number;
  peak: number;
}

// Bills carry the original game's identities and recipes, mapped onto the five
// piles: each names its grains specifically (rye / wheat / barley). The neutral
// "bourbon" bills use barley as their workhorse grain.
const MASH_BILL_DEFS: MashBillDef[] = [
  { defId: "mb_cornbread", name: "Cornbread Line", traits: ["high-corn"], expression: "high-corn", recipe: { corn: 2, cask: 1 }, batchQty: 3, peak: 8 },
  { defId: "mb_classic", name: "Knob's End 90", traits: ["balanced"], expression: "bourbon", recipe: { corn: 1, barley: 1, cask: 1 }, batchQty: 3, peak: 10 },
  { defId: "mb_stave_story", name: "Stave & Story", traits: ["rye-heavy", "spiced"], expression: "high-rye", recipe: { rye: 2, cask: 1 }, batchQty: 2, peak: 12 },
  { defId: "mb_wheat_whisper", name: "Wheat Whisper", traits: ["wheated", "smooth"], expression: "wheated", recipe: { wheat: 1, corn: 1, cask: 1 }, batchQty: 2, peak: 12 },
  { defId: "mb_coopers_quorum", name: "Cooper's Quorum", traits: ["balanced", "complex"], expression: "four-grain", recipe: { corn: 1, rye: 1, wheat: 1, cask: 1 }, batchQty: 2, peak: 14 },
  { defId: "mb_bonded_bold", name: "Bonded & Bold", traits: ["balanced", "bonded"], expression: "bourbon", recipe: { corn: 2, barley: 1, cask: 1 }, batchQty: 2, peak: 16 },
  { defId: "mb_single_barrel", name: "Single Barrel Select", traits: ["complex"], expression: "bourbon", recipe: { corn: 1, barley: 1, cask: 2 }, batchQty: 1, peak: 18 },
  { defId: "mb_rye_ladder", name: "Rye Ladder 95", traits: ["rye-heavy", "spiced", "complex"], expression: "high-rye", recipe: { rye: 3 }, batchQty: 2, peak: 20 },
  { defId: "mb_heritage_wheat", name: "Wheated Estate", traits: ["wheated", "heritage-grain"], expression: "wheated", recipe: { wheat: 2, cask: 1 }, batchQty: 1, peak: 22 },
  { defId: "mb_small_batch", name: "Mash Bill No. 7", traits: ["balanced", "smooth", "complex"], expression: "four-grain", recipe: { corn: 1, barley: 1, cask: 2 }, batchQty: 2, peak: 24 },
];

export function buildMashBillSupply(): MashBill[] {
  const bills: MashBill[] = [];
  for (let copy = 0; copy < 2; copy++) {
    for (const def of MASH_BILL_DEFS) {
      bills.push({
        id: `${def.defId}#${copy}`,
        defId: def.defId,
        name: def.name,
        traits: [...def.traits],
        expression: def.expression,
        recipe: { ...def.recipe },
        batchQty: def.batchQty,
        matrix: buildMatrix(def.peak),
        placeholder: true,
      });
    }
  }
  return bills;
}

// ---------------------------------------------------------------------
// Resource piles (five, face-down): cask / corn / rye / wheat / barley.
// ---------------------------------------------------------------------

/** Per-kind display names by quality (the blind upside the pile hides). */
const RESOURCE_NAMES: Record<ResourceKind, Record<Quality, string>> = {
  cask: { common: "New-Char Cask", specialty: "Toasted Cask", heritage: "Heritage Cask" },
  corn: { common: "Corn", specialty: "Estate Corn", heritage: "Heirloom Corn" },
  rye: { common: "Rye", specialty: "Estate Rye", heritage: "Heirloom Rye" },
  wheat: { common: "Wheat", specialty: "Estate Wheat", heritage: "Heirloom Wheat" },
  barley: { common: "Barley", specialty: "Estate Barley", heritage: "Heirloom Barley" },
};

export const PILE_KINDS: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];

/** Split a pile's total into per-quality counts using PILE_QUALITY_SPLIT. */
function qualityCounts(total: number): Record<Quality, number> {
  const split = CONFIG.PILE_QUALITY_SPLIT;
  const specialty = Math.round(total * split.specialty);
  const heritage = Math.round(total * split.heritage);
  const common = total - specialty - heritage;
  return { common, specialty, heritage };
}

/** Build one face-down, type-pure pile seeded with the quality distribution (unshuffled). */
export function buildPile(kind: ResourceKind): ResourceCard[] {
  const total = CONFIG.PILE_COUNTS[kind];
  const counts = qualityCounts(total);
  const cards: ResourceCard[] = [];
  for (const quality of ["common", "specialty", "heritage"] as Quality[]) {
    for (let i = 0; i < counts[quality]; i++) {
      cards.push({
        id: `res_${kind}_${quality}#${i}`,
        defId: `res_${kind}_${quality}`,
        kind,
        quality,
        name: RESOURCE_NAMES[kind][quality],
        placeholder: true,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------
// Demand deck — 🚧 PLACEHOLDER. One card per style focus, each carrying a
// matrix demand `level`. The Demand Phase lays out Marketing-many; the round's
// demand level is the highest among them. Real demand content is a design stub.
// ---------------------------------------------------------------------

interface DemandCardDef {
  defId: string;
  label: string;
  tag: Tag;
  level: number;
  count: number;
}

const DEMAND_CARD_DEFS: DemandCardDef[] = [
  { defId: "dm_quiet", label: "Quiet Market", tag: "classic", level: 3, count: 6 },
  { defId: "dm_steady", label: "Steady Demand", tag: "classic", level: 5, count: 6 },
  { defId: "dm_wheat", label: "Wheated Buzz", tag: "wheat", level: 7, count: 4 },
  { defId: "dm_rye", label: "Rye Revival", tag: "rye", level: 8, count: 4 },
  { defId: "dm_highcorn", label: "Sweet-Corn Trend", tag: "highCorn", level: 7, count: 4 },
  { defId: "dm_fourgrain", label: "Connoisseur Surge", tag: "fourGrain", level: 9, count: 3 },
  { defId: "dm_boom", label: "Collector Boom", tag: "classic", level: 11, count: 3 },
];

export function buildDemandDeck(): DemandCard[] {
  const cards: DemandCard[] = [];
  for (const def of DEMAND_CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      cards.push({
        id: `${def.defId}#${i}`,
        defId: def.defId,
        label: def.label,
        tag: def.tag,
        level: def.level,
        placeholder: true,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------
// Distillery boards — the five departments on a per-player linear ramp.
// The department MENU (names, effect levels) is identical for everyone; a
// distillery differs by per-department cost DISCOUNT (which growth paths are
// cheap), optional starting levels, and a signature ability. All values `[PH]`.
// ---------------------------------------------------------------------

/** The shared department menu: name, blurb, and effect levels per growth step. */
const DEPARTMENT_TEMPLATE: Record<
  DepartmentId,
  { name: string; blurb: string; maxLevel: number; values: number[] }
> = {
  rickhouse: {
    name: "Rickhouse",
    blurb: "Total barrel capacity (resting unbuilt + aging built).",
    maxLevel: 3,
    values: [3, 5, 7, 9],
  },
  supply: {
    name: "Supply",
    blurb: "Resource dice you roll/hold each Collect (a 2nd reroll once upgraded).",
    maxLevel: 3,
    values: [4, 5, 6, 7],
  },
  warehouse: {
    name: "Warehouse",
    blurb: "Resource cards you may hold.",
    maxLevel: 3,
    values: [4, 6, 8, 10],
  },
  distillingOffice: {
    name: "Distilling Office",
    blurb: "Mash bills you may draw (and select from) per Draw action.",
    maxLevel: 3,
    values: [2, 3, 4, 5],
  },
  tastingRoom: {
    name: "Tasting Room",
    blurb: "Bonus Capital on every sale.",
    maxLevel: 3,
    values: [0, 1, 2, 3],
  },
  marketing: {
    name: "Marketing Department",
    blurb: "Demand cards laid out each round (shape the market you read).",
    maxLevel: 3,
    values: [1, 2, 3, 4],
  },
};

const DEPARTMENT_ORDER: DepartmentId[] = [
  "rickhouse",
  "supply",
  "warehouse",
  "distillingOffice",
  "tastingRoom",
  "marketing",
];

interface DistilleryDef {
  id: string;
  name: string;
  signature: AbilityId;
  signatureBlurb: string;
  /** Per-department Capital discount off the ramp (the asymmetry). `[PH]`. */
  discounts: Partial<Record<DepartmentId, number>>;
  /** Per-department starting level overrides. Omitted = 0. `[PH]`. */
  startLevels: Partial<Record<DepartmentId, number>>;
}

const DISTILLERY_DEFS: DistilleryDef[] = [
  {
    id: "standard",
    name: "Standard Distillery",
    signature: "none",
    signatureBlurb: "No signature — a balanced, beginner-friendly start.",
    discounts: {},
    startLevels: {},
  },
  {
    id: "oldoak",
    name: "Old Oak Rickhouse",
    signature: "agedPrestige",
    signatureBlurb: "+1 prestige when you complete a batch aged 5+.",
    // Patience tilt: cheap Tasting Room (lean on richer, well-timed sales).
    discounts: { tastingRoom: 1 },
    startLevels: {},
  },
  {
    id: "ironhill",
    name: "Ironhill Volume",
    signature: "volumeBonus",
    signatureBlurb: "+1 Capital on every sale.",
    // Throughput tilt: cheap Warehouse + a head start on Supply.
    discounts: { warehouse: 1 },
    startLevels: { supply: 1 },
  },
  {
    id: "ryerevival",
    name: "Rye Revival Co.",
    signature: "ryeBonus",
    signatureBlurb: "+2 Capital on each sale of a rye batch.",
    // Specialist tilt: cheap Distilling Office (steer toward rye bills).
    discounts: { distillingOffice: 1 },
    startLevels: {},
  },
];

/** Lightweight roster for the new-game picker (no department data). */
export const DISTILLERY_ROSTER = DISTILLERY_DEFS.map((d) => ({
  id: d.id,
  name: d.name,
  signature: d.signature,
  signatureBlurb: d.signatureBlurb,
}));

/** Build a fresh distillery board for the given id (defaults to "standard"). */
export function buildDistilleryBoard(distilleryId = "standard"): DistilleryBoard {
  const def = DISTILLERY_DEFS.find((d) => d.id === distilleryId) ?? DISTILLERY_DEFS[0]!;
  return {
    distilleryId: def.id,
    name: def.name,
    signature: def.signature,
    signatureBlurb: def.signatureBlurb,
    departments: DEPARTMENT_ORDER.map((id): Department => {
      const t = DEPARTMENT_TEMPLATE[id];
      const start = def.startLevels[id] ?? 0;
      return {
        id,
        name: t.name,
        blurb: t.blurb,
        level: Math.min(start, t.maxLevel),
        maxLevel: t.maxLevel,
        values: [...t.values],
        discount: def.discounts[id] ?? 0,
      };
    }),
  };
}
