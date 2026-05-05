"use client";

/**
 * v2 game store, exposed via a React Context provider.
 *
 * Wraps `@bourbonomics/engine` and orchestrates a bot match with a Step /
 * Auto control loop. The human seat is *interactive* during the setup
 * phases (distillery selection + starter-deck draft) — when it's their
 * turn, autoplay pauses and a modal collects their input. Action-phase
 * play is driven by the human via the ActionBar; bot turns auto-step.
 *
 * Game state, log, and seq counter are kept in a single atomic store
 * object so each transition is a *pure* setState update. That matters in
 * dev: React StrictMode invokes setState updaters twice to detect impure
 * side effects — recording the log inside an updater (the previous shape)
 * doubled every entry. Atomic shape means both StrictMode runs produce
 * the same next value and React commits one.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
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
  type Card,
  type GameAction,
  type GameState,
  type InvestmentCard,
  type MashBill,
  type OperationsCard,
  type PlayerState,
  type ScoreResult,
} from "@bourbonomics/engine";

// Storage key is versioned and bumped whenever the engine schema or
// canonical catalog changes (so legacy saves don't crash on hydrate).
// Current bump: removed RUSH_TO_MARKET + pendingRushBarrelId from the
// engine, ops cards now bought from market with a `cost` field, and
// premium resources gained displayName/flavor/aliases.
const STORAGE_KEY = "bourbonomics:v2.2.0-game";
const AUTOPLAY_KEY = "bourbonomics:v2.2.0-autoplay";
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

/**
 * Inspect-modal payload. The kind discriminator tells the modal which
 * card-shape renderer to use. Click handlers in MarketCenter / HandTray
 * call `setInspect` with one of these.
 */
export type InspectPayload =
  | { kind: "resource" | "capital"; card: Card; ownerName?: string }
  | { kind: "mashbill"; bill: MashBill; ownerName?: string }
  | { kind: "operations"; card: OperationsCard; ownerName?: string }
  | { kind: "investment"; card: InvestmentCard };

/**
 * Interactive market-buy mode. While this is non-null the human is in
 * the middle of picking a market target + tagging the resource/capital
 * cards they want to spend; the conveyor + ops row + hand light up as
 * click targets and `BuyOverlay` renders the running cost vs paid totals.
 *
 * Targets:
 *   - source = "conveyor" → `slotIndex` is into `state.marketConveyor`
 *   - source = "operations" → `slotIndex` is the face-up ops position (0..2)
 */
export interface BuyMode {
  pickedTarget: { source: "conveyor" | "operations"; slotIndex: number } | null;
  spendCardIds: string[];
}

/**
 * Last-purchased card snapshot. Bumped by every BUY_FROM_MARKET dispatch
 * (human or bot) and consumed by `PurchaseFlight` to drive the fly-down
 * animation. `seq` is the unique key — same card bought twice still
 * triggers a fresh animation because the seq increments.
 */
export interface LastPurchase {
  card: Card;
  seq: number;
}

interface AtomicStore {
  state: GameState | null;
  log: LogEntry[];
  seqCounter: number;
  seatMeta: { id: string; logoId?: string; difficulty?: string }[];
  lastPurchase: LastPurchase | null;
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
  /** Currently-inspected card payload (modal render target), or null. */
  inspect: InspectPayload | null;
  setInspect: (payload: InspectPayload | null) => void;
  /** Interactive market-buy state, null when not in buying mode. */
  buyMode: BuyMode | null;
  startBuyMode: () => void;
  cancelBuyMode: () => void;
  setBuyTarget: (target: { source: "conveyor" | "operations"; slotIndex: number }) => void;
  toggleBuySpend: (cardId: string) => void;
  confirmBuy: () => void;
  /** Animation trigger — most recent purchase snapshot. */
  lastPurchase: LastPurchase | null;
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
  inspect: null,
  setInspect: noop,
  buyMode: null,
  startBuyMode: noop,
  cancelBuyMode: noop,
  setBuyTarget: noop,
  toggleBuySpend: noop,
  confirmBuy: noop,
  lastPurchase: null,
  newGame: noop,
  step: noop,
  dispatch: noop,
  setAutoplay: noop,
  clear: noop,
});

export function useGameStore(): GameStore {
  return useContext(Ctx);
}

const EMPTY_STORE: AtomicStore = {
  state: null,
  log: [],
  seqCounter: 0,
  seatMeta: [],
  lastPurchase: null,
};

