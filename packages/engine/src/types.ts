// ============================================================
// Bourbonomics 2.0 — Engine Types
// ============================================================
// Refer to docs/GAME_RULES.md for the canonical ruleset and
// docs/IMPLEMENTATION_GUIDE.md for the architectural intent.

// -----------------------------
// Cards
// -----------------------------

// Unified market: the 10-slot market holds resources, Labor cards,
// ops cards, and investment cards in one row. Mash bills live face-down
// in the bourbon deck and surface only during the Drafting Loop —
// there's no face-up bill row in v2.14. Capital cards no longer exist —
// rep is the unified currency.
export type CardType =
  | "resource"
  | "labor"
  | "operations"
  | "investment"
  | "mashbill";

export type ResourceSubtype = "cask" | "corn" | "rye" | "barley" | "wheat";
export type GrainSubtype = "rye" | "barley" | "wheat";

/**
 * Labor subtypes:
 *   - "generic"   — universal +1 toward any purchase. Also legal as an
 *                   aging-commit card (sweat equity in the warehouse).
 *   - "marketing" — +2 toward operations card purchases.
 *   - "cooper"    — +2 toward market resource purchases.
 *   - "architect" — +2 toward investment purchases (ships in market).
 *
 * A Specialty Labor card with a non-matching purchase domain contributes
 * 0 — the worker doesn't apply, the rep gap stays open. Mash bills no
 * longer cost rep (v2.14 Drafting Loop — payment is one card per bill
 * taken, paid into the draft pile), so there is no "bill_draw" Labor
 * domain.
 */
export type LaborSubtype = "generic" | "marketing" | "cooper" | "architect";

/** Which purchase domain a Specialty Labor card discounts. */
export type LaborDomain =
  | "any"
  | "ops"
  | "market_resource"
  | "investment";

/** A concrete card instance in a player's deck/hand/discard/etc. */
export interface Card {
  id: string;                         // unique instance id
  cardDefId: string;                  // references the catalog definition
  /**
   * Card type. The market mixes resources, Labor cards, ops cards, and
   * investment cards in one row; mash bills stay separate.
   */
  type: "resource" | "labor" | "operations" | "investment";
  subtype?: ResourceSubtype;          // for resource cards
  /** Labor subtype. Set only when `type === "labor"`. */
  laborSubtype?: LaborSubtype;
  /** Purchase domain a Specialty Labor card discounts. */
  laborDomain?: LaborDomain;
  /**
   * Labor contribution toward a matching-domain purchase.
   * Generic = 1; Specialty = 2 in domain, 0 elsewhere.
   */
  laborContribution?: number;
  premium?: boolean;                  // true for premium variants (Specialty, Heritage)
  resourceCount?: number;             // uniformly 1
  /**
   * Set when `type === "operations"` for a market card. Carries the
   * full OperationsCard spec inline so buying just copies the spec
   * (with a fresh id + drawnInRound) into the buyer's operationsHand.
   */
  opSpec?: OperationsCard;
  /**
   * Set when `type === "investment"` for a market card. Carries the
   * full InvestmentCard spec inline. On-buy effects don't fire yet
   * (the catalog is `implemented: false` across the board); the spec
   * is preserved so a future wave can switch to resolving effects.
   */
  investmentSpec?: InvestmentCard;
  /** Optional: subtypes this card may stand in for (e.g. "any grain" specialty). */
  aliases?: ResourceSubtype[];
  /**
   * Rep cost to acquire this card from the market. Defaults to 1.
   * Under unified rep this is paid in reputation (with Labor
   * supplementing — see `BUY_FROM_MARKET`).
   */
  cost?: number;
  /** Optional themed name shown in place of the auto-generated label. */
  displayName?: string;
  /** Optional one-line flavor used by the inspect modal. */
  flavor?: string;
  /** Themed-card effect descriptor; resolved at commit/sale/spend time. */
  effect?: CardEffect;
  /**
   * Marks Specialty / Heritage band cards. Recipes with
   * `minSpecialty` requirements count only specialty-flagged cards of
   * the given subtype toward the requirement. Independent of `premium`;
   * independent of any on-sale effect (the v2.10 uniform Specialty
   * +1-rep-on-sale bonus is retired — per-card Heritage bonuses ride
   * the regular `effect` field). The flag is the structural marker
   * recipes read against.
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
   * per-subtype Specialty / Heritage requirements. Counts only
   * cards flagged `card.specialty === true`; each contributes its
   * `resourceCount` (1 unit per card — no 2-unit cards exist).
   * Heritage cards satisfy the gate the same as Specialty cards. Used
   * across the rarity ramp: uncommons get light pressure (≤1 grain slot
   * gated), rares semi-gate (1–2 slots), epics fully gate every cask/
   * grain slot, legendaries gate broader still (more entries, often
   * tighter caps).
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
 * difficulty/payoff tier. Independent of the visual rarity `tier`:
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
   * Marks the bill as scripted-tutorial-only. Filtered out of the
   * public bourbon deck and the Bourbon Cards gallery so it never
   * appears in real games. Set on the rebuild's Backroad Batch and
   * Heritage Reserve.
   */
  tutorialOnly?: boolean;
}

