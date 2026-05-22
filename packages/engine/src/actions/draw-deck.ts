import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  MashBill,
  ValidationResult,
} from "../types";
import { billCostByTier, laborContribution } from "../types";
import { emptySlotsFor, isCurrentPlayer, slottedBillCount } from "../state";
import { placeBillInSlot } from "../starter-pool";

type DrawMashBillAction = Extract<GameAction, { type: "DRAW_MASH_BILL" }>;

const FACEUP_BOURBON_SIZE = 3;
const BLIND_DRAW_COST = 1;

/**
 * DRAW_MASH_BILL routes the drawn bill straight into one of the
 * player's open rickhouse slots as a "ready" barrel. Without an open
 * slot, the action is illegal: slot capacity is the gating resource on
 * the doomsday clock.
 *
 * Unified payment follows the same rep + Labor rules as market and
 * ops buys — rep and Labor are fully fungible:
 *   - face-up pick: `billCostByTier(bill)` (1/1/2/3/4 by rarity).
 *   - blind draw: 1.
 *   - Labor cards supplement via `laborContribution(card, "bill_draw")`.
 *     Generic Labor (any-domain) contributes 1; Specialty Labor only
 *     helps when its domain matches "bill_draw" (no such card ships
 *     yet — reserved space for a future Distiller worker).
 */
export function validateDrawMashBill(
  state: GameState,
  action: DrawMashBillAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  // v2.6: drawing a bill requires an open slot to land it in.
  if (emptySlotsFor(state, player.id).length === 0) {
    return { legal: false, reason: "no open slot to receive the bill" };
  }
  // v2.6 Connoisseur Estate: cap slotted bills at maxSlottedBills.
  const billCap = player.distillery?.maxSlottedBills;
  if (billCap !== undefined && slottedBillCount(state, player.id) >= billCap) {
    return {
      legal: false,
      reason: `${player.distillery!.name} caps slotted bills at ${billCap}`,
    };
  }

  if (!Number.isInteger(action.rep) || action.rep < 0) {
    return { legal: false, reason: "rep payment must be a non-negative integer" };
  }
  if (action.rep > player.reputation) {
    return {
      legal: false,
      reason: `not enough reputation: have ${player.reputation}, paying ${action.rep}`,
    };
  }

  // Validate Labor cards — in hand, Labor type, unique.
  const laborIds = action.laborCardIds;
  if (new Set(laborIds).size !== laborIds.length) {
    return { legal: false, reason: "duplicate Labor card id in payment" };
  }
  const handById = new Map(player.hand.map((c) => [c.id, c]));
  let laborTotal = 0;
  for (const id of laborIds) {
    const card = handById.get(id);
    if (!card) return { legal: false, reason: `card ${id} is not in your hand` };
    if (card.type !== "labor") {
      return { legal: false, reason: `card ${id} is not a Labor card` };
    }
    laborTotal += laborContribution(card, "bill_draw");
  }

  let cost: number;
  if (action.mashBillId) {
    const bill = state.bourbonFaceUp.find((b) => b.id === action.mashBillId);
    if (!bill) {
      return {
        legal: false,
        reason: `mash bill ${action.mashBillId} is not in the face-up row`,
      };
    }
    // v2.10 High-Rye House: cannot draft wheated bills (maxRye === 0).
    if (
      player.distillery?.bonus === "high_rye_house" &&
      bill.recipe?.maxRye === 0
    ) {
      return {
        legal: false,
        reason: "High-Rye House cannot draft wheated bills",
      };
    }
    cost = billCostByTier(bill);
  } else {
    cost = BLIND_DRAW_COST;
    if (state.bourbonDeck.length === 0) {
      return { legal: false, reason: "the bourbon deck is empty" };
    }
  }

  const total = action.rep + laborTotal;
  if (total < cost) {
    return {
      legal: false,
      reason: `payment totals ${total}, need ${cost}`,
    };
  }
  return { legal: true };
}

export function applyDrawMashBill(
  draft: Draft<GameState>,
  action: DrawMashBillAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  player.reputation -= action.rep;

  // Discard any Labor cards used as payment.
  const laborSet = new Set(action.laborCardIds);
  const newHand: Card[] = [];
  const spent: Card[] = [];
  for (const c of player.hand) {
    if (laborSet.has(c.id)) spent.push(c);
    else newHand.push(c);
  }
  player.hand = newHand;
  player.discard.push(...spent);

  let acquired: MashBill;
  if (action.mashBillId) {
    const idx = draft.bourbonFaceUp.findIndex((b) => b.id === action.mashBillId);
    [acquired] = draft.bourbonFaceUp.splice(idx, 1) as [MashBill];
    // Refill the face-up row from the top of the deck if any remain
    // and we're under the cap.
    while (
      draft.bourbonFaceUp.length < FACEUP_BOURBON_SIZE &&
      draft.bourbonDeck.length > 0
    ) {
      const next = draft.bourbonDeck.pop()!;
      draft.bourbonFaceUp.push(next);
    }
  } else {
    // Blind draw — top of deck = end of array.
    // v2.10 High-Rye House: skip wheated bills (maxRye === 0). Pushed
    // to the bottom; we keep popping until a legal bill turns up or
    // the deck is empty.
    acquired = draft.bourbonDeck.pop()!;
    if (player.distillery?.bonus === "high_rye_house") {
      let safety = draft.bourbonDeck.length + 4;
      while (acquired.recipe?.maxRye === 0 && safety-- > 0) {
        draft.bourbonDeck.unshift(acquired);
        if (draft.bourbonDeck.length === 0) break;
        acquired = draft.bourbonDeck.pop()!;
      }
    }
  }

  // v2.6: bill goes directly into an open slot as a "ready" barrel.
  // Validation guaranteed at least one open slot exists.
  placeBillInSlot(draft, player, acquired);

  // Final-round trigger: deck empty AND face-up empty.
  if (
    draft.bourbonDeck.length === 0 &&
    draft.bourbonFaceUp.length === 0 &&
    !draft.finalRoundTriggered
  ) {
    draft.finalRoundTriggered = true;
    draft.finalRoundTriggerPlayerIndex = draft.currentPlayerIndex;
  }
  // v2.2: drawing a mash bill does NOT end the player's turn.
}
