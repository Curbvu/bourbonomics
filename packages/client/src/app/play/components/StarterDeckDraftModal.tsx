"use client";

/**
 * Starter-deck draft modal — pre-round-1 16-card composition.
 *
 * Each player builds a personal starter deck by picking from the six plain
 * card types (cask, corn, rye, barley, wheat, capital). The player starts
 * with a balanced default and can +/- each type until the total hits 16.
 *
 * Renders only when it's the human's turn in the starter_deck_draft phase.
 */

import { useEffect, useMemo, useState } from "react";

import { useGameStore } from "@/lib/store/game";
import type { ResourceSubtype, StarterDeckComposition } from "@bourbonomics/engine";
import {
  CAPITAL_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
} from "./handCardStyles";

const TARGET_SIZE = 16;

const DEFAULT_COMPOSITION: Required<StarterDeckComposition> = {
  cask: 4,
  corn: 4,
  rye: 2,
  barley: 1,
  wheat: 1,
  capital: 4,
};

const KEYS: (keyof Required<StarterDeckComposition>)[] = [
  "cask",
  "corn",
  "rye",
  "barley",
  "wheat",
  "capital",
];

export default function StarterDeckDraftModal() {
  const { state, humanWaitingOn, dispatch } = useGameStore();
  const [composition, setComposition] = useState<Required<StarterDeckComposition>>(
    DEFAULT_COMPOSITION,
  );

  // Reset to default whenever the cursor moves (e.g. on a fresh game).
  const cursor = state?.starterDeckDraftCursor ?? 0;
  useEffect(() => {
    setComposition(DEFAULT_COMPOSITION);
  }, [cursor]);

  const total = useMemo(
    () => KEYS.reduce((sum, k) => sum + composition[k], 0),
    [composition],
  );

  if (!state) return null;
  if (state.phase !== "starter_deck_draft") return null;
  if (!humanWaitingOn) return null;

  const inc = (k: keyof Required<StarterDeckComposition>) => {
    setComposition((prev) => {
      if (total >= TARGET_SIZE) return prev;
      return { ...prev, [k]: prev[k] + 1 };
    });
  };
  const dec = (k: keyof Required<StarterDeckComposition>) => {
    setComposition((prev) => {
      if (prev[k] <= 0) return prev;
      return { ...prev, [k]: prev[k] - 1 };
    });
  };
  const reset = () => setComposition(DEFAULT_COMPOSITION);
  const clear = () =>
    setComposition({ cask: 0, corn: 0, rye: 0, barley: 0, wheat: 0, capital: 0 });

  const confirm = () => {
    if (total !== TARGET_SIZE) return;
    dispatch({
      type: "COMPOSE_STARTER_DECK",
      playerId: humanWaitingOn.id,
      composition,
    });
  };

  const remaining = TARGET_SIZE - total;
  const ready = total === TARGET_SIZE;

  // Build a flat list of card tiles for the visual deck preview.
  const deckTiles: { key: string; type: keyof Required<StarterDeckComposition> }[] = [];
  for (const k of KEYS) {
    for (let i = 0; i < composition[k]; i++) {
      deckTiles.push({ key: `${k}-${i}`, type: k });
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Compose your 16-card starter deck"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
    >
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle, rgba(251,191,36,0.28) 0%, transparent 65%)",
        }}
      />

      <div className="relative flex max-h-full w-full max-w-[1180px] flex-col items-center gap-5 overflow-y-auto">
        <div className="text-center">
          <div className="font-mono text-[11px] uppercase tracking-[.18em] text-amber-300">
            Setup · Starter-deck draft
          </div>
          <div className="mt-1 font-display text-2xl font-semibold text-amber-100">
            Build your 16-card starter deck
          </div>
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[.14em] text-slate-400">
            {humanWaitingOn.name}
            {humanWaitingOn.distillery ? (
              <> · {humanWaitingOn.distillery.name}</>
            ) : null}
            {" · "}
            <span className={ready ? "text-emerald-300" : "text-amber-200"}>
              {total} / {TARGET_SIZE}
            </span>
            {!ready ? <> · need {remaining > 0 ? `${remaining} more` : `${-remaining} fewer`}</> : null}
          </div>
        </div>

        {/* Card-type picker */}
        <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {KEYS.map((k) => (
            <CardTypeTile
              key={k}
              type={k}
              count={composition[k]}
              canAdd={total < TARGET_SIZE}
              onAdd={() => inc(k)}
              onRemove={() => dec(k)}
            />
          ))}
        </div>

        {/* Deck preview — 16 portrait tiles wrapping. */}
        <div className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[.18em] text-slate-400">
              Your starter deck
            </span>
            <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
              {total === TARGET_SIZE
                ? "deck full — ready to shuffle"
                : `${TARGET_SIZE - total} slot${TARGET_SIZE - total === 1 ? "" : "s"} empty`}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {deckTiles.map((t) => (
              <DeckSlot key={t.key} type={t.type} />
            ))}
            {Array.from({ length: Math.max(0, TARGET_SIZE - deckTiles.length) }).map(
              (_, i) => (
                <EmptyDeckSlot key={`empty-${i}`} />
              ),
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-200 hover:border-amber-500/60 hover:text-amber-200"
          >
            Reset to balanced
          </button>
          <button
            type="button"
            onClick={clear}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-400 hover:border-rose-500/60 hover:text-rose-300"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={!ready}
            title={ready ? "Lock in this 16-card starter deck" : `Total must be ${TARGET_SIZE}`}
            className={[
              "rounded-md border px-6 py-2 font-sans text-sm font-bold uppercase tracking-[.05em] transition-all",
              ready
                ? "border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 text-slate-950 shadow-[0_0_0_3px_rgba(251,191,36,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] hover:from-amber-200 hover:to-amber-400"
                : "cursor-not-allowed border-slate-700 bg-slate-900 text-slate-600",
            ].join(" ")}
          >
            {ready ? "Confirm starter ↵" : `Pick ${TARGET_SIZE - total} more`}
          </button>
        </div>
      </div>
    </div>
  );
}

