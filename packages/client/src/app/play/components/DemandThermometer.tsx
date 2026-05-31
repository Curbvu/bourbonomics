"use client";

/**
 * Horizontal demand bar — replaces the v3 vertical thermometer.
 *
 * Lives in a full-width row above the main play grid. Reads like a
 * brass pressure gauge laid on its side: amber liquid fill, numbered
 * ticks, and the table's "appetite" status on the right.
 *
 * Reuses the same appetite thresholds (Cold cellar / Warming / Hot
 * pour / Sold out) and accent colors as the old vertical version so
 * the spoken language ("the table is hot") stays consistent.
 *
 * Filename stays `DemandThermometer.tsx` and the default export keeps
 * the `DemandThermometer` name so callers (`GameBoard`) don't have to
 * re-thread imports — the body just changed orientation.
 *
 * Stamps `data-bb-zone="demand"` on the root so the existing tutorial
 * Spotlight anchors keep working.
 */

import type { CSSProperties } from "react";

type Props = {
  rolled: number;
  target: number;
};

export default function DemandThermometer({ rolled, target }: Props) {
  const pct = Math.max(0, Math.min(1, rolled / target));

  const ticks = Array.from({ length: target + 1 }, (_, i) => ({
    i,
    major: i === 0 || i === target || i % 4 === 0,
    xPct: (i / target) * 100,
    reached: i <= rolled,
  }));

  let appetiteLabel: string;
  let appetiteColor: string;
  if (pct < 0.25) {
    appetiteLabel = "Cold cellar";
    appetiteColor = "var(--ink-muted)";
  } else if (pct < 0.5) {
    appetiteLabel = "Warming";
    appetiteColor = "var(--emerald)";
  } else if (pct < 0.8) {
    appetiteLabel = "Hot pour";
    appetiteColor = "var(--gold)";
  } else {
    appetiteLabel = "Sold out";
    appetiteColor = "var(--rose)";
  }

  return (
    <div
      aria-label="Round demand"
      data-bb-zone="demand"
      style={{
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "8px 18px",
        borderBottom: "1px solid var(--rule)",
        background:
          "radial-gradient(60% 200% at 18% 50%, rgba(213,150,80,.08), transparent 70%)," +
          "linear-gradient(180deg, rgba(20,14,8,.9), rgba(12,8,5,.92))",
      }}
    >
      {/* Readout — DEMAND label + big numeric + this round */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 9,
          flexShrink: 0,
        }}
      >
        <span
          className="label-sm"
          style={{ color: "var(--brass)", letterSpacing: ".22em" }}
        >
          Demand
        </span>
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 700,
            fontSize: 26,
            lineHeight: 1,
            color: "var(--gold)",
            textShadow: "0 0 12px rgba(240,201,112,.3)",
          }}
        >
          {rolled}
          <span style={{ color: "var(--mute)", fontSize: 17, fontWeight: 500 }}>
            /{target}
          </span>
        </span>
        <span
          className="label-sm"
          style={{ fontSize: 12, color: "var(--mute)" }}
        >
          this round
        </span>
      </div>

      {/* Tube — flex:1 so it claims the leftover width */}
      <div
        aria-hidden
        style={{
          position: "relative",
          flex: 1,
          minWidth: 0,
          height: 34,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        {/* Pill rail */}
        <div
          style={{
            position: "relative",
            height: 16,
            borderRadius: 999,
            background: "linear-gradient(180deg, #0a0604, #15100a)",
            border: "1px solid #3b2818",
            boxShadow: "inset 0 2px 5px rgba(0,0,0,.7)",
            overflow: "hidden",
          }}
        >
          {/* Liquid fill */}
          <div
            className="bb-demand-fill"
            style={
              {
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                width: `${pct * 100}%`,
                background:
                  "linear-gradient(90deg," +
                  "rgba(176,106,56,.95) 0%," +
                  "rgba(213,150,80,.95) 60%," +
                  "rgba(240,201,112,.98) 100%)",
                boxShadow:
                  "inset 0 6px 10px rgba(255,225,160,.3)," +
                  "inset 0 -6px 10px rgba(0,0,0,.3)," +
                  "0 0 14px rgba(240,201,112,.45)",
                transition: "width 600ms cubic-bezier(.22, 1, .36, 1)",
              } as CSSProperties
            }
          >
            {/* Pour shimmer */}
            <div
              className="pour"
              aria-hidden
              style={{
                position: "absolute",
                inset: 0,
                background:
                  "repeating-linear-gradient(135deg," +
                  "rgba(255,255,255,.12) 0 6px," +
                  "rgba(255,255,255,0) 6px 14px)",
                backgroundSize: "20px 20px",
                opacity: 0.55,
                mixBlendMode: "overlay",
              }}
            />
            {/* Leading meniscus on the right edge */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                right: 0,
                width: 3,
                background:
                  "linear-gradient(90deg, rgba(240,201,112,0), rgba(255,240,200,.9))",
                filter: "blur(.5px)",
              }}
            />
          </div>
        </div>

        {/* Tick row */}
        <div
          style={{ position: "relative", height: 12, marginTop: 2 }}
        >
          {ticks.map(({ i, major, xPct, reached }) => {
            let ruleColor: string;
            if (major && reached) ruleColor = "var(--gold)";
            else if (major) ruleColor = "var(--brass)";
            else if (reached) ruleColor = "var(--brass)";
            else ruleColor = "var(--whisper)";
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: `${xPct}%`,
                  transform: "translateX(-50%)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 1,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    width: major ? 2 : 1,
                    height: major ? 6 : 3,
                    background: ruleColor,
                    boxShadow: reached
                      ? "0 0 5px rgba(240,201,112,.5)"
                      : undefined,
                  }}
                />
                {major ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10.5,
                      fontWeight: 700,
                      lineHeight: 1,
                      color: reached ? "var(--gold)" : "var(--mute)",
                    }}
                  >
                    {i}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Appetite — context label on the right */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          className="label-sm"
          style={{ fontSize: 12, color: "var(--mute)" }}
        >
          Appetite
        </span>
        <span
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: appetiteColor,
          }}
        >
          {appetiteLabel}
        </span>
      </div>
    </div>
  );
}
