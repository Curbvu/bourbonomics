"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { rickhouseRegionLabel } from "@/lib/rickhouses";
import type { BourbonSaleReveal } from "@/lib/bourbonCards";
import {
  isCaskResource,
  isSmallGrainResource,
  resourceBaseKind,
} from "@/lib/resource-card-resolve";
import {
  getResourceCardFace,
  getResourceCardTier,
  handResourceChipClassNames,
  mashPillForResourceCard,
} from "@/lib/resource-card-ui";
import {
  type GameDoc,
  type MarketDemandHistoryEntry,
  nextActionCashCost,
  previewRickhouseFeesForPlayer,
  previewSaleProceeds,
  handHasMashForBarrel,
  isValidMashSelection,
  getLobbySeatsForDisplay,
  lobbyHasUnfilledOpenSeat,
  countSeatedBarons,
  gameModeDisplayLabel,
} from "../../../functions/lib/game";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

/** Minimum time to show demand dice cycling before revealing the server roll. */
const DEMAND_ROLL_ANIM_MIN_MS = 1100;
/** After the roll is shown, auto-advance to Action phase after this many ms (current baron only). */
const PHASE_2_TO_3_DELAY_MS = 3000;

function isBotPlayer(id: string): boolean {
  return id.startsWith("bot_");
}

function randomD6(): number {
  return Math.floor(Math.random() * 6) + 1;
}

function DemandDiceFaces(props: {
  left: number | "?";
  right: number | "?";
  after: ReactNode;
  className?: string;
  announceLabel?: string;
  /** Rapidly cycling faces (rolling animation). */
  rolling?: boolean;
}) {
  const { left, right, after, className, announceLabel, rolling } = props;
  const dieClass =
    "flex h-12 w-12 items-center justify-center rounded-lg border-2 border-indigo-500 bg-white text-2xl font-bold tabular-nums shadow-inner transition-transform dark:border-indigo-400 dark:bg-slate-800/40";
  return (
    <div
      className={`flex flex-wrap items-center gap-3 text-slate-800 dark:text-slate-100 ${className ?? ""}`}
      role={announceLabel ? "region" : undefined}
      aria-label={announceLabel}
    >
      <span
        className={`${dieClass} ${rolling ? "motion-safe:animate-pulse motion-safe:ring-2 motion-safe:ring-indigo-400/50" : ""}`}
        style={rolling ? { animationDuration: "0.45s" } : undefined}
      >
        {left}
      </span>
      <span className="text-lg font-medium">+</span>
      <span
        className={`${dieClass} ${rolling ? "motion-safe:animate-pulse motion-safe:ring-2 motion-safe:ring-indigo-400/50" : ""}`}
        style={rolling ? { animationDuration: "0.55s" } : undefined}
      >
        {right}
      </span>
      <span className="min-w-0 text-sm leading-snug text-slate-600 dark:text-slate-200">
        {after}
      </span>
    </div>
  );
}

type BourbonGridRevealPhase = "idle" | "demand" | "age" | "cell" | "done";