/**
 * sale-floor table: every sale pays at least this much rep,
 * regardless of grid value + bonuses. Keyed off the bill's rarity
 * tier so every barrel built clears its base cost.
 *
 *   common / uncommon → 3 rep   (Tier 1)
 *   rare              → 4 rep   (Tier 2)
 *   epic / legendary  → 5 rep   (Tier 3)
 *
 * The clamp lives in `SELL_BOURBON` apply: `total = max(total, floor)`.
 */
export function saleFloorForBill(bill: MashBill): number {
  const t = bill.tier ?? "common";
  if (t === "epic" || t === "legendary") return 5;
  if (t === "rare") return 4;
  return 3;
}

/**
 * how many rep this Labor card contributes toward a purchase
 * of `domain`. Generic Labor pays 1 anywhere. Specialty Labor pays its
 * `laborContribution` (2 by default) when the domains match, 0 when
 * they don't. Non-Labor cards return 0 — Labor is the only card type
 * that supplements rep on purchases.
 *
 * Mash bills are paid in cards-only (Drafting Loop) and do not call
 * this function — only market, ops, and investment buys do.
 */
export function laborContribution(
  card: Card,
  domain: Exclude<LaborDomain, "any">,
): number {
  if (card.type !== "labor") return 0;
  if (card.laborDomain === "any") return card.laborContribution ?? 1;
  if (card.laborDomain === domain) return card.laborContribution ?? 2;
  return 0;
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
 *   - 2 per Specialty resource — the cheapest option that satisfies a
 *     `minSpecialty` floor (market cost $2; no uniform sale bonus).
 *     Heritage ($3) also satisfies the gate but a rational builder
 *     reaches for Specialty unless they want a Heritage card's
 *     per-card bonus.
 *   - + 1 for the card the player pays into the Drafting Loop to take
 *     the bill (cards-only economy under v2.14)
 *
 * A Specialty card satisfies both the subtype's universal/per-subtype
 * minimum AND the specialty floor — so the formula counts it once at
 * 2, not 1 + 2. Mirrors the chip dedup in `buildRecipeChips`.
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

  // Specialty market cost is $2; uniform +1-rep-on-sale bonus is
  // retired. Heritage costs $3 and also satisfies the gate, but a
  // build-cost lower bound assumes the cheaper option.
  const SPECIALTY_UNIT_COST = 2;

  const plainCask = Math.max(0, minCask - (sp.cask ?? 0));
  const plainCorn = Math.max(0, minCorn - (sp.corn ?? 0));
  const plainRye = Math.max(0, minRye - (sp.rye ?? 0));
  const plainBarley = Math.max(0, minBarley - (sp.barley ?? 0));
  const plainWheat = Math.max(0, minWheat - (sp.wheat ?? 0));

  const specialtyTotal =
    (sp.cask ?? 0) + (sp.corn ?? 0) + (sp.rye ?? 0) + (sp.barley ?? 0) + (sp.wheat ?? 0);

  // Drafting Loop: 1 card paid per bill taken.
  const DRAFT_PILE_CARD_COST = 1;

  return (
    plainCask +
    plainCorn +
    plainRye +
    plainBarley +
    plainWheat +
    wildGrain +
    specialtyTotal * SPECIALTY_UNIT_COST +
    DRAFT_PILE_CARD_COST
  );
}

// -----------------------------
// Investment Cards
// -----------------------------
// Wired up as a display-only catalog. Cards are minted into the market
// and rendered in the Investments row, but the engine does not resolve
// any of their effects yet — `implemented: false` on every entry.
// Source of truth lives at `packages/engine/content/investments.yaml`;
// keep this catalog in sync by hand until a build script lands.

/**
 * Cost band and roughly the round in which the card becomes affordable:
 *   small    cost 2-4   buyable round 2-3 from starter-deck proceeds
 *   medium   cost 5-8   workhorse tier; defines the rest of a strategy
 *   large    cost 9-15  late-game wagers; game-defining when they pay
 *
 * Tier is design intent — Brand Ambassador sits in `large` at cost 8
 * because its effect strength belongs there even though the price is
 * at the medium/large boundary.
 */
export type InvestmentTier = "small" | "medium" | "large";

/** Primary game system the card manipulates. */
export type InvestmentCategory =
  | "production"
  | "aging"
  | "sales"
  | "demand"
  | "market"
  | "slots"
  | "deck"
  | "info"
  | "endgame";

/** Discrete moment at which the effect fires. Cards may carry several. */
export type InvestmentTrigger =
  | "on_purchase"
  | "passive_permanent"
  | "on_sell"
  | "on_make"
  | "on_age"
  | "on_complete"
  | "on_complete_recipe"
  | "on_buy_market"
  | "turn_start"
  | "round_end"
  | "other_player_action"
  | "final_scoring";

