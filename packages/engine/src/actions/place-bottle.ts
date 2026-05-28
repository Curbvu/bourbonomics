import type { Draft } from "immer";
import type {
  Bottle,
  GameAction,
  GameState,
  Line,
  LineCardInstance,
  PlayerState,
  ValidationResult,
} from "../types";
import { isCurrentPlayer } from "../state";
import { canPlaceOnLine, mintLineId } from "../lines/placement";
import { applyPlacementBonuses } from "../lines/bonuses";

type PlaceBottleAction = Extract<GameAction, { type: "PLACE_BOTTLE" }>;

const MAX_SECONDARY_LINES = 2;

/**
 * v3.0 Line system — resolve the pending bottle placement set by
 * the immediately preceding SELL_BOURBON. Destinations:
 *
 *   { kind: "flagship" }
 *     Place on the player's flagship line. Must satisfy the Line
 *     Board + every stacked Line Card predicate.
 *
 *   { kind: "secondary", lineId }
 *     Place on an existing secondary line. Must satisfy every
 *     stacked Line Card predicate.
 *
 *   { kind: "new-secondary", lineCardInstanceIds }
 *     Create a new secondary line stacked with 1+ Line Cards from
 *     hand. Bottle must satisfy every played card's predicate.
 *     Capped at 2 secondaries per player.
 *
 *   { kind: "inventory" }
 *     Always valid. Bottle scores 1 rep at end of game.
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
    case "flagship":
      if (!canPlaceOnLine(bottle, player.flagshipLine)) {
        return {
          legal: false,
          reason: "bottle does not satisfy the flagship line's constraints",
        };
      }
      return { legal: true };
    case "secondary": {
      const dest = action.destination;
      const target = player.secondaryLines.find((l) => l.id === dest.lineId);
      if (!target) {
        return {
          legal: false,
          reason: `secondary line ${dest.lineId} not found`,
        };
      }
      if (!canPlaceOnLine(bottle, target)) {
        return {
          legal: false,
          reason: "bottle does not satisfy the secondary line's constraints",
        };
      }
      return { legal: true };
    }
    case "new-secondary": {
      if (player.secondaryLines.length >= MAX_SECONDARY_LINES) {
        return {
          legal: false,
          reason: `you already have ${MAX_SECONDARY_LINES} secondary lines`,
        };
      }
      const ids = action.destination.lineCardInstanceIds;
      if (ids.length < 1) {
        return {
          legal: false,
          reason: "a new secondary line requires at least 1 Line Card",
        };
      }
      const handById = new Map(
        player.lineCardHand.map((c) => [c.instanceId, c]),
      );
      const used = new Set<string>();
      const stacked: LineCardInstance[] = [];
      for (const id of ids) {
        const card = handById.get(id);
        if (!card) {
          return {
            legal: false,
            reason: `Line Card ${id} is not in your hand`,
          };
        }
        if (used.has(id)) {
          return { legal: false, reason: `duplicate Line Card ${id}` };
        }
        used.add(id);
        stacked.push(card);
      }
      // Build a candidate line and check the bottle satisfies every
      // played card.
      const candidate: Line = {
        id: "candidate",
        lineBoardId: null,
        stackedCards: stacked,
        bottles: [],
      };
      if (!canPlaceOnLine(bottle, candidate)) {
        return {
          legal: false,
          reason:
            "bottle does not satisfy the new secondary line's constraints",
        };
      }
      return { legal: true };
    }
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

  let target: Draft<Line> | null = null;
  switch (action.destination.kind) {
    case "inventory":
      player.inventory.push(bottle);
      player.pendingBottlePlacement = null;
      return;
    case "flagship":
      target = player.flagshipLine;
      break;
    case "secondary": {
      const dest = action.destination;
      const found = player.secondaryLines.find((l) => l.id === dest.lineId);
      if (!found) return; // unreachable post-validation
      target = found;
      break;
    }
    case "new-secondary": {
      const dest = action.destination;
      // Pull each cited card out of hand (in the order given so
      // stackedCards mirrors play order).
      const stacked: LineCardInstance[] = [];
      for (const id of dest.lineCardInstanceIds) {
        const idx = player.lineCardHand.findIndex((c) => c.instanceId === id);
        if (idx >= 0) {
          const [card] = player.lineCardHand.splice(idx, 1);
          stacked.push(card!);
        }
      }
      const newLine: Line = {
        id: mintLineId(draft, "secondary"),
        lineBoardId: null,
        stackedCards: stacked,
        bottles: [],
      };
      player.secondaryLines.push(newLine);
      target = player.secondaryLines[player.secondaryLines.length - 1]!;
      break;
    }
  }

  if (!target) return;
  target.bottles.push(bottle);
  applyPlacementBonuses(
    bottle,
    target as Line,
    draft,
    player as Draft<PlayerState>,
  );
  player.pendingBottlePlacement = null;
}
