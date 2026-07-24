// Bourbonomics: Map Game — setup (brief §13/§15).
//
// createGame() lays the fixed board (3-tile seed line + blocking terrain),
// deals each player 5 setup tiles and the market, then STOPS at the interactive
// setup: players place their tiles (setupPlace) and run the opening snake draft
// (setupDraft) via applyAction. finalizeSetup() opens age 1 once the draft ends.

import { beginAgeStart } from "./ageLoop";
import { CONFIG } from "./config";
import { buildActionDeck } from "./content/actionDeck";
import { buildBourbonDefs, isPremiumDef } from "./content/bourbons";
import { buildTileDefs } from "./content/tiles";
import { neighborTiles } from "./derive";
import { baseDistillery, runDistilleryTrigger } from "./distilleries";
import { hexKey, hexNeighbors, type Hex } from "./hex";
import { mintId } from "./ids";
import { shuffle } from "./rng";
import type {
  BourbonDef,
  GameState,
  MarketLot,
  Player,
  Tile,
  TileDef,
  TokenType,
} from "./types";
import { SUITS } from "./types";

export interface NewGameOptions {
  playerNames: string[]; // 2..5
  bots?: boolean[]; // parallel to playerNames; default all-but-first are bots
  seed?: number;
}

function zeroTokens(): Record<TokenType, number> {
  const t = {} as Record<TokenType, number>;
  for (const s of SUITS) t[s] = 0;
  t.ANY = 0;
  return t;
}

function mkPlayer(id: string, name: string, isBot: boolean, colorIdx: number): Player {
  return {
    id,
    name,
    isBot,
    colorIdx,
    capital: CONFIG.STARTING_CAPITAL,
    dpSupply: CONFIG.DP_SUPPLY,
    tokens: zeroTokens(),
    distillery: baseDistillery(name),
    hand: [],
    bourbons: [],
    heldTile: null,
    setupTiles: [],
    committedFaceUp: [],
    committedSacrificed: [],
    surrendered: false,
    pipsRemaining: 0,
    allowedSuits: [],
    hasCommitted: false,
    turnDone: false,
  };
}

export function tileFromDef(draft: GameState, def: TileDef, hex: Hex): Tile {
  return {
    id: mintId(draft, "tile"),
    defId: def.defId,
    name: def.name,
    category: def.category,
    hex,
    tags: def.tags,
    reward: def.reward,
    defenseBonus: def.defenseBonus,
    keystoneTokensPerAge: def.keystoneTokensPerAge,
    convertsToLoyalty: def.convertsToLoyalty,
    ownershipSlot: def.ownershipSlot,
    ownerSlotDP: null,
    wildcardTag: null,
    uncontestedSinceAge: null,
  };
}

/**
 * Every empty hex adjacent to an occupied one, that touches >= TILE_MIN_ADJACENCY
 * existing tiles. Returned in a stable order (by q then r) so placement is
 * deterministic. Blocking tiles count as existing tiles for this physical rule.
 */
export function placementCandidates(state: GameState): Hex[] {
  const occupied = new Set(state.tiles.map((t) => hexKey(t.hex)));
  const seen = new Set<string>();
  const candidates: Hex[] = [];
  for (const t of state.tiles) {
    for (const nb of hexNeighbors(t.hex)) {
      const k = hexKey(nb);
      if (occupied.has(k) || seen.has(k)) continue;
      seen.add(k);
      if (neighborTiles(state, nb).length >= CONFIG.TILE_MIN_ADJACENCY) {
        candidates.push(nb);
      }
    }
  }
  return candidates.sort((a, b) => a.q - b.q || a.r - b.r);
}

/** Snake order over player indices: 0..n-1, n-1..0, repeated. */
export function snakeOrder(players: number, rounds: number): number[] {
  const order: number[] = [];
  for (let r = 0; r < rounds; r++) {
    const forward = r % 2 === 0;
    for (let i = 0; i < players; i++) order.push(forward ? i : players - 1 - i);
  }
  return order;
}

