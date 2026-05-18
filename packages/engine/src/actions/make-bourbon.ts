import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  MashBill,
  PlayerState,
  ValidationResult,
} from "../types";
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
  /**
   * v2.11: per-subtype Specialty unit counts. Each Specialty or
   * Heritage card contributes its `resourceCount` (uniformly 1 in
   * v2.11 — every card is one unit). Used to satisfy
   * `recipe.minSpecialty`.
   */
  specialtyCask: number;
  specialtyCorn: number;
  specialtyRye: number;
  specialtyBarley: number;
  specialtyWheat: number;
}

function emptyTotals(): ResourceTotals {
  return {
    caskSources: 0,
    corn: 0,
    rye: 0,
    barley: 0,
    wheat: 0,
    specialtyCask: 0,
    specialtyCorn: 0,
    specialtyRye: 0,
    specialtyBarley: 0,
    specialtyWheat: 0,
  };
}

function totalGrain(t: ResourceTotals): number {
  return t.rye + t.barley + t.wheat;
}

/**
 * Tally a card's contribution to the cumulative ingredient totals.
 * Capital cards contribute nothing to recipe totals. Returns silently
 * for non-resource cards so callers can iterate uniformly across
 * mixed piles.
 *
 * v2.11: Specialty / Heritage cards (`card.specialty === true`) also
 * contribute their `resourceCount` to the per-subtype specialty tally
 * so recipes with `minSpecialty` requirements can be checked.
 */
function tallyCard(totals: ResourceTotals, card: Card): void {
  if (card.type !== "resource") return;
  if (suppliesResource(card, "cask")) totals.caskSources += 1;
  totals.corn += resourceUnits(card, "corn");
  totals.rye += resourceUnits(card, "rye");
  totals.barley += resourceUnits(card, "barley");
  totals.wheat += resourceUnits(card, "wheat");
  if (card.specialty) {
    totals.specialtyCask += resourceUnits(card, "cask");
    totals.specialtyCorn += resourceUnits(card, "corn");
    totals.specialtyRye += resourceUnits(card, "rye");
    totals.specialtyBarley += resourceUnits(card, "barley");
    totals.specialtyWheat += resourceUnits(card, "wheat");
  }
}

/**
 * Recipe minimums for this player + bill, with distillery and pre-
 * played discounts (Mash Futures, Cooper's Contract) baked in.
 *
 * v2.10 exact-recipe rule: each `min*` is also the **maximum** the
 * commit may carry for that subtype. Recipes are exact. Specialty
 * floors are computed as `max(declared, sp.<subtype>)` so a
 * `minRye: 0, minSpecialty: { rye: 2 }` recipe still demands 2 rye
 * total (the specialty card counts as both a plain rye and a
 * specialty rye — backwards-compatible).
 *
 * Wheated Baron applied to wheated bills knocks 1 off `minWheat`
 * (floor 0). Mash Futures knocks 1 off the largest grain min.
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
  minSpecialtyCask: number;
  minSpecialtyCorn: number;
  minSpecialtyRye: number;
  minSpecialtyBarley: number;
  minSpecialtyWheat: number;
} {
  const recipe = bill.recipe ?? {};
  let minRye = recipe.minRye ?? 0;
  let minBarley = recipe.minBarley ?? 0;
  let minWheat = recipe.minWheat ?? 0;
  // v2.10 Wheated Baron: -1 wheat floor on wheated bills (maxRye === 0).
  if (
    player.distillery?.bonus === "wheated_baron" &&
    recipe.maxRye === 0 &&
    minWheat > 0
  ) {
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
  const sp = recipe.minSpecialty ?? {};
  // v2.10: bake the specialty floor into the per-subtype minimum so
  // `minRye: 0, minSpecialty.rye: 2` reads as "exactly 2 rye, both
  // specialty". A specialty card contributes to BOTH the regular
  // total and the specialty floor (see tallyCard).
  minRye = Math.max(minRye, sp.rye ?? 0);
  minBarley = Math.max(minBarley, sp.barley ?? 0);
  minWheat = Math.max(minWheat, sp.wheat ?? 0);
  const minCorn = Math.max(Math.max(1, recipe.minCorn ?? 0), sp.corn ?? 0);
  // Effective total grain = max(declared, sum of named grain mins, 1).
  // Universal rule guarantees ≥1 grain on every barrel; bills with no
  // grain minimums get an implicit 1-wildcard slot.
  const namedGrainSum = minRye + minBarley + minWheat;
  let minTotalGrain = Math.max(
    recipe.minTotalGrain ?? 0,
    namedGrainSum === 0 ? 1 : namedGrainSum,
  );
  if (player.pendingMakeDiscount === "grain") {
    minTotalGrain = Math.max(1, minTotalGrain - 1);
  }
  return {
    minCorn,
    minRye,
    minBarley,
    minWheat,
    maxRye: recipe.maxRye ?? Infinity,
    maxWheat: recipe.maxWheat ?? Infinity,
    minTotalGrain,
    minSpecialtyCask: sp.cask ?? 0,
    minSpecialtyCorn: sp.corn ?? 0,
    minSpecialtyRye: sp.rye ?? 0,
    minSpecialtyBarley: sp.barley ?? 0,
    minSpecialtyWheat: sp.wheat ?? 0,
  };
}

/**
 * v3.1 — Specialty Cask upgrade detection.
 *
 * The universal "exactly 1 cask" rule + recipes that demand
 * `minSpecialty.cask` create a trap: the player commits an ordinary
 * cask first (satisfying the count), then can't add the required
 * Specialty cask later (cap exceeded). The barrel is permanently
 * stuck — the only escape is ABANDON_BARREL, losing the rest of the
 * pile too.
 *
 * Detect a "swap intent" — the new commit holds exactly 1 Specialty
 * cask, the existing pile holds exactly 1 ordinary cask, and the new
 * commit holds no other cask. Validation accepts the over-commit;
 * apply removes the ordinary cask from the production pile (returned
 * to player.discard) before appending the new commit. Net result:
 * exactly 1 cask source, upgraded ordinary → Specialty, with the
 * displaced card back in rotation.
 */
