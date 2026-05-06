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
  type Barrel,
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
// v2.4 changed the GameState shape (added starterHand / starterUndealtPool /
// firstSaleResolved, removed starterDeckDraftCursor). Bumping the storage
// version drops any pre-v2.4 saves so they don't crash the renderer.
const STORAGE_KEY = "bourbonomics:v2.4.0-game";
const AUTOPLAY_KEY = "bourbonomics:v2.4.0-autoplay";
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
  /**
   * Optional snapshot data captured at dispatch time so the EventLog
   * can describe ephemeral effects after the fact.
   *   - `drawn`: cards added to a player's hand by this action
   *     (DRAW_HAND, occasionally DRAW_MASH_BILL or buy-side draws).
   */
  drawn?: Card[];
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
  | { kind: "investment"; card: InvestmentCard }
  | { kind: "barrel"; barrel: Barrel; ownerName?: string };

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
 * Interactive Age mode. Aging is conceptually the "Age Phase" of a round
 * (one card committed per barrel) — distinct from the main turn actions.
 * The picker has two slots: which of your barrels to age, and which one
 * card from hand to commit on top of it.
 */
export interface AgeMode {
  pickedBarrelId: string | null;
  pickedCardId: string | null;
}

/**
 * Interactive Draw-a-Mash-Bill mode. Two-step picker:
 *
 *   step 1 — `pickedMashBillId` is null. The player either clicks a
 *            face-up bill (sets the id and advances to step 2) or
 *            clicks the deck-top "blind" target (sets `blind: true`).
 *   step 2 — the player tags pay cards. Blind draws need exactly 1
 *            card; face-up picks need cards summing to ≥ the bill's
 *            cost (capital cards pay face value).
 *
 * Confirm dispatches DRAW_MASH_BILL with either `mashBillId` set
 * (face-up) or omitted (blind).
 */
export interface DrawBillMode {
  /** id of the picked face-up bill, or null when in step 1 / blind. */
  pickedMashBillId: string | null;
  /** True when the player chose the blind top-of-deck target. */
  blind: boolean;
  spendCardIds: string[];
}

/**
 * Interactive Make-Bourbon mode. Two-step picker: pick a mash bill from
 * your hand, then tag the resource cards to spend on production. The
 * target slot is auto-picked (first free) since v2.2 collapsed rickhouse
 * tiers — there's no reason for the player to choose between equivalent
 * empty slots.
 */
