"use client";

/**
 * Right rail — tabbed sidebar to the right of the rickhouse grid.
 *
 * Three tabs:
 *   Market — bourbon-deck doomsday, market conveyor, supply count
 *   Barons — players' status (OpponentList)
 *   Log    — recent engine actions (EventLog)
 */

import { useState } from "react";

import EventLog from "./EventLog";
import MarketPanel from "./MarketPanel";
import OpponentList from "./OpponentList";

type Tab = "market" | "barons" | "log";

const TABS: { id: Tab; label: string }[] = [
  { id: "market", label: "market" },
  { id: "barons", label: "barons" },
  { id: "log", label: "log" },
];

export default function RightRail() {
  const [tab, setTab] = useState<Tab>("market");
  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
      <div
        role="tablist"
        aria-label="Side panel"
        className="flex border-b border-slate-800"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={[
                "px-[18px] py-3 font-mono text-[10.5px] font-semibold uppercase tracking-[.18em] transition-colors",
                "border-b-2 cursor-pointer",
                active
                  ? "border-amber-500 bg-amber-700/[0.15] text-amber-200"
                  : "border-transparent text-slate-500 hover:bg-slate-800/40 hover:text-slate-300",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
        <span className="flex-1 border-b-2 border-transparent" aria-hidden />
      </div>

      <div role="tabpanel" aria-label={tab} className="flex-1 overflow-y-auto">
        {tab === "market" ? <MarketPanel /> : null}
        {tab === "barons" ? <OpponentList /> : null}
        {tab === "log" ? <EventLog /> : null}
      </div>
    </aside>
  );
}
