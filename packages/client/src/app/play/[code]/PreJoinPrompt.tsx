"use client";

/**
 * Name-picker shown when a deep-link visitor arrives at
 * `/play/[code]` without a saved display name. Tiny, focused UI:
 * just enough to grab a handle before the socket opens.
 */

import { useState } from "react";

export default function PreJoinPrompt({
  code,
  onSubmit,
}: {
  code: string;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState("");

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;
    onSubmit(trimmed);
  };

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-16 text-slate-100">
      <div className="mx-auto max-w-md">
        <p className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-500">
          joining room
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-[.08em] text-amber-300">
          {code}
        </h1>
        <p className="mt-4 text-sm text-slate-300">
          Pick a display name. The host will see this on the seat chip
          when you claim a seat.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-6 flex flex-col gap-3"
        >
          <label className="block">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
              Display name
            </span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              maxLength={20}
              placeholder="e.g. Alice"
              className="mt-1.5 w-full rounded border border-slate-600 bg-slate-950 px-3 py-2 font-display text-base text-slate-100 focus:border-amber-400 focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={name.trim().length === 0}
            className="rounded border-2 border-amber-300 bg-gradient-to-b from-amber-300 to-amber-600 px-5 py-2.5 font-sans text-base font-bold uppercase tracking-[.05em] text-slate-950 transition-colors hover:from-amber-200 hover:to-amber-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Join →
          </button>
        </form>

        <a
          href="/multiplayer"
          className="mt-6 inline-block font-mono text-xs text-slate-400 hover:text-amber-300"
        >
          ← back to lobby
        </a>
      </div>
    </main>
  );
}
