"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { rickhouseRegionLabel } from "@/lib/rickhouses";
import {
  type GameDoc,
  nextActionCashCost,
  previewRickhouseFeesForPlayer,
  computeSaleProceeds,
  handHasMashForBarrel,
  isValidMashSelection,
} from "../../../functions/lib/game";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function isBotPlayer(id: string): boolean {
  return id.startsWith("bot_");
}

const PHASE_NAMES: Record<number, string> = {
  1: "Age bourbons",
  2: "Market demand",
  3: "Action phase",
};

const MAX_BARONS = 6;

/** Distinct player card themes (banner + avatar), left-to-right by seat order. */
const BARON_THEMES = [
  {
    banner: "bg-blue-600 text-white dark:bg-blue-700",
    border: "border-blue-600 dark:border-blue-400",
    avatar: "bg-blue-100 text-blue-900 dark:bg-blue-950 dark:text-blue-100",
    chip: "bg-blue-700 text-white dark:bg-blue-600",
  },
  {
    banner: "bg-slate-600 text-white dark:bg-slate-700",
    border: "border-slate-500 dark:border-slate-400",
    avatar: "bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-slate-100",
    chip: "bg-slate-700 text-white dark:bg-slate-600",
  },
  {
    banner: "bg-amber-500 text-amber-950 dark:bg-amber-600 dark:text-amber-950",
    border: "border-amber-500 dark:border-amber-400",
    avatar: "bg-amber-100 text-amber-950 dark:bg-amber-900 dark:text-amber-100",
    chip: "bg-amber-700 text-amber-950 dark:bg-amber-600 dark:text-amber-100",
  },
  {
    banner: "bg-red-600 text-white dark:bg-red-700",
    border: "border-red-600 dark:border-red-400",
    avatar: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-100",
    chip: "bg-red-700 text-white dark:bg-red-600",
  },
  {
    banner: "bg-emerald-600 text-white dark:bg-emerald-700",
    border: "border-emerald-600 dark:border-emerald-400",
    avatar: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100",
    chip: "bg-emerald-700 text-white dark:bg-emerald-600",
  },
  {
    banner: "bg-violet-600 text-white dark:bg-violet-700",
    border: "border-violet-600 dark:border-violet-400",
    avatar: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-100",
    chip: "bg-violet-700 text-white dark:bg-violet-600",
  },
] as const;

function baronInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2)
    return (parts[0]![0] + parts[1]![0]).toUpperCase();
  const one = parts[0] ?? name;
  return one.slice(0, 2).toUpperCase() || "?";
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
  operationsDeck?: string[];
  investmentDeck?: string[];
  winnerIds?: string[];
  rickhouses?: Rickhouse[];
  marketPiles?: MarketPiles;
  /** @deprecated Legacy face-up line; migrated server-side to marketPiles. */
  marketGoods?: string[];
  resourceDeck?: string[];
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
  const computerTurnRequested = useRef(false);

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-amber-50 dark:bg-amber-950/20">
        <p className="text-amber-800 dark:text-amber-200">Loading game…</p>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-amber-50 p-6 dark:bg-amber-950/20">
        <p className="text-red-600 dark:text-red-400">{error || "Game not found"}</p>
        <Link href="/" className="text-amber-700 underline dark:text-amber-300">
          Back to lobby
        </Link>
      </div>
    );
  }

  const players = game.playerOrder.map((id) => game.players[id]).filter(Boolean);
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

  async function handleNextPhase() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/phase`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to advance");
      setGame(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to advance");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRollDemand() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/roll-demand`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to roll demand");
      setGame(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to roll demand");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBuy(
    picks: { cask: number; corn: number; grain: number } | "random"
  ) {
    setActionLoading(true);
    setError("");
    try {
      const body =
        picks === "random" ? { random: true } : { picks };
      const res = await fetch(`${API_URL}/games/${gameId}/buy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to buy");
      setGame(data);
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to sell");
      setGame(data);
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

  const lastRoll = game.lastDemandRoll;

  return (
    <div className="min-h-screen bg-amber-50 p-4 dark:bg-amber-950/20">
      <header className="sticky top-0 z-10 -mx-4 mb-4 border-b border-amber-200 bg-amber-50/95 px-4 py-3 backdrop-blur-sm dark:border-amber-800 dark:bg-amber-950/90">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold text-amber-900 dark:text-amber-100 sm:text-xl">
              Game {game.gameId}
            </h1>
            {game.status === "in_progress" && (
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-2 rounded-lg border-2 border-amber-500 bg-white px-3 py-2 shadow-sm dark:border-amber-600 dark:bg-amber-900/50">
                  <span className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    Market demand
                  </span>
                  <span className="text-2xl font-bold tabular-nums text-amber-950 dark:text-amber-50">
                    {game.marketDemand}
                  </span>
                  <span className="text-xs text-amber-600 dark:text-amber-400">barrels</span>
                </div>
                {lastRoll ? (
                  <p className="max-w-xl text-xs leading-snug text-amber-800 dark:text-amber-200">
                    <span className="font-medium">Last roll:</span>{" "}
                    <span className="font-mono">
                      {lastRoll.die1} + {lastRoll.die2}
                    </span>
                    {lastRoll.doubleSix ? (
                      <> — double six, demand set to 12</>
                    ) : (
                      <>
                        {" "}
                        (sum {lastRoll.sum}) · demand {lastRoll.demandBefore} →{" "}
                        {lastRoll.demandAfter}
                      </>
                    )}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <Link href="/" className="shrink-0 text-sm text-amber-700 underline dark:text-amber-300">
            Lobby
          </Link>
        </div>

        <div className="mt-3 w-full border-t border-amber-200/80 pt-3 dark:border-amber-800/80">
          <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
            Barons
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-6">
            {Array.from({ length: MAX_BARONS }, (_, seatIndex) => {
              const pid = game.playerOrder[seatIndex];
              const p = pid ? game.players[pid] : undefined;
              const theme = BARON_THEMES[seatIndex % BARON_THEMES.length]!;
              const isCurrentTurn =
                game.status === "in_progress" &&
                seatIndex === game.currentPlayerIndex &&
                pid != null;
              const isYou = pid != null && pid === playerId;

              if (!p || !pid) {
                return (
                  <div
                    key={`seat-${seatIndex}`}
                    className="flex min-h-[6.25rem] flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber-300/70 bg-amber-50/40 px-1 text-center dark:border-amber-700/60 dark:bg-amber-950/25"
                  >
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500">
                      Seat {seatIndex + 1}
                    </span>
                    <span className="text-[9px] text-amber-500 dark:text-amber-600">Open</span>
                  </div>
                );
              }

              const resourceCount = p.resourceCards?.length ?? 0;
              const barrelCount = p.barrelledBourbons?.length ?? 0;
              const bizCount =
                (p.operationsHand?.length ?? 0) + (p.investmentHand?.length ?? 0);
              const awardCount = Array.isArray(p.bourbonCards) ? p.bourbonCards.length : 0;

              return (
                <div
                  key={pid}
                  className={`relative flex min-h-[6.25rem] flex-col overflow-hidden rounded-lg border-2 bg-white shadow-md dark:bg-amber-950/50 ${theme.border} ${
                    isCurrentTurn
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-amber-50 dark:ring-amber-300 dark:ring-offset-amber-950"
                      : ""
                  } ${isYou ? "ring-1 ring-sky-500 dark:ring-sky-400" : ""}`}
                >
                  <span
                    className="absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-amber-900 text-[10px] font-bold text-white shadow dark:bg-amber-200 dark:text-amber-950"
                    title="Seat order"
                  >
                    {seatIndex + 1}
                  </span>
                  {isCurrentTurn ? (
                    <span className="absolute right-1 top-1 z-10 rounded bg-amber-500 px-1 py-0.5 text-[9px] font-bold uppercase text-white shadow dark:bg-amber-400 dark:text-amber-950">
                      Turn
                    </span>
                  ) : null}
                  {isBotPlayer(pid) ? (
                    <span className="absolute right-1 top-7 z-10 rounded bg-slate-600 px-1 py-0.5 text-[8px] font-semibold uppercase text-white dark:bg-slate-500">
                      CPU
                    </span>
                  ) : null}

                  <div className="flex flex-1 gap-1.5 pl-8 pr-1.5 pt-7">
                    <div className="relative shrink-0 self-end pb-2">
                      <div
                        className={`flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-md border-[3px] text-sm font-bold leading-none ${theme.border} ${theme.avatar}`}
                        title={p.name}
                      >
                        {baronInitials(p.name)}
                      </div>
                      <div className="absolute -bottom-0.5 left-1/2 flex -translate-x-1/2 gap-0.5">
                        <span
                          className={`flex h-5 min-w-[1.1rem] items-center justify-center rounded-full border-2 border-white px-0.5 text-[9px] font-bold shadow ${theme.chip}`}
                          title="Resource cards in hand"
                        >
                          {resourceCount}
                        </span>
                        <span
                          className={`flex h-5 min-w-[1.1rem] items-center justify-center rounded-full border-2 border-white px-0.5 text-[9px] font-bold shadow ${theme.chip}`}
                          title="Barrelled bourbons"
                        >
                          {barrelCount}
                        </span>
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-0.5 pb-1 pt-0.5">
                      <div
                        className={`truncate rounded px-1 py-0.5 text-center text-[11px] font-semibold leading-tight ${theme.banner}`}
                      >
                        {p.name}
                        {isYou ? (
                          <span className="ml-0.5 text-[9px] font-bold opacity-90">(you)</span>
                        ) : null}
                      </div>
                      <div className="flex flex-1 flex-col justify-center gap-0.5 rounded bg-slate-800 px-1 py-1 text-[9px] leading-tight text-amber-50 dark:bg-slate-900/95 dark:text-amber-100">
                        <div className="flex items-center justify-between gap-0.5 tabular-nums">
                          <span className="text-amber-300/90">Cash</span>
                          <span className="font-bold">${p.cash}</span>
                        </div>
                        <div className="flex items-center justify-between gap-0.5 tabular-nums text-amber-100/90">
                          <span className="text-amber-300/90">Resources</span>
                          <span>{resourceCount}</span>
                        </div>
                        <div className="flex items-center justify-between gap-0.5 tabular-nums text-amber-100/90">
                          <span className="text-amber-300/90">Barreled</span>
                          <span>{barrelCount}</span>
                        </div>
                        {bizCount > 0 ? (
                          <div className="flex items-center justify-between gap-0.5 tabular-nums text-amber-100/90">
                            <span className="text-amber-300/90">Biz cards</span>
                            <span>{bizCount}</span>
                          </div>
                        ) : null}
                        {awardCount > 0 ? (
                          <div className="flex items-center justify-between gap-0.5 tabular-nums text-amber-100/90">
                            <span className="text-amber-300/90">Awards</span>
                            <span>{awardCount}</span>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded bg-red-100 px-3 py-2 text-red-800 dark:bg-red-900/50 dark:text-red-200">
          {error}
        </div>
      )}

      {isComputerTurnNow && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-100 p-3 dark:bg-amber-900/40">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
            Computer&apos;s turn…
          </p>
        </div>
      )}

      {game.status === "finished" && game.winnerIds?.length ? (
        <div className="mb-4 rounded-lg border-2 border-amber-500 bg-amber-100 p-4 dark:bg-amber-900/40">
          <p className="font-semibold text-amber-900 dark:text-amber-100">
            Game over — Winner:{" "}
            {game.winnerIds
              .map((id) => game.players[id]?.name ?? id)
              .join(", ")}
          </p>
        </div>
      ) : null}

      <div className="mb-4 rounded-lg border border-amber-200 bg-white p-3 dark:border-amber-800 dark:bg-amber-900/20">
        <p className="text-sm text-amber-800 dark:text-amber-200">
          Status: <strong>{game.status}</strong> · Mode: {game.mode}
        </p>
        <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
          Phase {game.currentPhase}: {phaseName} · Turn {game.turnNumber} · Current:{" "}
          {players[game.currentPlayerIndex]?.name ?? "—"}
          {isCurrentPlayer && " (you)"}
        </p>
        {game.status === "in_progress" && (
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Next action fee: <strong>${nextActionCost}</strong>
            <span className="text-amber-600 dark:text-amber-400">
              {" "}
              (first 3 actions free this turn, then escalating — see rules)
            </span>
            {isCurrentPlayer && !isComputerTurnNow && me != null && (
              <>
                {" "}
                · Your cash: ${me.cash}
              </>
            )}
            {" "}
            · Actions used: {game.actionsTakenThisTurn ?? 0} · Operations deck:{" "}
            {opsDeckLeft} · Investment deck: {invDeckLeft}
          </p>
        )}
      </div>

      {game.status === "lobby" && (
        <div className="mb-4">
          <button
            onClick={handleStart}
            disabled={actionLoading || players.length < 2}
            className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {actionLoading ? "Starting…" : "Start game"}
          </button>
          {players.length < 2 && (
            <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">
              Need at least 2 barons to start.
            </p>
          )}
        </div>
      )}

      {game.status === "in_progress" && isCurrentPlayer && !isComputerTurnNow && (
        <div className="mb-4 flex flex-col gap-3">
          {game.currentPhase === 1 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-3 dark:border-amber-700 dark:bg-amber-950/40">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Phase 1 — Age bourbons (rickhouse fees &amp; aging)
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                Total due this turn: <strong>${feePreview}</strong>
                {game.rickhouseFeesPaidThisTurn ? (
                  <span className="ml-2 text-green-700 dark:text-green-400">
                    Paid — your barrels aged 1 year.
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
                className="mt-2 rounded bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {game.rickhouseFeesPaidThisTurn
                  ? "Fees paid"
                  : `Pay $${feePreview} & age bourbon`}
              </button>
            </div>
          )}
          {game.currentPhase === 2 && (
            <div className="rounded-lg border border-amber-300 bg-amber-50/90 p-3 dark:border-amber-700 dark:bg-amber-950/40">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                Phase 2 — Market demand dice
              </p>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
                Roll two six-sided dice (mock). If the sum beats current demand, demand goes up
                by 1 (max 12). Double six sets demand to 12. Demand before roll:{" "}
                <strong>{game.marketDemand}</strong> (see top bar).
              </p>
              <div
                className="mt-2 flex items-center gap-3 text-amber-900 dark:text-amber-100"
                aria-hidden
              >
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-amber-600 bg-white text-2xl font-bold dark:border-amber-500 dark:bg-amber-900/40">
                  ?
                </span>
                <span className="text-lg font-medium">+</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-amber-600 bg-white text-2xl font-bold dark:border-amber-500 dark:bg-amber-900/40">
                  ?
                </span>
                <span className="text-sm text-amber-700 dark:text-amber-300">→ roll to reveal</span>
              </div>
              <button
                type="button"
                onClick={handleRollDemand}
                disabled={actionLoading}
                className="mt-3 rounded bg-amber-700 px-4 py-2 text-sm font-medium text-white hover:bg-amber-800 disabled:opacity-50"
              >
                {actionLoading ? "Rolling…" : "Roll bourbon demand dice"}
              </button>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            {game.currentPhase === 3 && (
              <>
                <button
                  type="button"
                  onClick={() => handleBuy({ cask: 1, corn: 1, grain: 1 })}
                  disabled={
                    actionLoading ||
                    marketCardsTotal < 3 ||
                    piles.cask.length < 1 ||
                    piles.corn.length < 1 ||
                    piles.grain.length < 1 ||
                    (me != null && me.cash < nextActionCost)
                  }
                  className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Buy 1+1+1 — ${nextActionCost}
                </button>
                <button
                  type="button"
                  onClick={() => handleBuy("random")}
                  disabled={
                    actionLoading ||
                    marketCardsTotal < 3 ||
                    (me != null && me.cash < nextActionCost)
                  }
                  className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                >
                  Buy 3 random — ${nextActionCost}
                </button>
                <button
                  type="button"
                  onClick={() => handleBuy({ cask: 3, corn: 0, grain: 0 })}
                  disabled={
                    actionLoading ||
                    piles.cask.length < 3 ||
                    (me != null && me.cash < nextActionCost)
                  }
                  className="rounded border border-amber-500 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-100"
                >
                  3× Cask — ${nextActionCost}
                </button>
                <button
                  type="button"
                  onClick={() => handleBuy({ cask: 0, corn: 3, grain: 0 })}
                  disabled={
                    actionLoading ||
                    piles.corn.length < 3 ||
                    (me != null && me.cash < nextActionCost)
                  }
                  className="rounded border border-amber-500 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-100"
                >
                  3× Corn — ${nextActionCost}
                </button>
                <button
                  type="button"
                  onClick={() => handleBuy({ cask: 0, corn: 0, grain: 3 })}
                  disabled={
                    actionLoading ||
                    piles.grain.length < 3 ||
                    (me != null && me.cash < nextActionCost)
                  }
                  className="rounded border border-amber-500 bg-white px-3 py-1.5 text-sm text-amber-900 hover:bg-amber-50 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-900/30 dark:text-amber-100"
                >
                  3× Grain — ${nextActionCost}
                </button>
              </>
            )}
            {game.currentPhase === 3 && (
              <div className="w-full rounded-lg border border-amber-200 bg-amber-50/90 p-2 text-sm dark:border-amber-800 dark:bg-amber-950/30">
                <p className="font-medium text-amber-900 dark:text-amber-100">
                  Mash for barreling
                </p>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300">
                  In <strong>Your hand</strong> below, tap cards to select 3–6 for this bourbon:
                  exactly <strong>1 Cask</strong>, <strong>≥1 Corn</strong>, <strong>≥1 grain</strong>{" "}
                  (Barley / Rye / Wheat / Flavor). Then pick a rickhouse.
                </p>
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  Selected: {mashSelection.size} card{mashSelection.size === 1 ? "" : "s"}
                  {mashSelection.size > 0
                    ? ` — ${selectedMashCards.join(", ")}`
                    : ""}
                  {mashSelection.size > 0 && !mashSelectionValid ? (
                    <span className="ml-1 text-red-700 dark:text-red-400">
                      (invalid — adjust selection)
                    </span>
                  ) : null}
                  {mashSelectionValid ? (
                    <span className="ml-1 text-green-700 dark:text-green-400">— valid mash</span>
                  ) : null}
                </p>
                {mashSelection.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setMashSelection(new Set())}
                    className="mt-1 text-xs text-amber-700 underline dark:text-amber-300"
                  >
                    Clear mash selection
                  </button>
                )}
              </div>
            )}
            {game.currentPhase === 3 && (
              <>
                {rickhouses.map(
                  (r) =>
                    r.barrels.length < r.capacity && (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => handleBarrel(r.id)}
                        disabled={
                          actionLoading ||
                          !mashSelectionValid ||
                          (me != null &&
                            me.cash < r.barrels.length + 1 + nextActionCost)
                        }
                        className="rounded bg-amber-600 px-3 py-1.5 text-sm text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        Barrel — {rickhouseRegionLabel(r.id)} (entry{" "}
                        {r.barrels.length + 1} + fee ${nextActionCost})
                      </button>
                    )
                )}
              </>
            )}
            {game.currentPhase !== 2 && (
              <button
                type="button"
                onClick={handleNextPhase}
                disabled={actionLoading}
                className="rounded bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {actionLoading
                  ? "…"
                  : game.currentPhase === 3
                    ? "End turn"
                    : "Next phase"}
              </button>
            )}
          </div>
          {inCardPhases && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                Operations and investments
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleCardAction("drawOperations")}
                  disabled={
                    actionLoading ||
                    opsDeckLeft === 0 ||
                    (me != null && me.cash < nextActionCost)
                  }
                  className="rounded bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
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
                  className="rounded bg-amber-700 px-3 py-1.5 text-sm text-white hover:bg-amber-800 disabled:opacity-50 dark:bg-amber-600 dark:hover:bg-amber-500"
                >
                  Draw investment — ${nextActionCost}
                </button>
              </div>
              {opsHand.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-amber-700 dark:text-amber-300">
                    Operations in hand
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {opsHand.map((c, i) => (
                      <button
                        type="button"
                        key={`${c.id}-${i}`}
                        onClick={() => handleCardAction("playOperations", i)}
                        disabled={
                          actionLoading || (me != null && me.cash < nextActionCost)
                        }
                        className="rounded border border-amber-400 bg-white px-2 py-1 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900"
                      >
                        Play {c.title} (+${c.cashWhenPlayed}, fee ${nextActionCost})
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {invHand.some((c) => !c.upright) && (
                <div className="mt-3">
                  <p className="mb-1 text-xs text-amber-700 dark:text-amber-300">
                    Capitalize investments (fee + printed capital)
                  </p>
                  <div className="flex flex-wrap gap-2">
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
                          className="rounded border border-amber-400 bg-white px-2 py-1 text-xs text-amber-900 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-600 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900"
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
        </div>
      )}

      {game.status === "in_progress" && (
        <>
          <section className="mt-4 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <h2 className="mb-2 font-semibold text-amber-900 dark:text-amber-100">
              Market (face-down piles)
            </h2>
            <p className="mb-2 text-sm text-amber-700 dark:text-amber-300">
              Cask: {piles.cask.length} · Corn: {piles.corn.length} · Grain:{" "}
              {piles.grain.length}
              {deckLeft > 0 ? ` · Side deck: ${deckLeft}` : null}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Each buy action draws exactly 3 cards; you choose how many from each pile (or
              random).
            </p>
          </section>
          <section className="mt-4 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <h2 className="mb-2 font-semibold text-amber-900 dark:text-amber-100">
              Rickhouses
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {rickhouses.map((r) => {
                const soleBaron6 =
                  r.capacity === 6 &&
                  r.barrels.length > 0 &&
                  r.barrels.every((b) => b.playerId === r.barrels[0].playerId);
                return (
                  <div
                    key={r.id}
                    className="rounded border border-amber-300 p-2 dark:border-amber-700"
                  >
                    <p className="text-sm font-medium leading-snug">
                      {rickhouseRegionLabel(r.id)}
                    </p>
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      {r.barrels.length}/{r.capacity} barrels
                      {r.barrels.length > 0 ? (
                        <>
                          {" "}
                          · Next entry rent: <strong>${r.barrels.length + 1}</strong> · Yearly
                          per barrel:{" "}
                          <strong>${soleBaron6 ? 0 : r.barrels.length}</strong>
                          {soleBaron6 ? " (sole baron, 6-cap)" : ""}
                        </>
                      ) : (
                        <> · Empty — next entry rent $1</>
                      )}
                    </p>
                    <ul className="mt-1 max-h-28 space-y-0.5 overflow-y-auto text-xs text-amber-800 dark:text-amber-200">
                      {r.barrels.map((b) => {
                        const name =
                          game.players[b.playerId]?.name ?? b.playerId.slice(0, 8);
                        return (
                          <li key={b.barrelId}>
                            {name} · age {b.age}y · {b.barrelId.slice(-6)}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                );
              })}
            </div>
          </section>
          {me && (
            <section className="mt-4 rounded-lg border border-amber-200 bg-white p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <h2 className="mb-2 font-semibold text-amber-900 dark:text-amber-100">
                Your hand
              </h2>
              <p className="mb-2 text-sm text-amber-700 dark:text-amber-300">
                ${me.cash} · {me.resourceCards.length} resource cards
                {me.resourceCards.length > 0 && (
                  <>
                    {" "}
                    · Cask {me.resourceCards.filter((c) => c === "Cask").length}, Corn{" "}
                    {me.resourceCards.filter((c) => c === "Corn").length}, Grain{" "}
                    {
                      me.resourceCards.filter((c) =>
                        ["Barley", "Rye", "Wheat", "Flavor"].includes(c)
                      ).length
                    }
                  </>
                )}
                {canMash
                  ? " · Tap cards in the Action phase to build your mash"
                  : ""}
              </p>
              <div className="flex flex-wrap gap-1">
                {me.resourceCards.map((c, i) => {
                  const selected = mashSelection.has(i);
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
                      className={`rounded px-2 py-0.5 text-xs transition-colors ${
                        selected
                          ? "bg-amber-600 font-medium text-white ring-2 ring-amber-800 dark:bg-amber-500 dark:ring-amber-300"
                          : "bg-amber-100 text-amber-900 dark:bg-amber-800 dark:text-amber-100"
                      } ${canToggle ? "cursor-pointer hover:opacity-90" : "cursor-default opacity-70"}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {opsHand.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                    Operations cards
                  </p>
                  <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                    {opsHand.map((c, i) => (
                      <li key={`${c.id}-${i}`}>
                        {c.title} (play +${c.cashWhenPlayed})
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {invHand.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-amber-800 dark:text-amber-200">
                    Investment cards
                  </p>
                  <ul className="space-y-1 text-xs text-amber-700 dark:text-amber-300">
                    {invHand.map((c, i) => (
                      <li key={`${c.id}-${i}`}>
                        {c.title}
                        {c.upright ? " — active" : ` — sideways (capital $${c.capital})`}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {me.barrelledBourbons.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-amber-800 dark:text-amber-200">
                    Your barrelled bourbon
                  </p>
                  <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                    {me.barrelledBourbons.map((b) => {
                      const loc = rickhouseRegionLabel(b.rickhouseId);
                      const est = computeSaleProceeds(b.age, game.marketDemand);
                      const canSell =
                        isCurrentPlayer &&
                        !isComputerTurnNow &&
                        game.currentPhase === 3 &&
                        b.age >= 2;
                      return (
                        <li
                          key={b.id}
                          className="flex flex-wrap items-center gap-2 rounded border border-amber-200/80 px-2 py-1 dark:border-amber-800"
                        >
                          <span>
                            {loc} · {b.age}y · est. ${est}
                            {b.mashCards?.length ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">
                                {" "}
                                · mash {b.mashCards.length} cards
                              </span>
                            ) : null}
                          </span>
                          {canSell && (
                            <button
                              type="button"
                              onClick={() => handleSellBarrel(b.id)}
                              disabled={
                                actionLoading || (me != null && me.cash < nextActionCost)
                              }
                              className="rounded bg-amber-700 px-2 py-0.5 text-xs text-white hover:bg-amber-800 disabled:opacity-50"
                            >
                              Sell (fee ${nextActionCost})
                            </button>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
