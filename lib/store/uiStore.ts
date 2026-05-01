"use client";

/**
 * UI-only zustand store for transient interaction modes that aren't part
 * of GameState (and therefore aren't persisted).
 *
 * Currently houses the "make bourbon" two-phase flow:
 *   1) Player clicks Make ↵ → `active = true`. The dashboard blurs except
 *      for HandTray + RickhouseRow.
 *   2) Player toggles resource chips in their hand → `selectedIds`
 *      accumulates / drops the cards.
 *   3) Once the selection forms a valid mash, RickhouseRow lights up the
 *      open rickhouses; clicking one dispatches MAKE_BOURBON and clears
 *      the mode.
 *   4) Cancel via Esc, the Cancel button, or clicking the dim overlay.
 */

import { create } from "zustand";

type MakeBourbonMode = {
  active: boolean;
  /**
   * Resource-card instance ids the player has selected for the mash.
   * Stored as an ordered list (not a Set) so React rendering remains
   * deterministic and the value is JSON-serialisable should we ever
   * decide to surface it.
   */
  selectedIds: string[];
};

export type UiStore = {
  makeBourbon: MakeBourbonMode;
  startMakeBourbon: () => void;
  toggleMashCard: (instanceId: string) => void;
  cancelMakeBourbon: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  makeBourbon: { active: false, selectedIds: [] },
  startMakeBourbon: () =>
    set({ makeBourbon: { active: true, selectedIds: [] } }),
  toggleMashCard: (instanceId) =>
    set((s) => {
      const has = s.makeBourbon.selectedIds.includes(instanceId);
      const selectedIds = has
        ? s.makeBourbon.selectedIds.filter((id) => id !== instanceId)
        : [...s.makeBourbon.selectedIds, instanceId];
      return { makeBourbon: { ...s.makeBourbon, selectedIds } };
    }),
  cancelMakeBourbon: () =>
    set({ makeBourbon: { active: false, selectedIds: [] } }),
}));
