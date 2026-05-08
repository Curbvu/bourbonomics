"use client";

/**
 * Phase 2 — board introduction. Six tooltips, each spotlighting one
 * zone of the board with body copy. No interaction yet — Continue
 * button only. Each tooltip dims everything else; Skip jumps the
 * caller (TutorialApp) ahead to gameplay.
 */

import { useState } from "react";
import type { GameState } from "@bourbonomics/engine";
import { TUTORIAL_HUMAN_ID } from "@bourbonomics/engine";
import TutorialBoard from "./TutorialBoard";
import type { SpotlightTarget } from "./types";

interface BoardTourProps {
  state: GameState;
  onDone: () => void;
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
    spotlight: { kind: "hand-cards", cardIds: [] }, // will fill with all hand
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

export default function BoardTour({ state, onDone }: BoardTourProps) {
  const [stopIdx, setStopIdx] = useState(0);
  const stop = STOPS[stopIdx]!;

  // Inject all hand card ids into the hand-cards spotlight on the fly.
  const liveSpotlight: SpotlightTarget = (() => {
    if (stop.spotlight.kind !== "hand-cards") return stop.spotlight;
    const human = state.players.find((p) => p.id === TUTORIAL_HUMAN_ID);
    return { kind: "hand-cards", cardIds: human?.hand.map((c) => c.id) ?? [] };
  })();

  const advance = () => {
    if (stopIdx + 1 >= STOPS.length) onDone();
    else setStopIdx((i) => i + 1);
  };

  return (
    <main className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-6 py-3">
        <h1 className="font-display text-xl font-bold tracking-tight text-amber-300">
          Bourbonomics · Tutorial
        </h1>
        <button
          type="button"
          onClick={onDone}
          className="font-mono text-[11px] uppercase tracking-[.18em] text-slate-500 hover:text-amber-200"
        >
          Skip tour ↵
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <TutorialBoard
          state={state}
          spotlight={liveSpotlight}
          awaitingAction={false}
          onTryAction={() => {
            /* tour mode — no actions */
          }}
          mode={{ kind: "idle" }}
          setMode={() => {
            /* tour mode — no actions */
          }}
          lastSale={null}
          lastMake={null}
        />

        {/* Dim overlay everywhere — the spotlight cuts through via
            ring/shadow on the targeted element. */}
        <div className="pointer-events-none absolute inset-0 bg-slate-950/55" />

        <TourCard
          title={stop.title}
          body={stop.body}
          step={stopIdx + 1}
          total={STOPS.length}
          onContinue={advance}
        />
      </div>
    </main>
  );
}

function TourCard({
  title,
  body,
  step,
  total,
  onContinue,
}: {
  title: string;
  body: string;
  step: number;
  total: number;
  onContinue: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute inset-x-0 bottom-32 mx-auto w-full max-w-md px-6">
      <div className="rounded-xl border-2 border-amber-700/60 bg-slate-900/95 p-5 shadow-[0_8px_40px_rgba(0,0,0,.65)]">
        <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[.18em] text-amber-300">
          <span>Tour · {step} / {total}</span>
          <span className="text-slate-500">Press ↵ to continue</span>
        </div>
        <h2 className="mt-2 font-display text-2xl font-bold text-amber-100">{title}</h2>
        <RichText className="mt-3 text-sm leading-relaxed text-slate-200">{body}</RichText>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-2 font-mono text-[11px] uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] transition hover:from-amber-200 hover:to-amber-400"
          >
            {step === total ? "Start playing" : "Continue ↵"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Light-weight markdown-ish renderer: only handles **bold** spans.
 * Everything else passes through verbatim. Beat copy uses **word**
 * sparingly so this is sufficient.
 */
export function RichText({ children, className }: { children: string; className?: string }) {
  const parts: { text: string; bold: boolean }[] = [];
  const re = /\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(children)) !== null) {
    if (m.index > last) parts.push({ text: children.slice(last, m.index), bold: false });
    parts.push({ text: m[1]!, bold: true });
    last = m.index + m[0].length;
  }
  if (last < children.length) parts.push({ text: children.slice(last), bold: false });
  return (
    <p className={className}>
      {parts.map((p, i) =>
        p.bold ? (
          <strong key={i} className="font-semibold text-amber-100">
            {p.text}
          </strong>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </p>
  );
}
