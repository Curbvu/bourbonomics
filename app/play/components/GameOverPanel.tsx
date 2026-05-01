"use client";

import { useGameStore } from "@/lib/store/gameStore";

const REASON_LABEL: Record<string, string> = {
  "final-round": "Final round complete — three Gold Bourbons unlocked",
};

export default function GameOverPanel() {
  const state = useGameStore((s) => s.state)!;
  const clear = useGameStore((s) => s.clear);
  const newGame = useGameStore((s) => s.newGame);

  const winners = state.winnerIds
    .map((id) => state.players[id])
    .filter(Boolean);
  const scores = state.finalScores;

  const orderedScores = scores
    ? state.playerOrder
        .map((id) => ({ id, player: state.players[id], score: scores[id] }))
        .filter((row) => !!row.score)
        .sort((a, b) => b.score!.total - a.score!.total)
    : [];

  return (
    <section className="rounded-md border border-amber-500 bg-amber-950/40 p-4 text-center">
      <h2 className="text-2xl font-bold text-amber-200">Game over</h2>
      <p className="mt-2 text-lg text-amber-100">
        {winners.length === 0
          ? "No winner"
          : winners.length === 1
            ? `${winners[0].name} wins`
            : `Tied: ${winners.map((w) => w.name).join(", ")}`}{" "}
        — {state.winReason ? REASON_LABEL[state.winReason] : ""}
      </p>
      {orderedScores.length > 0 ? (
        <div className="mx-auto mt-4 max-w-md">
          <table className="w-full text-left font-mono text-xs text-amber-100">
            <thead className="text-amber-300/80">
              <tr>
                <th className="px-2 py-1">Baron</th>
                <th className="px-2 py-1 text-right">Cash</th>
                <th className="px-2 py-1 text-right">Investments</th>
                <th className="px-2 py-1 text-right">Gold ($)</th>
                <th className="px-2 py-1 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {orderedScores.map(({ id, player, score }) => (
                <tr
                  key={id}
                  className={
                    state.winnerIds.includes(id)
                      ? "border-t border-amber-500/30 font-semibold text-amber-200"
                      : "border-t border-slate-800"
                  }
                >
                  <td className="px-2 py-1">{player.name}</td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    ${score!.cash}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    ${score!.investments}
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    ${score!.goldBourbons}{" "}
                    <span className="text-amber-400/60">
                      ({score!.goldCount}×)
                    </span>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">
                    ${score!.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
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
