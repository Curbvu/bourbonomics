// Bourbonomics: Map Game — the type model (brief v3, §2).
//
// The engine is pure: every mutation flows through applyAction(state, action)
// and returns a new state or a typed refusal. No DOM, no fetch, no console.

import type { Hex } from "./hex";
import type { Tag } from "./tags";

// ── Suits & actions (brief §5) ───────────────────────────────────────
export type Suit =
  | "DISTRIBUTION"
  | "SALES"
  | "MARKETING"
  | "BUSINESS_DEV"
  | "SOURCING"
  | "DISTILL";

export const SUITS: Suit[] = [
  "DISTRIBUTION",
  "SALES",
  "MARKETING",
  "BUSINESS_DEV",
  "SOURCING",
  "DISTILL",
];

export type ActionType =
  | "BUILD_DP"
  | "REPAIR_DP"
  | "PUSH"
  | "ADD_NICHE_FLAG"
  | "REMOVE_NICHE_FLAG"
  | "EXPAND_MARKET"
  | "BID"
  | "REFRESH";

/**
 * The action menu each suit permits — mix freely up to the card's pips (§6).
 * v4 capability map (§6, §18.17): every capability appears in EXACTLY 2 suits.
 *   DP (Build/Repair) → Distribution, BusinessDev
 *   Push             → Sales, Marketing
 *   Niche (Add/Rm)   → Sales, Marketing
 *   Expand (market)  → BusinessDev, Sourcing
 *   Bourbon (Bid/Refresh) → Sourcing, Distill
 * HARD RULE (§18.8): Refresh never shares a suit with Push. Here Refresh lives in
 * Sourcing+Distill and Push in Sales+Marketing — disjoint. (Bid may share; it
 * doesn't here either.)
 */
export const SUIT_ACTIONS: Record<Suit, ActionType[]> = {
  DISTRIBUTION: ["BUILD_DP", "REPAIR_DP"], // DP
  SALES: ["PUSH", "ADD_NICHE_FLAG", "REMOVE_NICHE_FLAG"], // Push, Niche
  MARKETING: ["PUSH", "ADD_NICHE_FLAG", "REMOVE_NICHE_FLAG"], // Push, Niche
  BUSINESS_DEV: ["EXPAND_MARKET", "BUILD_DP", "REPAIR_DP"], // Expand, DP
  SOURCING: ["BID", "REFRESH", "EXPAND_MARKET"], // Bourbon, Expand
  DISTILL: ["BID", "REFRESH"], // Bourbon
};

// ── Tokens ───────────────────────────────────────────────────────────
/** Six token types, one per suit, plus ANY (Keystone reward, wild). */
export type TokenType = Suit | "ANY";

// ── Distilleries (brief §17 — build the hook, not the content) ───────
/**
 * The expansion axis: a persistent player identity with an optional signature
 * ability. The base game ships SYMMETRIC (abilityId null). Only DATA lives on
 * state (so it stays structuredClone-safe); ability implementations live in a
 * registry keyed by abilityId (see engine/distilleries.ts).
 */
export interface Distillery {
  name: string;
  abilityId: string | null; // null = no ability (symmetric base game)
}

/** The moments an ability may hook (brief §17). Reserved vocabulary; the base
 *  game fires them but ships no abilities. */
export type DistilleryTrigger =
  | "onSetup"
  | "onAgeStart"
  | "onRoundStart"
  | "onPushWin"
  | "onPushLose"
  | "onScoring"
  | "onAgeEnd";

// ── Board ────────────────────────────────────────────────────────────
export type TileCategory =
  | "PURE_PREFERENCE"
  | "OFF_PREMISE"
  | "ON_PREMISE"
  | "EXPERIENTIAL"
  | "EXPORT"
  | "LOYALTY"
  | "KEYSTONE"
  | "BLOCKING";

export type Reward =
  | { kind: "CAPITAL"; amount: number }
  | { kind: "TOKEN"; token: TokenType };

