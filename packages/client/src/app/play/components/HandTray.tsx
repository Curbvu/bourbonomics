"use client";

/**
 * HandTray — bottom strip below the main grid.
 *
 * v1 surfaced action affordances here (Make / Sell / Implement / Audit /
 * Pass). v2 is computer-only, so this strip shows the focused player's
 * hand + key counters. Step/Auto/Reset live in the phase strip above.
 */

import type { Card, GameState, PlayerState } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";
import PlayerSwatch from "./PlayerSwatch";

export default function HandTray() {
  const { state, seatMeta } = useGameStore();
  if (!state) return null;
  const focused = focusedPlayer(state);
  if (!focused) return null;
  const playerIndex = state.players.findIndex((p) => p.id === focused.id);
  const meta = seatMeta.find((m) => m.id === focused.id);

  return (
    <div className="border-t border-slate-800 bg-slate-950/90">
      {/* Hand row */}
      <div className="flex items-center gap-4 px-[22px] py-3">
        <div className="flex items-center gap-2">
          <PlayerSwatch
            seatIndex={playerIndex}
            logoId={meta?.logoId}
            size="md"
          />
          <div className="flex flex-col leading-tight">
            <span className="font-display text-[16px] font-semibold text-slate-100">
              {focused.name}
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
              hand · {focused.hand.length}/{focused.handSize}
            </span>
          </div>
        </div>
        <div className="flex flex-1 flex-wrap gap-1.5">
          {focused.hand.length === 0 ? (
            <span className="self-center font-mono text-[11px] italic text-slate-600">
              no cards in hand
            </span>
          ) : (
            focused.hand.map((c) => <HandCard key={c.id} card={c} />)
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-12 items-center gap-4 border-t border-slate-900 px-[22px] py-3">
        <div className="col-span-2">
          <div className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">
            Reputation
          </div>
          <div className="mt-0.5 font-display text-[34px] font-bold leading-none tabular-nums text-amber-300">
            {focused.reputation}
          </div>
        </div>
        <div className="col-span-4">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">
            Mash bills in hand
          </div>
          {focused.mashBills.length === 0 ? (
            <span className="font-mono text-[11px] italic text-slate-600">
              no mash bills
            </span>
          ) : (
            <ul className="space-y-0.5">
              {focused.mashBills.map((m) => (
                <li
                  key={m.id}
                  className="truncate font-display text-[12px] text-slate-200"
                  title={m.name}
                >
                  📜 {m.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="col-span-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">
            Unlocked gold
          </div>
          {focused.unlockedGoldBourbons.length === 0 ? (
            <span className="font-mono text-[11px] italic text-slate-600">
              none yet
            </span>
          ) : (
            <ul className="space-y-0.5">
              {focused.unlockedGoldBourbons.map((m) => (
                <li
                  key={m.id}
                  className="truncate font-display text-[12px] text-amber-200"
                  title={m.name}
                >
                  🥇 {m.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="col-span-3">
          <div className="mb-1 font-mono text-[10px] uppercase tracking-[.18em] text-slate-500">
            Deck breakdown
          </div>
          <div className="grid grid-cols-4 gap-2 font-mono text-[10px] uppercase tracking-[.08em] text-slate-500">
            <Stat label="hand" value={focused.hand.length} />
            <Stat label="deck" value={focused.deck.length} />
            <Stat label="disc" value={focused.discard.length} />
            <Stat label="trash" value={focused.trashed.length} />
          </div>
          <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[.08em] text-slate-500">
            🛢 sold:{" "}
            <span className="font-sans text-[12px] tabular-nums text-slate-200">
              {focused.barrelsSold}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function focusedPlayer(state: GameState): PlayerState | null {
  if (state.players.length === 0) return null;
  if (state.phase === "action") {
    return state.players[state.currentPlayerIndex] ?? state.players[0]!;
  }
  return state.players[0]!;
}

function HandCard({ card }: { card: Card }) {
  const label = labelFor(card);
  const accent =
    card.type === "capital"
      ? "border-emerald-700/50 bg-emerald-950/40 text-emerald-200"
      : "border-amber-700/40 bg-amber-950/20 text-amber-200";
  return (
    <div
      title={card.id}
      className={`rounded border px-2 py-1 font-mono text-[11px] font-medium ${accent}`}
    >
      {label}
    </div>
  );
}

function labelFor(card: Card): string {
  if (card.type === "capital") {
    const v = card.capitalValue ?? 1;
    return v === 1 ? "$1" : `$${v}`;
  }
  if (card.type === "resource") {
    const count = card.resourceCount ?? 1;
    return count > 1 ? `${count}× ${card.subtype}` : (card.subtype ?? "?");
  }
  return "?";
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span>{label}</span>
      <span className="font-sans text-[12px] tabular-nums text-slate-200">
        {value}
      </span>
    </div>
  );
}
