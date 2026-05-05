import type { Card, MashBill, MashBillRecipe, MashBillTier, ResourceSubtype } from "./types";

// ----- Resource & Capital Card Factories -----

export function makeResourceCard(
  subtype: ResourceSubtype,
  ownerLabel: string,
  index: number,
  premium = false,
  resourceCount = 1,
): Card {
  return {
    id: `card_${ownerLabel}_${subtype}${premium ? "x" + resourceCount : ""}_${index}`,
    cardDefId: premium ? `${subtype}_x${resourceCount}` : subtype,
    type: "resource",
    subtype,
    premium: premium || undefined,
    resourceCount,
    cost: premium ? resourceCount : 1,
  };
}

export function makeCapitalCard(
  ownerLabel: string,
  index: number,
  capitalValue = 1,
): Card {
  return {
    id: `card_${ownerLabel}_cap${capitalValue}_${index}`,
    cardDefId: capitalValue === 1 ? "capital" : `capital_x${capitalValue}`,
    type: "capital",
    capitalValue,
    cost: capitalValue,
  };
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
