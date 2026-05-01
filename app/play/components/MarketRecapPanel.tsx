"use client";

/**
 * MarketRecapPanel — post-market summary card.
 *
 * Renders during the start of a round's fees phase (round > 1) to show
 * what every baron picked from the market in the round that just ended.
 * The bot-driven market phase resolves in microseconds without any
 * visible per-player choice, so without this recap players would only
 * see a sudden "demand jumped, a shortage appeared" with no context.
 *
 * The component is purely log-derived — it inspects `state.log` for
 * `market_*` events with `round = state.round - 1` and groups them by
 * player. Dismissed state lives in the UI store keyed by the round
 * being recapped, so the panel doesn't reappear after the player
 * acknowledges it.
 */

import { useMemo } from "react";

import { MARKET_CARDS_BY_ID } from "@/lib/engine/decks";
import { useGameStore } from "@/lib/store/gameStore";
import { useUiStore } from "@/lib/store/uiStore";
import { PLAYER_BG_CLASS, paletteIndex } from "./playerColors";

type RecapEntry = {
  playerId: string;
  cardId: string | null;
  kind:
    | "demand_delta"
    | "shortage"
    | "flavor"
    | "exhausted"
    | "unknown";
  /** One-line human-readable summary of what happened. */
  summary: string;
};

export default function MarketRecapPanel() {
  const state = useGameStore((s) => s.state)!;
  const dismissedForRound = useUiStore((s) => s.dismissedMarketRecapForRound);
  const dismiss = useUiStore((s) => s.dismissMarketRecap);

  // Show the recap only during fees phase of round 2+ (i.e. when a
  // market phase JUST resolved) and only until the player dismisses it.
  const recapRound = state.round - 1;
  const visible =
    state.phase === "fees" &&
    recapRound >= 1 &&
    dismissedForRound !== recapRound;

  // Build the recap from the log every render — cheap, log is ~40-80
  // entries per round. We collect at most one entry per player per
  // round (the "kept" card resolution), preserving market draw order
  // by sorting on `at`.
  const entries = useMemo<RecapEntry[]>(() => {
    if (!visible) return [];
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
      const existing = byPlayer.get(playerId);
      if (existing) continue; // first market resolution wins
      const entry = renderEvent(e.kind, e.data);
      const recap: RecapEntry = { playerId, ...entry };
      byPlayer.set(playerId, recap);
      orderSeq.set(playerId, e.at);
      seen.push(recap);
    }
    // Stable order: by event sequence (when they actually resolved).
    return seen.sort(
      (a, b) =>
        (orderSeq.get(a.playerId) ?? 0) - (orderSeq.get(b.playerId) ?? 0),
    );
  }, [visible, state.log, recapRound]);

  if (!visible || entries.length === 0) return null;

  return (
    <section className="rounded-md border border-amber-600/60 bg-slate-900/85 p-3 shadow-[0_4px_24px_rgba(0,0,0,.4)]">
      <header className="mb-2 flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[.18em] text-amber-300">
          Round {recapRound} · market resolved
        </h2>
        <button
          type="button"
          onClick={() => dismiss(recapRound)}
          className="rounded border border-amber-700 bg-amber-700/[0.20] px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[.12em] text-amber-100 transition-colors hover:bg-amber-700/[0.35]"
        >
          dismiss ↵
        </button>
      </header>
      <ol className="space-y-1.5">
        {entries.map((entry) => {
          const player = state.players[entry.playerId];
          const seatIdx = paletteIndex(player?.seatIndex ?? 0);
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
              className="flex items-center gap-2 font-mono text-[11px]"
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold leading-none text-white ring-2 ring-slate-950 ${PLAYER_BG_CLASS[seatIdx]}`}
                aria-hidden
              >
                {player?.name?.[0]?.toUpperCase() ?? "?"}
              </span>
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
