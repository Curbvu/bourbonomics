"use client";

/**
 * Slim banner above the GameBoard when in a multi-player room.
 * Shows the room code and a click-to-copy share link, plus a
 * connection-status pill so dropouts surface immediately.
 */

import { useState } from "react";
import { useGameStore } from "@/lib/store/game";

export default function RoomBanner({ code }: { code: string }) {
  const { multiplayerStatus, leaveMultiplayer } = useGameStore();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/play/${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard might be denied (e.g. insecure origin); fall back
      // to selection prompt.
      window.prompt("Copy this URL:", url);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 border-b border-amber-800/40 bg-gradient-to-r from-amber-950/40 via-slate-950 to-rose-950/30 px-[18px] py-1.5">
      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[.18em] text-rose-300">
          Room
        </span>
        <span className="font-display text-xl font-bold tabular-nums tracking-[0.2em] text-amber-200">
          {code}
        </span>
        <button
          type="button"
          onClick={onCopy}
          className="rounded border border-amber-500/60 bg-amber-900/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.14em] text-amber-200 transition-colors hover:border-amber-300 hover:bg-amber-800/40"
        >
          {copied ? "copied!" : "copy share link"}
        </button>
      </div>
      <div className="flex items-center gap-3">
        <StatusPill status={multiplayerStatus} />
        <button
          type="button"
          onClick={leaveMultiplayer}
          className="font-mono text-[10px] uppercase tracking-[.14em] text-slate-400 hover:text-rose-300"
        >
          leave
        </button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const tone =
    status === "open"
      ? "border-emerald-500/70 text-emerald-300"
      : status === "connecting"
        ? "border-amber-500/70 text-amber-300"
        : status === "closed" || status === "error"
          ? "border-rose-500/70 text-rose-300"
          : "border-slate-600 text-slate-400";
  return (
    <span
      className={`rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.14em] ${tone}`}
    >
      {status}
    </span>
  );
}
