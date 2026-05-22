import type { Draft } from "immer";
import type {
  Card,
  DraftingLoopState,
  GameAction,
  GameState,
  MashBill,
  ValidationResult,
} from "../types";
import { shuffleCards } from "../deck";
import {
  emptySlotsFor,
  isCurrentPlayer,
  maybeTriggerFinalRound,
  slottedBillCount,
} from "../state";
import { placeBillInSlot } from "../starter-pool";

// v2.14 "The Drafting Loop"
// -------------------------
// Bill acquisition is a table event. The active player places one card
// from hand on the table to start the draft pile, reveals 3 bills from
// the top of the bourbon deck, and takes 0–N bills (paying one more card
// from hand per bill, capped by their Open slots). The pile then passes
// left; each subsequent picker may scavenge any cards from the pile AND
// then take any remaining bills. When the pile returns to the initiator
// the loop closes: leftover bills shuffle into the bourbon deck;
// leftover cards go to the market discard.
//
// State machine:
//   INITIATE_DRAFTING_LOOP creates `state.draftingLoop`. The sub-phase
//   is modal — `validateAction` rejects everything except DRAFT_* until
//   the loop closes. The current picker (`loop.pickOrder[pickerIndex]`)
//   may not be the current player; the loop simply rotates the active
//   picker around the table while the initiator's turn stays in
//   progress.

const REVEAL_COUNT = 3;

type InitiateAction = Extract<GameAction, { type: "INITIATE_DRAFTING_LOOP" }>;
type TakeBillAction = Extract<GameAction, { type: "DRAFT_TAKE_BILL" }>;
type TakeCardAction = Extract<GameAction, { type: "DRAFT_TAKE_CARD" }>;
type PassAction = Extract<GameAction, { type: "DRAFT_PASS" }>;

// ---------------------------------------------------------------
// INITIATE_DRAFTING_LOOP
// ---------------------------------------------------------------

