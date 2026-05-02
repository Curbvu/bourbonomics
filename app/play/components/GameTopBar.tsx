"use client";

/**
 * Top bar for the game-board dashboard, with a phase sub-bar.
 *
 * Spec: design_handoff_bourbon_blend/README.md §TopBar.
 *
 *   ┌───────────────────────────────────────────────────────────────────┐
 *   │ [B] Bourbonomics  | year N |  baron pills    | bourbon · market | Quit
 *   │     distillery · turn N
 *   ├───────────────────────────────────────────────────────────────────┤
 *   │ ✓ Fees · 2 Action — next costs FREE > $1 > $2 > $3+ · 3 Market    │
 *   └───────────────────────────────────────────────────────────────────┘
 *
 * The phase strip is pulled into the top bar as a tight sub-bar because
 * it's purely game-state metadata (current phase + cost ladder + fees
 * summary) — it belongs with the rest of the table-state header rather
 * than living in the content area below.
 *
 * Per-player colours come from the shared `playerColors.ts` palette so the
 * TopBar, RickhouseGrid, OpponentList, and EventLog all agree.
 */

import { useEffect, useState } from "react";

import { useGameStore } from "@/lib/store/gameStore";
import PhaseBanner from "./PhaseBanner";
import {
  PLAYER_BG_CLASS,
  PLAYER_BORDER_CLASS,
  PLAYER_TINT_CLASS,
  paletteIndex,
} from "./playerColors";

export default function GameTopBar() {
  const state = useGameStore((s) => s.state)!;
  const clear = useGameStore((s) => s.clear);
  const humanId = state.playerOrder.find((id) => state.players[id].kind === "human");
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Esc closes the quit confirm modal.
  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen]);

  const bourbonDeckCount = state.market.bourbonDeck.length;
  const marketDeckCount = state.market.marketDeck.length;

  const quit = () => {
    clear(); // persistence subscriber wipes localStorage on null state
    setConfirmOpen(false);
  };

  return (
    <header className="border-b border-slate-800 bg-slate-950">
      {/* ─── Main row ─── */}
      <div className="flex items-center gap-4 px-[22px] py-3">
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
              distillery
            </span>
          </div>
        </div>

        <span className="mx-1.5 h-[40px] w-px bg-slate-800" aria-hidden />

        {/* Year indicator — large prominent number; year IS the turn,
            so the top-bar wordmark only needs "distillery" beside it. */}
        <div className="flex items-baseline gap-2.5">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
            year
          </span>
          <span className="font-display text-[34px] font-bold leading-none tabular-nums text-amber-300 drop-shadow-[0_2px_4px_rgba(0,0,0,.5)]">
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
            const borderClass = isYou
              ? PLAYER_BORDER_CLASS[idx]
              : isCurrent
                ? "border-amber-500/60"
                : "border-slate-800";
            const bgClass = isYou ? PLAYER_TINT_CLASS[idx] : "bg-slate-900";
            return (
              <div
                key={id}
                className={[
                  "flex items-center gap-2.5 rounded-lg border-2 px-4 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,.04)] transition-shadow",
                  borderClass,
                  bgClass,
                  isCurrent
                    ? "shadow-[0_0_14px_rgba(245,158,11,.30),inset_0_1px_0_rgba(255,255,255,.05)]"
                    : "",
                ].join(" ")}
                aria-current={isCurrent ? "true" : undefined}
              >
                <span
                  className={`block h-3 w-3 rounded-full ring-2 ring-slate-950 ${PLAYER_BG_CLASS[idx]}`}
                  aria-hidden
                />
                <span
                  className={`text-[16px] text-slate-100 ${isYou ? "font-semibold" : "font-medium"}`}
                >
                  {p.name}
                </span>
                <span className="font-mono text-[15px] font-bold tabular-nums text-emerald-300 drop-shadow-[0_1px_2px_rgba(0,0,0,.5)]">
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

        {/* Quit Game */}
        <span className="mx-1 h-[26px] w-px bg-slate-800" aria-hidden />
        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          title="Quit this game and return to the main menu"
          className="rounded border border-rose-500/60 bg-rose-700/[0.20] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-rose-100 transition-colors hover:bg-rose-700/[0.35]"
        >
          Quit ↵
        </button>
      </div>

      {/* ─── Phase sub-bar ─── */}
      {state.phase !== "gameover" ? (
        <div className="border-t border-slate-800 bg-slate-900/40 px-[22px] py-2">
          <PhaseBanner subBar />
        </div>
      ) : null}

      {/* Quit confirmation modal */}
      {confirmOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Quit current game"
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 backdrop-blur-sm"
          onClick={() => setConfirmOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setConfirmOpen(false);
          }}
        >
          <div
            role="document"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border border-rose-700 bg-slate-900 p-5 shadow-[0_8px_32px_rgba(0,0,0,.5)]"
          >
            <h2 className="font-display text-xl font-semibold text-amber-100">
              Quit this game?
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Your current distillery — round {state.round}, $
              {humanId ? state.players[humanId].cash : 0} on hand — will be
              cleared from your browser. The main menu will let you start
              fresh.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={quit}
                className="rounded-md border border-rose-700 bg-gradient-to-b from-rose-500 to-rose-700 px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-rose-400 hover:to-rose-600"
              >
                Quit game ↵
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
