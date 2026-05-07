import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  MashBill,
  PlayerState,
  ValidationResult,
} from "../types";
import { isWheatedBill } from "../types";
import { resourceUnits, suppliesResource } from "../cards";
import { applyProductionCommitEffect } from "../card-effects";
import { isCurrentPlayer } from "../state";

// ============================================================
// MAKE_BOURBON — v2.6 slot-bound bills.
//
// Commits ≥1 card from the player's hand to a slot that already holds
// a bill (slots are opened by DRAW_MASH_BILL, not by this action).
// The barrel transitions:
//   - "ready"       (bill, 0 cards)  →  "construction" on first commit
//   - "construction" (bill, ≥1 card) →  "aging"        when the cumulative
//                                       pile satisfies (a) the universal
//                                       rule of exactly 1 cask + ≥1 corn
//                                       + ≥1 grain AND (b) the bill's
//                                       recipe (with distillery + pre-
//                                       played discounts applied).
// Cards committed during construction are locked until sale.
// v2.7: no per-slot turn cap — a player may commit to the same barrel
// as many times as they want in a single turn. Aging-phase barrels
// are immutable to MAKE_BOURBON. Failed Batch (the optional discard-
// and-trash) is available the FIRST time a slot transitions ready →
// construction; subsequent commits to the same slot don't re-arm it.
// ============================================================

type MakeBourbonAction = Extract<GameAction, { type: "MAKE_BOURBON" }>;

interface ResourceTotals {
  caskSources: number;
  corn: number;
  rye: number;
  barley: number;
  wheat: number;
}

function emptyTotals(): ResourceTotals {
  return { caskSources: 0, corn: 0, rye: 0, barley: 0, wheat: 0 };
}

function totalGrain(t: ResourceTotals): number {
  return t.rye + t.barley + t.wheat;
}

/**
 * Tally a card's contribution to the cumulative ingredient totals.
 * Capital cards contribute nothing to recipe totals. Returns silently
 * for non-resource cards so callers can iterate uniformly across
 * mixed piles.
 */
function tallyCard(totals: ResourceTotals, card: Card): void {
  if (card.type !== "resource") return;
  if (suppliesResource(card, "cask")) totals.caskSources += 1;
  totals.corn += resourceUnits(card, "corn");
  totals.rye += resourceUnits(card, "rye");
  totals.barley += resourceUnits(card, "barley");
  totals.wheat += resourceUnits(card, "wheat");
}

/**
 * Recipe minimums for this player + bill, with distillery and pre-
 * played discounts (Mash Futures, Cooper's Contract) baked in.
 *
 * Wheated Baron applied to wheated bills knocks 1 off `minWheat`
 * (floor 0). The discount is computed against the cumulative pile —
 * with incremental commitment we only check satisfaction at the
 * moment the cumulative cards meet the (discounted) recipe.
 */
function effectiveRecipeMins(
  player: PlayerState,
  bill: MashBill,
): {
  minCorn: number;
  minRye: number;
  minBarley: number;
  minWheat: number;
  maxRye: number;
  maxWheat: number;
  minTotalGrain: number;
} {
  const recipe = bill.recipe ?? {};
  let minRye = recipe.minRye ?? 0;
  let minBarley = recipe.minBarley ?? 0;
  let minWheat = recipe.minWheat ?? 0;
  if (player.distillery?.bonus === "wheated_baron" && isWheatedBill(bill)) {
    minWheat = Math.max(0, minWheat - 1);
  }
  if (player.pendingMakeDiscount === "grain") {
    // Mash Futures: knock 1 off the largest grain min that's > 0.
    let bestKind: "rye" | "barley" | "wheat" | null = null;
    let bestVal = 0;
    if (minRye > bestVal) {
      bestKind = "rye";
      bestVal = minRye;
    }
    if (minBarley > bestVal) {
      bestKind = "barley";
      bestVal = minBarley;
    }
    if (minWheat > bestVal) {
      bestKind = "wheat";
      bestVal = minWheat;
    }
    if (bestKind === "rye") minRye = Math.max(0, minRye - 1);
    else if (bestKind === "barley") minBarley = Math.max(0, minBarley - 1);
    else if (bestKind === "wheat") minWheat = Math.max(0, minWheat - 1);
  }
  let minTotalGrain = recipe.minTotalGrain ?? 0;
  if (player.pendingMakeDiscount === "grain") {
    minTotalGrain = Math.max(1, minTotalGrain - 1);
  }
  return {
    minCorn: Math.max(1, recipe.minCorn ?? 0),
    minRye,
    minBarley,
    minWheat,
    maxRye: recipe.maxRye ?? Infinity,
    maxWheat: recipe.maxWheat ?? Infinity,
    minTotalGrain,
  };
}

/**
 * Returns true iff the cumulative committed pile (production cards on
 * the barrel after this commit) satisfies the universal rule + the
 * attached bill's recipe. Used both at validation time (to forbid
 * over-commits past `maxRye` etc.) and at apply time (to decide
 * whether to flip the barrel to aging).
 */
