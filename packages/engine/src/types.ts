// ============================================================
// Bourbonomics 2.0 — Engine Types
// ============================================================
// Refer to docs/GAME_RULES.md for the canonical ruleset and
// docs/IMPLEMENTATION_GUIDE.md for the architectural intent.

// -----------------------------
// Cards
// -----------------------------

export type CardType = "resource" | "capital" | "mashbill";

export type ResourceSubtype = "cask" | "corn" | "rye" | "barley" | "wheat";
export type GrainSubtype = "rye" | "barley" | "wheat";

export const GRAIN_SUBTYPES: GrainSubtype[] = ["rye", "barley", "wheat"];

/** A concrete card instance in a player's deck/hand/discard/etc. */
export interface Card {
  id: string;                         // unique instance id
  cardDefId: string;                  // references the catalog definition
  type: "resource" | "capital";       // mash bills + ops cards have their own types
  subtype?: ResourceSubtype;          // for resource cards
  premium?: boolean;                  // true for cards like 2-rye
  resourceCount?: number;             // 1 for plain, 2 for 2-rye, etc.
  capitalValue?: number;              // for capital cards
  /** Optional: subtypes this card may stand in for (e.g. "any grain" specialty). */
  aliases?: ResourceSubtype[];
  /** Capital cost to acquire this card from the market. Defaults to 1. */
  cost?: number;
  /** How many B$ this card pays when spent at the market. Defaults to 1
   *  for resource cards and to `capitalValue ?? 1` for capital cards. The
   *  field exists so future expansion cards (e.g. "premium grain pays
   *  B$2") can override the default without rewriting the spend rules. */
  value?: number;
  /** Optional themed name shown in place of the auto-generated label. */
  displayName?: string;
  /** Optional one-line flavor used by the inspect modal. */
  flavor?: string;
  /** Themed-card effect descriptor; resolved at commit/sale/spend time. */
  effect?: CardEffect;
  /**
   * v2.7.2: marks Specialty / Double Specialty band cards. Recipes with
   * `minSpecialty` requirements count only specialty cards of the given
   * subtype toward the requirement. Independent of `premium` (Doubles
   * are premium but not specialty); independent of the on-sale rep
   * effect (the bonus is encoded via `effect`, this flag is the
   * structural marker).
   */
  specialty?: boolean;
}

// -----------------------------
// Themed-card effect system
// -----------------------------
// Effects fire at one of four discrete moments and are otherwise pure
// data — no upkeep between firings. The resolver lives in
// `src/card-effects.ts` and is hooked from MAKE_BOURBON,
// AGE_BOURBON, SELL_BOURBON, and BUY_FROM_MARKET.

export type CardEffectWhen =
  | "on_commit_production"
  | "on_commit_aging"
  | "on_sale"
  | "on_spend";

export type CardEffect =
  | { kind: "draw_cards"; when: CardEffectWhen; n: number }
  | { kind: "rep_on_sale_flat"; when: "on_sale"; rep: number }
  | { kind: "rep_on_sale_if_age_gte"; when: "on_sale"; age: number; rep: number }
  | { kind: "rep_on_sale_if_demand_gte"; when: "on_sale"; demand: number; rep: number }
  | { kind: "rep_on_commit_aging"; when: "on_commit_aging"; rep: number }
  | { kind: "rep_on_market_spend"; when: "on_spend"; rep: number }
  | { kind: "bump_demand"; when: "on_commit_production"; delta: number }
  | { kind: "skip_demand_drop"; when: "on_sale" }
  | { kind: "barrel_starts_aged"; when: "on_commit_production"; age: number }
  | { kind: "aging_card_doubled"; when: "on_commit_aging"; years: number }
  | { kind: "grid_demand_band_offset"; when: "on_sale"; offset: number }
  | { kind: "grid_rep_offset"; when: "on_commit_production"; offset: number }
  | { kind: "returns_to_hand_on_sale"; when: "on_sale" }
  | { kind: "composite"; effects: CardEffect[] };

