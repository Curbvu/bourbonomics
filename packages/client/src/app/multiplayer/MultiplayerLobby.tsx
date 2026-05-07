"use client";

/**
 * Multiplayer lobby — the entry point for online play.
 *
 * Two flows:
 *
 *   1. **Create** — host a fresh game. We mint a NewGameConfig with
 *      one human (the local player) plus N bots, send `create-room`
 *      to the server, and on the `joined` reply route to
 *      `/play/[code]`. The URL becomes the share link.
 *
 *   2. **Join** — paste a 4-char room code, send `join-room`, route
 *      to `/play/[code]`.
 *
 * The page does NOT render the game board — that's `/play/[code]`'s
 * job. Keeping them split means a freshly-arrived player who pastes
 * the share link lands directly in the game without a lobby step.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";

import { useGameStore } from "@/lib/store/game";
import { gameSocketUrl } from "@/lib/store/socket";

const BOT_NAMES = ["Clyde", "Dell", "Mara", "Rix"];

export default function MultiplayerLobby() {
  const router = useRouter();
  const { createMultiplayer, joinMultiplayer } = useGameStore();
  const wsUrl = gameSocketUrl();

  const [name, setName] = useState("You");
  const [botCount, setBotCount] = useState(1);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!wsUrl) {
    return (
      <div className="rounded-md border-2 border-rose-500/70 bg-rose-950/40 px-5 py-4">
        <p className="font-display text-lg font-semibold text-rose-200">
          Multiplayer not configured
        </p>
        <p className="mt-2 text-sm text-slate-300">
          This build was compiled without a multiplayer endpoint. Ask the
          deployer to set <code className="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs">NEXT_PUBLIC_GAME_WS_URL</code> at build time.
        </p>
      </div>
    );
  }

  const onCreate = async () => {
    setBusy(true);
    setError(null);
    try {
      const code = await createMultiplayer({
        human: { name: name.trim() || "You" },
        bots: Array.from({ length: botCount }, (_, i) => ({
          name: BOT_NAMES[i] ?? `Bot ${i + 1}`,
          difficulty: "normal" as const,
        })),
      });
      router.push(`/play/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create room.");
      setBusy(false);
    }
  };

  const onJoin = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 4) {
      setError("Room codes are 4 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await joinMultiplayer(code, name.trim() || "You");
      router.push(`/play/${code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to join room.");
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Display name — shared by both flows. */}
      <section className="rounded-md border border-slate-700 bg-slate-900/40 px-5 py-4">
        <label className="block">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
            Display name
          </span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            maxLength={20}
            className="mt-1.5 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-display text-base text-slate-100 focus:border-amber-400 focus:outline-none disabled:opacity-50"
          />
        </label>
      </section>

      {/* Create section. */}
      <section className="rounded-md border-2 border-rose-500/60 bg-rose-950/20 px-5 py-5">
        <h2 className="font-display text-2xl font-bold text-rose-200">Host a room</h2>
        <p className="mt-1 text-sm text-slate-300">
          Picks a 4-character code and starts a fresh game. Share the URL
          with friends — they'll land directly in your room.
        </p>

        <label className="mt-4 block">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
            Bot seats ({botCount})
          </span>
          <input
            type="range"
            min={0}
            max={3}
            value={botCount}
            onChange={(e) => setBotCount(Number(e.target.value))}
            disabled={busy}
            className="mt-1.5 w-full"
          />
          <div className="flex justify-between font-mono text-[10px] uppercase tracking-[.14em] text-slate-500">
            <span>0 bots</span>
            <span>1</span>
            <span>2</span>
            <span>3</span>
          </div>
        </label>

        <button
          type="button"
          onClick={onCreate}
          disabled={busy}
          className="mt-4 w-full rounded border-2 border-rose-300 bg-gradient-to-b from-rose-400 to-rose-700 px-5 py-2.5 font-sans text-base font-bold uppercase tracking-[.05em] text-slate-950 transition-colors hover:from-rose-300 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create room →"}
        </button>
      </section>

      {/* Join section. */}
      <section className="rounded-md border border-slate-700 bg-slate-900/40 px-5 py-5">
        <h2 className="font-display text-xl font-bold text-slate-200">Join a room</h2>
        <p className="mt-1 text-sm text-slate-400">Got a 4-character code from a friend?</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <input
            type="text"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            disabled={busy}
            maxLength={4}
            placeholder="ABCD"
            className="w-32 rounded border border-slate-600 bg-slate-950 px-3 py-2 text-center font-mono text-xl font-bold uppercase tracking-[.3em] text-amber-200 focus:border-amber-400 focus:outline-none disabled:opacity-50"
          />
          <button
            type="button"
            onClick={onJoin}
            disabled={busy || joinCode.trim().length !== 4}
            className="flex-1 rounded border-2 border-slate-500 bg-slate-800 px-5 py-2.5 font-sans text-base font-bold uppercase tracking-[.05em] text-slate-100 transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? "Joining…" : "Join →"}
          </button>
        </div>
      </section>

      {error ? (
        <p className="rounded border border-rose-500/70 bg-rose-950/30 px-4 py-3 font-mono text-sm text-rose-200">
          {error}
        </p>
      ) : null}
    </div>
  );
}
