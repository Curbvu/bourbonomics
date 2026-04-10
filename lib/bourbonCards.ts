import raw from "./bourbonCatalog.bundled.json";

export type BourbonCardDef = {
  id: string;
  name: string;
  rarity: string;
  /**
   * Fixed 3×3 Market Price Guide: rows = age bands (young → old), columns =
   * demand bands (low → high). See `BOURBON_MARKET_GUIDE_*_BANDS`.
   */
  grid: number[][];
};

/** Demand columns on every card (market demand in “barrels”). */
export const BOURBON_MARKET_GUIDE_DEMAND_BANDS = [
  { label: "Low", rangeLabel: "2–3", min: 2, max: 3 },
  { label: "Mid", rangeLabel: "4–5", min: 4, max: 5 },
  { label: "High", rangeLabel: "6+", min: 6, max: 12 },
] as const;

/** Age rows on every card (years in barrel). */
export const BOURBON_MARKET_GUIDE_AGE_BANDS = [
  { label: "2–3", min: 2, max: 3 },
  { label: "4–7", min: 4, max: 7 },
  { label: "8+", min: 8, max: 12 },
] as const;

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

/** Map barrel age (years) to row index 0..2. Ages above 12 clamp to the top band. */
export function bourbonAgeBandIndex(barrelAge: number): number {
  const a = Math.min(Math.max(0, barrelAge), 12);
  if (a <= 3) return 0;
  if (a <= 7) return 1;
  return 2;
}

/**
 * Map market demand to column index 0..2.
 * Values 0–3 → Low; 4–5 → Mid; 6+ → High (demand 0 is handled before grid payout).
 */
export function bourbonDemandBandIndex(marketDemand: number): number {
  if (marketDemand <= 3) return 0;
  if (marketDemand <= 5) return 1;
  return 2;
}

export function bourbonLookupIndices(
  card: BourbonCardDef,
  barrelAge: number,
  marketDemand: number
): { row: number; col: number } {
  void card;
  return {
    row: bourbonAgeBandIndex(barrelAge),
    col: bourbonDemandBandIndex(marketDemand),
  };
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
  /** Column titles for the table, e.g. `Low (2–3)`. */
  demandBandHeaders: string[];
  /** Row labels, e.g. `2–3`, `4–7`, `8+`. */
  ageBandLabels: string[];
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
  const demandBandHeaders = BOURBON_MARKET_GUIDE_DEMAND_BANDS.map(
    (b) => `${b.label} (${b.rangeLabel})`
  );
  const ageBandLabels = BOURBON_MARKET_GUIDE_AGE_BANDS.map((b) => b.label);
  const { row, col } = bourbonLookupIndices(card, barrelAge, marketDemandAtSale);
  return {
    bourbonYamlId: card.id,
    bourbonName: card.name,
    rarity: card.rarity,
    barrelAge,
    marketDemandAtSale,
    payout,
    demandBandHeaders,
    ageBandLabels,
    grid: card.grid.map((r) => [...r]),
    usedRow: row,
    usedCol: col,
    payoutSource: marketDemandAtSale <= 0 ? "demand_zero" : "grid",
  };
}
