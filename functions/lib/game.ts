import {
  getInvestment,
  getOperation,
  INVESTMENTS,
  OPERATIONS,
} from "./cards";

/** Short id for game code (e.g. 6 alphanumeric). */
export function shortId(length = 6): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export type GameMode = "normal" | "bottled-in-bond" | "singleplayer";
export type GameStatus = "lobby" | "in_progress" | "finished";

/** Computer player IDs start with this prefix. */
export const BOT_ID_PREFIX = "bot_";
export function isBotPlayer(playerId: string): boolean {
  return playerId.startsWith(BOT_ID_PREFIX);
}

/** Operations card in hand (resolved from deck). */
export interface OperationsCardInHand {
  id: string;
  title: string;
  cashWhenPlayed: number;
}

/** Investment card: sideways until capital paid. */
export interface InvestmentCardInHand {
  id: string;
  title: string;
  capital: number;
  upright: boolean;
}

export interface Player {
  id: string;
  name: string;
  cash: number;
  resourceCards: string[];
  barrelledBourbons: BarrelledBourbon[];
  bourbonCards: BourbonCard[];
  operationsHand: OperationsCardInHand[];
  investmentHand: InvestmentCardInHand[];
}

export interface BarrelledBourbon {
  id: string;
  rickhouseId: string;
  age: number;
  mashRef: string;
}

export interface BourbonCard {
  id: string;
  cardType: string;
  silverAward?: boolean;
  goldAward?: boolean;
}

export interface RickhouseBarrel {
  playerId: string;
  barrelId: string;
  age: number;
}

export interface Rickhouse {
  id: string;
  capacity: number;
  barrels: RickhouseBarrel[];
}

export interface GameDoc {
  gameId: string;
  mode: GameMode;
  status: GameStatus;
  playerOrder: string[];
  players: Record<string, Player>;
  currentPhase: number;
  currentPlayerIndex: number;
  marketDemand: number;
  turnNumber: number;
  winnerIds?: string[];
  /**
   * Escalating action costs for the current player this turn (GAME_RULES):
   * next action costs `$actionsTakenThisTurn` (0, then 1, then 2, …).
   * Resets when the turn ends (after Market phase).
   */
  actionsTakenThisTurn: number;
  /** Shuffled operation card ids remaining in the deck. */
  operationsDeck: string[];
  /** Shuffled investment card ids remaining in the deck. */
  investmentDeck: string[];
  rickhouses: Rickhouse[];
  marketGoods: string[];
  resourceDeck: string[];
  createdAt: number;
  updatedAt: number;
}

export const INITIAL_MARKET_DEMAND = 2;
export const RICKHOUSE_CAPACITIES = [3, 4, 5, 6, 4, 5]; // 6 rickhouses
export const STARTING_CASH = 10;
export const PHASE_NAMES = [
  "",
  "Rickhouse Fees",
  "Preparation",
  "Operations",
  "Market",
] as const;

const RESOURCE_TYPES = ["Cask", "Corn", "Barley", "Wheat", "Rye", "Flavor"] as const;

function shuffle<T>(arr: T[]): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Build a full resource deck (simplified: fixed counts per type). */
function buildResourceDeck(): string[] {
  const deck: string[] = [];
  const counts: Record<string, number> = {
    Cask: 30,
    Corn: 30,
    Barley: 30,
    Wheat: 60,
    Rye: 60,
    Flavor: 20,
  };
  for (const [type, n] of Object.entries(counts)) {
    for (let i = 0; i < n; i++) deck.push(type);
  }
  return shuffle(deck);
}

