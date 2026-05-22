import type {
  Card,
  CardEffect,
  InvestmentCard,
  LaborDomain,
  LaborSubtype,
  MashBill,
  MashBillRecipe,
  MashBillTier,
  OperationsCard,
  ResourceSubtype,
} from "./types";

// ----- Resource Card Factories -----

/**
 * Witty front-of-card copy for the plain (non-premium) starter cards.
 * Premium variants ship with their own `displayName` + `flavor` via
 * `makePremiumResource`, so this table only covers the basic 1-unit
 * versions of each subtype. Keeps every card readable on its face
 * instead of just "Cask".
 */
const BASIC_RESOURCE_COPY: Record<ResourceSubtype, { displayName: string; flavor: string }> = {
  cask: {
    displayName: "Common Cask",
    flavor: "Charred, sealed, waiting on you.",
  },
  corn: {
    displayName: "Common Corn",
    flavor: "Does most of the work, gets none of the credit.",
  },
  rye: {
    displayName: "Common Rye",
    flavor: "Pepper for the patient.",
  },
  barley: {
    displayName: "Common Barley",
    flavor: "The quiet backbone of any mash.",
  },
  wheat: {
    displayName: "Common Wheat",
    flavor: "Soft mash, slow burn.",
  },
};

/**
 * v2.11 Labor card copy (display name + flavor for each subtype).
 * Generic Labor is universal; Marketing / Cooper / Architect are
 * domain specialists. Architect is reserved for v2.12 (no Architect
 * cards ship in the v2.11 market — see `defaultMarketSupply`).
 */
const LABOR_COPY: Record<LaborSubtype, { displayName: string; flavor: string }> = {
  generic: {
    displayName: "Worker",
    flavor: "Hands on, sleeves up.",
  },
  marketing: {
    displayName: "Marketing",
    flavor: "Stories sell better than spreadsheets.",
  },
  cooper: {
    displayName: "Cooper",
    flavor: "Bourbon lives in barrels they hand-raised.",
  },
  architect: {
    displayName: "Architect",
    flavor: "Lines on paper before stone on stone.",
  },
};

/** v2.11: domain a Specialty Labor subtype matches. */
const LABOR_DOMAIN_BY_SUBTYPE: Record<LaborSubtype, LaborDomain> = {
  generic: "any",
  marketing: "ops",
  cooper: "market_resource",
  architect: "investment",
};

export function makeResourceCard(
  subtype: ResourceSubtype,
  ownerLabel: string,
  index: number,
  premium = false,
  resourceCount = 1,
): Card {
  const card: Card = {
    id: `card_${ownerLabel}_${subtype}${premium ? "x" + resourceCount : ""}_${index}`,
    cardDefId: premium ? `${subtype}_x${resourceCount}` : subtype,
    type: "resource",
    subtype,
    premium: premium || undefined,
    resourceCount,
    cost: premium ? resourceCount : 1,
  };
  if (!premium) {
    const copy = BASIC_RESOURCE_COPY[subtype];
    card.displayName = copy.displayName;
    card.flavor = copy.flavor;
  }
  return card;
}

/**
 * Premium resource factory with a themed name + optional aliases. Used
 * by the market supply to mint named premiums (e.g. "Toasted Cask",
 * "Wildcard Grain") so the buy options are visually distinct rather
 * than a row of "2× corn" tiles.
 */
export function makePremiumResource(spec: {
  defId: string;
  displayName: string;
  flavor?: string;
  subtype: ResourceSubtype;
  resourceCount: number;
  cost: number;
  aliases?: ResourceSubtype[];
  effect?: CardEffect;
  /** v2.11: marks a Specialty / Heritage card. */
  specialty?: boolean;
  ownerLabel?: string;
  index: number;
}): Card {
  const owner = spec.ownerLabel ?? "supply";
  return {
    id: `card_${owner}_${spec.defId}_${spec.index}`,
    cardDefId: spec.defId,
    type: "resource",
    subtype: spec.subtype,
    premium: true,
    resourceCount: spec.resourceCount,
    aliases: spec.aliases,
    cost: spec.cost,
    displayName: spec.displayName,
    flavor: spec.flavor,
    effect: spec.effect,
    specialty: spec.specialty,
  };
}

/**
 * Labor factory. Generic Labor only lives in starter decks (2 per
 * player, finite). Specialty Labor (Marketing / Cooper / Architect)
 * appears rarely in the market supply and is the only way new Labor
 * enters a deck after setup.
 *
 * `displayName` and `flavor` default to `LABOR_COPY[subtype]` when
 * omitted; the caller may override (e.g. distillery flavor variants).
 */
