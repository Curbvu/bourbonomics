"use client";

/**
 * Right rail — tabbed sidebar to the right of the rickhouse grid.
 *
 * Spec: design_handoff_bourbon_blend/README.md §RightRail.
 *
 * Four tabs:
 *   Market — demand bar, resource piles, business decks (MarketPanel body)
 *   Active — implemented investments (ActiveInvestmentsPanel body)
 *   Barons — non-human players' status (OpponentList body)
 *   Log    — recent game events (EventLog body)
 *
 * The container provides the rounded panel chrome; each tab body component
 * renders just its own contents.
 */

import { useEffect, useState } from "react";

import ActiveInvestmentsPanel from "./ActiveInvestmentsPanel";
import EventLog from "./EventLog";
import MarketPanel from "./MarketPanel";
import OpponentList from "./OpponentList";
import { useGameStore } from "@/lib/store/gameStore";

type Tab = "market" | "active" | "barons" | "log";

const TABS: { id: Tab; label: string }[] = [
  { id: "market", label: "market" },
  { id: "active", label: "active" },
  { id: "barons", label: "barons" },
  { id: "log", label: "log" },
];

export default function RightRail() {
  const [tab, setTab] = useState<Tab>("market");
  // Surface the active-investments count on the tab so the player has
  // an at-a-glance reminder without switching panels.
  const state = useGameStore((s) => s.state);
  const humanId = state?.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  const activeCount = humanId
    ? state!.players[humanId].investments.filter((i) => i.status === "active")
        .length
    : 0;

  // Bump to the Active tab the first time an investment lands so the
  // player notices the panel exists.
  const seenActive = activeCount > 0;
  useEffect(() => {
    if (seenActive && tab === "market" && activeCount === 1) {
      setTab("active");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seenActive]);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900/70">
      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Side panel"
        className="flex border-b border-slate-800"
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          const showCount = t.id === "active" && activeCount > 0;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              onClick={() => setTab(t.id)}
              className={[
                "flex items-center gap-1.5 px-[14px] py-3 font-mono text-[10.5px] font-semibold uppercase tracking-[.18em] transition-colors",
                "border-b-2 cursor-pointer",
                active
                  ? "border-amber-500 bg-amber-700/[0.15] text-amber-200"
                  : "border-transparent text-slate-500 hover:bg-slate-800/40 hover:text-slate-300",
              ].join(" ")}
            >
              <span>{t.label}</span>
              {showCount ? (
                <span
                  className={[
                    "rounded-full px-1.5 py-px text-[9px] font-bold tabular-nums",
                    active
                      ? "bg-amber-300 text-slate-950"
                      : "bg-emerald-500/30 text-emerald-200",
                  ].join(" ")}
                >
                  {activeCount}
                </span>
              ) : null}
            </button>
          );
        })}
        <span className="flex-1 border-b-2 border-transparent" aria-hidden />
      </div>

      {/* Tab body — only the active panel mounts to keep DOM lean */}
      <div
        role="tabpanel"
        aria-label={tab}
        className="flex-1 overflow-y-auto"
      >
        {tab === "market" ? <MarketPanel /> : null}
        {tab === "active" ? <ActiveInvestmentsPanel /> : null}
        {tab === "barons" ? <OpponentList /> : null}
        {tab === "log" ? <EventLog /> : null}
      </div>
    </aside>
  );
}
