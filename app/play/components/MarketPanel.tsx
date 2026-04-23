"use client";

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { useGameStore } from "@/lib/store/gameStore";
import BourbonCardFace from "./BourbonCardFace";

export default function MarketPanel() {
  const state = useGameStore((s) => s.state)!;
  const m = state.market;

  const faceUp = m.bourbonFaceUp ? BOURBON_CARDS_BY_ID[m.bourbonFaceUp] : null;

  return (
    <section className="rounded-md border border-slate-800 bg-slate-900/60 p-3">
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Market
      </h2>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <PileTile label="Cask" count={m.cask.length} accent="bg-amber-600" />
        <PileTile label="Corn" count={m.corn.length} accent="bg-yellow-500" />
        <PileTile label="Barley" count={m.barley.length} accent="bg-lime-600" />
        <PileTile label="Rye" count={m.rye.length} accent="bg-rose-600" />
        <PileTile label="Wheat" count={m.wheat.length} accent="bg-sky-500" />
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-[1fr_auto]">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">
            Face-up Bourbon Card
          </div>
          {faceUp ? (
            <BourbonCardFace card={faceUp} size="sm" />
          ) : (
            <div className="rounded-md border border-dashed border-slate-700 px-3 py-4 text-center text-xs text-slate-500">
              No face-up card
            </div>
          )}
        </div>
        <div className="flex min-w-[8rem] flex-col gap-1 self-start rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Bourbon deck
          </div>
          <div className="text-sm font-semibold">
            {m.bourbonDeck.length} cards
          </div>
          <div className="text-xs text-slate-500">
            discard {m.bourbonDiscard.length}
          </div>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Investments
          </div>
          <div className="text-sm font-semibold">{m.investmentDeck.length} left</div>
        </div>
        <div className="rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
          <div className="text-xs uppercase tracking-wide text-slate-500">
            Operations
          </div>
          <div className="text-sm font-semibold">{m.operationsDeck.length} left</div>
        </div>
      </div>
    </section>
  );
}

function PileTile({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
      <div className={`h-6 w-6 rounded ${accent}`} aria-hidden />
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-sm font-semibold">{count}</div>
      </div>
    </div>
  );
}
