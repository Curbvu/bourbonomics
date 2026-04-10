"use client";

import Link from "next/link";
import { useState } from "react";
import type { GameMode } from "../../functions/lib/game";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type LobbySlotPlan = "closed" | "open" | "computer";

export default function Lobby() {
  const [mode, setMode] = useState<GameMode>("kentucky-straight");
  const [createName, setCreateName] = useState("");
  const [seatPlan, setSeatPlan] = useState<LobbySlotPlan[]>([
    "open",
    "closed",
    "closed",
    "closed",
    "closed",
  ]);
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const isMultiplayer = mode !== "whiskey-tutorial";

  function setSeatAt(index: number, value: LobbySlotPlan) {
    setSeatPlan((prev) => prev.map((p, i) => (i === index ? value : p)));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {
        mode,
        playerName: createName || "Baron 1",
      };
      if (isMultiplayer) body.lobbySlots = seatPlan;

      const res = await fetch(`${API_URL}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create game");
      window.location.href = `/game/${data.gameId}?playerId=${data.playerId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create game");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!joinCode.trim()) {
      setError("Enter a game code");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/games/${joinCode.trim().toUpperCase()}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: joinName || "Baron" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join");
      window.location.href = `/game/${data.gameId}?playerId=${data.playerId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join");
    } finally {
      setLoading(false);
    }
  }

  const slotLabels: Record<LobbySlotPlan, string> = {
    closed: "Closed",
    open: "Open (human)",
    computer: "Computer",
  };

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-950 text-slate-100">
      <div className="border-b border-indigo-500/30 bg-slate-950/80 px-4 py-6 text-center backdrop-blur-sm">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-cyan-100 md:text-4xl">
          Bourbonomics
        </h1>
        <p className="mt-2 text-sm text-slate-400">Host a game or join with a code</p>
        <Link
          href="/rules"
          className="mt-2 inline-block text-xs font-medium text-indigo-300 underline decoration-indigo-500/40 underline-offset-2 hover:text-cyan-200"
        >
          Quick tutorial — how to play
        </Link>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:gap-8">
        <section className="min-w-0 flex-1 rounded-xl border border-indigo-500/25 bg-slate-900/60 p-4 shadow-lg shadow-indigo-950/40 backdrop-blur-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo-200">
            Players
          </h2>

          {!isMultiplayer ? (
            <p className="rounded-lg border border-slate-700/80 bg-slate-950/50 p-3 text-sm text-slate-400">
              Single player starts immediately: you versus one computer baron. Use multiplayer
              modes to configure up to six seats.
            </p>
          ) : null}

          <ul className="mt-3 space-y-2">
            <li className="flex flex-wrap items-center gap-3 rounded-lg border border-cyan-500/30 bg-slate-950/40 px-3 py-2.5">
              <span className="w-8 shrink-0 text-center font-mono text-xs font-bold text-cyan-400/90">
                1
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-cyan-100">You (host)</p>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Baron name"
                  className="mt-1 w-full max-w-xs rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 placeholder:text-slate-500 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                />
              </div>
              <span className="rounded-md bg-indigo-600/30 px-2 py-1 text-[10px] font-semibold uppercase text-indigo-100">
                Human
              </span>
            </li>

            {isMultiplayer
              ? seatPlan.map((slot, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-700/80 bg-slate-950/30 px-3 py-2.5"
                  >
                    <span className="w-8 shrink-0 text-center font-mono text-xs font-bold text-slate-500">
                      {i + 2}
                    </span>
                    <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-xs text-slate-400">Slot type</span>
                      <select
                        value={slot}
                        onChange={(e) => setSeatAt(i, e.target.value as LobbySlotPlan)}
                        className="w-full max-w-[220px] rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
                      >
                        {(Object.keys(slotLabels) as LobbySlotPlan[]).map((k) => (
                          <option key={k} value={k}>
                            {slotLabels[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))
              : null}
          </ul>
        </section>

        <aside className="w-full shrink-0 rounded-xl border border-indigo-500/25 bg-slate-900/60 p-4 shadow-lg shadow-indigo-950/40 backdrop-blur-sm lg:max-w-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-indigo-200">
            Game settings
          </h2>

          {error && (
            <div className="mb-3 rounded-lg border border-red-500/40 bg-red-950/50 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <label className="text-xs font-medium text-slate-400">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as GameMode)}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none focus:ring-1 focus:ring-indigo-400"
            >
              <option value="whiskey-tutorial">Whiskey Tutorial</option>
              <option value="kentucky-straight">Kentucky Straight</option>
              <option value="bottled-in-bond">Bottled-in-Bond (pending)</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-900/40 hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? "Creating…" : isMultiplayer ? "Create lobby" : "Start solo game"}
            </button>
          </form>

          <div className="my-6 border-t border-slate-700/80" />

          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">
            Join existing game
          </h3>
          <form onSubmit={handleJoin} className="flex flex-col gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Game code"
              maxLength={6}
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 font-mono text-sm uppercase text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your name"
              className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg border border-cyan-500/60 bg-transparent py-2.5 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/10 disabled:opacity-50"
            >
              {loading ? "Joining…" : "Join game"}
            </button>
          </form>
        </aside>
      </div>

      <footer className="border-t border-slate-800 py-4 text-center">
        <Link
          href="/rules"
          className="text-sm text-indigo-300 underline decoration-indigo-500/50 underline-offset-2 hover:text-cyan-200"
        >
          Game rules
        </Link>
      </footer>
    </div>
  );
}
