"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  computeFinalScores,
  defaultMashBillCatalog,
  initializeGame,
  isGameOver,
  stepOrchestrator,
  type GameState,
} from "@bourbonomics/engine";
import { Header } from "./Header";
import { PhaseRibbon } from "./PhaseRibbon";
import { MarketConveyor } from "./MarketConveyor";
import { UnifiedRickhouse } from "./UnifiedRickhouse";
import { RightRail } from "./RightRail";
import { HandPanel } from "./HandPanel";
import type { LogEntry } from "./ActionLog";

interface SetupConfig {
  numBots: number;
  seed: number;
  bourbonDeckSize: number;
}

const DEFAULT_SETUP: SetupConfig = {
  numBots: 3,
  seed: 1,
  bourbonDeckSize: 6,
};

const AUTO_DELAY_MS = 250;

export function App() {
  const [setup, setSetup] = useState<SetupConfig>(DEFAULT_SETUP);
  const [state, setState] = useState<GameState | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [autoplay, setAutoplay] = useState(false);
  const seqRef = useRef(0);

  const startGame = (config: SetupConfig) => {
    const catalog = defaultMashBillCatalog();
    const players = Array.from({ length: config.numBots }, (_, i) => ({
      id: `bot${i + 1}`,
      name: BOT_NAMES[i] ?? `Bot ${i + 1}`,
      isBot: true,
    }));
    setState(
      initializeGame({
        seed: config.seed,
        players,
        bourbonDeck: catalog.slice(0, config.bourbonDeckSize),
        startingMashBills: players.map((_, i) => [
          catalog[(i * 2) % catalog.length]!,
          catalog[(i * 2 + 1) % catalog.length]!,
        ]),
      }),
    );
    setLog([]);
    seqRef.current = 0;
    setAutoplay(false);
  };

  const reset = () => {
    setAutoplay(false);
    setState(null);
    setLog([]);
    seqRef.current = 0;
  };

  const stepOnce = () => {
    if (!state) return;
    if (isGameOver(state)) return;
    const result = stepOrchestrator(state);
    if (!result) return;
    seqRef.current += 1;
    setState(result.state);
    setLog((prev) =>
      [
        ...prev,
        {
          seq: seqRef.current,
          action: result.action,
          round: result.state.round,
          phase: result.state.phase,
        },
      ].slice(-300),
    );
  };

  // Autoplay loop.
  useEffect(() => {
    if (!autoplay) return;
    if (!state) return;
    if (isGameOver(state)) {
      setAutoplay(false);
      return;
    }
    const id = window.setTimeout(stepOnce, AUTO_DELAY_MS);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, state]);

  const scores = useMemo(
    () => (state && isGameOver(state) ? computeFinalScores(state) : null),
    [state],
  );

  if (!state) {
    return <SetupScreen setup={setup} onChange={setSetup} onStart={() => startGame(setup)} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header state={state} onQuit={reset} />
      <PhaseRibbon
        state={state}
        autoplay={autoplay}
        onStep={stepOnce}
        onToggleAutoplay={() => setAutoplay((v) => !v)}
      />
      <div className="flex-1 grid grid-cols-12 gap-4 px-6 py-4 min-h-0">
        <div className="col-span-8 flex flex-col gap-4 min-h-0">
          <MarketConveyor
            cards={state.marketConveyor}
            supplyCount={state.marketSupplyDeck.length}
          />
          <UnifiedRickhouse state={state} />
        </div>
        <div className="col-span-4 min-h-0 flex">
          <RightRail state={state} log={log} scores={scores} />
        </div>
      </div>
      <HandPanel state={state} />
      {scores && <FinalStandings state={state} scores={scores} />}
    </div>
  );
}

const BOT_NAMES = ["Clyde", "Dell", "Mae", "Otis"];

function SetupScreen({
  setup,
  onChange,
  onStart,
}: {
  setup: SetupConfig;
  onChange: (s: SetupConfig) => void;
  onStart: () => void;
}) {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">
          🥃 Bourbonomics 2.0 — Bot Match Viewer
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Set up a bot-vs-bot match to watch the engine play itself.
        </p>
      </header>
      <section className="m-auto w-full max-w-md p-8 rounded-lg border border-neutral-800 bg-neutral-900">
        <h2 className="text-lg font-medium mb-4">New game</h2>
        <div className="space-y-4">
          <Field label="Number of bots">
            <input
              type="number"
              min={2}
              max={4}
              value={setup.numBots}
              onChange={(e) =>
                onChange({ ...setup, numBots: clampInt(e.target.value, 2, 4) })
              }
              className="w-full rounded bg-neutral-800 border border-neutral-700 px-3 py-2"
            />
          </Field>
          <Field label="Seed (deterministic)">
            <input
              type="number"
              value={setup.seed}
              onChange={(e) =>
                onChange({ ...setup, seed: parseInt(e.target.value || "0", 10) })
              }
              className="w-full rounded bg-neutral-800 border border-neutral-700 px-3 py-2"
            />
          </Field>
          <Field label="Bourbon deck size (smaller = faster game)">
            <input
              type="number"
              min={2}
              max={8}
              value={setup.bourbonDeckSize}
              onChange={(e) =>
                onChange({
                  ...setup,
                  bourbonDeckSize: clampInt(e.target.value, 2, 8),
                })
              }
              className="w-full rounded bg-neutral-800 border border-neutral-700 px-3 py-2"
            />
          </Field>
          <button
            onClick={onStart}
            className="w-full rounded bg-amber-600 hover:bg-amber-500 text-neutral-950 font-medium py-2 transition"
          >
            Start match
          </button>
        </div>
      </section>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-neutral-400 mb-1">
        {label}
      </span>
      {children}
    </label>
  );
}

function clampInt(v: string, lo: number, hi: number): number {
  const n = parseInt(v || `${lo}`, 10);
  if (Number.isNaN(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function FinalStandings({
  state,
  scores,
}: {
  state: GameState;
  scores: ReturnType<typeof computeFinalScores>;
}) {
  return (
    <div className="border-t border-neutral-800 px-6 py-3 bg-neutral-900/80">
      <h2 className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-2">
        Final standings
      </h2>
      <ol className="space-y-1 text-sm">
        {scores.map((s) => {
          const player = state.players.find((p) => p.id === s.playerId)!;
          return (
            <li key={s.playerId} className="flex items-baseline gap-3">
              <span className="w-8 text-amber-400 font-semibold">#{s.rank}</span>
              <span className="w-32 font-medium">{player.name}</span>
              <span className="text-amber-300 font-semibold tabular-nums">
                {s.reputation} rep
              </span>
              <span className="text-neutral-500">
                · {s.barrelsSold} barrels sold · deck {s.deckSize}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