// -----------------------------
// Mash Bills
// -----------------------------

/** Recipe constraint on the mash committed at production. Always tightens, never loosens. */
export interface MashBillRecipe {
  minCorn?: number;
  minRye?: number;
  minBarley?: number;
  minWheat?: number;
  /** 0 means forbidden. */
  maxRye?: number;
  maxWheat?: number;
  minTotalGrain?: number;
  /**
   * v2.7.2: per-subtype Specialty (or Double Specialty) requirements.
   * Counts only cards flagged `card.specialty === true`. A
   * Double Specialty card contributes its `resourceCount` (so a Double
   * Superior Rye = 2 toward `minSpecialty.rye`). Used by Epic and
   * Legendary bills (and a handful of Rares) to gate top-tier payouts
   * behind market-only premium ingredients.
   */
  minSpecialty?: {
    cask?: number;
    corn?: number;
    rye?: number;
    barley?: number;
    wheat?: number;
  };
}

/** Predicate against the resolved sale conditions. All fields are AND-ed. */
export interface AwardCondition {
  minAge?: number;
  minDemand?: number;
  minReward?: number;
}

/** WoW-style rarity tiers. Drives card chrome (border, gradient, glow). */
export type MashBillTier = "common" | "uncommon" | "rare" | "epic" | "legendary";

/**
 * v2.7 difficulty/payoff tier. Independent of the visual rarity `tier`:
 *   1 — Starter bills. Universal rule only or one easy constraint.
 *       Flat, forgiving payoff grids (small spread, low age thresholds).
 *   2 — Mid bills. One real constraint. Wider payoff range, age thresholds
 *       pushed out, demand bands matter more.
 *   3 — Specialty bills. Multi-constraint recipes and/or skewed demand
 *       curves. Best payouts gated behind age 6+. Awards (Gold) cluster
 *       here.
 */
export type MashBillComplexityTier = 1 | 2 | 3;

export interface MashBill {
  id: string;                                // unique instance id
  defId: string;                             // references the catalog definition
  name: string;
  flavorText?: string;
  /** Short tagline shown on the card face (≤ ~35 chars). */
  slogan?: string;
  /** WoW-style rarity tier. Defaults to "common" when omitted. */
  tier?: MashBillTier;
  /** v2.7 gameplay difficulty/payoff tier (1 starter / 2 mid / 3 specialty). */
  complexityTier?: MashBillComplexityTier;
  /**
   * Lower-edge thresholds for the row dimension of the reward grid.
   * Variable length: simple bills (commons) might have a single
   * threshold (1 row); legendary bills might have 4-5. The grid's
   * row count must equal `ageBands.length`.
   */
  ageBands: number[];
  /** Lower-edge thresholds for the column dimension. See `ageBands`. */
  demandBands: number[];
  /**
   * 2D grid of reward values. Dimensions must match
   * `ageBands.length × demandBands.length`. Null cells reward 0
   * reputation (printed as "—").
   */
  rewardGrid: (number | null)[][];
  recipe?: MashBillRecipe;
  silverAward?: AwardCondition;
  goldAward?: AwardCondition;
  /**
   * Capital cost to pick this bill from the face-up bourbon row. When
   * omitted, defaults to `DEFAULT_MASH_BILL_COST` (see `cards.ts`).
   * Capital cards pay at printed value; other cards count as B$1.
   */
  cost?: number;
}

/** Default cost for face-up mash bill picks when `cost` is unspecified. */
export const DEFAULT_MASH_BILL_COST = 2;
export function mashBillCost(bill: MashBill): number {
  return bill.cost ?? DEFAULT_MASH_BILL_COST;
}

