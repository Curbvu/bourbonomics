"use client";

/**
 * Action bar — the human player's control surface during the action phase.
 *
 * Every button computes its own "best legal play" inline (auto-pick the
 * sensible target / mash / payment) and dispatches it on click. Multi-step
 * pickers can land in a future iteration; this gets every action wired
 * end-to-end with a single click so the human seat actually plays.
 *
 * v2.2: the active player keeps the cursor across every main action —
 * Make/Age/Sell/Buy/Draw/Trade no longer end the turn. The player taps
 * actions in any order until they tap "End turn", at which point play
 * passes to the next seat.
 *
 *   ✓ Make Bourbon       — auto-plan minimum-legal mash from hand
 *   ✓ Age barrel         — interactive picker (barrel + pay-card); separate
 *                          chrome because aging is a *phase* activity, not
 *                          one of the regular Action Phase actions
 *   ✓ Sell Bourbon       — highest-reward 2yo+ barrel, take all rep
 *   ✓ Draw bill          — interactive picker (sacrifice card → top-of-deck
 *                          blind draw)
 *   ✓ Buy from Market    — most-expensive affordable conveyor card
 *   ✓ Draw a Mash Bill   — auto-spend the cheapest hand card
 *   ✓ Trade              — first eligible partner, swap the cheapest cards
 *   ✓ End Turn           — voluntary turn-end; held cards discard at cleanup
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
    buyMode,
    startBuyMode,
    cancelBuyMode,
    drawBillMode,
    startDrawBillMode,
    cancelDrawBillMode,
    makeMode,
    startMakeMode,
    cancelMakeMode,
    sellMode,
    startSellMode,
    cancelSellMode,
  } = useGameStore();
  if (!state) return null;
  if (state.phase !== "action") return null;

  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const isHumanTurn = state.players[state.currentPlayerIndex]?.id === human.id;
  const disabledByTurn = !isHumanTurn || autoplay;
  const inBuyMode = buyMode != null;
  const inDrawBillMode = drawBillMode != null;
  const inMakeMode = makeMode != null;
  const inSellMode = sellMode != null;

  const sellEntry = canEnterSellMode(state, human);
  const makeEntry = canEnterMakeMode(state, human);
  // Bare-minimum BUY action for the gating tooltip — checks that the
  // human has *some* legal purchase available before we let them enter
  // buying mode. The actual chosen card / payment comes from the
  // interactive overlay.
  const buyEntry = canEnterBuyMode(state, human);
  // Aging has no Action-bar entry — the engine forces it via
  // `needsAgeBarrels` (the store auto-engages ageMode), and AgeOverlay's
  // banner tracks progress through the remaining picks.
  // Draw-bill picker gating — needs at least one card in hand and at
  // least one mash bill in the bourbon deck.
  const drawBillEntry = canEnterDrawBillMode(state, human);
  const trade = bestTrade(state, human);
  const pass: GameAction = { type: "PASS_TURN", playerId: human.id };

  return (
    <div data-bb-zone="action-bar" className="border-t border-slate-800 bg-slate-950/95 px-[18px] py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[12px] uppercase tracking-[.18em] text-slate-500">
          {isHumanTurn ? "Your turn" : "Waiting…"}
        </span>
        <span className="mx-1 h-[20px] w-px bg-slate-800" aria-hidden />

        <PickerButton
          label="Make"
          inMode={inMakeMode}
          enabled={!disabledByTurn && makeEntry.canMake}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inMakeMode
                ? "Cancel the in-progress production"
                : makeEntry.reason ??
                  "Pick a mash bill, then tag the cards to commit."
          }
          onStart={startMakeMode}
          onCancel={cancelMakeMode}
          cancelLabel="Cancel make"
        />
        <PickerButton
          label="Sell"
          inMode={inSellMode}
          enabled={!disabledByTurn && sellEntry.canSell}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inSellMode
                ? "Cancel the in-progress sale"
                : sellEntry.reason ??
                  "Pick a sellable barrel in your Rickhouse — the sale resolves instantly."
          }
          onStart={startSellMode}
          onCancel={cancelSellMode}
          cancelLabel="Cancel sell"
          dataAction="sell"
        />
        <BuyButton
          inBuyMode={inBuyMode}
          enabled={!disabledByTurn && buyEntry.canBuy}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inBuyMode
                ? "Cancel the in-progress purchase"
                : buyEntry.reason ?? "Pick a market card. Pay with rep, Labor, or a mix."
          }
          onStart={startBuyMode}
          onCancel={cancelBuyMode}
        />
        <PickerButton
          label="Draft bills"
          inMode={inDrawBillMode}
          enabled={!disabledByTurn && drawBillEntry.canDraw}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inDrawBillMode
                ? "Cancel the in-progress draft"
                : drawBillEntry.reason ??
                  "Pick a card to seed the draft pile; 3 mash bills are revealed for the table."
          }
          onStart={startDrawBillMode}
          onCancel={cancelDrawBillMode}
          cancelLabel="Cancel draft"
        />
        <SmartButton
          label="Trade"
          action={trade}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Swap your cheapest card with the first available partner's."
        />
        {/* Play Ops button removed — operations cards are pending future
            release; the placeholder button cluttered the bar. */}

        <span className="flex-1" />

        <SmartButton
          label="End turn ↵"
          action={pass}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="End your turn for the round. Cards in hand are held for cleanup."
          primary
        />
      </div>
    </div>
  );
}

