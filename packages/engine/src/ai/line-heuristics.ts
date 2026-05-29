import type { GameAction, GameState, PlayerState } from "../types";
import { eligibleSlotsForBottle } from "../lines/placement";

// ============================================================
// v3.2 Brand Portfolio bot heuristics
// ============================================================
//
// Minimal placement chooser for now: pick the lowest-index eligible
// slot on the flagship (cheapest path to Completion), then the
// lowest-index eligible slot on the second portfolio, then
// inventory. Smarter heuristics — Draft Second Portfolio timing,
// retrieval timing, signature-bill draft priority — land in a
// follow-on phase.

export function chooseBottlePlacement(
  _state: GameState,
  player: PlayerState,
): GameAction | null {
  const pending = player.pendingBottlePlacement;
  if (!pending) return null;
  const bottle = pending.bottle;

  const eligible = eligibleSlotsForBottle(bottle, player);
  if (eligible.length > 0) {
    // Prefer flagship over second portfolio; within each, lowest
    // slot index first (rough proxy for "fill required tiers
    // earlier").
    const flagshipFirst = eligible
      .filter((e) => e.kind === "flagship")
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const secondAfter = eligible
      .filter((e) => e.kind === "second")
      .sort((a, b) => a.slotIndex - b.slotIndex);
    const pick = flagshipFirst[0] ?? secondAfter[0]!;
    return {
      type: "PLACE_BOTTLE",
      playerId: player.id,
      destination: { kind: pick.kind, slotIndex: pick.slotIndex },
    };
  }
  return {
    type: "PLACE_BOTTLE",
    playerId: player.id,
    destination: { kind: "inventory" },
  };
}
