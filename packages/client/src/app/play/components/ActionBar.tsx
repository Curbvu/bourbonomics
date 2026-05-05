"use client";

/**
 * Action bar — the human player's control surface during the action phase.
 *
 * Every button computes its own "best legal play" inline (auto-pick the
 * sensible target / mash / payment) and dispatches it on click. Multi-step
 * pickers can land in a future iteration; this gets every action wired
 * end-to-end with a single click so the human seat actually plays.
 *
 *   ✓ Make Bourbon       — auto-plan minimum-legal mash from hand
 *   ✓ Age Bourbon        — first eligible barrel + cheapest hand card
 *   ✓ Sell Bourbon       — highest-reward 2yo+ barrel, take all rep
 *   ✓ Rush to Market     — first 1yo barrel
 *   ✓ Buy from Market    — most-expensive affordable conveyor card
 *   ✓ Draw a Mash Bill   — auto-spend the cheapest hand card
 *   ✓ Trade              — first eligible partner, swap the cheapest cards
 *   ✓ Pass Turn          — one-click dispatch
 */

import type {
  Card,
  GameAction,
  GameState,
  GrainSubtype,
  MashBill,
  PlayerState,
  ResourceSubtype,
} from "@bourbonomics/engine";
import {
  capitalUnits,
  computeReward,
  isWheatedBill,
  resourceUnits,
  suppliesResource,
  validateAction,
} from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function ActionBar() {
  const { state, dispatch, autoplay } = useGameStore();
  if (!state) return null;
  if (state.phase !== "action") return null;

  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const isHumanTurn = state.players[state.currentPlayerIndex]?.id === human.id;
  const disabledByTurn = !isHumanTurn || autoplay;

  const make = bestMakeBourbon(state, human);
  const age = bestAgeBourbon(state, human);
  const sell = bestSellBourbon(state, human);
  const rush = bestRushToMarket(state, human);
  const buy = bestBuyFromMarket(state, human);
  const drawBill = bestDrawMashBill(state, human);
  const trade = bestTrade(state, human);
  const pass: GameAction = { type: "PASS_TURN", playerId: human.id };

  return (
    <div className="border-t border-slate-800 bg-slate-950/95 px-[18px] py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">
          {isHumanTurn ? "Your turn" : "Waiting…"}
        </span>
        <span className="mx-1 h-[20px] w-px bg-slate-800" aria-hidden />

        <SmartButton
          label="Make"
          action={make}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Make a barrel of bourbon — auto-plans a minimum-legal mash."
        />
        <SmartButton
          label="Age"
          action={age}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Age your first eligible barrel using your cheapest card."
        />
        <SmartButton
          label="Sell"
          action={sell}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Sell your highest-reward 2yo+ barrel for full reputation."
        />
        <SmartButton
          label="Rush"
          action={rush}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Rush a 1yo barrel for half reputation; demand does not drop."
        />
        <SmartButton
          label="Buy market"
          action={buy}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Buy the most-expensive market card you can afford."
        />
        <SmartButton
          label="Draw bill"
          action={drawBill}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Draw the top mash bill — spends your cheapest card."
        />
        <SmartButton
          label="Trade"
          action={trade}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="Swap your cheapest card with the first available partner's."
        />

        <span className="flex-1" />

        <SmartButton
          label="Pass ↵"
          action={pass}
          state={state}
          dispatch={dispatch}
          disabledByTurn={disabledByTurn}
          tooltipIdle="End your turn for the round."
          primary
        />
      </div>
    </div>
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

function bestMakeBourbon(state: GameState, player: PlayerState): GameAction | null {
  if (player.mashBills.length === 0) return null;
  const slotId = firstEmptySlotId(state, player.id);
  if (!slotId) return null;

  // Try mash bills in order of peak reward so the auto-make uses the
  // best available recipe.
  const billsByPeak = [...player.mashBills].sort((a, b) => peakReward(b) - peakReward(a));
  for (const bill of billsByPeak) {
    const cardIds = planMash(player, bill);
    if (cardIds) {
      return {
        type: "MAKE_BOURBON",
        playerId: player.id,
        cardIds,
        mashBillId: bill.id,
        slotId,
      };
    }
  }
  return null;
}

function bestAgeBourbon(state: GameState, player: PlayerState): GameAction | null {
  if (player.hand.length === 0) return null;
  const barrel = state.allBarrels.find(
    (b) =>
      b.ownerId === player.id &&
      !b.inspectedThisRound &&
      (!b.agedThisRound || b.extraAgesAvailable > 0),
  );
  if (!barrel) return null;
  const card =
    player.hand.find((c) => c.type === "capital" && (c.capitalValue ?? 1) === 1) ??
    player.hand.find((c) => (c.resourceCount ?? 1) === 1) ??
    player.hand[0];
  if (!card) return null;
  return {
    type: "AGE_BOURBON",
    playerId: player.id,
    barrelId: barrel.id,
    cardId: card.id,
  };
}

function bestSellBourbon(state: GameState, player: PlayerState): GameAction | null {
  const saleable = state.allBarrels.filter(
    (b) => b.ownerId === player.id && b.age >= 2,
  );
  if (saleable.length === 0) return null;
  let best: { id: string; reward: number } | null = null;
  for (const b of saleable) {
    const reward = computeReward(b.attachedMashBill, b.age, state.demand);
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

function bestRushToMarket(state: GameState, player: PlayerState): GameAction | null {
  const oneYear = state.allBarrels.find(
    (b) => b.ownerId === player.id && b.age === 1,
  );
  if (!oneYear) return null;
  return {
    type: "RUSH_TO_MARKET",
    playerId: player.id,
    barrelId: oneYear.id,
  };
}

function bestBuyFromMarket(state: GameState, player: PlayerState): GameAction | null {
  const totalCapital = player.hand.reduce((acc, c) => acc + capitalUnits(c), 0);
  if (totalCapital === 0) return null;

  let best: { slotIndex: number; cost: number } | null = null;
  for (let i = 0; i < state.marketConveyor.length; i++) {
    const card = state.marketConveyor[i]!;
    const cost = card.cost ?? 1;
    if (cost > totalCapital) continue;
    if (!best || cost > best.cost) best = { slotIndex: i, cost };
  }
  if (!best) return null;

  // Spend cheapest capital cards meeting the cost.
  const capitalCards = player.hand
    .filter((c) => c.type === "capital")
    .sort((a, b) => (a.capitalValue ?? 1) - (b.capitalValue ?? 1));
  const spendCardIds: string[] = [];
  let paid = 0;
  for (const c of capitalCards) {
    spendCardIds.push(c.id);
    paid += capitalUnits(c);
    if (paid >= best.cost) break;
  }
  if (paid < best.cost) return null;
  return {
    type: "BUY_FROM_MARKET",
    playerId: player.id,
    marketSlotIndex: best.slotIndex,
    spendCardIds,
  };
}

function bestDrawMashBill(state: GameState, player: PlayerState): GameAction | null {
  if (state.bourbonDeck.length === 0) return null;
  if (player.hand.length === 0) return null;
  // Prefer the cheapest capital, fall back to any card.
  const candidates = [...player.hand].sort((a, b) => {
    const av = a.type === "capital" ? (a.capitalValue ?? 1) : 99;
    const bv = b.type === "capital" ? (b.capitalValue ?? 1) : 99;
    return av - bv;
  });
  const spend = candidates[0];
  if (!spend) return null;
  return {
    type: "DRAW_MASH_BILL",
    playerId: player.id,
    spendCardId: spend.id,
  };
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

function firstEmptySlotId(state: GameState, playerId: string): string | null {
  const player = state.players.find((p) => p.id === playerId);
  if (!player) return null;
  const occupied = new Set(
    state.allBarrels.filter((b) => b.ownerId === playerId).map((b) => b.slotId),
  );
  // Prefer bonded slots when free (inviolable).
  const ordered = [...player.rickhouseSlots].sort((a, b) => {
    const aB = a.tier === "bonded" ? 0 : 1;
    const bB = b.tier === "bonded" ? 0 : 1;
    return aB - bB;
  });
  for (const s of ordered) if (!occupied.has(s.id)) return s.id;
  return null;
}

function peakReward(bill: MashBill): number {
  let max = 0;
  for (const row of bill.rewardGrid) {
    for (const cell of row) if (cell !== null && cell > max) max = cell;
  }
  return max;
}

/**
 * Greedy minimum-legal mash planner — copies the bot's logic so the
 * action-bar Make button reaches the same plan a bot turn would.
 */
function planMash(player: PlayerState, mb: MashBill): string[] | null {
  const recipe = mb.recipe ?? {};
  const minCorn = Math.max(1, recipe.minCorn ?? 0);
  const minRye = recipe.minRye ?? 0;
  const minBarley = recipe.minBarley ?? 0;
  let minWheat = recipe.minWheat ?? 0;
  if (player.distillery?.bonus === "wheated_baron" && isWheatedBill(mb)) {
    minWheat = Math.max(0, minWheat - 1);
  }
  const maxRye = recipe.maxRye ?? Infinity;
  const maxWheat = recipe.maxWheat ?? Infinity;

  const used = new Set<string>();

  const cask = player.hand.find((c) => suppliesResource(c, "cask"));
  if (!cask) return null;
  used.add(cask.id);

  const cornCards = takeBySubtype(player.hand, "corn", minCorn, used);
  if (cornCards === null) return null;

  const ryeCards = takeBySubtype(player.hand, "rye", minRye, used);
  if (ryeCards === null) return null;
  const barleyCards = takeBySubtype(player.hand, "barley", minBarley, used);
  if (barleyCards === null) return null;
  const wheatCards = takeBySubtype(player.hand, "wheat", minWheat, used);
  if (wheatCards === null) return null;

  let totalGrain =
    sumUnits(ryeCards, "rye") +
    sumUnits(barleyCards, "barley") +
    sumUnits(wheatCards, "wheat");
  const extras: Card[] = [];
  if (totalGrain < 1) {
    const candidates: GrainSubtype[] = ["rye", "barley", "wheat"];
    let added = false;
    for (const sub of candidates) {
      if (sub === "rye" && maxRye === 0) continue;
      if (sub === "wheat" && maxWheat === 0) continue;
      const taken = takeBySubtype(player.hand, sub, 1, used);
      if (taken && taken.length > 0) {
        extras.push(...taken);
        totalGrain += sumUnits(taken, sub);
        added = true;
        break;
      }
    }
    if (!added) return null;
  }
  if (sumUnits(ryeCards, "rye") > maxRye) return null;
  if (sumUnits(wheatCards, "wheat") > maxWheat) return null;

  return [
    cask.id,
    ...cornCards.map((c) => c.id),
    ...ryeCards.map((c) => c.id),
    ...barleyCards.map((c) => c.id),
    ...wheatCards.map((c) => c.id),
    ...extras.map((c) => c.id),
  ];
}

function takeBySubtype(
  hand: Card[],
  subtype: ResourceSubtype,
  minUnits: number,
  used: Set<string>,
): Card[] | null {
  if (minUnits <= 0) return [];
  const taken: Card[] = [];
  let count = 0;
  const candidates = hand
    .filter((c) => !used.has(c.id) && c.subtype === subtype)
    .sort((a, b) => (a.resourceCount ?? 1) - (b.resourceCount ?? 1));
  for (const c of candidates) {
    taken.push(c);
    used.add(c.id);
    count += c.resourceCount ?? 1;
    if (count >= minUnits) break;
  }
  return count >= minUnits ? taken : null;
}

function sumUnits(cards: Card[], subtype: ResourceSubtype): number {
  let n = 0;
  for (const c of cards) n += resourceUnits(c, subtype);
  return n;
}