/**
 * Picker-style action button — same emerald chrome as a `SmartButton` so
 * it reads as a regular Action Phase action, but instead of dispatching
 * on click it opens an interactive picker (AgeOverlay / DrawBillOverlay /
 * BuyOverlay style). Cancellable while the picker is open.
 */
function PickerButton({
  label,
  inMode,
  enabled,
  tooltip,
  onStart,
  onCancel,
  cancelLabel,
  dataAction,
}: {
  label: string;
  inMode: boolean;
  enabled: boolean;
  tooltip: string;
  onStart: () => void;
  onCancel: () => void;
  cancelLabel: string;
  // Stable hook for the tutorial's `action-button` spotlight target —
  // persists across the in-mode / not-in-mode toggle so the spotlight
  // ring stays attached even after the picker engages.
  dataAction?: string;
}) {
  const dataAttr = dataAction ? { "data-bb-action": dataAction } : {};
  if (inMode) {
    return (
      <button
        type="button"
        {...dataAttr}
        onClick={onCancel}
        title={tooltip}
        className="rounded-md border border-rose-500 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
      >
        {cancelLabel}
      </button>
    );
  }
  return (
    <button
      type="button"
      {...dataAttr}
      disabled={!enabled}
      onClick={enabled ? onStart : undefined}
      title={tooltip}
      className={
        enabled
          ? "rounded-md border border-emerald-700/60 bg-emerald-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-emerald-100 transition-colors hover:border-emerald-400 hover:bg-emerald-800/40"
          : "rounded-md border border-slate-800 bg-slate-950/60 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-600 cursor-not-allowed"
      }
    >
      {label}
    </button>
  );
}

function canEnterDrawBillMode(
  state: GameState,
  player: PlayerState,
): { canDraw: boolean; reason?: string } {
  if (state.draftingLoop) {
    return { canDraw: false, reason: "A Drafting Loop is already in progress." };
  }
  if (state.finalRoundTriggered) {
    return { canDraw: false, reason: "The Drafting Loop is not legal in the final round." };
  }
  if (player.draftingLoopUsedThisRound) {
    return { canDraw: false, reason: "You've already initiated the loop this round." };
  }
  if (player.hand.length === 0) {
    return { canDraw: false, reason: "Your hand is empty — nothing to seed the pile with." };
  }
  if (state.bourbonDeck.length === 0) {
    return { canDraw: false, reason: "Bourbon deck is empty — no bills left to reveal." };
  }
  return { canDraw: true };
}

function canEnterMakeMode(
  state: GameState,
  player: PlayerState,
): { canMake: boolean; reason?: string } {
  // v2.6: bills are slot-bound. "Has any bill to commit to?" maps to
  // "owns any non-aging-phase barrel" (ready or construction).
  const hasCommittableSlot = state.allBarrels.some(
    (b) => b.ownerId === player.id && b.phase !== "aging",
  );
  if (!hasCommittableSlot) {
    return { canMake: false, reason: "No mash bills in hand — draw one first." };
  }
  if (player.hand.length === 0) {
    return { canMake: false, reason: "Your hand is empty — nothing to commit." };
  }
  const occupied = new Set(
    state.allBarrels.filter((b) => b.ownerId === player.id).map((b) => b.slotId),
  );
  if (player.rickhouseSlots.every((s) => occupied.has(s.id))) {
    return { canMake: false, reason: "Your rickhouse is full." };
  }
  return { canMake: true };
}

