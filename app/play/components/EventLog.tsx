"use client";

import { useGameStore } from "@/lib/store/gameStore";

export default function EventLog() {
  const state = useGameStore((s) => s.state)!;
  // Show the last ~40 events in reverse-chronological order.
  const recent = state.log.slice(-40).reverse();
  return (
    <aside
      className="rounded-md border border-slate-800 bg-slate-900/60 p-3"
      aria-label="Game log"
    >
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Game log
      </h2>
      <ol
        aria-live="polite"
        aria-relevant="additions"
        className="max-h-80 space-y-1 overflow-y-auto pr-1 text-xs"
      >
        {recent.length === 0 ? (
          <li className="italic text-slate-500">No events yet.</li>
        ) : (
          recent.map((e) => (
            <li
              key={e.at}
              className={`rounded px-2 py-1 ${
                e.kind.startsWith("error:")
                  ? "bg-rose-950/40 text-rose-200"
                  : "text-slate-300"
              }`}
            >
              <span className="mr-1 text-slate-500">[{e.round}·{e.phase}]</span>
              <span className="font-mono">{e.kind}</span>
              <LogDetails data={e.data} />
            </li>
          ))
        )}
      </ol>
    </aside>
  );
}

function LogDetails({ data }: { data: Record<string, unknown> }) {
  const summary = typeof data.summary === "string" ? data.summary : null;
  if (summary) return <span className="text-slate-400"> — {summary}</span>;
  const parts: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === "playerId") continue;
    if (typeof v === "number" || typeof v === "string" || typeof v === "boolean") {
      parts.push(`${k}=${v}`);
    }
  }
  if (parts.length === 0) return null;
  return <span className="text-slate-500"> · {parts.slice(0, 4).join(" ")}</span>;
}
