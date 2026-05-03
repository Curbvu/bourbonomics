"use client";

/**
 * FeesModal — modal that combines the post-market recap (round N-1) with
 * the human's Phase 1 rent decision into one focused step. Replaces the
 * old inline MarketRecapPanel + FeesPanel.
 *
 * - Round 1 has no recap (recapRound = 0); only the rent UI shows.
 * - The modal blocks the rest of the dashboard until the player resolves
 *   their fees (Pay & age, Continue when there are no barrels, or
 *   Skip rent when their loan is frozen).
 */

import { useMemo, useState } from "react";

import { MARKET_CARDS_BY_ID } from "@/lib/engine/decks";
import { feesForPlayer, totalFeesForPlayer } from "@/lib/rules/fees";
import { useGameStore } from "@/lib/store/gameStore";
import {
  DISTRESSED_LOAN_AMOUNT,
  DISTRESSED_LOAN_REPAYMENT,
} from "@/lib/engine/state";
import PlayerSwatch from "./PlayerSwatch";

type RecapEntry = {
  playerId: string;
  cardId: string | null;
  kind:
    | "demand_delta"
    | "shortage"
    | "flavor"
    | "exhausted"
    | "unknown";
  summary: string;
};

export default function FeesModal() {
  const state = useGameStore((s) => s.state);
  const dispatch = useGameStore((s) => s.dispatch);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const humanId = state?.playerOrder.find(
    (id) => state.players[id].kind === "human",
  );

  const recapRound = state ? state.round - 1 : 0;
  const entries = useMemo<RecapEntry[]>(() => {
    if (!state) return [];
    if (state.phase !== "fees") return [];
    if (recapRound < 1) return [];
    const byPlayer = new Map<string, RecapEntry>();
    const orderSeq = new Map<string, number>();
    const seen: RecapEntry[] = [];
    for (const e of state.log) {
      if (e.round !== recapRound) continue;
      if (
        e.kind !== "market_demand_change" &&
        e.kind !== "market_shortage_queued" &&
        e.kind !== "market_flavor" &&
        e.kind !== "market_keep_unknown" &&
        e.kind !== "market_deck_exhausted"
      ) {
        continue;
      }
      const playerId = String(e.data.playerId ?? "");
      if (!playerId) continue;
      if (byPlayer.has(playerId)) continue;
      const entry = renderEvent(e.kind, e.data);
      const recap: RecapEntry = { playerId, ...entry };
      byPlayer.set(playerId, recap);
      orderSeq.set(playerId, e.at);
      seen.push(recap);
    }
    return seen.sort(
      (a, b) =>
        (orderSeq.get(a.playerId) ?? 0) - (orderSeq.get(b.playerId) ?? 0),
    );
  }, [state, recapRound]);

  if (!state) return null;
  if (state.phase !== "fees") return null;
  if (!humanId) return null;
  const me = state.players[humanId];
  const alreadyResolved = state.feesPhase.resolvedPlayerIds.includes(humanId);
  if (alreadyResolved) return null;

  const fees = feesForPlayer(state, humanId);
  const totalOwed = totalFeesForPlayer(state, humanId);
  const loanEligible =
    !me.loanUsed && me.loanRemaining === 0 && me.cash < totalOwed;
  const loanFrozen = me.loanSiphonActive;

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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Phase 1 — fees"
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/75 p-6"
    >
      <div
        role="document"
        className="relative my-auto flex w-full max-w-2xl flex-col gap-4 rounded-xl border-2 border-amber-500 bg-slate-900 p-6 shadow-[0_12px_40px_rgba(0,0,0,.7),0_0_0_4px_rgba(245,158,11,0.30)]"
      >
        <header className="flex items-baseline justify-between gap-3">
          <div>
            <div className="font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">
              Round {state.round} · Phase 1
            </div>
            <h2 className="font-display text-xl font-semibold leading-tight text-amber-100">
              Rickhouse fees
            </h2>
          </div>
          <span className="font-mono text-[11px] uppercase tracking-[.12em] text-slate-400">
            cash on hand{" "}
            <span className="font-bold tabular-nums text-emerald-400">
              ${me.cash}
            </span>
          </span>
        </header>

        {entries.length > 0 ? (
          <section className="rounded-md border border-amber-700/50 bg-slate-950/70 px-3.5 py-3">
            <div className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[.18em] text-amber-300">
              Round {recapRound} · market resolved
            </div>
            <ol className="space-y-1.5">
              {entries.map((entry) => {
                const player = state.players[entry.playerId];
                const cardName =
                  entry.cardId && MARKET_CARDS_BY_ID[entry.cardId]
                    ? MARKET_CARDS_BY_ID[entry.cardId].title
                    : null;
                const kindBadge = (() => {
                  switch (entry.kind) {
                    case "demand_delta":
                      return {
                        className:
                          "border-amber-500/55 bg-amber-700/[0.20] text-amber-200",
                        label: "demand",
                      };
                    case "shortage":
                      return {
                        className:
                          "border-rose-500/55 bg-rose-700/[0.20] text-rose-200",
                        label: "shortage",
                      };
                    case "flavor":
                      return {
                        className:
                          "border-slate-600 bg-slate-800 text-slate-300",
                        label: "flavor",
                      };
                    case "exhausted":
                      return {
                        className:
                          "border-slate-600 bg-slate-800 text-slate-400",
                        label: "no draw",
                      };
                    default:
                      return {
                        className:
                          "border-slate-600 bg-slate-800 text-slate-400",
                        label: "unknown",
                      };
                  }
                })();
                return (
                  <li
                    key={entry.playerId}
                    className="flex flex-wrap items-center gap-2 font-mono text-[11px]"
                  >
                    <PlayerSwatch
                      seatIndex={player?.seatIndex ?? 0}
                      logoId={player?.logoId}
                      size="sm"
                    />
                    <span className="font-semibold text-amber-100">
                      {player?.name ?? entry.playerId}
                    </span>
                    <span
                      className={[
                        "rounded border px-1.5 py-px font-mono text-[9px] uppercase tracking-[.12em]",
                        kindBadge.className,
                      ].join(" ")}
                    >
                      {kindBadge.label}
                    </span>
                    {cardName ? (
                      <span className="text-slate-300">kept</span>
                    ) : null}
                    {cardName ? (
                      <span className="font-semibold text-slate-100">
                        &ldquo;{cardName}&rdquo;
                      </span>
                    ) : null}
                    <span className="text-slate-400">— {entry.summary}</span>
                  </li>
                );
              })}
            </ol>
          </section>
        ) : null}

        {fees.length === 0 ? (
          <section>
            <p className="mb-3 font-mono text-[11px] uppercase tracking-[.12em] text-slate-400">
              No barrels to age this year.
            </p>
            <div className="flex justify-end">
              <PrimaryButton
                onClick={() =>
                  dispatch({ t: "PAY_FEES", playerId: humanId, barrelIds: [] })
                }
              >
                Continue ↵
              </PrimaryButton>
            </div>
          </section>
        ) : (
          <section>
            <p className="mb-3 font-mono text-[11px] tracking-[.04em] text-slate-400">
              Click a barrel to skip it (it won&apos;t age this round, no
              penalty).
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
                Distressed loan in arrears — every dollar of income is
                automatically siphoned to the bank, and you cannot spend on
                rent, capital, or actions until the remaining ${me.loanRemaining}{" "}
                clears.
              </p>
            ) : null}

            <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
                        : "border-slate-700 bg-slate-950 text-slate-200 hover:border-amber-500/60 hover:bg-amber-700/[0.18]"
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
                    barrelIds: loanFrozen
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
          </section>
        )}
      </div>
    </div>
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

