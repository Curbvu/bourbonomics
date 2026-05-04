"use client";

/**
 * Phase strip — second band on the dashboard, immediately below the top bar.
 * v1 had 3 phases (Fees / Action / Market) plus a cost ladder; v2 has 4
 * phases (Demand / Draw / Action / Cleanup) and no cost ladder, so the
 * action cell expands to host the demand bar + Step/Auto controls.
 */

import { useGameStore } from "@/lib/store/game";

const PHASES = [
  { k: "demand", l: "Demand" },
  { k: "draw", l: "Draw" },
  { k: "action", l: "Action" },
  { k: "cleanup", l: "Cleanup" },
] as const;

export default function PhaseBanner({ subBar = false }: { subBar?: boolean }) {
  const { state, autoplay, setAutoplay, step } = useGameStore();
  if (!state) return null;
  if (state.phase === "ended") return null;

  const currentIndex = PHASES.findIndex((p) => p.k === state.phase);

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
        const active = p.k === state.phase;
        const past = currentIndex > i;
        const expandActive = active && p.k === "action";
        return (
          <div
            key={p.k}
            className={[
              "flex min-w-0 items-center gap-3 px-4 py-2",
              expandActive ? "flex-[3]" : "flex-1",
              i < PHASES.length - 1 ? "border-r border-slate-800" : "",
              active ? "bg-amber-700/[0.18]" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-current={active ? "step" : undefined}
          >
            <span
              className={[
                "grid h-[30px] w-[30px] flex-shrink-0 place-items-center rounded-full font-mono text-[13px] font-bold leading-none",
                active
                  ? "bg-amber-500 text-slate-950"
                  : past
                    ? "bg-slate-700 text-slate-300"
                    : "border-2 border-slate-700 text-slate-400",
              ].join(" ")}
              aria-hidden
            >
              {past ? "✓" : i + 1}
            </span>

            <span
              className={[
                "flex-shrink-0 text-[17px]",
                active
                  ? "font-semibold text-amber-100"
                  : past
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
          const active = cellNum <= value;
          return (
            <div
              key={i}
              className={[
                "h-[22px] flex-1 rounded-[4px] border transition-colors duration-200",
                active
                  ? "text-slate-950"
                  : "border-slate-800 bg-slate-900",
              ].join(" ")}
              style={
                active
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
