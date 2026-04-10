/**
 * Machine-readable specialty resource rules (see docs/resource_cards.yaml `play`).
 * Human `rule` strings remain the source of truth for edge cases; `play` is what the engine should implement.
 */

/** Resource pile / mash slot type this card counts as (prototype deck uses plain strings today). */
export type PlayResourceKind =
  | "cask"
  | "corn"
  | "barley"
  | "rye"
  | "wheat"
  | "flavor"
  | "multi";

/** How complete the `play` block is for automated rules. */
export type PlayEngineStatus = "modeled" | "partial" | "pending";

/** Optional predicates; if multiple keys are set, treat as AND (all must pass). */
export type PlayWhen = {
  demand_lte?: number;
  demand_gte?: number;
  demand_even?: boolean;
  demand_odd?: boolean;
  /** Count of Corn cards in the mash (including this card if it is corn). */
  mash_corn_count_eq?: number;
  mash_corn_count_gte?: number;
  /** Barley + Rye + Wheat cards in mash. */
  mash_small_grain_count_eq?: number;
  mash_small_grain_count_gte?: number;
  mash_includes_rye?: boolean;
  /** When true, mash must contain no Rye cards (wheated bill helper). */
  mash_excludes_rye?: boolean;
  /** Other barons with ≥1 barrelled bourbon (for tourist-table bonuses, etc.). */
  other_barons_barrelled_gte?: number;
};

export type PlayLimit =
  | "once_per_sale"
  | "once_per_mash"
  | "first_barrel_placement_from_mash"
  | "each_turn_while_barrel_in_rickhouse"
  | "once_per_barrel";

/**
 * Single mechanical effect. Expand this union as the prototype implements effects.
 * `legacy_manual` = still described only in `rule` prose.
 */
export type ResourcePlayOp =
  | {
      op: "revenue_bonus";
      amount: number;
      limit?: PlayLimit;
      when?: PlayWhen;
    }
  | {
      op: "bank_payout";
      amount: number;
      limit?: PlayLimit;
    }
  | {
      op: "demand_lookup_shift";
      /** Added to effective demand for Market Price Guide lookup only. */
      delta: number;
      limit?: PlayLimit;
      when?: PlayWhen;
    }
  | {
      op: "age_lookup_shift_years";
      /** Added to effective age for Market Price Guide lookup only. */
      years: number;
      limit?: PlayLimit;
      when?: PlayWhen;
    }
  | {
      op: "draw_bourbon_cards";
      count: number;
      limit?: PlayLimit;
      when?: PlayWhen;
    }
  | {
      /** When aging would place one year token, add this many *additional* tokens. */
      op: "bonus_age_tokens";
      extra: number;
      limit?: "once_per_barrel";
    }
  | {
      op: "barrel_entry_rent_discount";
      /** Negative or positive adjustment to rickhouse entry rent for this placement. */
      amount: number;
      limit?: "first_barrel_placement_from_mash";
    }
  | {
      op: "rickhouse_fee_discount";
      amount: number;
      limit?: "each_turn_while_barrel_in_rickhouse";
      max_per_turn?: number;
    }
  | { op: "noop" }
  | { op: "legacy_manual"; note?: string };

export type SpecialtyResourcePlay = {
  resource: PlayResourceKind;
  /**
   * Grain + corn cards this one card consumes toward the mash cap (heritage grist = 2).
   * Default 1 if omitted.
   */
  grain_slot_cost?: number;
  engine: PlayEngineStatus;
  on_make_bourbon?: ResourcePlayOp[];
  on_sell?: ResourcePlayOp[];
  /** When aging would add one year to this barrel. */
  on_age_tick?: ResourcePlayOp[];
  on_rickhouse_fee?: ResourcePlayOp[];
  on_trade?: ResourcePlayOp[];
  /** Freeform flags for rare cards (engine interprets by convention). */
  flags?: string[];
};

export const DEFAULT_CATEGORY_RESOURCE: Record<string, PlayResourceKind> = {
  cask_specialty: "cask",
  corn_specialty: "corn",
  barley_specialty: "barley",
  rye_specialty: "rye",
  wheat_specialty: "wheat",
  cross_type_rare_promos_optional: "multi",
};
