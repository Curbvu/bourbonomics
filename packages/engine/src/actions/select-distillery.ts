import type { Draft } from "immer";
import type { Distillery, GameAction, GameState, ValidationResult } from "../types";
import { buildRickhouseSlots } from "../distilleries";
import { shuffleCards } from "../deck";
import { dealInitialHands, maybeTriggerFinalRound } from "../state";
import {
  applyDistilleryStarterModifications,
  enterStarterDeckDraftPhase,
  placeStartingBarrel,
  topUpSlottedBillsForDistillery,
} from "../starter-pool";
import { bindFlagshipPortfolio } from "../lines/placement";

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
  // v3.4 — Re-stake Capital to the chosen distillery's value. At
  // `initializeGame` the player's `capital` was seeded from a null
  // distillery (default 5) because selection hadn't happened yet.
  // Now that the distillery is known, overwrite with the real value.
  // Vanilla 5, High-Rye House 3, Wheated Baron 4, Connoisseur 7,
  // Standard 8 (see GAME_RULES.md §Distillery Profiles).
  player.capital = distillery.startingCapital ?? player.capital;
  bindFlagshipPortfolio(player);

  // Place the v2.4 pre-aged starting barrel (if any).
  placeStartingBarrel(draft, player, distillery);
  // v2.6: top up slotted bills (3 by default; Connoisseur Estate: 4).
  // Each drafted bill lands in an open slot as a "ready" barrel.
  topUpSlottedBillsForDistillery(draft, player, distillery);
  // v2.14: top-up may have drained the bourbon deck — arm the
  // doomsday clock if so (no Drafting Loop ever runs to catch it).
  maybeTriggerFinalRound(draft);

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
      // v3.10 — the initial deal happens once, at setup, instead of
      // via DRAW_HAND. DRAW_HAND is now pure orchestration; the
      // end-of-turn redraw is the single source of hand refresh.
      dealInitialHands(draft);
    }
  }
}