export function GameProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AtomicStore>(EMPTY_STORE);
  const [autoplay, setAutoplayState] = useState(false);
  const [inspect, setInspect] = useState<InspectPayload | null>(null);
  const [buyMode, setBuyMode] = useState<BuyMode | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as {
          state: GameState;
          log: LogEntry[];
          seatMeta: AtomicStore["seatMeta"];
        };
        setStore({
          state: saved.state,
          log: saved.log ?? [],
          seqCounter: (saved.log ?? []).length,
          seatMeta: saved.seatMeta ?? [],
          lastPurchase: null,
        });
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
      if (store.state) {
        window.localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            state: store.state,
            log: store.log,
            seatMeta: store.seatMeta,
          }),
        );
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
      window.localStorage.setItem(AUTOPLAY_KEY, autoplay ? "true" : "false");
    } catch {
      // ignore quota / private mode failures
    }
  }, [store, autoplay, hydrated]);

  // Pure step — runs through StrictMode's double-invocation safely
  // because the new state is fully derived from `prev`.
  const step = useCallback(() => {
    setStore((prev) => {
      if (!prev.state) return prev;
      if (isGameOver(prev.state)) return prev;
      const result = stepOrchestrator(prev.state);
      if (!result) return prev; // awaiting human input
      const seq = prev.seqCounter + 1;
      const entry: LogEntry = {
        seq,
        action: result.action,
        round: result.state.round,
      };
      const lastPurchase = capturePurchase(prev, result.action, seq);
      return {
        ...prev,
        state: result.state,
        log: [...prev.log, entry].slice(-400),
        seqCounter: seq,
        lastPurchase,
      };
    });
  }, []);

  // Pure dispatch — same StrictMode-safe shape.
  const dispatch = useCallback((action: GameAction) => {
    setStore((prev) => {
      if (!prev.state) return prev;
      const next = applyAction(prev.state, action);
      const seq = prev.seqCounter + 1;
      const entry: LogEntry = { seq, action, round: next.round };
      const lastPurchase = capturePurchase(prev, action, seq);
      return {
        ...prev,
        state: next,
        log: [...prev.log, entry].slice(-400),
        seqCounter: seq,
        lastPurchase,
      };
    });
  }, []);

  // Buy-mode helpers — the conveyor + capital cards become click targets
  // and the BuyOverlay drives Confirm/Cancel.
  const startBuyMode = useCallback(() => {
    setBuyMode({ pickedTarget: null, spendCardIds: [] });
    setInspect(null);
  }, []);

  const cancelBuyMode = useCallback(() => {
    setBuyMode(null);
  }, []);

  const setBuyTarget = useCallback(
    (target: { source: "conveyor" | "operations"; slotIndex: number }) => {
      setBuyMode((prev) => (prev ? { ...prev, pickedTarget: target } : prev));
    },
    [],
  );

  const toggleBuySpend = useCallback((cardId: string) => {
    setBuyMode((prev) => {
      if (!prev) return prev;
      const has = prev.spendCardIds.includes(cardId);
      return {
        ...prev,
        spendCardIds: has
          ? prev.spendCardIds.filter((id) => id !== cardId)
          : [...prev.spendCardIds, cardId],
      };
    });
  }, []);

  const confirmBuy = useCallback(() => {
    if (!buyMode || !buyMode.pickedTarget) return;
    const human = store.state?.players.find((p) => !p.isBot);
    if (!human) return;
    const target = buyMode.pickedTarget;
    const action: GameAction =
      target.source === "operations"
        ? {
            type: "BUY_OPERATIONS_CARD",
            playerId: human.id,
            opsSlotIndex: target.slotIndex,
            spendCardIds: buyMode.spendCardIds,
          }
        : {
            type: "BUY_FROM_MARKET",
            playerId: human.id,
            marketSlotIndex: target.slotIndex,
            spendCardIds: buyMode.spendCardIds,
          };
    setBuyMode(null);
    dispatch(action);
  }, [buyMode, store.state, dispatch]);

  // Autoplay loop — paused while waiting on human input.
  useEffect(() => {
    if (!autoplay) return;
    if (!store.state) return;
    if (isGameOver(store.state)) {
      setAutoplayState(false);
      return;
    }
    if (awaitingHumanInput(store.state)) return;
    const id = window.setTimeout(step, AUTO_STEP_MS);
    return () => window.clearTimeout(id);
  }, [autoplay, store.state, step]);

  // Bail out of buy mode the moment it stops being the human's turn or
  // the action phase ends — leaving stale UI selections around would let
  // the player click Confirm into an illegal action.
  useEffect(() => {
    if (!buyMode) return;
    const state = store.state;
    if (!state) {
      setBuyMode(null);
      return;
    }
    if (state.phase !== "action") {
      setBuyMode(null);
      return;
    }
    const current = state.players[state.currentPlayerIndex];
    if (!current || current.isBot) {
      setBuyMode(null);
    }
  }, [store.state, buyMode]);

  // Auto-resolve bot turns during phases the human doesn't drive directly:
  //   - distillery_selection / starter_deck_draft: the human's modal is
  //     gated by `awaitingHumanInput`; bots get auto-stepped here.
  //   - draw: bots auto-draw so the human's draw modal can appear and so
  //     the round can progress after the human draws.
  //   - action: when it's a bot's turn, auto-step them. Pause when the
  //     turn cursor lands on the human (they drive via the ActionBar).
  // Demand stays manual — the human triggers it via the demand modal.
  useEffect(() => {
    const state = store.state;
    if (!state) return;
    if (isGameOver(state)) return;

    const phase = state.phase;
    const isSetupPhase =
      phase === "distillery_selection" || phase === "starter_deck_draft";
    const isDrawPhase = phase === "draw";
    const isActionPhase = phase === "action";

    if (!isSetupPhase && !isDrawPhase && !isActionPhase) return;
    if (awaitingHumanInput(state)) return;

    if (isDrawPhase) {
      // Pause if the human hasn't drawn yet — their modal owns the screen.
      const human = state.players.find((p) => !p.isBot);
      if (human && !state.playerIdsCompletedPhase.includes(human.id)) {
        const nextDrawer = state.players.find(
          (p) => !state.playerIdsCompletedPhase.includes(p.id),
        );
        if (!nextDrawer || !nextDrawer.isBot) return;
      }
    }

    if (isActionPhase) {
      // Only step when the cursor is on a bot — humans drive their own turns.
      const current = state.players[state.currentPlayerIndex];
      if (!current || current.isBot === false) return;
    }

    const delay = isActionPhase ? 320 : 180;
    const id = window.setTimeout(step, delay);
    return () => window.clearTimeout(id);
  }, [store.state, step]);

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
    setStore({
      state: fresh,
      log: [],
      seqCounter: 0,
      seatMeta: meta,
      lastPurchase: null,
    });
    setAutoplayState(false);
    setInspect(null);
    setBuyMode(null);
  }, []);

  const clear = useCallback(() => {
    setStore(EMPTY_STORE);
    setAutoplayState(false);
    setInspect(null);
    setBuyMode(null);
  }, []);

  const setAutoplay = useCallback((on: boolean) => {
    setAutoplayState(on);
  }, []);

  const scores = useMemo(
    () =>
      store.state && isGameOver(store.state)
        ? computeFinalScores(store.state)
        : null,
    [store.state],
  );

  const humanWaitingOn = useMemo(
    () => (store.state ? awaitingHumanInput(store.state) : null),
    [store.state],
  );

  const value = useMemo<GameStore>(
    () => ({
      state: store.state,
      log: store.log,
      scores,
      autoplay,
      seatMeta: store.seatMeta,
      humanWaitingOn,
      inspect,
      setInspect,
      buyMode,
      startBuyMode,
      cancelBuyMode,
      setBuyTarget,
      toggleBuySpend,
      confirmBuy,
      lastPurchase: store.lastPurchase,
      newGame,
      step,
      dispatch,
      setAutoplay,
      clear,
    }),
    [
      store,
      scores,
      autoplay,
      humanWaitingOn,
      inspect,
      buyMode,
      startBuyMode,
      cancelBuyMode,
      setBuyTarget,
      toggleBuySpend,
      confirmBuy,
      newGame,
      step,
      dispatch,
      setAutoplay,
      clear,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

/**
 * Snapshot the bought card from the *previous* state so the
 * PurchaseFlight overlay can render it after the conveyor refills. Seq
 * is the unique animation key — same card bought twice still re-fires
 * because seq increments on every action.
 */
function capturePurchase(
  prev: AtomicStore,
  action: GameAction,
  seq: number,
): LastPurchase | null {
  if (!prev.state) return prev.lastPurchase;
  if (action.type === "BUY_FROM_MARKET") {
    const bought = prev.state.marketConveyor[action.marketSlotIndex];
    if (!bought) return prev.lastPurchase;
    return { card: bought, seq };
  }
  // BUY_OPERATIONS_CARD also triggers the flight — render the bought
  // ops card by repurposing the LastPurchase shape with a fake Card-like
  // facade. We don't actually need the engine Card here (PurchaseFlight
  // only renders resource/capital faces), so for ops we skip the flight
  // and let the BuyOverlay closing be the visual confirmation.
  return prev.lastPurchase;
}
