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
 *   ✓ Buy from Market    — most-expensive affordable conveyor card
 *   ✓ Draft Mash Bill    — launcher lives on the human's "next
 *                          available" rickhouse slot (DistilleryStage),
 *                          not the action bar
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
    makeMode,
    startMakeMode,
    cancelMakeMode,
    sellMode,
    startSellMode,
    cancelSellMode,
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
  const inBuyMode = buyMode != null;
  const inMakeMode = makeMode != null;
  const inSellMode = sellMode != null;

  // Tutorial gating: during the on-rails walkthrough, the player should
  // only have access to the action that the current spotlight is asking
  // for. Cancel-state buttons (Make/Sell/Buy showing "Cancel X") are
  // always allowed so the player can bail out of a picker. The Buy
  // button is also allowed when the spotlight is on a market slot/row,
  // because clicking Buy is the canonical entry into the drawer.
  const tutorialAllows = (verb: "make" | "sell" | "buy" | "trade" | "pass") => {
    if (!tutorialActive) return true;
    if (verb === "make" && inMakeMode) return true;
    if (verb === "sell" && inSellMode) return true;
    if (verb === "buy" && inBuyMode) return true;
    const spot = tutorialSpotlight;
    if (!spot) return false;
    if (spot.kind === "action-button" && spot.action === verb) return true;
    if (
      verb === "buy" &&
      (spot.kind === "market-slot" || spot.kind === "market-row")
    ) {
      return true;
    }
    return false;
  };

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
  // Drafting Loop also has no Action-bar entry — the launcher lives on
  // the human's "next available" rickhouse slot (see DistilleryStage).
  const trade = bestTrade(state, human);
  const pass: GameAction = { type: "PASS_TURN", playerId: human.id };
  // v3.2: Line Card draw button retired alongside the subsystem.
  // The Brand Portfolio Draft Second Portfolio button will land
  // here in a follow-on phase.

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
          enabled={!disabledByTurn && makeEntry.canMake && tutorialAllows("make")}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inMakeMode
                ? "Cancel the in-progress production"
                : !tutorialAllows("make")
                  ? "Follow the highlighted step first"
                  : makeEntry.reason ??
                    "Pick a mash bill, then tag the cards to commit."
          }
          onStart={startMakeMode}
          onCancel={cancelMakeMode}
          cancelLabel="Cancel make"
          dataAction="make"
        />
        <PickerButton
          label="Sell"
          inMode={inSellMode}
          enabled={!disabledByTurn && sellEntry.canSell && tutorialAllows("sell")}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inSellMode
                ? "Cancel the in-progress sale"
                : !tutorialAllows("sell")
                  ? "Follow the highlighted step first"
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
          enabled={!disabledByTurn && buyEntry.canBuy && tutorialAllows("buy")}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inBuyMode
                ? "Cancel the in-progress purchase"
                : !tutorialAllows("buy")
                  ? "Follow the highlighted step first"
                  : buyEntry.reason ?? "Pick a market card. Pay with Capital, Labor, or a mix."
          }
          onStart={startBuyMode}
          onCancel={cancelBuyMode}
        />
        <SmartButton
          label="Trade"
          action={trade}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tutorialBlocked={!tutorialAllows("trade")}
          tooltipIdle="Swap your cheapest card with the first available partner's."
        />
        {/* v3.2: Draw Line Cards button retired; Draft Second
            Portfolio is offered inside the Brand Portfolio drawer. */}

        <span className="flex-1" />

        <PortfolioButton />

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
    </div>
  );
}

/**
 * v3.2 — Brand Portfolio entry-point chip on the action bar. Shows
 * the human's flagship tier + filled-required-slot progress and opens
 * the BrandPortfolioDrawer when clicked. Gold-on-amber chrome
 * distinguishes it from the green Action Phase buttons — the drawer
 * is *not* an action (no engine dispatch), just a view-and-place
 * surface.
 */
function PortfolioButton() {
  const { state, humanSeatPlayerId, setPortfolioDrawerOpen } = useGameStore();
  const player = humanSeatPlayerId
    ? state?.players.find((p) => p.id === humanSeatPlayerId)
    : null;
  if (!player || !player.flagshipPortfolio.portfolioId) return null;
  const reqSlots = player.flagshipPortfolio.slots.filter((s, i) => {
    // Cheap proxy: the flagship's slot defs come from the catalog,
    // but the strip cares about required-slot progress. We need the
    // PortfolioState alone — every flagship in v3.2 ships with required
    // slots tagged via the catalog. For the chip's progress dots we
    // approximate by counting filled vs total here; the drawer surfaces
    // the precise required vs optional breakdown.
    return i >= 0;
  });
  const filled = reqSlots.filter((s) => s.filled).length;
  const total = reqSlots.length;
  return (
    <button
      type="button"
      onClick={() => setPortfolioDrawerOpen(true)}
      title="Open your Brand Portfolio (Esc to close)"
      className="group flex items-center gap-2 rounded-md border px-2.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.14em] transition-colors hover:brightness-110"
      style={{
        borderColor: "rgba(198,157,82,.55)",
        background: "linear-gradient(180deg, rgba(240,201,112,.14), rgba(34,23,16,.85))",
        color: "var(--gold)",
      }}
    >
      <span>Portfolio</span>
      <span aria-hidden className="h-3.5 w-px" style={{ background: "rgba(198,157,82,.4)" }} />
      <span className="font-mono text-[10px] tabular-nums" style={{ color: "var(--brass)" }}>
        {filled}/{total}
      </span>
      <span className="flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{
              background: i < filled ? "var(--gold)" : "transparent",
              border: i < filled ? "0" : "1px solid rgba(198,157,82,.5)",
            }}
          />
        ))}
      </span>
    </button>
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
        data-bb-action="buy"
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
      data-bb-action="buy"
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
  // v3.3: Wallet = Capital + max Labor contribution. The engine
  // enforces precise domain matching at apply time; this is an upper
  // bound for gating.
  const laborContrib = player.hand.reduce(
    (acc, c) => acc + (c.type === "labor" ? c.laborContribution ?? 1 : 0),
    0,
  );
  const wallet = player.capital + laborContrib;
  if (wallet === 0) {
    return { canBuy: false, reason: "No Capital or Labor — nothing to spend" };
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
