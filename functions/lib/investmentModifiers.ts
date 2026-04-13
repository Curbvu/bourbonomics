import {
  getInvestmentCardDefById,
  type InvestmentCardDef,
} from "../../lib/investmentCatalog";

/** Per-baron, per-year flags for once-per-round investment modifiers. */
export type InvestmentModifierBaronFlags = {
  investmentModifierRound?: number;
  investmentUsedRickhouseDiscount?: boolean;
  investmentUsedFirstPaidDiscount?: boolean;
  investmentUsedMarketBuyBonus?: boolean;
  investmentUsedNextActionDiscount?: boolean;
};

type HandCard = {
  id: string;
  upright: boolean;
  investmentStatus?: "unbuilt" | "funded_waiting" | "active";
};

type PlayerLite = { investmentHand?: HandCard[] } & InvestmentModifierBaronFlags;

type GameLite = {
  roundNumber: number;
  roundStructureVersion?: number;
  currentPlayerIndex: number;
  playerOrder: string[];
  actionsTakenThisTurn?: number;
  actionFreeWindowActive?: boolean;
  actionPaidLapTier?: number;
  players: Record<string, PlayerLite | undefined>;
};

function effectiveInvestmentStatusLocal(c: HandCard): "unbuilt" | "funded_waiting" | "active" {
  if (c.investmentStatus) return c.investmentStatus;
  return c.upright ? "active" : "unbuilt";
}

function activeInvestmentDefsForPlayer(game: GameLite, playerId: string): InvestmentCardDef[] {
  const p = game.players[playerId];
  if (!p) return [];
  const out: InvestmentCardDef[] = [];
  for (const c of p.investmentHand ?? []) {
    if (effectiveInvestmentStatusLocal(c) !== "active") continue;
    if (!c.upright) continue;
    const def = getInvestmentCardDefById(c.id);
    if (def) out.push(def);
  }
  return out;
}

function effectiveFlags(b: PlayerLite | undefined, round: number) {
  if (!b || b.investmentModifierRound !== round) {
    return {
      rick: false,
      firstPaid: false,
      market: false,
      nextAct: false,
    };
  }
  return {
    rick: b.investmentUsedRickhouseDiscount ?? false,
    firstPaid: b.investmentUsedFirstPaidDiscount ?? false,
    market: b.investmentUsedMarketBuyBonus ?? false,
    nextAct: b.investmentUsedNextActionDiscount ?? false,
  };
}

function withBaronFlags<G extends GameLite>(
  game: G,
  playerId: string,
  round: number,
  patch: Partial<InvestmentModifierBaronFlags>
): G {
  const p = game.players[playerId];
  if (!p) return game;
  const nextFlags: InvestmentModifierBaronFlags = {
    investmentModifierRound: round,
    investmentUsedRickhouseDiscount: p.investmentUsedRickhouseDiscount,
    investmentUsedFirstPaidDiscount: p.investmentUsedFirstPaidDiscount,
    investmentUsedMarketBuyBonus: p.investmentUsedMarketBuyBonus,
    investmentUsedNextActionDiscount: p.investmentUsedNextActionDiscount,
    ...patch,
  };
  const players = { ...game.players };
  players[playerId] = { ...p, ...nextFlags };
  return { ...game, players };
}

/** Sum rickhouse fee discount for this baron this year (once-per-round bucket). */
export function previewRickhouseFeeDiscountForPlayer(game: GameLite, playerId: string): number {
  const round = game.roundNumber;
  const p = game.players[playerId];
  const flags = effectiveFlags(p, round);
  if (flags.rick) return 0;
  let sum = 0;
  for (const def of activeInvestmentDefsForPlayer(game, playerId)) {
    for (const m of def.modifiers) {
      if (m.kind !== "rickhouse_fee_discount") continue;
      sum += m.amount;
    }
  }
  return sum;
}

export function applyRickhouseFeeDiscountToTotal<G extends GameLite>(
  game: G,
  playerId: string,
  feesBeforeDiscount: number
): { game: G; fees: number } {
  const round = game.roundNumber;
  const p = game.players[playerId];
  const flags = effectiveFlags(p, round);
  if (flags.rick || feesBeforeDiscount <= 0) {
    return { game, fees: Math.max(0, feesBeforeDiscount) };
  }
  const discount = previewRickhouseFeeDiscountForPlayer(game, playerId);
  if (discount <= 0) return { game, fees: feesBeforeDiscount };
  const fees = Math.max(0, feesBeforeDiscount - discount);
  const g = withBaronFlags(game, playerId, round, { investmentUsedRickhouseDiscount: true });
  return { game: g, fees };
}