/** Strategic axis the card amplifies. */
export type InvestmentArchetype =
  | "volume"
  | "patience"
  | "specialty"
  | "tempo"
  | "engine"
  | "flex";

export interface InvestmentCard {
  id: string;
  defId: string;
  name: string;
  /** Up-front market price (top-right corner chip). */
  cost: number;
  tier: InvestmentTier;
  category: InvestmentCategory;
  /** One or more discrete moments the effect fires at. */
  triggers: InvestmentTrigger[];
  archetype: InvestmentArchetype;
  /** True when the card has a per-round (or other) trigger cap. */
  rateLimited: boolean;
  /** Free-form scope for the rate cap, e.g. "1/round". */
  rateLimitScope?: string;
  /** Short tagline shown on the tile. ≤ ~7 words. */
  short: string;
  /** Player-facing rule text printed on the card face. */
  text: string;
  /** Strategic flavor / rationale shown in the inspect modal. */
  description: string;
  /** Whether the engine resolves the effect. False = display-only stub. */
  implemented: boolean;
}

/** Mash bills with `recipe.maxRye === 0` are "wheated" for distillery-bonus purposes. */
export function isWheatedBill(bill: MashBill): boolean {
  return bill.recipe?.maxRye === 0;
}

// -----------------------------
// Distilleries
// -----------------------------
//
// v3 starting roster: 7 asymmetric distilleries plus Vanilla. Each
// distillery is a full asymmetric package — starting state, permanent
// ability, and constraint — that shapes a player's whole game.
//
// Most v3 abilities are wired up but not yet resolved by the engine.
// The structural fields the engine already supports (slots, maxSlots,
// startingBarrel, starterPoolMods, saleMods, mashBillDraftSize,
// maxSlottedBills) are populated where they fit; novel abilities
// (re-roll one demand die, +2 first aging commit, demand+1 grid lookup,
// etc.) live in `cardText` / `description` until the engine grows
// dedicated hooks for them. The `implemented` flag tracks which
// distilleries are fully resolvable today.

export type DistilleryBonus =
  | "vanilla"
  | "high_rye_house"
  | "wheated_baron"
  | "connoisseur_estate";

/** v3 difficulty tier for the picker UI. */
export type DistilleryDifficulty =
  | "beginner"
  | "intermediate"
  | "intermediate-advanced"
  | "advanced";

/** Identifier for a basic starter mash bill (NOT in the Bourbon deck). */
export type StarterBillKey = "workhorse" | "high_rye_basic" | "wheated_basic";

export interface DistilleryStarterBarrel {
  /** Age in years (number of aging cards equivalent) at game start. */
  age: number;
  /** Which basic mash bill the pre-aged barrel ships with. */
  basicBillKey: StarterBillKey;
}

export interface DistilleryStarterPoolMods {
  /**
   * free Specialty Rye cards added to the dealt starter hand
   * (High-Rye House). Specialty Rye carries no uniform on-sale bonus
   * any more; it counts toward `minSpecialty.rye` gates. High-Rye
   * House's own distillery ability still adds +1 rep on every
   * rye-bill sale (independent of the band-wide bonus that was
   * retired with the four-band economy).
   */
  bonusSpecialtyRye?: number;
}

export interface DistillerySaleMods {
  /** +N reputation when selling a bill matching `kind`. */
  bonusRepOnBill?: { kind: "high_rye" | "wheated"; rep: number };
}

export interface Distillery {
  id: string;
  defId: string;
  name: string;
  /** Short tagline shown beneath the name on the picker tile. */
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
   * rep the player starts on their track. Each
   * distillery's stake compensates for its setup asymmetries — see
   * GAME_RULES.md §Distillery Profiles. Defaults to 5 (Vanilla).
   */
  startingRep?: number;
  /**
   * v2.6: cap on the number of slots that may hold a bill at once. When
   * set, this distillery cannot draw additional bills past the cap even
   * after buying a Rickhouse Expansion Permit — extra slots become
   * overflow space for transferred completed barrels (Barrel Broker,
   * Blend) but cannot receive a freshly-drawn bill.
   */
  maxSlottedBills?: number;
  // v3 metadata (display + design-doc reference) ------------------
  /** Player-facing rule text printed on the card face. */
  cardText: string;
  /** Flavor paragraph shown beneath the rules. */
  description: string;
  /** Designer-facing strategy note shown in the picker / inspect modal. */
  strategyNote?: string;
  /** v3 difficulty tier shown on the picker. */
  difficulty: DistilleryDifficulty;
  /** Free-form design axis (time/tempo, slots, demand, specialty, etc.). */
  axis: string;
  /**
   * Whether the engine resolves the distillery's ability + constraint
   * today. False = wire-up only; the picker still surfaces it but its
   * effects don't fire yet.
   */
  implemented: boolean;
}

// -----------------------------
// Operations Cards
// -----------------------------

