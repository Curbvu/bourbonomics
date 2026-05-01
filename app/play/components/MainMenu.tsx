"use client";

/**
 * Main menu — shown whenever `useGameStore.state` is null.
 *
 * Lets the player pick their name, how many bots to play against (1-5),
 * and each bot's difficulty before starting a fresh game. Replaces the
 * old auto-quickstart in PlayPage, which started a 3-seat game without
 * giving the player any choice.
 *
 * Quitting from inside a game (via GameTopBar's "Quit ↵" button) clears
 * the saved game and brings the player back here.
 */

import { useState } from "react";

import type { BotDifficulty, PlayerKind } from "@/lib/engine/state";
import { useGameStore } from "@/lib/store/gameStore";

type BotSeat = { name: string; difficulty: BotDifficulty };

const BOT_NAME_POOL = ["Clyde", "Dell", "Maeve", "Roy", "Vance"];

const DEFAULT_BOTS: BotSeat[] = [
  { name: "Clyde", difficulty: "normal" },
  { name: "Dell", difficulty: "easy" },
];

const DIFFICULTY_OPTIONS: { id: BotDifficulty; label: string; hint: string }[] = [
  { id: "easy", label: "Easy", hint: "Picks from the top 4 moves" },
  { id: "normal", label: "Normal", hint: "Picks from the top 2 moves" },
  { id: "hard", label: "Hard", hint: "Picks the top move" },
];

