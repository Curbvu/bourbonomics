import raw from "./bourbonCatalog.bundled.json";

export type BourbonCardDef = {
  id: string;
  name: string;
  rarity: string;
  demand: number[];
  ages: number[];
  grid: number[][];
};

const data = raw as { cards: BourbonCardDef[] };

export const BOURBON_CARDS: BourbonCardDef[] = data.cards;

export const BOURBON_CARD_IDS: string[] = BOURBON_CARDS.map((c) => c.id);

const byId = Object.fromEntries(BOURBON_CARDS.map((c) => [c.id, c])) as Record<
  string,
  BourbonCardDef
>;

export function getBourbonCardDefById(id: string): BourbonCardDef | undefined {
  return byId[id];
}

/**
 * GAME_RULES / bourbon_cards intro: highest age row ≤ bourbon age, highest demand
 * column ≤ market demand.
 */
export function bourbonLookupIndices(
  card: BourbonCardDef,
  barrelAge: number,
  marketDemand: number
): { row: number; col: number } {
  let row = 0;
  for (let i = 0; i < card.ages.length; i++) {
    if (card.ages[i]! <= barrelAge) row = i;
  }
  let col = 0;
  if (marketDemand > 0) {
    for (let j = 0; j < card.demand.length; j++) {
      if (card.demand[j]! <= marketDemand) col = j;
    }
  }
  return { row, col };
}

/** Demand 0: GAME_RULES fallback (age-only), not the printed grid. */
export function bourbonPayoutFromGrid(
  card: BourbonCardDef,
  barrelAge: number,
  marketDemand: number
): number {
  if (marketDemand <= 0) {
    const a = Math.min(Math.max(0, barrelAge), 12);
    return a;
  }
  const { row, col } = bourbonLookupIndices(card, barrelAge, marketDemand);
  const rowVals = card.grid[row];
  if (!rowVals) return 0;
  return rowVals[col] ?? 0;
}

export type BourbonSaleReveal = {
  bourbonYamlId: string;
  bourbonName: string;
  rarity: string;
  barrelAge: number;
  marketDemandAtSale: number;
  payout: number;
  demand: number[];
  ages: number[];
  grid: number[][];
  usedRow: number;
  usedCol: number;
  /** When demand is 0 at sale, payout follows GAME_RULES age-only fallback (not the printed grid). */
  payoutSource: "grid" | "demand_zero";
  /** Action fee charged for this sell (already applied to cash on the server). */
  actionFeePaid?: number;
};

export function buildBourbonSaleReveal(
  card: BourbonCardDef,
  barrelAge: number,
  marketDemandAtSale: number,
  payout: number
): BourbonSaleReveal {
  const { row, col } = bourbonLookupIndices(card, barrelAge, marketDemandAtSale);
  return {
    bourbonYamlId: card.id,
    bourbonName: card.name,
    rarity: card.rarity,
    barrelAge,
    marketDemandAtSale,
    payout,
    demand: [...card.demand],
    ages: [...card.ages],
    grid: card.grid.map((r) => [...r]),
    usedRow: row,
    usedCol: col,
    payoutSource: marketDemandAtSale <= 0 ? "demand_zero" : "grid",
  };
}
