/**
 * Zustand store wrapping the pure reducer.
 *
 * The store holds the `GameState` and exposes `dispatch` which:
 *   1. Applies a reducer action.
 *   2. Sets state immediately so the human's own action lands instantly.
 *   3. Pumps bot moves one at a time, ~`BOT_TICK_MS` apart, so each bot
 *      action gets its own UI tick — the dashboard can render the
 *      intermediate state and the BotActionAnimator can watch the log
 *      and play a flying-card animation per bot move.
 *   4. Persists to localStorage (handled by lib/store/persistence.ts subscribe).
 *
 * If the host environment is non-DOM (SSR, tests), the store falls
 * back to fully synchronous bot driving so `dispatch` settles in one
 * call. This keeps the test suite — which never touches the store —
 * unaffected, and keeps server-rendered initial state correct.
 */

"use client";

import { create } from "zustand";

import type { Action } from "@/lib/engine/actions";
import { recoverInstanceCounter } from "@/lib/engine/decks";
import { reduce } from "@/lib/engine/reducer";
import type { GameState } from "@/lib/engine/state";
import { driveBots } from "@/lib/ai/driver";
import { createInitialState, type NewGameConfig } from "@/lib/engine/setup";

/** Delay between successive bot moves so the UI can render each tick. */
export const BOT_TICK_MS = 600;

const isBrowser = typeof window !== "undefined";

export type GameStore = {
  state: GameState | null;
  newGame: (cfg: NewGameConfig) => void;
  dispatch: (action: Action) => void;
  loadState: (state: GameState) => void;
  clear: () => void;
};

let pumpTimeout: ReturnType<typeof setTimeout> | null = null;

function cancelPump() {
  if (pumpTimeout != null) {
    clearTimeout(pumpTimeout);
    pumpTimeout = null;
  }
}

function schedulePump(set: (s: { state: GameState | null }) => void, get: () => GameStore) {
  if (!isBrowser) return;
  cancelPump();
  pumpTimeout = setTimeout(() => {
    pumpTimeout = null;
    const cur = get().state;
    if (!cur) return;
    // Step ONE bot action, then re-schedule. driveBots(state, 1) is a
    // no-op when the next decision needs the human, the game is over,
    // or there's simply no work to do — in which case `next === cur`
    // and we stop pumping.
    const next = driveBots(cur, 1);
    if (next === cur) return;
    set({ state: next });
    schedulePump(set, get);
  }, BOT_TICK_MS);
}

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  newGame: (cfg) => {
    cancelPump();
    const fresh = createInitialState(cfg);
    if (isBrowser) {
      // Browser path — set the fresh state instantly, then pump bots
      // one at a time so the human sees each Distillery draft + every
      // round-1 bot move land sequentially.
      set({ state: fresh });
      schedulePump(set, get);
    } else {
      // Non-DOM path (SSR / tests) — fully sync bot resolution so the
      // returned state is the settled state.
      set({ state: driveBots(fresh) });
    }
  },
  dispatch: (action) => {
    const current = get().state;
    if (!current) return;
    const next = reduce(current, action);
    if (isBrowser) {
      set({ state: next });
      schedulePump(set, get);
    } else {
      set({ state: driveBots(next) });
    }
  },
  loadState: (state) => {
    cancelPump();
    // The instance-id counter lives in module scope and is not part of the
    // serialised GameState. After a refresh / load, reconcile it against the
    // ids already in the loaded state so subsequent mintInstanceId() calls
    // never collide with ones that survived the round-trip.
    recoverInstanceCounter(state);
    set({ state });
    if (isBrowser) schedulePump(set, get);
  },
  clear: () => {
    cancelPump();
    set({ state: null });
  },
}));
