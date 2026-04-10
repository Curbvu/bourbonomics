import {
  getInvestment,
  getOperation,
  INVESTMENTS,
  OPERATIONS,
} from "./cards";
export {
  KENTUCKY_BOURBON_TRAIL_REGIONS,
  rickhouseRegionLabel,
} from "../../lib/rickhouses";

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

/** Computer (bot) baron IDs start with this prefix. */
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

export interface Baron {
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
  /** Resource card types committed to this mash when barreled (see GAME_RULES bourbon cycle). */
  mashCards?: string[];
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

/** Face-down market piles (GAME_RULES): Cask, Corn, Grain (Barley / Rye / Wheat / Flavor). */
export interface MarketPiles {
  cask: string[];
  corn: string[];
  grain: string[];
}

/** Result of the Phase 2 bourbon demand dice (stored for the top bar / last roll line). */
export type LastDemandRoll = {
  die1: number;
  die2: number;
  sum: number;
  demandBefore: number;
  demandAfter: number;
  doubleSix: boolean;
};

export interface GameDoc {
  gameId: string;
  mode: GameMode;
  status: GameStatus;
  playerOrder: string[];
  players: Record<string, Baron>;
  currentPhase: number;
  currentPlayerIndex: number;
  marketDemand: number;
  turnNumber: number;
  winnerIds?: string[];
  /**
   * Count of actions already taken this turn; next action cost is `nextActionCashCost(actionsTakenThisTurn)`.
   * Resets when the turn ends (after the Action phase).
   */
  actionsTakenThisTurn: number;
  /** After Phase 1 fees are resolved, the baron may advance (GAME_RULES). */
  rickhouseFeesPaidThisTurn?: boolean;
  /** `2` = three-phase turn (age → demand roll → actions). Older saves omit and migrate in normalizeGame. */
  turnStructureVersion?: number;
  /** Set when the baron rolls demand in Phase 2 (mock dice for UI). Cleared when entering Phase 2. */
  lastDemandRoll?: LastDemandRoll;
  /** Shuffled operation card ids remaining in the deck. */
  operationsDeck: string[];
  /** Shuffled investment card ids remaining in the deck. */
  investmentDeck: string[];
  rickhouses: Rickhouse[];
  /** @deprecated Use marketPiles; kept for migration in normalizeGame. */
  marketGoods?: string[];
  marketPiles: MarketPiles;
  resourceDeck: string[];
  createdAt: number;
  updatedAt: number;
}

export const INITIAL_MARKET_DEMAND = 6;
/** Capacities per slot; indices align with Kentucky Bourbon Trail® regions (see `lib/rickhouses.ts`). */
export const RICKHOUSE_CAPACITIES = [3, 4, 5, 6, 4, 5]; // 6 rickhouses
export const STARTING_CASH = 25;
export const PHASE_NAMES = [
  "",
  "Age bourbons",
  "Market demand",
  "Action phase",
] as const;

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

function isGrainCard(type: string): boolean {
  return type === "Barley" || type === "Rye" || type === "Wheat" || type === "Flavor";
}

/** Split a shuffled deck into the three face-down market piles (GAME_RULES). */
export function splitDeckIntoMarketPiles(deck: string[]): MarketPiles {
  const raw: MarketPiles = { cask: [], corn: [], grain: [] };
  for (const c of deck) {
    if (c === "Cask") raw.cask.push(c);
    else if (c === "Corn") raw.corn.push(c);
    else raw.grain.push(c);
  }
  return {
    cask: shuffle(raw.cask),
    corn: shuffle(raw.corn),
    grain: shuffle(raw.grain),
  };
}

function emptyMarketPiles(): MarketPiles {
  return { cask: [], corn: [], grain: [] };
}

export function createNewGame(gameId: string, mode: GameMode): GameDoc {
  const now = Date.now();
  const deck = buildResourceDeck();
  const marketPiles = splitDeckIntoMarketPiles(deck);
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
    rickhouseFeesPaidThisTurn: false,
    turnStructureVersion: 2,
    operationsDeck: shuffle(OPERATIONS.map((c) => c.id)),
    investmentDeck: shuffle(INVESTMENTS.map((c) => c.id)),
    rickhouses,
    marketPiles,
    resourceDeck: [],
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
  const players: Record<string, Baron> = {};
  for (const pid of game.playerOrder) {
    const p = game.players[pid];
    if (p) players[pid] = { ...p, cash: STARTING_CASH };
  }
  let rickhouses = game.rickhouses;
  let marketPiles = game.marketPiles;
  let resourceDeck = game.resourceDeck ?? [];
  if (!rickhouses?.length) {
    rickhouses = RICKHOUSE_CAPACITIES.map((capacity, i) => ({
      id: `rickhouse-${i}`,
      capacity,
      barrels: [],
    }));
  }
  const pilesEmpty =
    !marketPiles ||
    (marketPiles.cask.length === 0 &&
      marketPiles.corn.length === 0 &&
      marketPiles.grain.length === 0);
  if (pilesEmpty) {
    const deck =
      resourceDeck.length > 0
        ? shuffle([...resourceDeck])
        : buildResourceDeck();
    const legacyLine = game.marketGoods ?? [];
    marketPiles = splitDeckIntoMarketPiles([...deck, ...legacyLine]);
    resourceDeck = [];
  }
  const opsDeck =
    game.operationsDeck?.length ? [...game.operationsDeck] : shuffle(OPERATIONS.map((c) => c.id));
  const invDeck =
    game.investmentDeck?.length ? [...game.investmentDeck] : shuffle(INVESTMENTS.map((c) => c.id));

  const playersWithHands: Record<string, Baron> = {};
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
    rickhouseFeesPaidThisTurn: false,
    turnStructureVersion: 2,
    operationsDeck: opsDeck,
    investmentDeck: invDeck,
    rickhouses,
    marketPiles: marketPiles ?? emptyMarketPiles(),
    resourceDeck,
    updatedAt: now,
  };
}

