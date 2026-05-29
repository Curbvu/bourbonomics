"use client";

/**
 * v3.6 RaidDefenseModal — defender's blind X declaration.
 *
 * Self-gates on `state.pendingRaid?.defenderId === humanSeatPlayerId`.
 * When a human seat is the target of a Whiskey Raid, this modal
 * blocks every other interaction until the defender picks how many
 * cards to discard as defense (X ≥ 0, declared before any dice are
 * rolled) and dispatches RAID_DEFENSE_DECLARE.
 *
 * Engine resolves the dice contest inside that apply step:
 *   - Roll defender 2d6.
 *   - defenderTotal = roll + X + count(watchman investment).
 *   - attackerTotal = state.pendingRaid.attackerRoll.
 *   - Defender wins ties.
 *   - Attacker wins → barrel transfers.
 *   - Discarded cards are lost regardless of outcome.
 *
 * Strategy hints are surfaced in the panel: attacker's odds at this
 * specific X, count of Watchmen the defender owns, the targeted
 * barrel's name + age. The defender clicks cards in their hand to
 * add/remove from the discard pile (multi-select), then Submit.
 */

import { useEffect, useState } from "react";
import type { Card, GameAction } from "@bourbonomics/engine";
import { useGameStore } from "@/lib/store/game";

