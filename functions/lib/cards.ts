/** Minimal card defs for the playable prototype (ids stable for saves). */

import {
  getInvestmentCardDefById,
  INVESTMENT_CARDS,
  type InvestmentCardDef,
} from "../../lib/investmentCatalog";

export type OperationDef = { id: string; title: string; cashWhenPlayed: number };

/** @deprecated Prefer {@link InvestmentCardDef} from `lib/investmentCatalog.ts` — `title` mirrors catalog `name`. */
export type InvestmentDef = { id: string; title: string; capital: number };

export const OPERATIONS: OperationDef[] = [
  { id: "op_county_rebate", title: "County rebate", cashWhenPlayed: 4 },
  { id: "op_fire_sale", title: "Fire sale", cashWhenPlayed: 3 },
  { id: "op_tour_bus", title: "Tour bus tips", cashWhenPlayed: 5 },
  { id: "op_bridge_loan", title: "Bridge loan", cashWhenPlayed: 6 },
  { id: "op_grain_sweep", title: "Grain sweep", cashWhenPlayed: 4 },
  { id: "op_extra_dray", title: "Extra dray", cashWhenPlayed: 3 },
  { id: "op_sample_pour", title: "Sample pour", cashWhenPlayed: 3 },
  { id: "op_bad_headlines", title: "Bad headlines", cashWhenPlayed: 3 },
];

/** @deprecated Use {@link INVESTMENT_CARDS} / {@link expandInvestmentDeckIds}. */
export const INVESTMENTS: InvestmentDef[] = INVESTMENT_CARDS.map((c) => ({
  id: c.id,
  title: c.name,
  capital: c.capital,
}));

const OP_BY_ID = Object.fromEntries(OPERATIONS.map((c) => [c.id, c]));
const INV_BY_ID = Object.fromEntries(INVESTMENTS.map((c) => [c.id, c]));

export function getOperation(id: string): OperationDef | undefined {
  return OP_BY_ID[id];
}

export function getInvestment(id: string): InvestmentDef | undefined {
  const c = getInvestmentCardDefById(id);
  if (c) return { id: c.id, title: c.name, capital: c.capital };
  return INV_BY_ID[id];
}

export { getInvestmentCardDefById, INVESTMENT_CARDS } from "../../lib/investmentCatalog";
export type { InvestmentCardDef, InvestmentModifier, InvestmentDrawReveal } from "../../lib/investmentCatalog";
