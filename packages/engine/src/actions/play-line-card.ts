import type { Draft } from "immer";
import type {
  GameAction,
  GameState,
  Line,
  LineCardInstance,
  SlotState,
  ValidationResult,
} from "../types";
import { isCurrentPlayer } from "../state";
import { getLineCardDef } from "../lines/cards";
import { mintLineId } from "../lines/placement";

type PlayLineCardAction = Extract<GameAction, { type: "PLAY_LINE_CARD" }>;

const MAX_SECONDARY_LINES = 2;

/**
 * v3.1 Bourbon Lines — play a Line Card to either:
 *
 *   - Open a new secondary Bourbon Line. `targetLineId` is null and the
 *     card's `slotPosition` must be 1. Cap of 2 secondaries per player.
 *     The card's `lineRestriction` (if any) binds to the new line.
 *
 *   - Extend an existing secondary. `targetLineId` names the secondary;
 *     the card's `slotPosition` must equal the line's next-open slot
 *     position. You cannot skip positions.
 *
 * Line Cards never come off a Line once played — including v3.0
 * legacy stackedCards still in memory from a savefile, though no new
 * v3.1 path produces those.
 */
export function validatePlayLineCard(
  state: GameState,
  action: PlayLineCardAction,
): ValidationResult {
  if (state.phase !== "action") {
    return {
      legal: false,
      reason: `phase is "${state.phase}", expected "action"`,
    };
  }
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) {
    return { legal: false, reason: `unknown player ${action.playerId}` };
  }
  const inst = player.lineCardHand.find(
    (c) => c.instanceId === action.lineCardInstanceId,
  );
  if (!inst) {
    return {
      legal: false,
      reason: `Line Card ${action.lineCardInstanceId} is not in your hand`,
    };
  }
  const def = getLineCardDef(inst.defId);
  if (!def) {
    return {
      legal: false,
      reason: `Line Card def ${inst.defId} is not in the catalog`,
    };
  }

  if (action.targetLineId === null) {
    if (def.slotPosition !== 1) {
      return {
        legal: false,
        reason: `only slot-1 Line Cards may open a new secondary (this card is slot ${def.slotPosition})`,
      };
    }
    if (player.secondaryLines.length >= MAX_SECONDARY_LINES) {
      return {
        legal: false,
        reason: `you already have ${MAX_SECONDARY_LINES} secondary Bourbon Lines`,
      };
    }
    return { legal: true };
  }

  // Extend path.
  const target = player.secondaryLines.find((l) => l.id === action.targetLineId);
  if (!target) {
    return {
      legal: false,
      reason: `secondary line ${action.targetLineId} not found`,
    };
  }
  // Flagships cannot be extended in v3.1 (their 5 slots are fixed by
  // the board). findLineById would resolve the flagship too, but we
  // restrict targets to secondaries here.
  const nextSlotPosition = (target.stackedCards?.length ?? 0) + 1;
  if (def.slotPosition !== nextSlotPosition) {
    return {
      legal: false,
      reason: `this Line Card is slot ${def.slotPosition}; the line's next-open position is slot ${nextSlotPosition}`,
    };
  }
  if (nextSlotPosition > 5) {
    return {
      legal: false,
      reason: `this secondary already has all 5 slots played`,
    };
  }
  return { legal: true };
}

export function applyPlayLineCard(
  draft: Draft<GameState>,
  action: PlayLineCardAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const idx = player.lineCardHand.findIndex(
    (c) => c.instanceId === action.lineCardInstanceId,
  );
  if (idx < 0) return; // unreachable post-validation
  const [inst] = player.lineCardHand.splice(idx, 1) as [LineCardInstance];

  if (action.targetLineId === null) {
    const newLine: Line = {
      id: mintLineId(draft, "secondary"),
      lineBoardId: null,
      stackedCards: [inst],
      slots: [emptySlot()],
      bottles: [],
      completionBonusTriggered: false,
    };
    player.secondaryLines.push(newLine);
    return;
  }

  const target = player.secondaryLines.find((l) => l.id === action.targetLineId);
  if (!target) return; // unreachable post-validation
  target.stackedCards.push(inst);
  if (!target.slots) target.slots = [];
  target.slots.push(emptySlot());
}

function emptySlot(): SlotState {
  return { filled: false, bottle: null, rewardFired: false };
}
