import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  OperationsCard,
  ValidationResult,
} from "../types";
import { laborContribution } from "../types";
import { isCurrentPlayer } from "../state";

type BuyOperationsCardAction = Extract<GameAction, { type: "BUY_OPERATIONS_CARD" }>;

const FACEUP_OPS_SIZE = 3;

/**
 * Buy a face-up operations card from the market into your operations
 * hand. Unified-rep payment model:
 *   total = rep + sum(laborCardIds → laborContribution(card, "ops"))
 *
 * Marketing Labor (+2 toward ops) is the matching specialty. Cooper
 * and Architect contribute 0 here. Rep and Labor are fully fungible.
 *
 * The face-up row is the top `FACEUP_OPS_SIZE` cards of
 * `operationsDeck`, shown reversed in the UI. The action's
 * `opsSlotIndex` (0..2) is a UI-coordinate index; we resolve it back
 * to the engine's deck order.
 */
export function validateBuyOperationsCard(
  state: GameState,
  action: BuyOperationsCardAction,
): ValidationResult {
  if (state.phase !== "action") {
    return { legal: false, reason: `phase is "${state.phase}", expected "action"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }

  const card = resolveFaceUpOpsCard(state, action.opsSlotIndex);
  if (!card) {
    return {
      legal: false,
      reason: `operations slot ${action.opsSlotIndex} is empty or out of range`,
    };
  }
  const cost = card.cost;

  if (!Number.isInteger(action.rep) || action.rep < 0) {
    return { legal: false, reason: "rep payment must be a non-negative integer" };
  }
  if (action.rep > player.reputation) {
    return {
      legal: false,
      reason: `not enough reputation: have ${player.reputation}, paying ${action.rep}`,
    };
  }

  const laborIds = action.laborCardIds;
  if (new Set(laborIds).size !== laborIds.length) {
    return { legal: false, reason: "duplicate Labor card id in payment" };
  }
  const handById = new Map(player.hand.map((c) => [c.id, c]));
  let laborTotal = 0;
  for (const id of laborIds) {
    const c = handById.get(id);
    if (!c) return { legal: false, reason: `card ${id} is not in your hand` };
    if (c.type !== "labor") {
      return { legal: false, reason: `card ${id} is not a Labor card` };
    }
    laborTotal += laborContribution(c, "ops");
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

export function applyBuyOperationsCard(
  draft: Draft<GameState>,
  action: BuyOperationsCardAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;

  // Find + remove the bought card from the operations deck (face-up row).
  const idx = resolveFaceUpOpsIndex(draft, action.opsSlotIndex);
  const [bought] = draft.operationsDeck.splice(idx, 1) as [OperationsCard];
  player.operationsHand.push({ ...bought, drawnInRound: draft.round });

  player.reputation -= action.rep;

  // Discard the Labor cards used as payment.
  const laborSet = new Set(action.laborCardIds);
  const newHand: Card[] = [];
  const spent: Card[] = [];
  for (const c of player.hand) {
    if (laborSet.has(c.id)) spent.push(c);
    else newHand.push(c);
  }
  player.hand = newHand;
  player.discard.push(...spent);

  // Face-up row = last 3 cards of operationsDeck. Splicing the bought
  // card out shifts the rest down, so the next card "rises" into the
  // empty face-up slot automatically — no extra draw needed.
  // Note: turn does NOT end (free action).
}

/** Map a UI face-up index (0..2) to the engine's operationsDeck index. */
function resolveFaceUpOpsIndex(state: GameState, uiSlot: number): number {
  const total = state.operationsDeck.length;
  const lastIndex = total - 1;
  return lastIndex - uiSlot;
}

function resolveFaceUpOpsCard(
  state: GameState,
  uiSlot: number,
): OperationsCard | null {
  if (uiSlot < 0 || uiSlot >= FACEUP_OPS_SIZE) return null;
  const idx = resolveFaceUpOpsIndex(state, uiSlot);
  if (idx < 0 || idx >= state.operationsDeck.length) return null;
  return state.operationsDeck[idx] ?? null;
}
