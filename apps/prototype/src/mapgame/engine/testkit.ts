// Test-only builders for hand-constructing GameState slices. Not shipped in the
// game path; imported solely by *.test.ts.

import type { Hex } from "./hex";
import type { Tag } from "./tags";
import type {
  Bourbon,
  DP,
  DPState,
  GameState,
  NicheFlag,
  Player,
  Reward,
  Tile,
  TileCategory,
  TokenType,
} from "./types";
import { SUITS } from "./types";

let seq = 0;
const uid = (p: string) => `${p}${(seq += 1)}`;

export function zeroTokens(): Record<TokenType, number> {
  const t = {} as Record<TokenType, number>;
  for (const s of SUITS) t[s] = 0;
  t.ANY = 0;
  return t;
}

export function mkPlayer(id: string, over: Partial<Player> = {}): Player {
  return {
    id,
    name: id,
    isBot: false,
    colorIdx: 0,
    capital: 0,
    dpSupply: 15,
    tokens: zeroTokens(),
    distillery: { name: id, abilityId: null },
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
    ...over,
  };
}

export function mkTile(
  hex: Hex,
  over: Partial<Tile> & { tags?: Tag[]; category?: TileCategory; reward?: Reward | null } = {},
): Tile {
  const id = over.id ?? uid("t");
  return {
    id,
    defId: id,
    name: id,
    category: over.category ?? "PURE_PREFERENCE",
    hex,
    tags: over.tags ?? [],
    reward: over.reward ?? null,
    defenseBonus: 0,
    keystoneTokensPerAge: 0,
    convertsToLoyalty: false,
    ownershipSlot: false,
    ownerSlotDP: null,
    wildcardTag: null,
    uncontestedSinceAge: null,
    ...over,
  };
}

export function mkDP(owner: string, tileId: string, state: DPState = "LIVE"): DP {
  return { id: uid("dp"), owner, tileId, state, seq: (seq += 1) };
}

export function mkFlag(owner: string, tileId: string): NicheFlag {
  return { id: uid("f"), owner, tileId };
}

export function mkBourbon(owner: string, tags: Tag[], over: Partial<Bourbon> = {}): Bourbon {
  const id = over.id ?? uid("b");
  return {
    id,
    defId: id,
    name: id,
    tags,
    owner,
    state: "FRESH",
    ...over,
  };
}

export function mkState(over: Partial<GameState> = {}): GameState {
  return {
    phase: "playing",
    age: 1,
    round: 1,
    stage: "resolve",
    players: [],
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
    setupDraftSeq: [],
    rngSeed: 1,
    idCounter: 0,
    log: [],
    ...over,
  };
}
