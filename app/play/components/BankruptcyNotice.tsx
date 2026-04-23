"use client";

import { useState } from "react";

import { useGameStore } from "@/lib/store/gameStore";
import { useEscapeToClose } from "./useEscapeToClose";

type Notice = {
  at: number;
  playerName: string;
  unpaidDebt: number;
  isHuman: boolean;
};

function findLatestNotice(
  state: ReturnType<typeof useGameStore.getState>["state"],
  dismissedSeq: number,
): Notice | null {
  if (!state) return null;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.at <= dismissedSeq) break;
    if (e.kind !== "player_bankrupt") continue;
    const playerId = String(e.data.playerId ?? "");
    const player = state.players[playerId];
    return {
      at: e.at,
      playerName: player?.name ?? playerId,
      unpaidDebt: Number(e.data.unpaidDebt ?? 0),
      isHuman: player?.kind === "human",
    };
  }
  return null;
}

export default function BankruptcyNotice() {
  const state = useGameStore((s) => s.state);
  const [dismissedSeq, setDismissedSeq] = useState(0);

  const latest = findLatestNotice(state, dismissedSeq);
  const dismiss = () => {
    if (latest) setDismissedSeq(latest.at);
  };
  useEscapeToClose(latest !== null, dismiss);

  if (!latest) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bankruptcy"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-lg border border-rose-600 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 text-center text-xs font-semibold uppercase tracking-wider text-rose-400">
          Bankruptcy
        </h2>
        <p className="text-center text-xl font-bold text-rose-200">
          {latest.isHuman ? "You went" : `${latest.playerName} went`} bankrupt.
        </p>
        <p className="mt-2 text-center text-sm text-slate-400">
          Couldn&apos;t cover the ${latest.unpaidDebt} double-penalty from unpaid
          rickhouse fees. Assets returned to the bank.
        </p>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={dismiss}
            className="rounded-md bg-rose-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-rose-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-rose-300"
            autoFocus
          >
            Acknowledged
          </button>
        </div>
      </div>
    </div>
  );
}
