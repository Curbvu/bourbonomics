"use client";

/**
 * Demand-roll modal — interactive 2d6 roll at the top of each player's
 * own action turn (v2.9: per-player, not per-round).
 *
 * Renders only when:
 *   - state.phase === "action"
 *   - the current player has `needsDemandRoll === true`
 *   - autoplay is OFF
 *   - in MP, the local seat IS the current player (others wait)
 *
 * Flow:
 *   1. Modal pops with a "Roll dice ↵" button.
 *   2. Click → both dice DROP from above the modal, tumble on the way
 *      down, land with a bounce, and settle on the rolled values. The
 *      roll is determined by the engine's seeded RNG (same function the
 *      runner uses), so result is reproducible.
 *   3. After a brief reveal, the ROLL_DEMAND action is dispatched and
 *      the modal closes — the player can now take their actions.
 */

import { useEffect, useRef, useState } from "react";

import { roll2d6 } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

type RollState =
  | { kind: "idle" }
  | { kind: "rolling"; values: [number, number] }
  | { kind: "settled"; values: [number, number] };

const DROP_MS = 1050;     // matches die-drop keyframe
const SETTLE_MS = 700;    // dwell on the result before dispatching

export default function DemandRollModal() {
  const { state, autoplay, multiplayerMode, humanSeatPlayerId, dispatch } = useGameStore();
  const [phase, setPhase] = useState<RollState>({ kind: "idle" });
  const [tickValues, setTickValues] = useState<[number, number]>([1, 1]);
  // v2.9: demand is rolled per-turn, not per-round. Reset the dice
  // animation each time a fresh roll is required (every time the
  // current player flips to a human who needs to roll).
  const armed =
    state?.phase === "action" &&
    state.players[state.currentPlayerIndex]?.needsDemandRoll === true;
  const turnKey = armed ? `${state.round}:${state.currentPlayerIndex}` : "";
  // Guard against React strict-mode running effects twice in dev — one
  // dispatch per turn, max.
  const dispatchedRef = useRef<string>("");

  useEffect(() => {
    setPhase({ kind: "idle" });
  }, [turnKey]);

  // While rolling — flicker random faces during the drop, then snap to
  // the resolved values right before the settle phase.
  useEffect(() => {
    if (phase.kind !== "rolling") return;
    const id = window.setInterval(() => {
      setTickValues([
        1 + Math.floor(Math.random() * 6),
        1 + Math.floor(Math.random() * 6),
      ] as [number, number]);
    }, 80);
    const stop = window.setTimeout(() => {
      window.clearInterval(id);
      setTickValues(phase.values);
      setPhase({ kind: "settled", values: phase.values });
    }, DROP_MS - 80);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(stop);
    };
  }, [phase]);

  // After the dice settle, dispatch ROLL_DEMAND once per turn.
  const currentPlayerId = state?.players[state?.currentPlayerIndex ?? 0]?.id;
  useEffect(() => {
    if (phase.kind !== "settled") return;
    if (!currentPlayerId) return;
    if (dispatchedRef.current === turnKey) return;
    const id = window.setTimeout(() => {
      dispatchedRef.current = turnKey;
      dispatch({
        type: "ROLL_DEMAND",
        playerId: currentPlayerId,
        roll: phase.values,
      });
      setPhase({ kind: "idle" });
    }, SETTLE_MS);
    return () => window.clearTimeout(id);
  }, [phase, dispatch, turnKey, currentPlayerId]);

  if (!state) return null;
  if (!armed) return null;
  if (autoplay) return null;
  // v2.9: each player rolls demand at the top of their own action
  // turn. In MP only the seat the engine is on the clock for sees the
  // modal — others wait for the broadcast.
  if (multiplayerMode && humanSeatPlayerId !== currentPlayerId) {
    return null;
  }

  const startRoll = () => {
    if (phase.kind !== "idle") return;
    if (dispatchedRef.current === turnKey) return;
    const [values] = roll2d6(state.rngState);
    setPhase({ kind: "rolling", values });
  };

  const sum = tickValues[0] + tickValues[1];
  const willRise = sum > state.demand;
  const isAnimating = phase.kind === "rolling";
  const isSettled = phase.kind === "settled";

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
            Round {state.round} · Your demand roll
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            Roll 2d6 to set the market temperature
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
            current demand · <span className="text-amber-200 tabular-nums">{state.demand}/12</span>
            {isSettled ? (
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

        {/* Dice stage — fixed-height tray so falling dice have somewhere
            to drop from / land into. */}
        <div className="relative h-[140px] w-[260px]">
          <DieStage value={tickValues[0]} animating={isAnimating} runId={`${turnKey}-a-${phase.kind}`} offsetX={-72} />
          <DieStage value={tickValues[1]} animating={isAnimating} runId={`${turnKey}-b-${phase.kind}`} offsetX={72} />
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

function DieStage({
  value,
  animating,
  runId,
  offsetX,
}: {
  value: number;
  animating: boolean;
  runId: string;
  offsetX: number;
}) {
  return (
    <div
      className="absolute bottom-0 left-1/2 flex h-[100px] w-[100px] flex-col items-center"
      style={{ transform: `translateX(calc(-50% + ${offsetX}px))` }}
    >
      {/* Impact shadow on the floor */}
      {animating ? (
        <div
          key={`shadow-${runId}`}
          className="animate-die-impact pointer-events-none absolute -bottom-2 h-[8px] w-[88px] rounded-full bg-black/60 blur-md"
          aria-hidden
        />
      ) : null}
      {/* The die itself — wraps the drop in a separate element from the
          tumble so they can layer cleanly. */}
      <div
        key={`drop-${runId}`}
        className={animating ? "animate-die-drop" : ""}
      >
        <Die value={value} wobble={animating} />
      </div>
    </div>
  );
}

function Die({ value, wobble }: { value: number; wobble: boolean }) {
  const v = Math.min(6, Math.max(1, value));
  const pips = PIPS[v]!;
  return (
    <div
      aria-label={`Die showing ${v}`}
      className={[
        "relative grid h-[88px] w-[88px] grid-cols-3 grid-rows-3 gap-1.5 rounded-xl border-2 border-amber-300 bg-gradient-to-br from-amber-50 to-amber-200 p-2.5 shadow-[0_8px_22px_rgba(0,0,0,.5),inset_0_1px_0_rgba(255,255,255,.7)]",
        wobble ? "animate-die-tumble" : "",
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
