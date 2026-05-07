import type { Draft } from "immer";
import type { Distillery, GameAction, GameState, ValidationResult } from "../types";
import { buildRickhouseSlots } from "../distilleries";
import { shuffleCards } from "../deck";
import {
  applyDistilleryStarterModifications,
  enterStarterDeckDraftPhase,
  placeStartingBarrel,
  topUpSlottedBillsForDistillery,
} from "../starter-pool";

type SelectDistilleryAction = Extract<GameAction, { type: "SELECT_DISTILLERY" }>;

export function validateSelectDistillery(
  state: GameState,
  action: SelectDistilleryAction,
): ValidationResult {
  if (state.phase !== "distillery_selection") {
    return { legal: false, reason: `phase is "${state.phase}", expected "distillery_selection"` };
  }
  const expectedPlayerId = state.distillerySelectionOrder[state.distillerySelectionCursor];
  if (!expectedPlayerId) {
    return { legal: false, reason: "no remaining picks in distillery selection order" };
  }
  if (expectedPlayerId !== action.playerId) {
    return { legal: false, reason: `it is ${expectedPlayerId}'s turn to pick, not ${action.playerId}` };
  }
  const player = state.players.find((p) => p.id === action.playerId);
  if (!player) return { legal: false, reason: `unknown player ${action.playerId}` };
  if (player.distillery) {
    return { legal: false, reason: `${action.playerId} already has a distillery` };
  }
  const distillery = state.distilleryPool.find((d) => d.id === action.distilleryId);
  if (!distillery) {
    return { legal: false, reason: `distillery ${action.distilleryId} is not in the pool` };
  }
  return { legal: true };
}

export function applySelectDistillery(
  draft: Draft<GameState>,
  action: SelectDistilleryAction,
): void {
  const player = draft.players.find((p) => p.id === action.playerId)!;
  const idx = draft.distilleryPool.findIndex((d) => d.id === action.distilleryId);
  const [distillery] = draft.distilleryPool.splice(idx, 1) as [Distillery];

  player.distillery = distillery;
  player.rickhouseSlots = buildRickhouseSlots(player.id, distillery);

  // Place the v2.4 pre-aged starting barrel (if any).
  placeStartingBarrel(draft, player, distillery);
  // v2.6: top up slotted bills (3 by default; Connoisseur Estate: 4).
  // Each drafted bill lands in an open slot as a "ready" barrel.
  topUpSlottedBillsForDistillery(draft, player, distillery);

  // If this player's deck was pre-built (config.starterDecks[i]), they
  // skip the starter trade window — apply post-deal distillery
  // modifications to that deck now and reshuffle. Players who'll go
  // through the trade window have those modifications applied when
  // the phase begins (see enterStarterDeckDraftPhase).
  const willEnterStarterDraft = draft.starterDeckDraftOrder.includes(player.id);
  if (!willEnterStarterDraft) {
    applyDistilleryStarterModifications(player.deck, player, distillery);
    const { shuffled, rngState } = shuffleCards(player.deck, draft.rngState);
    player.deck = shuffled;
    draft.rngState = rngState;
  }

  draft.distillerySelectionCursor += 1;
  if (draft.distillerySelectionCursor >= draft.distillerySelectionOrder.length) {
    if (draft.starterDeckDraftOrder.length > 0) {
      enterStarterDeckDraftPhase(draft);
    } else {
      // v2.9: skip demand phase entirely. Round 1 opens in draw —
      // demand is rolled per-player at the top of each action turn.
      draft.phase = "draw";
    }
  }
}