/** Static definition of a tile in the supply, before it hits the board. */
export interface TileDef {
  defId: string;
  name: string;
  category: TileCategory;
  tags: Tag[]; // multiset; [] for BLOCKING and WILDCARD tiles
  reward: Reward | null;
  /** Owner's Push defense bonus (LOYALTY/KEYSTONE). 0 otherwise. */
  defenseBonus: number;
  /** KEYSTONE (State Capital) pays ANY tokens each age. 0 otherwise. */
  keystoneTokensPerAge: number;
  /** "Word of Mouth": converts to LOYALTY if held uncontested a full age. */
  convertsToLoyalty: boolean;
  /** WILDCARD tiles (LOYALTY/KEYSTONE) have an ownership slot (brief §7). */
  ownershipSlot: boolean;
}

export interface Tile {
  id: string;
  defId: string;
  name: string;
  category: TileCategory;
  hex: Hex;
  tags: Tag[];
  reward: Reward | null;
  defenseBonus: number;
  keystoneTokensPerAge: number;
  convertsToLoyalty: boolean;

  // — ownership (brief §7) — only tiles with ownershipSlot use these —
  ownershipSlot: boolean;
  /** The DP id occupying the ownership slot, or null. Owner = that DP's owner.
   *  Ownership changes only via the Push (clear all owner DPs, slot last). */
  ownerSlotDP: string | null;
  /** Wildcard tag declared by the owner when the slot is first claimed. */
  wildcardTag: Tag | null;
  /** Age index at which this tile last became uncontested (for conversion). */
  uncontestedSinceAge: number | null;
}

export type DPState = "LIVE" | "DARK";

export interface DP {
  id: string;
  owner: string;
  tileId: string;
  state: DPState;
  /** Placement order — deterministic tiebreak for combat DP removal. */
  seq: number;
}

/**
 * A niche is DERIVED from flags, never stored: the connected components of one
 * player's flags, of size >= NICHE_MIN_TILES. A flag must be placed adjacent to
 * that player's existing flags (first flag anywhere) and is untouchable by
 * rivals (brief §9).
 */
export interface NicheFlag {
  id: string;
  owner: string;
  tileId: string;
}

// ── Bourbons (brief §7b) ─────────────────────────────────────────────
export type BourbonState = "FRESH" | "DEPLETED";

export interface BourbonDef {
  defId: string;
  name: string;
  tags: Tag[];
}

export interface Bourbon {
  id: string;
  defId: string;
  name: string;
  tags: Tag[];
  owner: string;
  /** Only FRESH bourbons may be committed to a Push. Committing depletes it
   *  (win/lose/tie). Persists across ages. Refresh (Distill) → FRESH. */
  state: BourbonState;
}

// ── Market (brief §12) ───────────────────────────────────────────────
export interface MarketLot {
  id: string;
  def: BourbonDef;
  /** DP-markers committed per player. Markers come from dpSupply. */
  bids: Record<string, number>;
}

// ── Action cards (brief §5, §14c) ────────────────────────────────────
export interface ActionCard {
  id: string;
  name: string;
  suit: Suit;
  pips: number; // actions granted THIS round (floor 2 on a normal play)
  icon: boolean; // bourbon initiative icon — last icon played takes the marker
}

// ── Players ──────────────────────────────────────────────────────────
export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  colorIdx: number;

  capital: number; // SCORE ONLY — from niches only (§9)
  dpSupply: number; // one pool: map DPs AND market bid markers
  tokens: Record<TokenType, number>; // public, uncapped
  distillery: Distillery; // §17 identity; symmetric in the base game

  hand: ActionCard[];
  bourbons: Bourbon[];
  heldTile: TileDef | null; // at most HELD_TILE_CAP un-placed tiles
  setupTiles: TileDef[]; // setup-phase tiles still to place (brief §13.2)

  // — per-round commit (brief §4 — chaining) —
  /** Face-up cards played this round: [primary, ...chained]. Empty if surrendered. */
  committedFaceUp: ActionCard[];
  /** Face-down cards: one sacrifice per chained card, or the single surrender card. */
  committedSacrificed: ActionCard[];
  surrendered: boolean; // a lone face-down = 1 any-action, no icon

  pipsRemaining: number;
  /** Suits this player may act in this round: face-up suits ∪ spent-token suits;
   *  a surrender allows every suit (1 action of any type). */
  allowedSuits: Suit[];
  hasCommitted: boolean;
  turnDone: boolean;
}