function CardTypeTile({
  type,
  count,
  canAdd,
  onAdd,
  onRemove,
}: {
  type: keyof Required<StarterDeckComposition>;
  count: number;
  canAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  const isCapital = type === "capital";
  const chrome = isCapital ? CAPITAL_CHROME : RESOURCE_CHROME[type as ResourceSubtype];
  const label = isCapital ? "Capital" : RESOURCE_LABEL[type as ResourceSubtype];
  const glyph = isCapital ? "$" : RESOURCE_GLYPH[type as ResourceSubtype];
  const sub = isCapital
    ? "currency for the market"
    : type === "cask"
      ? "needed: 1 per barrel"
      : type === "corn"
        ? "needed: 1+ per barrel"
        : "grain · used in the mash";

  return (
    <div
      className={[
        "relative flex flex-col gap-2 overflow-hidden rounded-lg border-2 p-3 shadow-[0_8px_20px_rgba(0,0,0,.4)] ring-1 ring-white/10",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <div className="flex items-baseline justify-between">
        <span className={`font-mono text-[9.5px] font-semibold uppercase tracking-[.18em] ${chrome.label}`}>
          {label}
        </span>
        <span className={`font-display text-[22px] font-bold leading-none tabular-nums ${chrome.ink}`}>
          {count}
        </span>
      </div>
      <div className={`grid h-12 w-12 self-center place-items-center rounded-full border-2 bg-white/10 text-2xl font-bold ${chrome.border} ${chrome.ink}`}>
        {glyph}
      </div>
      <div className={`text-center text-[10px] italic ${chrome.ink} opacity-80`}>{sub}</div>
      <div className="mt-1 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onRemove}
          disabled={count <= 0}
          aria-label={`Remove one ${label}`}
          className="grid h-8 w-8 place-items-center rounded border border-white/30 bg-black/30 font-display text-lg text-white transition-colors hover:bg-black/50 disabled:cursor-not-allowed disabled:opacity-30"
        >
          −
        </button>
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          aria-label={`Add one ${label}`}
          className="grid h-8 w-8 place-items-center rounded border border-white/30 bg-white/15 font-display text-lg text-white transition-colors hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

function DeckSlot({ type }: { type: keyof Required<StarterDeckComposition> }) {
  const isCapital = type === "capital";
  const chrome = isCapital ? CAPITAL_CHROME : RESOURCE_CHROME[type as ResourceSubtype];
  const glyph = isCapital ? "$" : RESOURCE_GLYPH[type as ResourceSubtype];
  const label = isCapital ? "Capital" : RESOURCE_LABEL[type as ResourceSubtype];
  return (
    <div
      title={label}
      className={[
        "flex h-[80px] w-[58px] flex-col items-center justify-center gap-1 overflow-hidden rounded-md border-2 shadow-[0_4px_10px_rgba(0,0,0,.45)] ring-1 ring-white/10",
        chrome.gradient,
        chrome.border,
      ].join(" ")}
    >
      <span className={`text-2xl ${chrome.ink}`}>{glyph}</span>
      <span className={`font-mono text-[8px] uppercase tracking-[.14em] ${chrome.label}`}>
        {label}
      </span>
    </div>
  );
}

function EmptyDeckSlot() {
  return (
    <div
      aria-label="Empty deck slot"
      className="grid h-[80px] w-[58px] place-items-center rounded-md border border-dashed border-slate-700 bg-slate-950/40 font-mono text-[8px] uppercase tracking-[.18em] text-slate-700"
    >
      empty
    </div>
  );
}
