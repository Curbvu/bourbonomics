import type { GameState } from "@bourbonomics/engine";

export function RickhouseGrid({ state }: { state: GameState }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {state.rickhouses.map((r) => {
        const barrels = state.allBarrels.filter((b) => b.rickhouseId === r.id);
        const slotsLeft = r.capacity - barrels.length;
        return (
          <div key={r.id} className="rounded border border-neutral-800 p-3">
            <div className="flex justify-between items-baseline mb-2">
              <span className="font-medium">{r.name}</span>
              <span className="text-xs text-neutral-500">
                {barrels.length}/{r.capacity}
              </span>
            </div>
            <div className="flex flex-wrap gap-1">
              {barrels.map((b) => (
                <BarrelChip
                  key={b.id}
                  ownerId={b.ownerId}
                  age={b.age}
                  mashBillName={b.attachedMashBill.name}
                  agedThisRound={b.agedThisRound}
                />
              ))}
              {Array.from({ length: slotsLeft }).map((_, i) => (
                <div
                  key={`empty-${i}`}
                  className="w-9 h-9 rounded border border-dashed border-neutral-800"
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function BarrelChip({
  ownerId,
  age,
  mashBillName,
  agedThisRound,
}: {
  ownerId: string;
  age: number;
  mashBillName: string;
  agedThisRound: boolean;
}) {
  const colors = ownerColor(ownerId);
  return (
    <div
      title={`${ownerId} · ${mashBillName} · age ${age}${agedThisRound ? " · aged this round" : ""}`}
      className={`w-9 h-9 rounded flex items-center justify-center text-xs font-semibold ${colors} ${
        agedThisRound ? "ring-1 ring-amber-400/60" : ""
      }`}
    >
      {age}
    </div>
  );
}

function ownerColor(ownerId: string): string {
  const palette = [
    "bg-rose-700/80 text-rose-50",
    "bg-emerald-700/80 text-emerald-50",
    "bg-sky-700/80 text-sky-50",
    "bg-violet-700/80 text-violet-50",
  ];
  let hash = 0;
  for (const ch of ownerId) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[hash % palette.length]!;
}
