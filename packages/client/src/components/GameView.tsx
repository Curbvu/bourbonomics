"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeFinalScores,
  isGameOver,
  stepOrchestrator,
  type GameAction,
  type GameState,
} from "@bourbonomics/engine";
import { PlayerCard } from "./PlayerCard";
import { RickhouseGrid } from "./RickhouseGrid";
import { MarketConveyor } from "./MarketConveyor";
import { ActionLog, type LogEntry } from "./ActionLog";

const AUTO_DELAY_MS = 250;

export function GameView({
  initialState,
  onReset,
}: {
  initialState: GameState;
  onReset: () => void;
}) {
  const [state, setState] = useState<GameState>(initialState);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [autoplay, setAutoplay] = useState(false);
  const seqRef = useRef(0);

  const gameOver = isGameOver(state);
  const scores = useMemo(() => (gameOver ? computeFinalScores(state) : null), [gameOver, state]);

  const stepOnce = () => {
    if (isGameOver(state)) return;
    const result = stepOrchestrator(state);
    if (!result) return;
    seqRef.current += 1;
    setState(result.state);
    setLog((prev) => [
      ...prev,
      { seq: seqRef.current, action: result.action, round: result.state.round, phase: result.state.phase },
    ].slice(-200));
  };

  // Auto-play loop.
  useEffect(() => {
    if (!autoplay || gameOver) return;
    const id = window.setTimeout(stepOnce, AUTO_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, state, gameOver]);

  return (
    <div className="flex-1 flex flex-col">
      {/* Top bar */}
      <div className="border-b border-neutral-800 px-6 py-3 flex items-center gap-6 text-sm">
        <Stat label="Round" value={state.round} />
        <Stat label="Phase" value={state.phase} />
        <Stat label="Demand" value={state.demand} highlight={state.demand >= 8} />
        <Stat label="Bourbon deck" value={state.bourbonDeck.length} />
        {state.finalRoundTriggered && (
          <span className="text-amber-400 font-medium">⚠ Final round</span>
        )}
        {gameOver && <span className="text-emerald-400 font-medium">✓ Game over</span>}

        <div className="flex-1" />

        <div className="flex items-center gap-2">
          <button
            onClick={stepOnce}
            disabled={gameOver}
            className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Step
          </button>
          <button
            onClick={() => setAutoplay((v) => !v)}
            disabled={gameOver}
            className={`px-3 py-1 rounded border transition ${
              autoplay
                ? "bg-amber-600 hover:bg-amber-500 border-amber-500 text-neutral-950"
                : "bg-neutral-800 hover:bg-neutral-700 border-neutral-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            {autoplay ? "Pause" : "Auto"}
          </button>
          <button
            onClick={() => {
              setAutoplay(false);
              onReset();
            }}
            className="px-3 py-1 rounded bg-neutral-800 hover:bg-neutral-700 border border-neutral-700"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-4 p-6">
        {/* Left column: rickhouses + market */}
        <div className="col-span-7 space-y-4">
          <Section title="Rickhouses">
            <RickhouseGrid state={state} />
          </Section>
          <Section title="Market Conveyor">
            <MarketConveyor cards={state.marketConveyor} supplyCount={state.marketSupplyDeck.length} />
          </Section>
        </div>

        {/* Right column: players + action log */}
        <div className="col-span-5 flex flex-col gap-4 min-h-0">
          <Section title="Players">
            <div className="space-y-2">
              {state.players.map((p, i) => (
                <PlayerCard
                  key={p.id}
                  player={p}
                  isCurrent={state.phase === "action" && i === state.currentPlayerIndex}
                  finalRank={scores?.find((s) => s.playerId === p.id)?.rank ?? null}
                />
              ))}
            </div>
          </Section>
          <Section title="Action log" className="flex-1 min-h-0">
            <ActionLog entries={log} />
          </Section>
        </div>
      </div>

      {gameOver && scores && (
        <div className="border-t border-neutral-800 px-6 py-4 bg-neutral-900">
          <h2 className="text-base font-medium mb-2">Final standings</h2>
          <ol className="space-y-1 text-sm">
            {scores.map((s) => {
              const player = state.players.find((p) => p.id === s.playerId)!;
              return (
                <li key={s.playerId} className="flex gap-3">
                  <span className="w-8 text-amber-400">#{s.rank}</span>
                  <span className="w-32 font-medium">{player.name}</span>
                  <span className="text-neutral-300">{s.reputation} rep</span>
                  <span className="text-neutral-500">
                    · {s.barrelsSold} barrels sold · deck {s.deckSize}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className={highlight ? "text-amber-400 font-medium" : "text-neutral-100 font-medium"}>
        {value}
      </span>
    </div>
  );
}

function Section({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-neutral-800 bg-neutral-900 ${className}`}>
      <header className="px-4 py-2 border-b border-neutral-800 text-xs uppercase tracking-wide text-neutral-400">
        {title}
      </header>
      <div className="p-4 h-full overflow-auto">{children}</div>
    </section>
  );
}
