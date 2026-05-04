import type { PlayerState } from "@bourbonomics/engine";

export function PlayerCard({
  player,
  isCurrent,
  finalRank,
}: {
  player: PlayerState;
  isCurrent: boolean;
  finalRank: number | null;
}) {
  return (
    <div
      className={`rounded border px-3 py-2 transition ${
        isCurrent
          ? "border-amber-500 bg-amber-500/10"
          : "border-neutral-800 bg-neutral-900"
      }`}
    >
      <div className="flex items-baseline justify-between mb-1">
        <span className="font-medium">
          {player.name}
          {finalRank !== null && (
            <span className="ml-2 text-amber-400">#{finalRank}</span>
          )}
        </span>
        <span className="text-amber-400 font-semibold tabular-nums">
          {player.reputation}
          <span className="text-neutral-500 text-xs ml-1">rep</span>
        </span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-xs text-neutral-400">
        <Stat label="hand" value={player.hand.length} />
        <Stat label="deck" value={player.deck.length} />
        <Stat label="discard" value={player.discard.length} />
        <Stat label="trashed" value={player.trashed.length} />
      </div>
      <div className="mt-2 flex gap-3 text-xs">
        <span title={player.mashBills.map((m) => m.name).join(", ")}>
          📜 <span className="text-neutral-300">{player.mashBills.length}</span>{" "}
          <span className="text-neutral-500">bills</span>
        </span>
        <span>
          🥇 <span className="text-neutral-300">{player.unlockedGoldBourbons.length}</span>{" "}
          <span className="text-neutral-500">gold</span>
        </span>
        <span>
          🛢 <span className="text-neutral-300">{player.barrelsSold}</span>{" "}
          <span className="text-neutral-500">sold</span>
        </span>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <span className="text-neutral-200 tabular-nums">{value}</span>
    </div>
  );
}
