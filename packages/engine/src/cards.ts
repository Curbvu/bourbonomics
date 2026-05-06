import type {
  Card,
  CardEffect,
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

const BASIC_CAPITAL_COPY = {
  displayName: "Petty Cash",
  flavor: "One dollar of trust, ready to spend.",
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
  };
}

/**
 * Capital factory with a themed display name. Identical pricing to
 * `makeCapitalCard` but with a distinct on-card label so the market
 * supply can mint variants like "Cellar Stipend" / "Brand Loan".
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
    card.displayName = BASIC_CAPITAL_COPY.displayName;
    card.flavor = BASIC_CAPITAL_COPY.flavor;
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
  ageBands: [number, number, number];
  demandBands: [number, number, number];
  rewardGrid: (number | null)[][];
  recipe?: MashBillRecipe;
  silverAward?: MashBill["silverAward"];
  goldAward?: MashBill["goldAward"];
}

export function makeMashBill(spec: MashBillSpec, instanceIndex: number): MashBill {
  return {
    id: `mb_${spec.defId}_${instanceIndex}`,
    defId: spec.defId,
    name: spec.name,
    flavorText: spec.flavorText,
    slogan: spec.slogan,
    tier: spec.tier ?? "common",
    ageBands: spec.ageBands,
    demandBands: spec.demandBands,
    rewardGrid: spec.rewardGrid,
    recipe: spec.recipe,
    silverAward: spec.silverAward,
    goldAward: spec.goldAward,
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

/** Total capital contributed by a card (capital cards only). */
export function capitalUnits(card: Card): number {
  return card.type === "capital" ? card.capitalValue ?? 1 : 0;
}

/**
 * Value of a card when used to pay a market cost.
 *   - Explicit `card.value` always wins (lets expansion cards override).
 *   - Capital cards otherwise pay their face value (capitalValue, default 1).
 *   - Resource cards otherwise pay 1¢ each (regardless of resourceCount).
 *
 * Used by BUY_FROM_MARKET and BUY_OPERATIONS_CARD validation.
 */
export function paymentValue(card: Card): number {
  if (card.value != null) return card.value;
  if (card.type === "capital") return card.capitalValue ?? 1;
  return 1;
}