/**
 * Tuning aid: a single number summarising the bill's full economic
 * footprint — the implicit "investment" required to build one barrel
 * of this recipe. Use it to rank bills against each other while
 * balancing payout grids.
 *
 * Formula:
 *   - 1 per basic resource the recipe demands (universal cask + corn,
 *     plus any rye / barley / wheat / extra corn minimums)
 *   - 4 per Specialty resource (3 to buy from market + 1 for the
 *     +1-rep-on-sale bonus those cards earn)
 *   - + the bill's draw cost (`mashBillCost`)
 *
 * A Specialty card satisfies both the subtype's universal/per-subtype
 * minimum AND the specialty floor — so the formula counts it once at
 * 4, not 1 + 4. Mirrors the chip dedup in `buildRecipeChips`.
 */
export function mashBillBuildCost(bill: MashBill): number {
  const r = bill.recipe ?? {};
  const sp = r.minSpecialty ?? {};
  const minCask = 1; // universal
  const minCorn = Math.max(1, r.minCorn ?? 0);
  const minRye = r.minRye ?? 0;
  const minBarley = r.minBarley ?? 0;
  const minWheat = r.minWheat ?? 0;
  const namedGrain = minRye + minBarley + minWheat;
  const minTotalGrain = Math.max(r.minTotalGrain ?? 0, namedGrain === 0 ? 1 : namedGrain);
  const wildGrain = Math.max(0, minTotalGrain - namedGrain);

  const SPECIALTY_UNIT_COST = 4; // 3 market cost + 1 sale bonus

  const plainCask = Math.max(0, minCask - (sp.cask ?? 0));
  const plainCorn = Math.max(0, minCorn - (sp.corn ?? 0));
  const plainRye = Math.max(0, minRye - (sp.rye ?? 0));
  const plainBarley = Math.max(0, minBarley - (sp.barley ?? 0));
  const plainWheat = Math.max(0, minWheat - (sp.wheat ?? 0));

  const specialtyTotal =
    (sp.cask ?? 0) + (sp.corn ?? 0) + (sp.rye ?? 0) + (sp.barley ?? 0) + (sp.wheat ?? 0);

  return (
    plainCask +
    plainCorn +
    plainRye +
    plainBarley +
    plainWheat +
    wildGrain +
    specialtyTotal * SPECIALTY_UNIT_COST +
    mashBillCost(bill)
  );
}

// -----------------------------
// Investment Cards (display-only in v2.1; mechanic ships in v2.2)
// -----------------------------

export type InvestmentTier = "cheap" | "medium" | "expensive";

export interface InvestmentCard {
  id: string;
  defId: string;
  name: string;
  /** Capital cost to implement when the mechanic ships in v2.2. */
  capital: number;
  /** Up-front market price (top-right corner chip). */
  cost: number;
  /** Short tagline shown on the card face. */
  short: string;
  /** Long description of what the card does when implemented. */
  effect: string;
  tier: InvestmentTier;
}

/** Mash bills with `recipe.maxRye === 0` are "wheated" for distillery-bonus purposes. */
export function isWheatedBill(bill: MashBill): boolean {
  return bill.recipe?.maxRye === 0;
}

// -----------------------------
// Distilleries
// -----------------------------

export type DistilleryBonus =
  | "high_rye"
  | "wheated_baron"
  | "connoisseur"
  | "vanilla";

/** Identifier for a basic starter mash bill (NOT in the Bourbon deck). */
export type StarterBillKey = "workhorse" | "high_rye_basic" | "wheated_basic";

export interface DistilleryStarterBarrel {
  /** Age in years (number of aging cards equivalent) at game start. */
  age: number;
  /** Which basic mash bill the pre-aged barrel ships with. */
  basicBillKey: StarterBillKey;
}

export interface DistilleryStarterPoolMods {
  /** Free 2-rye premium cards added to the dealt starter hand. */
  bonusTwoRye?: number;
  /** Net change to capital cards in the dealt starter hand (negative removes). */
  capitalDelta?: number;
}

export interface DistillerySaleMods {
  /** +N reputation when selling a bill matching `kind`. */
  bonusRepOnBill?: { kind: "high_rye" | "wheated"; rep: number };
}

