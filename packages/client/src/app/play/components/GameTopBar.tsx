"use client";

/**
 * Top bar — single row holds brand + year, an inline stylised phase
 * strip, the Step / Auto / Quit controls, and the demand chip + bourbon
 * counter. The barons block was folded into the per-player rickhouse
 * panels (RickhouseRow), so the player chips no longer live up here.
 */

import { useEffect, useState } from "react";

import type { GamePhase } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

type DisplayPhase = "draw" | "age" | "action" | "cleanup";

const PHASES: { k: DisplayPhase; l: string }[] = [
  { k: "draw", l: "Draw" },
  { k: "age", l: "Age" },
  { k: "action", l: "Action" },
  { k: "cleanup", l: "Cleanup" },
];

function visiblePhase(phase: GamePhase): DisplayPhase | null {
  switch (phase) {
    case "draw":
      return "draw";
    case "action":
      return "action";
    case "cleanup":
      return "cleanup";
    default:
      return null;
  }
}

export default function GameTopBar() {
  const { state, autoplay, setAutoplay, step, clear } = useGameStore();
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirmOpen]);

  if (!state) return null;
  const quit = () => {
    clear();
    setConfirmOpen(false);
  };

  const active = visiblePhase(state.phase);
  const inSetup =
    state.phase === "distillery_selection" || state.phase === "starter_deck_draft";
  const showRoundChrome = state.phase !== "ended" && !inSetup && active != null;

  return (
    <header className="border-b border-slate-800 bg-slate-950">
      <div className="flex items-center gap-3 px-[18px] py-2">
        {/* Brand */}
        <div className="flex flex-shrink-0 items-center gap-2">
          <div
            className="grid h-7 w-7 place-items-center rounded-md border border-amber-700 font-display text-base font-bold text-amber-100"
            style={{
              background: "linear-gradient(135deg, #d97706, #92400e)",
              boxShadow: "0 1px 0 rgba(255,255,255,.15) inset",
            }}
            aria-hidden
          >
            B
          </div>
          <div className="hidden flex-col leading-tight md:flex">
            <span className="font-display text-[15px] font-semibold tracking-[.01em] text-amber-100">
              Bourbonomics
            </span>
            <span className="-mt-0.5 font-mono text-[9px] uppercase tracking-[.12em] text-slate-500">
              year {state.round}
            </span>
          </div>
        </div>

        <span className="mx-1 h-[28px] w-px bg-slate-800" aria-hidden />

        {/* Inline phase strip */}
        {showRoundChrome ? (
          <PhaseStrip activeKey={active} />
        ) : inSetup ? (
          <SetupBanner phase={state.phase as "distillery_selection" | "starter_deck_draft"} />
        ) : (
          <span className="flex-1" aria-hidden />
        )}

        {/* Right cluster: demand chip + bourbon counter + controls */}
        {showRoundChrome ? (
          <>
            <DemandChip value={state.demand} />
            <BourbonChip remaining={state.bourbonDeck.length} finalRound={state.finalRoundTriggered} />
            <span className="mx-1 h-[28px] w-px bg-slate-800" aria-hidden />
            <button
              type="button"
              onClick={step}
              className="rounded border border-slate-700 bg-slate-900 px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-200 transition-colors hover:border-amber-500/60 hover:bg-slate-800 hover:text-amber-200"
            >
              Step
            </button>
            <button
              type="button"
              onClick={() => setAutoplay(!autoplay)}
              className={[
                "rounded border px-3 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.05em] transition-colors",
                autoplay
                  ? "border-amber-500 bg-amber-500 text-slate-950 hover:bg-amber-400"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-amber-500/60 hover:text-amber-200",
              ].join(" ")}
            >
              {autoplay ? "Pause" : "Auto"}
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => setConfirmOpen(true)}
          title="Quit this game and return to the main menu"
          className="rounded border border-rose-500/60 bg-rose-700/[0.20] px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-rose-100 transition-colors hover:bg-rose-700/[0.35]"
        >
          Quit
        </button>
      </div>

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
              The current round-{state.round} match will be cleared from your
              browser. The main menu will let you start fresh.
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

// -----------------------------
// Inline phase strip
// -----------------------------

function PhaseStrip({ activeKey }: { activeKey: DisplayPhase }) {
  const activeIdx = PHASES.findIndex((p) => p.k === activeKey);
  return (
    <div
      role="navigation"
      aria-label="Round phases"
      className="flex flex-1 items-center gap-1 overflow-hidden rounded-md border border-slate-800 bg-slate-900/40 px-1 py-1"
    >
      {PHASES.map((p, i) => {
        const isActive = i === activeIdx;
        const isPast = activeIdx > i;
        return (
          <PhaseChip
            key={p.k}
            label={p.l}
            index={i + 1}
            isActive={isActive}
            isPast={isPast}
            isLast={i === PHASES.length - 1}
          />
        );
      })}
    </div>
  );
}

function PhaseChip({
  label,
  index,
  isActive,
  isPast,
  isLast,
}: {
  label: string;
  index: number;
  isActive: boolean;
  isPast: boolean;
  isLast: boolean;
}) {
  return (
    <>
      <div
        className={[
          "flex items-center gap-1.5 rounded px-2 py-1 transition-colors",
          isActive
            ? "bg-amber-700/[0.25] shadow-[inset_0_0_0_1px_rgba(245,158,11,.45)]"
            : "",
        ].join(" ")}
        aria-current={isActive ? "step" : undefined}
      >
        <span
          className={[
            "grid h-5 w-5 flex-shrink-0 place-items-center rounded-full font-mono text-[10px] font-bold leading-none",
            isActive
              ? "bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,.55)]"
              : isPast
                ? "bg-slate-700 text-slate-300"
                : "border border-slate-700 text-slate-500",
          ].join(" ")}
          aria-hidden
        >
          {isPast ? "✓" : index}
        </span>
        <span
          className={[
            "font-mono text-[11px] uppercase tracking-[.12em]",
            isActive
              ? "font-bold text-amber-100"
              : isPast
                ? "font-semibold text-slate-300"
                : "font-medium text-slate-500",
          ].join(" ")}
        >
          {label}
        </span>
      </div>
      {!isLast ? (
        <span
          className={[
            "h-px w-3 flex-shrink-0",
            isPast ? "bg-amber-500/50" : "bg-slate-700",
          ].join(" ")}
          aria-hidden
        />
      ) : null}
    </>
  );
}

function SetupBanner({ phase }: { phase: "distillery_selection" | "starter_deck_draft" }) {
  const label =
    phase === "distillery_selection"
      ? "Setup · pick your distillery"
      : "Setup · build your starter deck";
  return (
    <div className="flex flex-1 items-center justify-center font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
      {label}
    </div>
  );
}

function DemandChip({ value }: { value: number }) {
  // Sky-blue (cool) → amber (hot) gradient across 12 cells. Matches the
  // dev branch's full-width demand bar, compressed for the top bar.
  const cellColor = (i: number) => {
    const t = i / 11;
    const r = Math.round(56 + (251 - 56) * t);
    const g = Math.round(189 + (191 - 189) * t);
    const b = Math.round(248 + (36 - 248) * t);
    return `rgb(${r}, ${g}, ${b})`;
  };
  const valueClass =
    value >= 9
      ? "text-amber-300"
      : value >= 6
        ? "text-amber-200"
        : value >= 3
          ? "text-sky-300"
          : "text-slate-400";
  return (
    <div
      title={`Market demand ${value} of 12`}
      className="flex items-center gap-2 rounded border border-slate-800 bg-slate-900/60 px-2 py-1"
    >
      <span className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-500">
        demand
      </span>
      <div className="flex items-center gap-[2px]" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => {
          const cellNum = i + 1;
          const isActive = cellNum <= value;
          return (
            <div
              key={i}
              className={[
                "h-[14px] w-[6px] rounded-[2px] border transition-colors duration-200",
                isActive ? "" : "border-slate-800 bg-slate-900",
              ].join(" ")}
              style={
                isActive
                  ? {
                      backgroundColor: cellColor(i),
                      borderColor: cellColor(i),
                    }
                  : undefined
              }
            />
          );
        })}
      </div>
      <span className={`font-mono text-[13px] font-bold tabular-nums ${valueClass}`}>
        {value}/12
      </span>
    </div>
  );
}

function BourbonChip({ remaining, finalRound }: { remaining: number; finalRound: boolean }) {
  return (
    <div
      title="Bourbon deck remaining (the doomsday clock)"
      className={[
        "flex items-baseline gap-1.5 rounded border px-2 py-1",
        finalRound ? "border-amber-500 bg-amber-700/[0.20]" : "border-slate-800 bg-slate-900/60",
      ].join(" ")}
    >
      <span className="font-mono text-[9px] uppercase tracking-[.16em] text-slate-500">
        bourbon
      </span>
      <span className="font-mono text-[14px] font-bold tabular-nums text-amber-300">
        {remaining}
      </span>
      {finalRound ? (
        <span className="ml-1 rounded bg-amber-500 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-[.10em] text-slate-950">
          final
        </span>
      ) : null}
    </div>
  );
}
