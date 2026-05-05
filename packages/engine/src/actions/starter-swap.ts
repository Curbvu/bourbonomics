import type { Draft } from "immer";
import type { GameAction, GameState, ValidationResult } from "../types";
import { shuffleCards } from "../deck";

type StarterSwapAction = Extract<GameAction, { type: "STARTER_SWAP" }>;

const MAX_SWAP = 3;

export function validateStarterSwap(
  state: GameState,
  action: StarterSwapAction,
): ValidationResult {
  if (state.phase !== "starter_deck_draft") {
    return { legal: false, reason: `phase is "${state.phase}", expected "starter_deck_draft"` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (!state.starterDeckDraftOrder.includes(action.playerId)) {
    return { legal: false, reason: `${action.playerId} is not a starter drafter` };
  }
  if (player.starterPassed) {
    return { legal: false, reason: `${action.playerId} has already passed` };
  }
  if (player.starterSwapUsed) {
    return { legal: false, reason: "stuck-hand swap has already been used" };
  }
  if (action.cardIds.length === 0) {
    return { legal: false, reason: "must offer at least 1 card to swap" };
  }
  if (action.cardIds.length > MAX_SWAP) {
    return { legal: false, reason: `swap is limited to ${MAX_SWAP} cards` };
  }
  if (new Set(action.cardIds).size !== action.cardIds.length) {
    return { legal: false, reason: "duplicate card id in swap offer" };
  }
  if (action.cardIds.length > state.starterUndealtPool.length) {
    return {
      legal: false,
      reason: `pool has only ${state.starterUndealtPool.length} cards left`,
    };
  }
  const handIds = new Set(player.starterHand.map((c) => c.id));
  for (const id of action.cardIds) {
    if (!handIds.has(id)) {
      return { legal: false, reason: `${id} is not in ${action.playerId}'s starter hand` };
    }
  }
  return { legal: true };
}

export function applyStarterSwap(
  draft: Draft<GameState>,
  action: StarterSwapAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const offerIds = new Set(action.cardIds);

  // Pull offered cards out of the starter hand and back into the pool.
  const kept: typeof player.starterHand = [];
  const returned: typeof player.starterHand = [];
  for (const c of player.starterHand) {
    if (offerIds.has(c.id)) returned.push(c);
    else kept.push(c);
  }
  player.starterHand = kept;
  draft.starterUndealtPool.push(...returned);

  // Shuffle the pool (returned cards are now mixed with prior remainder)
  // and draw replacements from the top. Without shuffling, the returned
  // cards sit on top and the player would draw back exactly what they
  // discarded.
  const shuffleResult = shuffleCards(draft.starterUndealtPool, draft.rngState);
  draft.starterUndealtPool = shuffleResult.shuffled;
  draft.rngState = shuffleResult.rngState;

  const replacementCount = action.cardIds.length;
  const replacements = draft.starterUndealtPool.splice(
    draft.starterUndealtPool.length - replacementCount,
    replacementCount,
  );
  player.starterHand.push(...replacements);

  player.starterSwapUsed = true;
}
