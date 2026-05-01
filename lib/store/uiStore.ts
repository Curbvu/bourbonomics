"use client";

/**
 * UI-only zustand store for transient interaction modes that aren't part
 * of GameState (and therefore aren't persisted).
 *
 * Currently houses the "make bourbon" two-phase flow:
 *   1) Player clicks Make ↵ → `active = true`. The dashboard blurs except
 *      for HandTray + RickhouseRow.
 *   2) Player toggles resource chips in their hand → `selectedIds`
 *      accumulates / drops the cards. They also pick exactly one mash
 *      bill from their bourbon hand → `mashBillId` holds the choice.
 *   3) Once the selection forms a valid mash AND a mash bill is picked,
 *      RickhouseRow lights up the open rickhouses; clicking one dispatches
 *      MAKE_BOURBON and clears the mode.
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
  /**
   * Bourbon-card id the player has picked from their bourbon hand to
   * commit to the new barrel as its locked-in mash bill. Null until
   * chosen; required to dispatch MAKE_BOURBON.
   */
  mashBillId: string | null;
};

export type UiStore = {
  makeBourbon: MakeBourbonMode;
  startMakeBourbon: () => void;
  toggleMashCard: (instanceId: string) => void;
  pickMashBill: (cardId: string) => void;
  cancelMakeBourbon: () => void;
};

export const useUiStore = create<UiStore>((set) => ({
  makeBourbon: { active: false, selectedIds: [], mashBillId: null },
  startMakeBourbon: () =>
    set({ makeBourbon: { active: true, selectedIds: [], mashBillId: null } }),
  toggleMashCard: (instanceId) =>
    set((s) => {
      const has = s.makeBourbon.selectedIds.includes(instanceId);
      const selectedIds = has
        ? s.makeBourbon.selectedIds.filter((id) => id !== instanceId)
        : [...s.makeBourbon.selectedIds, instanceId];
      return { makeBourbon: { ...s.makeBourbon, selectedIds } };
    }),
  pickMashBill: (cardId) =>
    set((s) => ({
      makeBourbon: {
        ...s.makeBourbon,
        // Toggle off if the same id is clicked again, else replace.
        mashBillId: s.makeBourbon.mashBillId === cardId ? null : cardId,
      },
    })),
  cancelMakeBourbon: () =>
    set({ makeBourbon: { active: false, selectedIds: [], mashBillId: null } }),
}));
