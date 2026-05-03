/**
 * localStorage persistence for the active game.
 *
 * One slot only — `bourbonomics.v1.game`. Calling `installPersistence()` once at
 * app startup wires up a subscription to `useGameStore` so every state change
 * is saved. It also loads any saved state synchronously on install.
 */

"use client";

import { useGameStore } from "./gameStore";
import type { GameState } from "@/lib/engine/state";

const STORAGE_KEY = "bourbonomics.v1.game";

let installed = false;

export function installPersistence(): void {
  if (installed) return;
  installed = true;
  if (typeof window === "undefined") return;

  // Load existing save if any. We accept only the current schema version —
  // anything older is silently discarded so a stale save can't crash a new
  // build that has rearranged GameState fields.
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<GameState>;
      if (parsed && parsed.version === 7) {
        useGameStore.getState().loadState(migrateLoaded(parsed as GameState));
      } else if (parsed) {
        // Old / unknown schema — drop it so the page boots into a fresh game.
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // Ignore parse/storage errors — start fresh.
  }

  // Persist on every state change.
  useGameStore.subscribe((s) => {
    try {
      if (s.state) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s.state));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      // Storage may be full or disabled; fail silently.
    }
  });
}

export function clearSavedGame(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/**
 * Soft-migrate a loaded GameState. The persisted schema version (7)
 * predates a few additive fields — saves from before those fields
 * existed are missing them and would crash UI that reads them blind.
 * We fill in safe defaults here so an in-flight game keeps playing
 * after a deploy that introduced new fields without bumping the
 * schema version.
 */
function migrateLoaded(s: GameState): GameState {
  // freeActionsRemainingByPlayer: introduced for the round-1 setup
  // window. Default existing saves to zero so they don't suddenly grant
  // the human 8 mid-round free actions.
  if (!s.actionPhase.freeActionsRemainingByPlayer) {
    s.actionPhase.freeActionsRemainingByPlayer = Object.fromEntries(
      s.playerOrder.map((id) => [id, 0]),
    );
  }
  return s;
}