// ── Game ─────────────────────────────────────────────────────────────
export type GamePhase = "setup" | "playing" | "ended";
/**
 * Setup (brief §5): setupPlace = each player places their 5 setup tiles in turn
 * order (>=2 adjacency); setupDraft = snake opening draft, 3 BOURBONS each from
 * the non-premium pool; setupDP = each player plants STARTING_DPS LIVE DPs in
 * turn order (setup-exempt from control-adjacency). Then play begins.
 * Age start: trade → catchup. Round: planning → commit → resolve. ageEnd runs
 * market resolution + niche scoring.
 */
export type RoundStage =
  | "setupPlace"
  | "setupDraft"
  | "setupDP"
  | "trade"
  | "catchup"
  | "planning"
  | "commit"
  | "resolve"
  | "ageEnd";

export interface LogEntry {
  age: number;
  round: number;
  message: string;
}

export interface GameState {
  phase: GamePhase;
  age: number; // 1..AGES
  round: number; // 1..ROUNDS_PER_AGE
  stage: RoundStage;

  players: Player[];
  tiles: Tile[];
  dps: DP[];
  nicheFlags: NicheFlag[];

  tileSupply: TileDef[];
  market: MarketLot[];
  bourbonDeck: BourbonDef[];

  actionDeck: ActionCard[];
  actionDiscard: ActionCard[];
  catchUpBoard: ActionCard[];

  /** Player indices in acting order for the CURRENT stage. */
  initiative: number[];
  turnPos: number; // index into initiative
  startPlayerIndex: number;
  /** Holder of the initiative marker — leads the next round (brief §4). */
  initiativeMarker: number;
  /** The round-1 initiative to install once the age-start stages finish. */
  pendingInitiative: number[];
  /** Trade offers collected during the "trade" stage, by player id. */
  tradeOffers: Record<string, string[]>;
  /** Snake pick order for the opening draft (setupDraft); turnPos indexes it. */
  setupDraftSeq: number[];

  rngSeed: number;
  idCounter: number; // threaded, so snapshots stay replay-equal
  log: LogEntry[];
}

// ── Actions ──────────────────────────────────────────────────────────
export type Action =
  // — setup phase (brief §13/§15) —
  | { type: "SETUP_PLACE_TILE"; hex: Hex; tileIndex?: number } // place a setup tile (>=2 adjacency); tileIndex picks which (default 0)
  | { type: "SETUP_DRAFT_BOURBON"; lotId: string } // opening draft: take a bourbon
  | { type: "SETUP_PLACE_DP"; tileId: string } // opening draft: place a LIVE DP (setup-exempt)
  | { type: "TRADE_OFFER"; cardIds: string[] } // age start: offer up to TRADE_MAX cards
  | { type: "CATCHUP_SWAP"; handCardId: string; boardCardId: string | null } // null = pass
  | { type: "SPEND_TOKEN"; token: TokenType } // planning: +1 action of that suit
  // commit (brief §4): one primary face-up card, N chained (each paid by a
  // face-down sacrifice), OR a surrender (empty faceUp, one sacrifice).
  | { type: "COMMIT_PLAY"; faceUpIds: string[]; sacrificeIds: string[]; surrender: boolean }
  | { type: "BUILD_DP"; tileId: string }
  | { type: "REPAIR_DP"; dpId: string }
  | { type: "PUSH"; tileId: string; bourbonIds: string[] }
  | { type: "REFRESH"; bourbonId: string }
  | { type: "ADD_NICHE_FLAG"; tileId: string }
  | { type: "REMOVE_NICHE_FLAG"; tileId: string }
  | { type: "EXPAND_DRAW" } // draw a tile into hand
  | { type: "EXPAND_PLACE"; hex: Hex } // place the held tile
  | { type: "BID"; lotId: string }
  | { type: "MOVE_BID"; fromLotId: string; toLotId: string }
  | { type: "CLAIM_SLOT"; tileId: string; tag: Tag } // place a DP into an empty ownership slot
  | { type: "END_TURN" };

export type ActionResult = { ok: true; state: GameState } | { ok: false; reason: string };
