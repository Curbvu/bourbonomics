import type {
  Barrel,
  Card,
  Distillery,
  GameAction,
  GameState,
  MashBill,
  PlayerState,
  ValidationResult,
} from "../types";
import { isWheatedBill, saleFloorForBill } from "../types";
import type { Draft } from "immer";
import type { SaleEffectSignals } from "../card-effects";
import { collectSaleSignals } from "../card-effects";
import { drawWithReshuffle } from "../deck";
import { awardConditionMet, computeReward } from "../rewards";
import { isCurrentPlayer } from "../state";

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

  // Sale is single-step — no split prompt. The computed total rep
  // (grid + bonuses, clamped to tier floor) lands on the player's
  // rep track.
  const reward = computeSaleReward(state, barrel);
  const goldEligible =
    barrel.attachedMashBill.goldAward != null &&
    awardConditionMet(barrel.attachedMashBill.goldAward, barrel.age, state.demand, reward);

  if (goldEligible && action.goldChoice === "convert") {
    if (!action.goldConvertTargetSlotId) {
      return {
        legal: false,
        reason: "Gold Convert needs a target slot id",
      };
    }
    if (action.goldConvertTargetSlotId === barrel.slotId) {
      return {
        legal: false,
        reason: "Gold Convert target must be a different slot than the selling barrel",
      };
    }
    const targetSlot = player.rickhouseSlots.find(
      (s) => s.id === action.goldConvertTargetSlotId,
    );
    if (!targetSlot) {
      return {
        legal: false,
        reason: "Gold Convert target slot is not in your rickhouse",
      };
    }
    const targetBarrel = state.allBarrels.find(
      (b) => b.id !== barrel.id && b.ownerId === player.id && b.slotId === action.goldConvertTargetSlotId,
    );
    if (!targetBarrel) {
      // v2.10 Connoisseur Estate: Open-slot Convert. Target slot is
      // empty — the Gold bill lands there as a "ready" barrel.
      if (player.distillery?.bonus !== "connoisseur_estate") {
        return {
          legal: false,
          reason: "Gold Convert needs a target slot holding a bill",
        };
      }
      // Open-slot Convert has no committed cards to validate against
      // — no recipe check needed.
    } else if (!convertCommitsSatisfyRecipe(player, targetBarrel, barrel.attachedMashBill)) {
      return {
        legal: false,
        reason: "target slot's committed cards don't satisfy the Gold bill's recipe",
      };
    }
  }

  return { legal: true };
}

/**
 * v2.6: helper used by both validate and apply to compute the grid
 * reward of the sale. The reward is keyed off the barrel's currently-
 * attached bill (no goldBourbonId override anymore — Gold awards now
 * manipulate slots, not reward calculation).
 */
function computeSaleReward(state: GameState, barrel: Barrel): number {
  const signals = collectSaleSignals(barrel, { demand: state.demand });
  return computeSaleGridReward(
    barrel.attachedMashBill,
    barrel,
    state.demand,
    signals,
  );
}

/**
 * v2.10 Gold Convert: returns true iff the target slot's committed
 * production cards **exactly** match the candidate (Gold) bill's
 * recipe. Mirrors `make-bourbon.recipeSatisfied` under exact-recipe
 * semantics — specialty floors are baked into per-subtype mins
 * (specialty rye counts as plain rye + specialty), and any subtype
 * past its effective min disqualifies the slot. Specialty-cask
 * exclusivity also applies: if the Gold recipe wants a Specialty
 * cask, a plain cask in the target slot's pile blocks the Convert.
 */
