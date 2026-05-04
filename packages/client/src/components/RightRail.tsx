"use client";

import { useState } from "react";
import type { GameState, ScoreResult } from "@bourbonomics/engine";
import { colorFor } from "@/lib/colors";
import { ActionLog, type LogEntry } from "./ActionLog";

type Tab = "market" | "barons" | "log";

export function RightRail({
  state,
  log,
  scores,
}: {
  state: GameState;
  log: LogEntry[];
  scores: ScoreResult[] | null;
}) {
  const [tab, setTab] = useState<Tab>("barons");

  return (
    <aside className="rounded-lg border border-neutral-800 bg-neutral-900/50 flex flex-col min-h-0">
      <div className="flex border-b border-neutral-800">
        <TabBtn label="Market" current={tab === "market"} onClick={() => setTab("market")} />
        <TabBtn label="Barons" current={tab === "barons"} onClick={() => setTab("barons")} />
        <TabBtn label="Log" current={tab === "log"} onClick={() => setTab("log")} />
      </div>
      <div className="flex-1 overflow-auto p-4 min-h-0">
        {tab === "market" && <MarketTab state={state} />}
        {tab === "barons" && <BaronsTab state={state} scores={scores} />}
        {tab === "log" && <ActionLog entries={log} />}
      </div>
    </aside>
  );
}

function TabBtn({
  label,
  current,
  onClick,
}: {
  label: string;
  current: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2.5 text-xs uppercase tracking-[0.2em] transition ${
        current
          ? "text-amber-400 border-b-2 border-amber-500 -mb-px"
          : "text-neutral-500 hover:text-neutral-300"
      }`}
    >
      {label}
    </button>
  );
}

function MarketTab({ state }: { state: GameState }) {
  const cells = [
    {
      label: "Bourbon",
      sublabel: "doomsday",
      value: state.bourbonDeck.length,
      tone: "amber",
    },
    {
      label: "Market supply",
      sublabel: "face-down",
      value: state.marketSupplyDeck.length,
      tone: "neutral",
    },
    {
      label: "Market discard",
      sublabel: "for reshuffle",
      value: state.marketDiscard.length,
      tone: "neutral",
    },
  ];
  return (
    <div className="space-y-2">
      <p className="text-[11px] text-neutral-500 mb-3 leading-relaxed">
        Drawing the last bourbon from the deck triggers the final round.
      </p>
      {cells.map((c) => (
        <div
          key={c.label}
          className="rounded border border-neutral-800 bg-neutral-900 px-3 py-2 flex items-center justify-between"
        >
          <div>
            <div className="text-sm font-medium">{c.label}</div>
            <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
              {c.sublabel}
            </div>
          </div>
          <span
            className={`text-2xl font-semibold tabular-nums ${
              c.tone === "amber" ? "text-amber-400" : "text-neutral-200"
            }`}
          >
            {c.value}
          </span>
        </div>
      ))}
    </div>
  );
}

function BaronsTab({
  state,
  scores,
}: {
  state: GameState;
  scores: ScoreResult[] | null;
}) {
  return (
    <div className="space-y-2">
      {state.players.map((p, i) => {
        const color = colorFor(i);
        const rank = scores?.find((s) => s.playerId === p.id)?.rank ?? null;
        const isCurrent =
          state.phase === "action" && i === state.currentPlayerIndex;
        return (
          <div
            key={p.id}
            className={`rounded border px-3 py-2.5 transition ${
              isCurrent
                ? `${color.avatarBorder} bg-neutral-900`
                : "border-neutral-800 bg-neutral-900/60"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-5 h-5 rounded-full ${color.avatarBg} flex items-center justify-center text-[10px] font-bold text-white`}
                >
                  {p.name.slice(0, 1)}
                </div>
                <span className="text-sm font-medium">{p.name}</span>
                {rank !== null && (
                  <span className="text-[10px] text-amber-400 font-semibold">
                    #{rank}
                  </span>
                )}
              </div>
              <span className="text-amber-400 font-semibold tabular-nums">
                {p.reputation}
                <span className="text-[10px] text-neutral-500 ml-0.5">rep</span>
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5 text-[11px]">
              <Stat label="hand" value={p.hand.length} />
              <Stat label="deck" value={p.deck.length} />
              <Stat label="discard" value={p.discard.length} />
              <Stat label="trashed" value={p.trashed.length} />
            </div>
            <div className="mt-2 flex items-center gap-3 text-[11px] text-neutral-400">
              <span title={p.mashBills.map((m) => m.name).join(", ")}>
                📜 <span className="text-neutral-200">{p.mashBills.length}</span> bills
              </span>
              <span>
                🥇 <span className="text-neutral-200">{p.unlockedGoldBourbons.length}</span> gold
              </span>
              <span>
                🛢 <span className="text-neutral-200">{p.barrelsSold}</span> sold
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-neutral-500 uppercase tracking-wide text-[9px]">
        {label}
      </span>
      <span className="text-neutral-200 tabular-nums">{value}</span>
    </div>
  );
}
