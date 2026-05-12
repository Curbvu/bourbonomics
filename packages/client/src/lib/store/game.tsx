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
  useRef,
  useState,
  type ReactNode,
} from "react";
import { produce } from "immer";
import {
  applyAction,
  awaitingHumanInput,
  buildTutorialInitialState,
  buildVanillaDistilleryFor,
  computeFinalScores,
  computeReward,
  defaultMashBillCatalog,
  DISTILLERIES_ENABLED,
  initializeGame,
  isGameOver,
  stepOrchestrator,
  type Barrel,
  type Card,
  type GameAction,
  type GameState,
  type InvestmentCard,
  type MashBill,
  type NewGameConfig,
  type NewMultiplayerGameConfig,
  type OperationsCard,
  type PlayerState,
  type ScoreResult,
} from "@bourbonomics/engine";

/**
 * v2.9 introduced two per-turn gates: `needsDemandRoll` and
 * `needsAgeBarrels`. The tutorial leaves both dormant — every beat
 * teaches a voluntary action, not a per-turn cost — so the dispatch
 * path runs this on every result while the tutorial is active.
 */
function clearTutorialGates(state: GameState): GameState {
  return produce(state, (draft) => {
    for (const p of draft.players) {
      p.needsDemandRoll = false;
      p.needsAgeBarrels = false;
    }
  });
}
import {
  gameSocket,
  gameSocketUrl,
  type SeatInfo,
  type SocketStatus,
} from "./socket";
import type { SpotlightTarget } from "@/app/tutorial/types";

// Storage key is versioned and bumped whenever the engine schema or
// canonical catalog changes (so legacy saves don't crash on hydrate).
// v2.6 bump: mash bills are now slot-bound — `player.mashBills` and
// `player.unlockedGoldBourbons` are removed from PlayerState; barrels
// gained a "ready" phase; SELL_BOURBON's action shape changed
// (`goldBourbonId` → `goldChoice` + `goldConvertTargetSlotId`); and
// MAKE_BOURBON dropped its `mashBillId` parameter. Old saves would
// hydrate without slot-bound bills, so we drop them.
const STORAGE_KEY = "bourbonomics:v2.6.0-game";
const AUTOPLAY_KEY = "bourbonomics:v2.6.0-autoplay";
const AUTO_STEP_MS = 280;

// `NewGameSeat` and `NewGameConfig` now live in `@bourbonomics/engine`
// so the multi-player server can take them over the wire without
// duplicating the type. Re-exported below for back-compat with files
// that imported them from this module.
export type { NewGameSeat, NewGameConfig } from "@bourbonomics/engine";

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
 * Interactive Sell-Bourbon mode. Two-step picker:
 *
 *   step 1 — pick which of your aging barrels to sell. Saleable barrels
 *            (aging, age ≥2) light up sky-blue in your rickhouse.
 *   v2.10 — no spend-card cost. Picking a barrel auto-fires the sale
 *            with the full grid reward as reputation (cardDrawSplit = 0).
 *            A future iteration may add a rep/PP slider for Gold sales.
 */
