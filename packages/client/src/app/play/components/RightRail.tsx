"use client";

/**
 * v3 LogRail ("Tasting Notes") — right-side action log restyled as a
 * tasting-notes pour. Same content as EventLog (action history with
 * actor names in seat ink), reframed with bourbon-cellar chrome:
 * warm dark gradient bg, brass `Tasting Notes` heading, emerald LIVE
 * pill, dotted entry separators, log-in keyframe entry animation.
 *
 * Preserves `data-bb-zone="right-rail"` so the existing drag-mode
 * focus-dim CSS keeps masking the rail when the human is dragging
 * a hand card.
 */

import EventLog from "./EventLog";

export default function RightRail() {
  return (
    <aside
      data-bb-zone="right-rail"
      className="flex min-h-0 flex-col gap-2 overflow-hidden border-l border-[#3b2818] px-3 py-3"
      style={{
        gridArea: "log",
        background:
          "linear-gradient(180deg, rgba(20,14,8,.85), rgba(12,8,5,.85))",
      }}
    >
      <header className="flex items-center justify-between">
        <h2
          className="m-0 font-display text-[14px] font-semibold"
          style={{ color: "var(--ink-muted)" }}
        >
          Tasting Notes
        </h2>
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[#3b2818] px-2 py-px"
          style={{ background: "rgba(109,178,140,.10)" }}
        >
          <span
            aria-hidden
            className="h-1.5 w-1.5 rounded-full"
            style={{
              background: "var(--emerald)",
              boxShadow: "0 0 6px var(--emerald)",
            }}
          />
          <span
            className="font-mono uppercase tracking-[.14em]"
            style={{ color: "var(--emerald)", fontSize: 8.5 }}
          >
            live
          </span>
        </span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">
        <EventLog />
      </div>
    </aside>
  );
}
