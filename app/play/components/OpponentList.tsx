"use client";

/**
 * Body of the RightRail "Barons" tab.
 *
 * Spec: design_handoff_bourbon_blend/README.md §Barons tab.
 *
 * Lists every non-human player (bots) with their seat colour, cash, barrel
 * count, active investment count, gold-bourbon count, and a row of barrel
 * chips. The human player isn't shown here — they live in the HandTray.
 */

import { useGameStore } from "@/lib/store/gameStore";
import {
  PLAYER_BG_CLASS,
  PLAYER_TEXT_CLASS,
  paletteIndex,
} from "./playerColors";

export default function OpponentList() {
  const state = useGameStore((s) => s.state)!;
  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  const bots = state.playerOrder.filter((id) => id !== humanId);

  return (
    <div>
      {bots.map((id) => {
        const p = state.players[id];
        const seatIdx = paletteIndex(p.seatIndex);
        // Owned barrels across all rickhouses, with their ages so we can
        // visualise them at the bottom of each baron card.
        const ownedBarrels: { barrelId: string; age: number }[] = [];
        for (const h of state.rickhouses) {
          for (const b of h.barrels) {
            if (b.ownerId === id)
              ownedBarrels.push({ barrelId: b.barrelId, age: b.age });
          }
        }
        const activeInvestments = p.investments.filter(
          (i) => i.status === "active",
        ).length;

        return (
          <div
            key={id}
            className="border-b border-slate-800 px-3.5 py-3.5 last:border-b-0"
          >
            {/* Row 1 — identity + cash */}
            <div className="flex items-center gap-2.5">
              <span
                className={`grid h-[22px] w-[22px] place-items-center rounded-full font-mono text-[10px] font-bold leading-none text-white ring-2 ring-slate-950 ${PLAYER_BG_CLASS[seatIdx]}`}
                aria-hidden
              >
                {p.name[0]?.toUpperCase()}
              </span>
              <span className="font-display text-base font-semibold text-amber-100">
                {p.name}
              </span>
              <span className="flex-1" />
              <span className="font-mono text-[13px] font-bold tabular-nums text-emerald-500">
                ${p.cash}
              </span>
            </div>

            {/* Row 2 — stat line */}
            <div className="mt-1.5 flex gap-3.5 font-mono text-[11px] tabular-nums text-slate-500">
              <span>
                <span className="font-semibold text-slate-200">
                  {ownedBarrels.length}
                </span>{" "}
                barrels
              </span>
              <span>
                <span className="font-semibold text-slate-200">
                  {activeInvestments}
                </span>
                /3 invests
              </span>
              <span>
                <span className="font-semibold text-amber-300">
                  {p.goldAwards.length}
                </span>{" "}
                gold
              </span>
              {p.silverAwards.length > 0 ? (
                <span>
                  <span className="font-semibold text-slate-300">
                    {p.silverAwards.length}
                  </span>{" "}
                  silver
                </span>
              ) : null}
            </div>

            {/* Row 3 — barrel chips */}
            {ownedBarrels.length > 0 ? (
              <div className="mt-2.5 flex flex-wrap gap-[5px]">
                {ownedBarrels.map((b) => (
                  <span
                    key={b.barrelId}
                    title={`age ${b.age}`}
                    className={`grid h-[26px] w-[26px] place-items-center rounded-[5px] font-mono text-[10px] font-bold leading-none text-white shadow-[inset_0_1px_0_rgba(255,255,255,.18)] ring-2 ring-slate-950 ${PLAYER_BG_CLASS[seatIdx]}`}
                  >
                    {b.age}
                  </span>
                ))}
              </div>
            ) : (
              <div
                className={`mt-2.5 font-mono text-[10px] uppercase tracking-[.12em] ${PLAYER_TEXT_CLASS[seatIdx]} opacity-60`}
              >
                no barrels yet
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
