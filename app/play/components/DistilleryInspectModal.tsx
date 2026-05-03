"use client";

/**
 * Inspect modal for a chosen Distillery card. Per the rules each baron's
 * Distillery sits face-up all game, so opening this for an opponent is
 * fine — the modal just shows their bonus + perk + flavor in full.
 */

import { useEffect } from "react";

import { DISTILLERY_CARDS_BY_ID } from "@/lib/catalogs/distillery.generated";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import PlayerSwatch from "./PlayerSwatch";

export default function DistilleryInspectModal() {
  const inspect = useUiStore((s) => s.inspect);
  const close = useUiStore((s) => s.closeInspect);
  const state = useGameStore((s) => s.state);

  // Esc closes the modal.
  useEffect(() => {
    if (inspect?.kind !== "distillery") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [inspect, close]);

  if (!inspect || inspect.kind !== "distillery") return null;
  if (!state) return null;
  const player = state.players[inspect.playerId];
  if (!player) return null;
  const distilleryId = player.chosenDistilleryId;
  if (!distilleryId) return null;
  const def = DISTILLERY_CARDS_BY_ID[distilleryId];
  if (!def) return null;

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  const isYou = inspect.playerId === humanId;
  const headerLabel = isYou
    ? "Your distillery"
    : `${player.name}'s distillery`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${player.name} distillery — ${def.name}`}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-6 backdrop-blur"
      onClick={close}
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div
        role="document"
        onClick={(e) => e.stopPropagation()}
        className="relative flex w-full max-w-[480px] flex-col gap-4 rounded-xl border-2 border-amber-500 bg-slate-900 p-6 shadow-[0_8px_32px_rgba(0,0,0,.55),0_0_0_3px_rgba(245,158,11,0.20)]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-slate-700 bg-slate-900/80 font-mono text-sm text-slate-300 transition-colors hover:border-slate-500 hover:text-slate-100"
        >
          ×
        </button>

        <header className="flex items-center gap-3 pr-10">
          <PlayerSwatch
            seatIndex={player.seatIndex}
            logoId={player.logoId}
            size="md"
          />
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">
              {headerLabel}
            </div>
            <div className="font-display text-xl font-semibold leading-tight text-amber-100">
              {def.name}
            </div>
          </div>
        </header>

        <p className="font-display text-[14px] italic leading-snug text-amber-100">
          "{def.flavor}"
        </p>

        <div className="flex flex-col gap-3 text-[13px] leading-snug">
          <div className="rounded-lg border border-emerald-500/60 bg-emerald-950/40 px-3.5 py-2.5">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-emerald-300">
              Starting bonus
            </div>
            <div className="mt-1 text-emerald-50">{def.bonus_text}</div>
          </div>
          <div className="rounded-lg border border-sky-500/60 bg-sky-950/40 px-3.5 py-2.5">
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.16em] text-sky-300">
              Ongoing perk
            </div>
            <div className="mt-1 text-sky-50">{def.perk_text}</div>
          </div>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="button"
            onClick={close}
            className="rounded border border-slate-700 bg-slate-900 px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-slate-200 transition-colors hover:border-slate-600 hover:bg-slate-800"
          >
            Close ↵
          </button>
        </div>
      </div>
    </div>
  );
}
