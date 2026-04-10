"use client";

import Link from "next/link";
import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

type LobbySlotPlan = "closed" | "open" | "computer";

export default function Lobby() {
  const [mode, setMode] = useState<"normal" | "bottled-in-bond" | "singleplayer">("normal");
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

  const isMultiplayer = mode !== "singleplayer";

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
      if (!res.ok) throw new Error(data.error || "Failed to join game");
      window.location.href = `/game/${data.gameId}?playerId=${data.playerId}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join game");
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
    <div className="flex min-h-screen flex-col bg-[#120a07] text-[#f5e6c8]">
      <div className="border-b border-[#3d2918] bg-[#1a100a] px-4 py-6 text-center">
        <h1 className="font-serif text-3xl font-semibold tracking-tight text-[#f0dcb0] md:text-4xl">
          Bourbonomics
        </h1>
        <p className="mt-2 text-sm text-[#c4a574]">Host a game or join with a code</p>
      </div>

      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start lg:gap-8">
        {/* Player slots — AoE-style list */}
        <section className="min-w-0 flex-1 rounded-lg border border-[#4a3424] bg-[#1c120c] p-4 shadow-lg">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#e8c97a]">
            Players
          </h2>

          {!isMultiplayer ? (
            <p className="rounded border border-[#3d2918] bg-[#120a07] p-3 text-sm text-[#c4a574]">
              Single player starts immediately: you versus one computer baron. Use multiplayer
              modes to configure up to six seats.
            </p>
          ) : null}

          <ul className="mt-3 space-y-2">
            <li className="flex flex-wrap items-center gap-3 rounded border border-[#5c4330] bg-[#26160f] px-3 py-2.5">
              <span className="w-8 shrink-0 text-center font-mono text-xs font-bold text-[#a08060]">
                1
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-[#e8c97a]">You (host)</p>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Baron name"
                  className="mt-1 w-full max-w-xs rounded border border-[#4a3424] bg-[#120a07] px-2 py-1.5 text-sm text-[#f5e6c8] placeholder:text-[#6b5344] focus:border-[#c87800] focus:outline-none"
                />
              </div>
              <span className="rounded bg-[#2a1810] px-2 py-1 text-[10px] font-semibold uppercase text-[#c4a574]">
                Human
              </span>
            </li>

            {isMultiplayer
              ? seatPlan.map((slot, i) => (
                  <li
                    key={i}
                    className="flex flex-wrap items-center gap-3 rounded border border-[#3d2918] bg-[#1a100a] px-3 py-2.5"
                  >
                    <span className="w-8 shrink-0 text-center font-mono text-xs font-bold text-[#a08060]">
                      {i + 2}
                    </span>
                    <label className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-3">
                      <span className="text-xs text-[#c4a574]">Slot type</span>
                      <select
                        value={slot}
                        onChange={(e) => setSeatAt(i, e.target.value as LobbySlotPlan)}
                        className="w-full max-w-[220px] rounded border border-[#4a3424] bg-[#120a07] px-2 py-1.5 text-sm text-[#f5e6c8] focus:border-[#c87800] focus:outline-none"
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

        {/* Game settings */}
        <aside className="w-full shrink-0 rounded-lg border border-[#4a3424] bg-[#1c120c] p-4 shadow-lg lg:max-w-sm">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-[#e8c97a]">
            Game settings
          </h2>

          {error && (
            <div className="mb-3 rounded border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
              {error}
            </div>
          )}

          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <label className="text-xs font-medium text-[#c4a574]">Mode</label>
            <select
              value={mode}
              onChange={(e) =>
                setMode(e.target.value as "normal" | "bottled-in-bond" | "singleplayer")
              }
              className="rounded border border-[#4a3424] bg-[#120a07] px-3 py-2 text-sm text-[#f5e6c8] focus:border-[#c87800] focus:outline-none"
            >
              <option value="normal">Normal (multiplayer)</option>
              <option value="bottled-in-bond">Bottled-in-Bond</option>
              <option value="singleplayer">Single player vs computer</option>
            </select>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full rounded-md bg-[#c87800] py-2.5 text-sm font-semibold text-[#1a0f08] shadow hover:bg-[#d89020] disabled:opacity-50"
            >
              {loading ? "Creating…" : isMultiplayer ? "Create lobby" : "Start solo game"}
            </button>
          </form>

          <div className="my-6 border-t border-[#3d2918]" />

          <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-[#a08060]">
            Join existing game
          </h3>
          <form onSubmit={handleJoin} className="flex flex-col gap-2">
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Game code"
              maxLength={6}
              className="rounded border border-[#4a3424] bg-[#120a07] px-3 py-2 font-mono text-sm uppercase text-[#f5e6c8] placeholder:text-[#6b5344] focus:border-[#c87800] focus:outline-none"
            />
            <input
              type="text"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              placeholder="Your name"
              className="rounded border border-[#4a3424] bg-[#120a07] px-3 py-2 text-sm text-[#f5e6c8] placeholder:text-[#6b5344] focus:border-[#c87800] focus:outline-none"
            />
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md border border-[#c87800] bg-transparent py-2.5 text-sm font-semibold text-[#f0dcb0] hover:bg-[#c87800]/15 disabled:opacity-50"
            >
              {loading ? "Joining…" : "Join game"}
            </button>
          </form>
        </aside>
      </div>

      <footer className="border-t border-[#3d2918] py-4 text-center">
        <Link href="/rules" className="text-sm text-[#c4a574] underline hover:text-[#e8c97a]">
          Game rules
        </Link>
      </footer>
    </div>
  );
}
