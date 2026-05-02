"use client";

/**
 * Right-rail "Active" tab — shows the human player's IMPLEMENTED
 * (status === "active") investments. Active investments are table
 * state, not hand state, so they live alongside the rickhouses /
 * market summary instead of inside HandTray's accordion.
 *
 * Each card is clickable to open the inspect modal (so the player can
 * read the full effect text and rarity). MAX_ACTIVE_INVESTMENTS is
 * surfaced inline so the player can see the cap.
 */

import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { MAX_ACTIVE_INVESTMENTS } from "@/lib/engine/state";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";

export default function ActiveInvestmentsPanel() {
  const state = useGameStore((s) => s.state);
  const inspectInvestment = useUiStore((s) => s.inspectInvestment);
  if (!state) return null;

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  if (!humanId) return null;
  const me = state.players[humanId];
  const active = me.investments.filter((i) => i.status === "active");

  return (
    <div className="flex flex-col gap-3 p-4">
      <header className="flex items-baseline justify-between">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-slate-400">
          Active investments
        </h3>
        <span
          className={[
            "font-mono text-[10px] uppercase tracking-[.12em] tabular-nums",
            active.length >= MAX_ACTIVE_INVESTMENTS
              ? "text-amber-300"
              : "text-slate-500",
          ].join(" ")}
          title={`Cap: ${MAX_ACTIVE_INVESTMENTS} active investments`}
        >
          {active.length}/{MAX_ACTIVE_INVESTMENTS}
        </span>
      </header>

      {active.length === 0 ? (
        <div className="rounded-md border border-dashed border-slate-700 bg-slate-950/40 p-4 text-center font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
          No investments implemented yet.
          <span className="mt-1 block normal-case tracking-normal text-[11px] text-slate-400">
            Click <strong className="text-amber-200">Implement ↵</strong> in the action bar, then pick an unbuilt investment from your hand to capitalise it.
          </span>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {active.map((inv) => {
            const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
            const isRare = def?.rarity === "Rare";
            return (
              <li key={inv.instanceId}>
                <button
                  type="button"
                  onClick={() => inspectInvestment(inv.instanceId)}
                  title={
                    def?.effect
                      ? `${def.name} — ${def.effect}`
                      : def?.name ?? inv.cardId
                  }
                  className={[
                    "group relative flex w-full flex-col gap-1.5 rounded-lg border-2 p-3 text-left shadow-[0_4px_12px_rgba(0,0,0,.35),inset_0_1px_0_rgba(255,255,255,.06)] transition-all hover:-translate-y-0.5 hover:border-emerald-300",
                    isRare
                      ? "border-amber-300 bg-gradient-to-br from-emerald-700/70 via-emerald-900/85 to-slate-950"
                      : "border-emerald-400 bg-gradient-to-br from-emerald-600/70 via-emerald-900/85 to-slate-950",
                    isRare ? "rare-shimmer" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[8px] font-semibold uppercase tracking-[.18em] text-emerald-200">
                      Built
                    </span>
                    <span className="font-mono text-[8px] uppercase tracking-[.12em] text-emerald-200/80">
                      {def?.rarity ?? ""}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2">
                    <h4 className="flex-1 font-display text-[14px] font-bold leading-tight text-white drop-shadow-[0_1px_4px_rgba(0,0,0,.35)]">
                      {def?.name ?? inv.cardId}
                    </h4>
                    <span className="rounded-full border border-emerald-300 bg-white/10 px-2 py-0.5 font-mono text-[10px] font-black tabular-nums text-white shadow-[inset_0_1px_2px_rgba(255,255,255,.18)]">
                      ${def?.capital ?? 0}
                    </span>
                  </div>
                  {def?.short ? (
                    <p className="line-clamp-2 text-[10.5px] italic leading-snug text-emerald-100/85">
                      {def.short}
                    </p>
                  ) : null}
                  {def?.effect ? (
                    <p className="line-clamp-3 text-[10.5px] leading-snug text-white/90">
                      {def.effect}
                    </p>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
