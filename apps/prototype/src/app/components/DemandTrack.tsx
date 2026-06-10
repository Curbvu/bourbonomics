"use client";

import { CONFIG } from "@bourbonomics/prototype-engine";

/**
 * Horizontal demand LEVEL track (0–DEMAND_CAP) — the matrix demand axis.
 * Older bourbon + higher level pay more. The level rises on a global trend
 * and is cooled by market flooding (see the flood meter). Borrows the live
 * game's warm fill + tick + appetite-label look.
 */

function appetite(demand: number): { label: string; color: string } {
  const cap = CONFIG.DEMAND_CAP;
  const pct = demand / cap;
  if (demand <= 0) return { label: "Cold cellar", color: "var(--ink-muted)" };
  if (pct < 0.34) return { label: "Cooling", color: "var(--ink-muted)" };
  if (pct < 0.59) return { label: "Warming", color: "var(--emerald)" };
  if (pct < 0.84) return { label: "Hot pour", color: "var(--gold)" };
  return { label: "Sold out", color: "var(--rose)" };
}

export default function DemandTrack({ demand }: { demand: number }) {
  const cap = CONFIG.DEMAND_CAP;
  const pct = Math.max(0, Math.min(1, demand / cap));
  const app = appetite(demand);

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-end justify-between">
        <span
          className="font-display font-bold leading-none"
          style={{ fontSize: 30, color: app.color }}
        >
          {demand}
          <span className="ml-1 text-[14px] text-[var(--mute)]">/ {cap}</span>
        </span>
        <span
          className="font-mono uppercase tracking-[.16em]"
          style={{ fontSize: 11, color: app.color }}
        >
          {app.label}
        </span>
      </div>

      <div className="relative h-3 w-full overflow-hidden rounded-full border border-[var(--rule)] bg-[#160d06]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct * 100}%`,
            background:
              "linear-gradient(90deg, rgba(176,106,56,.95) 0%, rgba(213,150,80,.95) 60%, rgba(240,201,112,.98) 100%)",
            boxShadow:
              "inset 0 4px 8px rgba(255,225,160,.3), inset 0 -4px 8px rgba(0,0,0,.3), 0 0 12px rgba(240,201,112,.4)",
            transition: "width 600ms cubic-bezier(.22,1,.36,1)",
          }}
        />
        {/* tick marks */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-between px-[3px]">
          {Array.from({ length: cap + 1 }, (_, i) => {
            const major = i % 3 === 0;
            const reached = i <= demand;
            return (
              <span
                key={i}
                style={{
                  width: major ? 2 : 1,
                  height: major ? 7 : 4,
                  background: reached
                    ? major
                      ? "var(--gold)"
                      : "var(--brass)"
                    : "var(--whisper)",
                  boxShadow: reached ? "0 0 4px rgba(240,201,112,.5)" : "none",
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