export interface Distillery {
  id: string;
  defId: string;
  name: string;
  flavorText?: string;
  bonus: DistilleryBonus;
  /** Total starting rickhouse slots a player gets if they pick this distillery. */
  slots: number;
  /** Hard cap on rickhouse slots (blocks Rickhouse Expansion Permit above this). Default 6. */
  maxSlots?: number;
  /** Pre-aged starting barrel placed in the rickhouse at game start. */
  startingBarrel?: DistilleryStarterBarrel;
  /** Modifications to the dealt starter hand. */
  starterPoolMods?: DistilleryStarterPoolMods;
  /** Sale-time modifiers tied to the attached mash bill. */
  saleMods?: DistillerySaleMods;
  /** Number of mash bills drafted during setup (default 3). */
  mashBillDraftSize?: number;
  /**
   * v2.6: cap on the number of slots that may hold a bill at once. When
   * set, this distillery cannot draw additional bills past the cap even
   * after buying a Rickhouse Expansion Permit — extra slots become
   * overflow space for transferred completed barrels (Barrel Broker,
   * Blend) but cannot receive a freshly-drawn bill. Connoisseur Estate
   * uses this to enforce its 4-bill ceiling.
   */
  maxSlottedBills?: number;
}

// -----------------------------
// Operations Cards
// -----------------------------

export type OperationsCardDefId =
  | "market_manipulation"
  | "bourbon_boom"
  | "glut"
  | "regulatory_inspection"
  | "rushed_shipment"
  | "forced_cure"
  | "barrel_broker"
  | "market_corner"
  | "insider_buyer"
  | "kentucky_connection"
  | "bottling_run"
  | "cash_out"
  | "allocation"
  | "rickhouse_expansion_permit"
  | "mash_futures"
  | "coopers_contract"
  | "rating_boost"
  | "master_distiller"
  | "blend"
  | "demand_surge";

export interface OperationsCard {
  id: string;
  defId: OperationsCardDefId;
  name: string;
  description: string;
  /** One-line flavor tagline shown beneath the name on the card face. */
  flavor?: string;
  /** Up-front market price (top-right corner chip). */
  cost: number;
  /** Round in which the card was added to the player's operations hand. */
  drawnInRound: number;
}

// -----------------------------
// Barrels & Rickhouse Slots
// -----------------------------

export interface RickhouseSlot {
  id: string;          // e.g. "slot_p1_0"
  ownerId: string;
}

/**
 * Lifecycle phase. v2.6 introduces slot-bound mash bills, so a slot can
 * hold a barrel in any of three phases:
 *   - "ready" — bill present, no committed cards. The slot is taken (it
 *     can't be drawn into) but no production has started. Barrel does
 *     NOT age. Trashing a "ready" barrel is a free action.
 *   - "construction" — bill + ≥1 committed card, recipe not yet
 *     satisfied. Barrel does NOT age. Trashing requires ABANDON_BARREL.
 *   - "aging" — recipe satisfied. Barrel ages from the round AFTER it
 *     completed (`completedInRound + 1`).
 *
 * A slot with NO barrel is "open" — drawable into. There is no "open"
 * BarrelPhase because no Barrel record exists for an open slot.
 */
export type BarrelPhase = "ready" | "construction" | "aging";

