"use client";

/**
 * Phase 1 — the cinematic intro. Establishes the win condition before
 * any mechanics are introduced.
 *
 * Sequence:
 *   1. Title fades in (~600ms).
 *   2. Centered objective card fades in (~700ms hold).
 *   3. Three "how" lines stagger in 600ms apart.
 *   4. Stakes line fades in (~800ms hold).
 *   5. "Begin" button appears.
 *
 * Skip button is visible from frame 1. Total scripted runtime ~9.5s
 * which fits comfortably under the 12s ceiling in the spec.
 */

import { useEffect, useState } from "react";

interface IntroSequenceProps {
  onDone: () => void;
}

const STAGES = [
  { delay: 0, key: "title" },
  { delay: 700, key: "objective" },
  { delay: 1500, key: "step1" },
  { delay: 2100, key: "step2" },
  { delay: 2700, key: "step3" },
  { delay: 3700, key: "stakes" },
  { delay: 4900, key: "begin" },
] as const;

export default function IntroSequence({ onDone }: IntroSequenceProps) {
  const [reached, setReached] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timeouts: number[] = [];
    for (const stage of STAGES) {
      timeouts.push(
        window.setTimeout(() => {
          setReached((prev) => {
            const next = new Set(prev);
            next.add(stage.key);
            return next;
          });
        }, stage.delay),
      );
    }
    return () => {
      for (const t of timeouts) window.clearTimeout(t);
    };
  }, []);

  const has = (key: string) => reached.has(key);

  return (
    // Fixed/inset-0 so the intro overlays the live GameBoard rendered
    // by the tutorial page wrapper. Without `fixed` the intro flows
    // inline after the board and gets clipped by the page's
    // `h-screen overflow-hidden` container — invisible to the player.
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-slate-950 text-slate-100"
      style={{
        backgroundImage: `
          radial-gradient(900px 500px at 50% 20%, rgba(120,53,15,.45), transparent 60%),
          radial-gradient(1100px 600px at 50% 100%, rgba(0,0,0,.85), transparent 60%)
        `,
      }}
    >
      {/* Skip control — top-right, visible from frame 1 per spec. */}
      <button
        type="button"
        onClick={onDone}
        className="absolute right-6 top-6 font-mono text-[11px] uppercase tracking-[.18em] text-slate-500 transition hover:text-amber-200"
      >
        Skip ↵
      </button>

      {/* Subtle "dust mote" embers — light flecks drifting upward. */}
      <Embers />

      <div className="relative z-10 mx-auto flex w-full max-w-2xl flex-col items-center px-6 text-center">
        <h1
          className={[
            "font-display text-6xl font-bold tracking-tight transition-all duration-700 sm:text-7xl",
            has("title") ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
            "text-amber-300 drop-shadow-[0_3px_10px_rgba(0,0,0,.65)]",
          ].join(" ")}
        >
          Bourbonomics
        </h1>

        <div
          className={[
            "mt-12 max-w-xl rounded-xl border-2 border-amber-700/60 bg-slate-900/70 px-8 py-6 shadow-[0_8px_40px_rgba(180,83,9,.30)] backdrop-blur transition-all duration-700",
            has("objective") ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          ].join(" ")}
        >
          <div className="font-mono text-[11px] uppercase tracking-[.20em] text-amber-300">
            Your objective
          </div>
          <div className="mt-3 font-display text-2xl font-bold leading-tight text-amber-100 sm:text-3xl">
            Become the most renowned bourbon distillery in the world.
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center gap-3 font-display text-xl text-slate-200 sm:text-2xl">
          <Line shown={has("step1")}>Build recipes.</Line>
          <Line shown={has("step2")}>Age them for years.</Line>
          <Line shown={has("step3")}>Sell when the market is hot.</Line>
        </div>

        <div
          className={[
            "mt-12 font-display text-lg font-medium leading-snug text-amber-200/90 sm:text-xl",
            "transition-all duration-1000",
            has("stakes") ? "opacity-100" : "opacity-0",
          ].join(" ")}
        >
          When the bourbon supply runs dry,
          <br />
          the most renowned distillery wins.
        </div>

        <div
          className={[
            "mt-14 transition-all duration-700",
            has("begin") ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
          ].join(" ")}
        >
          <button
            type="button"
            onClick={onDone}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-8 py-3 font-display text-base font-bold uppercase tracking-[.10em] text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,.30),inset_0_1px_0_rgba(255,255,255,.25),0_8px_28px_rgba(180,83,9,.40)] transition hover:from-amber-200 hover:to-amber-400"
          >
            Begin ↵
          </button>
        </div>
      </div>
    </div>
  );
}

function Line({ shown, children }: { shown: boolean; children: React.ReactNode }) {
  return (
    <div
      className={[
        "transition-all duration-700",
        shown ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      ].join(" ")}
    >
      {children}
    </div>
  );
}

function Embers() {
  // Cheap CSS-only particle bed — eight floating amber motes.
  // Positioned at varied left% / animation-delay so they read as a
  // gentle field rather than a pulsing line.
  const motes = [
    { left: "8%", delay: 0 },
    { left: "18%", delay: 1.4 },
    { left: "29%", delay: 0.7 },
    { left: "42%", delay: 2.2 },
    { left: "57%", delay: 1.0 },
    { left: "68%", delay: 2.8 },
    { left: "79%", delay: 0.4 },
    { left: "90%", delay: 1.7 },
  ];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {motes.map((m, i) => (
        <span
          key={i}
          className="ember absolute bottom-[-8px] h-[6px] w-[6px] rounded-full bg-amber-300/70"
          style={{
            left: m.left,
            animationDelay: `${m.delay}s`,
          }}
        />
      ))}
      <style>{`
        @keyframes ember-rise {
          0%   { transform: translateY(0) translateX(0);  opacity: 0; }
          15%  { opacity: 0.85; }
          100% { transform: translateY(-110vh) translateX(20px); opacity: 0; }
        }
        .ember {
          animation: ember-rise 9s linear infinite;
          box-shadow: 0 0 8px rgba(251,191,36,0.6);
        }
      `}</style>
    </div>
  );
}
