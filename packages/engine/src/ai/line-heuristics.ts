import type { GameAction, GameState, PlayerState } from "../types";
import { canPlaceInFlagshipSlot, nextOpenSlotIndex } from "../lines/placement";

// ============================================================
// v3.2 Brand Portfolio bot heuristics — placement only
// ============================================================
//
// The v3.1 Line Card decision heuristics (drafting cards, keeping
// from draws, scoring card stacks for new secondaries, evaluating
// extends) are all retired. The Brand Portfolio bot heuristics
// (when to spend a worker on Draft Second Portfolio, when to
// retrieve from inventory, signature-bill draft prioritization)
// land alongside the Portfolio data model in a follow-on phase.
//
// For now the bot picks the flagship's next-open slot when legal,
// otherwise drops the bottle into inventory. This keeps games
// playable while the Portfolio mechanics come online.

/**
 * Decide where the bot should place its just-sold bottle. Strategy:
 *   1. Flagship next-open slot if the bottle satisfies it.
 *   2. Inventory otherwise.
 *
 * Returns `null` only if there is no pending placement (defensive;
 * callers should not invoke this without a pending bottle).
 */
export function chooseBottlePlacement(
  state: GameState,
  player: PlayerState,
): GameAction | null {
  const pending = player.pendingBottlePlacement;
  if (!pending) return null;
  const bottle = pending.bottle;

  const flagship = player.flagshipLine;
  const idx = nextOpenSlotIndex(flagship);
  if (idx >= 0 && canPlaceInFlagshipSlot(bottle, flagship, idx, player)) {
    return {
      type: "PLACE_BOTTLE",
      playerId: player.id,
      destination: { kind: "flagship" },
    };
  }
  return {
    type: "PLACE_BOTTLE",
    playerId: player.id,
    destination: { kind: "inventory" },
  };
}
// Reference unused parameter so eslint stays happy without ignoreRestSiblings.
void ({} as { state?: GameState });
