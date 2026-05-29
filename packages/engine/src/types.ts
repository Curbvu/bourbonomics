// ============================================================
// Bourbonomics 2.0 — Engine Types
// ============================================================
// Refer to docs/GAME_RULES.md for the canonical ruleset and
// docs/IMPLEMENTATION_GUIDE.md for the architectural intent.

import type { Draft } from "immer";

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
  /**
   * v3.2 — upper bound on corn commitment. When omitted, defaults to
   * the effective minCorn (so existing bills behave as exact-corn
   * recipes, preserving v3.1 semantics). When set explicitly above
   * minCorn, players may commit any corn count within the range —
   * the actual count is recorded on the Bottle and feeds the strength
   * axis on Brand Portfolio slot requirements.
   */
  maxCorn?: number;
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

/**
 * v3.4 — Bill / Bottle tag taxonomy.
 *
 * Tags are printed icons on a bill (and inherited by the Bottle it
 * mints). Slot requirements, Brand Restrictions, and Mastery
 * Conditions reference these by string key.
 *
 * Derivation lives in `src/tags.ts` and runs once per bill at the
 * catalog edge (defaults.ts mints bills wired through deriveBillTags).
 *
 * Categories — see GAME_RULES.md §Tags for the canonical list:
 *   - Grain     : `rye`, `wheat`, `barley`
 *   - Strength  : `corn-heavy` (maxCorn ≥ 4) | `corn-light` (maxCorn ≤ 2)
 *   - Profile   : `rye-heavy`, `wheated`, `single-grain`, `triple-grain`
 *   - Quality   : `specialty`, `heritage`, `heritage-recipe`
 *   - Awards    : `silver-eligible`, `gold-eligible`
 *
 * Bills carry every applicable tag; if more than 7 apply, the
 * ceiling drop rules in `src/tags.ts` trim them in priority order
 * before display. The full set is preserved on the data model — the
 * 7-icon cap only affects rendering on the card face.
 */
export type BillTag =
  | "rye" | "wheat" | "barley"
  | "corn-heavy" | "corn-light"
  | "rye-heavy" | "wheated" | "single-grain" | "triple-grain"
  | "specialty" | "heritage" | "heritage-recipe"
  | "silver-eligible" | "gold-eligible";

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
  /**
   * v3.4 — Optional explicit primary-grain tag breaker. When two
   * grains tie for highest count (e.g., 2 rye + 2 wheat), this field
   * decides which of `rye-heavy` / `wheated` (if any) gets emitted.
   * When omitted, derivation falls back to highest count and emits
   * neither tag on a tie — bills with no resolution typically pick
   * up `triple-grain` instead.
   */
  primaryGrain?: "rye" | "wheat" | "barley";
  /**
   * v3.4 — Statically-derived tag set. Built once per bill (catalog
   * edge); slot requirements, Brand Restrictions, and Mastery
   * Conditions read from here. The Bottle inherits this verbatim on
   * sale (see `Bottle.tags`). Always defined — empty array means no
   * tags applied.
   */
  tags: BillTag[];
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
 * v3.3 — Final score is the sum of banked Capital (the spendable
 * currency held at game end) and earned Reputation (the end-game
 * portfolio score). Banked Capital converts 1:1, so anything the
 * player didn't spend during play still counts.
 *
 * Tiebreakers (most barrels sold, then shared victory) live in
 * `computeFinalScores` — this helper returns only the numeric total.
 */
