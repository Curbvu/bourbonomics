"use client";

import type { GameState } from "@bourbonomics/engine";

const PHASES: { key: GameState["phase"]; label: string }[] = [
  { key: "demand", label: "Demand" },
  { key: "draw", label: "Draw" },
  { key: "action", label: "Action" },
  { key: "cleanup", label: "Cleanup" },
];

export function PhaseRibbon({
  state,
  autoplay,
  onStep,
  onToggleAutoplay,
}: {
  state: GameState;
  autoplay: boolean;
  onStep: () => void;
  onToggleAutoplay: () => void;
}) {
  const currentIdx = PHASES.findIndex((p) => p.key === state.phase);
  const gameOver = state.phase === "ended";
  const currentPlayer = state.players[state.currentPlayerIndex];

  return (
    <div className="border-b border-neutral-800 bg-neutral-950/60 px-6 py-2.5 flex items-center gap-4">
      {/* Phase pills */}
      <div className="flex items-center gap-2">
        {PHASES.map((phase, i) => {
          const done = !gameOver && i < currentIdx;
          const active = !gameOver && i === currentIdx;
          return (
            <div
              key={phase.key}
              className={`flex items-center gap-2 px-3 py-1.5 rounded border text-xs ${
                active
                  ? "border-amber-600 bg-amber-950/30 text-amber-200"
                  : done
                    ? "border-neutral-800 bg-neutral-900 text-neutral-500"
                    : "border-neutral-800 bg-neutral-950 text-neutral-500"
              }`}
            >
              <span
                className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                  active
                    ? "bg-amber-600 text-neutral-950"
                    : done
                      ? "bg-neutral-700 text-neutral-300"
                      : "bg-neutral-800 text-neutral-500"
                }`}
              >
                {done ? "✓" : i + 1}
              </span>
              <span className="font-medium uppercase tracking-wide">
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Round / current player info */}
      <div className="px-3 py-1.5 rounded border border-neutral-800 bg-neutral-900 text-xs text-neutral-400">
        {gameOver ? (
          <span className="text-emerald-400 font-medium">Game over</span>
        ) : state.phase === "action" && currentPlayer ? (
          <>
            <span className="text-neutral-500">Acting:</span>{" "}
            <span className="text-amber-300 font-medium">
              {currentPlayer.name}
            </span>
          </>
        ) : state.finalRoundTriggered ? (
          <span className="text-amber-400 font-medium">⚠ Final round</span>
        ) : (
          <>Round {state.round}</>
        )}
      </div>

      {/* Demand bar */}
      <div className="flex items-center gap-3 ml-auto">
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          Demand
        </span>
        <div className="flex gap-0.5">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className={`w-3 h-5 rounded-sm ${
                i < state.demand
                  ? "bg-sky-500"
                  : "bg-neutral-800 border border-neutral-700"
              }`}
            />
          ))}
        </div>
        <span className="text-sm font-semibold text-amber-400 tabular-nums">
          {state.demand}/12
        </span>
      </div>

      {/* Bourbon deck doomsday */}
      <div className="px-3 py-1.5 rounded border border-amber-700/40 bg-amber-950/20 text-xs flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          Bourbon
        </span>
        <span className="text-amber-400 font-semibold tabular-nums">
          {state.bourbonDeck.length}
        </span>
      </div>

      {/* Step / Auto controls */}
      <div className="flex items-center gap-2 pl-3 border-l border-neutral-800">
        <button
          onClick={onStep}
          disabled={gameOver}
          className="text-xs px-3 py-1.5 rounded border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Step
        </button>
        <button
          onClick={onToggleAutoplay}
          disabled={gameOver}
          className={`text-xs px-3 py-1.5 rounded border transition ${
            autoplay
              ? "border-amber-500 bg-amber-600 text-neutral-950 hover:bg-amber-500"
              : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
          } disabled:opacity-40 disabled:cursor-not-allowed`}
        >
          {autoplay ? "Pause" : "Auto"}
        </button>
      </div>
    </div>
  );
}
