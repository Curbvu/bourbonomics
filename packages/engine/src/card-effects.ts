import type { Draft } from "immer";
import type {
  Barrel,
  Card,
  CardEffect,
  GameState,
  PlayerState,
} from "./types";
import { drawWithReshuffle } from "./deck";

// ============================================================
// Themed-card effect resolver
//
// Effects fire at four discrete moments and otherwise carry no state:
//
//   on_commit_production — fired when a card enters a barrel as
//                          production fuel (MAKE_BOURBON apply)
//   on_commit_aging      — fired when a card lands as aging fuel
//                          (AGE_BOURBON apply)
//   on_sale              — fired for every production + aging card
//                          on a barrel that's being sold
//                          (SELL_BOURBON apply)
//   on_spend             — fired when a capital card is used to pay
//                          a market purchase (BUY_FROM_MARKET apply)
//
// The resolver is a pure dispatcher: it inspects card.effect and
// mutates the immer Draft. Some effects also return *signals* to the
// calling action (e.g. skip_demand_drop, returns_to_hand_on_sale,
// grid_demand_band_offset) — those are accumulated in `SaleEffectSignals`.
// ============================================================

/** Leaf (non-composite) effects — every variant exposes `when`. */
type LeafEffect = Exclude<CardEffect, { kind: "composite" }>;

/** Walks a composite tree and returns the leaf effects. */
function flatten(effect: CardEffect | undefined): LeafEffect[] {
  if (!effect) return [];
  if (effect.kind === "composite") {
    return effect.effects.flatMap((e) => flatten(e));
  }
  return [effect];
}

// -----------------------------
// Production commit
// -----------------------------

export function applyProductionCommitEffect(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  barrel: Draft<Barrel>,
  card: Card,
): void {
  for (const e of flatten(card.effect)) {
    if (e.kind === "draw_cards" && e.when === "on_commit_production") {
      drawIntoHand(draft, player, e.n);
    } else if (e.kind === "bump_demand" && e.when === "on_commit_production") {
      draft.demand = clampDemand(draft.demand + e.delta);
    } else if (e.kind === "barrel_starts_aged" && e.when === "on_commit_production") {
      // Lift the barrel's effective age. Non-stacking — take the max
      // if multiple cards in the same production grant different ages.
      barrel.age = Math.max(barrel.age, e.age);
    } else if (e.kind === "grid_rep_offset" && e.when === "on_commit_production") {
      barrel.gridRepOffset += e.offset;
    }
  }
}

// -----------------------------
// Aging commit
// -----------------------------

/**
 * Returns the years this aging card adds to the barrel (default 1,
 * higher when an `aging_card_doubled` effect applies).
 */
export function ageYearsForCard(card: Card): number {
  for (const e of flatten(card.effect)) {
    if (e.kind === "aging_card_doubled" && e.when === "on_commit_aging") {
      return e.years;
    }
  }
  return 1;
}

export function applyAgingCommitEffect(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  card: Card,
): void {
  for (const e of flatten(card.effect)) {
    if (e.kind === "draw_cards" && e.when === "on_commit_aging") {
      drawIntoHand(draft, player, e.n);
    } else if (e.kind === "rep_on_commit_aging" && e.when === "on_commit_aging") {
      player.reputation += e.rep;
    }
  }
}

// -----------------------------
// Sale
// -----------------------------

export interface SaleEffectSignals {
  /** Total +rep adders fired by sale effects (added to reputation). */
  bonusRep: number;
  /** Demand band offset applied to the grid lookup at sale (e.g. Toasted Oak). */
  gridDemandBandOffset: number;
  /** True if any card cancelled the demand drop on this sale. */
  skipDemandDrop: boolean;
  /** Card ids that should bounce back to the player's hand on sale. */
  returnsToHand: Set<string>;
  /** Extra cards drawn on sale, in addition to the player-driven cardDrawSplit. */
  bonusDraw: number;
}

export function emptySaleSignals(): SaleEffectSignals {
  return {
    bonusRep: 0,
    gridDemandBandOffset: 0,
    skipDemandDrop: false,
    returnsToHand: new Set<string>(),
    bonusDraw: 0,
  };
}

/**
 * Inspect a barrel's production + aging cards and accumulate every
 * sale-time signal. Pure read — does NOT mutate; the calling
 * action applies the result.
 */
export function collectSaleSignals(
  barrel: Pick<Barrel, "productionCards" | "agingCards" | "age">,
  context: { demand: number },
): SaleEffectSignals {
  const sig = emptySaleSignals();
  const allCards: Card[] = [
    ...(barrel.productionCards ?? []),
    ...(barrel.agingCards ?? []),
  ];
  for (const card of allCards) {
    for (const e of flatten(card.effect)) {
      if (e.when !== "on_sale") continue;
      switch (e.kind) {
        case "rep_on_sale_flat":
          sig.bonusRep += e.rep;
          break;
        case "rep_on_sale_if_age_gte":
          if (barrel.age >= e.age) sig.bonusRep += e.rep;
          break;
        case "rep_on_sale_if_demand_gte":
          if (context.demand >= e.demand) sig.bonusRep += e.rep;
          break;
        case "grid_demand_band_offset":
          sig.gridDemandBandOffset += e.offset;
          break;
        case "skip_demand_drop":
          sig.skipDemandDrop = true;
          break;
        case "returns_to_hand_on_sale":
          sig.returnsToHand.add(card.id);
          break;
        case "draw_cards":
          sig.bonusDraw += e.n;
          break;
      }
    }
  }
  return sig;
}

// -----------------------------
// Market spend (capital `on_spend`)
// -----------------------------

export function applySpendEffect(
  player: Draft<PlayerState>,
  card: Card,
): void {
  for (const e of flatten(card.effect)) {
    if (e.kind === "rep_on_market_spend" && e.when === "on_spend") {
      player.reputation += e.rep;
    }
  }
}

// -----------------------------
// Helpers
// -----------------------------

function clampDemand(d: number): number {
  return Math.max(0, Math.min(12, d));
}

function drawIntoHand(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  n: number,
): void {
  if (n <= 0) return;
  const result = drawWithReshuffle(
    player.deck.slice(),
    player.discard.slice(),
    n,
    draft.rngState,
  );
  player.hand.push(...result.drawn);
  player.deck = result.deck;
  player.discard = result.discard;
  draft.rngState = result.rngState;
}