export function getFinalScore(player: Pick<PlayerState, "capital" | "reputation">): number {
  return player.capital + player.reputation;
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
  | "connoisseur_estate"
  // v3.4 — Beginner / human-only pick. No ability, no constraint;
  // ships 2 pre-drafted Tier-1 bills as Staged. Bot picker filters
  // this out via `botPickable: false` on the catalog entry.
  | "standard";

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
  /**
   * v3.4 — Extra Generic Labor cards added to the dealt starter hand.
   * High-Rye House gets +1 Generic Labor as a safety valve for its
   * 3-Capital opening; other distilleries omit the field.
   */
  bonusGenericLabor?: number;
  /**
   * v3.4 — Engine pre-drafts this many random bills from the bourbon
   * deck at setup and slots them Staged. Used by Standard Distillery
   * (2 Tier-1 bills) and Connoisseur Estate (4 bills, any tier).
   * Optional `preDraftedBillsTier` filters the pool to that
   * `complexityTier` only.
   */
  preDraftedBills?: number;
  preDraftedBillsTier?: MashBillComplexityTier;
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
   * v3.3 — Starting Capital the player begins with on their Capital
   * track. Each distillery's stake compensates for its setup
   * asymmetries — see GAME_RULES.md §Distillery Profiles. Defaults
   * to 5 (Vanilla). Renamed from `startingRep` in v3.3.
   */
  startingCapital?: number;
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
  /**
   * v3.4 — Whether the bot distillery picker may select this entry.
   * Standard Distillery sets `false` so it remains a human-only
   * beginner pick. Defaults to `true` (omitted on the existing four).
   */
  botPickable?: boolean;
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
  /**
   * v3.2 — actual corn count committed at production. Equals
   * recipe.minCorn for bills with no corn range; equals the player's
   * chosen amount for bills with `minCorn < maxCorn`. Read by Brand
   * Portfolio slot requirements gating on the strength axis.
   */
  cornCount: number;
  placedOnRound: number;
  /**
   * v3.4 — Tag set inherited verbatim from the source bill at sale
   * time. Slot requirements / Brand Restrictions / Mastery
   * predicates read this. Distinct from the legacy `recipeTags` /
   * `primaryRecipeTag` / `caskTag` fields above, which remain in
   * place to satisfy v3.2 / v3.3 portfolio predicates during the
   * gradual v3.4 migration.
   */
  tags: BillTag[];
}

/**
 * @deprecated v3.1 Line Card instance. The Line Card subsystem is
 * removed in v3.2. This stub type is retained transiently so legacy
 * action-union references continue to compile.
 */
export interface LineCardInstance {
  instanceId: string;
  defId: string;
}

// ─── v3.2 Brand Portfolios — in-play slot/portfolio state ──────

/**
 * Per-slot in-play state on a v3.2 Brand Portfolio. A slot is empty
 * until a bottle lands; on transition empty → filled the slot's
 * `onFillReward` fires exactly once (latched via `rewardFired`). If
 * the bottle's source bill matches the slot's `signatureBillDefId`,
 * `signatureMatched` latches true and the Signature Bonus also fires.
 */
export interface SlotState {
  index: number;
  filled: boolean;
  bottle: Bottle | null;
  rewardFired: boolean;
  signatureMatched: boolean;
}

/**
 * The runtime instance of a Brand Portfolio in front of a player.
 * Carries the portfolio's design-time identity (`portfolioId` →
 * portfolio catalog lookup) and the per-slot fill state.
 */
export interface PortfolioState {
  /** References Portfolio.id in the portfolio catalog. */
  portfolioId: string;
  /** One SlotState per slot in the bound Portfolio.slots; same order. */
  slots: SlotState[];
  /**
   * Latches true the moment the Completion tier is reached
   * (all required slots filled). Used by UI to celebrate.
   */
  completionReached: boolean;
}

/**
 * @deprecated v3.1 Line shape. The v3.2 Brand Portfolio replaces it.
 * Kept as an inert stub interface only so any remaining mid-flight
 * client UI references compile. New code should use PortfolioState.
 */
export interface Line {
  id: string;
  lineBoardId: string | null;
  stackedCards: LineCardInstance[];
  bottles: Bottle[];
  slots?: SlotState[];
  completionBonusTriggered?: boolean;
}

// ─── v3.2 Brand Portfolio — design-time types ──────────────────
//
// A Brand Portfolio is a fixed product-line board: 3–6 named slots
// grouped into Tiers, a soft Brand Restriction (evaluated only at
// end-game Theme scoring), and a strict Mastery Condition (evaluated
// at end-game Mastery scoring). Required slots gate progression
// left-to-right; optional slots fill in any order within their
// unlocked tier. A tier unlocks the moment its first required slot
// fills. Each slot fires a non-rep on-fill reward (and a Signature
// Bonus if filled with its named signature bill).

