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

  // Load existing save if any.
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as GameState;
      if (parsed && parsed.version === 1) {
        useGameStore.getState().loadState(parsed);
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
