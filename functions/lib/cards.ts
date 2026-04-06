/** Minimal card defs for the playable prototype (ids stable for saves). */

export type OperationDef = { id: string; title: string; cashWhenPlayed: number };
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

export const INVESTMENTS: InvestmentDef[] = [
  { id: "inv_rickhouse", title: "Rickhouse expansion", capital: 6 },
  { id: "inv_climate", title: "Climate-controlled tier", capital: 8 },
  { id: "inv_second_shift", title: "Second shift", capital: 10 },
  { id: "inv_corn_futures", title: "Corn futures", capital: 7 },
  { id: "inv_vertical", title: "Vertical integration", capital: 9 },
  { id: "inv_brand", title: "Brand ambassador", capital: 12 },
];

const OP_BY_ID = Object.fromEntries(OPERATIONS.map((c) => [c.id, c]));
const INV_BY_ID = Object.fromEntries(INVESTMENTS.map((c) => [c.id, c]));

export function getOperation(id: string): OperationDef | undefined {
  return OP_BY_ID[id];
}

export function getInvestment(id: string): InvestmentDef | undefined {
  return INV_BY_ID[id];
}
