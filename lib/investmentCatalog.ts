import raw from "./investmentCatalog.bundled.json";

/** Engine-supported modifier shapes (must match sync script + YAML). */
export type InvestmentModifier =
  | {
      kind: "action_cost_discount";
      amount: number;
      scope: "next_action" | "per_round_first_paid";
    }
  | { kind: "rickhouse_fee_discount"; amount: number; oncePerRound: boolean }
  | { kind: "market_buy_bonus_cards"; extra: number; oncePerRound: boolean };

export type InvestmentCardDef = {
  id: string;
  name: string;
  rarity: string;
  capital: number;
  short: string;
  effect: string;
  deckCopies: number;
  modifiers: InvestmentModifier[];
};

const data = raw as { meta: unknown; cards: InvestmentCardDef[] };

export const INVESTMENT_CARDS: InvestmentCardDef[] = data.cards;

export const INVESTMENT_CARD_IDS: string[] = INVESTMENT_CARDS.map((c) => c.id);

const byId = Object.fromEntries(INVESTMENT_CARDS.map((c) => [c.id, c])) as Record<
  string,
  InvestmentCardDef
>;

export function getInvestmentCardDefById(id: string): InvestmentCardDef | undefined {
  return byId[id];
}

/** Expand deck: one entry per copy (deckCopies) for shuffle / deal. */
export function expandInvestmentDeckIds(): string[] {
  const ids: string[] = [];
  for (const c of INVESTMENT_CARDS) {
    const n = Math.max(1, Math.floor(c.deckCopies));
    for (let i = 0; i < n; i++) ids.push(c.id);
  }
  return ids;
}

/** Payload for draw reveal UI + API (marshall-safe). */
export type InvestmentDrawReveal = {
  catalogId: string;
  name: string;
  rarity: string;
  capital: number;
  short: string;
  effect: string;
  modifierSummaries: string[];
};

function modifierSummary(m: InvestmentModifier): string {
  if (m.kind === "action_cost_discount") {
    return m.scope === "next_action"
      ? `Next action −$${m.amount}`
      : `First paid action this year −$${m.amount}`;
  }
  if (m.kind === "rickhouse_fee_discount") {
    return m.oncePerRound ? `Rickhouse fees −$${m.amount} (once/year)` : `Rickhouse fees −$${m.amount}`;
  }
  return m.oncePerRound
    ? `First market buy +${m.extra} card(s) (once/year)`
    : `Market buy +${m.extra} card(s)`;
}

export function buildInvestmentDrawReveal(def: InvestmentCardDef): InvestmentDrawReveal {
  return {
    catalogId: def.id,
    name: def.name,
    rarity: def.rarity,
    capital: def.capital,
    short: def.short,
    effect: def.effect,
    modifierSummaries: def.modifiers.map(modifierSummary),
  };
}
