import type {
  Barrel,
  Card,
  Distillery,
  GameAction,
  GameState,
  MashBill,
  ValidationResult,
} from "../types";
import { isWheatedBill, saleFloorForBill } from "../types";
import type { Draft } from "immer";
import type { SaleEffectSignals } from "../card-effects";
import { collectSaleSignals } from "../card-effects";
import { drawWithReshuffle } from "../deck";
import { awardConditionMet, computeReward } from "../rewards";
import { isCurrentPlayer } from "../state";
import {
  createBottleFromSale,
  mintBottleId,
} from "../lines/placement";
import {
  claimRoundUse,
  effectiveSaleDemand,
  hasInvestment,
} from "../investments";

const isHeritageCard = (c: Card): boolean => c.cardDefId.startsWith("heritage_");
const isCaskCard = (c: Card): boolean => c.subtype === "cask";
const isSpecialtyOrHeritage = (c: Card): boolean => c.specialty === true;

type SellBourbonAction = Extract<GameAction, { type: "SELL_BOURBON" }>;

const MIN_SELL_AGE = 2;

/**
 * Compute the grid reward for a barrel with all sale-time offsets
 * folded in: themed-card sale signals (Toasted Oak, Single Barrel
 * Cask) and barrel-attached offsets (Master Distiller).
 *
 * Used by both validate (to derive the expected split total) and
 * apply (to score the actual reward) — keeping them in sync.
 */
function computeSaleGridReward(
  bill: MashBill,
  barrel: Pick<Barrel, "age" | "gridRepOffset" | "demandBandOffset">,
  demand: number,
  signals: SaleEffectSignals,
): number {
  return computeReward(bill, barrel.age, demand, {
    demandBandOffset: signals.gridDemandBandOffset + barrel.demandBandOffset,
    gridRepOffset: barrel.gridRepOffset,
  });
}

export function validateSellBourbon(
  state: GameState,
  action: SellBourbonAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const barrel = state.allBarrels.find((b) => b.id === action.barrelId);
  if (!barrel) return { legal: false, reason: `barrel ${action.barrelId} not found` };
  if (barrel.ownerId !== action.playerId) {
    return { legal: false, reason: "you do not own that barrel" };
  }
  // v2.6: only aging-phase barrels can be sold. Ready/construction
  // barrels haven't aged.
  if (barrel.phase !== "aging") {
    return { legal: false, reason: "barrel is still under construction" };
  }
  if (barrel.age < MIN_SELL_AGE) {
    return { legal: false, reason: `barrel must be aged at least ${MIN_SELL_AGE} years` };
  }
  // v2.10: round-gap rule. A barrel must have been in Aging phase for
  // at least one full round before it can sell. Pre-aged starters ship
  // with completedInRound = 0 so they're eligible from round 1 onward.
  if (barrel.completedInRound != null && state.round <= barrel.completedInRound) {
    return {
      legal: false,
      reason: "this barrel finished aging too recently — it can sell starting next round",
    };
  }

  // Sale is single-step. There are no player-facing choices on Silver
  // or Gold any more — both outcomes resolve automatically in apply.
  return { legal: true };
}

/** Distillery sale-mod: +N rep when selling a high-rye / wheated bill. */
function distillerySaleBonusRep(distillery: Distillery | null, bill: MashBill): number {
  const mod = distillery?.saleMods?.bonusRepOnBill;
  if (!mod) return 0;
  if (mod.kind === "wheated" && isWheatedBill(bill)) return mod.rep;
  // v2.10 High-Rye House: any bill with minRye ≥ 1 qualifies (was ≥ 2).
  if (mod.kind === "high_rye" && (bill.recipe?.minRye ?? 0) >= 1) return mod.rep;
  return 0;
}

