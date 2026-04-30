"use client";

import { useGameStore } from "@/lib/store/gameStore";

const REASON_LABEL: Record<string, string> = {
  triple_crown: "Triple Crown — 3 Gold Bourbons",
};

export default function GameOverPanel() {
  const state = useGameStore((s) => s.state)!;
  const clear = useGameStore((s) => s.clear);
  const newGame = useGameStore((s) => s.newGame);

  const winner = state.winnerIds[0]
    ? state.players[state.winnerIds[0]]
    : null;

  return (
    <section className="rounded-md border border-amber-500 bg-amber-950/40 p-4 text-center">
      <h2 className="text-2xl font-bold text-amber-200">Game over</h2>
      <p className="mt-2 text-lg text-amber-100">
        {winner ? `${winner.name} wins` : "No winner"} —{" "}
        {state.winReason ? REASON_LABEL[state.winReason] : ""}
      </p>
      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => {
            clear();
            newGame({
              id: "quickstart",
              seed: Math.floor(Math.random() * 0xffff_ffff),
              seats: state.playerOrder.map((id) => {
                const p = state.players[id];
                return { name: p.name, kind: p.kind, botDifficulty: p.botDifficulty };
              }),
            });
          }}
          className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-amber-400"
        >
          Play again
        </button>
      </div>
    </section>
  );
}