/**
 * Placement gate on a single portfolio slot. Pure predicate over the
 * bottle + portfolio context. `label` is rule text the UI surfaces.
 */
export interface PortfolioSlotRequirement {
  label: string;
  check: (args: {
    bottle: Bottle;
    portfolio: PortfolioState;
    slotIndex: number;
    player: PlayerState;
  }) => boolean;
}

/**
 * Soft thematic guideline applied at end-game Theme scoring. Does
 * NOT gate placement — bottles can sit on slots they satisfy
 * regardless of whether they satisfy the Brand Restriction.
 */
export interface BrandRestriction {
  label: string;
  check: (args: {
    bottle: Bottle;
    portfolio: PortfolioState;
    player: PlayerState;
  }) => boolean;
}

/**
 * Strict purity condition applied at end-game Mastery scoring.
 * Tighter than the Brand Restriction.
 */
export interface MasteryCondition {
  label: string;
  check: (args: {
    bottle: Bottle;
    portfolio: PortfolioState;
    player: PlayerState;
  }) => boolean;
}

/**
 * Effect fired when a slot transitions empty → filled (or when a
 * matched signature bonus fires alongside). Mutates the Immer draft
 * directly per the engine's apply convention. On-fill rewards are
 * NEVER mid-game rep — mid-game rep is the sale reward.
 */
export interface PortfolioSlotReward {
  label: string;
  fire: (args: {
    bottle: Bottle;
    portfolio: PortfolioState;
    slotIndex: number;
    draft: Draft<GameState>;
    player: Draft<PlayerState>;
  }) => void;
}

/**
 * One slot's design data on a Portfolio.
 */
export interface PortfolioSlotDef {
  /** 0-based index; matches PortfolioState.slots[index]. */
  index: number;
  name: string;
  /**
   * Required slots gate progression left-to-right; optional slots
   * fill in any order within their unlocked tier. The UI prints
   * required slots with a solid outline, optional with dotted.
   */
  required: boolean;
  /** Which tier (index into Portfolio.tiers) this slot belongs to. */
  tierIndex: number;
  requirement: PortfolioSlotRequirement;
  /** Bill defId — filling this slot with a bottle from that bill fires the signature bonus. */
  signatureBillDefId: string | null;
  onFillReward: PortfolioSlotReward;
  /** Optional extra reward fired alongside on-fill when signature matched. */
  signatureBonus: PortfolioSlotReward | null;
  endGameValue: number;
}

/** Tier grouping inside a portfolio. */
export interface TierDef {
  index: number;
  /** Slot indices belonging to this tier (any order). */
  slotIndices: number[];
}

/**
 * A complete Brand Portfolio definition. Pre-claimed at setup
 * (flagships, bound to a distillery) or drafted mid-game from the
 * shared face-up pool (secondaries).
 */
