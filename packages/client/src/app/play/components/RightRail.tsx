"use client";

/**
 * Right rail — action log only.
 *
 * Player ("baron") status is rendered inline in each player's rickhouse
 * panel (see RickhouseRow), so the tabbed sidebar collapses down to a
 * single panel: the live action log so the user can follow what bots are
 * doing each turn.
 */

import EventLog from "./EventLog";

export default function RightRail() {
  return (
    <aside data-bb-zone="right-rail" className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
      <div className="flex items-baseline justify-between border-b border-slate-800 px-3 py-2">
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-amber-200">
          Action log
        </h2>
        <span className="font-mono text-[9px] uppercase tracking-[.12em] text-slate-500">
          live
        </span>
      </div>
      {/* EventLog owns its own scroll viewport (capped at 60vh on narrow
          layouts; flex-1 fills the rail on wide layouts). */}
      <div className="flex min-h-0 flex-1 flex-col">
        <EventLog />
      </div>
    </aside>
  );
}
