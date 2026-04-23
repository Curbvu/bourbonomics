/**
 * Zustand store wrapping the pure reducer.
 *
 * The store holds the `GameState` and exposes `dispatch` which:
 *   1. Applies a reducer action.
 *   2. Runs `driveBots` so the state settles at the next human decision point.
 *   3. Persists to localStorage (handled by lib/store/persistence.ts subscribe).
 */

"use client";

import { create } from "zustand";

import type { Action } from "@/lib/engine/actions";
import { reduce } from "@/lib/engine/reducer";
import type { GameState } from "@/lib/engine/state";
import { driveBots } from "@/lib/ai/driver";
import { createInitialState, type NewGameConfig } from "@/lib/engine/setup";

export type GameStore = {
  state: GameState | null;
  newGame: (cfg: NewGameConfig) => void;
  dispatch: (action: Action) => void;
  loadState: (state: GameState) => void;
  clear: () => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  state: null,
  newGame: (cfg) => {
    const fresh = createInitialState(cfg);
    const settled = driveBots(fresh);
    set({ state: settled });
  },
  dispatch: (action) => {
    const current = get().state;
    if (!current) return;
    const next = reduce(current, action);
    const settled = driveBots(next);
    set({ state: settled });
  },
  loadState: (state) => set({ state }),
  clear: () => set({ state: null }),
}));