export function applySellBourbon(
  draft: Draft<GameState>,
  action: SellBourbonAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const barrelIdx = draft.allBarrels.findIndex((b) => b.id === action.barrelId);
  const barrel = draft.allBarrels[barrelIdx]!;
  const attached = barrel.attachedMashBill;

  // v2.10: sell action no longer costs a card from hand. Mandatory
  // per-turn aging (v2.9) is the sole holding cost.

  // v3.6 Counterfeit Bottles — if an opponent queued one (or more)
  // Counterfeit Bottles on this player, their grid read uses
  // `max(0, demand − penalty)` instead of `demand`. Tier floor below
  // still applies, so the sale always clears its baseline. Award
  // checks (Gold / Silver) read the *unmodified* demand to keep the
  // counterfeit purely an *economic* penalty, not a prestige one.
  // v3.6 Distillery Tour Program — the owner reads demand as ≥4 for
  // their own grid lookups (applied on top of the Counterfeit penalty).
  const gridDemand = effectiveSaleDemand(
    player,
    Math.max(0, draft.demand - player.nextSaleDemandPenalty),
  );
  // Collect themed-card sale signals BEFORE any mutation so the
  // computed reward + bonus rep + return-to-hand list match what
  // validation accepted.
  const signals = collectSaleSignals(barrel, { demand: gridDemand });
  const rawReward = computeSaleGridReward(attached, barrel, gridDemand, signals);
  // v3.6 Vintage Reserve — barrels aged 7+ triple their grid value
  // BEFORE the tier-floor clamp (high-grid bills benefit; low-grid
  // still floor).
  const reward =
    hasInvestment(player, "vintage_reserve") && barrel.age >= 7
      ? rawReward * 3
      : rawReward;

  // single-step sale. Sum everything that adds
  // rep at sale — grid reward, themed-card per-card bonuses, Rating
  // Boost, distillery sale mods (e.g. High-Rye +1) — then clamp to
  // the bill's tier floor (3/4/5) so every sale clears its baseline.
  const ratingBoost = player.pendingRatingBoost;
  const distilleryBonusRep = distillerySaleBonusRep(player.distillery, attached);
  // v3.4 — Vanilla's first-sale-of-round +1 fires BEFORE the tier
  // floor clamp (per spec). Applies only when the player's distillery
  // bonus is `vanilla` AND the per-round flag hasn't been consumed
  // yet. Cleared inline below regardless of distillery so the flag
  // semantics ("first sale this round") stay consistent — only the
  // numeric bump is Vanilla-only.
  const vanillaFirstSaleBump =
    player.distillery?.bonus === "vanilla" && player.firstSaleOfRoundPending
      ? 1
      : 0;
  const rawTotal =
    reward + signals.bonusRep + ratingBoost + distilleryBonusRep +
    vanillaFirstSaleBump;
  const floor = saleFloorForBill(attached);
  // Prestige is added AFTER the tier floor, never below it. It only
  // applies when Silver or Gold triggers this sale; base sales (no
  // award) ignore prestige entirely.
  const goldEligible =
    attached.goldAward != null &&
    awardConditionMet(attached.goldAward, barrel.age, draft.demand, reward);
  const silverEligible =
    !goldEligible &&
    attached.silverAward != null &&
    awardConditionMet(attached.silverAward, barrel.age, draft.demand, reward);
  const prestigeBonus =
    (goldEligible || silverEligible) ? player.prestige : 0;
  const total = Math.max(rawTotal, floor) + prestigeBonus;
  // v3.3 — Sale credits Capital (the in-game spendable currency).
  // Banked Capital still counts 1:1 toward final score at game end.
  player.capital += total;

  // ── v3.6 on-sell investment Capital adders ──────────────────────
  // These pay flat Capital on top of the grid total (never below the
  // tier floor — they're additive). Read the *shared* demand track
  // for Hedge Fund (not the personal grid-floored value).
  let investmentCapital = 0;
  if (hasInvestment(player, "tasting_room") && barrel.age >= 5) {
    investmentCapital += 1;
  }
  if (hasInvestment(player, "visitor_center")) {
    const awardEligible =
      attached.tags.includes("gold-eligible") ||
      attached.tags.includes("silver-eligible");
    investmentCapital += awardEligible ? 2 : 1;
  }
  let hedgeFundSkipsDrop = false;
  if (hasInvestment(player, "hedge_fund") && draft.demand >= 8) {
    investmentCapital += 3;
    hedgeFundSkipsDrop = true;
  }
  if (hasInvestment(player, "bottling_plant")) {
    investmentCapital += 1;
  }
  if (
    hasInvestment(player, "premium_label") &&
    [...barrel.productionCards, ...barrel.agingCards].filter(
      isSpecialtyOrHeritage,
    ).length >= 2
  ) {
    investmentCapital += 3;
  }
  player.capital += investmentCapital;
  // Bottling Plant also draws 1 on every sale (no round cap).
  if (hasInvestment(player, "bottling_plant")) {
    const r = drawWithReshuffle(
      player.deck.slice(),
      player.discard.slice(),
      1,
      draft.rngState,
    );
    player.hand.push(...r.drawn);
    player.deck = r.deck;
    player.discard = r.discard;
    draft.rngState = r.rngState;
  }
  // Consume the boost — one-shot per sale.
  if (ratingBoost > 0) player.pendingRatingBoost = 0;
  // v3.6 — Counterfeit Bottles penalty clears after a single sale,
  // even if it didn't actually reduce the grid (e.g. demand was
  // already 0). One queued counterfeit = one consumed counterfeit.
  if (player.nextSaleDemandPenalty > 0) player.nextSaleDemandPenalty = 0;
  // v3.4 — Consume the first-sale-of-round flag only on Vanilla
  // players. For everyone else, the flag stays true (does nothing)
  // — keeps the bump scoped to Vanilla without polluting non-Vanilla
  // sale arithmetic.
  if (
    player.distillery?.bonus === "vanilla" &&
    player.firstSaleOfRoundPending
  ) {
    player.firstSaleOfRoundPending = false;
  }

  // Themed-card on-sale draw bonuses (e.g. a future Heritage card
  // declaring `draw_cards on_sale`). Kept independent of the rep
  // total so themed effects still fire under unified rep.
  if (signals.bonusDraw > 0) {
    const result = drawWithReshuffle(
      player.deck.slice(),
      player.discard.slice(),
      signals.bonusDraw,
      draft.rngState,
    );
    player.hand.push(...result.drawn);
    player.deck = result.deck;
    player.discard = result.discard;
    draft.rngState = result.rngState;
  }

  // Cards under the barrel return home: those flagged
  // `returns_to_hand_on_sale` go back to hand; v3.6 commit-as-
  // resource ops cards (Cooper's Contract / Grain Futures —
  // `card.type === "operations"` with `commitableAs`) flip back into
  // the player's `opsDiscard` so they don't pollute the resource
  // deck; everything else hits the regular discard pile.
  const allBarrelCards: Card[] = [...barrel.productionCards, ...barrel.agingCards];
  // ── v3.6 investment-driven card returns ─────────────────────────
  // Build the set of card ids that bounce back to hand on this sale,
  // unioning the themed-card signals with the investment returns:
  //   - Heritage Cooperage: all Heritage cards (if ≥1 was used).
  //   - Bottling Line: the barrel's cask card(s), first sale each round.
  //   - Bonded Warehouse: all aging cards from a designated bonded slot.
  const returnIds = new Set<string>(signals.returnsToHand);
  if (hasInvestment(player, "heritage_cooperage")) {
    for (const c of allBarrelCards.filter(isHeritageCard)) returnIds.add(c.id);
  }
  if (hasInvestment(player, "bottling_line")) {
    const caskCards = allBarrelCards.filter(isCaskCard);
    if (caskCards.length > 0 && claimRoundUse(player, "bottling_line")) {
      for (const c of caskCards) returnIds.add(c.id);
    }
  }
  if (player.bondedSlotIds.includes(barrel.slotId)) {
    for (const c of barrel.agingCards) returnIds.add(c.id);
  }
  for (const c of allBarrelCards) {
    if (returnIds.has(c.id)) {
      player.hand.push(c);
      continue;
    }
    if (c.type === "operations" && c.opSpec && c.opSpec.commitableAs) {
      player.opsDiscard.push(c.opSpec);
      continue;
    }
    player.discard.push(c);
  }

  // ---------------------------------------------------------------
  // Prestige-era Award resolution
  // ---------------------------------------------------------------
  // Silver: bill → bourbon discard, slot opens, no prestige.
  // Gold:   bill is RETIRED (out of the game entirely), slot opens,
  //         player gains +1 prestige.
  // None:   bill → bourbon discard, slot opens.
  //
  // Connoisseur Estate's permanent ability: +1 extra prestige on
  // Silver (0 → 1) and +1 extra on Gold (1 → 2). The distillery is
  // the prestige specialist.
  const isConnoisseur = player.distillery?.bonus === "connoisseur_estate";
  if (goldEligible) {
    // Gold: retire the bill — never returns to deck, discard, or
    // any other zone. Slot opens, player gains prestige.
    draft.retiredBills.push(attached);
    draft.allBarrels.splice(barrelIdx, 1);
    player.prestige += isConnoisseur ? 2 : 1;
  } else if (silverEligible) {
    // Silver: bill cycles into the bourbon discard, slot opens.
    // Connoisseur picks up +1 prestige.
    draft.bourbonDiscard.push(attached);
    draft.allBarrels.splice(barrelIdx, 1);
    if (isConnoisseur) player.prestige += 1;
  } else {
    // No award — bill to discard, slot opens fully.
    draft.bourbonDiscard.push(attached);
    draft.allBarrels.splice(barrelIdx, 1);
  }

  player.barrelsSold += 1;
  // v3.6 Bourbon Hall of Fame — track distinct bills sold for the
  // end-game Reputation award (read at scoring, capped there).
  if (!player.soldBillDefIds.includes(attached.defId)) {
    player.soldBillDefIds.push(attached.defId);
  }

  // Demand drops by 1 unless Demand Surge absorbs it or a sale-
  // effect (Heirloom Wheat's `skip_demand_drop`) cancels the drop.
  if (player.demandSurgeActive) {
    player.demandSurgeActive = false;
  } else if (signals.skipDemandDrop) {
    // No-op — drop cancelled.
  } else if (hedgeFundSkipsDrop) {
    // v3.6 Hedge Fund — hot-market sales don't tank demand.
  } else if (draft.demand > 0) {
    draft.demand -= 1;
  }

  // v3.0 Line system — flip the bill to a Bottle and stash it as
  // pendingBottlePlacement. The player (or bot stub) must dispatch
  // PLACE_BOTTLE next to choose where the bottle lands. The original
  // bill stays in its existing pile (discard / retired) — the Bottle
  // carries the snapshot data.
  const bottle = createBottleFromSale(
    attached,
    barrel,
    draft.demand,
    barrel.age,
    draft.round,
    mintBottleId(draft),
  );
  player.pendingBottlePlacement = { bottle };

  // v2.2: selling does NOT end the player's turn.
}