export interface Barrel {
  id: string;
  ownerId: string;
  /** Slot in the owning player's rickhouse. */
  slotId: string;
  /** Lifecycle phase. See `BarrelPhase`. */
  phase: BarrelPhase;
  /**
   * Round in which the barrel transitioned from construction → aging.
   * Used to gate aging: the Age action skips the barrel until the round
   * AFTER completion. `null` for barrels still under construction.
   * Pre-aged starter barrels (e.g. High-Rye House) ship as
   * `phase: "aging"` with `completedInRound: 0` so they age from r1.
   */
  completedInRound: number | null;
  /**
   * Mash bill bound to this slot. v2.6: bills are slot-bound from the
   * moment they're drawn (or drafted at setup), so every Barrel record
   * has a non-null bill. Pre-aged starter barrels (High-Rye House,
   * Wheated Baron) ship with their starter bill already attached.
   */
  attachedMashBill: MashBill;
  /** card-def ids spent at production (audit / display). */
  productionCardDefIds: string[];
  /**
   * Cards committed during the construction phase (and at completion).
   * Locked with the barrel until sale per the rules — at sale they go
   * to discard (or hand, if a card has `returns_to_hand_on_sale`).
   */
  productionCards: Card[];
  /** Face-down cards committed to aging. Returned to discard on sale. */
  agingCards: Card[];
  /**
   * Effective age of the barrel for grid lookup. Equals
   * `agingCards.length` plus any commit-time age bonuses from cards
   * like Soft Red Wheat (barrel_starts_aged) and Winter Wheat
   * (aging_card_doubled).
   */
  age: number;
  productionRound: number;
  /** Reset to false at start of each round. */
  agedThisRound: boolean;
  /** Set by Regulatory Inspection — barrel cannot be aged this round. */
  inspectedThisRound: boolean;
  /** Set by Rushed Shipment — barrel may be aged once more this round. */
  extraAgesAvailable: number;
  /**
   * Persistent rep adder applied to every grid cell at sale time
   * (Single Barrel Cask). Stored on the barrel because the effect
   * fires at production commit and must outlast the spent card.
   */
  gridRepOffset: number;
  /**
   * Persistent demand-band offset applied at sale time
   * (Master Distiller — barrel reads grid as if demand were N higher).
   * Stacks additively with sale-card `grid_demand_band_offset` signals.
   */
  demandBandOffset: number;
}

// -----------------------------
// Player
// -----------------------------

export interface PlayerState {
  id: string;
  name: string;
  /** AI-controlled? Defaults to false (human). */
  isBot?: boolean;

  /** Distillery selected during setup. Null until SELECT_DISTILLERY resolves. */
  distillery: Distillery | null;
  /** Personal rickhouse slots. Built once distillery is selected. */
  rickhouseSlots: RickhouseSlot[];

  // Personal deck zones (resource + capital cards only).
  hand: Card[];
  deck: Card[];
  discard: Card[];

  // Out-of-deck holdings.
  // v2.6: bills are slot-bound, not held in hand. Recipes a player owns
  // are derivable from `state.allBarrels[*].attachedMashBill` for the
  // barrels they own.
  /** Operations cards held in hand. Persist across rounds; played as a free action. */
  operationsHand: OperationsCard[];

  /**
   * Face-up dealt hand during the `starter_deck_draft` phase (v2.4
   * Random Deal + Trading window). Empty outside that phase. Cards
   * here are publicly visible to other players for trade evaluation.
   */
  starterHand: Card[];
  /** True once the player has passed during the trade window. */
  starterPassed: boolean;
  /** True once the player has used their stuck-hand swap (one-shot per game). */
  starterSwapUsed: boolean;

  // Counters.
  reputation: number;
  handSize: number;                         // default 8
  barrelsSold: number;

  outForRound: boolean;                     // hand exhausted in current action phase

  // Per-round flags driven by ops cards / distillery bonuses.
  /** Set by Demand Surge — next sale this round does not drop demand. */
  demandSurgeActive: boolean;
  /**
   * Set by Insider Buyer — your next BUY_FROM_MARKET this turn pays
   * half the printed cost (rounded up, min 1¢). Cleared after one
   * purchase or when your turn ends.
   */
  pendingHalfCostMarketBuy: boolean;
  /**
   * Pre-played production discount that applies to the player's next
   * MAKE_BOURBON. Set by Mash Futures (`grain` — minimum total grain
   * relaxed by 1, floor 1) or Cooper's Contract (`cask` — the
   * cask-required-exactly-1 rule relaxes to allow 0). Cleared after
   * one production. Persists across rounds until used.
   */
  pendingMakeDiscount: "grain" | "cask" | null;
  /**
   * Set by Rating Boost — your next SELL_BOURBON gains an additional
   * +N reputation on top of the grid reward. Persists until consumed.
   */
  pendingRatingBoost: number;
}

// -----------------------------
// Game State
// -----------------------------

