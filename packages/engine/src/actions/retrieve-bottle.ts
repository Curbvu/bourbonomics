import type { Draft } from "immer";
import type {
  Bottle,
  Card,
  GameAction,
  GameState,
  PlayerState,
  ValidationResult,
} from "../types";
import { isCurrentPlayer } from "../state";
import { getPortfolio } from "../lines/boards";
import { canPlaceInPortfolioSlot } from "../lines/placement";
import { fillSlot } from "./place-bottle";

type RetrieveBottleAction = Extract<GameAction, { type: "RETRIEVE_BOTTLE" }>;

/**
 * v3.2 — Retrieve one Bottle from inventory and place it onto an
 * eligible portfolio slot. Costs 1 Generic Labor from hand. Free
 * action during the action phase. Unlimited per turn (bounded by
 * available Generic Labor + eligible slots). Slot reward and any
 * Signature Bonus fire on fill, same as a fresh placement.
 */
export function validateRetrieveBottle(
  state: GameState,
  action: RetrieveBottleAction,
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

  // Must have a free Generic Labor in hand.
  const labor = findGenericLabor(player.hand, action.laborCardId);
  if (!labor) {
    return {
      legal: false,
      reason: `Generic Labor card ${action.laborCardId} is not in your hand`,
    };
  }

  // Bottle must be in inventory.
  const bottle = player.inventory.find((b) => b.bottleId === action.bottleId);
  if (!bottle) {
    return {
      legal: false,
      reason: `bottle ${action.bottleId} is not in your inventory`,
    };
  }

  // Destination must be an eligible slot accepting the bottle.
  const { kind, slotIndex } = action.destination;
  if (kind === "flagship") {
    const flagship = getPortfolio(player.flagshipPortfolio.portfolioId);
    if (!flagship) {
      return {
        legal: false,
        reason: "your flagship portfolio is not bound",
      };
    }
    if (
      !canPlaceInPortfolioSlot({
        bottle,
        portfolio: flagship,
        state: player.flagshipPortfolio,
        slotIndex,
        player,
      })
    ) {
      return {
        legal: false,
        reason: `flagship slot ${slotIndex} is not eligible for this bottle right now`,
      };
    }
  } else if (kind === "second") {
    if (!player.secondPortfolio) {
      return {
        legal: false,
        reason: "you have not drafted a second portfolio",
      };
    }
    const second = getPortfolio(player.secondPortfolio.portfolioId);
    if (!second) {
      return {
        legal: false,
        reason: "your second portfolio's id is not in the catalog",
      };
    }
    if (
      !canPlaceInPortfolioSlot({
        bottle,
        portfolio: second,
        state: player.secondPortfolio,
        slotIndex,
        player,
      })
    ) {
      return {
        legal: false,
        reason: `second portfolio slot ${slotIndex} is not eligible for this bottle right now`,
      };
    }
  }

  return { legal: true };
}

export function applyRetrieveBottle(
  draft: Draft<GameState>,
  action: RetrieveBottleAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;

  // Spend the worker — splice out, push to discard.
  const laborIdx = player.hand.findIndex((c) => c.id === action.laborCardId);
  if (laborIdx < 0) return;
  const [labor] = player.hand.splice(laborIdx, 1);
  if (labor) player.discard.push(labor);

  // Lift the bottle from inventory.
  const invIdx = player.inventory.findIndex(
    (b) => b.bottleId === action.bottleId,
  );
  if (invIdx < 0) return;
  const [bottle] = player.inventory.splice(invIdx, 1) as [Bottle];

  // Fill the destination slot (fires on-fill reward + signature
  // bonus + completion latch via the shared helper).
  fillSlot(
    draft,
    player as Draft<PlayerState>,
    action.destination.kind,
    action.destination.slotIndex,
    bottle,
  );
}

function findGenericLabor(hand: Card[], cardId: string): Card | undefined {
  return hand.find(
    (c) =>
      c.id === cardId &&
      c.type === "labor" &&
      (c.laborSubtype === "generic" || c.cardDefId === "generic_labor"),
  );
}
