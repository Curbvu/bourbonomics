"use client";

import type { GameState, PlayerState, Card } from "@bourbonomics/engine";
import { colorFor } from "@/lib/colors";

export function HandPanel({ state }: { state: GameState }) {
  const focused = focusedPlayer(state);
  if (!focused) {
    return (
      <div className="border-t border-neutral-800 bg-neutral-950/80 px-6 py-4 text-xs text-neutral-500">
        Game has not started.
      </div>
    );
  }
  const playerIndex = state.players.findIndex((p) => p.id === focused.id);
  const color = colorFor(playerIndex);

  return (
    <div className="border-t border-neutral-800 bg-neutral-950/80">
      {/* Top row: who, hand */}
      <div className="px-6 py-3 flex items-center gap-4 border-b border-neutral-900">
        <div className="flex items-center gap-2">
          <div
            className={`w-7 h-7 rounded-full ${color.avatarBg} flex items-center justify-center text-xs font-bold text-white`}
          >
            {focused.name.slice(0, 1)}
          </div>
          <div className="leading-tight">
            <div className="text-sm font-medium">{focused.name}'s hand</div>
            <div className="text-[10px] uppercase tracking-wider text-neutral-500">
              {focused.hand.length} card{focused.hand.length === 1 ? "" : "s"} ·
              hand size {focused.handSize}
            </div>
          </div>
        </div>
        <div className="flex-1 flex gap-2 flex-wrap">
          {focused.hand.length === 0 ? (
            <span className="text-xs text-neutral-600 italic">empty hand</span>
          ) : (
            focused.hand.map((c) => <HandCard key={c.id} card={c} />)
          )}
        </div>
      </div>

      {/* Bottom row: stats split into 4 cells */}
      <div className="px-6 py-3 grid grid-cols-12 gap-4 items-stretch">
        <div className="col-span-2">
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
            Reputation
          </div>
          <div className="font-serif text-3xl text-amber-400 tabular-nums leading-tight mt-1">
            {focused.reputation}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-600 mt-0.5">
            score so far
          </div>
        </div>
        <div className="col-span-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
            Mash bills in hand
          </div>
          {focused.mashBills.length === 0 ? (
            <span className="text-xs text-neutral-600 italic">no mash bills</span>
          ) : (
            <ul className="space-y-0.5">
              {focused.mashBills.map((m) => (
                <li key={m.id} className="text-xs text-neutral-300 truncate">
                  📜 {m.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="col-span-3">
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
            Unlocked Gold
          </div>
          {focused.unlockedGoldBourbons.length === 0 ? (
            <span className="text-xs text-neutral-600 italic">none yet</span>
          ) : (
            <ul className="space-y-0.5">
              {focused.unlockedGoldBourbons.map((m) => (
                <li key={m.id} className="text-xs text-amber-300 truncate">
                  🥇 {m.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="col-span-4">
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 mb-1">
            Deck breakdown
          </div>
          <div className="flex items-center gap-3 text-xs text-neutral-300">
            <DeckPill label="hand" value={focused.hand.length} />
            <DeckPill label="deck" value={focused.deck.length} />
            <DeckPill label="discard" value={focused.discard.length} />
            <DeckPill label="trashed" value={focused.trashed.length} />
          </div>
          <div className="text-[10px] uppercase tracking-wider text-neutral-600 mt-2">
            🛢 sold:{" "}
            <span className="text-neutral-400 tabular-nums">
              {focused.barrelsSold}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Whose hand to focus: the current player during the action phase, else player 0. */
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
      className={`px-2 py-1 rounded border text-[11px] font-medium ${accent}`}
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

function DeckPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-neutral-500 uppercase text-[9px] tracking-wider">
        {label}
      </span>
      <span className="text-neutral-200 tabular-nums">{value}</span>
    </div>
  );
}
