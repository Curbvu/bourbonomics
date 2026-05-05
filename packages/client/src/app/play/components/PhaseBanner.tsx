"use client";

/**
 * Phase strip — round-loop band.
 *
 * Per the rules each round has 5 phases: Demand, Draw, Age, Action, Cleanup.
 * Distillery selection and Starter-deck draft are opening-only setup steps;
 * during those, this strip stays hidden and the corresponding modal handles
 * the input.
 *
 * The Age phase is folded into the Action phase in the engine — players
 * spend AGE_BOURBON actions during the action band — so when phase==="action"
 * we visually highlight both Age and Action together so the rules-stated
 * 5-phase loop reads correctly to the player.
 */

import type { GamePhase } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

type DisplayPhaseKey = "demand" | "draw" | "age" | "action" | "cleanup";

const PHASES: { k: DisplayPhaseKey; l: string }[] = [
  { k: "demand", l: "Demand" },
  { k: "draw", l: "Draw" },
  { k: "age", l: "Age" },
  { k: "action", l: "Action" },
  { k: "cleanup", l: "Cleanup" },
];

function visiblePhase(phase: GamePhase): DisplayPhaseKey | null {
  switch (phase) {
    case "demand":
      return "demand";
    case "draw":
      return "draw";
    // The engine folds aging into the action phase as an AGE_BOURBON action.
    // We highlight "action" here; the "age" cell is rendered statically as
    // part of the rules-stated 5-phase loop.
    case "action":
      return "action";
    case "cleanup":
      return "cleanup";
    default:
      return null;
  }
}

export default function PhaseBanner({ subBar = false }: { subBar?: boolean }) {
  const { state, autoplay, setAutoplay, step } = useGameStore();
  if (!state) return null;
  if (state.phase === "ended") return null;
  // Hide the round-loop banner during opening-only setup phases — the
  // distillery / starter-deck modals own the screen there.
  if (state.phase === "setup") return null;
  if (state.phase === "distillery_selection") return null;
  if (state.phase === "starter_deck_draft") return null;

  const active = visiblePhase(state.phase);
  const currentIndex = active ? PHASES.findIndex((p) => p.k === active) : -1;

  return (
    <div
      className={
        subBar
          ? "flex overflow-hidden rounded-md border border-slate-800/60 bg-slate-900/40"
          : "flex overflow-hidden rounded-lg border border-slate-800 bg-slate-900"
      }
      role="navigation"
      aria-label="Round phases"
    >
      {PHASES.map((p, i) => {
        const isActive = p.k === active;
        const isPast = currentIndex > i;
        const expandActive = isActive && p.k === "action";
        return (
          <div
            key={p.k}
            className={[
              "flex min-w-0 items-center gap-3 px-4 py-2",
              expandActive ? "flex-[3]" : "flex-1",
              i < PHASES.length - 1 ? "border-r border-slate-800" : "",
              isActive ? "bg-amber-700/[0.18]" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={isActive ? "step" : undefined}
          >
            <span
              className={[
                "grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full font-mono text-[13px] font-bold leading-none",
                isActive
                  ? "bg-amber-500 text-slate-950"
                  : isPast
                    ? "bg-slate-700 text-slate-300"
                    : "border-2 border-slate-700 text-slate-400",
              ].join(" ")}
              aria-hidden
            >
              {isPast ? "✓" : i + 1}
            </span>

            <span
              className={[
                "flex-shrink-0 text-[17px]",
                isActive
                  ? "font-semibold text-amber-100"
                  : isPast
                    ? "font-medium text-slate-300"
                    : "font-medium text-slate-500",
              ].join(" ")}
            >
              {p.l}
            </span>

            {expandActive && (
              <>
                <span
                  className="ml-2 mr-1 h-[24px] w-px bg-amber-700 opacity-50"
                  aria-hidden
                />
                <DemandBar value={state.demand} />
                <span className="flex-1" />
                <span className="font-mono text-[11px] uppercase tracking-[.14em] text-slate-500">
                  Bourbon
                </span>
                <span className="font-mono text-[16px] font-bold tabular-nums text-amber-300">
                  {state.bourbonDeck.length}
                </span>
                {state.finalRoundTriggered && (
                  <span className="ml-2 rounded border border-amber-500 bg-amber-700/[0.20] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[.10em] text-amber-200">
                    final round
                  </span>
                )}
                <span
                  className="mx-2 h-[24px] w-px bg-amber-700 opacity-50"
                  aria-hidden
                />
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
            )}
          </div>
        );
      })}
    </div>
  );
}

function DemandBar({ value }: { value: number }) {
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
      className="flex min-w-[280px] items-center gap-3"
      title={`Market demand ${value} of 12`}
    >
      <span className="font-mono text-[12px] uppercase tracking-[.14em] text-slate-400">
        demand
      </span>
      <div className="flex flex-1 gap-[4px]" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => {
          const cellNum = i + 1;
          const isActive = cellNum <= value;
          return (
            <div
              key={i}
              className={[
                "h-[22px] flex-1 rounded-[4px] border transition-colors duration-200",
                isActive
                  ? "text-slate-950"
                  : "border-slate-800 bg-slate-900",
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
      <span
        className={`font-mono text-[16px] font-bold tabular-nums ${valueClass}`}
      >
        {value}/12
      </span>
    </div>
  );
}
