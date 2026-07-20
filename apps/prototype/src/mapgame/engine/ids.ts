// Deterministic id minting, threaded through GameState so state snapshots stay
// replay-equal (brief §0: determinism is load-bearing). The counter lives on
// the state; this helper bumps it and returns the next id.

import type { GameState } from "./types";

/** Mutates draft.idCounter and returns a fresh id. Use only on a working draft. */
export function mintId(draft: GameState, prefix: string): string {
  draft.idCounter += 1;
  return `${prefix}_${draft.idCounter}`;
}