export default function RaidDefenseModal() {
  const { state, humanSeatPlayerId, dispatch } = useGameStore();
  const raid = state?.pendingRaid ?? null;
  const isTarget = !!(raid && raid.defenderId === humanSeatPlayerId);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isTarget) setSelectedIds([]);
  }, [isTarget, raid?.targetBarrelId]);

  if (!state || !raid || !isTarget) return null;

  const defender = state.players.find((p) => p.id === raid.defenderId);
  const attacker = state.players.find((p) => p.id === raid.attackerId);
  const barrel = state.allBarrels.find((b) => b.id === raid.targetBarrelId);
  if (!defender || !attacker || !barrel) return null;

  const watchmanCount = defender.investments.filter(
    (i) => i.defId === "watchman",
  ).length;
  const X = selectedIds.length;
  // Attacker's odds = P(attackerRoll > 2d6 + X + watchman). We can
  // estimate this against the 2d6 distribution: for each (a,b)
  // defender pair the defender wins ties if (a+b)+X+W ≥ attackerRoll.
  // There are 36 equiprobable defender outcomes; count the favorable.
  const defenderWins = (() => {
    let wins = 0;
    for (let a = 1; a <= 6; a++) {
      for (let b = 1; b <= 6; b++) {
        if (a + b + X + watchmanCount >= raid.attackerRoll) wins++;
      }
    }
    return wins;
  })();
  const defenderWinPct = Math.round((defenderWins / 36) * 100);
  const attackerWinPct = 100 - defenderWinPct;

  const toggle = (id: string) =>
    setSelectedIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );

  const submit = () => {
    const action: GameAction = {
      type: "RAID_DEFENSE_DECLARE",
      defenderId: defender.id,
      discardCardIds: selectedIds,
    };
    dispatch(action);
    setSelectedIds([]);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Defend against Whiskey Raid"
      className="fixed inset-0 z-[58] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur"
    >
      <div className="relative flex max-h-[calc(100vh-2rem)] w-full max-w-[860px] flex-col gap-3 overflow-hidden rounded-xl border border-rose-700/60 bg-gradient-to-b from-rose-950/40 via-slate-950 to-slate-900/95 px-5 py-4 shadow-[0_24px_64px_rgba(0,0,0,.65)]">
        <header className="flex flex-shrink-0 items-start justify-between gap-4 border-b border-rose-900/40 pb-3">
          <div className="min-w-0 flex-1">
            <div className="font-mono text-[12px] uppercase tracking-[.18em] text-rose-300">
              Whiskey Raid — Defense
            </div>
            <div className="mt-1 font-display text-2xl font-semibold text-rose-100">
              {attacker.name} is raiding {barrel.attachedMashBill.name}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[.12em] text-slate-300">
              Age {barrel.age}y · Attacker rolled{" "}
              <span className="font-bold text-amber-200">{raid.attackerRoll}</span>{" "}
              · Pick cards to discard as defense, then Submit
            </div>
          </div>
        </header>

        {/* Odds panel */}
        <section className="flex flex-shrink-0 items-stretch gap-3 rounded-lg border border-rose-800/40 bg-slate-950/60 px-3 py-2">
          <Stat label="X (discarded)" value={String(X)} tone="amber" />
          <Stat
            label="Watchmen"
            value={String(watchmanCount)}
            tone={watchmanCount > 0 ? "emerald" : "slate"}
          />
          <Stat
            label="Defender bonus"
            value={`+${X + watchmanCount}`}
            tone="amber"
          />
          <span aria-hidden className="w-px self-stretch bg-rose-900/40" />
          <Stat
            label="You win odds"
            value={`${defenderWinPct}%`}
            tone={defenderWinPct >= 50 ? "emerald" : "rose"}
            big
          />
          <Stat
            label={`${attacker.name}'s odds`}
            value={`${attackerWinPct}%`}
            tone={attackerWinPct >= 50 ? "rose" : "slate"}
            big
          />
        </section>

        {/* Hand — pick cards to discard as defense. Every card costs
            real material; the defender's choice is the table moment. */}
        <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
          <header className="flex items-baseline gap-2">
            <span className="font-mono text-[10.5px] font-bold uppercase tracking-[.18em] text-rose-300">
              Your hand — click to add to defense
            </span>
            <span className="font-mono text-[11px] italic text-slate-400">
              Discarded cards are lost regardless of outcome
            </span>
          </header>
          <div className="flex flex-1 flex-wrap gap-2 overflow-y-auto">
            {defender.hand.length === 0 ? (
              <span className="rounded border border-dashed border-slate-700/60 px-3 py-2 font-mono text-[11px] italic text-slate-500">
                Hand is empty — roll naked at X = 0
              </span>
            ) : (
              defender.hand.map((c) => (
                <HandCardChoice
                  key={c.id}
                  card={c}
                  active={selectedIds.includes(c.id)}
                  onClick={() => toggle(c.id)}
                />
              ))
            )}
          </div>
        </section>

        <footer className="flex flex-shrink-0 items-center justify-end gap-2 border-t border-rose-900/40 pt-3">
          <span className="mr-auto font-mono text-[10.5px] uppercase tracking-[.14em] text-slate-400">
            Submit declares X = {X}. Engine rolls + resolves.
          </span>
          <button
            type="button"
            onClick={submit}
            className="rounded-md border border-amber-400 bg-gradient-to-b from-amber-300 to-amber-500 px-5 py-1.5 font-mono text-[12px] font-bold uppercase tracking-[.14em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.25)] hover:brightness-110"
          >
            Submit defense ↵
          </button>
        </footer>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone: "amber" | "emerald" | "rose" | "slate";
  big?: boolean;
}) {
  const ink =
    tone === "amber"
      ? "text-amber-300"
      : tone === "emerald"
        ? "text-emerald-300"
        : tone === "rose"
          ? "text-rose-300"
          : "text-slate-300";
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-0.5 px-2">
      <span className="font-mono text-[8.5px] font-bold uppercase tracking-[.16em] text-slate-400">
        {label}
      </span>
      <span
        className={[
          "font-display font-bold tabular-nums",
          big ? "text-[22px]" : "text-[16px]",
          ink,
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

function HandCardChoice({
  card,
  active,
  onClick,
}: {
  card: Card;
  active: boolean;
  onClick: () => void;
}) {
  const label = card.displayName ?? cardLabel(card);
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "rounded border px-2.5 py-1.5 text-left font-display text-[12px] transition-colors",
        active
          ? "border-amber-400 bg-amber-900/30 text-amber-100"
          : "border-slate-700/55 bg-slate-950/60 text-slate-200 hover:border-amber-500/60 hover:bg-amber-950/20",
      ].join(" ")}
    >
      <div className="font-semibold">{label}</div>
      <div className="font-mono text-[9px] uppercase tracking-[.1em] text-slate-500">
        {cardLabel(card)}
      </div>
    </button>
  );
}

function cardLabel(card: Card): string {
  if (card.type === "resource") {
    return `${card.specialty ? "Specialty " : ""}${card.subtype ?? "Resource"}`;
  }
  if (card.type === "labor") return `Labor · ${card.laborSubtype ?? ""}`.trim();
  if (card.type === "operations") return "Ops";
  if (card.type === "investment") return "Investment";
  return card.type;
}