export type GamePhase =
  | "setup"
  | "distillery_selection"
  | "starter_deck_draft"
  | "demand"
  | "draw"
  | "action"
  | "cleanup"
  | "ended";

export interface GameState {
  /** Original seed (for replays). */
  seed: number;
  /** Current RNG state — advances with every randomized operation. */
  rngState: number;

  round: number;
  phase: GamePhase;
  /**
   * Seat of the round's first player. Rotates one seat counter-clockwise
   * after each cleanup, so the player who acted last in round N becomes
   * the first player in round N+1 (the "bookend" — see GAME_RULES.md).
   */
  startPlayerIndex: number;
  currentPlayerIndex: number;

  players: PlayerState[];

  /** Available distilleries (consumed as players pick during setup). */
  distilleryPool: Distillery[];
  /** Player ids in the order they pick distilleries (reverse snake). */
  distillerySelectionOrder: string[];
  /** Index into distillerySelectionOrder pointing at the next picker. */
  distillerySelectionCursor: number;

  /**
   * Player ids who need a starter deck (reverse-snake seat order).
   * Under v2.4 the order is informational only — the random deal +
   * trade window has no per-player turn order. Phase ends when every
   * player in this list has set `starterPassed: true`.
   */
  starterDeckDraftOrder: string[];
  /**
   * Undealt remainder of the starter pool (v2.4). Used by the
   * stuck-hand safety valve (`STARTER_SWAP`) to draw replacement
   * cards. Empty when the phase isn't running.
   */
  starterUndealtPool: Card[];

  /** Every barrel in play. Owner is barrel.ownerId; slot is barrel.slotId. */
  allBarrels: Barrel[];

  marketConveyor: Card[];                   // up to 6 face-up
  marketSupplyDeck: Card[];                 // face-down draw pile
  marketDiscard: Card[];                    // for reshuffle on exhaustion

  bourbonDeck: MashBill[];
  /** Face-up bourbon row beside the deck. Up to 3 bills. */
  bourbonFaceUp: MashBill[];
  bourbonDiscard: MashBill[];

  /** Shared operations deck. */
  operationsDeck: OperationsCard[];
  operationsDiscard: OperationsCard[];

  demand: number;                           // 0..12
  demandRolls: { round: number; roll: [number, number]; result: "rise" | "hold" }[];

  finalRoundTriggered: boolean;
  finalRoundTriggerPlayerIndex: number | null;

  /** Players who have completed the current phase (e.g. drew their hand). Reset on phase transition. */
  playerIdsCompletedPhase: string[];

  /** Monotonic counter for IDs of entities created mid-game (e.g. barrels). */
  idCounter: number;

  actionHistory: GameAction[];
}

// -----------------------------
// Game Config (for initializeGame)
// -----------------------------

export interface GameConfig {
  seed: number;
  players: { id: string; name: string; isBot?: boolean }[];
  /** Pre-built starter decks per player (alternative to running the draft). */
  starterDecks?: Card[][];
  /** Pre-drafted mash bills per player (alternative to running the draft). */
  startingMashBills?: MashBill[][];
  /** Mash bills remaining in the bourbon deck after the draft. */
  bourbonDeck?: MashBill[];
  /** Cards that populate the market supply (some go straight to the conveyor). */
  marketSupply?: Card[];
  /** Override the operations deck. */
  operationsDeck?: OperationsCard[];
  /** Pre-assign distilleries (skips selection phase). Length must equal players.length. */
  startingDistilleries?: Distillery[];
  /** Override the distillery pool offered during selection. */
  distilleryPool?: Distillery[];
  /** Initial demand (default 0 per rules, though tests typically set this explicitly). */
  startingDemand?: number;
  /** Override starting hand size (default 8). */
  startingHandSize?: number;
}

// -----------------------------
// New-game setup payload
// -----------------------------

/**
 * Per-seat setup data captured at new-game time. The client mints
 * these from the new-game form; the multi-player server takes them
 * over the wire and bootstraps a `GameConfig` from them.
 */