export interface SellMode {
  pickedBarrelId: string | null;
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

/**
 * Last-barrel-sold snapshot. Captures the cards that just returned to
 * the seller's discard so `SaleFlight` can fan them out from the (now
 * vanished) barrel slot to the discard pile. `slotId` is the origin
 * for the flight; `cards` is the full list of production + aging
 * cards that left the barrel.
 */
export interface LastSale {
  slotId: string;
  ownerId: string;
  cards: Card[];
  seq: number;
}

/**
 * Last-barrel-aged snapshot. Captures the destination slot + a label
 * for the card that was committed so `AgeFlight` can animate a card-
 * shaped element from the hand tray up to the slot. The card itself
 * is gone from the hand by the time we render (engine moves it onto
 * the barrel synchronously) — we keep just enough metadata to draw
 * a believable ghost.
 */
export interface LastAge {
  slotId: string;
  ownerId: string;
  /** Display label for the ghost card (e.g. "Common Cask"). */
  cardLabel: string;
  /** Card subtype for the ghost's color treatment. */
  cardSubtype: string;
  seq: number;
}

/**
 * Multiplayer-mode marker. When set, the store is bound to a remote
 * room: `dispatch` sends actions over the WebSocket instead of
 * applying them locally, and the autoplay loop is disabled (the
 * server runs bot turns via the `Tick` Lambda). Cleared by
 * `leaveMultiplayer()` or a fatal socket error.
 */
export interface MultiplayerMode {
  /** 4-char room code. */
  code: string;
  /** Which seat the local human owns, or empty for spectator. */
  playerId: string;
  /** Whether the host has flipped the lobby into live play. */
  started: boolean;
  /** Convention: seat 0 is the host. The pre-game lobby's "Start
   *  game" button is enabled only when `playerId === hostPlayerId`. */
  hostPlayerId: string;
}

interface AtomicStore {
  state: GameState | null;
  log: LogEntry[];
  seqCounter: number;
  seatMeta: { id: string; logoId?: string; difficulty?: string }[];
  lastPurchase: LastPurchase | null;
  lastMake: LastMake | null;
  lastSale: LastSale | null;
  lastAge: LastAge | null;
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
  /** PlayerId for the seat THIS connection owns. In multiplayer it's
   *  `multiplayerMode.playerId` (the seat we claimed), or empty for
   *  observers. In solo it's the lone non-bot seat (matches the
   *  pre-MP convention). UI components that ask "is it my turn?"
   *  should compare this against `state.players[currentPlayerIndex]`
   *  or `humanWaitingOn`. */
  humanSeatPlayerId: string | null;
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
  /** Pick a barrel. Auto-fires AGE_BOURBON when both fields are set. */
  setAgeBarrel: (barrelId: string) => void;
  /** Pick a hand card. Auto-fires AGE_BOURBON when both fields are set. */
  setAgeCard: (cardId: string) => void;
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
  /** Interactive sell-bourbon state, null when not selling. */
  sellMode: SellMode | null;
  startSellMode: () => void;
  cancelSellMode: () => void;
  /** v2.10: pick a barrel — the sale auto-fires (no card-spend step). */
  setSellBarrel: (barrelId: string) => void;
  /**
   * v2.6 drag-and-drop state — the id of the PRIMARY hand card
   * currently being dragged onto a slot, or `null` when no drag is in
   * flight. Read by every zone that wants to dim itself out of the
   * way (the market, the action log, opponent rickhouses, even the
   * rest of the hand) so the player's eye snaps to the legal drop
   * targets. v2.10: when the player has a multi-select group active,
   * the entire group rides along — see `dragMakeIds`.
   */
  dragMake: string | null;
  /**
   * v2.10 multi-card drag — the FULL set of card ids being dragged.
   * Includes the primary `dragMake` plus any other cards currently in
   * the hand-selection (see `selectedHandCardIds`). Drop targets
   * dispatch MAKE_BOURBON with this whole list.
   */
  dragMakeIds: string[];
  startDragMake: (cardIds: string[]) => void;
  endDragMake: () => void;
  /**
   * v2.10 hand multi-select — the ids of cards the player has
   * "checked" for a future drag. Toggled by left-click on a hand
   * card when no picker mode (Make / Buy / Age / Sell / DrawBill) is
   * active. Cleared when a drag completes or a picker mode opens.
   */
  selectedHandCardIds: string[];
  toggleHandSelection: (cardId: string) => void;
  clearHandSelection: () => void;
  /**
   * v3 double-click commit. When the active picker (Age / Sell / Make)
   * already has its other half picked, double-clicking a hand card
   * fires the action immediately — bypassing the single-click toggle
   * dance. Outside any picker, falls through to a multi-select toggle
   * (same as a single click).
   */
  commitHandCardImmediate: (cardId: string) => void;
  /** Animation trigger — most recent purchase snapshot. */
  lastPurchase: LastPurchase | null;
  /** Animation trigger — most recent MAKE_BOURBON snapshot. */
  lastMake: LastMake | null;
  /** Animation trigger — most recent SELL_BOURBON snapshot. */
  lastSale: LastSale | null;
  /** Animation trigger — most recent AGE_BOURBON snapshot. */
  lastAge: LastAge | null;
  /** When non-null, the store is bound to a remote multi-player room.
   *  See `MultiplayerMode` for what that means for dispatch + autoplay. */
  multiplayerMode: MultiplayerMode | null;
  /** Live status of the multi-player WebSocket. Mirrors the socket's
   *  own status so the UI can render a connection indicator. */
  multiplayerStatus: import("./socket").SocketStatus;
  /** Per-seat roster from the server: who's a bot, who's an open
   *  human seat, and which display name claimed each one. Updates
   *  whenever someone claims or releases a seat. */
  roster: SeatInfo[];
  /** Last server-side error reason (e.g. action rejection). UI can
   *  render this as a toast so silent rejections aren't invisible. */
  multiplayerError: string | null;
  /** Dismiss the current error toast. */
  clearMultiplayerError: () => void;
  newGame: (cfg: NewGameConfig) => void;
  /** Mint a new multi-player room and join it as host. */
  createMultiplayer: (cfg: NewMultiplayerGameConfig) => Promise<string>;
  /** Join an existing room by its 4-char code as an observer. */
  joinMultiplayer: (code: string, name: string) => Promise<void>;
  /** Claim an open human seat. Server rejects bot seats and seats
   *  already owned by someone else. */
  claimSeat: (playerId: string) => Promise<void>;
  /** Drop your claim on the seat you currently own. The connection
   *  stays in the room as an observer. */
  releaseSeat: () => void;
  /** Host-only — flip the room out of pre-game lobby into live play. */
  startMultiplayerGame: () => void;
  /** Disconnect and return the store to single-player mode. */
  leaveMultiplayer: () => void;
  step: () => void;
  /** Submit an action directly (used by setup-phase modals). */
  dispatch: (action: GameAction) => void;
  setAutoplay: (on: boolean) => void;
  clear: () => void;