export interface MakeMode {
  pickedMashBillId: string | null;
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

/**
 * Last-bourbon-made snapshot. Mirrors `LastPurchase` but for MAKE_BOURBON
 * — `MakeFlight` reads `slotId` and `mashBillName` to render a card-
 * shaped element flying from the make overlay area into the target
 * rickhouse slot.
 */
export interface LastMake {
  slotId: string;
  ownerId: string;
  mashBillName: string;
  seq: number;
}

interface AtomicStore {
  state: GameState | null;
  log: LogEntry[];
  seqCounter: number;
  seatMeta: { id: string; logoId?: string; difficulty?: string }[];
  lastPurchase: LastPurchase | null;
  lastMake: LastMake | null;
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
  /** Interactive age state, null when not aging. */
  ageMode: AgeMode | null;
  startAgeMode: () => void;
  cancelAgeMode: () => void;
  setAgeBarrel: (barrelId: string) => void;
  setAgeCard: (cardId: string) => void;
  confirmAge: () => void;
  /** Interactive draw-bill state, null when not drawing. */
  drawBillMode: DrawBillMode | null;
  startDrawBillMode: () => void;
  cancelDrawBillMode: () => void;
  /** Step 1: pick a face-up bill OR pick the blind top-of-deck target. */
  setDrawBillTarget: (target: { mashBillId: string } | { blind: true }) => void;
  /** Step 2: toggle a pay card. */
  toggleDrawBillSpend: (cardId: string) => void;
  /** Back from step 2 → step 1. */
  resetDrawBillTarget: () => void;
  confirmDrawBill: () => void;
  /** Interactive make-bourbon state, null when not making. */
  makeMode: MakeMode | null;
  startMakeMode: () => void;
  cancelMakeMode: () => void;
  setMakeMashBill: (mashBillId: string) => void;
  toggleMakeSpend: (cardId: string) => void;
  confirmMake: () => void;
  /** Animation trigger — most recent purchase snapshot. */
  lastPurchase: LastPurchase | null;
  /** Animation trigger — most recent MAKE_BOURBON snapshot. */
  lastMake: LastMake | null;
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
  ageMode: null,
  startAgeMode: noop,
  cancelAgeMode: noop,
  setAgeBarrel: noop,
  setAgeCard: noop,
  confirmAge: noop,
  drawBillMode: null,
  startDrawBillMode: noop,
  cancelDrawBillMode: noop,
  setDrawBillTarget: noop,
  toggleDrawBillSpend: noop,
  resetDrawBillTarget: noop,
  confirmDrawBill: noop,
  makeMode: null,
  startMakeMode: noop,
  cancelMakeMode: noop,
  setMakeMashBill: noop,
  toggleMakeSpend: noop,
  confirmMake: noop,
  lastPurchase: null,
  lastMake: null,
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
  lastMake: null,
};

export function GameProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AtomicStore>(EMPTY_STORE);
  const [autoplay, setAutoplayState] = useState(false);
  const [inspect, setInspect] = useState<InspectPayload | null>(null);
  const [buyMode, setBuyMode] = useState<BuyMode | null>(null);
  const [ageMode, setAgeMode] = useState<AgeMode | null>(null);
  const [drawBillMode, setDrawBillMode] = useState<DrawBillMode | null>(null);
  const [makeMode, setMakeMode] = useState<MakeMode | null>(null);
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
          lastMake: null,
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
        drawn: captureDrawn(prev.state, result.state, result.action),
      };
      const lastPurchase = capturePurchase(prev, result.action, seq);
      const lastMake = captureMake(prev, result.state, result.action, seq);
      return {
        ...prev,
        state: result.state,
        log: [...prev.log, entry].slice(-400),
        seqCounter: seq,
        lastPurchase,
        lastMake,
      };
    });
  }, []);

  // Pure dispatch — same StrictMode-safe shape.
  const dispatch = useCallback((action: GameAction) => {
    setStore((prev) => {
      if (!prev.state) return prev;
      const next = applyAction(prev.state, action);
      const seq = prev.seqCounter + 1;
      const entry: LogEntry = {
        seq,
        action,
        round: next.round,
        drawn: captureDrawn(prev.state, next, action),
      };
      const lastPurchase = capturePurchase(prev, action, seq);
      const lastMake = captureMake(prev, next, action, seq);
      return {
        ...prev,
        state: next,
        log: [...prev.log, entry].slice(-400),
        seqCounter: seq,
        lastPurchase,
        lastMake,
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

  // Age-mode helpers — mirrors the buy flow but with two single-select
  // slots: which of your barrels gets the year, and which one card from
  // hand gets committed face-down on top.
  const startAgeMode = useCallback(() => {
    setAgeMode({ pickedBarrelId: null, pickedCardId: null });
    setBuyMode(null);
    setInspect(null);
  }, []);

  const cancelAgeMode = useCallback(() => {
    setAgeMode(null);
  }, []);

  const setAgeBarrel = useCallback((barrelId: string) => {
    setAgeMode((prev) =>
      prev ? { ...prev, pickedBarrelId: barrelId } : prev,
    );
  }, []);

  const setAgeCard = useCallback((cardId: string) => {
    setAgeMode((prev) => {
      if (!prev) return prev;
      // Single-select toggle: clicking the same card again clears it.
      return {
        ...prev,
        pickedCardId: prev.pickedCardId === cardId ? null : cardId,
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

  const confirmAge = useCallback(() => {
    if (!ageMode || !ageMode.pickedBarrelId || !ageMode.pickedCardId) return;
    const human = store.state?.players.find((p) => !p.isBot);
    if (!human) return;
    const action: GameAction = {
      type: "AGE_BOURBON",
      playerId: human.id,
      barrelId: ageMode.pickedBarrelId,
      cardId: ageMode.pickedCardId,
    };
    setAgeMode(null);
    dispatch(action);
  }, [ageMode, store.state, dispatch]);

  // Draw-bill mode helpers — two-step picker. Step 1 picks the bourbon
  // (face-up bill or blind top-of-deck); step 2 tags pay cards.
  const startDrawBillMode = useCallback(() => {
    setDrawBillMode({ pickedMashBillId: null, blind: false, spendCardIds: [] });
    setBuyMode(null);
    setAgeMode(null);
    setMakeMode(null);
    setInspect(null);
  }, []);

  const cancelDrawBillMode = useCallback(() => {
    setDrawBillMode(null);
  }, []);

  const setDrawBillTarget = useCallback(
    (target: { mashBillId: string } | { blind: true }) => {
      setDrawBillMode((prev) => {
        if (!prev) return prev;
        if ("blind" in target) {
          return { pickedMashBillId: null, blind: true, spendCardIds: [] };
        }
        return {
          pickedMashBillId: target.mashBillId,
          blind: false,
          spendCardIds: [],
        };
      });
    },
    [],
  );

  const toggleDrawBillSpend = useCallback((cardId: string) => {
    setDrawBillMode((prev) => {
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

  const resetDrawBillTarget = useCallback(() => {
    setDrawBillMode((prev) =>
      prev
        ? { pickedMashBillId: null, blind: false, spendCardIds: [] }
        : prev,
    );
  }, []);

  const confirmDrawBill = useCallback(() => {
    if (!drawBillMode) return;
    if (!drawBillMode.blind && !drawBillMode.pickedMashBillId) return;
    if (drawBillMode.spendCardIds.length === 0) return;
    const human = store.state?.players.find((p) => !p.isBot);
    if (!human) return;
    const action: GameAction = drawBillMode.pickedMashBillId
      ? {
          type: "DRAW_MASH_BILL",
          playerId: human.id,
          mashBillId: drawBillMode.pickedMashBillId,
          spendCardIds: drawBillMode.spendCardIds,
        }
      : {
          type: "DRAW_MASH_BILL",
          playerId: human.id,
          spendCardIds: drawBillMode.spendCardIds,
        };
    setDrawBillMode(null);
    dispatch(action);
  }, [drawBillMode, store.state, dispatch]);

  // Make-mode helpers — two-step picker: (1) pick a mash bill from your
  // hand, (2) tag the production cards. Slot is auto-picked (first free)
  // since v2.2 collapsed rickhouse tiers.
  const startMakeMode = useCallback(() => {
    setMakeMode({ pickedMashBillId: null, spendCardIds: [] });
    setBuyMode(null);
    setAgeMode(null);
    setDrawBillMode(null);
    setInspect(null);
  }, []);

  const cancelMakeMode = useCallback(() => {
    setMakeMode(null);
  }, []);

  const setMakeMashBill = useCallback((mashBillId: string) => {
    setMakeMode((prev) => {
      if (!prev) return prev;
      // Picking a different bill clears the in-progress card tags so
      // recipe constraints don't get tangled across bill switches.
      return prev.pickedMashBillId === mashBillId
        ? { ...prev, pickedMashBillId: null }
        : { pickedMashBillId: mashBillId, spendCardIds: [] };
    });
  }, []);

  const toggleMakeSpend = useCallback((cardId: string) => {
    setMakeMode((prev) => {
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

  const confirmMake = useCallback(() => {
    if (!makeMode) return;
    const human = store.state?.players.find((p) => !p.isBot);
    if (!human || !store.state) return;
    // v2.5 incremental commitment: prefer committing to an existing
    // under-construction barrel that hasn't been touched this turn.
    // Otherwise open a new barrel in the first empty slot.
    const myBarrels = store.state.allBarrels.filter((b) => b.ownerId === human.id);
    const inProgress = myBarrels.find(
      (b) => b.phase === "construction" && !b.committedThisTurn,
    );
    let slotId: string | null = null;
    if (inProgress) {
      slotId = inProgress.slotId;
    } else {
      const occupied = new Set(myBarrels.map((b) => b.slotId));
      const freeSlot = human.rickhouseSlots.find((s) => !occupied.has(s.id));
      if (freeSlot) slotId = freeSlot.id;
    }
    if (!slotId) return;
    // If the targeted barrel already has a bill attached, don't try
    // to attach a second one — only include `mashBillId` for fresh
    // attachments.
    const targetBarrel = inProgress ?? null;
    const billAlreadyOnBarrel = targetBarrel?.attachedMashBill != null;
    const action: GameAction = {
      type: "MAKE_BOURBON",
      playerId: human.id,
      slotId,
      cardIds: makeMode.spendCardIds,
      ...(makeMode.pickedMashBillId && !billAlreadyOnBarrel
        ? { mashBillId: makeMode.pickedMashBillId }
        : {}),
    };
    setMakeMode(null);
    dispatch(action);
  }, [makeMode, store.state, dispatch]);

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

  // Same bail-out for age mode.
  useEffect(() => {
    if (!ageMode) return;
    const state = store.state;
    if (!state || state.phase !== "action") {
      setAgeMode(null);
      return;
    }
    const current = state.players[state.currentPlayerIndex];
    if (!current || current.isBot) {
      setAgeMode(null);
    }
  }, [store.state, ageMode]);

  // Same bail-out for draw-bill mode.
  useEffect(() => {
    if (!drawBillMode) return;
    const state = store.state;
    if (!state || state.phase !== "action") {
      setDrawBillMode(null);
      return;
    }
    const current = state.players[state.currentPlayerIndex];
    if (!current || current.isBot) {
      setDrawBillMode(null);
    }
  }, [store.state, drawBillMode]);

  // Same bail-out for make mode.
  useEffect(() => {
    if (!makeMode) return;
    const state = store.state;
    if (!state || state.phase !== "action") {
      setMakeMode(null);
      return;
    }
    const current = state.players[state.currentPlayerIndex];
    if (!current || current.isBot) {
      setMakeMode(null);
    }
  }, [store.state, makeMode]);

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
      lastMake: null,
    });
    setAutoplayState(false);
    setInspect(null);
    setBuyMode(null);
    setAgeMode(null);
    setDrawBillMode(null);
    setMakeMode(null);
  }, []);

  const clear = useCallback(() => {
    setStore(EMPTY_STORE);
    setAutoplayState(false);
    setInspect(null);
    setBuyMode(null);
    setAgeMode(null);
    setDrawBillMode(null);
    setMakeMode(null);
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
      ageMode,
      startAgeMode,
      cancelAgeMode,
      setAgeBarrel,
      setAgeCard,
      confirmAge,
      drawBillMode,
      startDrawBillMode,
      cancelDrawBillMode,
      setDrawBillTarget,
      toggleDrawBillSpend,
      resetDrawBillTarget,
      confirmDrawBill,
      makeMode,
      startMakeMode,
      cancelMakeMode,
      setMakeMashBill,
      toggleMakeSpend,
      confirmMake,
      lastPurchase: store.lastPurchase,
      lastMake: store.lastMake,
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
      ageMode,
      startAgeMode,
      cancelAgeMode,
      setAgeBarrel,
      setAgeCard,
      confirmAge,
      drawBillMode,
      startDrawBillMode,
      cancelDrawBillMode,
      setDrawBillTarget,
      toggleDrawBillSpend,
      resetDrawBillTarget,
      confirmDrawBill,
      makeMode,
      startMakeMode,
      cancelMakeMode,
      setMakeMashBill,
      toggleMakeSpend,
      confirmMake,
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
 * For actions that move cards into a player's hand (DRAW_HAND, and
 * the implicit reshuffle on a DRAW_HAND), compute the delta so the
 * EventLog can render WHAT was drawn — by id stable across renders.
 * Returns undefined when the action is not a draw-style action so the
 * field can be omitted from the LogEntry entirely.
 */
function captureDrawn(
  prev: GameState,
  next: GameState,
  action: GameAction,
): Card[] | undefined {
  if (action.type !== "DRAW_HAND") return undefined;
  const before = prev.players.find((p) => p.id === action.playerId);
  const after = next.players.find((p) => p.id === action.playerId);
  if (!before || !after) return undefined;
  const beforeIds = new Set(before.hand.map((c) => c.id));
  const drawn = after.hand.filter((c) => !beforeIds.has(c.id));
  return drawn.length > 0 ? drawn : undefined;
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

/**
 * Snapshot the new barrel's slot + bill name when MAKE_BOURBON
 * dispatches, so MakeFlight can fly a card-shaped element from the
 * make overlay area into that slot. Reads from `next` (post-state)
 * because the new barrel only exists after apply.
 */
function captureMake(
  prev: AtomicStore,
  next: GameState,
  action: GameAction,
  seq: number,
): LastMake | null {
  if (action.type !== "MAKE_BOURBON") return prev.lastMake;
  const barrel = next.allBarrels.find(
    (b) => b.ownerId === action.playerId && b.slotId === action.slotId,
  );
  if (!barrel) return prev.lastMake;
  return {
    slotId: barrel.slotId,
    ownerId: barrel.ownerId,
    mashBillName: barrel.attachedMashBill?.name ?? "Unnamed barrel",
    seq,
  };
}