function renderEvent(
  kind: string,
  data: Record<string, unknown>,
): { cardId: string | null; kind: RecapEntry["kind"]; summary: string } {
  const num = (k: string) =>
    typeof data[k] === "number" ? (data[k] as number) : null;
  const str = (k: string) =>
    typeof data[k] === "string" ? (data[k] as string) : null;
  const cardId = str("cardId");

  if (kind === "market_demand_change") {
    const delta = num("delta");
    const before = num("before");
    const after = num("after");
    const sign = delta != null ? (delta >= 0 ? `+${delta}` : `${delta}`) : "?";
    return {
      cardId,
      kind: "demand_delta",
      summary:
        before != null && after != null
          ? `demand ${sign} (${before} → ${after})`
          : `demand ${sign}`,
    };
  }
  if (kind === "market_shortage_queued") {
    const resource = str("resource") ?? "?";
    return {
      cardId,
      kind: "shortage",
      summary: `${resource} shortage queued for next round`,
    };
  }
  if (kind === "market_flavor") {
    return {
      cardId,
      kind: "flavor",
      summary: "flavor card — no mechanical effect",
    };
  }
  if (kind === "market_keep_unknown") {
    return {
      cardId,
      kind: "unknown",
      summary: "kept an unknown market card",
    };
  }
  if (kind === "market_deck_exhausted") {
    return {
      cardId: null,
      kind: "exhausted",
      summary: "market deck was empty — no draw",
    };
  }
  return {
    cardId,
    kind: "unknown",
    summary: kind,
  };
}