export function makeLaborCard(spec: {
  subtype: LaborSubtype;
  ownerLabel: string;
  index: number;
  /** Override the default display name for this subtype. */
  displayName?: string;
  /** Override the default flavor for this subtype. */
  flavor?: string;
  /**
   * Override the rep contribution. Defaults to 1 (Generic) or 2
   * (Specialty). Mostly here for tests; v2.11 ships the defaults.
   */
  contribution?: number;
  /** Override the market acquisition cost. Generic = $1; Specialty = $4. */
  cost?: number;
}): Card {
  const copy = LABOR_COPY[spec.subtype];
  const isGeneric = spec.subtype === "generic";
  const cost = spec.cost ?? (isGeneric ? 1 : 4);
  const contribution = spec.contribution ?? (isGeneric ? 1 : 2);
  return {
    id: `card_${spec.ownerLabel}_labor_${spec.subtype}_${spec.index}`,
    cardDefId: `labor_${spec.subtype}`,
    type: "labor",
    laborSubtype: spec.subtype,
    laborDomain: LABOR_DOMAIN_BY_SUBTYPE[spec.subtype],
    laborContribution: contribution,
    cost,
    displayName: spec.displayName ?? copy.displayName,
    flavor: spec.flavor ?? copy.flavor,
  };
}

// ----- Mash Bill Factory -----

interface MashBillSpec {
  defId: string;
  name: string;
  flavorText?: string;
  slogan?: string;
  tier?: MashBillTier;
  complexityTier?: MashBill["complexityTier"];
  ageBands: number[];
  demandBands: number[];
  rewardGrid: (number | null)[][];
  recipe?: MashBillRecipe;
  silverAward?: MashBill["silverAward"];
  goldAward?: MashBill["goldAward"];
  tutorialOnly?: boolean;
}

export function makeMashBill(spec: MashBillSpec, instanceIndex: number): MashBill {
  return {
    id: `mb_${spec.defId}_${instanceIndex}`,
    defId: spec.defId,
    name: spec.name,
    flavorText: spec.flavorText,
    slogan: spec.slogan,
    tier: spec.tier ?? "common",
    complexityTier: spec.complexityTier,
    ageBands: spec.ageBands,
    demandBands: spec.demandBands,
    rewardGrid: spec.rewardGrid,
    recipe: spec.recipe,
    silverAward: spec.silverAward,
    goldAward: spec.goldAward,
    tutorialOnly: spec.tutorialOnly,
  };
}

// ----- Resource Math Helpers -----

/** How many units of `subtype` does this card contribute? Honors resourceCount and aliases. */
export function resourceUnits(card: Card, subtype: ResourceSubtype): number {
  if (card.type !== "resource") return 0;
  const count = card.resourceCount ?? 1;
  if (card.subtype === subtype) return count;
  if (card.aliases?.includes(subtype)) return count;
  return 0;
}

/** Does this card supply `subtype` (counting aliases)? */
export function suppliesResource(card: Card, subtype: ResourceSubtype): boolean {
  return resourceUnits(card, subtype) > 0;
}

// ----- Unified-market wrappers -----
//
// The unified market holds resources, Labor, ops, and investments in
// one 10-slot face-up row. Ops and investments enter the supply as
// market-shaped Card entries that carry the underlying spec inline,
// so a buy can ship the spec straight to the player's hand.

/**
 * Wrap an OperationsCard spec as a unified-market Card entry. The
 * returned card has `type: "operations"`, carries the full spec via
 * `opSpec`, and exposes the spec's cost / name for market rendering.
 */
export function wrapOperationsForMarket(
  spec: OperationsCard,
  index: number,
): Card {
  return {
    id: `market_ops_${spec.defId}_${index}`,
    cardDefId: spec.defId,
    type: "operations",
    cost: spec.cost,
    displayName: spec.name,
    flavor: spec.flavor,
    opSpec: spec,
  };
}

/**
 * Wrap an InvestmentCard spec as a unified-market Card entry. Effects
 * don't fire yet (the catalog ships `implemented: false` across the
 * board); the spec is preserved inline so a future wave can switch to
 * resolving effects without changing the buy flow.
 */
export function wrapInvestmentForMarket(
  spec: InvestmentCard,
  index: number,
): Card {
  return {
    id: `market_inv_${spec.defId}_${index}`,
    cardDefId: spec.defId,
    type: "investment",
    cost: spec.cost,
    displayName: spec.name,
    flavor: spec.short,
    investmentSpec: spec,
  };
}