/**
 * Resolve demand after two d6 (GAME_RULES): sum > current demand ⇒ +1 (max 12); double 6 ⇒ 12.
 */
export function demandAfterDice(
  currentDemand: number,
  die1: number,
  die2: number
): number {
  if (die1 === 6 && die2 === 6) return 12;
  const sum = die1 + die2;
  if (sum > currentDemand) return Math.min(12, currentDemand + 1);
  return currentDemand;
}

/** Roll two d6 and return full detail (mock “dice” for UI). */
export function rollMarketDemandDice(currentDemand: number): LastDemandRoll {
  const die1 = Math.floor(Math.random() * 6) + 1;
  const die2 = Math.floor(Math.random() * 6) + 1;
  const demandBefore = currentDemand;
  const demandAfter = demandAfterDice(demandBefore, die1, die2);
  return {
    die1,
    die2,
    sum: die1 + die2,
    demandBefore,
    demandAfter,
    doubleSix: die1 === 6 && die2 === 6,
  };
}

/** @deprecated Prefer {@link rollMarketDemandDice}. */
export function rollMarketDice(currentDemand: number): number {
  return rollMarketDemandDice(currentDemand).demandAfter;
}

/** Phase 2: current baron rolls demand dice and advances to the Action phase. */
export function rollDemandAndAdvance(
  game: GameDoc,
  playerId: string
): { game: GameDoc; error?: string } {
  if (game.status !== "in_progress")
    return { game, error: "Game not in progress" };
  if (game.currentPhase !== 2)
    return { game, error: "Roll demand only in Phase 2 (market demand)" };
  const currentId = game.playerOrder[game.currentPlayerIndex];
  if (currentId !== playerId) return { game, error: "Not your turn" };

  const roll = rollMarketDemandDice(game.marketDemand);
  const now = Date.now();
  return {
    game: {
      ...game,
      marketDemand: roll.demandAfter,
      currentPhase: 3,
      lastDemandRoll: roll,
      updatedAt: now,
    },
  };
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

export type AdvancePhaseResult = { game: GameDoc; error?: string };

export function advancePhase(game: GameDoc): AdvancePhaseResult {
  const now = Date.now();
  if (game.currentPhase === 1) {
    if (
      game.status === "in_progress" &&
      !(game.rickhouseFeesPaidThisTurn ?? false)
    ) {
      return { game, error: "Pay rickhouse fees before continuing." };
    }
    return {
      game: {
        ...game,
        currentPhase: 2,
        lastDemandRoll: undefined,
        updatedAt: now,
      },
    };
  }
  if (game.currentPhase === 2) {
    return {
      game,
      error: "Roll market demand (use Roll dice) before the Action phase.",
    };
  }
  if (game.currentPhase === 3) {
    const nextIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
    let out: GameDoc = {
      ...game,
      currentPhase: 1,
      currentPlayerIndex: nextIndex,
      turnNumber: nextIndex === 0 ? game.turnNumber + 1 : game.turnNumber,
      actionsTakenThisTurn: 0,
      rickhouseFeesPaidThisTurn: false,
      updatedAt: now,
    };
    const winners = checkWinConditions(out);
    if (winners?.length) out = { ...out, status: "finished", winnerIds: winners };
    return { game: out };
  }
  return { game: { ...game, currentPhase: 1, updatedAt: now } };
}

/**
 * Per GAME_RULES: first 3 actions free; 4th $1, 5th $2, 6th $5, 7th $10, 8th $15, 9th $20, 10th $30; then $10 each.
 * `actionsTakenThisTurn` is the count of actions already completed this turn.
 */
export function nextActionCashCost(actionsTakenThisTurn: number): number {
  if (actionsTakenThisTurn < 3) return 0;
  if (actionsTakenThisTurn === 3) return 1;
  if (actionsTakenThisTurn === 4) return 2;
  if (actionsTakenThisTurn === 5) return 5;
  if (actionsTakenThisTurn === 6) return 10;
  if (actionsTakenThisTurn === 7) return 15;
  if (actionsTakenThisTurn === 8) return 20;
  if (actionsTakenThisTurn === 9) return 30;
  return 10;
}

const MARKET_BUY_COUNT = 3;

function inActionPhases(phase: number): boolean {
  return phase === 3;
}

export type MarketBuyPicks = { cask: number; corn: number; grain: number };

/** Draw exactly 3 cards from the three face-down piles (GAME_RULES). One action. */
export function buyResources(
  game: GameDoc,
  picks: MarketBuyPicks | "random"
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Market buy only during the Action phase" };
  const pid = game.playerOrder[game.currentPlayerIndex];
  if (!pid) return { game, error: "No current baron" };
  const player = game.players[pid];
  if (!player) return { game, error: "Baron not found" };

  const taken = game.actionsTakenThisTurn ?? 0;
  const actionCost = nextActionCashCost(taken);
  if (player.cash < actionCost)
    return { game, error: "Not enough cash for this action" };

  const piles: MarketPiles = {
    cask: [...(game.marketPiles?.cask ?? [])],
    corn: [...(game.marketPiles?.corn ?? [])],
    grain: [...(game.marketPiles?.grain ?? [])],
  };
  const drawn: string[] = [];
  const now = Date.now();

  if (picks === "random") {
    for (let i = 0; i < MARKET_BUY_COUNT; i++) {
      const nonempty: (keyof MarketPiles)[] = [];
      if (piles.cask.length) nonempty.push("cask");
      if (piles.corn.length) nonempty.push("corn");
      if (piles.grain.length) nonempty.push("grain");
      if (nonempty.length === 0) return { game, error: "Market piles empty" };
      const k = nonempty[Math.floor(Math.random() * nonempty.length)]!;
      drawn.push(piles[k].pop()!);
    }
  } else {
    const nc = picks.cask;
    const nk = picks.corn;
    const ng = picks.grain;
    if (nc + nk + ng !== MARKET_BUY_COUNT)
      return { game, error: "Pick exactly 3 cards total" };
    if (piles.cask.length < nc || piles.corn.length < nk || piles.grain.length < ng)
      return { game, error: "Not enough cards in chosen piles" };
    for (let i = 0; i < nc; i++) drawn.push(piles.cask.pop()!);
    for (let i = 0; i < nk; i++) drawn.push(piles.corn.pop()!);
    for (let i = 0; i < ng; i++) drawn.push(piles.grain.pop()!);
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
      marketPiles: piles,
      actionsTakenThisTurn: taken + 1,
      updatedAt: now,
    },
  };
}

