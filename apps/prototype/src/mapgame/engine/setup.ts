// Bourbonomics: Map Game — setup (brief §13).
//
// createGame() runs the whole setup phase deterministically and returns a state
// at age 1, round 1, planning stage, ready to play. Setup auto-resolves the
// snake tile-placement and opening draft (a human-driven setup UI can drive the
// same primitives later); the RESULT respects every §13 rule, which is what the
// verification checklist tests.

import { beginAgeStart } from "./ageLoop";
import { CONFIG } from "./config";
import { buildActionDeck } from "./content/actionDeck";
import { buildBourbonDefs } from "./content/bourbons";
import { buildTileDefs } from "./content/tiles";
import { neighborTiles } from "./derive";
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
  playerNames: string[]; // 2..4
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
    hand: [],
    bourbons: [],
    heldTile: null,
    committedFaceUp: [],
    committedSacrificed: [],
    surrendered: false,
    pipsRemaining: 0,
    allowedSuits: [],
    hasCommitted: false,
    turnDone: false,
  };
}

function tileFromDef(draft: GameState, def: TileDef, hex: Hex): Tile {
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
function placementCandidates(state: GameState): Hex[] {
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
function snakeOrder(players: number, rounds: number): number[] {
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
    catchUpBoard: [],
    initiative: [],
    turnPos: 0,
    startPlayerIndex: 0,
    initiativeMarker: 0,
    pendingInitiative: [],
    tradeOffers: {},
    rngSeed: opts.seed ?? 1,
    idCounter: 0,
    log: [],
  };

  // — Split content into demand + blocking, shuffle each —
  const defs = buildTileDefs();
  const demandDefs = defs.filter((d) => d.category !== "BLOCKING");
  const blockingDefs = defs.filter((d) => d.category === "BLOCKING");
  const [demandShuffled, s1] = shuffle(demandDefs, draft.rngSeed);
  draft.rngSeed = s1;

  // — 1. Seed: 3 tiles in a line at center —
  const seedHexes: Hex[] = Array.from({ length: CONFIG.SEED_LINE_TILES }, (_, i) => ({ q: i, r: 0 }));
  const pool = demandShuffled.slice();
  for (const hex of seedHexes) {
    const def = pool.shift()!;
    draft.tiles.push(tileFromDef(draft, def, hex));
  }

  // — 2. Setup tiles: deal 5 each; snake placement (>=2 adjacency) —
  const perPlayer = CONFIG.SETUP_TILES_PER_PLAYER;
  const hands: TileDef[][] = draft.players.map(() => pool.splice(0, perPlayer));
  // Whatever demand tiles remain become the Expand Market supply (brief §6b).
  draft.tileSupply = pool;

  // Interleave blocking terrain into the placement stream so it lands mid-board.
  const placeOrder = snakeOrder(n, perPlayer);
  let blockingQueue = blockingDefs.slice();
  const blockAfter = new Set([2, 5, 8, 11].slice(0, blockingQueue.length)); // step indices
  placeOrder.forEach((pIdx, step) => {
    const def = hands[pIdx]!.shift();
    if (def) {
      const cands = placementCandidates(draft);
      const hex = cands[0]!;
      draft.tiles.push(tileFromDef(draft, def, hex));
    }
    if (blockAfter.has(step) && blockingQueue.length) {
      const bdef = blockingQueue.shift()!;
      const cands = placementCandidates(draft);
      if (cands.length) draft.tiles.push(tileFromDef(draft, bdef, cands[cands.length - 1]!));
    }
  });
  // any remaining blocking tiles (small boards) — drop onto valid terrain
  for (const bdef of blockingQueue) {
    const cands = placementCandidates(draft);
    if (cands.length) draft.tiles.push(tileFromDef(draft, bdef, cands[0]!));
  }

  // — 3. Market: PLAYERS+1 face-up lots —
  const [bourbonShuffled, s2] = shuffle(buildBourbonDefs(), draft.rngSeed);
  draft.rngSeed = s2;
  draft.bourbonDeck = bourbonShuffled.slice();
  refillMarket(draft, CONFIG.marketLots(n));

  // — 4. Opening draft: snake, 4 turns each; draft a bourbon OR place 1 LIVE DP —
  runOpeningDraft(draft, n);

  // — 5. First player = last drafter of the FIRST snake round (index n-1);
  //      they hold the initiative marker (brief §15.5). —
  draft.startPlayerIndex = n - 1;
  draft.initiativeMarker = n - 1;

  // — Age 1 opening: the round-1 initiative to install after the age-start stages —
  draft.phase = "playing";
  draft.pendingInitiative = openingInitiative(draft);
  draft.log.push({ age: 1, round: 1, message: `Game begins — ${n} players.` });

  // Deal hands + catch-up board, then open the interactive age-start (trade → catch-up).
  beginAgeStart(draft);
  return draft;
}

// ── Market ───────────────────────────────────────────────────────────
export function refillMarket(draft: GameState, target: number): void {
  while (draft.market.length < target && draft.bourbonDeck.length > 0) {
    const def = draft.bourbonDeck.shift()! as BourbonDef;
    const lot: MarketLot = { id: mintId(draft, "lot"), def, bids: {} };
    draft.market.push(lot);
  }
}

// ── Opening draft ────────────────────────────────────────────────────
function runOpeningDraft(draft: GameState, n: number): void {
  const order = snakeOrder(n, CONFIG.OPENING_DRAFT_PICKS);
  const perTurnIsDraft = (turn: number) => turn % 2 === 1; // alt place, draft, place, draft
  const turnCounter = new Map<number, number>();

  for (const pIdx of order) {
    const turn = turnCounter.get(pIdx) ?? 0;
    turnCounter.set(pIdx, turn + 1);
    const player = draft.players[pIdx]!;

    if (perTurnIsDraft(turn) && draft.market.length > 0) {
      // draft the best-fitting available bourbon by raw tag count (simple, deterministic)
      const lot = draft.market.reduce((a, b) => (b.def.tags.length > a.def.tags.length ? b : a));
      draft.market = draft.market.filter((l) => l.id !== lot.id);
      player.bourbons.push({
        id: mintId(draft, "bourbon"),
        defId: lot.def.defId,
        name: lot.def.name,
        tags: lot.def.tags,
        owner: player.id,
        state: "FRESH",
      });
      refillMarket(draft, CONFIG.marketLots(n));
    } else {
      // place 1 LIVE DP — setup-exempt from control adjacency (§13, step 4)
      const target = pickOpeningDPTile(draft, player.id);
      if (target && player.dpSupply > 0) {
        player.dpSupply -= 1;
        draft.dps.push({
          id: mintId(draft, "dp"),
          owner: player.id,
          tileId: target.id,
          state: "LIVE",
          seq: draft.idCounter,
        });
      }
    }
  }
}

/** Deterministic opening-DP target: an unoccupied demand tile, else any demand tile. */
function pickOpeningDPTile(draft: GameState, playerId: string): Tile | undefined {
  const demand = draft.tiles.filter((t) => t.category !== "BLOCKING");
  const empty = demand.filter((t) => !draft.dps.some((d) => d.tileId === t.id));
  const pool = empty.length ? empty : demand.filter((t) => !draft.dps.some((d) => d.tileId === t.id && d.owner === playerId));
  return (pool[0] ?? demand[0]);
}

// ── Action hands ─────────────────────────────────────────────────────
/** Fresh shuffled 30-card deck, deal HAND_SIZE to each player. */
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
