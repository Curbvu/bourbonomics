"use client";

import { useState } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

export default function Lobby() {
  const [mode, setMode] = useState<"normal" | "bottled-in-bond" | "singleplayer">("normal");
  const [createName, setCreateName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [joinName, setJoinName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          playerName: createName || "Baron 1",
        }),
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

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 bg-amber-50 p-6 dark:bg-amber-950/20">
      <h1 className="text-3xl font-bold text-amber-900 dark:text-amber-100">
        Bourbonomics
      </h1>
      <p className="text-center text-amber-800 dark:text-amber-200">
        Create a game or join with a code.
      </p>

      {error && (
        <div className="rounded bg-red-100 px-4 py-2 text-red-800 dark:bg-red-900/50 dark:text-red-200">
          {error}
        </div>
      )}

      <div className="flex w-full max-w-md flex-col gap-8">
        <form onSubmit={handleCreate} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="font-semibold text-amber-900 dark:text-amber-100">
            Create game
          </h2>
          <label className="text-sm text-amber-800 dark:text-amber-200">
            Your name
          </label>
          <input
            type="text"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            placeholder="Baron 1"
            className="rounded border border-amber-300 bg-white px-3 py-2 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
          />
          <label className="text-sm text-amber-800 dark:text-amber-200">
            Mode
          </label>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as "normal" | "bottled-in-bond" | "singleplayer")}
            className="rounded border border-amber-300 bg-white px-3 py-2 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
          >
            <option value="normal">Normal (multiplayer)</option>
            <option value="singleplayer">Single player vs Computer</option>
            <option value="bottled-in-bond">Bottled-in-Bond</option>
          </select>
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create game"}
          </button>
        </form>

        <form onSubmit={handleJoin} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <h2 className="font-semibold text-amber-900 dark:text-amber-100">
            Join game
          </h2>
          <label className="text-sm text-amber-800 dark:text-amber-200">
            Game code
          </label>
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="rounded border border-amber-300 bg-white px-3 py-2 font-mono uppercase dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
          />
          <label className="text-sm text-amber-800 dark:text-amber-200">
            Your name
          </label>
          <input
            type="text"
            value={joinName}
            onChange={(e) => setJoinName(e.target.value)}
            placeholder="Baron"
            className="rounded border border-amber-300 bg-white px-3 py-2 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {loading ? "Joining…" : "Join game"}
          </button>
        </form>
      </div>

      <a
        href="/rules"
        className="text-sm text-amber-700 underline dark:text-amber-300"
      >
        Game rules
      </a>
    </div>
  );
}
