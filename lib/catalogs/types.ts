// Types shared by the generated catalogs.
// Kept in a hand-authored file so the generated .ts files only emit data.

export type BourbonRarity = "Standard" | "Rare";

/**
 * WoW-style visual / scoring tier for a bourbon card. Distinct from
 * `rarity` (which is just a deck-distribution flag — Standard prints
 * 2 copies, Rare prints 1). Tier drives the card chrome:
 *
 *   common     — white,  plain. The workhorse bills.
 *   uncommon   — green,  modest accent + mild glow.
 *   rare       — blue,   chrome + glow + soft pulse.
 *   epic       — purple, strong border + ring + animated shimmer.
 *   legendary  — orange, full bling: bright glow + shimmer + halo.
 *
 * Auto-derived in the catalog generator from grid max + awards when
 * the YAML doesn't set an explicit `tier`. Authors override only when
 * the algorithm picks something off — see scripts/build-catalogs.ts.
 */
export type BourbonTier =
  | "common"
  | "uncommon"
  | "rare"
  | "epic"
  | "legendary";

export type BourbonAwards = {
  silver?: string | null;
  gold?: string | null;
} | null;

/**
 * Per-resource min/max constraint for a mash bill recipe. Either bound is
 * optional. `min: 0` is the default (no requirement); `max: 0` means the
 * grain is forbidden by the recipe (e.g. a wheated bill excluding rye).
 */
export type MashRecipeBound = { min?: number; max?: number };

/**
 * Optional bill-specific mash recipe. Layered on top of the universal
 * rules (1 cask · ≥1 corn · ≥1 small grain · cards ≤ MAX_MASH_CARDS) — a bill's recipe
 * can only TIGHTEN those rules, never loosen them. `grain` is the sum of
 * (corn + barley + rye + wheat).
 */
export type MashRecipe = {
  corn?: MashRecipeBound;
  barley?: MashRecipeBound;
  rye?: MashRecipeBound;
  wheat?: MashRecipeBound;
  grain?: MashRecipeBound;
};

/**
 * Lower-bound thresholds for a mash bill's age bands, in years. Length is
 * 1–3, capped per tier (see `MAX_GRID_BY_TIER` in the catalog generator):
 * common bills are simple (1–2 bands), rarer bills earn more bands. The
 * array is strictly increasing, and `[0]` MUST be ≥ 2 so the lowest age
 * band still respects the global "barrel must age ≥2 years before sale"
 * rule.
 *
 * Examples:
 *   `[2]`        → single row covering all sellable ages (≥2y).
 *   `[2, 5]`    → row 0 covers 2–4, row 1 covers 5+.
 *   `[2, 4, 6]` → row 0 covers 2–3, row 1 covers 4–5, row 2 covers 6+.
 */
export type AgeBandThresholds = readonly number[];

/**
 * Lower-bound thresholds for a mash bill's demand bands, against the
 * global 0–12 demand value. Length is 1–3, capped per tier. Strictly
 * increasing; `[0]` MUST be ≥ 0. Demand below the first threshold falls
 * into col 0 (the lowest band) — there is no "off the table" state.
 *
 * Examples:
 *   `[0]`        → single column; demand doesn't matter for this bill.
 *   `[0, 6]`     → col 0 covers 0–5, col 1 covers 6+.
 *   `[3, 6, 9]`  → col 0 covers 3–5, col 1 covers 6–8, col 2 covers 9+.
 */
export type DemandBandThresholds = readonly number[];

export type BourbonCardDef = {
  id: string;
  name: string;
  rarity: BourbonRarity;
  /**
   * Lower-bound thresholds for this bill's age bands, in years.
   * Length 1–3, strictly increasing; ageBands[0] ≥ 2.
   */
  ageBands: AgeBandThresholds;
  /**
   * Lower-bound thresholds for this bill's demand bands, against the
   * global 0–12 demand value. Length 1–3, strictly increasing.
   */
  demandBands: DemandBandThresholds;
  /**
   * Variable-size price grid. Outer length matches `ageBands.length`,
   * each inner row's length matches `demandBands.length`. Cell value
   * is the printed sale price for (age band, demand band).
   */
  grid: readonly (readonly number[])[];
  awards: BourbonAwards;
  /**
   * Brand value awarded at game end if this mash bill is unlocked as a
   * Gold Bourbon. Only present on cards with a `gold` award line; absent
   * on plain Standard cards (which can never become trophies anyway).
   * The catalog generator derives a default per-card value from the
   * card's grid maximum + a rarity bonus when the YAML doesn't specify
   * one explicitly.
   */
  brandValue?: number;
  /**
   * Optional bill-specific mash requirements. When present, the mash
   * committed at production must satisfy these on top of the universal
   * rules. Absent on cards that accept any legal mash.
   */
  recipe?: MashRecipe;
  /**
   * WoW-style visual tier (common / uncommon / rare / epic / legendary).
   * Always present on the generated catalog — derived from grid max +
   * awards in scripts/build-catalogs.ts when the YAML doesn't override.
   */
  tier: BourbonTier;
};