function convertCommitsSatisfyRecipe(
  player: PlayerState,
  target: Barrel,
  candidate: MashBill,
): boolean {
  const recipe = candidate.recipe ?? {};
  let caskSources = 0;
  let plainCaskSources = 0;
  let corn = 0,
    rye = 0,
    barley = 0,
    wheat = 0;
  let spCask = 0,
    spCorn = 0,
    spRye = 0,
    spBarley = 0,
    spWheat = 0;
  for (const card of target.productionCards) {
    if (card.type !== "resource") continue;
    const count = card.resourceCount ?? 1;
    if (card.subtype === "cask") {
      caskSources += count;
      if (!card.specialty) plainCaskSources += count;
    }
    if (card.subtype === "corn") corn += count;
    if (card.subtype === "rye") rye += count;
    if (card.subtype === "barley") barley += count;
    if (card.subtype === "wheat") wheat += count;
    if (card.specialty) {
      if (card.subtype === "cask") spCask += count;
      if (card.subtype === "corn") spCorn += count;
      if (card.subtype === "rye") spRye += count;
      if (card.subtype === "barley") spBarley += count;
      if (card.subtype === "wheat") spWheat += count;
    }
  }
  const sp = recipe.minSpecialty ?? {};
  // Specialty floors get rolled into the per-subtype minimum so
  // "exact" lines up with backwards-compat specialty (one Specialty
  // Rye satisfies both `minRye: 1` and `minSpecialty.rye: 1`).
  const minCorn = Math.max(Math.max(1, recipe.minCorn ?? 0), sp.corn ?? 0);
  const minRye = Math.max(recipe.minRye ?? 0, sp.rye ?? 0);
  const minBarley = Math.max(recipe.minBarley ?? 0, sp.barley ?? 0);
  const minWheat = Math.max(recipe.minWheat ?? 0, sp.wheat ?? 0);
  const maxRye = recipe.maxRye ?? Infinity;
  const maxWheat = recipe.maxWheat ?? Infinity;
  const namedGrainSum = minRye + minBarley + minWheat;
  const minTotal = Math.max(
    recipe.minTotalGrain ?? 0,
    namedGrainSum === 0 ? 1 : namedGrainSum,
  );
  const grain = rye + barley + wheat;
  if (caskSources !== 1) return false;
  // Specialty-cask exclusivity: Gold recipe wants Specialty, target
  // has plain — Convert fails.
  if ((sp.cask ?? 0) >= 1 && plainCaskSources > 0) return false;
  // Corn is exact; per-grain are floors; total grain is exact.
  if (corn !== minCorn) return false;
  if (rye < minRye) return false;
  if (barley < minBarley) return false;
  if (wheat < minWheat) return false;
  if (rye > maxRye || wheat > maxWheat) return false;
  if (grain !== minTotal) return false;
  // v2.7.2: per-subtype Specialty requirements.
  if (spCask < (sp.cask ?? 0)) return false;
  if (spCorn < (sp.corn ?? 0)) return false;
  if (spRye < (sp.rye ?? 0)) return false;
  if (spBarley < (sp.barley ?? 0)) return false;
  if (spWheat < (sp.wheat ?? 0)) return false;
  return true;
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

  // Collect themed-card sale signals BEFORE any mutation so the
  // computed reward + bonus rep + return-to-hand list match what
  // validation accepted.
  const signals = collectSaleSignals(barrel, { demand: draft.demand });
  const reward = computeSaleGridReward(attached, barrel, draft.demand, signals);

  // single-step sale. Sum everything that adds
  // rep at sale — grid reward, themed-card per-card bonuses, Rating
  // Boost, distillery sale mods (e.g. High-Rye +1) — then clamp to
  // the bill's tier floor (3/4/5) so every sale clears its baseline.
  const ratingBoost = player.pendingRatingBoost;
  const distilleryBonusRep = distillerySaleBonusRep(player.distillery, attached);
  const rawTotal = reward + signals.bonusRep + ratingBoost + distilleryBonusRep;
  const floor = saleFloorForBill(attached);
  const total = Math.max(rawTotal, floor);
  player.reputation += total;
  // Consume the boost — one-shot per sale.
  if (ratingBoost > 0) player.pendingRatingBoost = 0;

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
  // `returns_to_hand_on_sale` go back to hand; everything else hits
  // the discard pile.
  const allBarrelCards: Card[] = [...barrel.productionCards, ...barrel.agingCards];
  for (const c of allBarrelCards) {
    if (signals.returnsToHand.has(c.id)) {
      player.hand.push(c);
    } else {
      player.discard.push(c);
    }
  }

  // ---------------------------------------------------------------
  // v2.6 Award + slot resolution
  // ---------------------------------------------------------------
  // Silver: bill stays in the now-empty slot as a "ready" barrel
  //         (slot doesn't open).
  // Gold:   player's `goldChoice` decides:
  //           - "convert" → replace another slot's bill with this
  //             one; selling slot opens fully.
  //           - "keep"    → bill stays in selling slot (Silver-style).
  //           - "decline" → bill to discard; selling slot opens fully.
  // None:   bill to discard, slot opens fully.
  const goldEligible =
    attached.goldAward != null &&
    awardConditionMet(attached.goldAward, barrel.age, draft.demand, reward);
  const silverEligible =
    !goldEligible &&
    attached.silverAward != null &&
    awardConditionMet(attached.silverAward, barrel.age, draft.demand, reward);

  if (goldEligible) {
    const choice = action.goldChoice ?? "decline";
    if (choice === "convert" && action.goldConvertTargetSlotId) {
      const target = draft.allBarrels.find(
        (b) =>
          b.id !== barrel.id &&
          b.ownerId === player.id &&
          b.slotId === action.goldConvertTargetSlotId,
      );
      if (target) {
        // Replaced bill goes to bourbon discard. Cards already on
        // the target slot stay put (validation guaranteed they
        // satisfy the Gold recipe). If those cards now satisfy as
        // a complete recipe, the target stays in its current phase
        // — Convert doesn't "freshly complete" a barrel.
        draft.bourbonDiscard.push(target.attachedMashBill);
        target.attachedMashBill = attached;
      } else {
        // v2.10 Connoisseur Estate: Open-slot Convert. Target slot
        // has no barrel — mint a fresh "ready" barrel there with
        // the Gold bill attached. Validation guaranteed the slot
        // belongs to the player and the player has the
        // connoisseur_estate distillery.
        const newBarrelId = `barrel_${draft.idCounter++}`;
        draft.allBarrels.push({
          id: newBarrelId,
          ownerId: player.id,
          slotId: action.goldConvertTargetSlotId,
          phase: "ready",
          completedInRound: null,
          attachedMashBill: attached,
          productionCardDefIds: [],
          productionCards: [],
          agingCards: [],
          age: 0,
          productionRound: draft.round,
          agedThisRound: false,
          inspectedThisRound: false,
          extraAgesAvailable: 0,
          gridRepOffset: 0,
          demandBandOffset: 0,
        });
      }
      // Selling slot opens fully (barrel record removed below).
      draft.allBarrels.splice(barrelIdx, 1);
    } else if (choice === "keep") {
      // Bill stays in the selling slot as a "ready" barrel — same
      // shape as Silver but produced by a Gold qualifier.
      retainBillInSlot(barrel, draft.round);
    } else {
      // "decline" — bill to discard, slot opens fully.
      draft.bourbonDiscard.push(attached);
      draft.allBarrels.splice(barrelIdx, 1);
    }
  } else if (silverEligible) {
    // v2.6 Silver: bill stays in the now-empty slot.
    retainBillInSlot(barrel, draft.round);
  } else {
    // No award — bill to discard, slot opens fully.
    draft.bourbonDiscard.push(attached);
    draft.allBarrels.splice(barrelIdx, 1);
  }

  player.barrelsSold += 1;

  // Demand drops by 1 unless Demand Surge absorbs it or a sale-
  // effect (Heirloom Wheat's `skip_demand_drop`) cancels the drop.
  if (player.demandSurgeActive) {
    player.demandSurgeActive = false;
  } else if (signals.skipDemandDrop) {
    // No-op — drop cancelled.
  } else if (draft.demand > 0) {
    draft.demand -= 1;
  }
  // v2.2: selling does NOT end the player's turn.
}

/**
 * Reset the sold barrel into a "ready" state so the bill stays in
 * the slot. Used by Silver and by Gold's "keep" option. Cards have
 * already been distributed (productionCards/agingCards drained
 * above), so we just zero the recordkeeping.
 */
function retainBillInSlot(barrel: Draft<Barrel>, round: number): void {
  barrel.phase = "ready";
  barrel.completedInRound = null;
  barrel.productionCards = [];
  barrel.productionCardDefIds = [];
  barrel.agingCards = [];
  barrel.age = 0;
  barrel.productionRound = round;
  barrel.agedThisRound = false;
  barrel.inspectedThisRound = false;
  barrel.extraAgesAvailable = 0;
  barrel.gridRepOffset = 0;
  barrel.demandBandOffset = 0;
}