export function validateInitiateDraftingLoop(
  state: GameState,
  action: InitiateAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  if (state.draftingLoop !== null) {
    return { legal: false, reason: "a Drafting Loop is already in progress" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  // Illegal in the final round (matches Trade).
  if (state.finalRoundTriggered) {
    return {
      legal: false,
      reason: "the Drafting Loop is not legal in the final round",
    };
  }
  if (player.draftingLoopUsedThisRound) {
    return {
      legal: false,
      reason: "you have already initiated the Drafting Loop this round",
    };
  }
  if (state.bourbonDeck.length === 0) {
    return { legal: false, reason: "the bourbon deck is empty" };
  }
  const card = player.hand.find((c) => c.id === action.cardId);
  if (!card) {
    return { legal: false, reason: `card ${action.cardId} is not in your hand` };
  }
  return { legal: true };
}

export function applyInitiateDraftingLoop(
  draft: Draft<GameState>,
  action: InitiateAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const cardIdx = player.hand.findIndex((c) => c.id === action.cardId);
  const [card] = player.hand.splice(cardIdx, 1) as [Card];

  // Reveal up to 3 bills from the top of the deck (array tail).
  const revealCount = Math.min(REVEAL_COUNT, draft.bourbonDeck.length);
  const revealedBills: MashBill[] = [];
  for (let i = 0; i < revealCount; i++) {
    revealedBills.push(draft.bourbonDeck.pop()!);
  }

  // Pick order: every player, starting at the initiator, clockwise.
  const initiatorIdx = draft.players.findIndex((p) => p.id === action.playerId);
  const pickOrder = rotateFrom(
    draft.players.map((p) => p.id),
    initiatorIdx,
  );

  const loop: DraftingLoopState = {
    initiatorId: action.playerId,
    pickOrder,
    pickerIndex: 0,
    // Initiator starts at "bill" — they cannot scavenge their own
    // initial card back. Subsequent pickers will get a fresh "card"
    // stage when the cursor lands on them (see applyDraftPass).
    pickerStage: "bill",
    draftPile: [card],
    revealedBills,
  };
  draft.draftingLoop = loop;
  player.draftingLoopUsedThisRound = true;
}

// ---------------------------------------------------------------
// DRAFT_TAKE_BILL
// ---------------------------------------------------------------

export function validateDraftTakeBill(
  state: GameState,
  action: TakeBillAction,
): ValidationResult {
  const loop = state.draftingLoop;
  if (loop === null) {
    return { legal: false, reason: "no Drafting Loop in progress" };
  }
  const pickerId = loop.pickOrder[loop.pickerIndex];
  if (action.playerId !== pickerId) {
    return { legal: false, reason: `it is ${pickerId}'s pick, not yours` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  const bill = loop.revealedBills.find((b) => b.id === action.mashBillId);
  if (!bill) {
    return {
      legal: false,
      reason: `bill ${action.mashBillId} is not in the revealed set`,
    };
  }
  if (emptySlotsFor(state, player.id).length === 0) {
    return { legal: false, reason: "no open slot to receive the bill" };
  }
  const billCap = player.distillery?.maxSlottedBills;
  if (billCap !== undefined && slottedBillCount(state, player.id) >= billCap) {
    return {
      legal: false,
      reason: `${player.distillery!.name} caps slotted bills at ${billCap}`,
    };
  }
  if (
    player.distillery?.bonus === "high_rye_house" &&
    bill.recipe?.maxRye === 0
  ) {
    return { legal: false, reason: "High-Rye House cannot draft wheated bills" };
  }
  // Payment must come from the picker's hand. Save-slot cards live
  // outside `hand`, so a hand-membership check excludes them naturally.
  const payment = player.hand.find((c) => c.id === action.paymentCardId);
  if (!payment) {
    return {
      legal: false,
      reason: `payment card ${action.paymentCardId} is not in your hand`,
    };
  }
  return { legal: true };
}

export function applyDraftTakeBill(
  draft: Draft<GameState>,
  action: TakeBillAction,
): void {
  const loop = draft.draftingLoop!;
  const player = draft.players.find((p) => p.id === action.playerId)!;

  // Pay one card into the draft pile.
  const cardIdx = player.hand.findIndex((c) => c.id === action.paymentCardId);
  const [card] = player.hand.splice(cardIdx, 1) as [Card];
  loop.draftPile.push(card);

  // Lift the bill out of the revealed set into an Open slot as Staged.
  const billIdx = loop.revealedBills.findIndex((b) => b.id === action.mashBillId);
  const [bill] = loop.revealedBills.splice(billIdx, 1) as [MashBill];
  placeBillInSlot(draft, player, bill);

  // Once any bill is taken, the picker can't scavenge cards anymore.
  loop.pickerStage = "bill";
  maybeTriggerFinalRound(draft);
}

// ---------------------------------------------------------------
// DRAFT_TAKE_CARD
// ---------------------------------------------------------------

export function validateDraftTakeCard(
  state: GameState,
  action: TakeCardAction,
): ValidationResult {
  const loop = state.draftingLoop;
  if (loop === null) {
    return { legal: false, reason: "no Drafting Loop in progress" };
  }
  const pickerId = loop.pickOrder[loop.pickerIndex];
  if (action.playerId !== pickerId) {
    return { legal: false, reason: `it is ${pickerId}'s pick, not yours` };
  }
  if (loop.pickerStage !== "card") {
    return {
      legal: false,
      reason: "card-taking is closed for this pick (take cards before bills)",
    };
  }
  if (action.cardIds.length === 0) {
    return { legal: false, reason: "must select at least one card to take" };
  }
  if (new Set(action.cardIds).size !== action.cardIds.length) {
    return { legal: false, reason: "duplicate card id in selection" };
  }
  const pileById = new Set(loop.draftPile.map((c) => c.id));
  for (const id of action.cardIds) {
    if (!pileById.has(id)) {
      return { legal: false, reason: `card ${id} is not in the draft pile` };
    }
  }
  return { legal: true };
}

export function applyDraftTakeCard(
  draft: Draft<GameState>,
  action: TakeCardAction,
): void {
  const loop = draft.draftingLoop!;
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const taken = new Set(action.cardIds);
  const remaining: Card[] = [];
  for (const c of loop.draftPile) {
    if (taken.has(c.id)) {
      player.hand.push(c);
    } else {
      remaining.push(c);
    }
  }
  loop.draftPile = remaining;
  // Stage stays "card" — picker may scavenge again, then move to bills.
}

// ---------------------------------------------------------------
// DRAFT_PASS
// ---------------------------------------------------------------

export function validateDraftPass(
  state: GameState,
  action: PassAction,
): ValidationResult {
  const loop = state.draftingLoop;
  if (loop === null) {
    return { legal: false, reason: "no Drafting Loop in progress" };
  }
  const pickerId = loop.pickOrder[loop.pickerIndex];
  if (action.playerId !== pickerId) {
    return { legal: false, reason: `it is ${pickerId}'s pick, not yours` };
  }
  return { legal: true };
}

export function applyDraftPass(
  draft: Draft<GameState>,
  _action: PassAction,
): void {
  const loop = draft.draftingLoop!;
  loop.pickerIndex += 1;
  if (loop.pickerIndex >= loop.pickOrder.length) {
    closeDraftingLoop(draft);
    return;
  }
  // Next picker starts in card-scavenging stage.
  loop.pickerStage = "card";
}

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

function rotateFrom<T>(arr: T[], start: number): T[] {
  return [...arr.slice(start), ...arr.slice(0, start)];
}

function closeDraftingLoop(draft: Draft<GameState>): void {
  const loop = draft.draftingLoop!;
  // Leftover bills shuffle back into the bourbon deck.
  if (loop.revealedBills.length > 0) {
    const remixed: MashBill[] = [...draft.bourbonDeck, ...loop.revealedBills];
    const result = shuffleCards(remixed, draft.rngState);
    draft.bourbonDeck = result.shuffled;
    draft.rngState = result.rngState;
  }
  // Leftover cards go to the market discard pile.
  if (loop.draftPile.length > 0) {
    draft.marketDiscard.push(...loop.draftPile);
  }
  draft.draftingLoop = null;
  maybeTriggerFinalRound(draft);
}
