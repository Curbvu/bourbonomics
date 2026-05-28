import type { Draft } from "immer";
import type { Bottle, GameState, Line, PlayerState } from "../types";
import { getLineBoardDef } from "./boards";
import { getLineCardDef } from "./cards";

/**
 * Fire placement bonuses for a Bottle that has just been pushed onto
 * `lineRef`. Order: Line Board first (flagship only), then stacked
 * Line Cards in the order they were stacked.
 *
 * Each bonus may mutate the player or shared game state directly
 * (rep, prestige, demand, draw cards, etc.). Unknown defIds silently
 * no-op.
 */
export function applyPlacementBonuses(
  bottle: Bottle,
  lineRef: Line,
  draft: Draft<GameState>,
  player: Draft<PlayerState>,
): void {
  if (lineRef.lineBoardId) {
    const board = getLineBoardDef(lineRef.lineBoardId);
    board?.perBottleBonus({ bottle, lineRef, draft, player });
  }
  for (const cardInstance of lineRef.stackedCards) {
    const def = getLineCardDef(cardInstance.defId);
    def?.perBottleBonus({ bottle, lineRef, draft, player });
  }
}