export function createNewGame(gameId: string, mode: GameMode): GameDoc {
  const now = Date.now();
  const deck = buildResourceDeck();
  const marketGoods = deck.splice(0, 5);
  const rickhouses: Rickhouse[] = RICKHOUSE_CAPACITIES.map((capacity, i) => ({
    id: `rickhouse-${i}`,
    capacity,
    barrels: [],
  }));
  return {
    gameId,
    mode,
    status: "lobby",
    playerOrder: [],
    players: {},
    currentPhase: 1,
    currentPlayerIndex: 0,
    marketDemand: INITIAL_MARKET_DEMAND,
    turnNumber: 0,
    actionsTakenThisTurn: 0,
    operationsDeck: shuffle(OPERATIONS.map((c) => c.id)),
    investmentDeck: shuffle(INVESTMENTS.map((c) => c.id)),
    rickhouses,
    marketGoods,
    resourceDeck: deck,
    createdAt: now,
    updatedAt: now,
  };
}

export function addPlayerToGame(game: GameDoc, playerId: string, name: string): GameDoc {
  const now = Date.now();
  return {
    ...game,
    playerOrder: [...game.playerOrder, playerId],
    players: {
      ...game.players,
      [playerId]: {
        id: playerId,
        name,
        cash: 0,
        resourceCards: [],
        barrelledBourbons: [],
        bourbonCards: [],
        operationsHand: [],
        investmentHand: [],
      },
    },
    updatedAt: now,
  };
}

export function startGame(game: GameDoc): GameDoc {
  const now = Date.now();
  const players: Record<string, Player> = {};
  for (const pid of game.playerOrder) {
    const p = game.players[pid];
    if (p) players[pid] = { ...p, cash: STARTING_CASH };
  }
  let rickhouses = game.rickhouses;
  let marketGoods = game.marketGoods;
  let resourceDeck = game.resourceDeck;
  if (!rickhouses?.length) {
    rickhouses = RICKHOUSE_CAPACITIES.map((capacity, i) => ({
      id: `rickhouse-${i}`,
      capacity,
      barrels: [],
    }));
  }
  if (!resourceDeck?.length) {
    resourceDeck = buildResourceDeck();
    marketGoods = resourceDeck.splice(0, 5);
  }
  const opsDeck =
    game.operationsDeck?.length ? [...game.operationsDeck] : shuffle(OPERATIONS.map((c) => c.id));
  const invDeck =
    game.investmentDeck?.length ? [...game.investmentDeck] : shuffle(INVESTMENTS.map((c) => c.id));

  const playersWithHands: Record<string, Player> = {};
  for (const pid of Object.keys(players)) {
    const p = players[pid];
    playersWithHands[pid] = {
      ...p,
      operationsHand: p.operationsHand ?? [],
      investmentHand: p.investmentHand ?? [],
    };
  }

  return {
    ...game,
    status: "in_progress",
    players: playersWithHands,
    currentPhase: 1,
    currentPlayerIndex: 0,
    turnNumber: 1,
    actionsTakenThisTurn: 0,
    operationsDeck: opsDeck,
    investmentDeck: invDeck,
    rickhouses,
    marketGoods: marketGoods ?? game.marketGoods ?? [],
    resourceDeck: resourceDeck ?? game.resourceDeck ?? [],
    updatedAt: now,
  };
}

/** Roll 2 dice: different numbers => +1 demand (max 6); doubles => subtract that number. */
export function rollMarketDice(currentDemand: number): number {
  const a = Math.floor(Math.random() * 6) + 1;
  const b = Math.floor(Math.random() * 6) + 1;
  if (a === b) return Math.max(0, currentDemand - a);
  return Math.min(6, currentDemand + 1);
}

/** Check win conditions. Returns winnerIds if game is over. */
export function checkWinConditions(game: GameDoc): string[] | null {
  if (game.status !== "in_progress") return null;
  const players = game.playerOrder.map((id) => game.players[id]).filter(Boolean);
  const bankrupt = players.filter((p) => p.cash < 0);
  if (bankrupt.length >= players.length - 1 && players.length >= 2) {
    const last = players.find((p) => p.cash >= 0);
    return last ? [last.id] : [];
  }
  for (const p of players) {
    const barrelledIn = new Set(
      (p.barrelledBourbons ?? []).map((b) => b.rickhouseId)
    );
    if (barrelledIn.size >= 6) return [p.id];
  }
  const goldCount = (pid: string) =>
    (game.players[pid]?.bourbonCards ?? []).filter(
      (c: BourbonCard) => c.goldAward
    ).length;
  for (const p of players) {
    if (goldCount(p.id) >= 3) return [p.id];
  }
  return null;
}

