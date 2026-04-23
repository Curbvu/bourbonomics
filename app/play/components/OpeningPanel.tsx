"use client";

import { useState } from "react";

import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { useGameStore } from "@/lib/store/gameStore";

export default function OpeningPanel() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const [selected, setSelected] = useState<string[]>([]);
  const [commitChoices, setCommitChoices] = useState<Record<number, "implement" | "hold">>({});

  const humanId = state.playerOrder.find((id) => state.players[id].kind === "human");
  if (!humanId) return null;
  const me = state.players[humanId];

  const awaitingKeep = me.openingDraft !== null;
  const awaitingCommit = !awaitingKeep && me.openingKeptBeforeAuction !== null;

  if (!awaitingKeep && !awaitingCommit) return null;

  if (awaitingKeep && me.openingDraft) {
    const toggle = (id: string) => {
      setSelected((cur) => {
        const set = new Set(cur);
        if (set.has(id)) set.delete(id);
        else if (set.size < 3) set.add(id);
        return Array.from(set);
      });
    };
    return (
      <section className="rounded-md border border-amber-800 bg-amber-950/30 p-4">
        <h2 className="mb-2 text-lg font-semibold text-amber-200">
          Opening draft — keep 3 of 6
        </h2>
        <p className="mb-3 text-sm text-amber-100">
          Pick 3 investments to keep. The other 3 go to the bottom of the deck.
        </p>
        <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
          {me.openingDraft.map((id, idx) => {
            const def = INVESTMENT_CARDS_BY_ID[id];
            const chosen = selected.includes(id);
            return (
              <button
                type="button"
                key={`${id}-${idx}`}
                onClick={() => toggle(id)}
                className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left text-sm ${
                  chosen
                    ? "border-amber-400 bg-amber-900/60 text-amber-100"
                    : "border-slate-700 bg-slate-950 text-slate-200 hover:border-slate-500"
                }`}
              >
                <span className="font-semibold">{def?.name ?? id}</span>
                <span className="text-xs text-slate-400">
                  {def?.rarity} · ${def?.capital} capital
                </span>
                <span className="text-xs">{def?.effect}</span>
              </button>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3">
          <span className="text-xs text-amber-200">
            {selected.length} / 3 selected
          </span>
          <button
            type="button"
            disabled={selected.length !== 3}
            onClick={() =>
              dispatch({
                t: "OPENING_KEEP",
                playerId: humanId,
                keptIds: selected,
              })
            }
            className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:bg-slate-800 disabled:text-slate-500"
          >
            Keep these 3
          </button>
        </div>
      </section>
    );
  }

  // awaitingCommit
  const kept = me.openingKeptBeforeAuction ?? [];
  return (
    <section className="rounded-md border border-cyan-800 bg-cyan-950/30 p-4">
      <h2 className="mb-2 text-lg font-semibold text-cyan-200">
        Commit opening hand
      </h2>
      <p className="mb-3 text-sm text-cyan-100">
        For each card, choose to Implement (pay capital now — activates start of
        round 2) or Hold (keep in hand, implement later).
      </p>
      <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {kept.map((id, idx) => {
          const def = INVESTMENT_CARDS_BY_ID[id];
          const choice = commitChoices[idx] ?? "hold";
          const canAfford = me.cash >= (def?.capital ?? 0);
          return (
            <div
              key={`${id}-${idx}`}
              className="flex flex-col gap-2 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            >
              <span className="font-semibold">{def?.name ?? id}</span>
              <span className="text-xs text-slate-400">
                ${def?.capital} capital · {def?.rarity}
              </span>
              <span className="text-xs">{def?.effect}</span>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setCommitChoices((c) => ({ ...c, [idx]: "implement" }))
                  }
                  disabled={!canAfford}
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                    choice === "implement"
                      ? "bg-cyan-500 text-slate-950"
                      : "border border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                  }`}
                >
                  Implement
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setCommitChoices((c) => ({ ...c, [idx]: "hold" }))
                  }
                  className={`flex-1 rounded px-2 py-1 text-xs font-medium ${
                    choice === "hold"
                      ? "bg-slate-200 text-slate-950"
                      : "border border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  Hold
                </button>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <button
          type="button"
          onClick={() =>
            dispatch({
              t: "OPENING_COMMIT",
              playerId: humanId,
              decisions: kept.map(
                (_, idx) => commitChoices[idx] ?? "hold",
              ),
            })
          }
          className="rounded-md bg-cyan-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-cyan-400"
        >
          Commit hand
        </button>
      </div>
    </section>
  );
}
