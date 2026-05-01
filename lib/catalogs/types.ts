// Types shared by the generated catalogs.
// Kept in a hand-authored file so the generated .ts files only emit data.

export type BourbonRarity = "Standard" | "Rare";

export type BourbonAwards = {
  silver?: string | null;
  gold?: string | null;
} | null;

export type BourbonCardDef = {
  id: string;
  name: string;
  rarity: BourbonRarity;
  /** 3×3 price grid. Outer: age band [2–3, 4–7, 8+]. Inner: demand band [Low, Mid, High]. */
  grid: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  awards: BourbonAwards;
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
   * `deltaBelow`. Useful for "demand +1 if hot, +2 if cool" cards.
   */
  | {
      kind: "demand_delta_conditional";
      threshold: number;
      deltaAbove: number;
      deltaBelow: number;
    }
  /**
   * Lock a resource pile next round — DRAW_RESOURCE on this pile is
   * rejected until that round ends. The effect is queued into
   * `pendingRoundEffects` on resolve and swapped into
   * `currentRoundEffects` by `startNextRound`.
   */
  | { kind: "resource_shortage"; resource: ResourceType }
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
