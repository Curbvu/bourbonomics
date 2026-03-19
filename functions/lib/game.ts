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

export interface Player {
  id: string;
  name: string;
  cash: number;
  resourceCards: string[];
  barrelledBourbons: BarrelledBourbon[];
  bourbonCards: BourbonCard[];
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
  /** Resets when entering Phase 2 (Preparation). Used for resource draw cost. */
  currentPhaseDrawCount: number;
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
    currentPhaseDrawCount: 0,
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
  return {
    ...game,
    status: "in_progress",
    players,
    currentPhase: 1,
    currentPlayerIndex: 0,
    turnNumber: 1,
    currentPhaseDrawCount: 0,
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
    const out = { ...game, currentPhase: next, updatedAt: now };
    if (next === 2) out.currentPhaseDrawCount = 0;
    return out;
  }
  const newDemand = rollMarketDice(game.marketDemand);
  const nextIndex = (game.currentPlayerIndex + 1) % game.playerOrder.length;
  let out: GameDoc = {
    ...game,
    currentPhase: 1,
    currentPlayerIndex: nextIndex,
    turnNumber: nextIndex === 0 ? game.turnNumber + 1 : game.turnNumber,
    marketDemand: newDemand,
    currentPhaseDrawCount: 0,
    updatedAt: now,
  };
  const winners = checkWinConditions(out);
  if (winners?.length) out = { ...out, status: "finished", winnerIds: winners };
  return out;
}

/** Cost for drawing d more cards when currentPhaseDrawCount is c. First card free in Phase 2. */
export function drawCost(c: number, d: number): number {
  let cost = 0;
  for (let i = 0; i < d; i++) {
    if (c + i === 0) continue;
    cost += c + i;
  }
  return cost;
}

/** Buy 1 from market or 2 random. Only in Phase 2, current player. */
export function buyResources(
  game: GameDoc,
  option: "market" | "random"
): { game: GameDoc; error?: string } {
  if (game.currentPhase !== 2) return { game, error: "Only in Preparation phase" };
  const pid = game.playerOrder[game.currentPlayerIndex];
  if (!pid) return { game, error: "No current player" };
  const player = game.players[pid];
  if (!player) return { game, error: "Player not found" };

  const count = option === "market" ? 1 : 2;
  if (option === "market" && game.marketGoods.length === 0)
    return { game, error: "Market empty" };
  if (option === "random" && game.resourceDeck.length < 2)
    return { game, error: "Not enough cards in deck" };

  const cost = drawCost(game.currentPhaseDrawCount, count);
  if (player.cash < cost) return { game, error: "Not enough cash" };

  const drawn: string[] = [];
  const now = Date.now();
  let marketGoods = [...game.marketGoods];
  let resourceDeck = [...game.resourceDeck];

  if (option === "market") {
    drawn.push(marketGoods.shift()!);
  } else {
    const i1 = Math.floor(Math.random() * resourceDeck.length);
    drawn.push(resourceDeck.splice(i1, 1)[0]);
    const i2 = Math.floor(Math.random() * resourceDeck.length);
    drawn.push(resourceDeck.splice(i2, 1)[0]);
  }

  const newPlayers = { ...game.players };
  newPlayers[pid] = {
    ...player,
    cash: player.cash - cost,
    resourceCards: [...player.resourceCards, ...drawn],
  };

  return {
    game: {
      ...game,
      players: newPlayers,
      marketGoods,
      resourceDeck,
      currentPhaseDrawCount: game.currentPhaseDrawCount + count,
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
  if (player.cash < rent) return { game, error: "Not enough cash for rent" };

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
    cash: player.cash - rent,
    resourceCards: newHand,
    barrelledBourbons: [...player.barrelledBourbons, barrelRef],
  };

  let updated: GameDoc = {
    ...game,
    rickhouses: newRickhouses,
    players: newPlayers,
    updatedAt: now,
  };
  const winners = checkWinConditions(updated);
  if (winners?.length) {
    updated = { ...updated, status: "finished", winnerIds: winners };
  }
  return { game: updated };
}