/** True if the hand can supply at least one mash (extra cards / duplicate casks are OK). */
export function handHasMashForBarrel(cards: string[]): boolean {
  if (cards.length < 3) return false;
  return (
    cards.some((c) => c === "Cask") &&
    cards.some((c) => c === "Corn") &&
    cards.some((c) => isGrainCard(c))
  );
}

/** @deprecated Prefer {@link handHasMashForBarrel} — whole-hand “exactly 1 cask” is no longer required. */
export function canMash(cards: string[]): boolean {
  return handHasMashForBarrel(cards);
}

/** True if this set of cards is a legal mash to barrel (GAME_RULES: 1 Cask, ≥1 Corn, ≥1 grain, 3–6 cards). */
export function isValidMashSelection(cards: string[]): boolean {
  if (cards.length < 3 || cards.length > 6) return false;
  if (cards.filter((c) => c === "Cask").length !== 1) return false;
  if (cards.filter((c) => c === "Corn").length < 1) return false;
  if (cards.filter((c) => isGrainCard(c)).length < 1) return false;
  return true;
}

/**
 * Resolve selected hand indices into a mash and remaining hand, or an error message.
 */
export function resolveMashFromIndices(
  hand: string[],
  indices: number[]
): { mash: string[]; remaining: string[] } | { error: string } {
  if (indices.length === 0)
    return { error: "Select which resource cards to barrel (mashIndices)" };
  const uniq = new Set<number>();
  for (const x of indices) {
    const i = Math.floor(Number(x));
    if (!Number.isFinite(i) || i < 0 || i >= hand.length)
      return { error: "Invalid card index" };
    if (uniq.has(i)) return { error: "Duplicate card index" };
    uniq.add(i);
  }
  const sorted = [...uniq].sort((a, b) => a - b);
  const mash = sorted.map((idx) => hand[idx]);
  if (!isValidMashSelection(mash)) {
    return {
      error:
        "Invalid mash: need 3–6 cards, exactly 1 Cask, ≥1 Corn, ≥1 grain (Barley/Rye/Wheat/Flavor)",
    };
  }
  const remaining = hand.filter((_, i) => !uniq.has(i));
  return { mash, remaining };
}