function baseActionCostTable(game: GameLite): number {
  if ((game.roundStructureVersion ?? 0) < 3) {
    const taken = game.actionsTakenThisTurn ?? 0;
    if (taken < 3) return 0;
    if (taken === 3) return 1;
    if (taken === 4) return 2;
    if (taken === 5) return 5;
    if (taken === 6) return 10;
    if (taken === 7) return 15;
    if (taken === 8) return 20;
    if (taken === 9) return 30;
    return 10;
  }
  if (game.actionFreeWindowActive ?? true) return 0;
  return Math.max(1, game.actionPaidLapTier ?? 1);
}

/** Table / legacy: base ladder cost, then investment discounts for `playerId`. */
export function nextActionCashCostForPlayer(game: GameLite, playerId: string | undefined): number {
  if (!playerId) {
    if (!game.playerOrder.length) return 0;
    playerId = game.playerOrder[game.currentPlayerIndex];
  }
  if (!playerId) return 0;

  const base = baseActionCostTable(game);
  if (base <= 0) return 0;

  const round = game.roundNumber;
  const p = game.players[playerId];
  const flags = effectiveFlags(p, round);
  let discount = 0;

  for (const def of activeInvestmentDefsForPlayer(game, playerId)) {
    for (const m of def.modifiers) {
      if (m.kind !== "action_cost_discount") continue;
      if (m.scope === "next_action" && !flags.nextAct) {
        discount += m.amount;
      } else if (m.scope === "per_round_first_paid" && !flags.firstPaid) {
        discount += m.amount;
      }
    }
  }

  return Math.max(0, base - discount);
}

/** After charging a paid action (`baseCostBeforeDiscount` > 0), consume first-paid / next-action flags. */
export function markInvestmentActionDiscountsConsumed<G extends GameLite>(
  game: G,
  playerId: string,
  baseCostBeforeDiscount: number
): G {
  if (baseCostBeforeDiscount <= 0) return game;
  const round = game.roundNumber;
  const p = game.players[playerId];
  const flags = effectiveFlags(p, round);
  const defs = activeInvestmentDefsForPlayer(game, playerId);
  let useFirstPaid = false;
  let useNext = false;
  for (const def of defs) {
    for (const m of def.modifiers) {
      if (m.kind !== "action_cost_discount") continue;
      if (m.scope === "per_round_first_paid" && !flags.firstPaid) useFirstPaid = true;
      if (m.scope === "next_action" && !flags.nextAct) useNext = true;
    }
  }
  const patch: Partial<InvestmentModifierBaronFlags> = {};
  if (useFirstPaid) patch.investmentUsedFirstPaidDiscount = true;
  if (useNext) patch.investmentUsedNextActionDiscount = true;
  if (Object.keys(patch).length === 0) return game;
  return withBaronFlags(game, playerId, round, patch);
}

/** Extra resource cards for a market buy (this baron, this year). */
export function marketBuyExtraCardCount(game: GameLite, playerId: string): number {
  const round = game.roundNumber;
  const p = game.players[playerId];
  const flags = effectiveFlags(p, round);
  if (flags.market) return 0;
  let sum = 0;
  for (const def of activeInvestmentDefsForPlayer(game, playerId)) {
    for (const m of def.modifiers) {
      if (m.kind !== "market_buy_bonus_cards") continue;
      sum += m.extra;
    }
  }
  return sum;
}

export function markMarketBuyBonusConsumed<G extends GameLite>(
  game: G,
  playerId: string
): G {
  const extra = marketBuyExtraCardCount(game, playerId);
  if (extra <= 0) return game;
  const round = game.roundNumber;
  return withBaronFlags(game, playerId, round, { investmentUsedMarketBuyBonus: true });
}

/** Ladder cost before investment discounts (snapshot before incrementing `actionsTakenThisTurn`). */
export function nextActionCashBaseCostFromGame(game: GameLite): number {
  return baseActionCostTable(game);
}

/** Clear persisted per-baron flags at year rollover (correctness already uses `roundNumber`; this shrinks items). */
export function clearInvestmentModifierTracking<G extends GameLite>(game: G): G {
  const players = { ...game.players };
  for (const pid of Object.keys(players)) {
    const p = players[pid];
    if (!p) continue;
    const next = { ...p };
    delete next.investmentModifierRound;
    delete next.investmentUsedRickhouseDiscount;
    delete next.investmentUsedFirstPaidDiscount;
    delete next.investmentUsedMarketBuyBonus;
    delete next.investmentUsedNextActionDiscount;
    players[pid] = next;
  }
  return { ...game, players };
}