export interface Portfolio {
  id: string;
  name: string;
  flavorText?: string;
  /** Bound to a distillery for flagships; null for secondary pool. */
  distilleryBonus: DistilleryBonus | null;
  /** Null when the portfolio has no overarching restriction (e.g., Vanilla). */
  brandRestriction: BrandRestriction | null;
  masteryCondition: MasteryCondition;
  /** 3–6 slots, indices 0..N-1. */
  slots: PortfolioSlotDef[];
  tiers: TierDef[];
  completionBonus: number;
  themeBonus: number;
  masteryBonus: number;
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
   * v3.3 — Capital is the in-game spendable currency. Earned from
   * sales (grid value clamped to tier floor), spent on market /
   * operations / investment purchases. Must remain ≥ 0 at all times —
   * purchase validation rejects a spend that would push Capital
   * below zero (the Labor exemption for cost-$1 cards leaves Capital
   * at 0, never negative). Banked Capital still counts toward final
   * score (1 Capital = 1 Reputation at end-game) — see
   * `getFinalScore`. Renamed from `reputation` in v3.3.
   */
  capital: number;
  /**
   * v3.3 — Reputation is the end-game-only score accumulator.
   * Accrues whenever a Brand Portfolio event fires: filled slot
   * end-game values, Signature Bonuses, and Completion / Theme /
   * Mastery tier bonuses. The second-portfolio failure penalty
   * (−2 per unfilled required slot, cap −10) also deducts here at
   * end-game scoring. Has no floor or ceiling — may go negative for
   * a player who drafts and abandons a second portfolio.
   *
   * Mid-game spending NEVER reads or writes this field — Capital is
   * the only spendable wallet. Final score = `capital + reputation`.
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
   * v3.5 — Warehouse slot. Engages only after the player buys the
   * Warehouse investment card; until then this stays null and any
   * SET_WAREHOUSE attempt is invalid. While `warehouseUnlocked` is
   * true, the slot holds at most one card; the stored card persists
   * across End Turn (the v3.9 discard-and-redraw) and round
   * cleanup, and the player can pull it back to hand at any time.
   *
   * Replaces the v3.4 free Save Slot — every player previously had
   * one regardless of distillery / investments. v3.5 removes that
   * default; the Warehouse investment is now the only persistent-
   * card-storage option.
   */
  warehouseSlot: Card | null;
  /**
   * v3.5 — True once the player has purchased the Warehouse
   * investment. Drives both the Warehouse slot's activation AND the
   * client UI's visibility. Effects are `implemented: false` in the
   * v3.5 catalog, so this flag is dormant until the v3.6 wave wires
   * effect resolution.
   */
  warehouseUnlocked: boolean;
  /**
   * v3.5 — Investment cards the player has bought. Bought
   * investments transfer directly here at BUY_FROM_MARKET apply
   * (they never sit in `hand`); their on-purchase effects fire
   * immediately and any passive_permanent triggers stay registered
   * for the rest of the game. Engine resolution is deferred — every
   * v3.5 catalog entry is `implemented: false`; this field is the
   * storage shape the v3.6 wave reads against.
   */
  investments: InvestmentCard[];

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
  /**
   * v3.4 — Vanilla Distillery first-sale-of-round flag.
   *
   * Set true at cleanup; cleared on the player's first SELL_BOURBON
   * of the round. While true AND the player's distillery is Vanilla,
   * sale resolution adds +1 to the grid value BEFORE the tier-floor
   * clamp. Non-Vanilla players still carry the flag but it has no
   * effect (the sale handler gates on distillery bonus).
   *
   * The clamp ordering matters: a Tier-1 bill grid-paying 2 → 3
   * before the +1 = 3 (no change, floor binds). A Tier-1 bill
   * grid-paying 4 → 5 (real bump, floor doesn't bind).
   */
  firstSaleOfRoundPending: boolean;

  // ─── v3.2 Brand Portfolios ──────────────────────────────────

  /**
   * Flagship portfolio — bound to the player's distillery at setup.
   * Always present once the distillery is selected. The bound
   * Portfolio definition (slots, requirements, bonuses) lives in the
   * portfolio catalog (`lines/boards.ts`).
   */
  flagshipPortfolio: PortfolioState;
  /**
   * Optional second portfolio — drafted mid-game via
   * DRAFT_SECOND_PORTFOLIO at a 1 Generic Labor cost. Null until
   * drafted; once drafted, stays for the rest of the game.
   */
  secondPortfolio: PortfolioState | null;
  /**
   * Latches true the moment the player drafts a second portfolio.
   * Read by end-game scoring to apply the failure penalty (-2 per
   * unfilled required slot, cap -10) if Completion isn't reached.
   */
  secondPortfolioDrafted: boolean;
  /** Bottles not placed on any portfolio slot. Scores ZERO at end of game in v3.2. */
  inventory: Bottle[];
  /**
   * Set at the end of SELL_BOURBON — the new Bottle must be placed
   * via PLACE_BOTTLE before any other action. Blocks the active
   * player only.
   */
  pendingBottlePlacement: { bottle: Bottle } | null;

  // ─── @deprecated v3.1 holdovers retained transiently ───
  /** @deprecated v3.1 — use flagshipPortfolio. Empty Line stub. */
  flagshipLine: Line;
  /** @deprecated v3.1 — use secondPortfolio. Always empty array. */
  secondaryLines: Line[];

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
   * top of deck = end of array. v3.2: always empty; the field is
   * retained transiently for save-file compatibility while the
   * Brand Portfolio drafting pool replaces it.
   */
  lineCardDeck: LineCardInstance[];

