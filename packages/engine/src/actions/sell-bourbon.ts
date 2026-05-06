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
import { isWheatedBill } from "../types";
import type { Draft } from "immer";
import type { SaleEffectSignals } from "../card-effects";
import { collectSaleSignals } from "../card-effects";
import type { CompositionBuffSignals } from "../composition";
import { computeCompositionBuffs } from "../composition";
import { drawWithReshuffle } from "../deck";
import { awardConditionMet, computeReward } from "../rewards";
import { isCurrentPlayer } from "../state";

type SellBourbonAction = Extract<GameAction, { type: "SELL_BOURBON" }>;

const MIN_SELL_AGE = 2;

/**
 * Compute the grid reward for a barrel with all sale-time offsets
 * folded in: themed-card sale signals (Toasted Oak, Single Barrel
 * Cask), barrel-attached offsets (Master Distiller), and v2.4
 * composition buffs (single-grain demand-band shift).
 *
 * Used by both validate (to derive the expected split total) and
 * apply (to score the actual reward) — keeping them in sync.
 */
function computeSaleGridReward(
  bill: MashBill,
  barrel: Pick<Barrel, "age" | "gridRepOffset" | "demandBandOffset">,
  demand: number,
  signals: SaleEffectSignals,
  composition: CompositionBuffSignals,
): number {
  return computeReward(bill, barrel.age, demand, {
    demandBandOffset:
      signals.gridDemandBandOffset +
      barrel.demandBandOffset +
      composition.gridDemandBandOffset,
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
  // barrels haven't aged and use ABANDON_BARREL to recover cards.
  if (barrel.phase !== "aging") {
    return { legal: false, reason: "barrel is still under construction" };
  }
  if (barrel.age < MIN_SELL_AGE) {
    return { legal: false, reason: `barrel must be aged at least ${MIN_SELL_AGE} years` };
  }

  // v2.7.1: selling costs 1 card from hand (any resource or capital).
  const spend = player.hand.find((c) => c.id === action.spendCardId);
  if (!spend) {
    return { legal: false, reason: "selling a barrel costs 1 card from your hand" };
  }
  if (spend.type !== "resource" && spend.type !== "capital") {
    return { legal: false, reason: "sell-action card must be a resource or capital card" };
  }

  const reward = computeSaleReward(state, barrel, player.distillery);

  if (
    !Number.isInteger(action.reputationSplit) ||
    !Number.isInteger(action.cardDrawSplit)
  ) {
    return { legal: false, reason: "splits must be integers" };
  }
  if (action.reputationSplit < 0 || action.cardDrawSplit < 0) {
    return { legal: false, reason: "splits must be non-negative" };
  }
  if (action.reputationSplit + action.cardDrawSplit !== reward) {
    return {
      legal: false,
      reason: `splits sum to ${
        action.reputationSplit + action.cardDrawSplit
      }, expected reward of ${reward}`,
    };
  }

  // v2.6 Gold-award option validation. Only matters when the sale
  // would actually trigger a Gold; otherwise goldChoice is ignored.
  const goldEligible =
    barrel.attachedMashBill.goldAward != null &&
    awardConditionMet(barrel.attachedMashBill.goldAward, barrel.age, state.demand, reward);
  if (goldEligible && action.goldChoice === "convert") {
    const target = state.allBarrels.find(
      (b) => b.id !== barrel.id && b.ownerId === player.id && b.slotId === action.goldConvertTargetSlotId,
    );
    if (!target) {
      return {
        legal: false,
        reason: "Gold Convert needs a target slot — must be your own slot, not the selling slot, holding a bill",
      };
    }
    if (!convertCommitsSatisfyRecipe(player, target, barrel.attachedMashBill)) {
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
function computeSaleReward(
  state: GameState,
  barrel: Barrel,
  distillery: Distillery | null,
): number {
  const signals = collectSaleSignals(barrel, { demand: state.demand });
  const composition = computeCompositionBuffs(barrel, distillery);
  return computeSaleGridReward(
    barrel.attachedMashBill,
    barrel,
    state.demand,
    signals,
    composition,
  );
}

/**
 * v2.6 Gold Convert: returns true iff the target slot's committed
 * production cards satisfy the candidate (Gold) bill's recipe — i.e.
 * the cards already on the slot would have been a legal completion
 * for the new recipe. We DON'T re-fire commit-time effects; the
 * cards stay where they are, only the bound bill changes.
 */
function convertCommitsSatisfyRecipe(
  player: PlayerState,
  target: Barrel,
  candidate: MashBill,
): boolean {
  // Reuse the make-bourbon recipe-satisfaction check by tallying the
  // existing pile against the candidate bill. Imported lazily to keep
  // sell-bourbon.ts free of a circular dep on make-bourbon internals.
  const recipe = candidate.recipe ?? {};
  let caskSources = 0;
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
    if (card.subtype === "cask") caskSources += count;
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
  const minCorn = Math.max(1, recipe.minCorn ?? 0);
  let minRye = recipe.minRye ?? 0;
  let minBarley = recipe.minBarley ?? 0;
  let minWheat = recipe.minWheat ?? 0;
  if (player.distillery?.bonus === "wheated_baron" && isWheatedBill(candidate)) {
    minWheat = Math.max(0, minWheat - 1);
  }
  const maxRye = recipe.maxRye ?? Infinity;
  const maxWheat = recipe.maxWheat ?? Infinity;
  const minTotal = Math.max(recipe.minTotalGrain ?? 0, 1);
  const grain = rye + barley + wheat;
  if (caskSources < 1 || caskSources > 1) return false;
  if (corn < minCorn) return false;
  if (rye < minRye || barley < minBarley || wheat < minWheat) return false;
  if (rye > maxRye || wheat > maxWheat) return false;
  if (grain < minTotal) return false;
  // v2.7.2: per-subtype Specialty requirements.
  const sp = recipe.minSpecialty ?? {};
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
  if (mod.kind === "high_rye" && (bill.recipe?.minRye ?? 0) >= 2) return mod.rep;
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

  // v2.7.1: pay the sell-action cost — 1 card from hand → discard.
  // Validation guarantees the card exists and is resource/capital.
  const spendIdx = player.hand.findIndex((c) => c.id === action.spendCardId);
  const [spend] = player.hand.splice(spendIdx, 1) as [Card];
  player.discard.push(spend);

  // Collect themed-card sale signals BEFORE any mutation so the
  // computed reward + bonus rep + return-to-hand list match what
  // validation accepted. v2.4 composition buffs read the same
  // committed-card pile and contribute parallel signals.
  const signals = collectSaleSignals(barrel, { demand: draft.demand });
  const composition = computeCompositionBuffs(barrel, player.distillery);
  const reward = computeSaleGridReward(attached, barrel, draft.demand, signals, composition);

  // Apply reputation gain. Five components stack on top of the
  // player-driven split: themed-card flat bonuses, themed-card
  // conditional bonuses (already in `signals.bonusRep`), the
  // pre-played Rating Boost flag, v2.4 composition buffs (3+ cask,
  // all-four-grains), and v2.4 distillery sale mods (e.g. High-Rye
  // House: +1 rep on a high-rye bill).
  const ratingBoost = player.pendingRatingBoost;
  const distilleryBonusRep = distillerySaleBonusRep(player.distillery, attached);
  player.reputation +=
    action.reputationSplit +
    signals.bonusRep +
    ratingBoost +
    composition.bonusRep +
    distilleryBonusRep;
  // Consume the boost — one-shot per sale.
  if (ratingBoost > 0) player.pendingRatingBoost = 0;

  // Mid-action card draw: drawn cards go straight into hand.
  // `bonusDraw` from sale effects (e.g. Six-Row Barley) and the
  // v2.4 composition 3+ corn buff both stack here.
  const drawCount =
    action.cardDrawSplit + signals.bonusDraw + composition.bonusDraw;
  if (drawCount > 0) {
    const result = drawWithReshuffle(
      player.deck.slice(),
      player.discard.slice(),
      drawCount,
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
        // Defensive: validation should have caught this. Fall back
        // to discarding the bill so we don't leak it.
        draft.bourbonDiscard.push(attached);
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

  // Demand drops by 1 unless Demand Surge absorbs it, a sale-effect
  // (Heirloom Wheat's `skip_demand_drop`) cancels the drop, or the
  // v2.4 composition 2+ capital buff cancels it.
  if (player.demandSurgeActive) {
    player.demandSurgeActive = false;
  } else if (signals.skipDemandDrop || composition.skipDemandDrop) {
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
