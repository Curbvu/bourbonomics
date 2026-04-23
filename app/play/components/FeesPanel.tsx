"use client";

import { useState } from "react";

import { feesForPlayer } from "@/lib/rules/fees";
import { useGameStore } from "@/lib/store/gameStore";

export default function FeesPanel() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const humanId = state.playerOrder.find((id) => state.players[id].kind === "human");
  if (!humanId) return null;
  const me = state.players[humanId];
  const alreadyResolved = state.feesPhase.resolvedPlayerIds.includes(humanId);
  if (alreadyResolved) return null;

  const fees = feesForPlayer(state, humanId);
  if (fees.length === 0) {
    return (
      <section className="rounded-md border border-slate-800 bg-slate-900/60 p-4">
        <h2 className="mb-2 text-lg font-semibold">No rickhouse fees</h2>
        <p className="mb-3 text-sm text-slate-400">
          No barrels to age this year.
        </p>
        <button
          type="button"
          onClick={() =>
            dispatch({ t: "PAY_FEES", playerId: humanId, barrelIds: [] })
          }
          className="rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400"
        >
          Continue
        </button>
      </section>
    );
  }

  const toggle = (id: string) => {
    setSkipped((cur) => {
      const set = new Set(cur);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return set;
    });
  };

  const pay = fees
    .filter((f) => !skipped.has(f.barrelId))
    .reduce((s, f) => s + f.amount, 0);
  const unpaid = fees
    .filter((f) => skipped.has(f.barrelId))
    .reduce((s, f) => s + f.amount, 0);

  return (
    <section className="rounded-md border border-emerald-800 bg-emerald-950/30 p-4">
      <h2 className="mb-2 text-lg font-semibold text-emerald-200">
        Phase 1 · Rickhouse fees
      </h2>
      <p className="mb-3 text-sm text-emerald-100">
        Click a barrel to skip it (it won&apos;t age and you&apos;ll owe double).
        Cash: <span className="font-semibold">${me.cash}</span>.
      </p>
      <div className="mb-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {fees.map((fee) => {
          const sk = skipped.has(fee.barrelId);
          return (
            <button
              key={fee.barrelId}
              type="button"
              onClick={() => toggle(fee.barrelId)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-sm ${
                sk
                  ? "border-rose-600 bg-rose-950/40 text-rose-200"
                  : "border-emerald-700 bg-emerald-900/40 text-emerald-100"
              }`}
            >
              <span>
                {fee.rickhouseId.replace("rickhouse-", "#")}{" "}
                <span className="text-xs text-slate-400">({fee.barrelId})</span>
              </span>
              <span className="font-semibold">
                {fee.monopolyWaived
                  ? "$0 monopoly"
                  : sk
                    ? `skip · $${fee.amount * 2} penalty`
                    : `$${fee.amount}`}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-4 text-sm">
        <span>
          Pay now: <span className="font-semibold text-emerald-300">${pay}</span>
        </span>
        {unpaid > 0 ? (
          <span>
            Double-penalty queued:{" "}
            <span className="font-semibold text-rose-300">${unpaid * 2}</span>
          </span>
        ) : null}
        <button
          type="button"
          disabled={pay > me.cash}
          onClick={() =>
            dispatch({
              t: "PAY_FEES",
              playerId: humanId,
              barrelIds: fees
                .filter((f) => !skipped.has(f.barrelId))
                .map((f) => f.barrelId),
            })
          }
          className="ml-auto rounded-md bg-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500"
        >
          Pay &amp; age
        </button>
      </div>
    </section>
  );
}
