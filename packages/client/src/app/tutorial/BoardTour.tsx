"use client";

/**
 * Phase 2 — board introduction. Six tooltips, each spotlighting one
 * zone of the live game board with body copy. No interaction yet —
 * Continue button only. Each tooltip dims everything else; Skip jumps
 * the caller (TutorialController) ahead to gameplay.
 */

import { useEffect, useState } from "react";
import { TUTORIAL_HUMAN_ID } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";
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
    // Framing card — no spotlight, full dim, sets up the next 6 stops
    // as a guided board walkthrough. Dismissible via Continue, like
    // every other stop.
    id: "tour-intro",
    title: "Quick board tour",
    body: "We're going to walk you through the board.",
    spotlight: { kind: "none" },
  },
  {
    id: "rickhouse",
    title: "Your Rickhouse",
    body: "Four slots. This is where bourbon ages. You've already drafted two recipes — Backroad Batch and Heritage Reserve — sitting **ready** in your slots, waiting for resources.",
    spotlight: { kind: "rickhouse-row", ownerId: TUTORIAL_HUMAN_ID },
  },
  {
    id: "hand",
    title: "Your Hand",
    body: "Eight cards a round. **Casks**, **corn**, **grains** (rye / barley / wheat), and **Labor**. Resources build barrels; Labor cards age them or stretch your spending power.",
    spotlight: { kind: "hand-cards", cardIds: [] },
  },
  {
    id: "market",
    title: "The Market",
    body: "Ten cards for sale. Buy with your **reputation** — Labor cards from hand can supplement rep on each purchase (Cooper +2 on resources, Marketing +2 on ops, Generic +1 anywhere).",
    spotlight: { kind: "market-row" },
  },
  {
    id: "demand",
    title: "The Demand Track",
    body: "Higher demand = bigger payouts. **You roll 2 dice to start each turn — beat the current demand and it ticks up by 1.** It **drops every time someone sells.**",
    spotlight: { kind: "demand" },
  },
  {
    id: "supply",
    title: "The Bourbon Supply",
    body: "More bourbon recipes live in this deck. Pay rep (1 for a blind draw; 1/1/2/3/4 by tier for a face-up bill) to draw a new mash bill into an open slot. Generic Labor cards from your hand stretch the rep. **When the deck runs dry, the game ends.**",
    spotlight: { kind: "supply" },
  },
  {
    id: "reputation",
    title: "Your Reputation",
    body: "Reputation is the score. You earn it by **selling bourbon** — the rarer the recipe, the longer it ages, and the higher the demand at sale time, the more reputation you earn. **Get the highest reputation to win the game.**",
    spotlight: { kind: "reputation" },
  },
  {
    // Closing card — bridges the board tour into live gameplay. No
    // spotlight (full dim) so it reads as a chapter card rather than a
    // zone callout. Continue (rendered as "Start playing" for the last
    // stop) hands off to the play phase.
    id: "play-prelude",
    title: "How you play",
    body: "Make bourbon, age bourbon, then sell it for reputation. The distillery with the most reputation when all the bourbon is gone is the winner.",
    spotlight: { kind: "none" },
  },
];

export default function BoardTour({ onDone, onQuit }: BoardTourProps) {
  const { setTutorialSpotlight } = useGameStore();
  const [stopIdx, setStopIdx] = useState(0);
  const stop = STOPS[stopIdx]!;

  // Publish the active spotlight to the store so board components can
  // react (matches the TutorialController convention). Cleared on
  // unmount when the tour hands off to play.
  useEffect(() => {
    setTutorialSpotlight(stop.spotlight);
    return () => setTutorialSpotlight(null);
  }, [stop.spotlight, setTutorialSpotlight]);

  const advance = () => {
    if (stopIdx + 1 >= STOPS.length) onDone();
    else setStopIdx((i) => i + 1);
  };

  // Title-card stops (no spotlight target) get a flat full-screen dim
  // so the modal pops as an interstitial. SpotlightLayer renders
  // nothing for `kind: "none"` — we'd otherwise be overlaying a modal
  // on a fully-lit board, which doesn't read as "chapter card."
  const isTitleCard = stop.spotlight.kind === "none";

  return (
    <>
      <SpotlightLayer target={stop.spotlight} />
      {isTitleCard ? (
        <div className="pointer-events-none fixed inset-0 z-40 animate-bb-spot-fade bg-slate-950/85" />
      ) : null}
      <div className="pointer-events-auto fixed inset-x-0 bottom-12 z-50 mx-auto w-full max-w-md px-6">
        {/* `key={stop.id}` forces a remount on every advance so the
            pop keyframe replays. Spotlight + dim slide between zones
            (smooth), the modal repaints with fresh copy (popped in).
            Brighter chrome (full-opacity slate, amber-400 border,
            inner glow) so the foreground reads "lit" against the
            now-darker dimmed table. */}
        <div
          key={stop.id}
          className="animate-bb-tour-pop rounded-xl border-2 border-amber-400/80 bg-slate-900 p-5 shadow-[0_8px_40px_rgba(0,0,0,.7),0_0_36px_rgba(251,191,36,.18),inset_0_1px_0_rgba(251,191,36,.10)]"
        >
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
          <RichText className="mt-3 text-sm leading-relaxed text-slate-100">{stop.body}</RichText>
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
