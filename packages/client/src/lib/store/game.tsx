"use client";

/**
 * v2 game store, exposed via a React Context provider.
 *
 * Wraps `@bourbonomics/engine` and orchestrates a bot-vs-bot match with a
 * Step / Auto control loop. State is persisted to localStorage between
 * route navigations so the homescreen → /play flow preserves the active
 * game.
 *
 * The "human" seat from the new-game form is treated as another bot
 * internally — matches the user's "computer-only" scope for now.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  computeFinalScores,
  defaultMashBillCatalog,
  initializeGame,
  isGameOver,
  stepOrchestrator,
  type GameAction,
  type GameState,
  type ScoreResult,
} from "@bourbonomics/engine";

const STORAGE_KEY = "bourbonomics:v2-game";
const AUTOPLAY_KEY = "bourbonomics:v2-autoplay";
const AUTO_STEP_MS = 280;

export interface NewGameSeat {
  name: string;
  /** Logo id picked from playerLogos.ts (purely cosmetic). */
  logoId?: string;
  /** Difficulty picker is cosmetic in v2 — every seat plays via the heuristic bot. */
  difficulty?: "easy" | "normal" | "hard";
}

export interface NewGameConfig {
  /** Human seat goes first; bots follow. */
  human: NewGameSeat;
  bots: NewGameSeat[];
  seed?: number;
}

export interface LogEntry {
  seq: number;
  action: GameAction;
  round: number;
}

export interface GameStore {
  state: GameState | null;
  log: LogEntry[];
  scores: ScoreResult[] | null;
  autoplay: boolean;
  /** Cosmetic — seat metadata captured at new-game time. */
  seatMeta: { id: string; logoId?: string; difficulty?: string }[];
  newGame: (cfg: NewGameConfig) => void;
  step: () => void;
  setAutoplay: (on: boolean) => void;
  clear: () => void;
}

const noop = () => {};
const Ctx = createContext<GameStore>({
  state: null,
  log: [],
  scores: null,
  autoplay: false,
  seatMeta: [],
  newGame: noop,
  step: noop,
  setAutoplay: noop,
  clear: noop,
});

export function useGameStore(): GameStore {
  return useContext(Ctx);
}

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GameState | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [autoplay, setAutoplayState] = useState(false);
  const [seatMeta, setSeatMeta] = useState<GameStore["seatMeta"]>([]);
  const [hydrated, setHydrated] = useState(false);
  const seqRef = useRef(0);

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          state: GameState;
          log: LogEntry[];
          seatMeta: GameStore["seatMeta"];
        };
        setState(saved.state);
        setLog(saved.log ?? []);
        setSeatMeta(saved.seatMeta ?? []);
        seqRef.current = (saved.log ?? []).length;
      }
      const auto = window.localStorage.getItem(AUTOPLAY_KEY);
      if (auto === "true") setAutoplayState(true);
    } catch {
      // ignore — corrupt storage just means a fresh start
    }
    setHydrated(true);
  }, []);

  // Persist on change.
  useEffect(() => {
    if (!hydrated) return;
    try {
      if (state) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ state, log, seatMeta }),
        );
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      window.localStorage.setItem(AUTOPLAY_KEY, autoplay ? "true" : "false");
    } catch {
      // ignore quota / private mode failures
    }
  }, [state, log, seatMeta, autoplay, hydrated]);

  const step = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      if (isGameOver(prev)) return prev;
      const result = stepOrchestrator(prev);
      if (!result) return prev;
      seqRef.current += 1;
      const entry: LogEntry = {
        seq: seqRef.current,
        action: result.action,
        round: result.state.round,
      };
      setLog((prevLog) => [...prevLog, entry].slice(-400));
      return result.state;
    });
  }, []);

  // Autoplay loop.
  useEffect(() => {
    if (!autoplay) return;
    if (!state) return;
    if (isGameOver(state)) {
      setAutoplayState(false);
      return;
    }
    const id = window.setTimeout(step, AUTO_STEP_MS);
    return () => window.clearTimeout(id);
  }, [autoplay, state, step]);

  const newGame = useCallback((cfg: NewGameConfig) => {
    const catalog = defaultMashBillCatalog();
    const seats = [cfg.human, ...cfg.bots];
    const players = seats.map((s, i) => ({
      id: i === 0 ? "human" : `bot${i}`,
      name: s.name,
      isBot: true, // computer-only for now
    }));
    const meta = seats.map((s, i) => ({
      id: i === 0 ? "human" : `bot${i}`,
      logoId: s.logoId,
      difficulty: s.difficulty,
    }));
    const seed = cfg.seed ?? Math.floor(Math.random() * 0xffff_ffff);
    // Each player gets 3 mash bills; remainder forms the bourbon deck.
    const startingMashBills: ReturnType<typeof defaultMashBillCatalog>[] = [];
    let cursor = 0;
    for (let i = 0; i < players.length; i++) {
      const slice = catalog.slice(cursor, cursor + 3);
      startingMashBills.push(slice);
      cursor += slice.length;
    }
    const bourbonDeck = catalog.slice(cursor);
    const fresh = initializeGame({
      seed,
      players,
      startingMashBills,
      bourbonDeck,
    });
    setState(fresh);
    setLog([]);
    setSeatMeta(meta);
    seqRef.current = 0;
    setAutoplayState(false);
  }, []);

  const clear = useCallback(() => {
    setState(null);
    setLog([]);
    setSeatMeta([]);
    seqRef.current = 0;
    setAutoplayState(false);
  }, []);

  const setAutoplay = useCallback((on: boolean) => {
    setAutoplayState(on);
  }, []);

  const scores = useMemo(
    () => (state && isGameOver(state) ? computeFinalScores(state) : null),
    [state],
  );

  const value = useMemo<GameStore>(
    () => ({
      state,
      log,
      scores,
      autoplay,
      seatMeta,
      newGame,
      step,
      setAutoplay,
      clear,
    }),
    [state, log, scores, autoplay, seatMeta, newGame, step, setAutoplay, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