/** Remove one minimal legal mash from hand (1 Cask, 1 Corn, 1 grain); rest stay. */
export function removeMashFromHand(cards: string[]): { hand: string[]; removed: string[] } | null {
  const hand = [...cards];
  const removed: string[] = [];
  const takeOne = (type: string): boolean => {
    const i = hand.indexOf(type);
    if (i === -1) return false;
    removed.push(hand.splice(i, 1)[0]);
    return true;
  };
  if (!takeOne("Cask")) return null;
  if (!takeOne("Corn")) return null;
  const grainTypes = ["Barley", "Rye", "Wheat", "Flavor"];
  let tookGrain = false;
  for (const g of grainTypes) {
    if (takeOne(g)) {
      tookGrain = true;
      break;
    }
  }
  if (!tookGrain) return null;
  return { hand, removed };
}

/**
 * Build one mash from the hand: exactly one Cask, ≥1 Corn, ≥1 grain, up to 6 cards (GAME_RULES).
 * Leaves surplus resources in hand for later barrels or trades.
 */
export function takeMashCardsFromHand(
  cards: string[]
): { hand: string[]; mash: string[] } | null {
  const base = removeMashFromHand(cards);
  if (!base) return null;
  const hand = [...base.hand];
  const mash = [...base.removed];
  while (mash.length < 6 && hand.length > 0) {
    const idx = hand.findIndex((c) => c === "Corn" || isGrainCard(c));
    if (idx === -1) break;
    mash.push(hand.splice(idx, 1)[0]);
  }
  return { hand, mash };
}

