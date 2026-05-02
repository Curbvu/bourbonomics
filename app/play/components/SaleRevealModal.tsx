"use client";

import { useEffect, useRef, useState } from "react";

import { BOURBON_CARDS_BY_ID } from "@/lib/catalogs/bourbon.generated";
import { ageBandFor, demandBandFor } from "@/lib/rules/pricing";
import { useGameStore } from "@/lib/store/gameStore";
import { useEscapeToClose } from "./useEscapeToClose";

type SaleData = {
  at: number;
  cardId: string;
  gridPrice: number;
  revenueBonus: number;
  finalPayout: number;
  age: number;
  lookupAge: number;
  lookupDemand: number;
  silver: boolean;
  gold: boolean;
};

function findLatestSale(
  state: ReturnType<typeof useGameStore.getState>["state"],
  humanId: string | undefined,
  base: number,
): SaleData | null {
  if (!state || !humanId) return null;
  for (let i = state.log.length - 1; i >= 0; i--) {
    const e = state.log[i];
    if (e.at <= base) break;
    if (e.kind !== "sell_bourbon") continue;
    if (e.data.playerId !== humanId) continue;
    return {
      at: e.at,
      cardId: String(e.data.bourbonCardId ?? ""),
      gridPrice: Number(e.data.gridPrice ?? 0),
      revenueBonus: Number(e.data.revenueBonus ?? 0),
      finalPayout: Number(e.data.finalPayout ?? 0),
      age: Number(e.data.age ?? 0),
      lookupAge: Number(e.data.lookupAge ?? 0),
      lookupDemand: Number(e.data.lookupDemand ?? 0),
      silver: Boolean(e.data.silver),
      gold: Boolean(e.data.gold),
    };
  }
  return null;
}

export default function SaleRevealModal() {
  const state = useGameStore((s) => s.state);
  const humanId = state?.playerOrder.find((id) => state.players[id].kind === "human");
  const [dismissedSeq, setDismissedSeq] = useState(0);
  // Track the highest seq we saw when this component first mounted so previously
  // completed sales don't pop a modal when the page refreshes. `useState` lazy
  // initializer runs once on first render.
  const [baselineSeq] = useState(() => {
    const s = useGameStore.getState().state;
    const h = s?.playerOrder.find((id) => s.players[id].kind === "human");
    if (!s || !h) return 0;
    const lastSale = [...s.log]
      .reverse()
      .find((e) => e.kind === "sell_bourbon" && e.data.playerId === h);
    return lastSale ? lastSale.at : 0;
  });

  const reveal = findLatestSale(state, humanId, Math.max(dismissedSeq, baselineSeq));

  // Auto-focus the dismiss button when the modal opens.
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (reveal && buttonRef.current) buttonRef.current.focus();
  }, [reveal]);

  const dismiss = () => {
    if (reveal) setDismissedSeq(reveal.at);
  };
  useEscapeToClose(reveal !== null, dismiss);

  if (!reveal) return null;
  const card = BOURBON_CARDS_BY_ID[reveal.cardId];
  if (!card) {
    // Card id not found in catalog — treat as auto-dismissed.
    return null;
  }

  const agBand =
    reveal.lookupAge >= 2 ? ageBandFor(card, reveal.lookupAge) : 0;
  const dmBand =
    reveal.lookupDemand > 0 ? demandBandFor(card, reveal.lookupDemand) : 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bourbon sale result"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur"
      onClick={dismiss}
    >
      <div
        className="w-full max-w-md rounded-lg border border-amber-600 bg-slate-900 p-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-1 text-center text-xs font-semibold uppercase tracking-wider text-amber-400">
          Sale
        </h2>
        <div className="mb-4 text-center">
          <div className="text-4xl font-bold tabular-nums text-emerald-300">
            ${reveal.finalPayout}
          </div>
          {reveal.revenueBonus !== 0 ? (
            <div className="text-xs text-slate-400">
              ${reveal.gridPrice} grid
              {reveal.revenueBonus > 0 ? " + " : " - "}$
              {Math.abs(reveal.revenueBonus)} bonuses
            </div>
          ) : null}
        </div>

        <div className="mx-auto max-w-sm">
          <BourbonCardHighlight card={card} ageBand={agBand} demandBand={dmBand} />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-300">
          <div>
            <span className="text-slate-500">Age:</span> {reveal.age} yr
            {reveal.lookupAge !== reveal.age ? (
              <span className="ml-1 text-amber-300">(→ {reveal.lookupAge})</span>
            ) : null}
          </div>
          <div>
            <span className="text-slate-500">Demand used:</span> {reveal.lookupDemand}
          </div>
        </div>
        {reveal.gold || reveal.silver ? (
          <div
            className={`mt-3 rounded-md border px-3 py-2 text-center text-sm font-semibold ${
              reveal.gold
                ? "border-amber-300 bg-amber-800/40 text-amber-100"
                : "border-slate-300 bg-slate-800 text-slate-100"
            }`}
          >
            {reveal.gold ? "🏆 Gold Award earned" : "🥈 Silver Award earned"}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end">
          <button
            ref={buttonRef}
            type="button"
            onClick={dismiss}
            className="rounded-md bg-amber-500 px-4 py-1.5 text-sm font-semibold text-slate-950 hover:bg-amber-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}

// Import locally to keep the module self-contained.
import BourbonCardFace from "./BourbonCardFace";

function BourbonCardHighlight({
  card,
  ageBand,
  demandBand,
}: {
  card: import("@/lib/catalogs/types").BourbonCardDef;
  ageBand: 0 | 1 | 2;
  demandBand: 0 | 1 | 2;
}) {
  return <BourbonCardFace card={card} highlight={{ ageBand, demandBand }} size="md" />;
}
