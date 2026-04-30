"use client";

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { INVESTMENT_CARDS_BY_ID } from "@/lib/catalogs/investment.generated";
import { OPERATIONS_CARDS_BY_ID } from "@/lib/catalogs/operations.generated";
import { SPECIALTY_RESOURCES_BY_ID } from "@/lib/catalogs/resource.generated";
import { useGameStore } from "@/lib/store/gameStore";

const RESOURCE_ACCENTS: Record<string, string> = {
  cask: "bg-amber-600/20 text-amber-200 border-amber-700",
  corn: "bg-yellow-500/20 text-yellow-200 border-yellow-600",
  barley: "bg-lime-600/20 text-lime-200 border-lime-600",
  rye: "bg-rose-600/20 text-rose-200 border-rose-600",
  wheat: "bg-sky-500/20 text-sky-200 border-sky-600",
};

export default function HandTray() {
  const state = useGameStore((s) => s.state)!;
  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  if (!humanId) return null;
  const me = state.players[humanId];

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Your hand — {me.name}
        </h2>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-slate-400">Cash</span>
          <span className="font-semibold text-emerald-300">${me.cash}</span>
        </div>
      </div>

      <Row label="Resources">
        {me.resourceHand.length === 0 ? (
          <Empty>No resource cards</Empty>
        ) : (
          me.resourceHand.map((r) => {
            const special = r.specialtyId
              ? SPECIALTY_RESOURCES_BY_ID[r.specialtyId]
              : null;
            const accent =
              RESOURCE_ACCENTS[r.resource] ??
              "bg-slate-800 text-slate-200 border-slate-700";
            return (
              <div
                key={r.instanceId}
                className={`rounded-md border px-2 py-1 text-xs ${accent}`}
                title={special?.rule}
              >
                <div className="font-semibold capitalize">{r.resource}</div>
                {special ? (
                  <div className="text-[10px] opacity-80">{special.name}</div>
                ) : null}
              </div>
            );
          })
        )}
      </Row>

      <Row label="Bourbon cards">
        {me.bourbonHand.length === 0 ? (
          <Empty>No bourbon cards in hand</Empty>
        ) : (
          me.bourbonHand.map((id, idx) => {
            const card = BOURBON_CARDS_BY_ID[id];
            return (
              <div
                key={`${id}-${idx}`}
                className="rounded-md border border-amber-700 bg-amber-950/40 px-2 py-1 text-xs text-amber-100"
              >
                <div className="font-semibold">{card?.name ?? id}</div>
                <div className="text-[10px] opacity-80">{card?.rarity}</div>
              </div>
            );
          })
        )}
      </Row>

      <Row label="Investments">
        {me.investments.length === 0 ? (
          <Empty>No investments</Empty>
        ) : (
          me.investments.map((inv) => {
            const def = INVESTMENT_CARDS_BY_ID[inv.cardId];
            const statusClass =
              inv.status === "active"
                ? "border-emerald-600 bg-emerald-900/40 text-emerald-200"
                : "border-slate-700 bg-slate-950 text-slate-200";
            return (
              <div
                key={inv.instanceId}
                className={`rounded-md border px-2 py-1 text-xs ${statusClass}`}
                title={def?.effect}
              >
                <div className="font-semibold">{def?.name ?? inv.cardId}</div>
                <div className="text-[10px] opacity-80">
                  {inv.status} · ${def?.capital ?? 0}
                </div>
              </div>
            );
          })
        )}
      </Row>

      <Row label="Operations">
        {me.operations.length === 0 ? (
          <Empty>No operations cards</Empty>
        ) : (
          me.operations.map((ops) => {
            const def = OPERATIONS_CARDS_BY_ID[ops.cardId];
            return (
              <div
                key={ops.instanceId}
                className="rounded-md border border-violet-700 bg-violet-950/40 px-2 py-1 text-xs text-violet-200"
                title={def?.effect}
              >
                <div className="font-semibold">{def?.title ?? ops.cardId}</div>
              </div>
            );
          })
        )}
      </Row>

      <Row label="Awards">
        {me.silverAwards.length === 0 && me.goldAwards.length === 0 ? (
          <Empty>No awards yet</Empty>
        ) : (
          <>
            {me.goldAwards.map((id) => (
              <div
                key={`gold-${id}`}
                className="rounded-md border border-amber-400 bg-amber-900/60 px-2 py-1 text-xs text-amber-200"
              >
                Gold · {BOURBON_CARDS_BY_ID[id]?.name ?? id}
              </div>
            ))}
            {me.silverAwards.map((id) => (
              <div
                key={`silver-${id}`}
                className="rounded-md border border-slate-400 bg-slate-800 px-2 py-1 text-xs text-slate-200"
              >
                Silver · {BOURBON_CARDS_BY_ID[id]?.name ?? id}
              </div>
            ))}
          </>
        )}
      </Row>
    </section>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="flex flex-wrap gap-1">{children}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <span className="text-xs italic text-slate-500">{children}</span>;
}