export function isCaskUpgrade(
  existingCards: readonly Card[],
  newCards: readonly Card[],
): boolean {
  let existingOrdinary = 0;
  let existingSpecialty = 0;
  for (const c of existingCards) {
    if (c.type !== "resource") continue;
    if (!suppliesResource(c, "cask")) continue;
    if (c.specialty) existingSpecialty += 1;
    else existingOrdinary += 1;
  }
  let newOrdinary = 0;
  let newSpecialty = 0;
  for (const c of newCards) {
    if (c.type !== "resource") continue;
    if (!suppliesResource(c, "cask")) continue;
    if (c.specialty) newSpecialty += 1;
    else newOrdinary += 1;
  }
  return (
    existingOrdinary === 1 &&
    existingSpecialty === 0 &&
    newSpecialty === 1 &&
    newOrdinary === 0
  );
}

/**
 * v2.10 — exact-recipe satisfaction check.
 *
 * Returns true iff the cumulative committed pile (production cards on
 * the barrel after this commit) satisfies the universal rule AND
 * **exactly** matches the bill's recipe minimums. Specialty floors
 * are baked into per-subtype mins by `effectiveRecipeMins`, so a
 * specialty card satisfies both its subtype floor and the specialty
 * gate with one card (a single Specialty Rye satisfies
 * `minRye: 1 + minSpecialty.rye: 1`).
 *
 * Exact rule shape: cask/corn/grain-total are EXACT counts; per-grain
 * (rye/barley/wheat) minimums act as **floors** — players can lean
 * any combination of grains into the wildcard portion of
 * `minTotalGrain`, but the total is still the recipe's exact total.
 */
