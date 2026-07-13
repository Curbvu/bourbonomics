// Bourbonomics: Map Game — type model.
//
// Canonical names track docs/MAP_GAME_SPEC.md §1. The engine is pure: every
// mutation flows through applyAction(state, action) and returns a new state or a
// typed refusal.

// ── Taste ────────────────────────────────────────────────────────────
export type TasteTrait = "rye" | "wheat" | "corn" | "aged" | "premium";
export const TASTE_TRAITS: TasteTrait[] = ["rye", "wheat", "corn", "aged", "premium"];

export type RewardIcon = "capital" | "token";

// ── Board ────────────────────────────────────────────────────────────
/** Axial hex coordinate. */
export interface Hex {
  q: number;
  r: number;
}

export interface Tile {
  id: string;
  hex: Hex;
  traits: TasteTrait[]; // tastes this market likes
  averse: TasteTrait | null; // a bourbon carrying this contradicts the tile (fit 0)
  reward: RewardIcon | null;
  shelfCapacity: number; // shared DP slots (active + inactive)
}

export type DPStatus = "active" | "inactive";

export interface DP {
  id: string;
  owner: string; // player id
  tileId: string;
  status: DPStatus;
}

export interface Niche {
  id: string;
  owner: string; // player id
  tileIds: string[]; // ≥ NICHE_MIN_TILES contiguous, controlled at declaration
}

// ── Bourbons ─────────────────────────────────────────────────────────
export type BourbonState = "fresh" | "flipped";

export interface Bourbon {
  id: string;
  defId: string;
  name: string;
  traits: TasteTrait[];
  basePrice: number;
  ceiling: number; // 1..3 — max fit it can ever reach
  state: BourbonState;
  locked: boolean; // tied to a tile after a winning defense, until age end
  maturitySlot: number; // 1..5 — its cellar position
  owner: string;
}

/** A bourbon offer as it sits face-up on the Distill row. */
export interface BourbonDef {
  defId: string;
  name: string;
  traits: TasteTrait[];
  basePrice: number;
  ceiling: number;
}

export type AcquireMethod = "grab" | "court";

/** One face-up slot on the Distill row, with any agents committed to it. */
export interface DistillSlot {
  def: BourbonDef;
  // agents committed per player, with the method that player is pursuing.
  agents: Record<string, { count: number; method: AcquireMethod }>;
}

// ── Action cards ─────────────────────────────────────────────────────
/** Fewer bips ⇒ earlier initiative (inverse coupling). */
export interface ActionCard {
  id: string;
  bips: number; // 2..4
}

// ── Players ──────────────────────────────────────────────────────────
export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  colorIdx: number;

  capital: number;
  tokens: number;
  agents: number; // supply (unplaced)

  hand: ActionCard[];
  cellar: Bourbon[];

  // per-round state
  playedCard: ActionCard | null; // the card chosen this round (null = sacrificed / not yet)
  sacrificed: boolean; // played face-down this round
  bips: number; // bips remaining this round
  hasChosen: boolean; // has committed a card choice this round
  done: boolean; // finished this round's turn
}

// ── Game ─────────────────────────────────────────────────────────────
export type GamePhase = "playing" | "ended";
/** choose = everyone picks a card; act = turns resolve in initiative order. */
export type RoundStage = "choose" | "act" | "ageEnd";

/** A pending combat awaiting the defender's commit (bot auto-commits). */
export interface PendingPush {
  variant: "attack" | "purge";
  attacker: string;
  defender: string;
  tileId: string;
  attackerBourbonIds: string[];
}

export interface GameState {
  phase: GamePhase;
  age: number; // 1..AGES
  round: number; // 1..ROUNDS_PER_AGE (within the age)
  stage: RoundStage;

  players: Player[];
  tiles: Tile[];
  dps: DP[];
  niches: Niche[];

  distillRow: DistillSlot[];
  distillDeck: BourbonDef[];

  turnOrder: number[]; // player indices, initiative order for this round
  turnPos: number; // index into turnOrder

  startPlayerIndex: number;
  rngSeed: number;
  log: string[];
}

// ── Actions ──────────────────────────────────────────────────────────
export type Action =
  | { type: "CHOOSE_CARD"; cardId: string } // pick a card for the round
  | { type: "SACRIFICE_CARD"; cardId: string } // play face-down: 1 bip, last initiative
  | { type: "SPEND_TOKEN" } // prelude: convert a token to bips (during your turn)
  | { type: "PLACE_TILE"; nearTileId: string } // blue-ocean expansion
  | { type: "BUILD_DP"; tileId: string }
  | { type: "REPAIR_DP"; dpId: string }
  | { type: "DECLARE_NICHE"; tileIds: string[] }
  | { type: "ADD_TILE_TO_NICHE"; nicheId: string; tileId: string }
  | { type: "REMOVE_TILE_FROM_NICHE"; nicheId: string; tileId: string }
  | { type: "DISTILL"; slotIndex: number; method: AcquireMethod }
  | { type: "PUSH"; variant: "attack" | "purge"; tileId: string; defender: string; bourbonIds: string[] }
  | { type: "END_TURN" };

export type ActionResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };
