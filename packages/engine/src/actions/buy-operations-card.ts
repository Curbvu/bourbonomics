import type { Draft } from "immer";
import type {
  Card,
  GameAction,
  GameState,
  OperationsCard,
  ValidationResult,
} from "../types";
import { paymentValue } from "../cards";
import { isCurrentPlayer } from "../state";

type BuyOperationsCardAction = Extract<GameAction, { type: "BUY_OPERATIONS_CARD" }>;

const FACEUP_OPS_SIZE = 3;

/**
 * Buy a face-up operations card from the market into your operations
 * hand. Same payment model as BUY_FROM_MARKET (capital cards pay face
 * value, resource cards pay 1¢ each). Free action — turn does not end.
 *
 * The face-up row is the top `FACEUP_OPS_SIZE` cards of `operationsDeck`,
 * shown reversed in the UI. The action's `opsSlotIndex` (0..2) is a
 * UI-coordinate index; we resolve it back to the engine's deck order.
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

  const spendIds = action.spendCardIds;
  if (spendIds.length === 0) {
    return { legal: false, reason: "must spend at least one card" };
  }
  if (new Set(spendIds).size !== spendIds.length) {
    return { legal: false, reason: "duplicate card id in spend list" };
  }

  const handIds = new Set(player.hand.map((c) => c.id));
  let totalCapital = 0;
  for (const id of spendIds) {
    if (!handIds.has(id)) {
      return { legal: false, reason: `card ${id} is not in your hand` };
    }
    const c = player.hand.find((x) => x.id === id)!;
    totalCapital += paymentValue(c);
  }
  if (totalCapital < cost) {
    return {
      legal: false,
      reason: `spent value is ${totalCapital}¢, need ${cost}¢`,
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

  // Move spent payment cards from hand → discard.
  const spendSet = new Set(action.spendCardIds);
  const newHand: Card[] = [];
  const spent: Card[] = [];
  for (const c of player.hand) {
    if (spendSet.has(c.id)) spent.push(c);
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
  // Face-up row = last FACEUP_OPS_SIZE cards of operationsDeck, reversed.
  // UI slot 0 = top of deck; UI slot 2 = third from top.
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