export type OperationsCardDefId =
  | "market_manipulation"
  | "bourbon_boom"
  | "glut"
  | "demand_surge"
  | "rushed_shipment"
  | "regulatory_inspection"
  | "rating_boost"
  | "allocation"
  | "kentucky_connection"
  | "wild_mash";

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
 *     NOT age.
 *   - "construction" — bill + ≥1 committed card, recipe not yet
 *     satisfied. Barrel does NOT age. The committed cards are locked
 *     with the slot until the recipe finishes and the barrel sells.
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
// Lines (v3.0 — "The Line System")
// -----------------------------
//
// When a barrel sells, its bill flips into a Bottle that joins one of
// the player's lines. Each distillery is pre-bound to a flagship Line
// Board (one of four, see `lines/boards.ts`); players may also stack
// Line Cards onto the flagship or seed up to 2 secondary lines. Lines
// score on their own at the end of the game (see `lines/scoring.ts`).
//
// Predicates / bonuses / scoring rules are inline TS functions on the
// definitions in `lines/boards.ts` and `lines/cards.ts`, looked up
// from `lineBoardId` / `defId` at evaluation time.

export interface Bottle {
  /** Unique instance id. */
  bottleId: string;
  /** Source MashBill instance id. */
  originalBillId: string;
  /** Source MashBill catalog id (defId). */
  billDefId: string;
  name: string;
  /**
   * Derived once at sale time from recipe + cask cards. Treat as
   * immutable — predicates only read it. (Not declared `readonly`
   * because Immer's WritableDraft proxy can't satisfy a readonly
   * array.)
   */
  recipeTags: string[];
  /**
   * Primary recipe tag for Variety / Depth Line predicates. Derived
   * once at sale time — first of: high-rye, rye, wheated, barley,
   * pure-corn, triple-grain, neutral.
   */
  primaryRecipeTag: string;
  /**
   * Exactly one of: "common-cask" | "specialty-cask" | "heritage-cask".
   * Derived from the highest-grade cask card committed to the barrel.
   */
  caskTag: string;
  rarity: MashBillTier;
  ageAtSale: number;
  demandAtSale: number;
  placedOnRound: number;
}

/**
 * A Line Card instance held in hand or stacked onto a line. The
 * underlying card definition (predicate + bonus + scoring) lives in
 * `lines/cards.ts` keyed by `defId`.
 */
export interface LineCardInstance {
  instanceId: string;
  defId: string;
}

/**
 * Per-slot in-play state on a v3.1 Bourbon Line. A slot is empty until
 * a bottle is placed; rewards fire exactly once on the empty→filled
 * transition (tracked via `rewardFired`).
 */
export interface SlotState {
  filled: boolean;
  bottle: Bottle | null;
  rewardFired: boolean;
}

/**
 * A line on the table.
 *
 * v3.1 slotted shape (flagship only in phase 5): `slots` is populated
 * with 5 SlotState entries; bottles fill left-to-right gated by the
 * board's per-slot requirement + Line Restriction. `completionBonusTriggered`
 * latches true the moment the final slot fills.
 *
 * v3.0 legacy fields (`stackedCards`, `bottles`) are preserved for
 * client UI compatibility during the v3.1 engine refit:
 *   - `bottles` mirrors filled-slot bottles in slot order.
 *   - `stackedCards` is always `[]` on a v3.1 flagship (line cards no
 *     longer stack onto flagships).
 * Both fields will be removed in the v3.1 UI pass.
 *
 * Secondary lines remain Line-shaped with `slots` undefined and
 * `stackedCards` empty in phase 5 (secondary construction lands in
 * phase 7).
 */
export interface Line {
  id: string;
  /** Flagship lines reference a LineBoard; secondaries are null. */
  lineBoardId: string | null;
  /** Legacy v3.0 stack — always [] on a v3.1 flagship. */
  stackedCards: LineCardInstance[];
  /** Legacy v3.0 mirror of filled slot bottles, in slot order. */
  bottles: Bottle[];
  /**
   * v3.1 slot layout. Length 5 on a flagship that's been bound to a
   * FlagshipLineBoardDef; undefined on legacy / unbound lines.
   */
  slots?: SlotState[];
  /** v3.1 — set true the moment the final slot fills. Latching. */
  completionBonusTriggered?: boolean;
}

// -----------------------------
// Player
// -----------------------------

export interface PlayerState {
  id: string;
  name: string;
  /** AI-controlled? Defaults to false (human). */
  isBot?: boolean;
  /**
   * Bot AI skill knob. Read by `ai/bot.ts` to vary buy thresholds and
   * the Drafting Loop policy. Ignored for human seats; defaults to
   * `"normal"` when unset on a bot.
   */
  difficulty?: BotDifficulty;

  /** Distillery selected during setup. Null until SELECT_DISTILLERY resolves. */
  distillery: Distillery | null;
  /** Personal rickhouse slots. Built once distillery is selected. */
  rickhouseSlots: RickhouseSlot[];

