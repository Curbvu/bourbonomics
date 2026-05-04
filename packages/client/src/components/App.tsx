"use client";

import { useState } from "react";
import {
  defaultMashBillCatalog,
  initializeGame,
  type GameState,
} from "@bourbonomics/engine";
import { GameView } from "./GameView";

interface SetupConfig {
  numBots: number;
  seed: number;
  bourbonDeckSize: number;
}

const DEFAULT_SETUP: SetupConfig = {
  numBots: 2,
  seed: 1,
  bourbonDeckSize: 6,
};

export function App() {
  const [setup, setSetup] = useState<SetupConfig>(DEFAULT_SETUP);
  const [game, setGame] = useState<GameState | null>(null);

  const startGame = (config: SetupConfig) => {
    const catalog = defaultMashBillCatalog();
    const players = Array.from({ length: config.numBots }, (_, i) => ({
      id: `bot${i + 1}`,
      name: `Bot ${i + 1}`,
      isBot: true,
    }));
    setGame(
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
  };

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b border-neutral-800 px-6 py-4">
        <h1 className="text-xl font-semibold tracking-tight">
          🥃 Bourbonomics 2.0 — Bot Match Viewer
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          Watch heuristic bots play a full game. Engine actions stream into the
          log on the right.
        </p>
      </header>

      <div className="flex-1 flex">
        {!game ? (
          <SetupForm
            setup={setup}
            onChange={setSetup}
            onStart={() => startGame(setup)}
          />
        ) : (
          <GameView initialState={game} onReset={() => setGame(null)} />
        )}
      </div>
    </main>
  );
}

function SetupForm({
  setup,
  onChange,
  onStart,
}: {
  setup: SetupConfig;
  onChange: (s: SetupConfig) => void;
  onStart: () => void;
}) {
  return (
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