function recipeSatisfied(
  player: PlayerState,
  bill: MashBill,
  totals: ResourceTotals,
): { ok: boolean; reason?: string } {
  // Universal rule: exactly 1 cask source per barrel. Cooper's
  // Contract allows 0.
  const allowZeroCask = player.pendingMakeDiscount === "cask";
  const expectedCask = allowZeroCask ? 0 : 1;
  if (totals.caskSources !== expectedCask) {
    return {
      ok: false,
      reason:
        totals.caskSources < expectedCask
          ? `need ${expectedCask} cask source`
          : "barrel can hold at most 1 cask source",
    };
  }
  const mins = effectiveRecipeMins(player, bill);
  // Corn is exact (every recipe specifies it explicitly or defaults
  // to 1 via the universal rule).
  if (totals.corn !== mins.minCorn)
    return {
      ok: false,
      reason: `recipe requires exactly ${mins.minCorn} corn (have ${totals.corn})`,
    };
  // Per-grain floors. A recipe with `minRye: 2, minTotalGrain: 3`
  // is "2 rye + 1 wildcard grain"; the wildcard can land on any
  // grain (including more rye), but the per-grain caps still apply.
  if (totals.rye < mins.minRye)
    return { ok: false, reason: `recipe requires rye ≥ ${mins.minRye} (have ${totals.rye})` };
  if (totals.barley < mins.minBarley)
    return { ok: false, reason: `recipe requires barley ≥ ${mins.minBarley} (have ${totals.barley})` };
  if (totals.wheat < mins.minWheat)
    return { ok: false, reason: `recipe requires wheat ≥ ${mins.minWheat} (have ${totals.wheat})` };
  if (totals.rye > mins.maxRye)
    return { ok: false, reason: `recipe forbids rye > ${mins.maxRye}` };
  if (totals.wheat > mins.maxWheat)
    return { ok: false, reason: `recipe forbids wheat > ${mins.maxWheat}` };
  // Total grain is exact — no extra cards beyond what the recipe asks.
  const grain = totalGrain(totals);
  if (grain !== mins.minTotalGrain)
    return {
      ok: false,
      reason: `recipe requires exactly ${mins.minTotalGrain} total grain (have ${grain})`,
    };
  // Specialty floors. The +1-rep specialty bonus is encoded as an
  // independent gate so the failure mode is "not enough of the
  // committed cards are Specialty for that subtype".
  if (totals.specialtyCask < mins.minSpecialtyCask)
    return { ok: false, reason: `recipe requires ${mins.minSpecialtyCask} Specialty cask` };
  if (totals.specialtyCorn < mins.minSpecialtyCorn)
    return { ok: false, reason: `recipe requires ${mins.minSpecialtyCorn} Specialty corn` };
  if (totals.specialtyRye < mins.minSpecialtyRye)
    return { ok: false, reason: `recipe requires ${mins.minSpecialtyRye} Specialty rye` };
  if (totals.specialtyBarley < mins.minSpecialtyBarley)
    return { ok: false, reason: `recipe requires ${mins.minSpecialtyBarley} Specialty barley` };
  if (totals.specialtyWheat < mins.minSpecialtyWheat)
    return { ok: false, reason: `recipe requires ${mins.minSpecialtyWheat} Specialty wheat` };
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
  const banRye = player.distillery?.bonus === "wheated_baron";
  for (const id of action.cardIds) {
    const card = cardById.get(id)!;
    if (card.type !== "resource" && card.type !== "capital") {
      return { legal: false, reason: `card ${id} cannot be committed to a barrel` };
    }
    // v2.10 Wheated Baron: rye cards cannot be committed to barrels.
    // The card stays legal at the market and in trades.
    if (banRye && card.type === "resource" && card.subtype === "rye") {
      return {
        legal: false,
        reason: "Wheated Baron cannot commit rye cards to a barrel",
      };
    }
    tallyCard(totals, card);
  }

  const mins = effectiveRecipeMins(player, existingBarrel.attachedMashBill);
  const newCards = action.cardIds.map((id) => cardById.get(id)!);

  // v2.10 specialty-cask exclusivity: when the recipe requires a
  // Specialty cask, plain casks are never legal — committing one
  // forecloses the slot since the universal rule allows exactly one
  // cask source. Reject the commit (and any pile that already holds
  // a plain cask) up front instead of letting it die at completion.
  if (mins.minSpecialtyCask >= 1) {
    const hasPlainCask = (cards: readonly Card[]): boolean =>
      cards.some(
        (c) => c.type === "resource" && suppliesResource(c, "cask") && !c.specialty,
      );
    if (hasPlainCask(existingBarrel.productionCards) || hasPlainCask(newCards)) {
      return {
        legal: false,
        reason: "recipe requires a Specialty cask — plain casks are not allowed",
      };
    }
  }

  // Hard upper limit on cask count — block over-commits that would
  // strand the barrel. Exception: a Specialty Cask upgrade (swap
  // intent) is allowed even though the raw cask count goes to 2 —
  // apply will splice the existing ordinary cask out and return it
  // to discard. (Upgrade can't fire when minSpecialtyCask gates the
  // recipe — that path is closed off above so plain cask never lands
  // in the pile.)
  if (totals.caskSources > 1) {
    if (!isCaskUpgrade(existingBarrel.productionCards, newCards)) {
      return { legal: false, reason: "barrel can hold at most 1 cask source" };
    }
  }

  // v2.10 exact-recipe over-commit guards. Cask, corn, and grain
  // total are exact counts — any commit that would push them past
  // the recipe strands the barrel, so we reject early instead of
  // forcing the player into ABANDON_BARREL. Per-grain mins stay
  // floors; the wildcard portion of `minTotalGrain` can land on any
  // grain (subject to the recipe's per-grain caps).
  //
  // Per-grain caps (maxRye / maxWheat) are checked FIRST so the
  // error message accurately attributes the failure — e.g. a
  // wheated bill (maxRye: 0) reports "no rye" rather than a generic
  // "too many grain" when the player tried to commit a rye.
  if (totals.rye > mins.maxRye) {
    return { legal: false, reason: `recipe forbids rye > ${mins.maxRye}` };
  }
  if (totals.wheat > mins.maxWheat) {
    return { legal: false, reason: `recipe forbids wheat > ${mins.maxWheat}` };
  }
  if (totals.corn > mins.minCorn)
    return {
      legal: false,
      reason: `recipe requires exactly ${mins.minCorn} corn (would have ${totals.corn})`,
    };
  const grain = totals.rye + totals.barley + totals.wheat;
  if (grain > mins.minTotalGrain)
    return {
      legal: false,
      reason: `recipe requires exactly ${mins.minTotalGrain} total grain (would have ${grain})`,
    };

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

  // v3.1: Specialty Cask upgrade. If validation accepted the commit
  // because it's a swap intent (1 ordinary cask in the pile, 1
  // Specialty cask incoming, no other casks), splice the existing
  // ordinary cask OUT and return it to the player's discard before
  // appending the new pile. The completion check below then sees
  // exactly 1 cask source (the Specialty), recipe satisfied.
  if (isCaskUpgrade(barrel.productionCards, newCards)) {
    const idx = barrel.productionCards.findIndex(
      (c) => c.type === "resource" && suppliesResource(c, "cask") && !c.specialty,
    );
    if (idx !== -1) {
      const removed = barrel.productionCards[idx]!;
      barrel.productionCards.splice(idx, 1);
      barrel.productionCardDefIds.splice(idx, 1);
      player.discard.push(removed);
    }
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
