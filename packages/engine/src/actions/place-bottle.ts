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
import { canPlaceInFlagshipSlot, nextOpenSlotIndex } from "../lines/placement";

type PlaceBottleAction = Extract<GameAction, { type: "PLACE_BOTTLE" }>;

/**
 * v3.2 Brand Portfolios — resolve the pending bottle placement set
 * by the immediately preceding SELL_BOURBON.
 *
 *   { kind: "flagship" }
 *     Place into the next-open slot of the flagship Line. Must
 *     satisfy the board's Line Restriction AND the slot's individual
 *     Placement Requirement. Slot reward fires on fill; if it was
 *     the final slot, the Completion Bonus fires too.
 *
 *   { kind: "inventory" }
 *     Always legal. Inventory scores zero at end of game in v3.2;
 *     bottles can be retrieved later for 1 Generic Labor each.
 *
 *   { kind: "secondary" | "new-secondary" }
 *     v3.1 destinations — retired in v3.2 (Line Card secondary lines
 *     are removed). The Brand Portfolio second-portfolio destination
 *     lands in a follow-on phase.
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
    case "secondary":
    case "new-secondary":
      return {
        legal: false,
        reason:
          "secondary placement is retired in v3.2; the Brand Portfolio second-portfolio destination lands in a follow-on phase",
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
    case "secondary":
    case "new-secondary":
      // Validation rejects these in v3.2. Unreachable.
      player.pendingBottlePlacement = null;
      return;
  }
}