/** Indices into `hand` matching {@link takeMashCardsFromHand} (leftmost matches; for bots). */
export function pickAutoMashIndices(hand: string[]): number[] | null {
  const tak = takeMashCardsFromHand(hand);
  if (!tak) return null;
  const used = new Set<number>();
  const idxs: number[] = [];
  for (const card of tak.mash) {
    let found = -1;
    for (let i = 0; i < hand.length; i++) {
      if (used.has(i) || hand[i] !== card) continue;
      found = i;
      break;
    }
    if (found === -1) return null;
    used.add(found);
    idxs.push(found);
  }
  return idxs;
}

export function barrelBourbon(
  game: GameDoc,
  rickhouseId: string,
  playerId: string,
  mashIndices: number[]
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Barrel only during the Action phase" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };

  const player = game.players[playerId];
  if (!player) return { game, error: "Baron not found" };
  const resolved = resolveMashFromIndices(player.resourceCards, mashIndices);
  if ("error" in resolved) return { game, error: resolved.error };
  const { mash: mashCards, remaining: newHand } = resolved;

  const rick = game.rickhouses.find((r) => r.id === rickhouseId);
  if (!rick) return { game, error: "Rickhouse not found" };
  if (rick.barrels.length >= rick.capacity) return { game, error: "Rickhouse full" };

  const rent = rick.barrels.length + 1;
  const taken = game.actionsTakenThisTurn ?? 0;
  const actionCost = nextActionCashCost(taken);
  if (player.cash < rent + actionCost)
    return { game, error: "Not enough cash for rent and action cost" };

  const barrelId = `barrel_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const barrel: RickhouseBarrel = { playerId, barrelId, age: 0 };
  const barrelRef: BarrelledBourbon = {
    id: barrelId,
    rickhouseId,
    age: 0,
    mashRef: "default",
    mashCards,
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
    actionsTakenThisTurn: taken + 1,
    updatedAt: now,
  };
  const winners = checkWinConditions(updated);
  if (winners?.length) {
    updated = { ...updated, status: "finished", winnerIds: winners };
  }
  return { game: updated };
}

/** Draw top operations card (costs current action price). Action phase only. */
export function drawOperationsCard(
  game: GameDoc,
  playerId: string
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Operations draws only in the Action phase" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  const player = ensureBaronHands(game.players[playerId]);
  if (!player) return { game, error: "Baron not found" };

  const taken = game.actionsTakenThisTurn ?? 0;
  const actionCost = nextActionCashCost(taken);
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
      actionsTakenThisTurn: taken + 1,
      updatedAt: now,
    },
  };
}

/** Draw top investment card (sideways until capitalized). Action phase only. */
export function drawInvestmentCard(
  game: GameDoc,
  playerId: string
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Investment draws only in the Action phase" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  const player = ensureBaronHands(game.players[playerId]);
  if (!player) return { game, error: "Baron not found" };

  const taken = game.actionsTakenThisTurn ?? 0;
  const actionCost = nextActionCashCost(taken);
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
      actionsTakenThisTurn: taken + 1,
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
    return { game, error: "Capitalize only in the Action phase" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  const player = ensureBaronHands(game.players[playerId]);
  if (!player) return { game, error: "Baron not found" };
  const card = player.investmentHand[handIndex];
  if (!card) return { game, error: "No card at that index" };
  if (card.upright) return { game, error: "Already capitalized" };

  const taken = game.actionsTakenThisTurn ?? 0;
  const actionCost = nextActionCashCost(taken);
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
      actionsTakenThisTurn: taken + 1,
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
    return { game, error: "Play operations only in the Action phase" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  const player = ensureBaronHands(game.players[playerId]);
  if (!player) return { game, error: "Baron not found" };
  const card = player.operationsHand[handIndex];
  if (!card) return { game, error: "No card at that index" };

  const taken = game.actionsTakenThisTurn ?? 0;
  const actionCost = nextActionCashCost(taken);
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
    actionsTakenThisTurn: taken + 1,
    updatedAt: now,
  };
  const winners = checkWinConditions(updated);
  if (winners?.length) {
    updated = { ...updated, status: "finished", winnerIds: winners };
  }
  return { game: updated };
}

/** Rent for one of your barrels in this rickhouse (GAME_RULES + 6-cap monopoly exemption). */
export function rickhouseFeePerBarrelForBaron(
  rick: Rickhouse,
  payerId: string
): number {
  if (rick.capacity === 6 && rick.barrels.length > 0) {
    const soleBaron = rick.barrels.every((b) => b.playerId === payerId);
    if (soleBaron) return 0;
  }
  return rick.barrels.length;
}

export function previewRickhouseFeesForPlayer(game: GameDoc, playerId: string): number {
  const player = game.players[playerId];
  if (!player) return 0;
  let total = 0;
  for (const b of player.barrelledBourbons ?? []) {
    const rick = game.rickhouses.find((r) => r.id === b.rickhouseId);
    if (!rick) continue;
    total += rickhouseFeePerBarrelForBaron(rick, playerId);
  }
  return total;
}

/** Until Bourbon Card matrix is wired, use age × demand (demand 0 ⇒ age only), clamped (GAME_RULES). */
export function computeSaleProceeds(ageYears: number, marketDemand: number): number {
  if (marketDemand <= 0) return ageYears;
  const a = Math.min(Math.max(0, ageYears), 12);
  const d = Math.min(Math.max(0, marketDemand), 12);
  return a * d;
}

/** Phase 1: pay all rickhouse fees and age each of your barrelled bourbons by 1 year. */
export function payRickhouseFeesAndAge(
  game: GameDoc,
  playerId: string
): { game: GameDoc; error?: string } {
  if (game.status !== "in_progress") return { game, error: "Game not in progress" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };
  if (game.currentPhase !== 1) return { game, error: "Rickhouse fees are paid in Phase 1" };
  if (game.rickhouseFeesPaidThisTurn) return { game, error: "Fees already paid this turn" };

  const player = game.players[playerId];
  if (!player) return { game, error: "Baron not found" };

  const total = previewRickhouseFeesForPlayer(game, playerId);
  if (player.cash < total)
    return {
      game,
      error: `Not enough cash: need $${total} for rickhouse fees`,
    };

  const now = Date.now();
  const newRickhouses = game.rickhouses.map((r) => ({
    ...r,
    barrels: r.barrels.map((br) =>
      br.playerId === playerId ? { ...br, age: br.age + 1 } : br
    ),
  }));

  const newPlayers = { ...game.players };
  newPlayers[playerId] = {
    ...player,
    cash: player.cash - total,
    barrelledBourbons: (player.barrelledBourbons ?? []).map((b) => ({
      ...b,
      age: b.age + 1,
    })),
  };

  let updated: GameDoc = {
    ...game,
    rickhouses: newRickhouses,
    players: newPlayers,
    rickhouseFeesPaidThisTurn: true,
    updatedAt: now,
  };
  const winners = checkWinConditions(updated);
  if (winners?.length) updated = { ...updated, status: "finished", winnerIds: winners };
  return { game: updated };
}

/** Sell one barrelled bourbon (≥2 years). One action; demand decreases by 1 (GAME_RULES). */
export function sellBourbon(
  game: GameDoc,
  playerId: string,
  barrelId: string
): { game: GameDoc; error?: string } {
  if (!inActionPhases(game.currentPhase))
    return { game, error: "Sell only during the Action phase" };
  if (game.playerOrder[game.currentPlayerIndex] !== playerId)
    return { game, error: "Not your turn" };

  const player = game.players[playerId];
  if (!player) return { game, error: "Baron not found" };
  const barrel = player.barrelledBourbons.find((b) => b.id === barrelId);
  if (!barrel) return { game, error: "Barrel not found" };
  if (barrel.age < 2) return { game, error: "Bourbon must be at least 2 years old to sell" };

  const taken = game.actionsTakenThisTurn ?? 0;
  const actionCost = nextActionCashCost(taken);
  if (player.cash < actionCost)
    return { game, error: "Not enough cash for this action" };

  const proceeds = computeSaleProceeds(barrel.age, game.marketDemand);
  const now = Date.now();
  const newRickhouses = game.rickhouses.map((r) =>
    r.id === barrel.rickhouseId
      ? { ...r, barrels: r.barrels.filter((br) => br.barrelId !== barrelId) }
      : r
  );
  const newPlayers = { ...game.players };
  newPlayers[playerId] = {
    ...player,
    cash: player.cash - actionCost + proceeds,
    barrelledBourbons: player.barrelledBourbons.filter((b) => b.id !== barrelId),
  };

  let updated: GameDoc = {
    ...game,
    rickhouses: newRickhouses,
    players: newPlayers,
    marketDemand: Math.max(0, game.marketDemand - 1),
    actionsTakenThisTurn: taken + 1,
    updatedAt: now,
  };
  const winners = checkWinConditions(updated);
  if (winners?.length) updated = { ...updated, status: "finished", winnerIds: winners };
  return { game: updated };
}

function ensureBaronHands(p: Baron | undefined): Baron | undefined {
  if (!p) return undefined;
  return {
    ...p,
    operationsHand: p.operationsHand ?? [],
    investmentHand: p.investmentHand ?? [],
  };
}

/** Defaults for older Dynamo items (safe to call on read). */
export function normalizeGame(game: GameDoc): GameDoc {
  const players: Record<string, Baron> = {};
  for (const pid of game.playerOrder) {
    const p = game.players[pid];
    if (!p) continue;
    players[pid] = ensureBaronHands(p)!;
  }

  let marketPiles = game.marketPiles;
  let resourceDeck = [...(game.resourceDeck ?? [])];
  const pilesMissing =
    !marketPiles ||
    (marketPiles.cask.length === 0 &&
      marketPiles.corn.length === 0 &&
      marketPiles.grain.length === 0);
  if (pilesMissing) {
    const legacy = [...(game.marketGoods ?? []), ...resourceDeck];
    if (legacy.length > 0) {
      marketPiles = splitDeckIntoMarketPiles(shuffle(legacy));
      resourceDeck = [];
    } else {
      marketPiles = emptyMarketPiles();
    }
  }

  const legacyPhase = game.currentPhase ?? 1;
  let turnStructureVersion = game.turnStructureVersion ?? 1;
  let currentPhase = legacyPhase;
  if (turnStructureVersion < 2) {
    if (currentPhase > 3) currentPhase = 3;
    else if (currentPhase >= 2) currentPhase = 3;
    turnStructureVersion = 2;
  }

  let rickhouseFeesPaidThisTurn = game.rickhouseFeesPaidThisTurn ?? false;
  if (
    game.status === "in_progress" &&
    legacyPhase > 1 &&
    game.rickhouseFeesPaidThisTurn !== true
  ) {
    rickhouseFeesPaidThisTurn = true;
  }

  return {
    ...game,
    currentPhase,
    turnStructureVersion,
    actionsTakenThisTurn: game.actionsTakenThisTurn ?? 0,
    operationsDeck: game.operationsDeck ?? [],
    investmentDeck: game.investmentDeck ?? [],
    marketPiles,
    resourceDeck,
    rickhouseFeesPaidThisTurn,
    players,
  };
}
