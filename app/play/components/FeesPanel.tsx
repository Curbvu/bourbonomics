"use client";

/**
 * FeesPanel — surfaces the human's Phase 1 rent decision.
 *
 * Each barrel becomes a toggleable tile (pay → ages, skip → doesn't age,
 * no penalty per current rules). When the player can't cover their full
 * bill, a one-time Distressed Distiller's Loan ($10 borrow / $15 repay
 * next Phase 1) is offered.
 *
 * Restyled in the dashboard's panel chrome: slate-900/70 panel, mono
 * caption header, amber primary "Pay & age" gradient button matching the
 * HandTray End-turn button.
 */

import { useState } from "react";

import { feesForPlayer, totalFeesForPlayer } from "@/lib/rules/fees";
import { useGameStore } from "@/lib/store/gameStore";
import {
  DISTRESSED_LOAN_AMOUNT,
  DISTRESSED_LOAN_REPAYMENT,
} from "@/lib/engine/state";

export default function FeesPanel() {
  const state = useGameStore((s) => s.state)!;
  const dispatch = useGameStore((s) => s.dispatch);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const humanId = state.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );
  if (!humanId) return null;
  const me = state.players[humanId];
  const alreadyResolved = state.feesPhase.resolvedPlayerIds.includes(humanId);
  if (alreadyResolved) return null;

  const fees = feesForPlayer(state, humanId);
  const totalOwed = totalFeesForPlayer(state, humanId);
  const loanEligible =
    !me.loanUsed && me.loanRemaining === 0 && me.cash < totalOwed;
  const loanFrozen = me.loanSiphonActive;

  if (fees.length === 0) {
    return (
      <PanelShell title="Phase 1 · Rickhouse fees">
        <p className="mb-3 font-mono text-[11px] uppercase tracking-[.12em] text-slate-500">
          No barrels to age this year.
        </p>
        <PrimaryButton
          onClick={() =>
            dispatch({ t: "PAY_FEES", playerId: humanId, barrelIds: [] })
          }
        >
          Continue ↵
        </PrimaryButton>
      </PanelShell>
    );
  }

  const toggle = (id: string) => {
    setSkipped((cur) => {
      const set = new Set(cur);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      return set;
    });
  };

  const pay = fees
    .filter((f) => !skipped.has(f.barrelId))
    .reduce((s, f) => s + f.amount, 0);

  return (
    <PanelShell title="Phase 1 · Rickhouse fees">
      <p className="mb-3 font-mono text-[11px] tracking-[.04em] text-slate-400">
        Click a barrel to skip it (it won&apos;t age this round, no penalty).
        Cash on hand:{" "}
        <span className="font-bold tabular-nums text-emerald-400">
          ${me.cash}
        </span>
        .
        {me.loanRemaining > 0 ? (
          <span
            className={[
              "ml-2 inline-block rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[.12em]",
              loanFrozen
                ? "border-rose-600 bg-rose-700/[0.25] text-rose-200"
                : "border-amber-700 bg-amber-700/[0.20] text-amber-200",
            ].join(" ")}
          >
            {loanFrozen ? "FROZEN · " : "loan · "}${me.loanRemaining} owed
          </span>
        ) : null}
      </p>
      {loanFrozen ? (
        <p className="mb-3 rounded border border-rose-600/60 bg-rose-950/30 px-3 py-2 font-mono text-[11px] text-rose-200">
          Distressed loan in arrears — every dollar of income is automatically
          siphoned to the bank, and you cannot spend on rent, capital, or
          actions until the remaining ${me.loanRemaining} clears.
        </p>
      ) : null}

      <div className="mb-3 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {fees.map((fee) => {
          const sk = skipped.has(fee.barrelId);
          return (
            <button
              key={fee.barrelId}
              type="button"
              onClick={() => toggle(fee.barrelId)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 font-mono text-[11px] transition-colors ${
                sk
                  ? "border-rose-600/60 bg-rose-950/30 text-rose-200 hover:bg-rose-950/50"
                  : "border-slate-700 bg-slate-900 text-slate-200 hover:border-amber-500/60 hover:bg-amber-700/[0.18]"
              }`}
            >
              <span className="text-[11px] uppercase tracking-[.05em]">
                {fee.rickhouseId.replace("rickhouse-", "#")}
                <span className="ml-1 text-[10px] tracking-normal text-slate-500">
                  {fee.barrelId}
                </span>
              </span>
              <span className="font-bold tabular-nums">
                {fee.monopolyWaived
                  ? "$0"
                  : sk
                    ? "skip"
                    : `$${fee.amount}`}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[.12em] text-slate-500">
          pay now:{" "}
          <span className="font-bold tabular-nums text-emerald-400">
            ${pay}
          </span>
        </span>
        {loanEligible ? (
          <button
            type="button"
            onClick={() =>
              dispatch({ t: "TAKE_DISTRESSED_LOAN", playerId: humanId })
            }
            title={`Borrow $${DISTRESSED_LOAN_AMOUNT} now, repay $${DISTRESSED_LOAN_REPAYMENT} at the start of next Phase 1. Once per game; the $5 interest is permanent. Lingering debt freezes you out of cash flow.`}
            className="rounded border border-amber-500/60 bg-amber-700/[0.20] px-3 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[.05em] text-amber-100 transition-colors hover:bg-amber-700/[0.35]"
          >
            Distressed Loan +${DISTRESSED_LOAN_AMOUNT}
          </button>
        ) : null}
        {me.loanUsed && me.loanRemaining === 0 ? (
          <span className="font-mono text-[10px] uppercase tracking-[.12em] text-slate-500">
            loan already used
          </span>
        ) : null}
        <span className="ml-auto" />
        <PrimaryButton
          onClick={() =>
            dispatch({
              t: "PAY_FEES",
              playerId: humanId,
              barrelIds:
                loanFrozen
                  ? []
                  : fees
                      .filter((f) => !skipped.has(f.barrelId))
                      .map((f) => f.barrelId),
            })
          }
          disabled={!loanFrozen && pay > me.cash}
        >
          {loanFrozen ? "Skip rent ↵" : "Pay & age ↵"}
        </PrimaryButton>
      </div>
    </PanelShell>
  );
}

function PanelShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900/70 p-4">
      <h2 className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-amber-300">
        {title}
      </h2>
      {children}
    </section>
  );
}

function PrimaryButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md border border-amber-700 bg-gradient-to-b from-amber-500 to-amber-700 px-3.5 py-1.5 font-sans text-xs font-bold uppercase tracking-[.05em] text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,.2)] transition-colors hover:from-amber-400 hover:to-amber-600 disabled:cursor-not-allowed disabled:border-slate-700 disabled:from-slate-700 disabled:to-slate-800 disabled:text-slate-500 disabled:shadow-none"
    >
      {children}
    </button>
  );
}
