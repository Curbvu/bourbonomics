import type { Draft } from "immer";
import type { Card, GameAction, GameState, MashBill, ValidationResult } from "../types";
import { mashBillCost } from "../types";
import { paymentValue } from "../cards";
import { emptySlotsFor, isCurrentPlayer, slottedBillCount } from "../state";
import { placeBillInSlot } from "../starter-pool";

type DrawMashBillAction = Extract<GameAction, { type: "DRAW_MASH_BILL" }>;

const FACEUP_BOURBON_SIZE = 3;

/**
 * v2.6 — DRAW_MASH_BILL routes the drawn bill straight into one of the
 * player's open rickhouse slots as a "ready" barrel. Without an open
 * slot, the action is illegal: slot capacity is the gating resource on
 * the doomsday clock.
 *
 * Two flavors as before:
 *   - targeted face-up pick: pick one of the 3 face-up bills, pay
 *     ≥ `mashBillCost(bill)` with hand cards (capital cards pay face).
 *   - blind draw: pop the top of the bourbon deck for exactly 1 card.
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

  const spendIds = action.spendCardIds;
  if (spendIds.length === 0) {
    return { legal: false, reason: "must spend at least one card" };
  }
  if (new Set(spendIds).size !== spendIds.length) {
    return { legal: false, reason: "duplicate card id in spend list" };
  }
  const handIds = new Set(player.hand.map((c) => c.id));
  for (const id of spendIds) {
    if (!handIds.has(id)) {
      return { legal: false, reason: `card ${id} is not in your hand` };
    }
  }

  if (action.mashBillId) {
    // Targeted face-up pick.
    const bill = state.bourbonFaceUp.find((b) => b.id === action.mashBillId);
    if (!bill) {
      return {
        legal: false,
        reason: `mash bill ${action.mashBillId} is not in the face-up row`,
      };
    }
    const cost = mashBillCost(bill);
    let totalCapital = 0;
    for (const id of spendIds) {
      const card = player.hand.find((c) => c.id === id)!;
      totalCapital += paymentValue(card);
    }
    if (totalCapital < cost) {
      return {
        legal: false,
        reason: `spent value is B$${totalCapital}, need B$${cost}`,
      };
    }
    return { legal: true };
  }

  // Blind draw — exactly 1 card paid, top of deck.
  if (spendIds.length !== 1) {
    return {
      legal: false,
      reason: "blind draw spends exactly 1 card (or pick a face-up bill instead)",
    };
  }
  if (state.bourbonDeck.length === 0) {
    return { legal: false, reason: "the bourbon deck is empty" };
  }
  return { legal: true };
}

export function applyDrawMashBill(
  draft: Draft<GameState>,
  action: DrawMashBillAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;

  // Move spent cards from hand → discard.
  const spendSet = new Set(action.spendCardIds);
  const newHand: Card[] = [];
  const spent: Card[] = [];
  for (const c of player.hand) {
    if (spendSet.has(c.id)) spent.push(c);
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
    acquired = draft.bourbonDeck.pop()!;
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
