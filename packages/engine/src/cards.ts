import type {
  Card,
  CardEffect,
  LaborDomain,
  LaborSubtype,
  MashBill,
  MashBillRecipe,
  MashBillTier,
  ResourceSubtype,
} from "./types";

// ----- Resource & Capital Card Factories -----

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
 * v2.11 Labor factory. Generic Labor lives in starter decks and the
 * central Hire pile; Specialty Labor (Marketing / Cooper / Architect)
 * appears rarely in the market supply.
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

/**
 * @deprecated v2.11 (Unified Rep) — capital cards are no longer
 * minted. This factory remains so old test fixtures and replay code
 * still parse, but `defaultMarketSupply` and starter pools no longer
 * call it. Will be removed in a future cleanup pass.
 */
export function makePremiumCapital(spec: {
  defId: string;
  displayName: string;
  flavor?: string;
  capitalValue: number;
  cost?: number;
  effect?: CardEffect;
  ownerLabel?: string;
  index: number;
}): Card {
  const owner = spec.ownerLabel ?? "supply";
  return {
    id: `card_${owner}_${spec.defId}_${spec.index}`,
    cardDefId: spec.defId,
    type: "capital",
    capitalValue: spec.capitalValue,
    cost: spec.cost ?? spec.capitalValue,
    displayName: spec.displayName,
    flavor: spec.flavor,
    effect: spec.effect,
  };
}

/**
 * @deprecated v2.11 (Unified Rep) — capital cards are no longer
 * minted. Same compatibility note as `makePremiumCapital`.
 */
export function makeCapitalCard(
  ownerLabel: string,
  index: number,
  capitalValue = 1,
): Card {
  const card: Card = {
    id: `card_${ownerLabel}_cap${capitalValue}_${index}`,
    cardDefId: capitalValue === 1 ? "capital" : `capital_x${capitalValue}`,
    type: "capital",
    capitalValue,
    cost: capitalValue,
  };
  if (capitalValue === 1) {
    card.displayName = "Petty Cash";
    card.flavor = "Legacy card — capital is retired in v2.11.";
  }
  return card;
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

/**
 * @deprecated v2.11 (Unified Rep) — capital cards are no longer in
 * play. Always returns 0 for the legacy capital type (since the
 * cards never enter v2.11 games), preserved only so bot/legacy code
 * that still calls `capitalUnits` keeps compiling.
 */
export function capitalUnits(card: Card): number {
  return card.type === "capital" ? card.capitalValue ?? 1 : 0;
}

/**
 * @deprecated v2.11 (Unified Rep) — `BUY_FROM_MARKET` and
 * `BUY_OPERATIONS_CARD` now take `{rep, laborCardIds}` directly; rep
 * is the universal currency and Labor cards supplement via
 * `laborContribution` (in types.ts). This helper survives only for
 * legacy capital-card serialized state and will be removed in a
 * future cleanup pass.
 */
export function paymentValue(card: Card): number {
  if (card.value != null) return card.value;
  if (card.type === "capital") return card.capitalValue ?? 1;
  return 1;
}
