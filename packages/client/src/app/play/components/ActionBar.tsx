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
 *   ✓ Play ops           — first ops in hand with a sensible target (free)
 *   ✓ End Turn           — voluntary turn-end; held cards discard at cleanup
 */

import type {
  GameAction,
  GameState,
  MashBill,
  OperationsCard,
  PlayerState,
} from "@bourbonomics/engine";
import { computeReward, paymentValue, validateAction } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function ActionBar() {
  const {
    state,
    dispatch,
    autoplay,
    buyMode,
    startBuyMode,
    cancelBuyMode,
    ageMode,
    startAgeMode,
    cancelAgeMode,
    drawBillMode,
    startDrawBillMode,
    cancelDrawBillMode,
    makeMode,
    startMakeMode,
    cancelMakeMode,
  } = useGameStore();
  if (!state) return null;
  if (state.phase !== "action") return null;

  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const isHumanTurn = state.players[state.currentPlayerIndex]?.id === human.id;
  const disabledByTurn = !isHumanTurn || autoplay;
  const inBuyMode = buyMode != null;
  const inAgeMode = ageMode != null;
  const inDrawBillMode = drawBillMode != null;
  const inMakeMode = makeMode != null;

  const sell = bestSellBourbon(state, human);
  const makeEntry = canEnterMakeMode(state, human);
  // Bare-minimum BUY action for the gating tooltip — checks that the
  // human has *some* legal purchase available before we let them enter
  // buying mode. The actual chosen card / payment comes from the
  // interactive overlay.
  const buyEntry = canEnterBuyMode(state, human);
  // Age is a "phase activity" — it has its own picker (AgeOverlay) for
  // selecting which barrel + which pay-card to commit. The bar gates
  // entry on whether the player has at least one ageable barrel and at
  // least one card in hand.
  const ageEntry = canEnterAgeMode(state, human);
  // Draw-bill picker gating — needs at least one card in hand and at
  // least one mash bill in the bourbon deck.
  const drawBillEntry = canEnterDrawBillMode(state, human);
  const trade = bestTrade(state, human);
  const ops = bestPlayOps(state, human);
  const pass: GameAction = { type: "PASS_TURN", playerId: human.id };

  return (
    <div className="border-t border-slate-800 bg-slate-950/95 px-[18px] py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">
          {isHumanTurn ? "Your turn" : "Waiting…"}
        </span>
        <span className="mx-1 h-[20px] w-px bg-slate-800" aria-hidden />

        {/* Age is the lone "phase" control — separate chrome (sky/blue)
            and labeled with a barrel glyph so the player reads it as a
            distinct concept from the regular Action Phase actions. */}
        <PhaseButton
          label="🛢 Age barrel"
          inMode={inAgeMode}
          enabled={!disabledByTurn && ageEntry.canAge}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inAgeMode
                ? "Cancel the in-progress aging"
                : ageEntry.reason ??
                  "Pick a barrel in your Rickhouse, then a card in hand to commit."
          }
          onStart={startAgeMode}
          onCancel={cancelAgeMode}
        />
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
        <SmartButton
          label="Sell"
          action={sell}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Sell your highest-reward 2yo+ barrel for full reputation."
        />
        <BuyButton
          inBuyMode={inBuyMode}
          enabled={!disabledByTurn && buyEntry.canBuy}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inBuyMode
                ? "Cancel the in-progress purchase"
                : buyEntry.reason ?? "Pick a market card and tag the capital cards to spend."
          }
          onStart={startBuyMode}
          onCancel={cancelBuyMode}
        />
        <PickerButton
          label="Draw bill"
          inMode={inDrawBillMode}
          enabled={!disabledByTurn && drawBillEntry.canDraw}
          tooltip={
            disabledByTurn
              ? "Wait for your turn"
              : inDrawBillMode
                ? "Cancel the in-progress draw"
                : drawBillEntry.reason ??
                  "Pick a card to sacrifice; you'll draw the top mash bill blind."
          }
          onStart={startDrawBillMode}
          onCancel={cancelDrawBillMode}
          cancelLabel="Cancel draw"
        />
        <SmartButton
          label="Trade"
          action={trade}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Swap your cheapest card with the first available partner's."
        />
        <SmartButton
          label="Play ops"
          action={null}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Operations cards — pending future release."
        />

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

