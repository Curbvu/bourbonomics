"use client";

/**
 * Action log — streaming engine action history. Left-aligned, plain
 * English, uses player display names instead of bare IDs. Each player's
 * name is tinted with their seat-palette colour (PLAYER_TEXT_CLASS) so
 * "who did what" is readable at a glance.
 *
 * The scroll viewport is capped (so the log never grows unboundedly on
 * narrow layouts where the rail stacks beneath the board) and snaps to
 * the bottom on every new entry so the most recent action is always in
 * view. Snap uses `useLayoutEffect` so the scroll happens after DOM
 * mutation but before paint — no flash of "stuck near the top".
 */

import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import type { GameAction, GameState } from "@bourbonomics/engine";

import { useGameStore } from "@/lib/store/game";
import { PLAYER_TEXT_CLASS, paletteIndex } from "./playerColors";

interface PlayerInfo {
  name: string;
  textClass: string;
}

export default function EventLog() {
  const { state, log } = useGameStore();
  const ref = useRef<HTMLDivElement>(null);

  // Map id → { name, seat-palette text class }.
  const playerById = useMemo(() => {
    const m = new Map<string, PlayerInfo>();
    if (state) {
      state.players.forEach((p, i) => {
        m.set(p.id, {
          name: p.name,
          textClass: PLAYER_TEXT_CLASS[paletteIndex(i)]!,
        });
      });
    }
    return m;
  }, [state]);

  // Snap to the bottom on every new entry — pre-paint so we never
  // momentarily render the user "stuck" near the previous scroll top.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [log.length]);

  return (
    <div
      ref={ref}
      // Fixed cap (60vh) so the log never grows the page on narrow
      // layouts where RightRail stacks under the board. On wide layouts
      // the parent grid row height already constrains this — the cap
      // just guarantees a hard ceiling either way.
      className="max-h-[60vh] overflow-y-auto p-3 lg:h-full lg:max-h-none"
    >
      {log.length === 0 ? (
        <p className="text-left font-mono text-[11px] italic text-slate-500">
          No actions yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-1 text-left">
          {log.map((e) => (
            <li
              key={e.seq}
              className="flex items-baseline gap-2 font-sans text-[12px] leading-snug text-slate-200"
            >
              <span className="w-7 flex-shrink-0 font-mono text-[10px] uppercase tracking-[.10em] tabular-nums text-slate-600">
                R{e.round}
              </span>
              <span className="flex-1">{describe(e.action, playerById, state)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describe(
  a: GameAction,
  playerById: Map<string, PlayerInfo>,
  state: GameState | null,
): ReactNode {
  const who = (id: string): ReactNode => {
    const info = playerById.get(id);
    if (!info) return id;
    return <span className={`font-semibold ${info.textClass}`}>{info.name}</span>;
  };
  switch (a.type) {
    case "SELECT_DISTILLERY": {
      const dist = state?.distilleryPool.find((d) => d.id === a.distilleryId);
      return (
        <>
          {who(a.playerId)} picked <em className="not-italic text-amber-200">{dist?.name ?? "a distillery"}</em>.
        </>
      );
    }
    case "STARTER_TRADE":
      return (
        <>
          {who(a.player1Id)} traded a card with {who(a.player2Id)}.
        </>
      );
    case "STARTER_SWAP":
      return (
        <>
          {who(a.playerId)} swapped {a.cardIds.length} card
          {a.cardIds.length === 1 ? "" : "s"} from the pool.
        </>
      );
    case "STARTER_PASS":
      return <>{who(a.playerId)} accepted their starter hand.</>;
    case "ROLL_DEMAND": {
      const sum = a.roll[0] + a.roll[1];
      return (
        <>
          Demand roll: <span className="font-mono tabular-nums text-amber-200">{a.roll[0]} + {a.roll[1]} = {sum}</span>.
        </>
      );
    }
    case "DRAW_HAND":
      return <>{who(a.playerId)} drew their round hand.</>;
    case "MAKE_BOURBON":
      return <>{who(a.playerId)} made a barrel of bourbon ({a.cardIds.length} cards).</>;
    case "AGE_BOURBON":
      return <>{who(a.playerId)} aged a barrel.</>;
    case "SELL_BOURBON":
      return (
        <>
          {who(a.playerId)} sold a barrel for{" "}
          <span className="font-mono tabular-nums text-amber-300">
            {a.reputationSplit + a.cardDrawSplit}
          </span>{" "}
          reputation.
        </>
      );
    case "BUY_FROM_MARKET":
      return <>{who(a.playerId)} bought a card from the market.</>;
    case "BUY_OPERATIONS_CARD":
      return <>{who(a.playerId)} bought an operations card.</>;
    case "DRAW_MASH_BILL":
      return <>{who(a.playerId)} drew a mash bill.</>;
    case "TRADE":
      return (
        <>
          {who(a.player1Id)} traded with {who(a.player2Id)}.
        </>
      );
    case "PLAY_OPERATIONS_CARD":
      return (
        <>
          {who(a.playerId)} played{" "}
          <em className="not-italic text-violet-300">{prettyOps(a.defId)}</em>.
        </>
      );
    case "PASS_TURN":
      return <>{who(a.playerId)} passed.</>;
    default:
      return JSON.stringify(a);
  }
}

function prettyOps(defId: string): string {
  // "market_manipulation" → "Market Manipulation"
  return defId
    .split("_")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