export default function MainMenu() {
  const newGame = useGameStore((s) => s.newGame);
  const [playerName, setPlayerName] = useState("You");
  const [bots, setBots] = useState<BotSeat[]>(DEFAULT_BOTS);

  const totalSeats = 1 + bots.length;
  const canStart = totalSeats >= 2 && totalSeats <= 6 && playerName.trim().length > 0;

  const setBotDifficulty = (idx: number, difficulty: BotDifficulty) => {
    setBots((cur) => cur.map((b, i) => (i === idx ? { ...b, difficulty } : b)));
  };

  const setBotName = (idx: number, name: string) => {
    setBots((cur) => cur.map((b, i) => (i === idx ? { ...b, name } : b)));
  };

  const addBot = () => {
    if (bots.length >= 5) return;
    const used = new Set(bots.map((b) => b.name));
    const next = BOT_NAME_POOL.find((n) => !used.has(n)) ?? `Bot ${bots.length + 1}`;
    setBots((cur) => [...cur, { name: next, difficulty: "normal" }]);
  };

  const removeBot = (idx: number) => {
    if (bots.length <= 1) return;
    setBots((cur) => cur.filter((_, i) => i !== idx));
  };

  const start = () => {
    if (!canStart) return;
    const seats: { name: string; kind: PlayerKind; botDifficulty?: BotDifficulty }[] = [
      { name: playerName.trim() || "You", kind: "human" },
      ...bots.map((b) => ({
        name: b.name.trim() || "Bot",
        kind: "bot" as PlayerKind,
        botDifficulty: b.difficulty,
      })),
    ];
    newGame({
      id: "quickstart",
      seed: Math.floor(Math.random() * 0xffff_ffff),
      seats,
    });
  };

  return (
    <main
      className="min-h-screen text-slate-100"
      style={{
        backgroundColor: "#0f172a",
        backgroundImage: `
          radial-gradient(1200px 600px at 70% -10%, rgba(180,83,9,.12), transparent 60%),
          radial-gradient(800px 500px at -10% 110%, rgba(99,102,241,.07), transparent 60%)
        `,
      }}
    >
      <div className="mx-auto flex min-h-screen max-w-[720px] flex-col gap-6 px-6 py-12">
        {/* Brand header */}
        <div className="flex items-center gap-3">
          <div
            className="grid h-10 w-10 place-items-center rounded-md border border-amber-700 font-display text-2xl font-bold text-amber-100"
            style={{
              background: "linear-gradient(135deg, #d97706, #92400e)",
              boxShadow: "0 1px 0 rgba(255,255,255,.15) inset",
            }}
            aria-hidden
          >
            B
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display text-2xl font-semibold tracking-[.01em] text-amber-100">
              Bourbonomics
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-500">
              distillery management · solo vs. computer
            </span>
          </div>
        </div>

        {/* Player + seat config */}
        <section className="flex flex-col gap-4 rounded-lg border border-slate-800 bg-slate-900/70 p-5">
          <div>
            <label className="mb-1 block font-mono text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">
              Your baron name
            </label>
            <input
              type="text"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              maxLength={20}
              className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-1.5 font-display text-base text-amber-100 outline-none ring-amber-500/0 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/40"
              placeholder="You"
            />
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="font-mono text-[11px] font-semibold uppercase tracking-[.14em] text-slate-400">
                Opponents · {bots.length} bot{bots.length === 1 ? "" : "s"}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
                {totalSeats} seats total
              </span>
            </div>
            <ul className="space-y-2">
              {bots.map((b, i) => (
                <li
                  key={i}
                  className="flex flex-wrap items-center gap-2 rounded border border-slate-800 bg-slate-950/60 px-3 py-2"
                >
                  <input
                    type="text"
                    value={b.name}
                    onChange={(e) => setBotName(i, e.target.value)}
                    maxLength={16}
                    className="w-32 rounded border border-slate-800 bg-slate-950 px-2 py-1 font-display text-sm text-slate-100 outline-none focus:border-amber-500"
                    aria-label={`Bot ${i + 1} name`}
                  />
                  <div
                    className="flex flex-wrap gap-1"
                    role="radiogroup"
                    aria-label={`Bot ${b.name} difficulty`}
                  >
                    {DIFFICULTY_OPTIONS.map((opt) => {
                      const selected = b.difficulty === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setBotDifficulty(i, opt.id)}
                          title={opt.hint}
                          aria-pressed={selected}
                          className={[
                            "rounded border px-2.5 py-1 font-mono text-[10px] font-semibold uppercase tracking-[.08em] transition-colors",
                            selected
                              ? "border-amber-500 bg-amber-700/[0.30] text-amber-100"
                              : "border-slate-700 bg-slate-900 text-slate-400 hover:border-amber-500/60 hover:text-amber-200",
                          ].join(" ")}
                        >
                          {opt.label}
                        </button>
                      );
                    })}
                  </div>
                  <span className="flex-1" />
                  <button
                    type="button"
                    onClick={() => removeBot(i)}
                    disabled={bots.length <= 1}
                    title={
                      bots.length <= 1
                        ? "Need at least 1 bot opponent"
                        : `Remove ${b.name}`
                    }
                    className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[.05em] text-slate-400 transition-colors hover:border-rose-500/60 hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-700 disabled:hover:text-slate-400"
                  >
                    remove
                  </button>
                </li>
              ))}
            </ul>
            {bots.length < 5 ? (
              <button
                type="button"
                onClick={addBot}
                className="mt-2 rounded border border-dashed border-slate-700 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.08em] text-slate-300 transition-colors hover:border-amber-500/60 hover:text-amber-200"
              >
                + add bot
              </button>
            ) : null}
          </div>
        </section>

        {/* Start button */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={start}
            disabled={!canStart}
            className="rounded-md border border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 px-5 py-2 font-sans text-sm font-bold uppercase tracking-[.06em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2),0_2px_8px_rgba(245,158,11,.25)] transition-all hover:-translate-y-0.5 hover:from-amber-400 hover:to-amber-600 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.25),0_4px_12px_rgba(245,158,11,.35)] disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
          >
            Start distillery ↵
          </button>
          <span className="font-mono text-[11px] text-slate-500">
            Solo vs. {bots.length} bot{bots.length === 1 ? "" : "s"} · seed
            randomised
          </span>
        </div>

        {/* Footer */}
        <footer className="mt-4 border-t border-slate-800 pt-4">
          <p className="font-mono text-[11px] leading-relaxed text-slate-500">
            Read the{" "}
            <a
              href="/rules"
              className="text-amber-300 underline-offset-2 hover:underline"
            >
              full rulebook
            </a>{" "}
            before your first run. Saves to your browser; no account needed.
          </p>
        </footer>
      </div>
    </main>
  );
}
