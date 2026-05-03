/**
 * Shared test helpers for advancing engine state past phases that
 * exist only for the human player's benefit (the Distillery draft is
 * the current example).
 */

import { reduce } from "@/lib/engine/reducer";
import type { GameState } from "@/lib/engine/state";

/**
 * Confirm the first dealt Distillery for every active baron, advancing
 * the game out of `distillery_draft` into round 1's action phase. No-op
 * if the state is already past the draft.
 *
 * Returns a deep clone so callers can mutate the result freely — Immer
 * deep-freezes the reducer's output and many tests poke fields like
 * `s.players.p1.cash = 0` directly, which would otherwise throw.
 */
export function pastDistilleryDraft(s: GameState): GameState {
  let cur = s;
  if (cur.phase === "distillery_draft") {
    for (const id of cur.playerOrder) {
      const player = cur.players[id];
      if (player.eliminated || player.chosenDistilleryId) continue;
      const dealt = player.dealtDistilleryIds;
      if (!dealt?.length) continue;
      cur = reduce(cur, {
        t: "DISTILLERY_CONFIRM",
        playerId: id,
        chosenId: dealt[0],
      });
    }
  }
  return JSON.parse(JSON.stringify(cur)) as GameState;
}
