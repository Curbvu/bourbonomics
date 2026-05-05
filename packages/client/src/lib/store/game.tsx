"use client";

/**
 * v2 game store, exposed via a React Context provider.
 *
 * Wraps `@bourbonomics/engine` and orchestrates a bot match with a Step /
 * Auto control loop. The human seat is *interactive* during the setup
 * phases (distillery selection + starter-deck draft) — when it's their
 * turn, autoplay pauses and a modal collects their input. Action-phase
 * play remains bot-driven for now.
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
  applyAction,
  awaitingHumanInput,
  computeFinalScores,
  defaultMashBillCatalog,
  initializeGame,
  isGameOver,
  stepOrchestrator,
  type GameAction,
  type GameState,
  type PlayerState,
  type ScoreResult,
} from "@bourbonomics/engine";

// Storage key is versioned and bumped whenever the engine schema or
// canonical catalog changes (so legacy saves don't crash on hydrate).
// Current bump: dev-branch named bourbon catalog (Knob's End 90, etc.)
// replaced the generic Backroad Batch / Quick Pour / etc.
const STORAGE_KEY = "bourbonomics:v2.1.3-game";
const AUTOPLAY_KEY = "bourbonomics:v2.1.3-autoplay";
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
  /** Player on the clock for human input, or null. */
  humanWaitingOn: PlayerState | null;
  newGame: (cfg: NewGameConfig) => void;
  step: () => void;
  /** Submit an action directly (used by setup-phase modals). */
  dispatch: (action: GameAction) => void;
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
  humanWaitingOn: null,
  newGame: noop,
  step: noop,
  dispatch: noop,
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

  const recordAction = useCallback((action: GameAction, round: number) => {
    seqRef.current += 1;
    const entry: LogEntry = { seq: seqRef.current, action, round };
    setLog((prevLog) => [...prevLog, entry].slice(-400));
  }, []);

  const step = useCallback(() => {
    setState((prev) => {
      if (!prev) return prev;
      if (isGameOver(prev)) return prev;
      const result = stepOrchestrator(prev);
      if (!result) return prev; // awaiting human input
      recordAction(result.action, result.state.round);
      return result.state;
    });
  }, [recordAction]);

  const dispatch = useCallback(
    (action: GameAction) => {
      setState((prev) => {
        if (!prev) return prev;
        const next = applyAction(prev, action);
        recordAction(action, next.round);
        return next;
      });
    },
    [recordAction],
  );

  // Autoplay loop — paused while waiting on human input.
  useEffect(() => {
    if (!autoplay) return;
    if (!state) return;
    if (isGameOver(state)) {
      setAutoplayState(false);
      return;
    }
    if (awaitingHumanInput(state)) return;
    const id = window.setTimeout(step, AUTO_STEP_MS);
    return () => window.clearTimeout(id);
  }, [autoplay, state, step]);

  // During setup phases the round-loop banner (with Step / Auto controls)
  // is hidden — the modal owns the screen. Auto-resolve bot picks so the
  // human sees their modal without having to advance manually.
  useEffect(() => {
    if (!state) return;
    if (isGameOver(state)) return;
    const isSetupPhase =
      state.phase === "distillery_selection" ||
      state.phase === "starter_deck_draft";
    if (!isSetupPhase) return;
    if (awaitingHumanInput(state)) return;
    // Small delay so consecutive bot picks have a visible animation beat
    // rather than collapsing to a single frame.
    const id = window.setTimeout(step, 220);
    return () => window.clearTimeout(id);
  }, [state, step]);

  const newGame = useCallback((cfg: NewGameConfig) => {
    const catalog = defaultMashBillCatalog();
    const seats = [cfg.human, ...cfg.bots];
    const players = seats.map((s, i) => ({
      id: i === 0 ? "human" : `bot${i}`,
      name: s.name,
      // The human seat is interactive during setup; bots play themselves.
      isBot: i !== 0,
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
      // No starterDecks / startingDistilleries → engine enters setup phases.
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

  const humanWaitingOn = useMemo(
    () => (state ? awaitingHumanInput(state) : null),
    [state],
  );

  const value = useMemo<GameStore>(
    () => ({
      state,
      log,
      scores,
      autoplay,
      seatMeta,
      humanWaitingOn,
      newGame,
      step,
      dispatch,
      setAutoplay,
      clear,
    }),
    [state, log, scores, autoplay, seatMeta, humanWaitingOn, newGame, step, dispatch, setAutoplay, clear],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