export type InvestmentModifier =
  | { kind: "rickhouse_fee_discount"; amount: number; oncePerRound?: boolean }
  | {
      kind: "action_cost_discount";
      amount: number;
      scope: "per_round_first_paid" | "next_action";
    }
  | {
      kind: "market_buy_bonus_cards";
      extra: number;
      oncePerRound?: boolean;
    };

export type InvestmentCardDef = {
  id: string;
  name: string;
  rarity: BourbonRarity;
  /** Printed capital cost to Implement. */
  capital: number;
  short: string;
  effect: string;
  deckCopies: number;
  modifiers: InvestmentModifier[];
};

export type OperationsCardDef = {
  id: string;
  categoryId: string;
  title: string;
  concept: string;
  /** Prose rule text. Opcodes come later (chapter 4). */
  effect: string;
};

// ---------- Market cards ----------
//
// Phase 3 of every round each baron draws 2 market cards and keeps 1. The
// majority of cards in the deck raise demand; the rest are softer twists
// (small drops, shortages, rickhouse modifiers) currently encoded only as
// flavor — the engine resolves the typed `effect` and ignores the prose.

export type MarketEffect =
  /** Apply a fixed delta to demand on resolve (clamped to 0..12). */
  | { kind: "demand_delta"; delta: number }
  /**
   * Apply one of two demand deltas based on the current demand at resolve
   * time. If demand > `threshold`, apply `deltaAbove`; otherwise apply
   * `deltaBelow`.
   */
  | {
      kind: "demand_delta_conditional";
      threshold: number;
      deltaAbove: number;
      deltaBelow: number;
    }
  /**
   * Apply a demand delta now AND queue the same delta to fire at the
   * start of each subsequent round for `extraRounds` more rounds.
   * Encodes "demand +1 persistent for N rounds" cards.
   */
  | { kind: "persistent_demand_delta"; delta: number; extraRounds: number }
  /**
   * Demand boost applied at sale time (next round), possibly conditional
   * on the barrel or sale ordering. The boost adjusts the lookup demand
   * passed to the bill's grid; it does NOT change the global demand.
   */
  | {
      kind: "conditional_demand_boost";
      delta: number;
      /** Only applies to barrels whose age ≥ this value, if set. */
      minAge?: number;
      /** Only applies if the boosted lookup lands in the bill's top demand band. */
      topBandOnly?: boolean;
      /** Only applies to the first sale of the round. */
      firstSaleOnly?: boolean;
    }
  /**
   * Lock a resource pile next round — DRAW_RESOURCE on this pile is
   * rejected until that round ends. The effect is queued into
   * `pendingRoundEffects` on resolve and swapped into
   * `currentRoundEffects` by `startNextRound`.
   */
  | { kind: "resource_shortage"; resource: ResourceType }
  /**
   * Add a flat per-barrel surcharge to next round's rickhouse rent.
   * Stacks with the base fee per barrel; a card with `surcharge: 1`
   * means every player pays $1 extra per barrel they own that round.
   */
  | { kind: "rent_surcharge"; surcharge: number }
  /**
   * Override the demand decrement-per-sale for next round (default 1).
   * `accelerated` cards set this higher to drain demand faster as
   * sales happen — the "speculator frenzy" pattern.
   */
  | { kind: "accelerated_demand_decay"; perSale: number }
  /**
   * Block the player who currently owns the most barrels (across all
   * rickhouses) from MAKE_BOURBON next round. Ties: lowest seat index
   * wins the block.
   */
  | { kind: "leader_skip_make"; criterion: "most_barrels" }
  /**
   * Force the player holding the most mash bills in hand to discard one
   * of their choice immediately. Encoded as a flag the UI converts into
   * a forced discard prompt similar to AUDIT_DISCARD; engine shorthand
   * for now is "auto-pick the leader's lowest-grid-max bill" so the
   * effect lands without needing a new modal.
   */
  | { kind: "leader_discard_bill"; criterion: "most_bills" }
  /**
   * Decrement age tokens by 1 on every barrel currently in a specific
   * rickhouse, immediately. Floored at 0.
   */
  | { kind: "rickhouse_age_loss"; rickhouseId: string; loss: number }
  /** Every player draws 1 mash bill from the bourbon deck immediately. */
  | { kind: "all_draw_bourbon"; count: number }
  /**
   * Every player draws `count` of a specific resource (or random if
   * unspecified) from the market piles immediately. Subject to existing
   * shortages.
   */
  | { kind: "all_draw_resource"; resource?: ResourceType; count: number }
  /** Engine-side no-op — the prose still shows on the card. */
  | { kind: "flavor" };

