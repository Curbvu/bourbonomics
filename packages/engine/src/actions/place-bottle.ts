import type { Draft } from "immer";
import type {
  Bottle,
  GameAction,
  GameState,
  PlayerState,
  Portfolio,
  PortfolioState,
  ValidationResult,
} from "../types";
import { isCurrentPlayer } from "../state";
import { getPortfolio } from "../lines/boards";
import {
  canPlaceInPortfolioSlot,
} from "../lines/placement";

type PlaceBottleAction = Extract<GameAction, { type: "PLACE_BOTTLE" }>;

/**
 * v3.2 Brand Portfolios — resolve the pending bottle placement set
 * by the immediately preceding SELL_BOURBON.
 *
 *   { kind: "flagship", slotIndex }
 *     Place onto the named slot on the player's flagship portfolio.
 *     Slot must be eligible (required: next-open; optional: tier
 *     unlocked) and the bottle must satisfy the slot's requirement.
 *     The Brand Restriction is NOT a placement gate.
 *
 *   { kind: "second", slotIndex }
 *     Same, against the drafted second portfolio (must exist).
 *
 *   { kind: "inventory" }
 *     Always legal. Inventory scores zero at end of game; bottles
 *     can be retrieved later via RETRIEVE_BOTTLE.
 *
 *   { kind: "secondary" | "new-secondary" }
 *     v3.1 holdovers — always rejected.
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
      const flagship = getPortfolio(player.flagshipPortfolio.portfolioId);
      if (!flagship) {
        return {
          legal: false,
          reason: "your flagship portfolio is not bound (distillery not selected)",
        };
      }
      return validateSlotPlacement(
        bottle,
        flagship,
        player.flagshipPortfolio,
        action.destination.slotIndex,
        player,
      );
    }
    case "second": {
      if (!player.secondPortfolio) {
        return {
          legal: false,
          reason: "you have not drafted a second portfolio yet",
        };
      }
      const second = getPortfolio(player.secondPortfolio.portfolioId);
      if (!second) {
        return {
          legal: false,
          reason: "your second portfolio's id is not in the catalog",
        };
      }
      return validateSlotPlacement(
        bottle,
        second,
        player.secondPortfolio,
        action.destination.slotIndex,
        player,
      );
    }
    case "secondary":
    case "new-secondary":
      return {
        legal: false,
        reason:
          "v3.1 secondary destinations are retired; place onto a portfolio slot via { kind: 'flagship' | 'second', slotIndex } or inventory",
      };
    default:
      return {
        legal: false,
        reason: `unknown placement destination kind`,
      };
  }
}

function validateSlotPlacement(
  bottle: Bottle,
  portfolio: Portfolio,
  state: PortfolioState,
  slotIndex: number,
  player: PlayerState,
): ValidationResult {
  if (slotIndex < 0 || slotIndex >= portfolio.slots.length) {
    return {
      legal: false,
      reason: `slot index ${slotIndex} out of range (portfolio has ${portfolio.slots.length} slots)`,
    };
  }
  if (state.slots[slotIndex]!.filled) {
    return { legal: false, reason: `slot ${slotIndex} is already filled` };
  }
  if (
    !canPlaceInPortfolioSlot({
      bottle,
      portfolio,
      state,
      slotIndex,
      player,
    })
  ) {
    // Distinguish slot-order / tier-lock failures from requirement failures.
    const slotDef = portfolio.slots[slotIndex]!;
    if (slotDef.required) {
      return {
        legal: false,
        reason: `slot ${slotIndex} ("${slotDef.name}") is required and must wait its turn (fill prior required slots first), or the bottle does not satisfy its requirement (${slotDef.requirement.label})`,
      };
    }
    return {
      legal: false,
      reason: `slot ${slotIndex} ("${slotDef.name}") is in a locked tier or the bottle does not satisfy its requirement (${slotDef.requirement.label})`,
    };
  }
  return { legal: true };
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
    case "flagship":
      fillSlot(draft, player, "flagship", action.destination.slotIndex, bottle);
      player.pendingBottlePlacement = null;
      return;
    case "second":
      fillSlot(draft, player, "second", action.destination.slotIndex, bottle);
      player.pendingBottlePlacement = null;
      return;
    case "secondary":
    case "new-secondary":
      // Rejected by validator — unreachable.
      player.pendingBottlePlacement = null;
      return;
  }
}

/**
 * Internal: fill a slot, fire its on-fill reward (and Signature
 * Bonus if matched), and latch `completionReached` if the
 * Completion tier was just achieved. Reused by RETRIEVE_BOTTLE.
 */
export function fillSlot(
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
  kind: "flagship" | "second",
  slotIndex: number,
  bottle: Bottle,
): void {
  const stateObj =
    kind === "flagship" ? player.flagshipPortfolio : player.secondPortfolio;
  if (!stateObj) return;
  const portfolio = getPortfolio(stateObj.portfolioId);
  if (!portfolio) return;
  const slotState = stateObj.slots[slotIndex];
  const slotDef = portfolio.slots[slotIndex];
  if (!slotState || !slotDef) return;

  slotState.filled = true;
  slotState.bottle = bottle;

  // Signature match detection — billDefId equality is the canonical
  // signature relation per the spec.
  const signatureMatched =
    slotDef.signatureBillDefId !== null &&
    bottle.billDefId === slotDef.signatureBillDefId;
  slotState.signatureMatched = signatureMatched;

  // On-fill reward, exactly once.
  if (!slotState.rewardFired) {
    slotDef.onFillReward.fire({
      bottle,
      portfolio: stateObj as PortfolioState,
      slotIndex,
      draft,
      player,
    });
    slotState.rewardFired = true;
  }

  // Signature bonus, if matched.
  if (signatureMatched && slotDef.signatureBonus) {
    slotDef.signatureBonus.fire({
      bottle,
      portfolio: stateObj as PortfolioState,
      slotIndex,
      draft,
      player,
    });
  }

  // Latch completionReached if every required slot is now filled.
  if (!stateObj.completionReached) {
    const allRequiredFilled = portfolio.slots
      .filter((s) => s.required)
      .every((s) => stateObj.slots[s.index]!.filled);
    if (allRequiredFilled) stateObj.completionReached = true;
  }
}