  // ─── Tutorial hooks ──────────────────────────────────────────
  /** True while the on-rails tutorial owns the store. Cleared by `endTutorial`. */
  tutorialActive: boolean;
  /** Inject the rigged tutorial GameState and switch the store into tutorial mode. */
  startTutorial: () => void;
  /** Clear the tutorial state and flags. Returns the store to its empty shape. */
  endTutorial: () => void;
  /** Direct state mutation — used by the tutorial controller for time-skips,
   *  deck rigging, and silent age bumps that don't fit a normal action. */
  mutateState: (fn: (s: GameState) => GameState) => void;
  /** Pre-dispatch action transformer. While set, every dispatched action
   *  runs through this hook first. Return `null` to silently drop the
   *  action (used to gate non-scripted plays); return a (possibly-rewritten)
   *  action to dispatch in its place (used to force splits in Beat 9 / 11). */
  setTutorialActionTransform: (
    fn: ((action: GameAction, state: GameState) => GameAction | null) | null,
  ) => void;
  /** Active spotlight target during the tutorial. Read by board components
   *  (ConveyorCard, MashBillTile, …) so they can shimmer the spotlit
   *  element AND lock down non-spotlit click actions during await-action
   *  beats. The TutorialController + BoardTour both update this on
   *  beat / stop change. `null` outside the tutorial. */
  tutorialSpotlight: SpotlightTarget | null;
  setTutorialSpotlight: (target: SpotlightTarget | null) => void;
  /** Optional hand-card filter the active beat is enforcing. When set,
   *  hand cards passing the predicate are tutorial-highlighted; cards
   *  that don't pass are muted + inspect-only. `null` outside an
   *  await-action beat that declares a filter. */
  tutorialHandFilter: ((card: Card) => boolean) | null;
  setTutorialHandFilter: (fn: ((card: Card) => boolean) | null) => void;
}

const noop = () => {};
const Ctx = createContext<GameStore>({
  state: null,
  log: [],
  scores: null,
  autoplay: false,
  seatMeta: [],
  humanWaitingOn: null,
  humanSeatPlayerId: null,
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
  sellMode: null,
  startSellMode: noop,
  cancelSellMode: noop,
  setSellBarrel: noop,
  dragMake: null,
  dragMakeIds: [],
  startDragMake: noop,
  endDragMake: noop,
  selectedHandCardIds: [],
  toggleHandSelection: noop,
  clearHandSelection: noop,
  commitHandCardImmediate: noop,
  lastPurchase: null,
  lastMake: null,
  lastSale: null,
  lastAge: null,
  multiplayerMode: null,
  multiplayerStatus: "idle",
  roster: [],
  multiplayerError: null,
  clearMultiplayerError: noop,
  newGame: noop,
  tutorialActive: false,
  startTutorial: noop,
  endTutorial: noop,
  mutateState: noop,
  setTutorialActionTransform: noop,
  tutorialSpotlight: null,
  setTutorialSpotlight: noop,
  tutorialHandFilter: null,
  setTutorialHandFilter: noop,
  createMultiplayer: async () => "",
  joinMultiplayer: async () => {},
  claimSeat: async () => {},
  releaseSeat: noop,
  startMultiplayerGame: noop,
  leaveMultiplayer: noop,
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
  lastSale: null,
  lastAge: null,
};

export function GameProvider({ children }: { children: ReactNode }) {
  const [store, setStore] = useState<AtomicStore>(EMPTY_STORE);
  const [autoplay, setAutoplayState] = useState(false);
  const [inspect, setInspect] = useState<InspectPayload | null>(null);
  const [buyMode, setBuyMode] = useState<BuyMode | null>(null);
  const [ageMode, setAgeMode] = useState<AgeMode | null>(null);
  const [drawBillMode, setDrawBillMode] = useState<DrawBillMode | null>(null);
  const [makeMode, setMakeMode] = useState<MakeMode | null>(null);
  const [sellMode, setSellMode] = useState<SellMode | null>(null);

  // v2.10 hand multi-select. Declared early so the picker-mode
  // useCallbacks below can reach `setSelectedHandCardIds` and clear
  // it when a picker mode opens (otherwise checkmarks linger and
  // confuse the player when they tag cards in the new mode).
  const [selectedHandCardIds, setSelectedHandCardIds] = useState<string[]>([]);

  const [multiplayerMode, setMultiplayerMode] = useState<MultiplayerMode | null>(null);
  const [multiplayerStatus, setMultiplayerStatus] = useState<SocketStatus>("idle");
  const [roster, setRoster] = useState<SeatInfo[]>([]);
  const [multiplayerError, setMultiplayerError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Tutorial mode — when active, dispatch wraps every applied action in
  // `clearTutorialGates` and routes it through the action-transform hook
  // first. We hold both as refs so the dispatch closure doesn't have to
  // re-create on every transform-set + we don't have to re-fire every
  // dispatch consumer on every tutorial-flag flip.
  const [tutorialActive, setTutorialActive] = useState(false);
  const tutorialActiveRef = useRef(false);
  const tutorialActionTransformRef = useRef<
    ((action: GameAction, state: GameState) => GameAction | null) | null
  >(null);
  // Active beat / stop spotlight target. Components read this to shimmer
  // the spotlit element and gate clicks on the non-spotlit ones. State
  // (not a ref) so consumers re-render when the target changes.
  const [tutorialSpotlight, setTutorialSpotlightState] =
    useState<SpotlightTarget | null>(null);
  // Optional hand-card filter the current await-action beat enforces.
  // HandTray reads this to mute + lock cards that don't pass.
  const [tutorialHandFilter, setTutorialHandFilterState] = useState<
    ((card: Card) => boolean) | null
  >(null);

  // Load from localStorage on mount.
  useEffect(() => {
    // /tutorial mounts a child component that fires `startTutorial()`
    // in ITS useEffect, which on React 18 fires BEFORE this parent
    // useEffect (effects run child-first on mount). If we read
    // localStorage and overwrite, we'd clobber the rigged scenario
    // the tutorial just installed. Skip hydration entirely when
    // the tutorial owns the store.
    if (tutorialActiveRef.current) {
      setHydrated(true);
      return;
    }
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
          lastSale: null,
          lastAge: null,
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
    // Tutorial state is ephemeral — don't persist it to the live-game
    // localStorage key. Otherwise visiting /tutorial after a live game
    // would overwrite the player's saved progress with the rigged
    // scenario, and on next /play visit they'd hydrate into the
    // tutorial mid-scenario.
    if (tutorialActive) return;
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
  }, [store, autoplay, hydrated, tutorialActive]);

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
      const lastSale = captureSale(prev, result.action, seq);
      const lastAge = captureAge(prev, result.action, seq);
      return {
        ...prev,
        state: result.state,
        log: [...prev.log, entry].slice(-400),
        seqCounter: seq,
        lastPurchase,
        lastMake,
        lastSale,
        lastAge,
      };
    });
  }, []);

  // Pure dispatch — same StrictMode-safe shape. In multiplayer mode
  // the action is sent over the WebSocket and the server's broadcast
  // updates state (so we DON'T apply locally — that would briefly
  // double-mutate before the broadcast arrived).
  const dispatch = useCallback(
    (action: GameAction) => {
      if (multiplayerMode) {
        // eslint-disable-next-line no-console
        console.log("[mp] dispatch →", action);
        gameSocket().send({ type: "action", action });
        return;
      }
      setStore((prev) => {
        if (!prev.state) return prev;
        // Tutorial mode runs every dispatched action through a transform
        // hook. Returning `null` drops the action silently (gates the
        // off-script play); returning a different action substitutes it
        // (forces the rep/draw split on the scripted sales).
        let final = action;
        const transform = tutorialActionTransformRef.current;
        if (transform) {
          const out = transform(action, prev.state);
          if (out === null) return prev;
          final = out;
        }
        let next: GameState;
        try {
          next = applyAction(prev.state, final);
        } catch (err) {
          // Tutorial dispatch may produce an action the engine rejects
          // (e.g. a stale snapshot during fast scripted advancement).
          // Drop silently rather than crash the page; in dev console
          // we'll still see the engine's error in `applyAction`.
          if (tutorialActiveRef.current) return prev;
          // Outside tutorial we don't crash either — the most common
          // cause is a click-to-engage or click-to-commit handler
          // sending a stale action (e.g. the player double-clicked,
          // the second dispatch ran after the first changed state).
          // Log the underlying error so it's visible in the console
          // and drop the action without nuking the page. Surface the
          // action type and player at the top-level message so a
          // glance at the console explains "what got dropped" without
          // needing to expand the inspector — the previous form put
          // both inside a collapsed object and was effectively opaque.
          const reason = err instanceof Error ? err.message : String(err);
          const actorId =
            "playerId" in (final as Record<string, unknown>)
              ? String((final as { playerId?: unknown }).playerId ?? "—")
              : "—";
          // eslint-disable-next-line no-console
          console.error(
            `[bourbonomics] applyAction rejected ${final.type} by ${actorId}: ${reason}`,
            { action: final, error: err, phase: prev.state.phase, round: prev.state.round },
          );
          return prev;
        }
        if (tutorialActiveRef.current) {
          next = clearTutorialGates(next);
        }
        const seq = prev.seqCounter + 1;
        const entry: LogEntry = {
          seq,
          action: final,
          round: next.round,
          drawn: captureDrawn(prev.state, next, final),
        };
        const lastPurchase = capturePurchase(prev, final, seq);
        const lastMake = captureMake(prev, next, final, seq);
        const lastSale = captureSale(prev, final, seq);
        const lastAge = captureAge(prev, final, seq);
        return {
          ...prev,
          state: next,
          log: [...prev.log, entry].slice(-400),
          seqCounter: seq,
          lastPurchase,
          lastMake,
          lastSale,
          lastAge,
        };
      });
    },
    [multiplayerMode],
  );

  // ---------------------------------------------------------------
  // Multi-player wiring
  // ---------------------------------------------------------------
  // When the store is bound to a room, every server broadcast lands
  // here. We swap the local AtomicStore for the broadcast's `state`
  // and recompute animation snapshots from the prior state + the
  // action that produced this frame (server forwards the action on
  // every broadcast — see `packages/server/src/lib/protocol.ts`).
  useEffect(() => {
    const sock = gameSocket();
    const off = sock.subscribe((event) => {
      if (event.kind === "status") {
        setMultiplayerStatus(event.status);
        return;
      }
      const msg = event.message;
      switch (msg.type) {
        case "joined":
          setMultiplayerMode({
            code: msg.code,
            playerId: msg.playerId,
            started: msg.started,
            hostPlayerId: msg.hostPlayerId,
          });
          setRoster(msg.roster);
          setStore({
            state: msg.state,
            log: [],
            seqCounter: msg.seq,
            seatMeta: msg.state.players.map((p) => ({ id: p.id })),
            lastPurchase: null,
            lastMake: null,
            lastSale: null,
            lastAge: null,
          });
          break;
        case "state":
          if (msg.roster) setRoster(msg.roster);
          if (msg.started !== undefined) {
            setMultiplayerMode((prev) =>
              prev ? { ...prev, started: msg.started! } : prev,
            );
          }
          setStore((prev) => {
            const action = msg.action;
            const seq = msg.seq;
            const entry: LogEntry | null = action
              ? {
                  seq,
                  action,
                  round: msg.state.round,
                  drawn: prev.state ? captureDrawn(prev.state, msg.state, action) : undefined,
                }
              : null;
            const lastPurchase = action ? capturePurchase(prev, action, seq) : prev.lastPurchase;
            const lastMake = action ? captureMake(prev, msg.state, action, seq) : prev.lastMake;
            const lastSale = action ? captureSale(prev, action, seq) : prev.lastSale;
            const lastAge = action ? captureAge(prev, action, seq) : prev.lastAge;
            return {
              ...prev,
              state: msg.state,
              log: entry ? [...prev.log, entry].slice(-400) : prev.log,
              seqCounter: seq,
              lastPurchase,
              lastMake,
              lastSale,
              lastAge,
            };
          });
          break;
        case "error":
          // eslint-disable-next-line no-console
          console.error("multiplayer:", msg.reason);
          setMultiplayerError(msg.reason);
          break;
        case "ping":
          // No-op; the server sometimes pings to keep idle sockets alive.
          break;
      }
    });
    return off;
  }, []);

  const createMultiplayer = useCallback(
    async (cfg: NewMultiplayerGameConfig): Promise<string> => {
      const url = gameSocketUrl();
      if (!url) throw new Error("Multiplayer is not configured for this build.");
      const sock = gameSocket();
      sock.connect(url);
      // Resolve as soon as the `joined` message lands. We use a
      // one-shot subscriber rather than racing the global one so
      // the caller gets the room code synchronously after the
      // promise settles.
      return new Promise<string>((resolve, reject) => {
        const off = sock.subscribe((event) => {
          if (event.kind !== "message") return;
          if (event.message.type === "joined") {
            off();
            resolve(event.message.code);
          } else if (event.message.type === "error") {
            off();
            reject(new Error(event.message.reason));
          }
        });
        sock.send({ type: "create-room", config: cfg });
      });
    },
    [],
  );

  const joinMultiplayer = useCallback(
    async (code: string, name: string): Promise<void> => {
      const url = gameSocketUrl();
      if (!url) throw new Error("Multiplayer is not configured for this build.");
      const sock = gameSocket();
      sock.connect(url);
      return new Promise<void>((resolve, reject) => {
        const off = sock.subscribe((event) => {
          if (event.kind !== "message") return;
          if (event.message.type === "joined") {
            off();
            resolve();
          } else if (event.message.type === "error") {
            off();
            reject(new Error(event.message.reason));
          }
        });
        sock.send({ type: "join-room", code: code.toUpperCase(), name });
      });
    },
    [],
  );

  const releaseSeat = useCallback((): void => {
    gameSocket().send({ type: "release-seat" });
    setMultiplayerMode((prev) => (prev ? { ...prev, playerId: "" } : prev));
  }, []);

  const startMultiplayerGame = useCallback((): void => {
    gameSocket().send({ type: "start-game" });
  }, []);

  const claimSeat = useCallback(
    async (playerId: string): Promise<void> => {
      const sock = gameSocket();
      return new Promise<void>((resolve, reject) => {
        const off = sock.subscribe((event) => {
          if (event.kind !== "message") return;
          // The server's claim-seat path rebroadcasts state with
          // an updated roster, so a `state` frame after our send
          // is our success signal. An `error` is the failure.
          if (event.message.type === "state" && event.message.roster) {
            off();
            // Pre-update the local mode so the caller doesn't have
            // to wait for the broadcast handler.
            setMultiplayerMode((prev) =>
              prev ? { ...prev, playerId } : prev,
            );
            resolve();
          } else if (event.message.type === "error") {
            off();
            reject(new Error(event.message.reason));
          }
        });
        sock.send({ type: "claim-seat", playerId });
      });
    },
    [],
  );

  const leaveMultiplayer = useCallback(() => {
    gameSocket().close();
    setMultiplayerMode(null);
    setRoster([]);
    setStore(EMPTY_STORE);
  }, []);

  // Buy-mode helpers — the conveyor + capital cards become click targets
  // and the BuyOverlay drives Confirm/Cancel.
  const startBuyMode = useCallback(() => {
    setBuyMode({ pickedTarget: null, spendCardIds: [] });
    setInspect(null);
    setSelectedHandCardIds([]);
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
    setSelectedHandCardIds([]);
  }, []);

  const cancelAgeMode = useCallback(() => {
    setAgeMode(null);
  }, []);

  // Auto-fire age the moment the player has both picks — no Confirm
  // button. Mirrors sell-mode's `fireSell`. Uses the MP-aware seat id
  // so the multiplayer flow targets the dispatcher's claimed seat
  // (not just `players.find(!isBot)` which always resolves to the
  // host on every screen).
  // v3.1 — defensive guard against double-fire. Even with the
  // setState-updater fix above, any future caller that triggers
  // fireAge twice in a microtask window would re-dispatch and the
  // second call would be rejected by the engine. Track the last
  // fired (barrel, card) pair and skip identical fires within a
  // short window. The guard is process-local, no React state.
  const lastAgeFireRef = useRef<{ key: string; t: number } | null>(null);
  const fireAge = useCallback(
    (barrelId: string, cardId: string) => {
      const key = `${barrelId}|${cardId}`;
      const now = Date.now();
      const last = lastAgeFireRef.current;
      if (last && last.key === key && now - last.t < 500) {
        return;
      }
      lastAgeFireRef.current = { key, t: now };
      const seatId = multiplayerMode
        ? multiplayerMode.playerId
        : store.state?.players.find((p) => !p.isBot)?.id;
      if (!seatId) return;
      const action: GameAction = {
        type: "AGE_BOURBON",
        playerId: seatId,
        barrelId,
        cardId,
      };
      setAgeMode(null);
      dispatch(action);
    },
    [multiplayerMode, store.state, dispatch],
  );

  // v2.9: auto-open Age mode the moment the local seat owes a per-turn
  // aging commit. The user can still Cancel out (gives up the turn via
  // PASS_TURN); without this, they'd see no UI prompt and wonder why
  // every other action is rejecting.
  useEffect(() => {
    const s = store.state;
    if (!s || s.phase !== "action") return;
    const seatId = multiplayerMode
      ? multiplayerMode.playerId
      : s.players.find((p) => !p.isBot)?.id;
    if (!seatId) return;
    const me = s.players.find((p) => p.id === seatId);
    if (!me) return;
    if (s.players[s.currentPlayerIndex]?.id !== seatId) return;
    if (!me.needsAgeBarrels) return;
    if (me.needsDemandRoll) return; // demand modal still owns the screen
    if (ageMode) return;
    setAgeMode({ pickedBarrelId: null, pickedCardId: null });
  }, [store.state, multiplayerMode, ageMode]);

  // v3.1 — auto-fire age via a useEffect watching ageMode instead of
  // queueing microtasks from inside the setState updater. Two prior
  // attempts had silent failure modes:
  //   - queueMicrotask INSIDE the updater: strict-mode double-invokes
  //     the updater, queues two microtasks, both fire fireAge, the
  //     second hits `agedThisRound === true` and the engine rejects.
  //   - queueMicrotask OUTSIDE via a closure-var: setState updaters
  //     run DEFERRED (during commit), so the closure-var check ran
  //     while shouldFire was still null — fireAge was never called.
  // The effect-based pattern is what React docs recommend for
  // "fire when state matches a condition." setAgeBarrel / setAgeCard
  // become pure togglers; the effect owns the dispatch trigger.
  const setAgeBarrel = useCallback((barrelId: string) => {
    setAgeMode((prev) => {
      if (!prev) return prev;
      // Clicking the same barrel again clears it (lets the player
      // back out without canceling the whole mode).
      if (prev.pickedBarrelId === barrelId) {
        return { ...prev, pickedBarrelId: null };
      }
      return { ...prev, pickedBarrelId: barrelId };
    });
  }, []);

  const setAgeCard = useCallback((cardId: string) => {
    setAgeMode((prev) => {
      if (!prev) return prev;
      // Single-select toggle: clicking the same card again clears it.
      if (prev.pickedCardId === cardId) {
        return { ...prev, pickedCardId: null };
      }
      return { ...prev, pickedCardId: cardId };
    });
  }, []);

  useEffect(() => {
    if (!ageMode) return;
    if (!ageMode.pickedBarrelId || !ageMode.pickedCardId) return;
    fireAge(ageMode.pickedBarrelId, ageMode.pickedCardId);
  }, [ageMode, fireAge]);

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

  // Draw-bill mode helpers — two-step picker. Step 1 picks the bourbon
  // (face-up bill or blind top-of-deck); step 2 tags pay cards.
  const startDrawBillMode = useCallback(() => {
    setDrawBillMode({ pickedMashBillId: null, blind: false, spendCardIds: [] });
    setBuyMode(null);
    setAgeMode(null);
    setMakeMode(null);
    setInspect(null);
    setSelectedHandCardIds([]);
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
    setSelectedHandCardIds([]);
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
    // v2.5+ incremental commitment: prefer committing to an existing
    // under-construction barrel. v2.7 dropped the once-per-turn cap,
    // so any in-progress barrel is fair game.
    const myBarrels = store.state.allBarrels.filter((b) => b.ownerId === human.id);
    const inProgress = myBarrels.find((b) => b.phase === "construction");
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

  // ---------------------------------------------------------------
  // Sell-mode helpers — single-step picker, **auto-fires on barrel pick**.
  // v2.10: no card-spend cost. Clicking a barrel resolves the sale
  // immediately with the full grid reward going to reputation. A
  // future iteration may add a rep/PP slider for Gold-eligible sales.
  // ---------------------------------------------------------------
  const startSellMode = useCallback(() => {
    setSellMode({ pickedBarrelId: null });
    setBuyMode(null);
    setAgeMode(null);
    setDrawBillMode(null);
    setMakeMode(null);
    setInspect(null);
    setSelectedHandCardIds([]);
  }, []);

  const cancelSellMode = useCallback(() => {
    setSellMode(null);
  }, []);

  const fireSell = useCallback(
    (barrelId: string) => {
      const state = store.state;
      if (!state) return;
      const human = state.players.find((p) => !p.isBot);
      if (!human) return;
      const barrel = state.allBarrels.find((b) => b.id === barrelId);
      if (!barrel || !barrel.attachedMashBill) return;
      const reward = computeReward(barrel.attachedMashBill, barrel.age, state.demand, {
        demandBandOffset: barrel.demandBandOffset,
        gridRepOffset: barrel.gridRepOffset,
      });
      const action: GameAction = {
        type: "SELL_BOURBON",
        playerId: human.id,
        barrelId,
        // v2.10: take full rep. Gold-eligible sales support a rep/PP
        // split in the engine, but the client UI doesn't expose the
        // slider yet.
        reputationSplit: reward,
        cardDrawSplit: 0,
      };
      setSellMode(null);
      dispatch(action);
    },
    [store.state, dispatch],
  );

  const setSellBarrel = useCallback(
    (barrelId: string) => {
      setSellMode((prev) => {
        if (!prev) return prev;
        // Defer the fire so React applies the state update first.
        queueMicrotask(() => fireSell(barrelId));
        return { ...prev, pickedBarrelId: barrelId };
      });
    },
    [fireSell],
  );

  // ---------------------------------------------------------------
  // v2.6 drag-and-drop state — tracks "we're carrying a hand card,
  // looking for a slot to drop it on". Surfaced through the store
  // so every zone can read it and dim/spotlight accordingly.
  // ---------------------------------------------------------------
  const [dragMake, setDragMakeState] = useState<string | null>(null);
  const [dragMakeIds, setDragMakeIds] = useState<string[]>([]);
  const startDragMake = useCallback((cardIds: string[]) => {
    if (cardIds.length === 0) return;
    setDragMakeState(cardIds[0] ?? null);
    setDragMakeIds(cardIds);
  }, []);
  const endDragMake = useCallback(() => {
    setDragMakeState(null);
    setDragMakeIds([]);
  }, []);

  // v2.10 hand multi-select setters. State itself is declared up top
  // so the picker-mode useCallbacks earlier in this provider can
  // clear it. Persistent across renders so the player can check
  // several cards before deciding which slot or market card to drop
  // them on. Cleared on a successful drop (drop handlers call
  // `clearHandSelection`) and on mode entry (the Make / Buy / etc.
  // pickers take over selection semantics themselves).
  const toggleHandSelection = useCallback((cardId: string) => {
    setSelectedHandCardIds((prev) =>
      prev.includes(cardId) ? prev.filter((id) => id !== cardId) : [...prev, cardId],
    );
  }, []);
  const clearHandSelection = useCallback(() => {
    setSelectedHandCardIds([]);
  }, []);

  // v3 double-click commit. Single-click on a hand card toggles
  // selection (in any picker, or the persistent multi-select outside
  // a picker). Double-click should bypass the toggle and fire the
  // action immediately — the user's intent ("send this card now")
  // is unambiguous. Resolves to a no-op when no actionable picker
  // state is in place; the leading single-click already toggled the
  // selection so the user just sees the toggle and no fire.
  const commitHandCardImmediate = useCallback(
    (cardId: string) => {
      // Age — needs a picked barrel. Fire directly with the captured
      // card id so onClick toggle races (which may have flipped
      // pickedCardId off mid-double-click) don't matter.
      if (ageMode?.pickedBarrelId) {
        fireAge(ageMode.pickedBarrelId, cardId);
        return;
      }
      // v2.10: sell action no longer consumes a hand card, so the
      // double-click-on-card path bypasses sell-mode entirely.
      // Make — fire a single-card commit using whichever target the
      // confirmMake heuristic picks (in-progress barrel first, then
      // the next open slot). State updates batch, so we read live
      // store state instead of routing through toggleMakeSpend +
      // confirmMake which would race.
      if (makeMode) {
        const human = store.state?.players.find((p) => !p.isBot);
        if (!human || !store.state) return;
        const myBarrels = store.state.allBarrels.filter(
          (b) => b.ownerId === human.id,
        );
        const inProgress = myBarrels.find((b) => b.phase === "construction");
        let slotId: string | null = null;
        if (inProgress) {
          slotId = inProgress.slotId;
        } else {
          const occupied = new Set(myBarrels.map((b) => b.slotId));
          const freeSlot = human.rickhouseSlots.find(
            (s) => !occupied.has(s.id),
          );
          if (freeSlot) slotId = freeSlot.id;
        }
        if (!slotId) return;
        const billAlreadyOnBarrel = inProgress?.attachedMashBill != null;
        setMakeMode(null);
        dispatch({
          type: "MAKE_BOURBON",
          playerId: human.id,
          slotId,
          cardIds: [cardId],
          ...(makeMode.pickedMashBillId && !billAlreadyOnBarrel
            ? { mashBillId: makeMode.pickedMashBillId }
            : {}),
        });
        return;
      }
      // No picker active — fall through. The leading onClick of the
      // double-click already toggled the multi-select state; nothing
      // more to do.
    },
    [ageMode, sellMode, makeMode, fireAge, fireSell, store.state, dispatch],
  );

  // Autoplay loop — paused while waiting on human input. Disabled
  // entirely in multiplayer mode (the server's `Tick` Lambda runs
  // bot turns there; client-side stepping would race the broadcast).
  useEffect(() => {
    if (multiplayerMode) return;
    if (!autoplay) return;
    if (!store.state) return;
    if (isGameOver(store.state)) {
      setAutoplayState(false);
      return;
    }
    if (awaitingHumanInput(store.state)) return;
    const id = window.setTimeout(step, AUTO_STEP_MS);
    return () => window.clearTimeout(id);
  }, [autoplay, multiplayerMode, store.state, step]);

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

  // Same bail-out for sell mode.
  useEffect(() => {
    if (!sellMode) return;
    const state = store.state;
    if (!state || state.phase !== "action") {
      setSellMode(null);
      return;
    }
    const current = state.players[state.currentPlayerIndex];
    if (!current || current.isBot) {
      setSellMode(null);
    }
  }, [store.state, sellMode]);

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
  // Disabled in multiplayer — the server is authoritative; client-side
  // stepping would race the broadcast and produce visible divergence.
  useEffect(() => {
    if (multiplayerMode) return;
    // Tutorial mode owns the round loop — its controller dispatches
    // every bot move and every draw on its own clock. The orchestrator
    // would otherwise race the controller and stomp on the rigged
    // sequence (e.g. fire its own ROLL_DEMAND between scripted beats).
    if (tutorialActive) return;
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

    // Action-phase pacing: 320ms felt like the bot was machine-gunning
    // moves — sale, make, buy back-to-back inside a single Flight
    // animation cycle (FLIGHT_MS ≈ 720ms). The human couldn't track
    // what each move did. Bumped to 800ms so each bot decision has
    // room to land visually before the next one fires; draw-phase
    // (180ms) stays snappy because there's nothing to watch beyond
    // the deck count ticking down.
    const delay = isActionPhase ? 800 : 180;
    const id = window.setTimeout(step, delay);
    return () => window.clearTimeout(id);
  }, [multiplayerMode, tutorialActive, store.state, step]);

  const newGame = useCallback((cfg: NewGameConfig) => {
    const fullCatalog = defaultMashBillCatalog();
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

    // v2.10 settings: resolve overrides, falling back to "Normal" defaults.
    const settings = cfg.settings ?? {};
    const mashBillCount = Math.min(
      fullCatalog.length,
      Math.max(players.length, settings.mashBillCount ?? fullCatalog.length),
    );
    const catalog = fullCatalog.slice(0, mashBillCount);
    // v2.10: when distilleries are enabled (default and the only
    // resolved mode today), pre-assigning startingMashBills here would
    // override each distillery's `mashBillDraftSize` (Vanilla=0,
    // Connoisseur=4) — so we leave it undefined and let SELECT_DISTILLERY
    // top up each player's slots per their distillery. The whole
    // catalog becomes the bourbon deck.
    //
    // When distilleries are toggled off, every seat is pre-assigned
    // Vanilla (0 starting bills) and the bourbon deck holds the catalog
    // unchanged — players draw bills during play.
    const distilleriesOn = settings.distilleries ?? DISTILLERIES_ENABLED;
    const startingDistilleries = distilleriesOn
      ? undefined
      : players.map((p) => buildVanillaDistilleryFor(p.id));
    const fresh = initializeGame({
      seed,
      players,
      bourbonDeck: catalog,
      startingDistilleries,
      // No starterDecks → engine still runs the trade window.
    });
    setStore({
      state: fresh,
      log: [],
      seqCounter: 0,
      seatMeta: meta,
      lastPurchase: null,
      lastMake: null,
      lastSale: null,
      lastAge: null,
    });
    setAutoplayState(false);
    setInspect(null);
    setBuyMode(null);
    setAgeMode(null);
    setDrawBillMode(null);
    setMakeMode(null);
    setSellMode(null);
  }, []);

  const clear = useCallback(() => {
    setStore(EMPTY_STORE);
    setAutoplayState(false);
    setInspect(null);
    setBuyMode(null);
    setAgeMode(null);
    setDrawBillMode(null);
    setMakeMode(null);
    setSellMode(null);
  }, []);

  const setAutoplay = useCallback((on: boolean) => {
    setAutoplayState(on);
  }, []);

  // ─── Tutorial mode ───────────────────────────────────────────
  const startTutorial = useCallback(() => {
    const fresh = clearTutorialGates(buildTutorialInitialState());
    tutorialActiveRef.current = true;
    setTutorialActive(true);
    tutorialActionTransformRef.current = null;
    setStore({
      state: fresh,
      log: [],
      seqCounter: 0,
      seatMeta: fresh.players.map((p) => ({ id: p.id })),
      lastPurchase: null,
      lastMake: null,
      lastSale: null,
      lastAge: null,
    });
    setAutoplayState(false);
    setInspect(null);
    setBuyMode(null);
    setAgeMode(null);
    setDrawBillMode(null);
    setMakeMode(null);
    setSellMode(null);
  }, []);

  const endTutorial = useCallback(() => {
    tutorialActiveRef.current = false;
    setTutorialActive(false);
    tutorialActionTransformRef.current = null;
    setTutorialSpotlightState(null);
    setTutorialHandFilterState(null);
    // Re-hydrate the live-game blob from storage so closing the tutorial
    // doesn't blow away whatever real game the player had saved before.
    // Empty fallback if there's no saved game.
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
          lastSale: null,
          lastAge: null,
        });
        return;
      }
    } catch {
      /* corrupt save — fall through to empty store */
    }
    setStore(EMPTY_STORE);
  }, []);

  const mutateState = useCallback((fn: (s: GameState) => GameState) => {
    setStore((prev) => {
      if (!prev.state) return prev;
      let next = fn(prev.state);
      if (tutorialActiveRef.current) {
        next = clearTutorialGates(next);
      }
      return { ...prev, state: next };
    });
  }, []);

  const setTutorialActionTransform = useCallback(
    (fn: ((action: GameAction, state: GameState) => GameAction | null) | null) => {
      tutorialActionTransformRef.current = fn;
    },
    [],
  );

  const setTutorialSpotlight = useCallback(
    (target: SpotlightTarget | null) => {
      setTutorialSpotlightState(target);
    },
    [],
  );

  const setTutorialHandFilter = useCallback(
    (fn: ((card: Card) => boolean) | null) => {
      // Wrap in an updater. React's `setState(value)` treats raw
      // function values as updaters and invokes them — which would
      // try to call our filter with the previous filter as input.
      setTutorialHandFilterState(() => fn);
    },
    [],
  );

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

  // Resolve "which seat does this connection own?" The MP-aware
  // value lets setup-phase modals (DrawPhase, DemandRoll, etc.)
  // gate on the local player rather than `state.players.find(!isBot)`
  // which always returns the host on every screen.
  const humanSeatPlayerId = useMemo(() => {
    if (multiplayerMode) return multiplayerMode.playerId || null;
    return store.state?.players.find((p) => !p.isBot)?.id ?? null;
  }, [multiplayerMode, store.state]);

  const value = useMemo<GameStore>(
    () => ({
      state: store.state,
      log: store.log,
      scores,
      autoplay,
      seatMeta: store.seatMeta,
      humanWaitingOn,
      humanSeatPlayerId,
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
      sellMode,
      startSellMode,
      cancelSellMode,
      setSellBarrel,
      dragMake,
      dragMakeIds,
      startDragMake,
      endDragMake,
      selectedHandCardIds,
      toggleHandSelection,
      clearHandSelection,
      commitHandCardImmediate,
      lastPurchase: store.lastPurchase,
      lastMake: store.lastMake,
      lastSale: store.lastSale,
      lastAge: store.lastAge,
      multiplayerMode,
      multiplayerStatus,
      roster,
      multiplayerError,
      clearMultiplayerError: () => setMultiplayerError(null),
      newGame,
      createMultiplayer,
      joinMultiplayer,
      claimSeat,
      releaseSeat,
      startMultiplayerGame,
      leaveMultiplayer,
      step,
      dispatch,
      setAutoplay,
      clear,
      tutorialActive,
      startTutorial,
      endTutorial,
      mutateState,
      setTutorialActionTransform,
      tutorialSpotlight,
      setTutorialSpotlight,
      tutorialHandFilter,
      setTutorialHandFilter,
    }),
    [
      store,
      scores,
      autoplay,
      humanWaitingOn,
      humanSeatPlayerId,
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
      sellMode,
      startSellMode,
      cancelSellMode,
      setSellBarrel,
      dragMake,
      dragMakeIds,
      startDragMake,
      endDragMake,
      selectedHandCardIds,
      toggleHandSelection,
      clearHandSelection,
      commitHandCardImmediate,
      multiplayerMode,
      multiplayerStatus,
      roster,
      multiplayerError,
      newGame,
      createMultiplayer,
      joinMultiplayer,
      claimSeat,
      releaseSeat,
      startMultiplayerGame,
      leaveMultiplayer,
      step,
      dispatch,
      setAutoplay,
      clear,
      tutorialActive,
      startTutorial,
      endTutorial,
      mutateState,
      setTutorialActionTransform,
      tutorialSpotlight,
      setTutorialSpotlight,
      tutorialHandFilter,
      setTutorialHandFilter,
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

/**
 * Snapshot the cards leaving a barrel on SELL_BOURBON so SaleFlight
 * can animate them flying from the (now vanished) barrel slot to the
 * seller's discard pile. Reads `prev.state` because the barrel only
 * exists in the pre-apply state.
 */
function captureSale(
  prev: AtomicStore,
  action: GameAction,
  seq: number,
): LastSale | null {
  if (action.type !== "SELL_BOURBON") return prev.lastSale;
  if (!prev.state) return prev.lastSale;
  const barrel = prev.state.allBarrels.find((b) => b.id === action.barrelId);
  if (!barrel) return prev.lastSale;
  return {
    slotId: barrel.slotId,
    ownerId: barrel.ownerId,
    cards: [...barrel.productionCards, ...barrel.agingCards],
    seq,
  };
}

/**
 * Snapshot the destination + card label on AGE_BOURBON so AgeFlight
 * can animate a card-shaped element flying from the player's hand
 * tray up to the destination barrel slot. The card itself has been
 * removed from the player's hand by apply time, so we look it up in
 * `prev.state` (pre-apply) for the label / subtype that drives the
 * ghost's chrome.
 */
function captureAge(
  prev: AtomicStore,
  action: GameAction,
  seq: number,
): LastAge | null {
  if (action.type !== "AGE_BOURBON") return prev.lastAge;
  if (!prev.state) return prev.lastAge;
  const barrel = prev.state.allBarrels.find((b) => b.id === action.barrelId);
  if (!barrel) return prev.lastAge;
  const player = prev.state.players.find((p) => p.id === action.playerId);
  const card = player?.hand.find((c) => c.id === action.cardId);
  return {
    slotId: barrel.slotId,
    ownerId: barrel.ownerId,
    cardLabel:
      card?.displayName ??
      (card?.type === "capital"
        ? `Capital $${card.capitalValue ?? 1}`
        : card?.subtype
          ? card.subtype.charAt(0).toUpperCase() + card.subtype.slice(1)
          : "Card"),
    cardSubtype: card?.subtype ?? card?.type ?? "card",
    seq,
  };
}
