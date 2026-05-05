"use client";

/**
 * Demand-roll modal — interactive 2d6 roll for the start of every round.
 *
 * Renders only when:
 *   - state.phase === "demand"
 *   - autoplay is OFF (autoplay handles the rolls automatically)
 *
 * Flow:
 *   1. Modal pops with a "Roll dice ↵" button.
 *   2. Click → dice spin in place for ~700ms then settle on the rolled
 *      values. The roll is determined by the engine's seeded RNG (same
 *      function the runner uses), so result is reproducible.
 *   3. After a brief reveal, the ROLL_DEMAND action is dispatched and
 *      the modal closes.
 */

import { useEffect, useState } from "react";

import { roll2d6 } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

type RollState =
  | { kind: "idle" }
  | { kind: "rolling"; values: [number, number]; resultRng: number }
  | { kind: "reveal"; values: [number, number]; resultRng: number };

const SPIN_MS = 700;
const REVEAL_MS = 700;

export default function DemandRollModal() {
  const { state, autoplay, dispatch } = useGameStore();
  const [phase, setPhase] = useState<RollState>({ kind: "idle" });
  const [tickValues, setTickValues] = useState<[number, number]>([1, 1]);

  // Reset whenever the round changes — fresh roll each round.
  const round = state?.round ?? 0;
  useEffect(() => {
    setPhase({ kind: "idle" });
  }, [round]);

  // While "rolling" — flicker random faces every 80ms.
  useEffect(() => {
    if (phase.kind !== "rolling") return;
    const id = window.setInterval(() => {
      setTickValues([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)] as [number, number]);
    }, 80);
    const stop = window.setTimeout(() => {
      window.clearInterval(id);
      setTickValues(phase.values);
      setPhase({ kind: "reveal", values: phase.values, resultRng: phase.resultRng });
    }, SPIN_MS);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [phase]);

  // After reveal, dispatch the action.
  useEffect(() => {
    if (phase.kind !== "reveal") return;
    const id = window.setTimeout(() => {
      // Advance the rng-state to match what runner.ts would have done.
      dispatch({ type: "ROLL_DEMAND", roll: phase.values });
      setPhase({ kind: "idle" });
    }, REVEAL_MS);
    return () => window.clearTimeout(id);
  }, [phase, dispatch]);

  if (!state) return null;
  if (state.phase !== "demand") return null;
  if (autoplay) return null;

  const startRoll = () => {
    if (phase.kind !== "idle") return;
    const [values, nextRng] = roll2d6(state.rngState);
    setPhase({ kind: "rolling", values, resultRng: nextRng });
  };

  const sum = tickValues[0] + tickValues[1];
  const willRise = sum > state.demand;
  const isAnimating = phase.kind === "rolling";
  const isRevealing = phase.kind === "reveal";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Roll demand dice"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-6 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[480px] w-[640px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex flex-col items-center gap-5">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
            Round {round} · Demand phase
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            Roll 2d6 to set the market temperature
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
            current demand · <span className="text-amber-200 tabular-nums">{state.demand}/12</span>
            {isRevealing ? (
              <>
                {" · result "}
                <span className="text-amber-200 tabular-nums">{sum}</span>
                {" → "}
                <span className={willRise ? "text-emerald-300" : "text-slate-400"}>
                  {willRise ? "demand rises" : "demand holds"}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <Die value={tickValues[0]} animating={isAnimating} />
          <span className="font-display text-3xl font-bold text-amber-300/70">+</span>
          <Die value={tickValues[1]} animating={isAnimating} />
        </div>

        <button
          type="button"
          onClick={startRoll}
          disabled={phase.kind !== "idle"}
          className={[
            "rounded-md border px-6 py-2.5 font-sans text-sm font-bold uppercase tracking-[.05em] transition-all",
            phase.kind === "idle"
              ? "border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-amber-200 hover:to-amber-400"
              : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-600 shadow-none",
          ].join(" ")}
        >
          {phase.kind === "idle"
            ? "Roll dice ↵"
            : isAnimating
              ? "Rolling…"
              : `Result: ${sum}`}
        </button>
      </div>
    </div>
  );
}

const PIPS: Record<number, [number, number][]> = {
  1: [[2, 2]],
  2: [[1, 1], [3, 3]],
  3: [[1, 1], [2, 2], [3, 3]],
  4: [[1, 1], [3, 1], [1, 3], [3, 3]],
  5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]],
  6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]],
};

function Die({ value, animating }: { value: number; animating: boolean }) {
  const v = Math.min(6, Math.max(1, value));
  const pips = PIPS[v]!;
  return (
    <div
      aria-label={`Die showing ${v}`}
      className={[
        "relative grid h-[88px] w-[88px] grid-cols-3 grid-rows-3 gap-1.5 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-200 p-2.5 shadow-[0_8px_22px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.7)]",
        animating ? "animate-die-tumble" : "",
      ].join(" ")}
    >
      {[1, 2, 3].map((row) =>
        [1, 2, 3].map((col) => {
          const isPip = pips.some(([c, r]) => c === col && r === row);
          return (
            <div
              key={`${row}-${col}`}
              className={
                isPip
                  ? "rounded-full bg-slate-900 shadow-[inset_0_1px_2px_rgba(0,0,0,.6)]"
                  : "rounded-full bg-transparent"
              }
              aria-hidden
            />
          );
        }),
      )}
    </div>
  );
}
