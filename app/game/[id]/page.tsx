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
import {
  type GameDoc,
  nextActionCashCost,
  previewRickhouseFeesForPlayer,
  computeSaleProceeds,
  handHasMashForBarrel,
  isValidMashSelection,
  getLobbySeatsForDisplay,
  lobbyHasUnfilledOpenSeat,
  countSeatedBarons,
  gameModeDisplayLabel,
} from "../../../functions/lib/game";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

function isBotPlayer(id: string): boolean {
  return id.startsWith("bot_");
}

function DemandDiceFaces(props: {
  left: number | "?";
  right: number | "?";
  after: ReactNode;
  className?: string;
  announceLabel?: string;
}) {
  const { left, right, after, className, announceLabel } = props;
  return (
    <div
      className={`flex flex-wrap items-center gap-3 text-slate-800 dark:text-slate-100 ${className ?? ""}`}
      role={announceLabel ? "region" : undefined}
      aria-label={announceLabel}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-indigo-500 bg-white text-2xl font-bold tabular-nums dark:border-indigo-400 dark:bg-slate-800/40">
        {left}
      </span>
      <span className="text-lg font-medium">+</span>
      <span className="flex h-12 w-12 items-center justify-center rounded-lg border-2 border-indigo-500 bg-white text-2xl font-bold tabular-nums dark:border-indigo-400 dark:bg-slate-800/40">
        {right}
      </span>
      <span className="min-w-0 text-sm leading-snug text-slate-600 dark:text-slate-200">
        {after}
      </span>
    </div>
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
  operationsDeck?: string[];
  investmentDeck?: string[];
  winnerIds?: string[];
  rickhouses?: Rickhouse[];
  marketPiles?: MarketPiles;
  /** @deprecated Legacy face-up line; migrated server-side to marketPiles. */
  marketGoods?: string[];
  resourceDeck?: string[];
  lobbySeats?: { kind: string; playerId?: string }[];
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

  async function handleNextPhase() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/games/${gameId}/phase`, { method: "POST" });
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

  const lastRoll = game.lastDemandRoll;

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
                    className="flex min-h-[5rem] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-800/40 bg-slate-800/30 px-1 text-center dark:border-slate-800/50 dark:bg-black/20"
                  >
                    <span className="text-[10px] font-bold text-slate-600 dark:text-slate-500">
                      Seat {seatIndex + 1}
                    </span>
                    <span className="text-[9px] text-slate-500/80 dark:text-slate-600">Closed</span>
                  </div>
                );
              }

              if (row.rowKind === "empty") {
                return (
                  <div
                    key={`seat-${seatIndex}-empty`}
                    className="flex min-h-[5rem] flex-col items-center justify-center rounded-lg border-2 border-dashed border-slate-200/70 bg-slate-100/40 px-1 text-center dark:border-slate-600/60 dark:bg-slate-800/25"
                  >
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                      Seat {seatIndex + 1}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-slate-500">
                      {row.emptyLabel}
                    </span>
                    {row.emptyLabel === "Open" && game.status === "lobby" ? (
                      <span className="mt-0.5 text-[8px] text-slate-400/90 dark:text-slate-500">
                        Waiting…
                      </span>
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
                  className={`relative flex min-h-[5rem] flex-col overflow-hidden rounded-lg border-2 bg-white shadow-md dark:bg-slate-800/50 ${theme.border} ${
                    isCurrentTurn
                      ? "ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-100 dark:ring-cyan-300 dark:ring-offset-slate-950"
                      : ""
                  } ${isYou ? "ring-1 ring-sky-500 dark:ring-sky-400" : ""}`}
                >
                  <span
                    className="absolute left-1 top-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-white shadow dark:bg-slate-200 dark:text-slate-950"
                    title="Seat order"
                  >
                    {seatIndex + 1}
                  </span>
                  {isCurrentTurn ? (
                    <span className="absolute right-1 top-1 z-10 rounded bg-teal-500 px-1 py-0.5 text-[9px] font-bold uppercase text-white shadow dark:bg-teal-400 dark:text-slate-950">
                      Turn
                    </span>
                  ) : null}
                  {isBotPlayer(pid) ? (
                    <span className="absolute right-1 top-7 z-10 rounded bg-slate-600 px-1 py-0.5 text-[8px] font-semibold uppercase text-white dark:bg-slate-500">
                      CPU
                    </span>
                  ) : null}

                  <div className="flex flex-1 gap-1 pl-7 pr-1 pt-6">
                    <div className="flex shrink-0 items-center pb-1">
                      <div
                        className={`flex h-11 w-11 items-center justify-center rounded-md border-2 text-xs font-bold leading-none ${theme.border} ${theme.avatar}`}
                        title={p.name}
                      >
                        {baronInitials(p.name)}
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-1 flex-col gap-1 pb-1 pt-0.5">
                      <div
                        className={`truncate rounded px-1 py-0.5 text-center text-[11px] font-semibold leading-tight ${theme.banner}`}
                      >
                        {p.name}
                        {isYou ? (
                          <span className="ml-0.5 text-[9px] font-bold opacity-90">(you)</span>
                        ) : null}
                      </div>
                      <div className="grid min-h-0 flex-1 grid-cols-3 gap-1">
                        <div
                          className={`flex min-w-0 flex-col items-center justify-center rounded-md border-2 bg-slate-100 px-0.5 py-1.5 text-center shadow-sm dark:bg-slate-950/90 ${theme.border}`}
                          title="Cash"
                        >
                          <span className="text-[8px] font-bold uppercase leading-none tracking-wide text-slate-500 dark:text-slate-500">
                            Cash
                          </span>
                          <span className="mt-1 text-sm font-bold tabular-nums leading-none text-slate-900 dark:text-slate-50">
                            ${p.cash}
                          </span>
                        </div>
                        <div
                          className={`flex min-w-0 flex-col items-center justify-center rounded-md border-2 bg-slate-100 px-0.5 py-1.5 text-center shadow-sm dark:bg-slate-950/90 ${theme.border}`}
                          title="Resource cards in hand"
                        >
                          <span className="text-[8px] font-bold uppercase leading-none tracking-wide text-slate-500 dark:text-slate-500">
                            Res.
                          </span>
                          <span className="mt-1 text-sm font-bold tabular-nums leading-none text-slate-900 dark:text-slate-50">
                            {resourceCount}
                          </span>
                        </div>
                        <div
                          className={`flex min-w-0 flex-col items-center justify-center rounded-md border-2 bg-slate-100 px-0.5 py-1.5 text-center shadow-sm dark:bg-slate-950/90 ${theme.border}`}
                          title="Barrelled bourbons"
                        >
                          <span className="text-[8px] font-bold uppercase leading-none tracking-wide text-slate-500 dark:text-slate-500">
                            Barrels
                          </span>
                          <span className="mt-1 text-sm font-bold tabular-nums leading-none text-slate-900 dark:text-slate-50">
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
                const soleBaron6 =
                  r.capacity === 6 &&
                  r.barrels.length > 0 &&
                  r.barrels.every((b) => b.playerId === r.barrels[0].playerId);
                return (
                  <div
                    key={r.id}
                    className="rounded border border-slate-200 bg-white/80 p-1.5 dark:border-slate-600 dark:bg-slate-800/40"
                  >
                    <p className="text-xs font-medium leading-snug text-slate-800 dark:text-slate-100">
                      {rickhouseRegionLabel(r.id)}
                    </p>
                    <p className="text-[10px] leading-tight text-slate-500 dark:text-slate-300">
                      {r.barrels.length}/{r.capacity} filled
                      {r.barrels.length > 0 ? (
                        <>
                          {" "}
                          · Next entry <strong>${r.barrels.length + 1}</strong> · Yearly / barrel{" "}
                          <strong>${soleBaron6 ? 0 : r.barrels.length}</strong>
                          {soleBaron6 ? " (sole 6-cap)" : ""}
                        </>
                      ) : (
                        <> · Next entry $1</>
                      )}
                    </p>
                    <div
                      className="mt-1.5 grid gap-1"
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
                                className={`flex min-h-[2.25rem] flex-col items-center justify-center rounded border-2 border-dashed text-[8px] font-medium transition ${
                                  canSubmit
                                    ? "cursor-pointer border-indigo-400 bg-indigo-50/80 text-indigo-800 shadow-sm hover:border-indigo-500 hover:bg-indigo-100/90 active:scale-[0.98] dark:border-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-100 dark:hover:bg-indigo-900/50"
                                    : "cursor-not-allowed border-slate-200/70 bg-slate-100/50 text-slate-400 opacity-80 dark:border-slate-600/60 dark:bg-slate-800/30 dark:text-slate-500"
                                }`}
                              >
                                {canSubmit ? "+" : "—"}
                              </button>
                            );
                          }

                          return (
                            <div
                              key={`${r.id}-slot-${slotIdx}`}
                              className="flex min-h-[2.25rem] flex-col items-center justify-center rounded border-2 border-dashed border-slate-200/70 bg-slate-100/50 text-[8px] font-medium text-slate-400 dark:border-slate-600/60 dark:bg-slate-800/30 dark:text-slate-500"
                              title="Empty slot"
                            >
                              —
                            </div>
                          );
                        }
                        const name =
                          game.players[b.playerId]?.name ?? b.playerId.slice(0, 8);
                        const theme = baronThemeForPlayer(game.playerOrder, b.playerId);
                        return (
                          <div
                            key={b.barrelId}
                            title={`${name} · age ${b.age}y · ${b.barrelId.slice(-6)}`}
                            className={`flex min-h-[2.25rem] flex-col items-center justify-center rounded border-2 bg-white px-0.5 py-0.5 text-center shadow-sm dark:bg-slate-800/50 ${theme.border}`}
                          >
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded text-[9px] font-bold leading-none ${theme.avatar}`}
                            >
                              {baronInitials(name)}
                            </span>
                            <span className="mt-0.5 text-[8px] font-semibold tabular-nums text-slate-800 dark:text-slate-100">
                              {b.age}y
                            </span>
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
      <div className="flex min-h-screen flex-col lg:flex-row lg:items-stretch">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col border-slate-200 dark:border-slate-800 lg:border-r">
          <header className="sticky top-0 z-10 shrink-0 border-b border-slate-200 bg-slate-100/95 px-3 py-2 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h1 className="min-w-0 truncate text-base font-bold text-slate-800 dark:text-slate-100 sm:text-lg">
                Game {game.gameId}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {game.status === "in_progress" && (
                  <div className="flex items-center gap-1.5 rounded-md border border-indigo-400 bg-white px-2 py-1 shadow-sm dark:border-indigo-500 dark:bg-slate-800/60">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-200">
                      Demand
                    </span>
                    <span className="text-lg font-bold tabular-nums text-slate-800 dark:text-slate-100">
                      {game.marketDemand}
                    </span>
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
            {game.status === "in_progress" && lastRoll ? (
              <p className="mt-1 line-clamp-2 text-[10px] leading-snug text-slate-600 dark:text-slate-200">
                <span className="font-medium">Last roll:</span>{" "}
                <span className="font-mono">
                  {lastRoll.die1} + {lastRoll.die2}
                </span>
                {lastRoll.doubleSix ? (
                  <> — double six → demand 12</>
                ) : (
                  <>
                    {" "}
                    (sum {lastRoll.sum}) · {lastRoll.demandBefore} → {lastRoll.demandAfter}
                  </>
                )}
              </p>
            ) : null}
          </header>

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
                      ? "Fill every open seat with a player, or change open slots to Closed or Computer before starting."
                      : lobbySeatsUi && countSeatedBarons(lobbySeatsUi) < 2
                        ? "Need at least 2 barons (add a computer or wait for another player)."
                        : "Need at least 2 barons to start."}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {game.status === "in_progress" && (
          <aside className="flex w-full shrink-0 flex-col border-t border-slate-300/80 bg-gradient-to-b from-slate-200/90 to-indigo-50/80 dark:border-slate-800 dark:from-slate-900 dark:to-slate-950 lg:sticky lg:top-0 lg:h-screen lg:max-h-screen lg:w-[min(100%,22rem)] lg:border-l lg:border-t-0 xl:w-96">
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

              <div className="shrink-0 rounded-md border border-slate-200/90 bg-white/90 px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-800/60">
                <p className="text-[11px] leading-snug text-slate-700 dark:text-slate-200">
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {phaseName}
                  </span>
                  <span className="text-slate-400"> · </span>
                  Turn {game.turnNumber}
                  <span className="text-slate-400"> · </span>
                  {gameModeDisplayLabel(game.mode)}
                  <span className="text-slate-400"> · </span>
                  Next <strong className="tabular-nums">${nextActionCost}</strong>
                  <span className="text-slate-400"> · </span>
                  Ops {opsDeckLeft} · Inv {invDeckLeft} · {game.actionsTakenThisTurn ?? 0} used
                  {isCurrentPlayer && me != null ? (
                    <>
                      <span className="text-slate-400"> · </span>
                      Cash <strong className="tabular-nums">${me.cash}</strong>
                    </>
                  ) : null}
                </p>
              </div>

              <div className="min-h-0 flex-1 space-y-3">
            {game.currentPhase === 3 && lastRoll ? (
              <div className="rounded-lg border border-slate-200 bg-slate-100/90 p-3 dark:border-slate-600 dark:bg-slate-800/40">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                  Phase 2 — Market demand dice
                </p>
                <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                  Result this turn (faces below match the roll).
                </p>
                <DemandDiceFaces
                  className="mt-2"
                  left={lastRoll.die1}
                  right={lastRoll.die2}
                  announceLabel={`Demand dice: ${lastRoll.die1} and ${lastRoll.die2}`}
                  after={
                    lastRoll.doubleSix ? (
                      <span>
                        Double six → demand set to <strong>12</strong>
                      </span>
                    ) : (
                      <span>
                        Sum <strong className="tabular-nums">{lastRoll.sum}</strong>
                        <span className="text-slate-500 dark:text-slate-400"> · </span>
                        demand{" "}
                        <strong className="tabular-nums">{lastRoll.demandBefore}</strong>
                        {" → "}
                        <strong className="tabular-nums">{lastRoll.demandAfter}</strong>
                      </span>
                    )
                  }
                />
              </div>
            ) : null}
            {isCurrentPlayer && !isComputerTurnNow && (
              <div className="flex flex-col gap-3">
                {game.currentPhase === 1 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-100/90 p-3 dark:border-slate-600 dark:bg-slate-800/40">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      Phase 1 — Age bourbons (rickhouse fees &amp; aging)
                    </p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
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
                      className="mt-2 rounded bg-indigo-700 px-3 py-1.5 text-sm text-white hover:bg-indigo-800 disabled:opacity-50"
                    >
                      {game.rickhouseFeesPaidThisTurn
                        ? "Fees paid"
                        : `Pay $${feePreview} & age bourbon`}
                    </button>
                  </div>
                )}
                {game.currentPhase === 2 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-100/90 p-3 dark:border-slate-600 dark:bg-slate-800/40">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">
                      Phase 2 — Market demand dice
                    </p>
                    <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">
                      Roll two six-sided dice (mock). If the sum beats current demand, demand goes
                      up by 1 (max 12). Double six sets demand to 12. Demand before roll:{" "}
                      <strong>{game.marketDemand}</strong> (see top bar).
                    </p>
                    <DemandDiceFaces
                      className="mt-2"
                      left="?"
                      right="?"
                      after="→ roll to reveal"
                    />
                    <button
                      type="button"
                      onClick={handleRollDemand}
                      disabled={actionLoading}
                      className="mt-3 rounded bg-indigo-700 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-800 disabled:opacity-50"
                    >
                      {actionLoading ? "Rolling…" : "Roll bourbon demand dice"}
                    </button>
                  </div>
                )}
                {game.currentPhase === 1 && (
                  <button
                    type="button"
                    onClick={handleNextPhase}
                    disabled={actionLoading}
                    className="w-full max-w-xs rounded bg-indigo-600 px-4 py-2 font-medium text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto"
                  >
                    {actionLoading ? "…" : "Next phase"}
                  </button>
                )}
              </div>
            )}

            {me && (
              <section className="rounded-lg border border-slate-200 bg-white/95 p-3 dark:border-violet-700 dark:bg-slate-800/25">
              <h2 className="mb-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Your hand
              </h2>
              <p className="mb-2 text-xs text-slate-600 dark:text-slate-200">
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
                  ? " · Tap cards to build mash, then tap a + on an empty rickhouse slot"
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
                          ? "bg-indigo-600 font-medium text-white ring-2 ring-slate-700 dark:bg-teal-500 dark:ring-cyan-300"
                          : "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100"
                      } ${canToggle ? "cursor-pointer hover:opacity-90" : "cursor-default opacity-70"}`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              {opsHand.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                    Operations cards
                  </p>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-200">
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
                  <p className="mb-1 text-xs font-medium text-slate-700 dark:text-slate-200">
                    Investment cards
                  </p>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-200">
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
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-700 dark:text-slate-200">
                    Your barrelled bourbon
                  </p>
                  <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-200">
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
                          className="flex flex-wrap items-center gap-2 rounded border border-slate-200/80 px-2 py-1 dark:border-violet-700"
                        >
                          <span>
                            {loc} · {b.age}y · est. ${est}
                            {b.mashCards?.length ? (
                              <span className="text-xs text-slate-500 dark:text-slate-300">
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
                              className="rounded bg-indigo-700 px-2 py-0.5 text-xs text-white hover:bg-indigo-800 disabled:opacity-50"
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

            <section className="rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/30">
              <h2 className="mb-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                Market
              </h2>
              <p className="mb-3 text-[11px] text-slate-500 dark:text-slate-300">
                {game.currentPhase === 3 && isCurrentPlayer && !isComputerTurnNow
                  ? "Tap piles in order to choose 3 cards, then confirm (one buy action)."
                  : "Face-down piles — counts shown. Resource buys happen in the Action phase."}
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
                      Tap piles above in order. Order is kept so you know what you took.
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
              <section className="rounded-lg border border-slate-200 bg-white/95 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/30">
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-800 dark:text-slate-100">
                  Action phase
                </h2>

                <div className="mb-3 rounded-lg border border-slate-200 bg-slate-100/90 p-2 text-sm dark:border-violet-700 dark:bg-slate-800/30">
                  <p className="font-medium text-slate-800 dark:text-slate-100">
                    Mash for barreling
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-200">
                    In <strong>Your hand</strong> (above), tap cards for 3–6:{" "}
                    <strong>1 Cask</strong>, <strong>≥1 Corn</strong>, <strong>≥1 grain</strong>.
                    Then tap a <strong>+</strong> on an empty rickhouse slot on the board to barrel.
                  </p>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                    Selected: {mashSelection.size} card{mashSelection.size === 1 ? "" : "s"}
                    {mashSelection.size > 0 ? ` — ${selectedMashCards.join(", ")}` : ""}
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

                <button
                  type="button"
                  onClick={handleNextPhase}
                  disabled={actionLoading}
                  className="mb-4 w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading ? "…" : "End turn"}
                </button>

                {inCardPhases && (
                  <div className="border-t border-slate-200 pt-3 dark:border-violet-700">
                    <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-700 dark:text-slate-200">
                      Operations &amp; investments
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