function BuyButton({
  inBuyMode,
  enabled,
  tooltip,
  onStart,
  onCancel,
}: {
  inBuyMode: boolean;
  enabled: boolean;
  tooltip: string;
  onStart: () => void;
  onCancel: () => void;
}) {
  if (inBuyMode) {
    return (
      <button
        type="button"
        onClick={onCancel}
        title={tooltip}
        className="rounded-md border border-rose-500 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
      >
        Cancel buy
      </button>
    );
  }
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={enabled ? onStart : undefined}
      title={tooltip}
      className={
        enabled
          ? "rounded-md border border-emerald-700/60 bg-emerald-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-emerald-100 transition-colors hover:border-emerald-400 hover:bg-emerald-800/40"
          : "rounded-md border border-slate-800 bg-slate-950/60 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-600 cursor-not-allowed"
      }
    >
      Buy market
    </button>
  );
}

function SmartButton({
  label,
  action,
  state,
  dispatch,
  disabledByTurn,
  tooltipIdle,
  primary = false,
}: {
  label: string;
  action: GameAction | null;
  state: GameState;
  dispatch: (a: GameAction) => void;
  disabledByTurn: boolean;
  tooltipIdle: string;
  primary?: boolean;
}) {
  let enabled = false;
  let tooltip = tooltipIdle;
  if (disabledByTurn) {
    tooltip = "Wait for your turn";
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
  return (
    <button
      type="button"
      disabled={!enabled}
      onClick={onClick}
      title={tooltip}
      className={baseClasses}
    >
      {label}
    </button>
  );
}

// =============================================================================
// "Best legal play" helpers — each returns either an action object or null.
// Buttons are enabled iff the action is non-null AND validateAction is legal.
// =============================================================================

/**
 * Sell-mode gating — return whether the human has any saleable barrel
 * (aging-phase, age ≥2, with a bill) AND a hand card to spend as the
 * sell-action cost. The actual barrel + spend card pick is left to the
 * interactive picker (RickhouseRow + HandTray click handlers).
 */
function canEnterSellMode(
  state: GameState,
  player: PlayerState,
): { canSell: boolean; reason?: string } {
  // v2.10: a barrel is sellable iff it's aging, age >= 2, and has
  // been in Aging for at least one full round (round-gap rule).
  const saleable = state.allBarrels.some(
    (b) =>
      b.ownerId === player.id &&
      b.phase === "aging" &&
      b.attachedMashBill != null &&
      b.age >= 2 &&
      (b.completedInRound == null || state.round > b.completedInRound),
  );
  if (!saleable) {
    return { canSell: false, reason: "No sellable barrels (age 2+, aged one full round)." };
  }
  return { canSell: true };
}

/**
 * Interactive Buy gating — return whether the human has *any* legal
 * purchase, plus a reason string when they don't. Picking the actual
 * slot + payment is left to the BuyOverlay.
 */
function canEnterBuyMode(
  state: GameState,
  player: PlayerState,
): { canBuy: boolean; reason?: string } {
  if (state.market.length === 0) {
    return { canBuy: false, reason: "Market is empty" };
  }
  // Wallet = rep + max Labor contribution. The engine enforces precise
  // domain matching at apply time; this is an upper bound for gating.
  const laborContrib = player.hand.reduce(
    (acc, c) => acc + (c.type === "labor" ? c.laborContribution ?? 1 : 0),
    0,
  );
  const wallet = player.reputation + laborContrib;
  if (wallet === 0) {
    return { canBuy: false, reason: "No rep or Labor — nothing to spend" };
  }
  const cheapest = state.market.reduce(
    (lo: number, c) => Math.min(lo, c.cost ?? 1),
    Infinity,
  );
  if (wallet < cheapest) {
    return {
      canBuy: false,
      reason: `Cheapest market card costs ${cheapest} — you can pay ${wallet}`,
    };
  }
  return { canBuy: true };
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
