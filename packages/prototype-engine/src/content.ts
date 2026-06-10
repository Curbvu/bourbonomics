// Bourbonomics PROTOTYPE — PLACEHOLDER content.
//
// Everything here is provisional and exists only so a full solo game is
// playable end to end. Numbers are illustrative, not balanced. The
// `placeholder: true` flag is stamped on every record.

import { CONFIG } from "./config";
import type {
  DemandCard,
  DistilleryBoard,
  MarketingCard,
  MashBill,
  Quality,
  ResourceCard,
  ResourceKind,
  SlotCard,
  SlotSpec,
  Tag,
} from "./types";

/**
 * Map a mash bill's canonical `expression` to its house-style tag(s). Drives
 * a batch's `recipeTags` (set when the barrel is laid down). Unknown
 * expressions fall back to "classic" so every batch always carries a tag.
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
 * Build a concrete age×demand payoff grid. Embodies the "magic thread":
 * a barrel sold young or into low demand pays almost nothing; the same
 * barrel aged into high demand multiplies. `peak` scales the top-right cell.
 */
function buildMatrix(peak: number): number[][] {
  const rows: number[][] = [];
  for (let age = 0; age <= MAX_MATRIX_AGE; age++) {
    const row: number[] = [];
    // Age contributes nothing below the minimum sell age, then ramps.
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
  /** Single canonical house-style tag (read by the Expressions slot card). */
  expression: string;
  recipe: Partial<Record<ResourceKind, number>>;
  /** Sales the batch yields. Mostly 2–3; premium/single-barrel bills = 1. `[PH]`. */
  batchQty: number;
  peak: number;
}

const MASH_BILL_DEFS: MashBillDef[] = [
  { defId: "mb_high_corn", name: "Sweet Corn Mash", traits: ["high-corn"], expression: "high-corn", recipe: { corn: 2, cask: 1 }, batchQty: 3, peak: 8 },
  { defId: "mb_classic", name: "Classic Bourbon", traits: ["balanced"], expression: "bourbon", recipe: { corn: 1, grain: 1, cask: 1 }, batchQty: 3, peak: 10 },
  { defId: "mb_rye_heavy", name: "High Rye", traits: ["rye-heavy", "spiced"], expression: "high-rye", recipe: { grain: 2, cask: 1 }, batchQty: 2, peak: 12 },
  { defId: "mb_wheated", name: "Wheated", traits: ["wheated", "smooth"], expression: "wheated", recipe: { grain: 1, corn: 1, cask: 1 }, batchQty: 2, peak: 12 },
  { defId: "mb_four_grain", name: "Four Grain", traits: ["balanced", "complex"], expression: "four-grain", recipe: { corn: 1, grain: 2, cask: 1 }, batchQty: 2, peak: 14 },
  { defId: "mb_bottled_in_bond", name: "Bottled-in-Bond", traits: ["balanced", "bonded"], expression: "bourbon", recipe: { corn: 2, grain: 1, cask: 1 }, batchQty: 2, peak: 16 },
  { defId: "mb_single_barrel", name: "Single Barrel", traits: ["complex"], expression: "bourbon", recipe: { corn: 1, grain: 1, cask: 2 }, batchQty: 1, peak: 18 },
  { defId: "mb_rye_double", name: "Double Rye", traits: ["rye-heavy", "spiced", "complex"], expression: "high-rye", recipe: { grain: 3 }, batchQty: 2, peak: 20 },
  { defId: "mb_heritage_wheat", name: "Heirloom Wheat", traits: ["wheated", "heritage-grain"], expression: "wheated", recipe: { grain: 2, cask: 1 }, batchQty: 1, peak: 22 },
  { defId: "mb_small_batch", name: "Small Batch Reserve", traits: ["balanced", "smooth", "complex"], expression: "four-grain", recipe: { corn: 1, grain: 1, cask: 2 }, batchQty: 2, peak: 24 },
];

export function buildMashBillSupply(): MashBill[] {
  // Two copies of each design keeps the supply (the end-game clock) sized
  // for a meaningful solo game.
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
// Slot cards (varied slot counts up to MAX_SLOTS_PER_LINE, varied rewards)
// ---------------------------------------------------------------------

interface SlotCardDef {
  defId: string;
  name: string;
  slots: SlotSpec[];
  ageCeilings: number[];
  houseStyleBonus?: number;
}

// The five frozen v2 brand-line designs. See the design brief for the
// authoritative tables; this data mirrors them slot-for-slot.
//   Notation: slots run left→right, young→old (staircase: non-decreasing
//   age, ties allowed). Capital = currency+score; prestige = score only;
//   resources = cards drawn to hand. prestigeFromAge = prestige equal to
//   the placed bottle's age.
const SLOT_CARD_DEFS: SlotCardDef[] = [
  // 1. Standard — 5 slots, all required (beginner / fuel line).
  //    Slot 5 is the bait-with-teeth anchor: the +5-resource branch scores
  //    less than +2 Capital, and anchoring a young bottle here caps the line.
  {
    defId: "slot_standard",
    name: "Standard Line",
    slots: [
      { reward: { kind: "flat", reward: { resources: 1 } } },
      { reward: { kind: "flat", reward: { capital: 1 } } },
      { reward: { kind: "choice", options: [{ capital: 1 }, { resources: 2 }] } },
      { reward: { kind: "flat", reward: { capital: 1, resources: 1 } } },
      { reward: { kind: "choice", options: [{ capital: 2 }, { resources: 5 }] } },
    ],
    ageCeilings: [2, 3, 4, 6, MAX_MATRIX_AGE],
  },
  // 2. Flagship — flagship + 2 required (inert) + 2 optional (prestige).
  //    Slot 1's age=prestige is intentionally UNcapped; the staircase caps
  //    it via opportunity cost (a high floor forces older bottles above).
  {
    defId: "slot_flagship",
    name: "Flagship Line",
    slots: [
      { reward: { kind: "flat", reward: { prestigeFromAge: true } } },
      { reward: { kind: "flat", reward: {} } },
      { reward: { kind: "flat", reward: {} } },
      { reward: { kind: "flat", reward: { prestige: 3 } }, optional: true },
      { reward: { kind: "flat", reward: { prestige: 5 } }, optional: true },
    ],
    ageCeilings: [2, 4, 6, 8, MAX_MATRIX_AGE],
  },
  // 3. Expressions — 6 slots, alternating required/optional (coherence line).
  //    Each optional must match its paired required's age. House-style bonus
  //    at scoring: all 3 optionals filled, all one expression, each differing
  //    from its paired required's expression → +5 prestige.
  {
    defId: "slot_expressions",
    name: "Expressions Line",
    slots: [
      { reward: { kind: "flat", reward: { resources: 1 } } },
      { reward: { kind: "flat", reward: { prestige: 1 } }, optional: true, matchAgeOfSlot: 0 },
      { reward: { kind: "flat", reward: { capital: 1 } } },
      { reward: { kind: "choice", options: [{ capital: 1 }, { resources: 3 }] }, optional: true, matchAgeOfSlot: 2 },
      { reward: { kind: "flat", reward: { capital: 2 } } },
      { reward: { kind: "choice", options: [{ resources: 5 }, { capital: 2 }] }, optional: true, matchAgeOfSlot: 4 },
    ],
    ageCeilings: [2, 2, 4, 4, 6, MAX_MATRIX_AGE],
    houseStyleBonus: 5,
  },
  // 4. Workhorse — 6 slots, all required, FLAT (volume line).
  //    Rules carve-out: the deliberate exception to "rewards scale with
  //    position" (see GAME_RULES.md). Breadth, not efficiency.
  {
    defId: "slot_workhorse",
    name: "Workhorse Line",
    slots: [
      { reward: { kind: "flat", reward: { resources: 1 } } },
      { reward: { kind: "flat", reward: { capital: 1 } } },
      { reward: { kind: "flat", reward: { resources: 1 } } },
      { reward: { kind: "flat", reward: { capital: 1 } } },
      { reward: { kind: "flat", reward: { resources: 1 } } },
      { reward: { kind: "flat", reward: { capital: 2 } } },
    ],
    ageCeilings: [2, 3, 4, 5, 6, MAX_MATRIX_AGE],
  },
  // 5. Single Barrel — 3 slots, gated with cozy fallbacks (premium line).
  //    A gate miss pays the fallback and never blocks placement.
  {
    defId: "slot_single_barrel",
    name: "Single Barrel Line",
    slots: [
      { reward: { kind: "gated", gate: { minAge: 4 }, hit: { capital: 2 }, miss: { capital: 1 } } },
      { reward: { kind: "gated", gate: { minQuality: "specialty", minAge: 4 }, hit: { capital: 3 }, miss: { capital: 1 } } },
      { reward: { kind: "gated", gate: { minQuality: "heritage", minAge: 6 }, hit: { capital: 5 }, miss: { capital: 2 } } },
    ],
    ageCeilings: [4, 5, MAX_MATRIX_AGE],
  },
];

export function buildSlotCardSupply(): SlotCard[] {
  // Abundant: many copies of each design so DRAW_SLOT_CARD never starves.
  const cards: SlotCard[] = [];
  for (let copy = 0; copy < 12; copy++) {
    for (const def of SLOT_CARD_DEFS) {
      cards.push({
        id: `${def.defId}#${copy}`,
        defId: def.defId,
        name: def.name,
        slots: def.slots.map((s) => structuredClone(s)),
        ageCeilings: [...def.ageCeilings],
        ...(def.houseStyleBonus !== undefined
          ? { houseStyleBonus: def.houseStyleBonus }
          : {}),
        placeholder: true,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------
// Marketing cards (~8, trait-gated, mutually-exclusive groups)
// ---------------------------------------------------------------------

interface MarketingDef {
  defId: string;
  name: string;
  requiredTraits: string[];
  exclusiveGroup: string;
  prestigeOnMatch: number;
}

const MARKETING_DEFS: MarketingDef[] = [
  { defId: "mkt_rye_campaign", name: "Rye Revival Campaign", requiredTraits: ["rye-heavy"], exclusiveGroup: "grain-identity", prestigeOnMatch: 2 },
  { defId: "mkt_wheat_campaign", name: "Soft Wheat Story", requiredTraits: ["wheated"], exclusiveGroup: "grain-identity", prestigeOnMatch: 2 },
  { defId: "mkt_corn_campaign", name: "Sweet Corn Heritage", requiredTraits: ["high-corn"], exclusiveGroup: "grain-identity", prestigeOnMatch: 2 },
  { defId: "mkt_smooth", name: "Smooth Sipper Ads", requiredTraits: ["smooth"], exclusiveGroup: "palate", prestigeOnMatch: 1 },
  { defId: "mkt_spiced", name: "Bold & Spiced Ads", requiredTraits: ["spiced"], exclusiveGroup: "palate", prestigeOnMatch: 1 },
  { defId: "mkt_complex", name: "Connoisseur Series", requiredTraits: ["complex"], exclusiveGroup: "tier", prestigeOnMatch: 2 },
  { defId: "mkt_balanced", name: "Everyday Classic", requiredTraits: ["balanced"], exclusiveGroup: "tier", prestigeOnMatch: 1 },
  { defId: "mkt_heritage", name: "Heritage Grain Feature", requiredTraits: ["heritage-grain"], exclusiveGroup: "tier", prestigeOnMatch: 3 },
];

export function buildMarketingDeck(): MarketingCard[] {
  const cards: MarketingCard[] = [];
  for (let copy = 0; copy < 4; copy++) {
    for (const def of MARKETING_DEFS) {
      cards.push({
        id: `${def.defId}#${copy}`,
        defId: def.defId,
        name: def.name,
        requiredTraits: [...def.requiredTraits],
        exclusiveGroup: def.exclusiveGroup,
        prestigeOnMatch: def.prestigeOnMatch,
        placeholder: true,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------
// Resource deck (communal): casks + corn + grain across qualities
// ---------------------------------------------------------------------

interface ResourceDef {
  defId: string;
  kind: ResourceKind;
  quality: Quality;
  name: string;
  count: number;
}

const RESOURCE_DEFS: ResourceDef[] = [
  { defId: "res_corn_common", kind: "corn", quality: "common", name: "Corn", count: 24 },
  { defId: "res_grain_common", kind: "grain", quality: "common", name: "Grain", count: 24 },
  { defId: "res_cask_common", kind: "cask", quality: "common", name: "New-Char Cask", count: 18 },
  { defId: "res_cask_specialty", kind: "cask", quality: "specialty", name: "Toasted Cask", count: 10 },
  { defId: "res_cask_heritage", kind: "cask", quality: "heritage", name: "Heritage Cask", count: 6 },
  { defId: "res_grain_specialty", kind: "grain", quality: "specialty", name: "Estate Grain", count: 8 },
  { defId: "res_grain_heritage", kind: "grain", quality: "heritage", name: "Heirloom Grain", count: 4 },
];

export function buildResourceDeck(): ResourceCard[] {
  const cards: ResourceCard[] = [];
  for (const def of RESOURCE_DEFS) {
    for (let i = 0; i < def.count; i++) {
      cards.push({
        id: `${def.defId}#${i}`,
        defId: def.defId,
        kind: def.kind,
        quality: def.quality,
        name: def.name,
        placeholder: true,
      });
    }
  }
  return cards;
}

// ---------------------------------------------------------------------
// Demand deck (P3 flood engine): tag-focused cards with sale slots + the
// blue/red capacities that sum into the round's flood thresholds.
// ---------------------------------------------------------------------

interface DemandCardDef {
  defId: string;
  label: string;
  tag: Tag;
  /** Tag restriction per sale slot ("open" accepts any tag). */
  slots: (Tag | "open")[];
  blueCapacity: number;
  redCapacity: number;
  count: number;
}

// One focused card per tag (pure on-tag slots — that style only) plus a
// "broad" all-open card that accepts any tag. Capacities (blue / red) sum
// across the `playerCount` drawn cards into the round's flood thresholds. A
// batch sells only if its tag is demanded this round (a matching focused card
// or the broad card is on the table). All values `[PH]`.
const DEMAND_CARD_DEFS: DemandCardDef[] = [
  { defId: "dm_wheat", label: "Wheated Demand", tag: "wheat", slots: ["wheat", "wheat"], blueCapacity: 2, redCapacity: 3, count: 4 },
  { defId: "dm_rye", label: "Rye Demand", tag: "rye", slots: ["rye", "rye"], blueCapacity: 2, redCapacity: 3, count: 4 },
  { defId: "dm_highcorn", label: "High-Corn Demand", tag: "highCorn", slots: ["highCorn", "highCorn"], blueCapacity: 2, redCapacity: 3, count: 4 },
  { defId: "dm_fourgrain", label: "Four-Grain Demand", tag: "fourGrain", slots: ["fourGrain", "fourGrain"], blueCapacity: 2, redCapacity: 3, count: 4 },
  { defId: "dm_classic", label: "Classic Demand", tag: "classic", slots: ["classic", "classic"], blueCapacity: 2, redCapacity: 3, count: 4 },
  { defId: "dm_broad", label: "Broad Demand", tag: "classic", slots: ["open", "open", "open"], blueCapacity: 3, redCapacity: 4, count: 4 },
];

// ---------------------------------------------------------------------
// Distillery board (P3): the default shared station menu. Every player
// starts with a clone of this board; asymmetric distilleries (different
// cost profiles + signature abilities) arrive in a later batch. All `[PH]`.
// ---------------------------------------------------------------------
export function buildDistilleryBoard(): DistilleryBoard {
  return {
    distilleryId: "standard",
    name: "Standard Distillery",
    stations: [
      {
        id: "rickhouse",
        name: "Rickhouse",
        blurb: "Total barrel capacity (resting + aging).",
        builtTier: 0,
        maxTier: 2,
        costs: [0, 4, 6],
        levels: [3, 5, 7],
      },
      {
        id: "tastingRoom",
        name: "Tasting Room",
        blurb: "Prestige per completed batch.",
        builtTier: 0,
        maxTier: 2,
        costs: [0, 2, 3],
        levels: [0, 1, 2],
      },
      {
        id: "bottling",
        name: "Bottling Line",
        blurb: "Bonus Capital per completed batch.",
        builtTier: 0,
        maxTier: 2,
        costs: [0, 2, 4],
        levels: [0, 1, 2],
      },
    ],
  };
}

export function buildDemandDeck(): DemandCard[] {
  const cards: DemandCard[] = [];
  for (const def of DEMAND_CARD_DEFS) {
    for (let i = 0; i < def.count; i++) {
      cards.push({
        id: `${def.defId}#${i}`,
        defId: def.defId,
        label: def.label,
        tag: def.tag,
        slots: def.slots.map((t) => ({ tagRestriction: t })),
        blueCapacity: def.blueCapacity,
        redCapacity: def.redCapacity,
        placeholder: true,
      });
    }
  }
  return cards;
}