function recipeSatisfied(
  player: PlayerState,
  bill: MashBill,
  totals: ResourceTotals,
): { ok: boolean; reason?: string } {
  // Universal rule: exactly 1 cask source per barrel. Cooper's
  // Contract allows 0.
  const allowZeroCask = player.pendingMakeDiscount === "cask";
  const minCaskSources = allowZeroCask ? 0 : 1;
  if (totals.caskSources < minCaskSources) {
    return { ok: false, reason: `need ${minCaskSources} cask source` };
  }
  if (totals.caskSources > 1) {
    return { ok: false, reason: "barrel can hold at most 1 cask source" };
  }
  if (totals.corn < 1) return { ok: false, reason: "need at least 1 corn" };
  const grain = totalGrain(totals);
  if (grain < 1) return { ok: false, reason: "need at least 1 grain" };
  const mins = effectiveRecipeMins(player, bill);
  if (totals.corn < mins.minCorn) return { ok: false, reason: `recipe requires corn ≥ ${mins.minCorn}` };
  if (totals.rye < mins.minRye) return { ok: false, reason: `recipe requires rye ≥ ${mins.minRye}` };
  if (totals.barley < mins.minBarley) return { ok: false, reason: `recipe requires barley ≥ ${mins.minBarley}` };
  if (totals.wheat < mins.minWheat) return { ok: false, reason: `recipe requires wheat ≥ ${mins.minWheat}` };
  if (totals.rye > mins.maxRye) return { ok: false, reason: `recipe forbids rye > ${mins.maxRye}` };
  if (totals.wheat > mins.maxWheat) return { ok: false, reason: `recipe forbids wheat > ${mins.maxWheat}` };
  if (grain < mins.minTotalGrain) return { ok: false, reason: `recipe requires total grain ≥ ${mins.minTotalGrain}` };
  return { ok: true };
}

export function validateMakeBourbon(
  state: GameState,
  action: MakeBourbonAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const slot = player.rickhouseSlots.find((s) => s.id === action.slotId);
  if (!slot) {
    return { legal: false, reason: `slot ${action.slotId} is not on your distillery card` };
  }

  // v2.6: MAKE_BOURBON commits to an existing barrel (ready or
  // construction). Open slots aren't valid targets — the player must
  // first DRAW_MASH_BILL into the slot to seed a "ready" barrel.
  const existingBarrel = state.allBarrels.find((b) => b.slotId === action.slotId);
  if (!existingBarrel) {
    return {
      legal: false,
      reason: `slot ${action.slotId} is open — draw a bill into it first`,
    };
  }
  if (existingBarrel.ownerId !== player.id) {
    return { legal: false, reason: `slot ${action.slotId} holds another player's barrel` };
  }
  if (existingBarrel.phase === "aging") {
    return { legal: false, reason: "that barrel has already finished construction" };
  }

  const cardCount = action.cardIds.length;
  if (cardCount === 0) {
    return { legal: false, reason: "must commit at least one card" };
  }

  // ---- Card integrity ----
  if (new Set(action.cardIds).size !== cardCount) {
    return { legal: false, reason: "duplicate card id in commit list" };
  }
  const handIds = new Set(player.hand.map((c) => c.id));
  for (const id of action.cardIds) {
    if (!handIds.has(id)) {
      return { legal: false, reason: `card ${id} is not in your hand` };
    }
  }

  // ---- Cumulative resource totals (existing pile + this commit) ----
  const cardById = new Map(player.hand.map((c) => [c.id, c]));
  const totals = emptyTotals();
  for (const card of existingBarrel.productionCards) tallyCard(totals, card);
  for (const id of action.cardIds) {
    const card = cardById.get(id)!;
    if (card.type !== "resource" && card.type !== "capital") {
      return { legal: false, reason: `card ${id} cannot be committed to a barrel` };
    }
    tallyCard(totals, card);
  }

  // Hard upper limits — block over-commits that would strand the barrel.
  if (totals.caskSources > 1) {
    return { legal: false, reason: "barrel can hold at most 1 cask source" };
  }
  const mins = effectiveRecipeMins(player, existingBarrel.attachedMashBill);
  if (totals.rye > mins.maxRye) {
    return { legal: false, reason: `recipe forbids rye > ${mins.maxRye}` };
  }
  if (totals.wheat > mins.maxWheat) {
    return { legal: false, reason: `recipe forbids wheat > ${mins.maxWheat}` };
  }

  return { legal: true };
}

export function applyMakeBourbon(
  draft: Draft<GameState>,
  action: MakeBourbonAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const cardById = new Map(player.hand.map((c) => [c.id, c as Card]));
  const newCards: Card[] = action.cardIds.map((id) => cardById.get(id)!);
  const newCardIds = new Set(action.cardIds);

  // Remove committed cards from the player's hand.
  player.hand = player.hand.filter((c) => !newCardIds.has(c.id));

  // v2.6: the slot already holds a "ready" or "construction" barrel.
  // Validation guarantees we're committing to an existing one.
  const barrel = draft.allBarrels.find((b) => b.slotId === action.slotId)!;
  // Transition ready → construction on first commit.
  if (barrel.phase === "ready") {
    barrel.phase = "construction";
  }

  // Append the newly committed cards to the production pile.
  for (const card of newCards) {
    barrel.productionCards.push(card);
    barrel.productionCardDefIds.push(card.cardDefId);
  }

  // Fire on_commit_production effects only for the cards committed by
  // this action (existing cards already had their effects fire when
  // they were originally committed).
  for (const card of newCards) {
    applyProductionCommitEffect(draft, player, barrel, card);
  }

  // Completion check.
  const totals = emptyTotals();
  for (const card of barrel.productionCards) tallyCard(totals, card);
  const result = recipeSatisfied(player, barrel.attachedMashBill, totals);
  if (result.ok) {
    barrel.phase = "aging";
    barrel.completedInRound = draft.round;
    // Pre-played production discount is consumed at the moment of
    // completion — not at every individual commit. If the barrel
    // never completes, the discount stays armed for a future build.
    player.pendingMakeDiscount = null;
  }
  // v2.2: production does NOT end the player's turn — the active player
  // continues taking actions until they pass or run out of legal plays.
}