export function advancePhase(game: GameDoc): GameDoc {
  const now = Date.now();
  if (game.currentPhase < 4) {
    const next = game.currentPhase + 1;
    return { ...game, currentPhase: next, updatedAt: now };
  }
  const newDemand = rollMarketDice(game.marketDemand);
  const nextIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
  let out: GameDoc = {
    ...game,
    currentPhase: 1,
    currentPlayerIndex: nextIndex,
    turnNumber: nextIndex === 0 ? game.turnNumber + 1 : game.turnNumber,
    marketDemand: newDemand,
    actionsTakenThisTurn: 0,
    updatedAt: now,
  };
  const winners = checkWinConditions(out);
  if (winners?.length) out = { ...out, status: "finished", winnerIds: winners };
  return out;
}

/** Next action costs `$actionsTakenThisTurn` (0, 1, 2, …) per GAME_RULES. */
export function nextActionCashCost(actionsTakenThisTurn: number): number {
  return actionsTakenThisTurn;
}

const MARKET_LINE_SIZE = 5;
const MARKET_BUY_COUNT = 3;

/** Buy from market (3 face-up goods) or 2 random from deck. One action; escalating cash cost only. Phase 2. */
export function buyResources(
  game: GameDoc,
  option: "market" | "random"
): { game: GameDoc; error?: string } {
  if (game.currentPhase !== 2) return { game, error: "Only in Preparation phase" };
  const pid = game.playerOrder[game.currentPlayerIndex];
  if (!pid) return { game, error: "No current player" };
  const player = game.players[pid];
  if (!player) return { game, error: "Player not found" };

  const actionCost = game.actionsTakenThisTurn ?? 0;
  if (player.cash < actionCost)
    return { game, error: "Not enough cash for this action" };

  const drawn: string[] = [];
  const now = Date.now();
  let marketGoods = [...game.marketGoods];
  let resourceDeck = [...game.resourceDeck];

  if (option === "market") {
    const take = Math.min(MARKET_BUY_COUNT, marketGoods.length);
    if (take === 0) return { game, error: "Market empty" };
    for (let i = 0; i < take; i++) {
      const g = marketGoods.shift();
      if (g) drawn.push(g);
    }
    while (marketGoods.length < MARKET_LINE_SIZE && resourceDeck.length > 0) {
      marketGoods.push(resourceDeck.shift()!);
    }
  } else {
    if (resourceDeck.length < 2) return { game, error: "Not enough cards in deck" };
    drawn.push(resourceDeck.shift()!);
    drawn.push(resourceDeck.shift()!);
  }

  const newPlayers = { ...game.players };
  newPlayers[pid] = {
    ...player,
    cash: player.cash - actionCost,
    resourceCards: [...player.resourceCards, ...drawn],
  };

  return {
    game: {
      ...game,
      players: newPlayers,
      marketGoods,
      resourceDeck,
      actionsTakenThisTurn: actionCost + 1,
      updatedAt: now,
    },
  };
}

/** Mash: 1 Cask, 1 Corn, 1 Barley, >=1 Wheat or Rye. */
export function canMash(cards: string[]): boolean {
  const has = (t: string) => cards.filter((c) => c === t).length >= 1;
  const hasWheatOrRye = has("Wheat") || has("Rye");
  return has("Cask") && has("Corn") && has("Barley") && hasWheatOrRye;
}

/** Remove one mash set from hand. Returns new hand or null if impossible. */
export function removeMashFromHand(cards: string[]): string[] | null {
  const need = ["Cask", "Corn", "Barley"];
  const needOneOf = ["Wheat", "Rye"];
  const hand = [...cards];
  for (const t of need) {
    const i = hand.indexOf(t);
    if (i === -1) return null;
    hand.splice(i, 1);
  }
  const idx = hand.findIndex((c) => needOneOf.includes(c));
  if (idx === -1) return null;
  hand.splice(idx, 1);
  return hand;
}

