// Bourbonomics PROTOTYPE — PLACEHOLDER content.
//
// Everything here is provisional and exists only so a full solo game is
// playable end to end. Numbers are illustrative, not balanced. The
// `placeholder: true` flag is stamped on every record.

import { CONFIG } from "./config";
import type {
  ForecastCard,
  MarketingCard,
  MashBill,
  Quality,
  ResourceCard,
  ResourceKind,
  SlotCard,
} from "./types";

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
  recipe: Partial<Record<ResourceKind, number>>;
  peak: number;
}

const MASH_BILL_DEFS: MashBillDef[] = [
  { defId: "mb_high_corn", name: "Sweet Corn Mash", traits: ["high-corn"], recipe: { corn: 2, cask: 1 }, peak: 8 },
  { defId: "mb_classic", name: "Classic Bourbon", traits: ["balanced"], recipe: { corn: 1, grain: 1, cask: 1 }, peak: 10 },
  { defId: "mb_rye_heavy", name: "High Rye", traits: ["rye-heavy", "spiced"], recipe: { grain: 2, cask: 1 }, peak: 12 },
  { defId: "mb_wheated", name: "Wheated", traits: ["wheated", "smooth"], recipe: { grain: 1, corn: 1, cask: 1 }, peak: 12 },
  { defId: "mb_four_grain", name: "Four Grain", traits: ["balanced", "complex"], recipe: { corn: 1, grain: 2, cask: 1 }, peak: 14 },
  { defId: "mb_bottled_in_bond", name: "Bottled-in-Bond", traits: ["balanced", "bonded"], recipe: { corn: 2, grain: 1, cask: 1 }, peak: 16 },
  { defId: "mb_single_barrel", name: "Single Barrel", traits: ["complex"], recipe: { corn: 1, grain: 1, cask: 2 }, peak: 18 },
  { defId: "mb_rye_double", name: "Double Rye", traits: ["rye-heavy", "spiced", "complex"], recipe: { grain: 3 }, peak: 20 },
  { defId: "mb_heritage_wheat", name: "Heirloom Wheat", traits: ["wheated", "heritage-grain"], recipe: { grain: 2, cask: 1 }, peak: 22 },
  { defId: "mb_small_batch", name: "Small Batch Reserve", traits: ["balanced", "smooth", "complex"], recipe: { corn: 1, grain: 1, cask: 2 }, peak: 24 },
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
        recipe: { ...def.recipe },
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
  slotRewards: { capital?: number; prestige?: number }[];
  ageCeilings: number[];
}

const SLOT_CARD_DEFS: SlotCardDef[] = [
  {
    defId: "slot_starter_line",
    name: "Starter Line",
    slotRewards: [{ capital: 1 }, { capital: 2 }, { capital: 3 }],
    ageCeilings: [3, 5, MAX_MATRIX_AGE],
  },
  {
    defId: "slot_flagship",
    name: "Flagship Portfolio",
    slotRewards: [{ capital: 1 }, { capital: 2, prestige: 1 }, { capital: 3 }, { capital: 4, prestige: 1 }],
    ageCeilings: [2, 4, 6, MAX_MATRIX_AGE],
  },
  {
    defId: "slot_prestige_line",
    name: "Prestige Collection",
    slotRewards: [{ prestige: 1 }, { prestige: 2 }, { prestige: 3 }],
    ageCeilings: [3, 6, MAX_MATRIX_AGE],
  },
  {
    defId: "slot_grand_reserve",
    name: "Grand Reserve",
    slotRewards: [
      { capital: 1 },
      { capital: 2 },
      { capital: 3, prestige: 1 },
      { capital: 4, prestige: 1 },
      { capital: 5, prestige: 2 },
      { capital: 6, prestige: 3 },
    ],
    ageCeilings: [2, 3, 4, 6, 8, MAX_MATRIX_AGE],
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
        slotRewards: def.slotRewards.map((r) => ({ ...r })),
        ageCeilings: [...def.ageCeilings],
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
// Forecast deck (simple per-round demand moves)
// ---------------------------------------------------------------------

interface ForecastDef {
  defId: string;
  label: string;
  delta: number;
  onlyIfDemandBelow?: number;
  count: number;
}

const FORECAST_DEFS: ForecastDef[] = [
  { defId: "fc_up1", label: "+1 demand", delta: 1, count: 8 },
  { defId: "fc_up2", label: "+2 demand", delta: 2, count: 4 },
  { defId: "fc_up1_low", label: "+1 if demand < 6", delta: 1, onlyIfDemandBelow: 6, count: 4 },
  { defId: "fc_down1", label: "-1 demand", delta: -1, count: 4 },
  { defId: "fc_flat", label: "no change", delta: 0, count: 4 },
];

export function buildForecastDeck(): ForecastCard[] {
  const cards: ForecastCard[] = [];
  for (const def of FORECAST_DEFS) {
    for (let i = 0; i < def.count; i++) {
      cards.push({
        id: `${def.defId}#${i}`,
        defId: def.defId,
        label: def.label,
        delta: def.delta,
        ...(def.onlyIfDemandBelow !== undefined
          ? { onlyIfDemandBelow: def.onlyIfDemandBelow }
          : {}),
        placeholder: true,
      });
    }
  }
  return cards;
}