function PhaseButton({
  label,
  inMode,
  enabled,
  tooltip,
  onStart,
  onCancel,
}: {
  label: string;
  inMode: boolean;
  enabled: boolean;
  tooltip: string;
  onStart: () => void;
  onCancel: () => void;
}) {
  if (inMode) {
    return (
      <button
        type="button"
        onClick={onCancel}
        title={tooltip}
        className="rounded-md border border-rose-500 bg-rose-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-rose-100 transition-colors hover:border-rose-400 hover:bg-rose-800/40"
      >
        Cancel age
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
          ? "rounded-md border border-sky-500/70 bg-sky-900/30 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-sky-100 transition-colors hover:border-sky-300 hover:bg-sky-800/40"
          : "rounded-md border border-slate-800 bg-slate-950/60 px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] text-slate-600 cursor-not-allowed"
      }
    >
      {label}
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
}: {
  label: string;
  inMode: boolean;
  enabled: boolean;
  tooltip: string;
  onStart: () => void;
  onCancel: () => void;
  cancelLabel: string;
}) {
  if (inMode) {
    return (
      <button
        type="button"
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
  if (player.hand.length === 0) {
    return { canDraw: false, reason: "Your hand is empty — nothing to sacrifice." };
  }
  if (state.bourbonDeck.length === 0) {
    return { canDraw: false, reason: "Bourbon deck is empty — no bills left to draw." };
  }
  return { canDraw: true };
}

function canEnterMakeMode(
  state: GameState,
  player: PlayerState,
): { canMake: boolean; reason?: string } {
  if (player.mashBills.length === 0) {
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

function canEnterAgeMode(
  state: GameState,
  player: PlayerState,
): { canAge: boolean; reason?: string } {
  if (player.hand.length === 0) {
    return { canAge: false, reason: "Your hand is empty — nothing to commit." };
  }
  const ageable = state.allBarrels.some(
    (b) =>
      b.ownerId === player.id &&
      !b.inspectedThisRound &&
      (!b.agedThisRound || b.extraAgesAvailable > 0),
  );
  if (!ageable) {
    return { canAge: false, reason: "No ageable barrels in your Rickhouse." };
  }
  return { canAge: true };
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
      ? "rounded-md border border-amber-500 bg-gradient-to-b from-amber-500 to-amber-700 px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600"
      : "rounded-md border border-slate-800 bg-slate-900 px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-[.05em] text-slate-600 cursor-not-allowed"
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

function bestSellBourbon(state: GameState, player: PlayerState): GameAction | null {
  const saleable = state.allBarrels.filter(
    (b) =>
      b.ownerId === player.id &&
      b.phase === "aging" &&
      b.attachedMashBill != null &&
      b.age >= 2,
  );
  if (saleable.length === 0) return null;
  let best: { id: string; reward: number } | null = null;
  for (const b of saleable) {
    const reward = computeReward(b.attachedMashBill!, b.age, state.demand);
    if (!best || reward > best.reward) best = { id: b.id, reward };
  }
  if (!best || best.reward === 0) return null;
  return {
    type: "SELL_BOURBON",
    playerId: player.id,
    barrelId: best.id,
    reputationSplit: best.reward,
    cardDrawSplit: 0,
  };
}

/**
 * Walks the human's operations hand and returns the first card whose
 * "auto-best target" makes a legal action. Each ops def has its own
 * heuristic for picking targets; cards that need cross-player payment
 * (Barrel Broker) are skipped because there's no sensible default.
 *
 * Playing an ops card does NOT consume the action — we keep the turn
 * open so the player can chain Make/Sell/etc.
 */
function bestPlayOps(state: GameState, player: PlayerState): GameAction | null {
  for (const card of player.operationsHand) {
    const action = planOpsTarget(state, player, card);
    if (action && validateAction(state, action).legal) return action;
  }
  return null;
}

function planOpsTarget(
  state: GameState,
  player: PlayerState,
  card: OperationsCard,
): GameAction | null {
  switch (card.defId) {
    case "market_manipulation": {
      // Push demand UP if we have ageable barrels (selling soon); DOWN
      // otherwise so the next demand step doesn't push us out of buying
      // range. Either is legal — only direction varies.
      const hasAgedBarrels = state.allBarrels.some(
        (b) => b.ownerId === player.id && b.age >= 1,
      );
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: card.id,
        defId: "market_manipulation",
        direction: hasAgedBarrels ? "up" : "down",
      };
    }
    case "regulatory_inspection": {
      // Lock down an opponent's most-valuable barrel.
      const candidate = state.allBarrels
        .filter((b) => b.ownerId !== player.id)
        .filter((b) => b.attachedMashBill != null)
        .sort((a, b) => peakReward(b.attachedMashBill!) - peakReward(a.attachedMashBill!))[0];
      if (!candidate) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: card.id,
        defId: "regulatory_inspection",
        targetBarrelId: candidate.id,
      };
    }
    case "rushed_shipment": {
      // Extra age on our most-valuable still-aging barrel.
      const ours = state.allBarrels
        .filter((b) => b.ownerId === player.id && b.age < 3)
        .filter((b) => b.attachedMashBill != null)
        .sort((a, b) => peakReward(b.attachedMashBill!) - peakReward(a.attachedMashBill!))[0];
      if (!ours) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: card.id,
        defId: "rushed_shipment",
        targetBarrelId: ours.id,
      };
    }
    case "barrel_broker":
      // Needs cross-player payment selection — skip auto-pick.
      return null;
    case "market_corner": {
      // Grab the most-expensive market card straight to hand (free).
      let bestIdx = -1;
      let bestCost = -1;
      for (let i = 0; i < state.marketConveyor.length; i++) {
        const c = state.marketConveyor[i]!;
        const cost = c.cost ?? 1;
        if (cost > bestCost) {
          bestIdx = i;
          bestCost = cost;
        }
      }
      if (bestIdx < 0) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: card.id,
        defId: "market_corner",
        marketSlotIndex: bestIdx,
      };
    }
    case "blend": {
      // Combine our two highest-peak barrels.
      const eligible = state.allBarrels
        .filter((b) => b.ownerId === player.id)
        .filter((b) => b.attachedMashBill != null)
        .sort((a, b) => peakReward(b.attachedMashBill!) - peakReward(a.attachedMashBill!));
      if (eligible.length < 2) return null;
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: card.id,
        defId: "blend",
        barrel1Id: eligible[0]!.id,
        barrel2Id: eligible[1]!.id,
      };
    }
    case "demand_surge":
      return {
        type: "PLAY_OPERATIONS_CARD",
        playerId: player.id,
        cardId: card.id,
        defId: "demand_surge",
      };
    default:
      return null;
  }
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
  if (state.marketConveyor.length === 0) {
    return { canBuy: false, reason: "Market conveyor is empty" };
  }
  // Wallet = sum of payment value across the whole hand. Capital cards
  // pay their face value; resource cards pay B$1 each. Same rule the
  // engine enforces in BUY_FROM_MARKET validation.
  const wallet = player.hand.reduce((acc, c) => acc + paymentValue(c), 0);
  if (wallet === 0) {
    return { canBuy: false, reason: "Hand is empty — nothing to spend" };
  }
  const cheapest = state.marketConveyor.reduce(
    (lo, c) => Math.min(lo, c.cost ?? 1),
    Infinity,
  );
  if (wallet < cheapest) {
    return {
      canBuy: false,
      reason: `Cheapest market card costs B$${cheapest} — you have B$${wallet}`,
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

// -----------------------------------------------------------------------------
// Internal helpers
// -----------------------------------------------------------------------------

function peakReward(bill: MashBill): number {
  let max = 0;
  for (const row of bill.rewardGrid) {
    for (const cell of row) if (cell !== null && cell > max) max = cell;
  }
  return max;
}