function BourbonSaleExperience(props: {
  sale: BourbonSaleReveal;
  onDismiss: () => void;
}) {
  const { sale, onDismiss } = props;
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const [gridPhase, setGridPhase] = useState<BourbonGridRevealPhase>("idle");
  const [payoutVisible, setPayoutVisible] = useState(false);
  const [autoCloseSecs, setAutoCloseSecs] = useState<number | null>(null);

  const timersRef = useRef<{ timeouts: number[]; interval?: number }>({
    timeouts: [],
  });

  const clearTimers = useCallback(() => {
    for (const id of timersRef.current.timeouts) window.clearTimeout(id);
    timersRef.current.timeouts = [];
    if (timersRef.current.interval != null) {
      window.clearInterval(timersRef.current.interval);
      timersRef.current.interval = undefined;
    }
  }, []);

  const dismiss = useCallback(() => {
    clearTimers();
    onDismissRef.current();
  }, [clearTimers]);

  useEffect(() => {
    clearTimers();
    setGridPhase("idle");
    setPayoutVisible(false);
    setAutoCloseSecs(null);

    const push = (fn: () => void, ms: number) => {
      timersRef.current.timeouts.push(window.setTimeout(fn, ms));
    };

    const isGrid = sale.payoutSource === "grid";

    if (isGrid) {
      push(() => setGridPhase("demand"), 420);
      push(() => setGridPhase("age"), 920);
      push(() => setGridPhase("cell"), 1420);
      push(() => setGridPhase("done"), 1980);
      push(() => setPayoutVisible(true), 2080);
    } else {
      push(() => setGridPhase("age"), 420);
      push(() => setGridPhase("done"), 980);
      push(() => setPayoutVisible(true), 1080);
    }

    push(() => {
      let n = 5;
      setAutoCloseSecs(n);
      timersRef.current.interval = window.setInterval(() => {
        n -= 1;
        if (n <= 0) {
          if (timersRef.current.interval != null) {
            window.clearInterval(timersRef.current.interval);
            timersRef.current.interval = undefined;
          }
          setAutoCloseSecs(null);
          onDismissRef.current();
        } else {
          setAutoCloseSecs(n);
        }
      }, 1000);
    }, 10_000);

    return () => clearTimers();
  }, [sale, clearTimers]);

  const rarityTone =
    sale.rarity === "Rare"
      ? "border-violet-400/70 bg-violet-500/15 text-violet-100"
      : "border-amber-400/60 bg-amber-500/15 text-amber-50";

  const showDemandPulse =
    sale.payoutSource === "grid" &&
    (gridPhase === "demand" || gridPhase === "age" || gridPhase === "cell" || gridPhase === "done");
  const showAgePulse =
    gridPhase === "age" || gridPhase === "cell" || gridPhase === "done";
  const showCellReveal =
    sale.payoutSource === "grid" && (gridPhase === "cell" || gridPhase === "done");

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="bourbon-sale-title"
      className="bourbon-sale-backdrop fixed inset-0 z-[200] flex cursor-pointer items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md"
      onClick={dismiss}
    >
      <div
        className="bourbon-sale-card relative max-h-[92vh] w-full min-w-0 max-w-lg cursor-pointer overflow-x-hidden overflow-y-auto rounded-2xl border-2 border-amber-500/50 bg-gradient-to-b from-amber-950/90 via-slate-950 to-slate-950 p-5 text-slate-100 shadow-[0_0_55px_rgba(245,158,11,0.22)] ring-1 ring-amber-400/20 sm:p-6"
        onClick={dismiss}
      >
        <div
          className="bourbon-sale-shine pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          aria-hidden
        >
          <div className="absolute inset-y-0 left-0 w-2/5 bg-gradient-to-r from-amber-300/25 to-transparent opacity-30" />
        </div>

        <div className="relative">
          <p className="text-center text-[10px] font-bold uppercase tracking-[0.28em] text-amber-200/90">
            Bourbon card drawn
          </p>
          <h2
            id="bourbon-sale-title"
            className="bourbon-sale-title-reveal mt-2 text-center font-serif text-2xl font-semibold leading-tight text-amber-50 sm:text-3xl"
          >
            {sale.bourbonName}
          </h2>
          <div
            className="bourbon-sale-title-reveal mt-3 flex flex-wrap items-center justify-center gap-2"
            style={{ animationDelay: "0.22s" }}
          >
            <span
              className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${rarityTone}`}
            >
              {sale.rarity}
            </span>
            <span className="rounded-full border border-slate-600/80 bg-slate-900/80 px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
              #{sale.bourbonYamlId}
            </span>
            <span className="rounded-full border border-slate-600/80 bg-slate-900/80 px-2.5 py-0.5 text-[10px] text-slate-300">
              Barrel {sale.barrelAge}y · Demand {sale.marketDemandAtSale} at sale
            </span>
          </div>

          <div
            className={`bourbon-sale-grid-veil relative mt-5 min-w-0 overflow-x-hidden rounded-xl border border-amber-900/50 bg-black/35 p-3 ${gridPhase === "idle" ? "opacity-70 blur-[1px]" : ""}`}
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-amber-200/80">
              Price guide ($)
            </p>
            <table className="w-full min-w-0 table-fixed border-collapse text-center text-[10px] sm:text-[11px]">
              <thead>
                <tr>
                  <th className="w-[22%] border border-slate-700/80 bg-slate-900/90 px-1 py-1.5 text-[8px] font-semibold uppercase tracking-wide text-slate-500 sm:px-1.5 sm:text-[9px]">
                    Age \ Demand
                  </th>
                  {sale.demandBandHeaders.map((label, ci) => {
                    const isCol =
                      sale.payoutSource === "grid" && sale.usedCol === ci && showDemandPulse;
                    return (
                      <th
                        key={`${label}-${ci}`}
                        className={`border border-slate-700/80 px-1 py-1.5 text-[8px] font-bold leading-tight break-words whitespace-pre-line transition-all duration-500 sm:px-1.5 sm:text-[9px] ${
                          isCol
                            ? "bourbon-sale-reveal-pulse bg-amber-500/30 text-amber-50 ring-1 ring-amber-400/70"
                            : "bg-slate-900/90 text-slate-300"
                        }`}
                      >
                        {label.replace(" (", "\n(")}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sale.grid.map((row, ri) => (
                  <tr key={ri}>
                    <th
                      className={`border border-slate-700/80 px-1 py-1.5 text-left text-[9px] font-bold tabular-nums transition-all duration-500 sm:px-1.5 sm:text-[10px] ${
                        ri === sale.usedRow && showAgePulse
                          ? "bourbon-sale-reveal-pulse bg-amber-500/25 text-amber-50 ring-1 ring-amber-400/60"
                          : "bg-slate-900/95 text-slate-400"
                      }`}
                    >
                      {sale.ageBandLabels[ri]}
                    </th>
                    {row.map((cell, ci) => {
                      const isPick =
                        sale.payoutSource === "grid" &&
                        ri === sale.usedRow &&
                        ci === sale.usedCol;
                      return (
                        <td
                          key={ci}
                          className={`border border-slate-700/70 px-0.5 py-1.5 font-mono text-[10px] tabular-nums transition-all duration-300 sm:px-1 sm:text-[11px] ${
                            isPick && showCellReveal
                              ? `bourbon-sale-cell-pop bg-amber-400/90 font-bold text-slate-950 shadow-[inset_0_0_0_2px_rgba(251,191,36,0.9)]`
                              : isPick
                                ? "bg-amber-400/90 font-bold text-slate-950 shadow-[inset_0_0_0_2px_rgba(251,191,36,0.9)]"
                                : "bg-slate-950/60 text-slate-200"
                          }`}
                        >
                          ${cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {sale.payoutSource === "demand_zero" ? (
              <p className="mt-2 text-[11px] leading-snug text-amber-200/90">
                Market demand was 0 — payout uses the age-only fallback (${sale.payout}), not a
                grid cell.
              </p>
            ) : payoutVisible ? (
              <p className="bourbon-sale-payout-rise mt-2 text-[11px] text-slate-400">
                Matched cell:{" "}
                <span className="font-semibold text-amber-100">
                  Age band {sale.ageBandLabels[sale.usedRow]} ·{" "}
                  {sale.demandBandHeaders[sale.usedCol]}
                </span>
              </p>
            ) : null}
          </div>

          {payoutVisible ? (
            <div className="bourbon-sale-payout-rise relative mt-5 rounded-2xl border border-emerald-500/40 bg-emerald-950/40 px-4 py-4 text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-300/90">
                Your payout
              </p>
              <p className="mt-1 font-mono text-4xl font-black tabular-nums text-emerald-50 sm:text-5xl">
                ${sale.payout}
              </p>
              <p className="mt-1 text-[11px] text-emerald-200/80">
                {sale.actionFeePaid != null && sale.actionFeePaid > 0
                  ? `Action fee for this sell: $${sale.actionFeePaid} (already taken from your cash). Net from this action: $${sale.payout - sale.actionFeePaid}.`
                  : "No action fee on this sell — first three actions each turn are free."}
              </p>
            </div>
          ) : null}

          <p className="mt-4 text-center text-[11px] text-slate-500">
            {autoCloseSecs != null ? (
              <span
                key={autoCloseSecs}
                className="bourbon-sale-countdown-tick inline-block font-semibold text-amber-200/95"
              >
                Closing in {autoCloseSecs}s — tap anywhere to dismiss now
              </span>
            ) : (
              <>Tap anywhere to dismiss · auto-close countdown starts in 10s</>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

/** Small demand-over-time chart: green segments = demand rose (Phase 2 dice), red = fell (barrel sale). */
function MarketDemandSparkline(props: {
  history: MarketDemandHistoryEntry[] | undefined;
  currentDemand: number;
}) {
  const { history, currentDemand } = props;
  const series: MarketDemandHistoryEntry[] =
    history != null && history.length > 0
      ? history
      : [
          {
            demand: currentDemand,
            kind: "start",
            turnNumber: 0,
          },
        ];

  const w = 84;
  const h = 28;
  const padX = 3;
  const padY = 4;
  const innerW = w - padX * 2;
  const innerH = h - padY * 2;
  const n = series.length;
  const maxD = 12;
  const minD = 0;

  function xAt(i: number): number {
    if (n <= 1) return padX + innerW / 2;
    return padX + (i / (n - 1)) * innerW;
  }
  function yAt(demand: number): number {
    const t = (demand - minD) / (maxD - minD);
    return padY + innerH * (1 - t);
  }

  const upStroke = "#059669";
  const downStroke = "#e11d48";
  const flatStroke = "#64748b";

  const segments: { key: string; d: string; stroke: string }[] = [];
  for (let i = 1; i < n; i++) {
    const x0 = xAt(i - 1);
    const y0 = yAt(series[i - 1]!.demand);
    const x1 = xAt(i);
    const y1 = yAt(series[i]!.demand);
    const delta = series[i]!.demand - series[i - 1]!.demand;
    const stroke =
      delta > 0 ? upStroke : delta < 0 ? downStroke : flatStroke;
    segments.push({
      key: `seg-${i}`,
      d: `M ${x0} ${y0} L ${x1} ${y1}`,
      stroke,
    });
  }

  const tipParts = series.map((e, i) => {
    const label =
      e.kind === "sell"
        ? "sale"
        : e.kind === "roll"
          ? "dice"
          : "start";
    return `T${e.turnNumber}: ${e.demand} (${label})`;
  });
  const title = `Demand history — green: up (dice), red: down (sale)\n${tipParts.join(" → ")}`;

  return (
    <svg
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      className="shrink-0 overflow-visible"
      role="img"
      aria-label={title.replaceAll("\n", ". ")}
    >
      <title>{title}</title>
      {segments.map((s) => (
        <path
          key={s.key}
          d={s.d}
          fill="none"
          stroke={s.stroke}
          strokeWidth={2.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
      {n === 1 ? (
        <circle
          cx={xAt(0)}
          cy={yAt(series[0]!.demand)}
          r={2.5}
          fill={flatStroke}
        />
      ) : (
        series.map((e, i) => (
          <circle
            key={`pt-${i}-${e.turnNumber}-${e.demand}`}
            cx={xAt(i)}
            cy={yAt(e.demand)}
            r={n > 14 ? 1.75 : 2.25}
            fill="#334155"
            className="dark:fill-slate-300"
          />
        ))
      )}
    </svg>
  );
}

const PHASE_NAMES: Record<number, string> = {
  1: "Age bourbons",
  2: "Market demand",
  3: "Action phase",
};

const MAX_BARONS = 6;

type MarketPileKey = "cask" | "corn" | "grain";

const MARKET_PILE_LABEL: Record<MarketPileKey, string> = {
  cask: "Cask",
  corn: "Corn",
  grain: "Grain",
};

function tallyMarketPilePicks(order: MarketPileKey[]): {
  cask: number;
  corn: number;
  grain: number;
} {
  const o = { cask: 0, corn: 0, grain: 0 };
  for (const k of order) o[k] += 1;
  return o;
}

/** Distinct player card themes (banner + avatar + border), left-to-right by seat order. */
const BARON_THEMES = [
  {
    banner: "bg-blue-600 text-white dark:bg-blue-700",
    border: "border-blue-600 dark:border-blue-400",
    avatar:
      "bg-gradient-to-br from-blue-200 via-blue-100 to-blue-300 text-blue-950 dark:from-blue-400 dark:via-blue-500 dark:to-blue-700 dark:text-white",
  },
  {
    banner: "bg-cyan-600 text-white dark:bg-cyan-700",
    border: "border-cyan-600 dark:border-cyan-400",
    avatar:
      "bg-gradient-to-br from-cyan-200 via-cyan-100 to-cyan-300 text-cyan-950 dark:from-cyan-400 dark:via-cyan-500 dark:to-cyan-700 dark:text-white",
  },
  {
    banner: "bg-teal-600 text-white dark:bg-teal-700",
    border: "border-teal-600 dark:border-teal-400",
    avatar:
      "bg-gradient-to-br from-teal-200 via-teal-100 to-teal-300 text-teal-950 dark:from-teal-400 dark:via-teal-500 dark:to-teal-700 dark:text-white",
  },
  {
    banner: "bg-red-600 text-white dark:bg-red-700",
    border: "border-red-600 dark:border-red-400",
    avatar:
      "bg-gradient-to-br from-red-200 via-red-100 to-red-300 text-red-950 dark:from-red-400 dark:via-red-500 dark:to-red-700 dark:text-white",
  },
  {
    banner: "bg-emerald-600 text-white dark:bg-emerald-700",
    border: "border-emerald-600 dark:border-emerald-400",
    avatar:
      "bg-gradient-to-br from-emerald-200 via-emerald-100 to-emerald-300 text-emerald-950 dark:from-emerald-400 dark:via-emerald-500 dark:to-emerald-700 dark:text-white",
  },
  {
    banner: "bg-violet-600 text-white dark:bg-violet-700",
    border: "border-violet-600 dark:border-violet-400",
    avatar:
      "bg-gradient-to-br from-violet-200 via-violet-100 to-violet-300 text-violet-950 dark:from-violet-400 dark:via-violet-500 dark:to-violet-700 dark:text-white",
  },
] as const;

/** Per-pile market styling — distinct “board piece” colors (no brown/orange wash). */
const MARKET_PILE_UI: Record<
  "cask" | "corn" | "grain",
  { active: string; idle: string }
> = {
  cask: {
    active:
      "cursor-pointer border-rose-500 bg-gradient-to-b from-rose-600 via-rose-800 to-slate-900 text-white shadow-md hover:brightness-110 active:scale-[0.98] dark:from-rose-600 dark:via-rose-900 dark:to-slate-950",
    idle:
      "cursor-default border-rose-200/90 bg-gradient-to-b from-rose-50 to-rose-100/90 text-rose-950 opacity-90 dark:border-rose-900/50 dark:from-rose-950/35 dark:to-slate-900 dark:text-rose-100",
  },
  corn: {
    active:
      "cursor-pointer border-sky-500 bg-gradient-to-b from-sky-600 via-sky-800 to-slate-900 text-white shadow-md hover:brightness-110 active:scale-[0.98] dark:from-sky-600 dark:via-sky-900 dark:to-slate-950",
    idle:
      "cursor-default border-sky-200/90 bg-gradient-to-b from-sky-50 to-sky-100/90 text-sky-950 opacity-90 dark:border-sky-900/50 dark:from-sky-950/35 dark:to-slate-900 dark:text-sky-100",
  },
  grain: {
    active:
      "cursor-pointer border-emerald-500 bg-gradient-to-b from-emerald-600 via-emerald-800 to-slate-900 text-white shadow-md hover:brightness-110 active:scale-[0.98] dark:from-emerald-600 dark:via-emerald-900 dark:to-slate-950",
    idle:
      "cursor-default border-emerald-200/90 bg-gradient-to-b from-emerald-50 to-emerald-100/90 text-emerald-950 opacity-90 dark:border-emerald-900/50 dark:from-emerald-950/35 dark:to-slate-900 dark:text-emerald-100",
  },
};

function baronInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  const one = parts[0] ?? name;
  return one.slice(0, 2).toUpperCase() || "?";
}

const BARON_THEME_FALLBACK = {
  banner: "bg-slate-500 text-white dark:bg-slate-600",
  border: "border-slate-400 dark:border-slate-500",
  avatar:
    "bg-gradient-to-br from-slate-200 via-slate-100 to-slate-300 text-slate-900 dark:from-slate-500 dark:via-slate-600 dark:to-slate-800 dark:text-white",
} as const;

/** Seat order matches baron strip (playerOrder index) for shared colors. */
function baronThemeForPlayer(playerOrder: string[], playerId: string) {
  const seat = playerOrder.indexOf(playerId);
  if (seat < 0) return BARON_THEME_FALLBACK;
  return BARON_THEMES[seat % BARON_THEMES.length]!;
}

interface OperationsCardInHand {
  id: string;
  title: string;
  cashWhenPlayed: number;
}

interface InvestmentCardInHand {
  id: string;
  title: string;
  capital: number;
  upright: boolean;
}

interface Baron {
  id: string;
  name: string;
  cash: number;
  resourceCards: string[];
  barrelledBourbons: BarrelledBourbon[];
  bourbonCards: unknown[];
  operationsHand?: OperationsCardInHand[];
  investmentHand?: InvestmentCardInHand[];
}

interface Rickhouse {
  id: string;
  capacity: number;
  barrels: { playerId: string; barrelId: string; age: number }[];
}

interface MarketPiles {
  cask: string[];
  corn: string[];
  grain: string[];
}

interface BarrelledBourbon {
  id: string;
  rickhouseId: string;
  age: number;
  mashCards?: string[];
}

interface LastDemandRoll {
  die1: number;
  die2: number;
  sum: number;
  demandBefore: number;
  demandAfter: number;
  doubleSix: boolean;
}

interface Game {
  gameId: string;
  mode: string;
  status: string;
  playerOrder: string[];
  players: Record<string, Baron>;
  marketDemand: number;
  currentPhase: number;
  currentPlayerIndex: number;
  turnNumber: number;
  actionsTakenThisTurn?: number;
  rickhouseFeesPaidThisTurn?: boolean;
  lastDemandRoll?: LastDemandRoll;
  marketDemandHistory?: MarketDemandHistoryEntry[];
  operationsDeck?: string[];
  investmentDeck?: string[];
  winnerIds?: string[];
  rickhouses?: Rickhouse[];
  marketPiles?: MarketPiles;
  /** @deprecated Legacy face-up line; migrated server-side to marketPiles. */
  marketGoods?: string[];
  resourceDeck?: string[];
  lobbySeats?: { kind: string; playerId?: string }[];
  /** Face-up bourbon card id from `docs/bourbon_cards.yaml` (price preview). */
  bourbonFaceUpId?: string;
  bourbonDeck?: string[];
}

function barrelMashCards(
  game: Game,
  playerId: string,
  barrelId: string
): string[] | undefined {
  const list = game.players[playerId]?.barrelledBourbons;
  if (!list) return undefined;
  return list.find((bb) => bb.id === barrelId)?.mashCards;
}

export default function GamePage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const gameId = params.id as string;
  const playerId = searchParams.get("playerId") || "";

  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");
  /** Indices into `resourceCards` for the next barrel action (Action phase). */
  const [mashSelection, setMashSelection] = useState<Set<number>>(() => new Set());
  /** Up to 3 pile taps for the next market buy (Action phase). */
  const [marketDrawPicks, setMarketDrawPicks] = useState<MarketPileKey[]>([]);
  const [demandRollSpinning, setDemandRollSpinning] = useState(false);
  const [demandSpinFaces, setDemandSpinFaces] = useState<[number, number]>([1, 1]);
  /** 0–1 fill while waiting to auto-advance Phase 2 → 3 (current human baron only). */
  const [phase2AdvanceBar, setPhase2AdvanceBar] = useState(0);
  const [bourbonSaleReveal, setBourbonSaleReveal] = useState<BourbonSaleReveal | null>(null);
  const demandSpinTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const computerTurnRequested = useRef(false);

  const dismissBourbonSale = useCallback(() => setBourbonSaleReveal(null), []);

  const handleNextPhase = useCallback(async () => {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/phase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const text = await res.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        if (!res.ok) {
          throw new Error(text.trim().slice(0, 200) || "Failed to advance");
        }
        throw new Error("Invalid server response");
      }
      if (!res.ok) {
        const errBody = data as { error?: string; message?: string };
        throw new Error(
          errBody.error || errBody.message || "Failed to advance"
        );
      }
      setGame(data as Game);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance");
    } finally {
      setActionLoading(false);
    }
  }, [gameId, playerId]);

  const loadGame = useCallback(async () => {
    if (!gameId) return;
    try {
      const res = await fetch(`${API_URL}/games/${gameId}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load game");
      }
      const data = await res.json();
      setGame(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load game");
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  const currentPlayerId = game?.playerOrder[game.currentPlayerIndex ?? 0];
  const isComputerTurn =
    game?.status === "in_progress" &&
    currentPlayerId != null &&
    isBotPlayer(currentPlayerId);

  const p2RollKey =
    game != null &&
    game.status === "in_progress" &&
    game.currentPhase === 2 &&
    game.lastDemandRoll
      ? `${game.turnNumber}:${game.currentPlayerIndex}:${game.lastDemandRoll.die1}-${game.lastDemandRoll.die2}-${game.lastDemandRoll.demandAfter}`
      : "";
  const phase2CountdownIsCurrent =
    game != null &&
    game.status === "in_progress" &&
    playerId !== "" &&
    game.playerOrder[game.currentPlayerIndex ?? 0] === playerId;
  const phase2CountdownIsCpuTurn =
    game != null &&
    game.status === "in_progress" &&
    currentPlayerId != null &&
    isBotPlayer(currentPlayerId);

  useEffect(() => {
    return () => {
      if (demandSpinTimerRef.current) {
        clearInterval(demandSpinTimerRef.current);
        demandSpinTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!p2RollKey) {
      setPhase2AdvanceBar(0);
      return;
    }
    if (!phase2CountdownIsCurrent || phase2CountdownIsCpuTurn) {
      setPhase2AdvanceBar(0);
      return;
    }
    if (demandRollSpinning) {
      setPhase2AdvanceBar(0);
      return;
    }

    const start = performance.now();
    const dur = PHASE_2_TO_3_DELAY_MS;
    let rafId = 0;

    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      setPhase2AdvanceBar(p);
      if (p >= 1) {
        void handleNextPhase();
        return;
      }
      rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);

    return () => cancelAnimationFrame(rafId);
  }, [
    p2RollKey,
    demandRollSpinning,
    phase2CountdownIsCurrent,
    phase2CountdownIsCpuTurn,
    handleNextPhase,
  ]);

  useEffect(() => {
    if (!isComputerTurn || !gameId || !API_URL || computerTurnRequested.current) return;
    computerTurnRequested.current = true;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`${API_URL}/games/${gameId}/computer-turn`, {
          method: "POST",
        });
        const data = await res.json();
        if (res.ok) setGame(data);
        else setError(data.error || "Computer turn failed");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Computer turn failed");
      } finally {
        computerTurnRequested.current = false;
      }
    }, 800);
    return () => clearTimeout(t);
  }, [isComputerTurn, gameId]);

  const WS_URL = process.env.NEXT_PUBLIC_WS_URL?.replace(/^http/, "ws") ?? "";
  useEffect(() => {
    if (!WS_URL || !gameId || !playerId || game?.status === "finished") return;
    const url = `${WS_URL}?gameId=${gameId}&playerId=${encodeURIComponent(playerId)}`;
    const ws = new WebSocket(url);
    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === "game" && data.game) setGame(data.game);
      } catch {}
    };
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ action: "getGame", gameId }));
      }
    }, 4000);
    return () => {
      clearInterval(interval);
      ws.close();
    };
  }, [WS_URL, gameId, playerId, game?.status]);

  const resourceHandForPrune = game?.players[playerId]?.resourceCards ?? [];
  const handFingerprint = resourceHandForPrune.join("|");
  useEffect(() => {
    const len = resourceHandForPrune.length;
    setMashSelection((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i >= 0 && i < len) next.add(i);
      }
      if (next.size === prev.size) {
        for (const i of prev) {
          if (!next.has(i)) return next;
        }
        return prev;
      }
      return next;
    });
  }, [handFingerprint, resourceHandForPrune.length, playerId]);

  useEffect(() => {
    if (!game) return;
    if (
      game.status !== "in_progress" ||
      game.currentPhase !== 3 ||
      !playerId
    ) {
      setMarketDrawPicks([]);
      return;
    }
    const cur = game.playerOrder[game.currentPlayerIndex ?? 0];
    if (!cur || cur !== playerId || isBotPlayer(cur)) setMarketDrawPicks([]);
  }, [game, playerId]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <p className="text-slate-700 dark:text-slate-300">Loading game…</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 dark:bg-slate-950">
        <p className="text-red-600 dark:text-red-400">{error || "Game not found"}</p>
        <Link href="/" className="text-slate-600 underline dark:text-slate-200">
          Back to lobby
        </Link>
      </div>
    );
  }

  const players = game.playerOrder.map((id) => game.players[id]).filter(Boolean);
  const lobbySeatsUi =
    game.status === "lobby"
      ? getLobbySeatsForDisplay(game as unknown as GameDoc)
      : null;
  const canStartGame =
    game.status !== "lobby" ||
    (lobbySeatsUi
      ? !lobbyHasUnfilledOpenSeat(lobbySeatsUi) && countSeatedBarons(lobbySeatsUi) >= 2
      : players.length >= 2);

  const isLobbyHost =
    game.status === "lobby" &&
    Boolean(playerId !== "" && game.playerOrder[0] === playerId);

  type BaronSlotRow =
    | { rowKind: "closed"; seatIndex: number }
    | { rowKind: "empty"; seatIndex: number; emptyLabel: string }
    | { rowKind: "baron"; seatIndex: number; pid: string; p: Baron };

  const baronSlotRows: BaronSlotRow[] =
    game.status === "lobby" && lobbySeatsUi
      ? lobbySeatsUi.map((seat, seatIndex) => {
          if (seat.kind === "closed")
            return { rowKind: "closed" as const, seatIndex };
          if (seat.kind === "open" && !seat.playerId)
            return { rowKind: "empty" as const, seatIndex, emptyLabel: "Open" };
          const pid = seat.playerId!;
          const p = game.players[pid];
          if (!p)
            return { rowKind: "empty" as const, seatIndex, emptyLabel: "Open" };
          return { rowKind: "baron" as const, seatIndex, pid, p };
        })
      : Array.from({ length: MAX_BARONS }, (_, seatIndex) => {
          const pid = game.playerOrder[seatIndex];
          const p = pid ? game.players[pid] : undefined;
          if (!p || !pid)
            return { rowKind: "empty" as const, seatIndex, emptyLabel: "Open" };
          return { rowKind: "baron" as const, seatIndex, pid, p };
        });

  const isCurrentPlayer = game.playerOrder[game.currentPlayerIndex] === playerId;
  const isComputerTurnNow =
    game.status === "in_progress" &&
    currentPlayerId != null &&
    isBotPlayer(currentPlayerId);
  const phaseName = PHASE_NAMES[game.currentPhase] ?? `Phase ${game.currentPhase}`;

  async function handleStart() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/start`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start");
      setGame(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleLobbySeat(
    action: "add_computer" | "open_for_human" | "close_seat",
    seatIndex: number
  ) {
    if (!playerId) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/lobby-seat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, action, seatIndex }),
      });
      const data = (await res.json()) as Game & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to update lobby");
      setGame(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update lobby");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRollDemand() {
    if (demandSpinTimerRef.current) {
      clearInterval(demandSpinTimerRef.current);
      demandSpinTimerRef.current = null;
    }
    const rollStart = Date.now();
    setDemandRollSpinning(true);
    setDemandSpinFaces([randomD6(), randomD6()]);
    demandSpinTimerRef.current = setInterval(() => {
      setDemandSpinFaces([randomD6(), randomD6()]);
    }, 65);

    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/roll-demand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = (await res.json()) as Game & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to roll demand");

      const elapsed = Date.now() - rollStart;
      const wait = Math.max(0, DEMAND_ROLL_ANIM_MIN_MS - elapsed);
      await new Promise((r) => setTimeout(r, wait));

      if (demandSpinTimerRef.current) {
        clearInterval(demandSpinTimerRef.current);
        demandSpinTimerRef.current = null;
      }
      setDemandRollSpinning(false);
      setGame(data);
      const resolved = data.lastDemandRoll;
      if (resolved)
        setDemandSpinFaces([resolved.die1, resolved.die2]);
    } catch (err) {
      if (demandSpinTimerRef.current) {
        clearInterval(demandSpinTimerRef.current);
        demandSpinTimerRef.current = null;
      }
      setDemandRollSpinning(false);
      setError(err instanceof Error ? err.message : "Failed to roll demand");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBuy(picks: { cask: number; corn: number; grain: number }) {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ picks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to buy");
      setGame(data);
      setMarketDrawPicks([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to buy");
    } finally {
      setActionLoading(false);
    }
  }

  async function handlePayRickhouseFees() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/rickhouse-fees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to pay fees");
      setGame(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to pay fees");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleSellBarrel(barrelId: string) {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/sell`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId, barrelId }),
      });
      const raw: unknown = await res.json();
      const body = raw as { error?: string; game?: Game; sale?: BourbonSaleReveal };
      if (!res.ok) throw new Error(body.error || "Failed to sell");
      if (body.game) {
        setGame(body.game);
        if (body.sale) setBourbonSaleReveal(body.sale);
      } else {
        setGame(raw as Game);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to sell");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBarrel(rickhouseId: string) {
    const mashIndices = Array.from(mashSelection).sort((a, b) => a - b);
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/barrel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rickhouseId, playerId, mashIndices }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to barrel");
      setGame(data);
      setMashSelection(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to barrel");
    } finally {
      setActionLoading(false);
    }
  }

  function toggleMashIndex(i: number) {
    setMashSelection((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  }

  async function handleCardAction(
    action:
      | "drawOperations"
      | "drawInvestment"
      | "capitalizeInvestment"
      | "playOperations",
    handIndex?: number
  ) {
    setActionLoading(true);
    setError("");
    try {
      const body: Record<string, unknown> = { playerId, action };
      if (handIndex !== undefined) body.handIndex = handIndex;
      const res = await fetch(`${API_URL}/games/${gameId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Card action failed");
      setGame(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Card action failed");
    } finally {
      setActionLoading(false);
    }
  }

  const rickhouses = game.rickhouses ?? [];
  const piles = game.marketPiles ?? { cask: [], corn: [], grain: [] };
  const marketCardsTotal = piles.cask.length + piles.corn.length + piles.grain.length;
  const me = playerId ? game.players[playerId] : null;
  const nextActionCost = nextActionCashCost(game.actionsTakenThisTurn ?? 0);
  const marketPickTally = tallyMarketPilePicks(marketDrawPicks);
  const canConfigureMarketBuy =
    game.status === "in_progress" &&
    game.currentPhase === 3 &&
    isCurrentPlayer &&
    !isComputerTurnNow;
  const marketBuyBlocked =
    actionLoading ||
    marketCardsTotal < 3 ||
    (me != null && me.cash < nextActionCost);
  const canAddMarketPicks =
    canConfigureMarketBuy && !marketBuyBlocked && marketDrawPicks.length < 3;

  function addMarketPilePick(key: MarketPileKey) {
    if (!canConfigureMarketBuy || marketBuyBlocked) return;
    setMarketDrawPicks((prev) => {
      if (prev.length >= 3) return prev;
      const next = [...prev, key];
      const t = tallyMarketPilePicks(next);
      if (
        piles.cask.length < t.cask ||
        piles.corn.length < t.corn ||
        piles.grain.length < t.grain
      )
        return prev;
      return next;
    });
  }
  const opsHand = me?.operationsHand ?? [];
  const invHand = me?.investmentHand ?? [];
  const opsDeckLeft = game.operationsDeck?.length ?? 0;
  const invDeckLeft = game.investmentDeck?.length ?? 0;
  const deckLeft = game.resourceDeck?.length ?? 0;
  const rc = me?.resourceCards ?? [];
  const canMash = me != null && handHasMashForBarrel(rc);
  const mashSortedIndices = Array.from(mashSelection).sort((a, b) => a - b);
  const selectedMashCards = mashSortedIndices
    .filter((i) => i >= 0 && i < rc.length)
    .map((i) => rc[i]);
  const mashSelectionValid = isValidMashSelection(selectedMashCards);
  const feePreview =
    game.status === "in_progress" && me != null
      ? previewRickhouseFeesForPlayer(game as unknown as GameDoc, playerId)
      : 0;
  const inCardPhases =
    game.status === "in_progress" && game.currentPhase === 3;

  const canBarrelViaBoard =
    game.status === "in_progress" &&
    game.currentPhase === 3 &&
    isCurrentPlayer &&
    !isComputerTurnNow;

  const boardAndBarons = (
    <>
      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        Barons
      </p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-6">
            {baronSlotRows.map((row) => {
              const seatIndex = row.seatIndex;
              const theme = BARON_THEMES[seatIndex % BARON_THEMES.length]!;

              if (row.rowKind === "closed") {
                return (
                  <div
                    key={`seat-${seatIndex}-closed`}
                    className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-800/40 bg-slate-800/30 px-1 py-1.5 text-center dark:border-slate-800/50 dark:bg-black/20"
                  >
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-500">
                      Seat {seatIndex + 1}
                    </span>
                    <span className="text-[9px] text-slate-500/80 dark:text-slate-600">Closed</span>
                    {game.status === "lobby" && isLobbyHost && seatIndex >= 1 ? (
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void handleLobbySeat("add_computer", seatIndex)}
                        className="mt-0.5 w-full max-w-[5.5rem] rounded bg-slate-600 px-1 py-0.5 text-[8px] font-bold uppercase leading-tight text-white hover:bg-slate-500 disabled:opacity-50 dark:bg-slate-500 dark:hover:bg-slate-400"
                      >
                        Add CPU
                      </button>
                    ) : null}
                  </div>
                );
              }

              if (row.rowKind === "empty") {
                return (
                  <div
                    key={`seat-${seatIndex}-empty`}
                    className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-slate-200/70 bg-slate-100/40 px-1 py-1.5 text-center dark:border-slate-600/60 dark:bg-slate-800/25"
                  >
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Seat {seatIndex + 1}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      {row.emptyLabel}
                    </span>
                    {row.emptyLabel === "Open" && game.status === "lobby" ? (
                      <span className="text-[8px] text-slate-400/90 dark:text-slate-500">
                        Waiting…
                      </span>
                    ) : null}
                    {game.status === "lobby" &&
                    isLobbyHost &&
                    seatIndex >= 1 &&
                    row.emptyLabel === "Open" ? (
                      <div className="mt-1 flex w-full max-w-[6.5rem] flex-col gap-1">
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => void handleLobbySeat("add_computer", seatIndex)}
                          className="w-full rounded bg-indigo-600 px-1 py-0.5 text-[8px] font-bold uppercase leading-tight text-white hover:bg-indigo-500 disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                        >
                          Add CPU
                        </button>
                        <button
                          type="button"
                          disabled={actionLoading}
                          onClick={() => void handleLobbySeat("close_seat", seatIndex)}
                          className="w-full rounded border border-slate-400/80 bg-white/80 px-1 py-0.5 text-[8px] font-bold uppercase leading-tight text-slate-700 hover:bg-white disabled:opacity-50 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
                        >
                          Close seat
                        </button>
                      </div>
                    ) : null}
                  </div>
                );
              }

              const { pid, p } = row;
              const currentTurnId = game.playerOrder[game.currentPlayerIndex];
              const isCurrentTurn =
                game.status === "in_progress" && currentTurnId != null && pid === currentTurnId;
              const isYou = pid === playerId;

              const resourceCount = p.resourceCards?.length ?? 0;
              const barrelCount = p.barrelledBourbons?.length ?? 0;
              const bizCount =
                (p.operationsHand?.length ?? 0) + (p.investmentHand?.length ?? 0);
              const awardCount = Array.isArray(p.bourbonCards) ? p.bourbonCards.length : 0;

              return (
                <div
                  key={pid}
                  className={`relative flex min-h-20 flex-col overflow-hidden rounded-lg border-2 bg-white shadow-md dark:bg-slate-800/50 ${theme.border} ${
                    isCurrentTurn
                      ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-100 dark:ring-cyan-300 dark:ring-offset-slate-950"
                      : ""
                  } ${isYou ? "ring-1 ring-sky-500 dark:ring-sky-400" : ""}`}
                >
                  <div className="flex flex-1 items-start gap-1 p-1">
                    <div className="relative shrink-0">
                      <span
                        className="absolute -left-0.5 -top-0.5 z-10 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-slate-800 px-0.5 text-[7px] font-bold leading-none text-white shadow dark:border-slate-700 dark:bg-slate-200 dark:text-slate-950"
                        title="Seat order"
                      >
                        {seatIndex + 1}
                      </span>
                      <div className="flex flex-col items-center">
                        <div className="relative">
                          <div
                            className={`flex h-9 w-9 items-center justify-center rounded-md border-2 text-[10px] font-bold leading-none ${theme.border} ${theme.avatar}`}
                            title={p.name}
                          >
                            {baronInitials(p.name)}
                          </div>
                          {isCurrentTurn ? (
                            <span
                              className="absolute -bottom-0.5 -left-0.5 z-10 rounded bg-teal-500 px-1 py-px text-[6px] font-bold uppercase leading-none text-white shadow dark:bg-teal-400 dark:text-slate-950"
                              title="Current turn"
                            >
                              Turn
                            </span>
                          ) : null}
                        </div>
                        {isBotPlayer(pid) ? (
                          <span
                            className="mt-0.5 rounded bg-slate-600 px-1 py-px text-[6px] font-semibold uppercase leading-none text-white shadow-sm dark:bg-slate-500"
                            title="Computer baron"
                          >
                            CPU
                          </span>
                        ) : null}
                        {game.status === "lobby" &&
                        isLobbyHost &&
                        seatIndex >= 1 &&
                        isBotPlayer(pid) ? (
                          <button
                            type="button"
                            disabled={actionLoading}
                            title="Free this seat so a human can join here (use seat number when joining)"
                            onClick={() => void handleLobbySeat("open_for_human", seatIndex)}
                            className="mt-1 w-full max-w-[4.5rem] rounded border border-amber-500/70 bg-amber-500/15 px-0.5 py-0.5 text-[7px] font-bold uppercase leading-tight text-amber-950 hover:bg-amber-500/25 disabled:opacity-50 dark:border-amber-400/50 dark:bg-amber-400/10 dark:text-amber-50 dark:hover:bg-amber-400/20"
                          >
                            Open seat
                          </button>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <div
                        className={`truncate rounded px-1 py-px text-center text-[10px] font-semibold leading-tight ${theme.banner}`}
                      >
                        {p.name}
                        {isYou ? (
                          <span className="ml-0.5 text-[9px] font-bold opacity-90">(you)</span>
                        ) : null}
                      </div>
                      <div className="grid min-h-0 flex-1 grid-cols-3 gap-0.5">
                        <div
                          className={`flex min-w-0 flex-col items-center justify-center rounded-md border-2 bg-slate-100 px-0.5 py-1 text-center shadow-sm dark:bg-slate-950/90 ${theme.border}`}
                          title="Cash"
                        >
                          <span className="text-[7px] font-bold uppercase leading-none tracking-wide text-slate-500 dark:text-slate-500">
                            Cash
                          </span>
                          <span className="mt-0.5 text-xs font-bold tabular-nums leading-none text-slate-900 dark:text-slate-50">
                            ${p.cash}
                          </span>
                        </div>
                        <div
                          className={`flex min-w-0 flex-col items-center justify-center rounded-md border-2 bg-slate-100 px-0.5 py-1 text-center shadow-sm dark:bg-slate-950/90 ${theme.border}`}
                          title="Resource cards in hand"
                        >
                          <span className="text-[7px] font-bold uppercase leading-none tracking-wide text-slate-500 dark:text-slate-500">
                            Res.
                          </span>
                          <span className="mt-0.5 text-xs font-bold tabular-nums leading-none text-slate-900 dark:text-slate-50">
                            {resourceCount}
                          </span>
                        </div>
                        <div
                          className={`flex min-w-0 flex-col items-center justify-center rounded-md border-2 bg-slate-100 px-0.5 py-1 text-center shadow-sm dark:bg-slate-950/90 ${theme.border}`}
                          title="Barrelled bourbons"
                        >
                          <span className="text-[7px] font-bold uppercase leading-none tracking-wide text-slate-500 dark:text-slate-500">
                            Barrels
                          </span>
                          <span className="mt-0.5 text-xs font-bold tabular-nums leading-none text-slate-900 dark:text-slate-50">
                            {barrelCount}
                          </span>
                        </div>
                      </div>
                      {bizCount > 0 || awardCount > 0 ? (
                        <div className="grid grid-cols-2 gap-1 text-[9px] leading-tight text-slate-200 dark:text-slate-300">
                          {bizCount > 0 ? (
                            <div className="rounded border border-slate-600/60 bg-slate-800/80 px-1 py-0.5 text-center dark:border-slate-600 dark:bg-slate-900/80">
                              <span className="font-semibold text-slate-400">Biz</span>{" "}
                              <span className="tabular-nums font-bold text-slate-100">{bizCount}</span>
                            </div>
                          ) : null}
                          {awardCount > 0 ? (
                            <div className="rounded border border-slate-600/60 bg-slate-800/80 px-1 py-0.5 text-center dark:border-slate-600 dark:bg-slate-900/80">
                              <span className="font-semibold text-slate-400">Awards</span>{" "}
                              <span className="tabular-nums font-bold text-slate-100">{awardCount}</span>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
      </div>

      {game.status === "in_progress" && rickhouses.length > 0 && (
        <div className="mt-4 border-t border-slate-200/80 pt-3 dark:border-violet-700/80">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
            Rickhouses
          </p>
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {rickhouses.map((r) => {
                const soleBaron6Full =
                  r.capacity === 6 &&
                  r.barrels.length === r.capacity &&
                  r.barrels.length > 0 &&
                  r.barrels.every((b) => b.playerId === r.barrels[0].playerId);
                return (
                  <div
                    key={r.id}
                    className="relative overflow-hidden rounded-xl border border-slate-200/90 bg-linear-to-br from-white via-slate-50/90 to-amber-50/30 p-2 shadow-sm ring-1 ring-slate-900/5 dark:border-slate-600/70 dark:from-slate-800/95 dark:via-slate-900/90 dark:to-amber-950/20 dark:ring-white/5"
                  >
                    <div
                      className="pointer-events-none absolute inset-y-3 left-0 w-1 rounded-r-full bg-linear-to-b from-amber-400/70 via-amber-600/40 to-amber-800/30 dark:from-amber-300/50 dark:via-amber-500/30 dark:to-amber-900/40"
                      aria-hidden
                    />
                    <div className="relative pl-2">
                      <p className="text-xs font-semibold leading-snug tracking-tight text-slate-800 dark:text-slate-100">
                        {rickhouseRegionLabel(r.id)}
                      </p>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500 dark:text-slate-400">
                        <span className="font-medium text-slate-600 dark:text-slate-300">
                          {r.barrels.length}/{r.capacity}
                        </span>{" "}
                        filled
                        {r.barrels.length > 0 ? (
                          <>
                            {" "}
                            · Next entry{" "}
                            <strong className="tabular-nums text-slate-700 dark:text-slate-200">
                              ${r.barrels.length + 1}
                            </strong>{" "}
                            · Yearly / barrel{" "}
                            <strong className="tabular-nums text-slate-700 dark:text-slate-200">
                              ${soleBaron6Full ? 0 : r.barrels.length}
                            </strong>
                            {soleBaron6Full ? (
                              <span className="text-slate-400 dark:text-slate-500">
                                {" "}
                                (full 6-cap — no rent)
                              </span>
                            ) : null}
                          </>
                        ) : (
                          <>
                            {" "}
                            · Next entry{" "}
                            <strong className="tabular-nums text-slate-700 dark:text-slate-200">
                              $1
                            </strong>
                          </>
                        )}
                      </p>
                    </div>
                    <div
                      className="relative mt-2 grid auto-rows-fr gap-1.5 items-stretch"
                      style={{
                        gridTemplateColumns: `repeat(${r.capacity}, minmax(0, 1fr))`,
                      }}
                    >
                      {Array.from({ length: r.capacity }, (_, slotIdx) => {
                        const b = r.barrels[slotIdx];
                        if (!b) {
                          const entryNum = r.barrels.length + 1;
                          const cashOk =
                            me != null &&
                            me.cash >= r.barrels.length + 1 + nextActionCost;
                          const canSubmit =
                            canBarrelViaBoard &&
                            mashSelectionValid &&
                            cashOk &&
                            !actionLoading;
                          const titleBarrel = canBarrelViaBoard
                            ? mashSelectionValid
                              ? cashOk
                                ? `Barrel here — entry $${entryNum} + $${nextActionCost} action fee`
                                : `Need $${r.barrels.length + 1 + nextActionCost} cash (entry + fee)`
                              : "Select a valid mash in Your hand first"
                            : "Empty slot";

                          if (canBarrelViaBoard) {
                            return (
                              <button
                                key={`${r.id}-slot-${slotIdx}`}
                                type="button"
                                title={titleBarrel}
                                aria-label={`${rickhouseRegionLabel(r.id)} slot ${slotIdx + 1}: barrel bourbon`}
                                disabled={!canSubmit}
                                onClick={() => {
                                  if (canSubmit) void handleBarrel(r.id);
                                }}
                                className={`flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed text-[8px] font-semibold transition ${
                                  canSubmit
                                    ? "cursor-pointer border-indigo-400/90 bg-linear-to-b from-indigo-50 to-indigo-100/80 text-indigo-900 shadow-md ring-1 ring-indigo-500/15 hover:border-indigo-500 hover:from-indigo-100 hover:to-indigo-50 active:scale-[0.98] dark:border-indigo-400/60 dark:from-indigo-950/50 dark:to-indigo-900/30 dark:text-indigo-100 dark:ring-indigo-400/20 dark:hover:border-indigo-300/70"
                                    : "cursor-not-allowed border-slate-300/60 bg-slate-100/40 text-slate-400 opacity-75 dark:border-slate-600/50 dark:bg-slate-900/40 dark:text-slate-600"
                                }`}
                              >
                                <span className="text-base font-light leading-none text-slate-400 dark:text-slate-500">
                                  {canSubmit ? "+" : "—"}
                                </span>
                                {canSubmit ? (
                                  <span className="text-[6px] font-bold uppercase tracking-widest text-indigo-600/90 dark:text-indigo-300/90">
                                    Barrel
                                  </span>
                                ) : (
                                  <span className="text-[6px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                    Empty
                                  </span>
                                )}
                              </button>
                            );
                          }

                          return (
                            <div
                              key={`${r.id}-slot-${slotIdx}`}
                              className="flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl border-2 border-dashed border-slate-300/70 bg-slate-50/60 text-slate-400 shadow-inner dark:border-slate-600/45 dark:bg-slate-900/35 dark:text-slate-500"
                              title="Empty slot"
                            >
                              <span className="text-base font-light leading-none opacity-70">—</span>
                              <span className="text-[6px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                                Empty
                              </span>
                            </div>
                          );
                        }
                        const name =
                          game.players[b.playerId]?.name ?? b.playerId.slice(0, 8);
                        const theme = baronThemeForPlayer(game.playerOrder, b.playerId);
                        const mash = barrelMashCards(game, b.playerId, b.barrelId);
                        const mashTitle =
                          mash?.length ? `Mash: ${mash.join(", ")}` : "Mash composition not recorded";
                        const isYourBarrel = playerId !== "" && b.playerId === playerId;
                        const canSellThisBarrel =
                          isYourBarrel &&
                          isCurrentPlayer &&
                          !isComputerTurnNow &&
                          game.currentPhase === 3 &&
                          b.age >= 2;
                        const sellBlockedByCash =
                          canSellThisBarrel && me != null && me.cash < nextActionCost;
                        const estSale =
                          canSellThisBarrel || (isYourBarrel && b.age >= 2)
                            ? previewSaleProceeds(game as unknown as GameDoc, b.age)
                            : null;
                        return (
                          <div
                            key={b.barrelId}
                            title={`${name} · ${b.age}y · ${mashTitle}`}
                            className={`relative flex h-full min-h-20 flex-col overflow-hidden rounded-xl border-2 bg-linear-to-b from-white via-slate-50/95 to-slate-100/90 p-1.5 text-left shadow-md ring-1 ring-black/6 dark:from-slate-800 dark:via-slate-900 dark:to-slate-950 dark:ring-white/10 ${theme.border}`}
                          >
                            <div
                              className="pointer-events-none absolute inset-x-0 top-0 h-6 bg-linear-to-b from-amber-900/6 to-transparent dark:from-amber-200/4"
                              aria-hidden
                            />
                            <div className="relative flex items-start justify-between gap-1">
                              <span
                                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold leading-none shadow-md ring-2 ring-white/70 dark:ring-slate-950/60 ${theme.avatar}`}
                              >
                                {baronInitials(name)}
                              </span>
                              <span className="inline-flex items-center rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold tabular-nums text-amber-950 ring-1 ring-amber-600/25 dark:bg-amber-400/12 dark:text-amber-50 dark:ring-amber-400/30">
                                {b.age}y
                              </span>
                            </div>
                            <div className="relative mt-1.5 flex min-h-[1.35rem] flex-1 flex-col rounded-lg bg-slate-900/4 px-1 py-1 dark:bg-black/30">
                              <span className="mb-0.5 text-[6px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                                Mash
                              </span>
                              {mash?.length ? (
                                <div className="flex flex-wrap content-start gap-1">
                                  {mash.map((c, mashIdx) => {
                                    const pill = mashPillForResourceCard(c);
                                    return (
                                      <span
                                        key={`${b.barrelId}-mash-${mashIdx}`}
                                        title={pill.title}
                                        className={pill.className}
                                      >
                                        {pill.short}
                                      </span>
                                    );
                                  })}
                                </div>
                              ) : (
                                <p className="text-[7px] font-medium italic leading-tight text-slate-400 dark:text-slate-500">
                                  Not recorded
                                </p>
                              )}
                            </div>
                            {isYourBarrel && b.age >= 2 ? (
                              <div className="relative mt-1.5 shrink-0 border-t border-slate-200/80 pt-1.5 dark:border-slate-600/60">
                                {canSellThisBarrel ? (
                                  <button
                                    type="button"
                                    onClick={() => void handleSellBarrel(b.barrelId)}
                                    disabled={actionLoading || sellBlockedByCash}
                                    title={
                                      sellBlockedByCash
                                        ? `Need $${nextActionCost} for this action (have $${me?.cash ?? 0})`
                                        : estSale != null
                                          ? `Sell this barrel — est. $${estSale} before fees · action $${nextActionCost}`
                                          : "Sell this barrel"
                                    }
                                    className="flex w-full flex-col items-center justify-center gap-0.5 rounded-lg border-2 border-emerald-600/80 bg-linear-to-b from-emerald-600 via-emerald-700 to-emerald-900 px-1.5 py-2 text-center shadow-md ring-1 ring-emerald-500/30 transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-400/70 dark:from-emerald-600 dark:via-emerald-800 dark:to-emerald-950 dark:ring-emerald-400/25"
                                  >
                                    <span className="text-[7px] font-extrabold uppercase tracking-[0.12em] text-emerald-50">
                                      Sell bourbon
                                    </span>
                                    <span className="text-[10px] font-bold tabular-nums text-white">
                                      {estSale != null ? `~$${estSale}` : "—"}{" "}
                                      <span className="font-semibold opacity-90">
                                        · ${nextActionCost} action
                                      </span>
                                    </span>
                                  </button>
                                ) : (
                                  <p className="rounded-md bg-slate-200/60 px-1.5 py-1 text-center text-[7px] font-semibold leading-snug text-slate-600 dark:bg-slate-900/50 dark:text-slate-400">
                                    {isComputerTurnNow
                                      ? "Wait — computer’s turn"
                                      : game.currentPhase !== 3
                                        ? "Sell in Action phase"
                                        : !isCurrentPlayer
                                          ? "Your turn to sell"
                                          : "Cannot sell now"}
                                  </p>
                                )}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      {bourbonSaleReveal ? (
        <BourbonSaleExperience sale={bourbonSaleReveal} onDismiss={dismissBourbonSale} />
      ) : null}
      <div className="flex min-h-screen flex-col lg:flex-row lg:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-slate-200 dark:border-slate-800 lg:border-r">
          <header className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-slate-100/95 px-3 py-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="min-w-0 truncate text-base font-bold text-slate-800 dark:text-slate-100 sm:text-lg">
                Game {game.gameId}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {game.status === "in_progress" && (
                  <div className="flex items-center gap-2 rounded-md border border-indigo-400 bg-white px-2 py-1 shadow-sm dark:border-indigo-500 dark:bg-slate-800/60">
                    <div className="flex flex-col leading-none">
                      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                        Demand
                      </span>
                      <span className="mt-0.5 text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                        {game.marketDemand}
                      </span>
                    </div>
                    <div className="flex min-w-0 flex-col items-stretch gap-0.5 border-l border-slate-200 pl-2 dark:border-slate-600">
                      <MarketDemandSparkline
                        history={game.marketDemandHistory}
                        currentDemand={game.marketDemand}
                      />
                      <span className="whitespace-nowrap text-[7px] font-medium leading-none text-slate-500 dark:text-slate-400">
                        <span className="text-emerald-600 dark:text-emerald-400">▲</span> dice{" "}
                        <span className="text-rose-600 dark:text-rose-400">▼</span> sale
                      </span>
                    </div>
                  </div>
                )}
                <Link
                  href="/"
                  className="shrink-0 text-xs font-medium text-slate-700 underline dark:text-slate-200"
                >
                  Lobby
                </Link>
              </div>
            </div>
          </header>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2">
              {boardAndBarons}

              {game.status === "finished" && game.winnerIds?.length ? (
                <div className="mt-4 rounded-lg border-2 border-indigo-400 bg-slate-100 p-3 dark:bg-slate-800/40">
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Game over — Winner:{" "}
                    {game.winnerIds
                      .map((id) => game.players[id]?.name ?? id)
                      .join(", ")}
                  </p>
                </div>
              ) : null}

              {game.status === "lobby" && (
                <div className="mt-4">
                  {isLobbyHost ? (
                    <p className="mb-2 max-w-xl text-xs leading-snug text-slate-600 dark:text-slate-300">
                      <strong className="text-slate-800 dark:text-slate-100">Host:</strong> Add a
                      CPU to empty or closed seats, close open seats nobody is using, or open a CPU
                      slot so a friend can join that exact seat (enter seat # when joining).
                    </p>
                  ) : null}
                  <button
                    onClick={handleStart}
                    disabled={actionLoading || !canStartGame}
                    className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {actionLoading ? "Starting…" : "Start game"}
                  </button>
                  {!canStartGame && (
                    <p className="mt-2 text-xs text-slate-600 dark:text-slate-200">
                      {lobbySeatsUi && lobbyHasUnfilledOpenSeat(lobbySeatsUi)
                        ? "Every open seat must be filled or closed: use Add CPU / Close seat on waiting slots, or wait for players."
                        : lobbySeatsUi && countSeatedBarons(lobbySeatsUi) < 2
                          ? "Need at least 2 barons (add a computer or wait for another player)."
                          : "Need at least 2 barons to start."}
                    </p>
                  )}
                </div>
              )}
            </div>

            {game.status === "in_progress" && me != null && playerId ? (
              <div
                className="relative z-20 shrink-0 border-t border-slate-300/90 bg-linear-to-t from-slate-200 via-slate-100 to-white px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_40px_rgba(15,23,42,0.12)] dark:border-slate-700 dark:from-slate-950 dark:via-slate-900 dark:to-slate-900 dark:shadow-[0_-12px_40px_rgba(0,0,0,0.45)]"
                role="region"
                aria-label="Your hand"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/60 dark:bg-white/10" />
                <div className="mx-auto max-w-6xl rounded-t-2xl rounded-b-lg border border-slate-300/80 bg-white/95 px-3 py-3 shadow-lg ring-1 ring-slate-900/5 dark:border-violet-800/60 dark:bg-slate-800/95 dark:ring-white/10 sm:px-5 sm:py-4">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-4">
                    <div className="flex shrink-0 flex-col justify-center rounded-2xl border-2 border-emerald-600/45 bg-linear-to-br from-emerald-100 via-white to-emerald-50/80 px-4 py-3 shadow-lg ring-2 ring-emerald-500/15 dark:border-emerald-500/40 dark:from-emerald-950/80 dark:via-slate-900 dark:to-emerald-950/40 dark:ring-emerald-400/20">
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-800 dark:text-emerald-300">
                        Cash
                      </span>
                      <span className="mt-0.5 text-3xl font-black tabular-nums leading-none tracking-tight text-emerald-950 dark:text-emerald-50 sm:text-4xl">
                        ${me.cash}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-600 dark:text-slate-300">
                          Your hand — resources
                        </h2>
                        <span className="rounded-full border border-slate-300/80 bg-slate-100 px-2.5 py-1 text-xs font-bold tabular-nums text-slate-800 shadow-sm dark:border-slate-600 dark:bg-slate-900/80 dark:text-slate-100">
                          {me.resourceCards.length} card
                          {me.resourceCards.length === 1 ? "" : "s"}
                        </span>
                      </div>
                      {me.resourceCards.length > 0 ? (
                        <p className="mb-2 text-[10px] text-slate-500 dark:text-slate-400">
                          Cask {me.resourceCards.filter((c) => isCaskResource(c)).length} · Corn{" "}
                          {me.resourceCards.filter((c) => resourceBaseKind(c) === "corn").length}{" "}
                          · Grain{" "}
                          {me.resourceCards.filter((c) => {
                            if (isCaskResource(c)) return false;
                            const k = resourceBaseKind(c);
                            return isSmallGrainResource(c) || k === "multi";
                          }).length}
                          {me.resourceCards.some((c) => getResourceCardTier(c) !== "plain")
                            ? ` · ✦ ${me.resourceCards.filter((c) => getResourceCardTier(c) !== "plain").length} specialty`
                            : ""}
                          {canMash ? (
                            <span className="text-slate-400 dark:text-slate-500">
                              {" "}
                              · Tap to build mash, then + on a rickhouse
                            </span>
                          ) : null}
                        </p>
                      ) : (
                        <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
                          No resource cards yet — buy from the{" "}
                          <strong className="text-slate-700 dark:text-slate-200">Market</strong> in
                          Action phase.
                        </p>
                      )}
                      <div className="flex min-h-[3.25rem] flex-wrap gap-2 sm:gap-2.5">
                        {me.resourceCards.map((c, i) => {
                          const selected = mashSelection.has(i);
                          const face = getResourceCardFace(c);
                          const canToggle =
                            game.status === "in_progress" &&
                            game.currentPhase === 3 &&
                            isCurrentPlayer &&
                            !isComputerTurnNow;
                          return (
                            <button
                              key={`${i}-${c}`}
                              type="button"
                              disabled={!canToggle}
                              onClick={() => toggleMashIndex(i)}
                              title={
                                canToggle
                                  ? selected
                                    ? "Remove from mash"
                                    : "Add to mash"
                                  : "Select during your Action phase"
                              }
                              className={`resource-hand-chip flex min-h-[4.75rem] min-w-[6.75rem] flex-col items-center justify-center px-2.5 py-2 text-center leading-tight transition ${handResourceChipClassNames(c, { selected })} ${
                                canToggle
                                  ? "cursor-pointer hover:brightness-[1.03] active:scale-[0.98] dark:hover:brightness-110"
                                  : "cursor-default opacity-65"
                              }`}
                            >
                              <span className="text-lg leading-none" aria-hidden>
                                {face.glyph}
                              </span>
                              <span className="resource-chip-title mt-1 text-[11px] font-extrabold leading-snug">
                                {face.title}
                              </span>
                              <span className="resource-chip-muted mt-0.5 line-clamp-2 text-[8px] font-semibold uppercase tracking-[0.06em] opacity-80">
                                {face.character}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  {opsHand.length > 0 && (
                    <div className="mt-2 border-t border-slate-200/80 pt-2 dark:border-slate-600/80">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Operations cards
                      </p>
                      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        {opsHand.map((c, i) => (
                          <li key={`${c.id}-${i}`}>
                            {c.title}{" "}
                            <span className="tabular-nums text-slate-500 dark:text-slate-400">
                              (+${c.cashWhenPlayed})
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {invHand.length > 0 && (
                    <div className="mt-2 border-t border-slate-200/80 pt-2 dark:border-slate-600/80">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Investment cards
                      </p>
                      <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-600 dark:text-slate-300">
                        {invHand.map((c, i) => (
                          <li key={`${c.id}-${i}`}>
                            {c.title}
                            {c.upright ? (
                              <span className="text-slate-500 dark:text-slate-400"> — active</span>
                            ) : (
                              <span className="tabular-nums text-slate-500 dark:text-slate-400">
                                {" "}
                                — sideways (${c.capital})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {me.barrelledBourbons.length > 0 && (
                    <div className="mt-2 border-t border-slate-200/80 pt-2 dark:border-slate-600/80">
                      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Barrelled bourbon
                      </p>
                      <p className="mb-1.5 text-[9px] leading-snug text-slate-500 dark:text-slate-500">
                        Sell from the{" "}
                        <strong className="text-slate-600 dark:text-slate-400">rickhouse</strong>{" "}
                        slot (green button) when it&apos;s your Action phase and the barrel is age 2+.
                      </p>
                      <ul className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap">
                        {me.barrelledBourbons.map((b) => {
                          const loc = rickhouseRegionLabel(b.rickhouseId);
                          const est = previewSaleProceeds(
                            game as unknown as GameDoc,
                            b.age
                          );
                          return (
                            <li
                              key={b.id}
                              className="flex min-w-0 flex-1 flex-wrap items-center gap-2 rounded-lg border border-slate-200/90 bg-slate-50/80 px-2 py-1.5 text-[11px] dark:border-violet-800/50 dark:bg-slate-900/40 sm:min-w-[12rem] sm:flex-initial"
                            >
                              <span className="min-w-0 text-slate-700 dark:text-slate-200">
                                <span className="font-medium">{loc}</span>
                                <span className="text-slate-500 dark:text-slate-400">
                                  {" "}
                                  · {b.age}y · est. ${est}
                                  {b.mashCards?.length ? (
                                    <> · mash {b.mashCards.length} cards</>
                                  ) : null}
                                </span>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {game.status === "in_progress" && (
          <aside className="flex w-full shrink-0 flex-col border-t border-slate-300/80 bg-linear-to-b from-slate-200/90 to-indigo-50/80 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:w-[min(100%,22rem)] lg:border-l lg:border-t-0 xl:w-96">
            <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-3">
              {error ? (
                <div className="shrink-0 rounded bg-red-100 px-2 py-1.5 text-xs text-red-800 dark:bg-red-900/50 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              {isComputerTurnNow ? (
                <div className="shrink-0 rounded-md border border-cyan-500 bg-cyan-100/90 p-2 dark:border-indigo-500 dark:bg-slate-800/60">
                  <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
                    Computer&apos;s turn…
                  </p>
                </div>
              ) : null}

              <div className="shrink-0 rounded-xl border-2 border-indigo-400/45 bg-linear-to-br from-indigo-500/12 via-violet-500/8 to-transparent px-3 py-3 shadow-sm dark:border-indigo-500/35 dark:from-indigo-400/10 dark:via-violet-500/10">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">
                  Current phase
                </p>
                <p className="mt-1.5 text-lg font-bold leading-tight text-slate-900 dark:text-slate-50">
                  Phase {game.currentPhase}
                  <span className="text-slate-400 dark:text-slate-500"> — </span>
                  <span className="text-base font-semibold text-slate-800 dark:text-slate-100">
                    {phaseName}
                  </span>
                </p>
                <div
                  className="mt-2.5 flex items-center justify-between gap-2 rounded-lg border border-indigo-400/35 bg-white/80 px-2.5 py-2 dark:border-indigo-500/30 dark:bg-slate-900/55"
                  title="Cost for your next action this turn (first three are free)"
                >
                  <span className="text-[10px] font-bold uppercase tracking-wide text-indigo-700 dark:text-indigo-200">
                    Next action
                  </span>
                  <span className="text-xl font-bold tabular-nums leading-none text-indigo-950 dark:text-indigo-50">
                    ${nextActionCost}
                  </span>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3">
                <div>
                  {!(
                    game.currentPhase === 3 &&
                    isCurrentPlayer &&
                    !isComputerTurnNow
                  ) ? (
                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">
                      This phase — your actions
                    </p>
                  ) : null}
                  {game.status === "in_progress" &&
                  !isComputerTurnNow &&
                  !isCurrentPlayer ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50/90 p-3 text-sm text-slate-700 dark:border-slate-600 dark:bg-slate-800/40 dark:text-slate-200">
                      Waiting for{" "}
                      <strong>
                        {game.players[game.playerOrder[game.currentPlayerIndex] ?? ""]
                          ?.name ?? "another baron"}
                      </strong>
                      .
                    </div>
                  ) : null}

                  {game.status === "in_progress" &&
                  game.currentPhase === 2 &&
                  !isComputerTurnNow ? (
                    <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800/50">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        Roll market demand
                      </p>
                      <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                        Two dice (mock). Sum &gt; demand → +1 (max 12). Double six → 12.
                        {game.lastDemandRoll ? (
                          <>
                            {" "}
                            New demand:{" "}
                            <strong className="tabular-nums">{game.marketDemand}</strong>.
                          </>
                        ) : (
                          <>
                            {" "}
                            Demand before roll:{" "}
                            <strong className="tabular-nums">{game.marketDemand}</strong>.
                          </>
                        )}
                      </p>
                      {(() => {
                        const lr = game.lastDemandRoll;
                        const showLocalSpin =
                          demandRollSpinning && isCurrentPlayer && !isComputerTurnNow;
                        const left: number | "?" = showLocalSpin
                          ? demandSpinFaces[0]
                          : lr
                            ? lr.die1
                            : "?";
                        const right: number | "?" = showLocalSpin
                          ? demandSpinFaces[1]
                          : lr
                            ? lr.die2
                            : "?";
                        const after =
                          !lr && !showLocalSpin ? (
                            <span>
                              Tap <strong>Roll demand dice</strong> for two d6.
                            </span>
                          ) : showLocalSpin ? (
                            <span>Rolling…</span>
                          ) : lr ? (
                            <span>
                              Sum{" "}
                              <strong className="tabular-nums text-slate-800 dark:text-slate-100">
                                {lr.sum}
                              </strong>
                              {lr.doubleSix ? (
                                <span className="text-amber-700 dark:text-amber-300">
                                  {" "}
                                  · Double six — demand set to 12.
                                </span>
                              ) : null}
                              {" "}
                              · Demand{" "}
                              <strong className="tabular-nums">{lr.demandBefore}</strong> →{" "}
                              <strong className="tabular-nums">{lr.demandAfter}</strong>
                            </span>
                          ) : null;
                        return (
                          <DemandDiceFaces
                            className="mt-2"
                            left={left}
                            right={right}
                            after={after}
                            rolling={showLocalSpin}
                            announceLabel="Market demand dice"
                          />
                        );
                      })()}
                      {isCurrentPlayer && !game.lastDemandRoll ? (
                        <button
                          type="button"
                          onClick={() => void handleRollDemand()}
                          disabled={actionLoading || demandRollSpinning}
                          className="mt-3 w-full rounded-lg bg-indigo-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                        >
                          {actionLoading || demandRollSpinning
                            ? "Rolling…"
                            : "Roll demand dice"}
                        </button>
                      ) : null}
                      {isCurrentPlayer && game.lastDemandRoll && !demandRollSpinning ? (
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            <span>Starting Action phase</span>
                            <span className="tabular-nums text-indigo-600 dark:text-indigo-300">
                              {Math.max(0, Math.ceil((1 - phase2AdvanceBar) * (PHASE_2_TO_3_DELAY_MS / 1000)))}
                              s
                            </span>
                          </div>
                          <div
                            className="h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
                            role="progressbar"
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={Math.round(phase2AdvanceBar * 100)}
                            aria-label="Time until Action phase"
                          >
                            <div
                              className="h-full rounded-full bg-indigo-500 transition-[width] duration-75 ease-linear dark:bg-teal-500"
                              style={{ width: `${Math.round(phase2AdvanceBar * 100)}%` }}
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleNextPhase()}
                            disabled={actionLoading}
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                          >
                            Skip wait — go now
                          </button>
                        </div>
                      ) : null}
                      {!isCurrentPlayer && game.lastDemandRoll ? (
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          Dice are in — waiting for{" "}
                          <strong>
                            {game.players[game.playerOrder[game.currentPlayerIndex] ?? ""]
                              ?.name ?? "the active baron"}
                          </strong>{" "}
                          to enter the Action phase.
                        </p>
                      ) : !isCurrentPlayer && !game.lastDemandRoll ? (
                        <p className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          Waiting for the roll from the active baron.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  {isCurrentPlayer && !isComputerTurnNow && (
                    <div className="flex flex-col gap-3">
                      {game.currentPhase === 1 && (
                        <div className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-600 dark:bg-slate-800/50">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                            Rickhouse fees &amp; aging
                          </p>
                          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                            Total due: <strong className="tabular-nums">${feePreview}</strong>
                            {game.rickhouseFeesPaidThisTurn ? (
                              <span className="ml-2 text-green-700 dark:text-green-400">
                                Paid — barrels aged 1 year.
                              </span>
                            ) : null}
                          </p>
                          <button
                            type="button"
                            onClick={handlePayRickhouseFees}
                            disabled={
                              actionLoading ||
                              game.rickhouseFeesPaidThisTurn ||
                              (me != null && me.cash < feePreview)
                            }
                            className="mt-2 w-full rounded-lg bg-indigo-700 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-800 disabled:opacity-50"
                          >
                            {game.rickhouseFeesPaidThisTurn
                              ? "Fees paid"
                              : `Pay $${feePreview} & age bourbon`}
                          </button>
                          <button
                            type="button"
                            onClick={handleNextPhase}
                            disabled={actionLoading}
                            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                          >
                            {actionLoading ? "…" : "Next phase"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

            <section className="rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/30">
              <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200">
                {game.currentPhase === 3 && isCurrentPlayer && !isComputerTurnNow
                  ? "Buy from market"
                  : "Market"}
              </h2>
              <p className="mb-3 mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                {game.currentPhase === 3 && isCurrentPlayer && !isComputerTurnNow
                  ? "One buy action: tap a pile for each of 3 picks (any mix of Cask, Corn, Grain), then confirm. Your pick order is listed below."
                  : "Face-down piles — counts shown. Buys happen in the Action phase."}
              </p>
              {deckLeft > 0 ? (
                <p className="mb-2 text-[11px] text-slate-400 dark:text-slate-400">
                  Side deck: {deckLeft}
                </p>
              ) : null}

              <div className="mb-3 grid grid-cols-3 gap-2">
                {(
                  [
                    { key: "cask" as const, label: "Cask", count: piles.cask.length },
                    { key: "corn" as const, label: "Corn", count: piles.corn.length },
                    { key: "grain" as const, label: "Grain", count: piles.grain.length },
                  ] as const
                ).map((pile) => {
                  const interactive =
                    game.currentPhase === 3 && isCurrentPlayer && !isComputerTurnNow;
                  const ui = MARKET_PILE_UI[pile.key];
                  const remainingThisPile =
                    pile.count - marketPickTally[pile.key];
                  const canTapPile =
                    canAddMarketPicks && remainingThisPile > 0;
                  const pileLit = interactive && canTapPile;
                  return (
                    <button
                      key={pile.key}
                      type="button"
                      title={
                        !interactive
                          ? `${pile.count} cards`
                          : marketBuyBlocked
                            ? marketCardsTotal < 3
                              ? "Market has fewer than 3 cards"
                              : me != null && me.cash < nextActionCost
                                ? `Need $${nextActionCost} cash (you have $${me.cash})`
                                : "Cannot add right now"
                            : marketDrawPicks.length >= 3
                              ? "Confirm draw or clear picks"
                              : remainingThisPile <= 0
                                ? `No ${pile.label} left in this pile`
                                : `Add 1 ${pile.label} (${marketDrawPicks.length}/3) · fee $${nextActionCost}`
                      }
                      disabled={!interactive || !canTapPile}
                      onClick={() => addMarketPilePick(pile.key)}
                      className={`flex flex-col items-center justify-end rounded-lg border-2 px-1.5 pb-2 pt-3 text-center transition ${
                        pileLit ? ui.active : ui.idle
                      } ${interactive && marketBuyBlocked ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`mb-1 text-[9px] font-bold uppercase tracking-wide ${
                          pileLit ? "text-white/90" : "text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {pile.label}
                      </span>
                      <span className="mb-2 min-h-[2.5rem] w-[85%] rounded border border-black/10 bg-black/10 shadow-inner dark:border-white/10 dark:bg-white/5" />
                      <span className="text-lg font-bold tabular-nums leading-none">
                        {pile.count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {canConfigureMarketBuy ? (
                <div
                  className="mb-3 rounded-lg border border-slate-200 bg-slate-50/90 px-2.5 py-2 dark:border-slate-600 dark:bg-slate-900/50"
                  aria-live="polite"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    This draw ({marketDrawPicks.length}/3)
                  </p>
                  {marketDrawPicks.length === 0 ? (
                    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                      Tap a pile for each of your 3 picks.
                    </p>
                  ) : (
                    <ol className="mt-1.5 flex list-none flex-wrap gap-1">
                      {marketDrawPicks.map((k, i) => (
                        <li
                          key={`${k}-${i}`}
                          className="rounded-md border border-slate-300/90 bg-white px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-slate-800 shadow-sm dark:border-slate-500 dark:bg-slate-800 dark:text-slate-100"
                        >
                          {i + 1}. {MARKET_PILE_LABEL[k]}
                        </li>
                      ))}
                    </ol>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        actionLoading ||
                        marketDrawPicks.length !== 3 ||
                        marketBuyBlocked
                      }
                      onClick={() => {
                        if (marketDrawPicks.length !== 3) return;
                        void handleBuy(marketPickTally);
                      }}
                      className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-indigo-500 dark:hover:bg-indigo-400"
                    >
                      Draw these 3 — ${nextActionCost}
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || marketDrawPicks.length === 0}
                      onClick={() =>
                        setMarketDrawPicks((prev) => prev.slice(0, -1))
                      }
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Undo last
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading || marketDrawPicks.length === 0}
                      onClick={() => setMarketDrawPicks([])}
                      className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-500 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                    >
                      Clear
                    </button>
                  </div>
                  {marketDrawPicks.length > 0 &&
                  marketBuyBlocked &&
                  !actionLoading ? (
                    <p className="mt-1.5 text-[10px] text-amber-800 dark:text-amber-200">
                      {marketCardsTotal < 3
                        ? "Not enough cards left in the market."
                        : me != null && me.cash < nextActionCost
                          ? `Need $${nextActionCost} cash for this action.`
                          : "Cannot complete this buy right now."}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </section>

            {isCurrentPlayer && !isComputerTurnNow && game.currentPhase === 3 && (
              <section className="rounded-xl border border-slate-200 bg-linear-to-b from-white to-slate-50/90 p-3 shadow-sm dark:border-violet-800/60 dark:from-slate-800/90 dark:to-slate-950/90">
                <h2 className="text-xs font-bold uppercase tracking-[0.12em] text-violet-700 dark:text-violet-300">
                  Barrel bourbon
                </h2>
                <p className="mb-3 mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                  In <strong>Your hand</strong> at the bottom, tap <strong>3–6</strong> cards:{" "}
                  <strong>1 Cask</strong>, <strong>≥1 Corn</strong>, <strong>≥1 grain</strong>. Then
                  tap <strong>+</strong> on an empty rickhouse slot (one barreling action).
                </p>

                <div className="mb-3 rounded-lg border border-violet-200/80 bg-violet-50/50 p-2.5 text-sm dark:border-violet-800/50 dark:bg-violet-950/25">
                  <p className="text-xs text-slate-700 dark:text-slate-200">
                    Selected: {mashSelection.size} card{mashSelection.size === 1 ? "" : "s"}
                    {mashSelection.size > 0
                      ? ` — ${selectedMashCards.map((id) => getResourceCardFace(id).title).join(", ")}`
                      : ""}
                    {mashSelection.size > 0 && !mashSelectionValid ? (
                      <span className="ml-1 text-red-700 dark:text-red-400">
                        (invalid — adjust)
                      </span>
                    ) : null}
                    {mashSelectionValid ? (
                      <span className="ml-1 text-green-700 dark:text-green-400">— valid</span>
                    ) : null}
                  </p>
                  {mashSelection.size > 0 ? (
                    <button
                      type="button"
                      onClick={() => setMashSelection(new Set())}
                      className="mt-1 text-xs text-slate-600 underline dark:text-slate-200"
                    >
                      Clear mash
                    </button>
                  ) : null}
                </div>

                {inCardPhases && (
                  <div className="border-t border-slate-200 pt-3 dark:border-violet-700">
                    <p className="text-xs font-bold uppercase tracking-[0.12em] text-slate-700 dark:text-slate-200">
                      Business cards
                    </p>
                    <p className="mb-2 mt-1 text-[11px] leading-snug text-slate-600 dark:text-slate-300">
                      Draw or play operations, draw or capitalize investments — each uses the{" "}
                      <strong>next action</strong> fee. Sell aged barrels from your hand bar when
                      ready.
                    </p>
                    <div className="flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleCardAction("drawOperations")}
                        disabled={
                          actionLoading ||
                          opsDeckLeft === 0 ||
                          (me != null && me.cash < nextActionCost)
                        }
                        className="w-full rounded bg-indigo-700 px-3 py-2 text-sm text-white hover:bg-indigo-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-teal-500"
                      >
                        Draw operations — ${nextActionCost}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCardAction("drawInvestment")}
                        disabled={
                          actionLoading ||
                          invDeckLeft === 0 ||
                          (me != null && me.cash < nextActionCost)
                        }
                        className="w-full rounded bg-indigo-700 px-3 py-2 text-sm text-white hover:bg-indigo-800 disabled:opacity-50 dark:bg-indigo-600 dark:hover:bg-teal-500"
                      >
                        Draw investment — ${nextActionCost}
                      </button>
                    </div>
                    {opsHand.length > 0 && (
                      <div className="mt-3">
                        <p className="mb-1 text-xs text-slate-600 dark:text-slate-200">
                          Play operations
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {opsHand.map((c, i) => (
                            <button
                              type="button"
                              key={`${c.id}-${i}`}
                              onClick={() => handleCardAction("playOperations", i)}
                              disabled={
                                actionLoading || (me != null && me.cash < nextActionCost)
                              }
                              className="rounded border border-cyan-500 bg-white px-2 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-indigo-500 dark:bg-slate-800/40 dark:text-slate-100 dark:hover:bg-slate-800"
                            >
                              {c.title} (+${c.cashWhenPlayed}, fee ${nextActionCost})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {invHand.some((c) => !c.upright) && (
                      <div className="mt-3">
                        <p className="mb-1 text-xs text-slate-600 dark:text-slate-200">
                          Capitalize
                        </p>
                        <div className="flex flex-col gap-1.5">
                          {invHand.map((c, i) =>
                            !c.upright ? (
                              <button
                                type="button"
                                key={`${c.id}-${i}`}
                                onClick={() => handleCardAction("capitalizeInvestment", i)}
                                disabled={
                                  actionLoading ||
                                  (me != null && me.cash < nextActionCost + c.capital)
                                }
                                className="rounded border border-cyan-500 bg-white px-2 py-1.5 text-left text-xs text-slate-800 hover:bg-slate-100 disabled:opacity-50 dark:border-indigo-500 dark:bg-slate-800/40 dark:text-slate-100 dark:hover:bg-slate-800"
                              >
                                {c.title} (${nextActionCost} + ${c.capital})
                              </button>
                            ) : null
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <p className="mb-2 mt-3 text-[11px] text-slate-500 dark:text-slate-400">
                  When you&apos;re done with actions this turn, end and pass the Baron role.
                </p>
                <button
                  type="button"
                  onClick={handleNextPhase}
                  disabled={actionLoading}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? "…" : "End turn"}
                </button>
              </section>
            )}
              </div>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