  // Personal deck zones (resources, Labor, and bought ops/investments).
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
  /**
   * reputation is BOTH the victory-point track
   * AND the spending currency. Earned from sales, spent on purchases.
   * Must remain ≥ 0 at all times — purchase validation rejects a
   * spend that would push rep below zero (the Labor exemption for
   * cost-$1 cards leaves rep at 0, never negative).
   */
  reputation: number;
  handSize: number;                         // default 8
  barrelsSold: number;

  /**
   * Permanent prestige counter. Earned by triggering Gold awards on
   * sale (and, for Connoisseur Estate, Silver awards too). Each point
   * adds +1 reputation to every future Silver- or Gold-triggering
   * sale. Does NOT apply to base sales that hit no award.
   *
   * Prestige is monotonic — never decreases. No cap.
   */
  prestige: number;

  /**
   * Save slot — at cleanup, the player may set aside ONE card
   * from their hand into this slot. The saved card joins next round's
   * 8-card draw on top, so the player effectively draws 9 the round
   * after a Save. Holds at most one card; null when empty.
   */
  savedCard: Card | null;

  outForRound: boolean;                     // hand exhausted in current action phase

  // Per-round flags driven by ops cards / distillery bonuses.
  /** Set by Demand Surge — next sale this round does not drop demand. */
  demandSurgeActive: boolean;
  /**
   * Set by Insider Buyer — your next BUY_FROM_MARKET this turn pays
   * half the printed rep cost (rounded up, min 1 rep). Cleared after
   * one purchase or when your turn ends.
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
  /**
   * Set when the player plays Wild Mash this turn. Consumed by the
   * next MAKE_BOURBON action (one substitution, then cleared regardless
   * of whether it was used). Cleared on PASS_TURN too.
   */
  pendingWildMashToken?: boolean;
  /**
   * v2.9: each player rolls demand at the start of their own action
   * turn (instead of one global roll per round). This flag is set
   * when the cursor lands on the player and cleared by ROLL_DEMAND.
   * No other action is legal while it's true.
   */
  needsDemandRoll: boolean;
  /**
   * v2.9: after the demand roll, the player must commit one card to
   * aging before taking other actions — but only if they have any
   * aging barrel that hasn't already been aged this round. Set by
   * `applyRollDemand` and cleared by AGE_BOURBON. PASS_TURN and
   * PLAY_OPERATIONS_CARD remain free.
   */
  needsAgeBarrels: boolean;
  /**
   * v2.14: each player may initiate the Drafting Loop at most once
   * per round. Set by `INITIATE_DRAFTING_LOOP`, reset to false at
   * cleanup. Counts even when the loop produces nothing for the
   * initiator (e.g. all 3 revealed bills are illegal for them).
   */
  draftingLoopUsedThisRound: boolean;

  // ─── v3.0 Line system ────────────────────────────────────────
  /**
   * Flagship line, bound to the distillery's Line Board at setup.
   * Always present (lineBoardId set). Empty `bottles` and
   * `stackedCards` at game start.
   */
  flagshipLine: Line;
  /**
   * Up to 2 secondary lines, each created via PLACE_BOTTLE with
   * destination `new-secondary` (1+ Line Cards from hand).
   */
  secondaryLines: Line[];
  /** Line Card instances held privately. */
  lineCardHand: LineCardInstance[];
  /** Bottles not placed on any line. Scores 1 rep each at end game. */
  inventory: Bottle[];
  /**
   * v3.0: each player may DRAW_LINE_CARDS at most once per round.
   * Reset to false at cleanup.
   */
  hasDrawnLineCardsThisRound: boolean;
  /**
   * Set at game init — 4 Line Cards dealt face-up. Player must keep
   * exactly 2 via CHOOSE_INITIAL_LINE_CARDS before taking any
   * action-phase action. Cleared once resolved.
   */
  pendingInitialLineCardDraft: { cards: LineCardInstance[] } | null;
  /**
   * Set by DRAW_LINE_CARDS — up to 3 cards revealed. Player must
   * keep ≥1 via KEEP_LINE_CARDS before any other action.
   */
  pendingLineCardDraw: { cards: LineCardInstance[] } | null;
  /**
   * Set at the end of SELL_BOURBON — the new Bottle must be placed
   * via PLACE_BOTTLE before any other action. Blocks the active
   * player only.
   */
  pendingBottlePlacement: { bottle: Bottle } | null;

  // ─── v3.1 Bourbon Lines — persistent completion-bonus effects ───
  //
  // Each flag below latches when the flagship's Line Completion Bonus
  // fires. Read at the points the effect applies (sale resolution,
  // drafting loop reveal, end-game scoring). Never resets — the bonus
  // is permanent once earned.