export interface NewGameSeat {
  name: string;
  /** Cosmetic — picks the avatar asset shown in the seat strip. */
  logoId?: string;
  /** Bot difficulty selector. Ignored for human seats. */
  difficulty?: "easy" | "normal" | "hard";
}

/**
 * Config payload for `newGame` (client, single-player). The host is
 * the lone human; everything else is bots that play themselves.
 * Distinct from `GameConfig` (which is the fully-resolved engine
 * input); this is the human-friendly form.
 */
export interface NewGameConfig {
  /** Human seat goes first; bots follow. */
  human: NewGameSeat;
  bots: NewGameSeat[];
  /** Optional fixed seed for replays / shareable games. */
  seed?: number;
}

/**
 * Config payload for the multi-player `create-room` message. The
 * host is implicitly seat 0; `extraHumanSeats` counts additional
 * human seats other connections can claim. Bots fill the remaining
 * seats and play themselves.
 *
 * Total player count = 1 + extraHumanSeats + bots.length.
 */
export interface NewMultiplayerGameConfig {
  /** Display name for the host's seat. */
  host: NewGameSeat;
  /** Number of additional human seats waiting to be claimed. */
  extraHumanSeats: number;
  /** Bot seats; their `name` is shown in the rickhouse strip. */
  bots: NewGameSeat[];
  /** Optional fixed seed for replays / shareable games. */
  seed?: number;
}

// -----------------------------
// Actions (Discriminated Union)
// -----------------------------

/** Discriminator for ops card plays. Each variant carries the params it needs. */
export type PlayOperationsCardParams =
  | { defId: "market_manipulation"; direction: "up" | "down" }
  | { defId: "bourbon_boom" }
  | { defId: "glut" }
  | { defId: "regulatory_inspection"; targetBarrelId: string }
  | { defId: "rushed_shipment"; targetBarrelId: string }
  | { defId: "forced_cure"; targetBarrelId: string }
  | {
      defId: "barrel_broker";
      sourceBarrelId: string;
      targetPlayerId: string;
      targetSlotId: string;
      paymentCardIds: string[];
    }
  | { defId: "market_corner"; marketSlotIndex: number }
  | { defId: "insider_buyer" }
  | { defId: "kentucky_connection" }
  | { defId: "bottling_run" }
  | { defId: "cash_out" }
  | { defId: "allocation" }
  | { defId: "rickhouse_expansion_permit" }
  | { defId: "mash_futures" }
  | { defId: "coopers_contract" }
  | { defId: "rating_boost" }
  | { defId: "master_distiller"; targetBarrelId: string }
  | { defId: "blend"; barrel1Id: string; barrel2Id: string }
  | { defId: "demand_surge" };

