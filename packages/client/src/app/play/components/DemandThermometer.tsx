"use client";

/**
 * v3 vertical demand thermometer — board chrome, not a HUD widget.
 *
 * Replaces the horizontal `DemandMeter` that lived in `GameTopBar`.
 * Occupies its own 96px column in the main grid between the Rivals
 * rail and the Stage area, spanning both rows so the liquid level
 * reads alongside both the rickhouse and the hand.
 *
 * Pulls `state.demand` from the game store via `GameBoard`; target
 * is currently hardcoded at 12 (the round-end ceiling). The bulb
 * is the reservoir and is always full — only the stem's liquid
 * column tracks `rolled / target`.
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
    yPct: 100 - (i / target) * 100,
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
    <aside
      aria-label="Round demand"
      data-bb-zone="demand"
      style={{
        gridArea: "demand",
        padding: "14px 10px",
        borderRadius: 12,
        border: "1px solid var(--rule)",
        background:
          "radial-gradient(80% 30% at 50% 0%, rgba(213,150,80,.10), transparent 70%)," +
          "radial-gradient(60% 30% at 50% 100%, rgba(213,150,80,.10), transparent 70%)," +
          "linear-gradient(180deg, rgba(26,18,11,.92), rgba(14,10,6,.95))",
        boxShadow:
          "inset 0 1px 0 rgba(240,201,112,.10), 0 4px 14px rgba(0,0,0,.4)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ textAlign: "center" }}>
        <div className="label-sm" style={{ letterSpacing: ".22em" }}>
          Demand
        </div>
        <div
          style={{
            marginTop: 4,
            fontFamily: "var(--font-display)",
            lineHeight: 1,
            textShadow: "0 0 12px rgba(240,201,112,.35)",
          }}
        >
          <span
            style={{ fontSize: 28, fontWeight: 700, color: "var(--gold)" }}
          >
            {rolled}
          </span>
          <span
            style={{ fontSize: 18, fontWeight: 700, color: "var(--mute)" }}
          >
            /{target}
          </span>
        </div>
        <div
          className="label-sm"
          style={{ fontSize: 8.5, color: "var(--mute)", marginTop: 2 }}
        >
          this round
        </div>
      </div>

      {/* Body — tube + tick column */}
      <div
        aria-hidden="true"
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 26px",
          gap: 6,
          flex: 1,
          minHeight: 200,
          padding: "8px 4px 0 4px",
        }}
      >
        {/* Tube column */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "stretch",
            minHeight: 0,
          }}
        >
          {/* Brass cap */}
          <div
            style={{
              width: 28,
              height: 8,
              margin: "0 auto",
              borderRadius: "6px 6px 2px 2px",
              background:
                "linear-gradient(180deg, #f0c970 0%, #c69d52 60%, #7a5630 100%)",
              boxShadow:
                "inset 0 1px 0 rgba(255,255,255,.4), 0 1px 0 rgba(0,0,0,.5)",
              border: "1px solid #5a3d20",
              zIndex: 2,
            }}
          />

          {/* Stem */}
          <div
            style={{
              position: "relative",
              flex: 1,
              width: 22,
              margin: "-1px auto -1px auto",
              background:
                "linear-gradient(90deg," +
                "rgba(0,0,0,.55) 0%," +
                "rgba(0,0,0,.15) 20%," +
                "rgba(255,255,255,.05) 50%," +
                "rgba(0,0,0,.15) 80%," +
                "rgba(0,0,0,.55) 100%)," +
                "linear-gradient(180deg, #0a0604, #15100a)",
              border: "1px solid #3b2818",
              borderTop: "none",
              borderBottom: "none",
              boxShadow:
                "inset 0 2px 6px rgba(0,0,0,.7), inset 0 -2px 6px rgba(0,0,0,.6)",
              overflow: "hidden",
            }}
          >
            {/* Liquid fill (bottom-anchored, animated top edge).
                We use top+bottom rather than height:% because the
                stem is a flex item whose height isn't a "definite"
                size for percent-height resolution on an absolutely
                positioned child — Chrome computes that height to
                0px. Anchoring with top+bottom resolves correctly
                and lets the transition ride the top edge as the
                liquid rises. */}
            <div
              className="bb-demand-fill"
              style={
                {
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${(1 - pct) * 100}%`,
                  bottom: 0,
                  background:
                    "linear-gradient(180deg," +
                    "rgba(240,201,112,.95) 0%," +
                    "rgba(213,150,80,.95) 35%," +
                    "rgba(176,106,56,.95) 100%)",
                  boxShadow:
                    "inset 0 8px 14px rgba(255,225,160,.35)," +
                    "inset 0 -8px 14px rgba(0,0,0,.35)," +
                    "0 0 14px rgba(240,201,112,.45)",
                  transition: "top 600ms cubic-bezier(.22, 1, .36, 1)",
                } as CSSProperties
              }
            >
              {/* Meniscus */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: 0,
                  height: 4,
                  background:
                    "linear-gradient(180deg, rgba(255,240,200,.85), rgba(240,201,112,0))",
                  filter: "blur(1px)",
                }}
              />
              {/* Pour shimmer */}
              <div
                className="pour"
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "repeating-linear-gradient(135deg," +
                    "rgba(255,255,255,.10) 0 6px," +
                    "rgba(255,255,255,0) 6px 14px)",
                  backgroundSize: "20px 20px",
                  opacity: 0.6,
                  mixBlendMode: "overlay",
                }}
              />
            </div>

            {/* Glass highlight (cylindrical curve fake) */}
            <div
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 3,
                width: 3,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.05))",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Bulb */}
          <div
            style={{
              position: "relative",
              width: 52,
              height: 52,
              margin: "-6px auto 0 auto",
              borderRadius: "50%",
              background:
                "radial-gradient(circle at 35% 32%," +
                "rgba(255,240,200,.6) 0%," +
                "rgba(240,201,112,.95) 18%," +
                "rgba(213,150,80,.95) 50%," +
                "rgba(120,60,28,1) 100%)",
              border: "1px solid #3b2818",
              boxShadow:
                "inset 0 -8px 18px rgba(0,0,0,.55)," +
                "inset 0 6px 14px rgba(255,240,200,.35)," +
                "0 0 18px rgba(240,201,112,.45)," +
                "0 4px 8px rgba(0,0,0,.6)",
            }}
          >
            {/* Specular highlight dot */}
            <div
              style={{
                position: "absolute",
                top: 8,
                left: 10,
                width: 8,
                height: 8,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle, rgba(255,255,255,.85), rgba(255,255,255,0) 70%)",
                filter: "blur(1px)",
              }}
            />
          </div>
        </div>

        {/* Tick column */}
        <div
          style={{
            position: "relative",
            height: "100%",
            paddingTop: 8,
            paddingBottom: 58,
          }}
        >
          {ticks.map((t) => {
            const ruleWidth = t.major ? 12 : 7;
            const ruleHeight = t.major ? 2 : 1;
            let ruleColor: string;
            let ruleShadow: string | undefined;
            let ruleOpacity: number | undefined;
            if (t.major && t.reached) {
              ruleColor = "var(--gold)";
              ruleShadow = "0 0 6px rgba(240,201,112,.55)";
            } else if (t.major) {
              ruleColor = "var(--brass)";
            } else if (t.reached) {
              ruleColor = "var(--brass)";
            } else {
              ruleColor = "var(--whisper)";
              ruleOpacity = 0.8;
            }
            return (
              <div
                key={t.i}
                style={{
                  position: "absolute",
                  top: `${t.yPct}%`,
                  left: 0,
                  right: 0,
                  transform: "translateY(-50%)",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  lineHeight: 1,
                }}
              >
                <span
                  style={{
                    display: "block",
                    width: ruleWidth,
                    height: ruleHeight,
                    background: ruleColor,
                    boxShadow: ruleShadow,
                    opacity: ruleOpacity,
                  }}
                />
                {t.major ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 9,
                      fontWeight: 700,
                      letterSpacing: ".06em",
                      lineHeight: 1,
                      color: t.reached ? "var(--gold)" : "var(--mute)",
                    }}
                  >
                    {t.i}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          marginTop: 8,
          paddingTop: 8,
          borderTop: "1px dotted var(--rule)",
          textAlign: "center",
        }}
      >
        <div
          className="label-sm"
          style={{ fontSize: 8.5, color: "var(--mute)" }}
        >
          Appetite
        </div>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: ".14em",
            textTransform: "uppercase",
            color: appetiteColor,
            marginTop: 2,
          }}
        >
          {appetiteLabel}
        </div>
      </div>
    </aside>
  );
}
