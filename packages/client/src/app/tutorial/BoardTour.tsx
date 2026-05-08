"use client";

/**
 * Phase 2 — board introduction. Six tooltips, each spotlighting one
 * zone of the live game board with body copy. No interaction yet —
 * Continue button only. Each tooltip dims everything else; Skip jumps
 * the caller (TutorialController) ahead to gameplay.
 */

import { useState } from "react";
import { TUTORIAL_HUMAN_ID } from "@bourbonomics/engine";
import { RichText, SpotlightLayer } from "./Spotlight";
import type { SpotlightTarget } from "./types";

interface BoardTourProps {
  onDone: () => void;
  onQuit: () => void;
}

interface TourStop {
  id: string;
  title: string;
  body: string;
  spotlight: SpotlightTarget;
}

const STOPS: TourStop[] = [
  {
    id: "rickhouse",
    title: "Your Rickhouse",
    body: "Four slots. This is where bourbon ages. You've already drafted two recipes — Backroad Batch and Heritage Reserve — sitting **ready** in your slots, waiting for ingredients.",
    spotlight: { kind: "rickhouse-row", ownerId: TUTORIAL_HUMAN_ID },
  },
  {
    id: "hand",
    title: "Your Hand",
    body: "Eight cards a round. **Casks**, **grains**, and **capital**. You'll spend these to build, age, and sell.",
    spotlight: { kind: "hand-cards", cardIds: [] },
  },
  {
    id: "market",
    title: "The Market Conveyor",
    body: "Ten cards for sale. Buy with cards from your hand. **Capital cards pay their face value.**",
    spotlight: { kind: "market-row" },
  },
  {
    id: "demand",
    title: "The Demand Track",
    body: "Higher demand = bigger payouts. It rises slowly each round, and **drops every time someone sells.**",
    spotlight: { kind: "demand" },
  },
  {
    id: "supply",
    title: "The Bourbon Supply",
    body: "When this runs out, the game ends. Don't worry about it yet — just know the clock is ticking.",
    spotlight: { kind: "supply" },
  },
  {
    id: "reputation",
    title: "Your Reputation",
    body: "This is your score. **Get it highest. That's the whole game.**",
    spotlight: { kind: "reputation" },
  },
];

export default function BoardTour({ onDone, onQuit }: BoardTourProps) {
  const [stopIdx, setStopIdx] = useState(0);
  const stop = STOPS[stopIdx]!;

  const advance = () => {
    if (stopIdx + 1 >= STOPS.length) onDone();
    else setStopIdx((i) => i + 1);
  };

  return (
    <>
      <SpotlightLayer target={stop.spotlight} />
      <div className="pointer-events-auto fixed inset-x-0 bottom-12 z-50 mx-auto w-full max-w-md px-6">
        <div className="rounded-xl border-2 border-amber-700/60 bg-slate-900/95 p-5 shadow-[0_8px_40px_rgba(0,0,0,.65)]">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[.18em] text-amber-300">
            <span>Tour · {stopIdx + 1} / {STOPS.length}</span>
            <button
              type="button"
              onClick={onQuit}
              className="text-slate-500 hover:text-amber-200"
            >
              Quit to menu ↵
            </button>
          </div>
          <h2 className="mt-2 font-display text-2xl font-bold text-amber-100">{stop.title}</h2>
          <RichText className="mt-3 text-sm leading-relaxed text-slate-200">{stop.body}</RichText>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={advance}
              className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] transition hover:from-amber-200 hover:to-amber-400"
            >
              {stopIdx + 1 === STOPS.length ? "Start playing" : "Continue ↵"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