export function barrelBourbon(
  game: GameDoc,
  rickhouseId: string,
  playerId: string
): { game: GameDoc; error?: string } {
  if (game.currentPhase !== 3) return { game, error: "Only in Operations phase" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };

  const player = game.players[playerId];
  if (!player) return { game, error: "Player not found" };
  if (!canMash(player.resourceCards)) return { game, error: "Need a mash (1 Cask, 1 Corn, 1 Barley, 1 Wheat or Rye)" };

  const rick = game.rickhouses.find((r) => r.id === rickhouseId);
  if (!rick) return { game, error: "Rickhouse not found" };
  if (rick.barrels.length >= rick.capacity) return { game, error: "Rickhouse full" };

  const newHand = removeMashFromHand(player.resourceCards);
  if (!newHand) return { game, error: "Cannot remove mash from hand" };

  const rent = rick.barrels.length + 1;
  const actionCost = game.actionsTakenThisTurn ?? 0;
  if (player.cash < rent + actionCost)
    return { game, error: "Not enough cash for rent and action cost" };

  const barrelId = `barrel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const barrel: RickhouseBarrel = { playerId, barrelId, age: 0 };
  const barrelRef: BarrelledBourbon = {
    id: barrelId,
    rickhouseId,
    age: 0,
    mashRef: "default",
  };

  const now = Date.now();
  const newRickhouses = game.rickhouses.map((r) =>
    r.id === rickhouseId
      ? { ...r, barrels: [...r.barrels, barrel] }
      : r
  );
  const newPlayers = { ...game.players };
  newPlayers[playerId] = {
    ...player,
    cash: player.cash - rent - actionCost,
    resourceCards: newHand,
    barrelledBourbons: [...player.barrelledBourbons, barrelRef],
  };

  let updated: GameDoc = {
    ...game,
    rickhouses: newRickhouses,
    players: newPlayers,
    actionsTakenThisTurn: actionCost + 1,
    updatedAt: now,
  };
  const winners = checkWinConditions(updated);
  if (winners?.length) {
    updated = { ...updated, status: "finished", winnerIds: winners };
  }
  return { game: updated };
}

function inActionPhases(phase: number): boolean {
  return phase >= 2 && phase <= 4;
}

/** Draw top operations card (costs current action price). Phases 2–4. */
export function drawOperationsCard(
  game: GameDoc,
  playerId: string
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Operations draws only in phases 2–4" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  const player = ensurePlayerHands(game.players[playerId]);
  if (!player) return { game, error: "Player not found" };

  const actionCost = game.actionsTakenThisTurn ?? 0;
  if (player.cash < actionCost)
    return { game, error: "Not enough cash for this action" };
  const deck = [...(game.operationsDeck ?? [])];
  if (deck.length === 0) return { game, error: "Operations deck empty" };
  const id = deck.shift()!;
  const def = getOperation(id);
  if (!def) return { game, error: "Invalid operations card" };

  const card: OperationsCardInHand = {
    id: def.id,
    title: def.title,
    cashWhenPlayed: def.cashWhenPlayed,
  };
  const now = Date.now();
  const newPlayers = { ...game.players };
  newPlayers[playerId] = {
    ...player,
    cash: player.cash - actionCost,
    operationsHand: [...player.operationsHand, card],
  };
  return {
    game: {
      ...game,
      players: newPlayers,
      operationsDeck: deck,
      actionsTakenThisTurn: actionCost + 1,
      updatedAt: now,
    },
  };
}

/** Draw top investment card (sideways until capitalized). Phases 2–4. */
export function drawInvestmentCard(
  game: GameDoc,
  playerId: string
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Investment draws only in phases 2–4" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  const player = ensurePlayerHands(game.players[playerId]);
  if (!player) return { game, error: "Player not found" };

  const actionCost = game.actionsTakenThisTurn ?? 0;
  if (player.cash < actionCost)
    return { game, error: "Not enough cash for this action" };
  const deck = [...(game.investmentDeck ?? [])];
  if (deck.length === 0) return { game, error: "Investment deck empty" };
  const id = deck.shift()!;
  const def = getInvestment(id);
  if (!def) return { game, error: "Invalid investment card" };

  const card: InvestmentCardInHand = {
    id: def.id,
    title: def.title,
    capital: def.capital,
    upright: false,
  };
  const now = Date.now();
  const newPlayers = { ...game.players };
  newPlayers[playerId] = {
    ...player,
    cash: player.cash - actionCost,
    investmentHand: [...player.investmentHand, card],
  };
  return {
    game: {
      ...game,
      players: newPlayers,
      investmentDeck: deck,
      actionsTakenThisTurn: actionCost + 1,
      updatedAt: now,
    },
  };
}

/** Pay escalating action cost + printed capital to stand an investment upright. */
export function capitalizeInvestment(
  game: GameDoc,
  playerId: string,
  handIndex: number
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Capitalize only in phases 2–4" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  const player = ensurePlayerHands(game.players[playerId]);
  if (!player) return { game, error: "Player not found" };
  const card = player.investmentHand[handIndex];
  if (!card) return { game, error: "No card at that index" };
  if (card.upright) return { game, error: "Already capitalized" };

  const actionCost = game.actionsTakenThisTurn ?? 0;
  const total = actionCost + card.capital;
  if (player.cash < total)
    return { game, error: "Not enough cash for action + capital" };

  const now = Date.now();
  const next = [...player.investmentHand];
  next[handIndex] = { ...card, upright: true };
  const newPlayers = { ...game.players };
  newPlayers[playerId] = {
    ...player,
    cash: player.cash - total,
    investmentHand: next,
  };
  return {
    game: {
      ...game,
      players: newPlayers,
      actionsTakenThisTurn: actionCost + 1,
      updatedAt: now,
    },
  };
}

/** Resolve an operations card from hand (pay action cost, gain printed cash). */
export function playOperationsCard(
  game: GameDoc,
  playerId: string,
  handIndex: number
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Play operations only in phases 2–4" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  const player = ensurePlayerHands(game.players[playerId]);
  if (!player) return { game, error: "Player not found" };
  const card = player.operationsHand[handIndex];
  if (!card) return { game, error: "No card at that index" };

  const actionCost = game.actionsTakenThisTurn ?? 0;
  if (player.cash < actionCost)
    return { game, error: "Not enough cash for this action" };

  const now = Date.now();
  const nextHand = player.operationsHand.filter((_, i) => i !== handIndex);
  const newPlayers = { ...game.players };
  newPlayers[playerId] = {
    ...player,
    cash: player.cash - actionCost + card.cashWhenPlayed,
    operationsHand: nextHand,
  };
  let updated: GameDoc = {
    ...game,
    players: newPlayers,
    actionsTakenThisTurn: actionCost + 1,
    updatedAt: now,
  };
  const winners = checkWinConditions(updated);
  if (winners?.length) {
    updated = { ...updated, status: "finished", winnerIds: winners };
  }
  return { game: updated };
}

function ensurePlayerHands(p: Player | undefined): Player | undefined {
  if (!p) return undefined;
  return {
    ...p,
    operationsHand: p.operationsHand ?? [],
    investmentHand: p.investmentHand ?? [],
  };
}

/** Defaults for older Dynamo items (safe to call on read). */
export function normalizeGame(game: GameDoc): GameDoc {
  const players: Record<string, Player> = {};
  for (const pid of game.playerOrder) {
    const p = game.players[pid];
    if (!p) continue;
    players[pid] = ensurePlayerHands(p)!;
  }
  return {
    ...game,
    actionsTakenThisTurn: game.actionsTakenThisTurn ?? 0,
    operationsDeck: game.operationsDeck ?? [],
    investmentDeck: game.investmentDeck ?? [],
    players,
  };
}
