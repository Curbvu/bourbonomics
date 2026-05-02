/**
 * Silver / Gold award evaluation per GAME_RULES.md §Bourbon Card.
 *
 * The YAML today carries prose-only award lines (human-readable English).
 * A future pass will enrich data/bourbon_cards.yaml with structured criteria;
 * for now we expose the evaluator scaffolding and a single pragmatic rule:
 *
 *   - If a card has a Silver line and the bourbon is ≥4 years old AND the sale
 *     price is at the card's Mid/High column max for its rarity, award Silver.
 *   - If a card has a Gold line and the bourbon is ≥8 years old AND the sale
 *     price is the grid's maximum, award Gold.
 *
 * This is a deliberate simplification (called out as a deferral in the plan);
 * it gives a working loop that correctly *never* awards on award-less cards
 * and lets Triple Crown be reachable in a long game. Swap in structured rules
 * by enriching BourbonCardDef.awards with a criteria object.
 */

import type { BourbonCardDef } from "@/lib/catalogs/types";
import type { ResourceCardInstance } from "@/lib/engine/state";
import { ageBandFor } from "./pricing";

export type AwardResult = {
  silver: boolean;
  gold: boolean;
};

export function evaluateAward(
  card: BourbonCardDef,
  _mash: readonly ResourceCardInstance[],
  ageYears: number,
  salePrice: number,
): AwardResult {
  const awards = card.awards;
  if (!awards) return { silver: false, gold: false };

  const gridMax = Math.max(
    ...card.grid.flatMap((row) => row),
  );
  // "Top age band" of THIS bill — `ageBands[2]` is the lower bound of the
  // well-aged row. Replaces the old hard-coded 8-year check so a bill with
  // shallower bands still resolves Gold against its own scale.
  const eightPlus = ageBandFor(card, ageYears) === 2;
  const fourPlus = ageYears >= 4;

  const silver = Boolean(awards.silver) && fourPlus && salePrice >= Math.floor(gridMax * 0.7);
  const gold = Boolean(awards.gold) && eightPlus && salePrice >= gridMax;

  return { silver, gold };
}
