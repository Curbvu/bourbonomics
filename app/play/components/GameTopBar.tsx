"use client";

/**
 * Top bar for the game-board dashboard.
 *
 * Spec: design_handoff_bourbon_blend/README.md §TopBar.
 *
 *   [B] Bourbonomics    | year N    | <baron pills>     | bourbon N · market N
 *       distillery · turn N
 *
 * Layout (left → right):
 *   - Brand mark (28×28 amber-gradient square + Cormorant Garamond "B")
 *   - Wordmark + caption ("Bourbonomics" + "distillery · turn N")
 *   - Vertical divider
 *   - Year indicator
 *   - Centered baron pills (one per seated player)
 *   - Deck pulse on the right (bourbon deck count + market deck count)
 *
 * Per-player colours come from the shared `playerColors.ts` palette so the
 * TopBar, RickhouseGrid, OpponentList, and EventLog all agree.
 */

import { useGameStore } from "@/lib/store/gameStore";
import {
  PLAYER_BG_CLASS,
  PLAYER_BORDER_CLASS,
  PLAYER_TINT_CLASS,
  paletteIndex,
} from "./playerColors";

export default function GameTopBar() {
  const state = useGameStore((s) => s.state)!;
  const humanId = state.playerOrder.find((id) => state.players[id].kind === "human");

  const bourbonDeckCount = state.market.bourbonDeck.length;
  const marketDeckCount = state.market.marketDeck.length;

  return (
    <header className="flex items-center gap-4 border-b border-slate-800 bg-slate-950 px-[22px] py-3">
      {/* Brand mark + wordmark */}
      <div className="flex items-center gap-2.5">
        <div
          className="grid h-7 w-7 place-items-center rounded-md border border-amber-700 font-display text-lg font-bold text-amber-100"
          style={{
            background: "linear-gradient(135deg, #d97706, #92400e)",
            boxShadow: "0 1px 0 rgba(255,255,255,.15) inset",
          }}
          aria-hidden
        >
          B
        </div>
        <div className="flex flex-col leading-tight">
          <span className="font-display text-[17px] font-semibold tracking-[.01em] text-amber-100">
            Bourbonomics
          </span>
          <span className="-mt-0.5 font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            distillery · turn {state.round}
          </span>
        </div>
      </div>

      <span className="mx-1.5 h-[26px] w-px bg-slate-800" aria-hidden />

      {/* Year indicator */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
          year
        </span>
        <span className="font-mono text-sm font-bold tabular-nums text-amber-300">
          {state.round}
        </span>
      </div>

      {/* Centered baron pills */}
      <div className="flex flex-1 justify-center gap-2">
        {state.playerOrder.map((id) => {
          const p = state.players[id];
          const idx = paletteIndex(p.seatIndex);
          const isYou = id === humanId;
          const isCurrent = state.currentPlayerId === id;
          // Use solid border-color when this is the human seat, slate otherwise.
          const borderClass = isYou
            ? PLAYER_BORDER_CLASS[idx]
            : isCurrent
              ? "border-amber-500/60"
              : "border-slate-800";
          const bgClass = isYou ? PLAYER_TINT_CLASS[idx] : "bg-slate-900";
          return (
            <div
              key={id}
              className={`flex items-center gap-2 rounded-md border px-3 py-[5px] ${borderClass} ${bgClass}`}
              aria-current={isCurrent ? "true" : undefined}
            >
              <span
                className={`block h-2 w-2 rounded-full ring-2 ring-slate-950 ${PLAYER_BG_CLASS[idx]}`}
                aria-hidden
              />
              <span
                className={`text-[13px] text-slate-100 ${isYou ? "font-semibold" : "font-medium"}`}
              >
                {p.name}
              </span>
              <span className="font-mono text-xs font-semibold tabular-nums text-emerald-500">
                ${p.cash}
              </span>
            </div>
          );
        })}
      </div>

      {/* Deck pulse */}
      <div className="flex items-center gap-3.5">
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            bourbon
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums text-amber-300">
            {bourbonDeckCount}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            market
          </span>
          <span className="font-mono text-xs font-semibold tabular-nums text-slate-200">
            {marketDeckCount}
          </span>
        </div>
      </div>
    </header>
  );
}