export function createGame(opts: NewGameOptions): GameState {
  const n = opts.playerNames.length;
  if (n < CONFIG.MIN_PLAYERS || n > CONFIG.MAX_PLAYERS) {
    throw new RangeError(`player count must be ${CONFIG.MIN_PLAYERS}..${CONFIG.MAX_PLAYERS} (got ${n})`);
  }
  const bots = opts.bots ?? opts.playerNames.map((_, i) => i !== 0);

  const draft: GameState = {
    phase: "setup",
    age: 1,
    round: 1,
    stage: "planning",
    players: opts.playerNames.map((name, i) => mkPlayer(`p${i}`, name, bots[i] ?? false, i)),
    tiles: [],
    dps: [],
    nicheFlags: [],
    tileSupply: [],
    market: [],
    bourbonDeck: [],
    actionDeck: [],
    actionDiscard: [],
    initiative: [],
    turnPos: 0,
    startPlayerIndex: 0,
    initiativeMarker: 0,
    pendingInitiative: [],
    setupDraftSeq: [],
    rngSeed: opts.seed ?? 1,
    idCounter: 0,
    log: [],
  };

  // — Shuffle the whole tile deck. Blocking tiles ride along in the deck like
  //   any other tile (they're dealt and placed by players, never force-dropped).
  //   The seed line filters to reward-bearing tiles, so blocking never seeds. —
  const [tilesShuffled, s1] = shuffle(buildTileDefs(), draft.rngSeed);
  draft.rngSeed = s1;

  // — 1. Seed: 3 tiles in a line at center, ALL reward-bearing (BONUS) tiles —
  //      so the opening centre is worth contesting immediately (brief §5.1). —
  const seedHexes: Hex[] = Array.from({ length: CONFIG.SEED_LINE_TILES }, (_, i) => ({ q: i, r: 0 }));
  const seedDefs = tilesShuffled.filter((d) => d.reward !== null).slice(0, CONFIG.SEED_LINE_TILES);
  const seededIds = new Set(seedDefs.map((d) => d.defId));
  for (let i = 0; i < seedHexes.length; i++) {
    draft.tiles.push(tileFromDef(draft, seedDefs[i]!, seedHexes[i]!));
  }
  // Everything not seeded is available for setup tiles + the Expand supply
  // (blocking tiles included — drawn and placed like the rest).
  const pool = tilesShuffled.filter((d) => !seededIds.has(d.defId));

  // — 2. Setup tiles: deal 5 to each player's hand. Players PLACE them
  //      interactively in the setupPlace stage (brief §5.3). —
  const perPlayer = CONFIG.SETUP_TILES_PER_PLAYER;
  for (const p of draft.players) p.setupTiles = pool.splice(0, perPlayer);
  // Whatever demand tiles remain become the Expand Market supply (brief §7).
  draft.tileSupply = pool;

  // — 3. Opening market: PLAYERS+1 lots from the NON-PREMIUM subset only
  //      (premium is barred from the opening draft — brief §5.4). Premium
  //      re-enters the deck at finalizeSetup, for age 1's market on. —
  const nonPremium = buildBourbonDefs().filter((d) => !isPremiumDef(d));
  const [bourbonShuffled, s2] = shuffle(nonPremium, draft.rngSeed);
  draft.rngSeed = s2;
  draft.bourbonDeck = bourbonShuffled.slice();
  refillMarket(draft, CONFIG.marketLots(n));

  // — Open the interactive setup: place tiles in turn order, one at a time. —
  draft.phase = "setup";
  draft.stage = "setupPlace";
  draft.initiative = draft.players.map((_, i) => i);
  draft.turnPos = 0;
  draft.log.push({ age: 1, round: 1, message: `Setup — place your tiles, then draft. ${n} players.` });
  return draft;
}

/** Round-robin placement order for the starting-DP step: seating order 0..n-1,
 *  repeated dpsEach times (brief §5.6). */
export function setupDPOrder(players: number, dpsEach: number): number[] {
  const order: number[] = [];
  for (let d = 0; d < dpsEach; d++) for (let i = 0; i < players; i++) order.push(i);
  return order;
}

/**
 * Called by the engine once the starting-DP step finishes: fix the first player
 * (last drafter of the first snake round = index n-1), fold PREMIUM bourbons back
 * into the deck (they were barred from the opening draft — brief §5.4) and clear
 * the setup market so age 1 deals a fresh pool, then open age 1.
 */
export function finalizeSetup(draft: GameState): void {
  const n = draft.players.length;

  // Rebuild the bourbon deck from every def not already drafted — this returns
  // the withheld premium bourbons to the pool for age 1 on.
  const owned = new Set(draft.players.flatMap((p) => p.bourbons.map((b) => b.defId)));
  const remaining = buildBourbonDefs().filter((d) => !owned.has(d.defId));
  const [reshuffled, s] = shuffle(remaining, draft.rngSeed);
  draft.rngSeed = s;
  draft.bourbonDeck = reshuffled;
  draft.market = []; // drop leftover setup lots; age 1 deals its own market

  draft.startPlayerIndex = n - 1;
  draft.initiativeMarker = n - 1;
  draft.phase = "playing";
  draft.pendingInitiative = openingInitiative(draft);
  runDistilleryTrigger(draft, "onSetup");
  draft.log.push({ age: 1, round: 1, message: "Setup complete — the game begins." });
  beginAgeStart(draft);
}

// ── Market ───────────────────────────────────────────────────────────
export function refillMarket(draft: GameState, target: number): void {
  while (draft.market.length < target && draft.bourbonDeck.length > 0) {
    const def = draft.bourbonDeck.shift()! as BourbonDef;
    const lot: MarketLot = { id: mintId(draft, "lot"), def, bids: {} };
    draft.market.push(lot);
  }
}

/** Deterministic opening-DP target: an unoccupied demand tile, else any demand
 *  tile. Used by the bot during the opening draft (brief §13.4). */
export function firstOpenDPTarget(draft: GameState, playerId: string): Tile | undefined {
  const demand = draft.tiles.filter((t) => t.category !== "BLOCKING");
  const empty = demand.filter((t) => !draft.dps.some((d) => d.tileId === t.id));
  const pool = empty.length ? empty : demand.filter((t) => !draft.dps.some((d) => d.tileId === t.id && d.owner === playerId));
  return pool[0] ?? demand[0];
}

// ── Action hands ─────────────────────────────────────────────────────
/** Fresh shuffled action deck, deal HAND_SIZE to each player. */
export function dealActionHands(draft: GameState): void {
  const [deck, s] = shuffle(buildActionDeck(), draft.rngSeed);
  draft.rngSeed = s;
  const drawPile = deck.slice();
  draft.actionDiscard = [];
  for (const p of draft.players) {
    p.hand = drawPile.splice(0, CONFIG.HAND_SIZE);
    p.committedFaceUp = [];
    p.committedSacrificed = [];
    p.surrendered = false;
    p.hasCommitted = false;
    p.turnDone = false;
  }
  draft.actionDeck = drawPile;
}

/** Age 1 round 1 initiative starts from the first player (§13, step 5). */
function openingInitiative(draft: GameState): number[] {
  const n = draft.players.length;
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push((draft.startPlayerIndex + i) % n);
  return order;
}