export type GameAction =
  | { type: "SELECT_DISTILLERY"; playerId: string; distilleryId: string }
  | {
      // v2.4 Random Deal + Trading: a 1-for-1 swap between two players
      // during the `starter_deck_draft` trade window. Each side must
      // offer exactly one card from their `starterHand`.
      type: "STARTER_TRADE";
      player1Id: string;
      player2Id: string;
      player1CardId: string;
      player2CardId: string;
    }
  | {
      // v2.4 Stuck-Hand safety valve: the player returns up to 3 cards
      // from their `starterHand` to `starterUndealtPool` and draws the
      // same number of replacements off the pool's top. Once per game.
      type: "STARTER_SWAP";
      playerId: string;
      cardIds: string[];
    }
  | {
      // v2.4 Pass: the player commits their `starterHand` as final.
      // The phase ends once every drafter has passed.
      type: "STARTER_PASS";
      playerId: string;
    }
  | { type: "ROLL_DEMAND"; roll: [number, number] }
  | { type: "DRAW_HAND"; playerId: string }
  | {
      // v2.6 slot-bound bills: commits ≥1 card from the player's hand
      // to an existing slot that already holds a bill (drawn at setup
      // or via DRAW_MASH_BILL). The barrel auto-transitions from
      // "ready" → "construction" → "aging" as cards accumulate. Slots
      // are opened by DRAW_MASH_BILL, not by this action; bills are
      // already attached when MAKE_BOURBON dispatches.
      type: "MAKE_BOURBON";
      playerId: string;
      slotId: string;
      cardIds: string[];
    }
  | {
      // v2.6: discard a "ready" or "construction" barrel. All committed
      // production cards return to the player's discard pile, the
      // attached bill goes to the bourbon discard, and the slot becomes
      // fully open. Aging-phase barrels cannot be abandoned.
      type: "ABANDON_BARREL";
      playerId: string;
      barrelId: string;
    }
  | { type: "AGE_BOURBON"; playerId: string; barrelId: string; cardId: string }
  | {
      // v2.6: when the sold barrel triggers a Gold award, the player
      // chooses one of three slot manipulations via `goldChoice`:
      //   - "convert" → replace another slot's bill with this Gold
      //                 bill (target's committed cards must satisfy
      //                 the new recipe); selling slot opens fully.
      //                 Requires `goldConvertTargetSlotId`.
      //   - "keep"    → bill stays in the now-empty selling slot
      //                 ("ready" barrel). Same behavior as a Silver.
      //   - "decline" → bill goes to bourbon discard; selling slot
      //                 opens fully.
      // Ignored when the sale doesn't trigger a Gold award.
      type: "SELL_BOURBON";
      playerId: string;
      barrelId: string;
      reputationSplit: number;
      cardDrawSplit: number;
      /**
       * v2.7.1: id of the resource or capital card spent from the
       * player's hand to pay the sell-action cost. Goes straight to
       * discard. This card is one of the ~7 cards a baseline barrel
       * consumes across its full lifecycle.
       */
      spendCardId: string;
      goldChoice?: "convert" | "keep" | "decline";
      goldConvertTargetSlotId?: string;
    }
  | {
      type: "BUY_FROM_MARKET";
      playerId: string;
      marketSlotIndex: number;
      /**
       * Cards spent from hand to pay the cost. Capital cards pay their
       * `capitalValue`; resource cards pay 1¢ each.
       */
      spendCardIds: string[];
    }
  | {
      type: "BUY_OPERATIONS_CARD";
      playerId: string;
      /** Index into the face-up operations row (0..2). */
      opsSlotIndex: number;
      /** Same payment rules as BUY_FROM_MARKET. */
      spendCardIds: string[];
    }
  | {
      type: "DRAW_MASH_BILL";
      playerId: string;
      /**
       * When set: pick the face-up bill with this id. Pay sum-of-cards
       * ≥ `mashBillCost(bill)` (capital cards pay face value).
       * When omitted: blind draw from the top of the bourbon deck. Pay
       * exactly 1 card from your hand.
       */
      mashBillId?: string;
      /**
       * Cards to spend. Blind draw needs exactly 1; face-up needs sum
       * ≥ the bill's cost.
       */
      spendCardIds: string[];
    }
  | {
      type: "TRADE";
      player1Id: string;
      player2Id: string;
      player1Cards: string[];
      player2Cards: string[];
    }
  | ({
      type: "PLAY_OPERATIONS_CARD";
      playerId: string;
      cardId: string;
    } & PlayOperationsCardParams)
  | { type: "PASS_TURN"; playerId: string };

// -----------------------------
// Engine API
// -----------------------------

export interface ValidationResult {
  legal: boolean;
  reason?: string;
}

export interface ScoreResult {
  playerId: string;
  reputation: number;
  deckSize: number;          // hand + deck + discard (smaller wins tiebreak)
  barrelsSold: number;
  rank: number;              // 1-based; ties share rank
}

export interface GameEngine {
  initializeGame(config: GameConfig): GameState;
  validateAction(state: GameState, action: GameAction): ValidationResult;
  applyAction(state: GameState, action: GameAction): GameState;
  isGameOver(state: GameState): boolean;
  computeFinalScores(state: GameState): ScoreResult[];
}