  /**
   * Wheated Baron — Baron's Vintage Reserve completion.
   * Common-rarity bills sold by this player do not drop demand on sale.
   */
  commonSalesIgnoreDemandDrop: boolean;
  /**
   * High-Rye House — Master's Cut completion.
   * One-shot: the next Drafting Loop this player initiates reveals 5
   * bills instead of 3. Cleared after the loop consumes it.
   */
  draftingLoopReveals5Next: boolean;
  /**
   * Connoisseur Estate — Curator's Choice completion.
   * End-game prestige scoring doubles (2 rep per prestige, not 1) on
   * this player's score breakdown.
   */
  prestigeScoringDoubled: boolean;
  /**
   * Vanilla Distillery — Standard Master completion.
   * Each inventory bottle scores +5 rep on top of the baseline +1.
   * Stacks with the inventory baseline at end-game.
   */
  inventoryBottleBonusActive: boolean;
}

// -----------------------------
// Drafting Loop
// -----------------------------

/**
 * Per-picker stage inside the loop:
 *   - "card" — picker may take any cards from the pile, then take
 *     bills. TAKE_CARD is legal here.
 *   - "bill" — picker has either taken a bill (which advanced past
 *     the card-take window) or is the initiator (who never gets to
 *     scavenge cards — they don't take their own initial card back).
 *     TAKE_CARD is illegal here; only TAKE_BILL or PASS.
 *
 * The spec's "in this order" — cards first, then bills — is enforced
 * by this two-stage flow.
 */
export type DraftingLoopPickerStage = "card" | "bill";

/**
 * Active state of the Drafting Loop sub-phase. Created by
 * `INITIATE_DRAFTING_LOOP`, torn down when the pile returns to the
 * initiator after every other picker has passed.
 */
export interface DraftingLoopState {
  /**
   * Player who initiated the loop. Their action-phase turn remains in
   * progress; the loop just rotates the active picker around the table.
   */
  initiatorId: string;
  /**
   * Pick order, starting at the initiator and walking clockwise. Length
   * equals the player count. Initiator at index 0; loop closes when the
   * cursor walks past the last index.
   */
  pickOrder: string[];
  /** Index into `pickOrder` pointing at the current picker. */
  pickerIndex: number;
  /** What the current picker is allowed to do next. See above. */
  pickerStage: DraftingLoopPickerStage;
  /**
   * Cards face-up on the table. Order = placement order (initiator's
   * initial card at index 0). Subsequent pickers may take any of these
   * before placing their own.
   */
  draftPile: Card[];
  /**
   * Mash bills revealed at the top of the loop. Up to 3 at start;
   * shrinks as pickers claim bills. Leftovers shuffle back into
   * `bourbonDeck` when the loop closes.
   */
  revealedBills: MashBill[];
}

// -----------------------------
// Game State
// -----------------------------

export type GamePhase =
  | "setup"
  | "distillery_selection"
  | "starter_deck_draft"
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

  /**
   * The unified market — 10 face-up slots holding a mix of resource,
   * Labor, operations, and investment cards. Mash bills live in
   * `bourbonDeck` (separate face-down deck, surfaced only via the
   * Drafting Loop).
   */
  market: Card[];
  /** Face-down supply that backs the unified market. Mixed types. */
  marketSupplyDeck: Card[];
  /** Cycled-out market cards. Reshuffled back when supply runs short. */
  marketDiscard: Card[];

  bourbonDeck: MashBill[];
  bourbonDiscard: MashBill[];
  /**
   * Bills retired by Gold awards. Removed from circulation entirely
   * — they will not return to the bourbon deck or discard. Tracked
   * here so the UI can show a graveyard of past Gold sales.
   */
  retiredBills: MashBill[];
  /**
   * Active Drafting Loop sub-phase, if any. While non-null, the only
   * legal actions are `DRAFT_TAKE_BILL`, `DRAFT_TAKE_CARD`, and
   * `DRAFT_PASS`, routed to `draftingLoop.pickOrder[pickerIndex]`
   * (which may not equal `currentPlayerIndex` — the initiator's turn
   * is still in progress; the loop just rotates the active picker).
   */
  draftingLoop: DraftingLoopState | null;

  demand: number;                           // 0..12
  demandRolls: { round: number; roll: [number, number]; result: "rise" | "hold" }[];

  finalRoundTriggered: boolean;
  finalRoundTriggerPlayerIndex: number | null;

  /** Players who have completed the current phase (e.g. drew their hand). Reset on phase transition. */
  playerIdsCompletedPhase: string[];

  /** Monotonic counter for IDs of entities created mid-game (e.g. barrels). */
  idCounter: number;

  /**
   * v3.0: shared Line Card supply. Convention matches `bourbonDeck` —
   * top of deck = end of array; "bottom" (where KEEP_LINE_CARDS
   * returns rejected cards) = front of array.
   */
  lineCardDeck: LineCardInstance[];

  actionHistory: GameAction[];
}

// -----------------------------
// Game Config (for initializeGame)
// -----------------------------

/**
 * Bot AI skill knob. Drives the per-action heuristic in `ai/bot.ts` —
 * EV thresholds, reputation floors, and the Drafting Loop policy. Human
 * seats leave this unset.
 */
