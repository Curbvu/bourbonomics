"use client";

/**
 * Action bar — the human player's control surface during the action
 * phase. Trimmed in v3.x to two buttons (Trade + End turn) once the
 * rest of the verbs got *implicit* on-screen affordances:
 *
 *   - Make Bourbon       → drag a hand card (or selection) onto a slot,
 *                          or select-then-click the slot. No button.
 *   - Sell Bottle        → the on-barrel "Sell Bottle →" button on each
 *                          saleable barrel (DistilleryStage). No bar
 *                          button.
 *   - Buy from Market    → click a market card; MarketRow starts
 *                          buyMode and pre-targets the slot. No bar
 *                          button.
 *   - Age barrel         → engine forces it via `needsAgeBarrels`; the
 *                          store auto-engages ageMode, AgeOverlay
 *                          drives the picks.
 *   - Draft Mash Bill    → launcher on the human's next empty
 *                          rickhouse slot (DistilleryStage).
 *
 * What's left here:
 *
 *   ✓ Trade              — first eligible partner, swap the cheapest
 *                          cards.
 *   ✓ End Turn           — voluntary turn-end; held cards discard at
 *                          cleanup.
 */

import type {
  GameAction,
  GameState,
  PlayerState,
} from "@bourbonomics/engine";
import { validateAction } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function ActionBar() {
  const {
    state,
    dispatch,
    autoplay,
    triggerEndTurnDiscardAnimation,
    tutorialActive,
    tutorialSpotlight,
  } = useGameStore();
  if (!state) return null;
  if (state.phase !== "action") return null;

  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const isHumanTurn = state.players[state.currentPlayerIndex]?.id === human.id;
  const disabledByTurn = !isHumanTurn || autoplay;

  // Tutorial gating: the bar now only ships Trade + End turn, so we
  // only need to gate those two verbs against the spotlight. Picker
  // verbs (make/sell/buy) are driven by their on-screen affordances
  // and gated there.
  const tutorialAllows = (verb: "trade" | "pass") => {
    if (!tutorialActive) return true;
    const spot = tutorialSpotlight;
    if (!spot) return false;
    if (spot.kind === "action-button" && spot.action === verb) return true;
    return false;
  };

  const trade = bestTrade(state, human);
  const pass: GameAction = { type: "PASS_TURN", playerId: human.id };

  return (
    <div
      data-bb-zone="action-bar"
      className="flex flex-wrap items-center gap-1.5"
    >
      <SmartButton
        label="Trade"
        action={trade}
        state={state}
        dispatch={dispatch}
        disabledByTurn={disabledByTurn}
        tutorialBlocked={!tutorialAllows("trade")}
        tooltipIdle="Swap your cheapest card with the first available partner's."
      />
      <SmartButton
        label="End turn ↵"
        action={pass}
        state={state}
        dispatch={(a) => {
          // Capture the human's current hand BEFORE dispatching so
          // EndTurnFlight can fly each card to the discard pile while
          // the engine clears the hand state synchronously.
          triggerEndTurnDiscardAnimation(human.hand.slice(), human.id);
          dispatch(a);
        }}
        disabledByTurn={disabledByTurn}
        tutorialBlocked={!tutorialAllows("pass")}
        tooltipIdle="End your turn for the round. Cards in hand are held for cleanup."
        primary
        dataAction="pass"
      />
    </div>
  );
}

function SmartButton({
  label,
  action,
  state,
  dispatch,
  disabledByTurn,
  tutorialBlocked = false,
  tooltipIdle,
  primary = false,
  dataAction,
}: {
  label: string;
  action: GameAction | null;
  state: GameState;
  dispatch: (a: GameAction) => void;
  disabledByTurn: boolean;
  /** When true, the tutorial is steering the player elsewhere — disable
   *  this button regardless of engine legality. */
  tutorialBlocked?: boolean;
  tooltipIdle: string;
  primary?: boolean;
  // Tutorial spotlight hook — when provided, renders `data-bb-action`
  // so the SpotlightLayer can pin a ring on this button.
  dataAction?: string;
}) {
  let enabled = false;
  let tooltip = tooltipIdle;
  if (disabledByTurn) {
    tooltip = "Wait for your turn";
  } else if (tutorialBlocked) {
    tooltip = "Follow the highlighted step first";
  } else if (!action) {
    tooltip = "No legal play available";
  } else {
    const v = validateAction(state, action);
    if (v.legal) {
      enabled = true;
    } else {
      tooltip = v.reason ?? "illegal";
    }
  }
  const onClick = () => {
    if (enabled && action) dispatch(action);
  };
  const baseClasses = primary
    ? enabled
      ? "rounded-md border border-amber-500 bg-gradient-to-b from-amber-500 to-amber-700 px-3 py-1 font-sans text-[13px] font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600"
      : "rounded-md border border-slate-800 bg-slate-900 px-3 py-1 font-sans text-[13px] font-bold uppercase tracking-[.05em] text-slate-600 cursor-not-allowed"
    : enabled
      ? "rounded-md border border-emerald-700/60 bg-emerald-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-emerald-100 transition-colors hover:border-emerald-400 hover:bg-emerald-800/40"
      : "rounded-md border border-slate-800 bg-slate-950/60 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-600 cursor-not-allowed";
  const dataAttr = dataAction ? { "data-bb-action": dataAction } : {};
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      title={tooltip}
      className={baseClasses}
      {...dataAttr}
    >
      {label}
    </button>
  );
}

function bestTrade(state: GameState, player: PlayerState): GameAction | null {
  if (state.finalRoundTriggered) return null;
  if (player.hand.length === 0) return null;
  const partner = state.players.find(
    (p) => p.id !== player.id && !p.outForRound && p.hand.length > 0,
  );
  if (!partner) return null;
  return {
    type: "TRADE",
    player1Id: player.id,
    player2Id: partner.id,
    player1Cards: [player.hand[0]!.id],
    player2Cards: [partner.hand[0]!.id],
  };
}
