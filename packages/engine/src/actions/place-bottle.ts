import type { Draft } from "immer";
import type {
  Bottle,
  GameAction,
  GameState,
  Line,
  PlayerState,
  ValidationResult,
} from "../types";
import { isCurrentPlayer } from "../state";
import { getLineBoardDef } from "../lines/boards";
import { getLineCardDef } from "../lines/cards";
import {
  canPlaceInFlagshipSlot,
  canPlaceInSecondarySlot,
  nextOpenSlotIndex,
} from "../lines/placement";

type PlaceBottleAction = Extract<GameAction, { type: "PLACE_BOTTLE" }>;

/**
 * v3.1 Bourbon Lines — resolve the pending bottle placement set by
 * the immediately preceding SELL_BOURBON.
 *
 *   { kind: "flagship" }
 *     Place into the next-open slot of the flagship Line. Must
 *     satisfy the board's Line Restriction AND the slot's individual
 *     Placement Requirement. Slot reward fires on fill; if it was
 *     the final slot, the Completion Bonus fires too.
 *
 *   { kind: "secondary", lineId }
 *     Place into the next-open slot of the named secondary. Must
 *     satisfy the slot-1 card's Line Restriction (if any) AND the
 *     individual slot card's requirement. Slot reward fires on fill.
 *     Secondary lines have no completion bonus.
 *
 *   { kind: "inventory" }
 *     Always legal. Scores +1 rep at end of game (+5 more if
 *     Vanilla's Completion Bonus has triggered).
 *
 *   { kind: "new-secondary" }
 *     Retired. Use PLAY_LINE_CARD with `targetLineId: null` to open
 *     a secondary, then PLACE_BOTTLE on it.
 */
export function validatePlaceBottle(
  state: GameState,
  action: PlaceBottleAction,
): ValidationResult {
  if (!isCurrentPlayer(state, action.playerId)) {
    return { legal: false, reason: "it is not your turn" };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  const pending = player.pendingBottlePlacement;
  if (!pending) {
    return { legal: false, reason: "no bottle placement is pending for you" };
  }
  const bottle = pending.bottle;

  switch (action.destination.kind) {
    case "inventory":
      return { legal: true };
    case "flagship": {
      const flagship = player.flagshipLine;
      const idx = nextOpenSlotIndex(flagship);
      if (idx < 0) {
        return { legal: false, reason: "your flagship Bourbon Line is full" };
      }
      if (!canPlaceInFlagshipSlot(bottle, flagship, idx, player)) {
        return {
          legal: false,
          reason:
            "bottle does not satisfy the flagship's Line Restriction or the next-open slot's requirement",
        };
      }
      return { legal: true };
    }
    case "secondary": {
      const dest = action.destination;
      const target = player.secondaryLines.find((l) => l.id === dest.lineId);
      if (!target) {
        return {
          legal: false,
          reason: `secondary line ${dest.lineId} not found`,
        };
      }
      const idx = nextOpenSlotIndex(target);
      if (idx < 0) {
        return {
          legal: false,
          reason: "that secondary Bourbon Line has no open slot",
        };
      }
      if (!canPlaceInSecondarySlot(bottle, target, idx, player)) {
        return {
          legal: false,
          reason:
            "bottle does not satisfy the secondary's Line Restriction or the next-open slot card's requirement",
        };
      }
      return { legal: true };
    }
    case "new-secondary":
      return {
        legal: false,
        reason:
          "new-secondary via PLACE_BOTTLE is retired; play a slot-1 Line Card with PLAY_LINE_CARD first, then place onto it",
      };
    default:
      return {
        legal: false,
        reason: `unknown placement destination kind`,
      };
  }
}

export function applyPlaceBottle(
  draft: Draft<GameState>,
  action: PlaceBottleAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const pending = player.pendingBottlePlacement!;
  const bottle = pending.bottle as Bottle;

  switch (action.destination.kind) {
    case "inventory":
      player.inventory.push(bottle);
      player.pendingBottlePlacement = null;
      return;
    case "flagship": {
      const flagship = player.flagshipLine;
      if (!flagship.slots || !flagship.lineBoardId) {
        player.pendingBottlePlacement = null;
        return;
      }
      const idx = nextOpenSlotIndex(flagship);
      if (idx < 0) {
        player.pendingBottlePlacement = null;
        return;
      }
      flagship.slots[idx]!.filled = true;
      flagship.slots[idx]!.bottle = bottle;
      flagship.bottles.push(bottle);

      const board = getLineBoardDef(flagship.lineBoardId);
      if (!board) {
        player.pendingBottlePlacement = null;
        return;
      }
      if (!flagship.slots[idx]!.rewardFired) {
        board.slots[idx]!.reward.fire({
          bottle,
          line: flagship as Line,
          slotIndex: idx,
          draft,
          player: player as Draft<PlayerState>,
        });
        flagship.slots[idx]!.rewardFired = true;
      }
      const isFinalSlot = idx === board.slots.length - 1;
      if (isFinalSlot && !flagship.completionBonusTriggered) {
        flagship.completionBonusTriggered = true;
        board.completionBonus.fire({
          line: flagship as Line,
          draft,
          player: player as Draft<PlayerState>,
        });
      }
      player.pendingBottlePlacement = null;
      return;
    }
    case "secondary": {
      const dest = action.destination;
      const target = player.secondaryLines.find((l) => l.id === dest.lineId);
      if (!target || !target.slots) {
        player.pendingBottlePlacement = null;
        return;
      }
      const idx = nextOpenSlotIndex(target);
      if (idx < 0) {
        player.pendingBottlePlacement = null;
        return;
      }
      target.slots[idx]!.filled = true;
      target.slots[idx]!.bottle = bottle;
      target.bottles.push(bottle);

      const cardInstance = target.stackedCards[idx];
      if (cardInstance) {
        const def = getLineCardDef(cardInstance.defId);
        if (def && !target.slots[idx]!.rewardFired) {
          def.reward.fire({
            bottle,
            line: target as Line,
            slotIndex: idx,
            draft,
            player: player as Draft<PlayerState>,
          });
          target.slots[idx]!.rewardFired = true;
        }
      }
      // Secondary lines have no completion bonus in v3.1 (Line Cards
      // don't carry one). Slot 5's own reward is the climax.
      player.pendingBottlePlacement = null;
      return;
    }
    case "new-secondary":
      // Retired — validation rejects.
      player.pendingBottlePlacement = null;
      return;
  }
}