export type MarketCardDef = {
  id: string;
  title: string;
  /** Player-facing prose printed on the card. */
  effect: string;
  /** Number of copies of this card in the market deck. */
  deckCopies: number;
  /** Engine-resolved effect. */
  resolved: MarketEffect;
};

export type ResourceType = "cask" | "corn" | "barley" | "rye" | "wheat";

// ---------- Distillery cards ----------
//
// Asymmetric starting identities (Age-of-Empires-style civs). Each baron
// is dealt 2 face-down at game start, picks 1, returns the other.
// Each card has one or more `bonuses` (one-time, applied at draft
// confirmation) and exactly one `perk` (permanent, applies for the
// rest of the game). See docs/GAME_RULES.md §Distilleries for the
// design and balance rationale.

export type DistilleryBonus =
  | { kind: "cash"; amount: number }
  | { kind: "mash_bills"; count: number }
  | { kind: "resources"; cards: { resource: ResourceType; count: number }[] }
  | { kind: "operations"; count: number }
  /**
   * Reveal the top N cards of the Market deck to the player as a
   * one-time peek. Rearrange UX is deferred — current build just
   * shows the top of the deck in the draft modal so the Speculator's
   * bonus has a visible payoff.
   */
  | { kind: "peek_market"; count: number };

export type DistilleryPerk =
  /** Once per round, the player's first MAKE_BOURBON action costs $0. */
  | { kind: "free_make_per_round" }
  /** Newly placed barrels enter the rickhouse at age `extra` instead of 0. */
  | { kind: "barrel_age_bonus"; extra: number }
  /** Skip rent on any of this player's barrels in a rickhouse where they're the only baron. */
  | { kind: "solo_rickhouse_no_rent" }
  /** First SELL_BOURBON each round doesn't decrement global demand. */
  | { kind: "first_sale_no_demand_drop" }
  /** DRAW_BOURBON action draws 2 and the player keeps 1 (UI pending — currently a no-op stub). */
  | { kind: "draw_two_keep_one_bourbon" }
  /** RESOLVE_OPERATIONS triggers a free DRAW_OPERATIONS afterward. */
  | { kind: "draw_replacement_on_ops" }
  /** Paid action cost reduced by `amount` (floor 0). Stacks with the table-wide free window. */
  | { kind: "paid_action_discount"; amount: number }
  /** Once per round, MAKE_BOURBON returns one cask card from the mash to the player's hand. */
  | { kind: "free_cask_reuse_per_round" };

export type DistilleryCardDef = {
  id: string;
  name: string;
  flavor: string;
  bonus_text: string;
  perk_text: string;
  bonuses: DistilleryBonus[];
  perk: DistilleryPerk;
};

export type ResourceEngineStatus = "modeled" | "partial" | "pending";

export type ResourceWhen = {
  demand_even?: boolean;
  demand_odd?: boolean;
  demand_gte?: number;
  demand_lte?: number;
  mash_corn_count_eq?: number;
  mash_includes_rye?: boolean;
  mash_excludes_rye?: boolean;
  mash_small_grain_count_eq?: number;
  mash_small_grain_count_gte?: number;
  other_barons_barrelled_gte?: number;
};

export type ResourceOpLimit =
  | "once_per_sale"
  | "once_per_mash"
  | "once_per_barrel"
  | "first_barrel_placement_from_mash"
  | "each_turn_while_barrel_in_rickhouse";

export type ResourceOp =
  | {
      op: "revenue_bonus";
      amount: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | {
      op: "demand_lookup_shift";
      delta: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | {
      op: "age_lookup_shift_years";
      delta: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | {
      op: "draw_bourbon_cards";
      count: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | {
      op: "bonus_age_tokens";
      extra: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | {
      op: "rickhouse_fee_discount";
      amount: number;
      max_per_turn?: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | {
      op: "barrel_entry_rent_discount";
      amount: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | {
      op: "bank_payout";
      amount: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | {
      op: "market_demand_global_delta";
      delta: number;
      limit?: ResourceOpLimit;
      when?: ResourceWhen;
    }
  | { op: "noop" }
  | { op: "legacy_manual"; note: string };

export type ResourceCardPlay = {
  resource: ResourceType;
  engine: ResourceEngineStatus;
  on_sell?: ResourceOp[];
  on_make_bourbon?: ResourceOp[];
  on_age_tick?: ResourceOp[];
  on_rickhouse_fee?: ResourceOp[];
  on_trade?: ResourceOp[];
  flags?: string[];
};

export type ResourceCardDef = {
  id: string;
  name: string;
  /** Which category block the card came from (e.g. "cask_specialty"). */
  categoryId: string;
  hook?: string;
  rule: string;
  play: ResourceCardPlay;
};

export type ResourceCardSlim = {
  /** For type-only (plain) cards generated for each ResourceType. */
  id: string;
  name: string;
  resource: ResourceType;
  kind: "plain";
};
