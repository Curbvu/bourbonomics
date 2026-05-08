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
import type {
  Barrel,
  Card,
  GameState,
  ResourceSubtype,
} from "@bourbonomics/engine";

import { useGameStore, type LogEntry } from "@/lib/store/game";
import { bourbonColor } from "./bourbonColor";
import { PLAYER_TEXT_CLASS, paletteIndex } from "./playerColors";
import { RESOURCE_LABEL } from "./handCardStyles";

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
              <span className="flex-1">{describe(e, playerById, state)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function describe(
  e: LogEntry,
  playerById: Map<string, PlayerInfo>,
  state: GameState | null,
): ReactNode {
  const a = e.action;
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
          {who(a.playerId)} rolled demand:{" "}
          <span className="font-mono tabular-nums text-amber-200">{a.roll[0]} + {a.roll[1]} = {sum}</span>.
        </>
      );
    }
    case "DRAW_HAND": {
      const isHuman = !state?.players.find((p) => p.id === a.playerId)?.isBot;
      const drawn = e.drawn;
      // Bots' hands are private — reveal the contents only for the human.
      if (!isHuman || !drawn || drawn.length === 0) {
        return <>{who(a.playerId)} drew their round hand.</>;
      }
      return (
        <>
          {who(a.playerId)} drew {drawn.length} card{drawn.length === 1 ? "" : "s"}:{" "}
          {summarizeCards(drawn)}.
        </>
      );
    }
    case "MAKE_BOURBON": {
      const barrel = findBarrelBySlot(state, a.playerId, a.slotId);
      const billName = barrel?.attachedMashBill?.name ?? "a barrel";
      const age = barrel?.age ?? 0;
      return (
        <>
          {who(a.playerId)} made{" "}
          <em className="not-italic text-amber-200">{billName}</em> ({a.cardIds.length} cards) ·{" "}
          <ColorChip age={age} />
        </>
      );
    }
    case "AGE_BOURBON": {
      const barrel = state?.allBarrels.find((b) => b.id === a.barrelId);
      const billName = barrel?.attachedMashBill?.name ?? "a barrel";
      const age = barrel?.age ?? 0;
      return (
        <>
          {who(a.playerId)} aged{" "}
          <em className="not-italic text-amber-200">{billName}</em> to{" "}
          <span className="font-mono tabular-nums text-amber-100">
            {age} yr{age === 1 ? "" : "s"}
          </span>{" "}
          · <ColorChip age={age} />
        </>
      );
    }
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

function findBarrelBySlot(
  state: GameState | null,
  playerId: string,
  slotId: string,
): Barrel | undefined {
  if (!state) return undefined;
  return state.allBarrels.find((b) => b.ownerId === playerId && b.slotId === slotId);
}

function ColorChip({ age }: { age: number }) {
  const c = bourbonColor(age);
  return (
    <span className={`font-mono text-[10px] uppercase tracking-[.10em] ${c.textClass}`}>
      {c.name}
    </span>
  );
}

/**
 * Compact summary for a hand-draw payload — groups cards by subtype /
 * capital tier so a 5-card draw reads as "2× corn, 1× rye, B$2 capital"
 * instead of one entry per card.
 */
function summarizeCards(cards: Card[]): ReactNode {
  const resources = new Map<ResourceSubtype, number>();
  let capitalSum = 0;
  let capitalCount = 0;
  for (const c of cards) {
    if (c.type === "capital") {
      capitalSum += c.capitalValue ?? 1;
      capitalCount += 1;
    } else if (c.type === "resource" && c.subtype) {
      const n = c.resourceCount ?? 1;
      resources.set(c.subtype, (resources.get(c.subtype) ?? 0) + n);
    }
  }
  const parts: ReactNode[] = [];
  for (const [sub, n] of resources) {
    parts.push(
      <span key={`r-${sub}`} className="text-slate-100">
        {n}× {RESOURCE_LABEL[sub]}
      </span>,
    );
  }
  if (capitalCount > 0) {
    parts.push(
      <span key="cap" className="text-emerald-300">
        {capitalCount === 1 ? "B$" : `${capitalCount}× B$`}
        {capitalSum}
      </span>,
    );
  }
  return interleave(parts, ", ");
}

function interleave(nodes: ReactNode[], sep: string): ReactNode {
  const out: ReactNode[] = [];
  nodes.forEach((n, i) => {
    if (i > 0) out.push(<span key={`s-${i}`}>{sep}</span>);
    out.push(n);
  });
  return <>{out}</>;
}

function prettyOps(defId: string): string {
  // "market_manipulation" → "Market Manipulation"
  return defId
    .split("_")
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}