export type BotDifficulty = "easy" | "normal" | "hard";

export interface GameConfig {
  seed: number;
  players: { id: string; name: string; isBot?: boolean; difficulty?: BotDifficulty }[];
  /** Pre-built starter decks per player (alternative to running the draft). */
  starterDecks?: Card[][];
  /** Pre-drafted mash bills per player (alternative to running the draft). */
  startingMashBills?: MashBill[][];
  /** Mash bills remaining in the bourbon deck after the draft. */
  bourbonDeck?: MashBill[];
  /** Cards that populate the market supply (top 10 deal face-up). */
  marketSupply?: Card[];
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
  difficulty?: BotDifficulty;
}

/**
 * v2.10: per-game settings exposed in the New Game form. Each field is
 * optional with a default that matches the "Normal" preset. The client
 * uses the preset enum to drive the UI; the engine only ever sees the
 * resolved values.
 */
export interface NewGameSettings {
  /**
   * Total mash bills shipped in the bourbon deck. Lower = shorter
   * game (the deck runs out faster, triggering the doomsday clock).
   * The catalog currently ships 21 bills.
   */
  mashBillCount?: number;
  /**
   * Turn distillery selection on/off. When false, every seat is
   * pre-assigned Vanilla and the `distillery_selection` phase is
   * skipped entirely. Default true.
   */
  distilleries?: boolean;
  /**
   * Mint investment cards into the market. The engine doesn't fully
   * resolve investment effects yet; this flag is wired for forward
   * compatibility. Default false.
   */
  investments?: boolean;
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
  /** Per-game settings from the New Game form. Defaults applied when omitted. */
  settings?: NewGameSettings;
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
  | { defId: "demand_surge" }
  | { defId: "rushed_shipment"; targetBarrelId: string }
  | { defId: "regulatory_inspection"; targetBarrelId: string }
  | { defId: "rating_boost" }
  | { defId: "allocation" }
  | { defId: "kentucky_connection" }
  | { defId: "wild_mash" };

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
  | { type: "ROLL_DEMAND"; playerId: string; roll: [number, number] }
  | { type: "DRAW_HAND"; playerId: string }
  | {
      // v2.6 slot-bound bills: commits ≥1 card from the player's hand
      // to an existing slot that already holds a bill (placed at setup
      // or acquired via the Drafting Loop / Allocation). The barrel
      // auto-transitions from "ready" → "construction" → "aging" as
      // cards accumulate. Bills are already attached when MAKE_BOURBON
      // dispatches.
      type: "MAKE_BOURBON";
      playerId: string;
      slotId: string;
      cardIds: string[];
      /**
       * Wild Mash one-shot role swap. When set, the named card in
       * `cardIds` is treated as the given role for recipe
       * satisfaction (a cask as a grain unit, or a grain as a cask).
       * Requires `pendingWildMashToken` to be set on the player.
       */
      wildMashSwap?: { cardId: string; treatAs: "cask" | "grain" };
    }
  | { type: "AGE_BOURBON"; playerId: string; barrelId: string; cardId: string }
  | {
      // Sale is single-step. Grid value + bonuses are auto-clamped to
      // the tier floor (3/4/5) and added to the player's rep track.
      // Prestige (+1 per point) is added on top whenever Silver or
      // Gold triggers. Bill destination: discard (Silver / none) or
      // retired (Gold).
      type: "SELL_BOURBON";
      playerId: string;
      barrelId: string;
    }
  | {
      // Pay rep + Labor cards. `rep` is the reputation portion of the
      // payment; `laborCardIds` are Labor cards from hand whose
      // contributions (Generic = 1, Specialty Cooper = 2 toward market
      // resources) sum with rep to ≥ cost. Rep and Labor are fully
      // fungible — any cost can be paid in rep, Labor, or a mix.
      type: "BUY_FROM_MARKET";
      playerId: string;
      marketSlotIndex: number;
      rep: number;
      laborCardIds: string[];
    }
  | {
      // Same payment shape as BUY_FROM_MARKET, but the target must be
      // an operations-typed card in the unified market. Marketing
      // Labor (+2 toward ops) is the matching specialty.
      type: "BUY_OPERATIONS_CARD";
      playerId: string;
      /** Index into the unified 10-slot market (0..9). */
      marketSlotIndex: number;
      rep: number;
      laborCardIds: string[];
    }
  | {
      // v2.14 Drafting Loop — entry point. The active player places one
      // card from their hand face-up on the table to start the draft
      // pile and reveals the top 3 mash bills from the bourbon deck.
      // Once per round per player; illegal in the final round.
      type: "INITIATE_DRAFTING_LOOP";
      playerId: string;
      /** Card from hand placed face-up as the seed of the draft pile. */
      cardId: string;
    }
  | {
      // v2.14 Drafting Loop — current picker claims one of the
      // revealed bills, adding one card from hand to the draft pile
      // as payment. Bill lands in an Open slot as Staged. Capped by
      // Open slot count and distillery constraints (High-Rye House
      // cannot take a wheated bill; Connoisseur Estate respects its
      // 4-bill cap). Cards in the Save slot are NOT eligible payment.
      type: "DRAFT_TAKE_BILL";
      playerId: string;
      /** Bill from `state.draftingLoop.revealedBills` to take. */
      mashBillId: string;
      /** Card from hand placed into the draft pile in exchange. */
      paymentCardId: string;
    }
  | {
      // v2.14 Drafting Loop — current picker scavenges one or more
      // cards from the draft pile into their hand (free). Subsequent
      // pickers only; the initiator never gets to take their own
      // initial card back. Must be the picker's first action of the
      // turn — once they take a bill, card-taking is closed for them.
      type: "DRAFT_TAKE_CARD";
      playerId: string;
      /** Cards from `state.draftingLoop.draftPile` to pick up. */
      cardIds: string[];
    }
  | {
      // v2.14 Drafting Loop — current picker passes the pile to the
      // player on their left. When the pile returns to the initiator
      // the loop closes: leftover bills shuffle into the bourbon
      // deck, leftover cards go to the market discard.
      type: "DRAFT_PASS";
      playerId: string;
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
  | {
      // At cleanup, set aside one card from your hand into the Save
      // slot. Saved card joins next round's draw on top of the 8-card
      // deal. Only one card may be saved at a time.
      type: "SAVE_CARD";
      playerId: string;
      cardId: string;
    }
  | { type: "PASS_TURN"; playerId: string }
  | {
      // v3.0 Line system — resolve the 4-card initial draft dealt at
      // game init. Keep exactly 2; the other 2 return to the bottom
      // of the lineCardDeck in the order given.
      type: "CHOOSE_INITIAL_LINE_CARDS";
      playerId: string;
      keepInstanceIds: string[];
    }
  | {
      // v3.0 Line system — reveal up to 3 Line Cards from the deck
      // into `pendingLineCardDraw`. Once per round. Free action.
      type: "DRAW_LINE_CARDS";
      playerId: string;
    }
  | {
      // v3.0 Line system — resolve a pending draw by keeping ≥1
      // revealed card. The rest return to the bottom of the deck.
      type: "KEEP_LINE_CARDS";
      playerId: string;
      keepInstanceIds: string[];
    }
  | {
      // v3.0 Line system — RETIRED in v3.1. validateExtendLine returns
      // illegal; replaced by PLAY_LINE_CARD which adds positioned slots
      // to secondary lines.
      type: "EXTEND_LINE";
      playerId: string;
      targetLineId: string;
      lineCardInstanceId: string;
    }
  | {
      // v3.1 Bourbon Lines — play a Line Card from hand to either
      // open a new secondary line (slot-1 cards only; cap of 2
      // secondaries) or extend an existing secondary by adding its
      // next-open slot position. Slot-position 3 cannot be played
      // until the secondary already has slots 1 and 2; etc. Free
      // action during the action phase.
      type: "PLAY_LINE_CARD";
      playerId: string;
      lineCardInstanceId: string;
      /**
       * `null` to open a new secondary. Otherwise the secondary's
       * line id to extend.
       */
      targetLineId: string | null;
    }
  | {
      // v3.0 Line system — resolve the pending bottle placement set
      // by the immediately preceding SELL_BOURBON. The placement
      // choice determines which line (if any) receives the bottle
      // and fires placement bonuses.
      type: "PLACE_BOTTLE";
      playerId: string;
      destination:
        | { kind: "flagship" }
        | { kind: "secondary"; lineId: string }
        | { kind: "new-secondary"; lineCardInstanceIds: string[] }
        | { kind: "inventory" };
    };

// -----------------------------
// Engine API
// -----------------------------

export interface ValidationResult {
  legal: boolean;
  reason?: string;
}

export interface ScoreResult {
  playerId: string;
  /** Banked reputation at game end (existing). */
  reputation: number;
  deckSize: number;          // hand + deck + discard (smaller wins tiebreak)
  barrelsSold: number;
  /**
   * v3.0 Line system — end-game score contribution from the
   * flagship line (Line Board + stacked Line Cards). May be negative
   * when stacked cards sit on an empty flagship (−2 per card).
   */
  flagshipScore: number;
  /** v3.0 — per-secondary-line score. Length 0..2. */
  secondaryScores: number[];
  /** v3.0 — 1 rep per bottle placed in inventory. */
  inventoryScore: number;
  /**
   * v3.0 — total score used for ranking. Equals
   * reputation + flagshipScore + Σ secondaryScores + inventoryScore.
   */
  total: number;
  rank: number;              // 1-based; ties share rank
}

export interface GameEngine {
  initializeGame(config: GameConfig): GameState;
  validateAction(state: GameState, action: GameAction): ValidationResult;
  applyAction(state: GameState, action: GameAction): GameState;
  isGameOver(state: GameState): boolean;
  computeFinalScores(state: GameState): ScoreResult[];
}
