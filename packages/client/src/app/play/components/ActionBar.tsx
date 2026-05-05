"use client";

/**
 * Action bar — the human player's control surface during the action phase.
 *
 * Visual idiom ported from the dev branch's HandTray actions row: every
 * legal action is a labelled button in a single horizontal strip; each
 * button reports its own enabled / disabled reason via tooltip so the
 * player knows what's gating it.
 *
 * Wiring status (v2.1.5):
 *   ✓ Pass Turn         — one-click dispatch
 *   ✓ Draw a Mash Bill  — one-click; auto-spends cheapest hand card
 *   ◯ Make Bourbon      — coming next iteration (needs mash picker)
 *   ◯ Sell Bourbon      — coming next iteration (needs barrel picker)
 *   ◯ Rush to Market    — coming next iteration (needs barrel picker)
 *   ◯ Buy from Market   — coming next iteration (needs market click)
 *   ◯ Trade             — coming next iteration (needs partner picker)
 *   ◯ Convert (3:1)     — folded into Make Bourbon flow
 *
 * Bots play the action phase as before via Step / Auto in the top bar.
 */

import type { GameAction, GameState, PlayerState } from "@bourbonomics/engine";
import { validateAction } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function ActionBar() {
  const { state, dispatch, autoplay } = useGameStore();
  if (!state) return null;
  if (state.phase !== "action") return null;

  const human = state.players.find((p) => !p.isBot);
  if (!human) return null;

  const isHumanTurn = state.players[state.currentPlayerIndex]?.id === human.id;

  return (
    <div className="border-t border-slate-800 bg-slate-950/95 px-[18px] py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">
          Actions
        </span>
        <span className="mx-1 h-[20px] w-px bg-slate-800" aria-hidden />
        <ActionButton
          label="Make bourbon"
          enabled={false}
          tooltip="Coming next: pick a cask + corn + grain mash and a slot."
        />
        <ActionButton
          label="Age"
          enabled={false}
          tooltip="Coming next: click an unaged barrel to commit a card."
        />
        <ActionButton
          label="Sell"
          enabled={false}
          tooltip="Coming next: click a 2yo+ barrel to sell."
        />
        <ActionButton
          label="Rush"
          enabled={false}
          tooltip="Coming next: click a 1yo barrel for a half-reward Rush to Market."
        />
        <ActionButton
          label="Buy market"
          enabled={false}
          tooltip="Coming next: click a market card to buy."
        />
        <DrawMashBillButton state={state} player={human} dispatch={dispatch} disabled={!isHumanTurn} />
        <ActionButton
          label="Trade"
          enabled={false}
          tooltip="Coming next: pick a partner and exchange cards."
        />
        <span className="flex-1" />
        <PassButton state={state} player={human} dispatch={dispatch} disabled={!isHumanTurn || autoplay} />
      </div>
    </div>
  );
}

function PassButton({
  state,
  player,
  dispatch,
  disabled,
}: {
  state: GameState;
  player: PlayerState;
  dispatch: (a: GameAction) => void;
  disabled: boolean;
}) {
  const action: GameAction = { type: "PASS_TURN", playerId: player.id };
  const validation = disabled ? null : validateAction(state, action);
  const enabled = validation?.legal === true;
  const tooltip = !enabled
    ? validation?.reason ?? "Wait for your turn"
    : "Pass — end your turn for the round";
  return (
    <button
      type="button"
      onClick={() => enabled && dispatch(action)}
      disabled={!enabled}
      title={tooltip}
      className={[
        "rounded-md border px-3 py-1 font-sans text-[11px] font-bold uppercase tracking-[.05em] transition-colors",
        enabled
          ? "border-amber-500 bg-gradient-to-b from-amber-500 to-amber-700 text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] hover:from-amber-400 hover:to-amber-600"
          : "cursor-not-allowed border-slate-800 bg-slate-900 text-slate-600",
      ].join(" ")}
    >
      Pass ↵
    </button>
  );
}

function DrawMashBillButton({
  state,
  player,
  dispatch,
  disabled,
}: {
  state: GameState;
  player: PlayerState;
  dispatch: (a: GameAction) => void;
  disabled: boolean;
}) {
  // Auto-pick the lowest-value card to spend (cheapest capital → any card).
  const candidates = [...player.hand].sort((a, b) => {
    const av = a.type === "capital" ? (a.capitalValue ?? 1) : 99;
    const bv = b.type === "capital" ? (b.capitalValue ?? 1) : 99;
    return av - bv;
  });
  const spend = candidates[0];
  const action: GameAction | null = spend
    ? { type: "DRAW_MASH_BILL", playerId: player.id, spendCardId: spend.id }
    : null;
  const validation = disabled || !action ? null : validateAction(state, action);
  const enabled = validation?.legal === true;
  const tooltip = !enabled
    ? !spend
      ? "No cards in hand to spend"
      : (validation?.reason ?? "Wait for your turn")
    : `Draw the top mash bill (spend 1 card)`;
  return (
    <ActionButton
      label="Draw bill"
      enabled={enabled}
      tooltip={tooltip}
      onClick={() => enabled && action && dispatch(action)}
    />
  );
}

function ActionButton({
  label,
  enabled,
  tooltip,
  onClick,
}: {
  label: string;
  enabled: boolean;
  tooltip: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={!enabled}
      title={tooltip}
      onClick={onClick}
      className={[
        "rounded-md border px-3 py-1 font-mono text-[10.5px] font-semibold uppercase tracking-[.08em] transition-colors",
        enabled
          ? "border-slate-700 bg-slate-900 text-slate-200 hover:border-amber-500/60 hover:bg-slate-800 hover:text-amber-200"
          : "cursor-not-allowed border-slate-800 bg-slate-950/60 text-slate-600",
      ].join(" ")}
    >
      {label}
    </button>
  );
}