  /**
   * v3.2 — Brand Portfolio second-portfolio draft pool. Holds the
   * portfolio defIds available face-up next to the play area; once
   * drafted via DRAFT_SECOND_PORTFOLIO, the id is removed. No
   * refill — the pool shrinks for the rest of the game.
   *
   * Sized to (player count + 2) at setup; drawn from the supply
   * deck below.
   */
  secondPortfolioDraftPool: string[];
  /**
   * Face-down remainder of secondary-pool portfolios not currently
   * displayed face-up. Unused in the base game (no in-game refill),
   * reserved for expansions that might add portfolios mid-supply.
   */
  secondPortfolioSupply: string[];

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
  | { type: "PASS_TURN"; playerId: string }
  | {
      // v3.0 Line system — resolve the pending bottle placement set
      // by the immediately preceding SELL_BOURBON. The placement
      // choice determines which line (if any) receives the bottle
      // and fires placement bonuses.
      type: "PLACE_BOTTLE";
      playerId: string;
      destination:
        | {
            // v3.2 — place onto a specific slot of the player's
            // flagship portfolio. Required slots must be the
            // next-open one (left-to-right); optional slots must
            // belong to a tier that has unlocked.
            kind: "flagship";
            slotIndex: number;
          }
        | {
            // v3.2 — place onto a specific slot of the player's
            // drafted second portfolio (must exist).
            kind: "second";
            slotIndex: number;
          }
        | { kind: "inventory" }
        // v3.1 holdovers — validators reject; retained transiently
        // so any pre-v3.2 transcript replays produce a clean error.
        | { kind: "secondary"; lineId: string }
        | { kind: "new-secondary"; lineCardInstanceIds: string[] };
    }
  | {
      // v3.2 — retrieve one Bottle from inventory and place it on an
      // eligible portfolio slot. Free action; costs 1 Generic Labor
      // (auto-selected from hand). Unlimited per turn (bounded by
      // available Labor + eligible slots).
      type: "RETRIEVE_BOTTLE";
      playerId: string;
      bottleId: string;
      destination:
        | { kind: "flagship"; slotIndex: number }
        | { kind: "second"; slotIndex: number };
      /**
       * Which Generic Labor card to spend (must be a Labor card in
       * the player's hand with subtype "generic"). The engine
       * verifies and routes it to discard.
       */
      laborCardId: string;
    }
  | {
      // v3.2 — claim one of the face-up second-portfolio boards.
      // Free action, once per game per player, illegal in the
      // final round. Spends 1 Generic Labor from hand.
      type: "DRAFT_SECOND_PORTFOLIO";
      playerId: string;
      portfolioId: string;
      laborCardId: string;
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
  /**
   * v3.3 — Banked Capital at game end. The in-game spendable
   * currency the player still holds when the bourbon supply runs
   * out. Counts 1:1 toward `total`.
   */
  capital: number;
  /**
   * v3.3 — Earned Reputation at game end. End-game-only score
   * accumulated from Brand Portfolio events (filled slot end-game
   * values, Signature Bonuses, Completion / Theme / Mastery tier
   * bonuses) MINUS the second-portfolio failure penalty (−2 per
   * unfilled required slot, cap −10) if applicable. May be negative.
   */
  reputation: number;
  deckSize: number;          // hand + deck + discard (smaller wins tiebreak)
  barrelsSold: number;
  /**
   * @deprecated v3.0 Line system — end-game score contribution from
   * the flagship line. v3.2 replaced lines with Brand Portfolios;
   * v3.3 routes portfolio contributions into `reputation` directly.
   * Always 0 under v3.3. Kept on the shape for transient
   * backwards-compat with any UI still reading it.
   */
  flagshipScore: number;
  /** @deprecated v3.0 — per-secondary-line score. Always [] under v3.3. */
  secondaryScores: number[];
  /** @deprecated v3.0 — inventory bottle score. Always 0 under v3.2+. */
  inventoryScore: number;
  /**
   * v3.3 — total score used for ranking. Equals `capital + reputation`.
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
