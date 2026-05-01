"use client";

/**
 * UI-only zustand store for transient interaction modes that aren't part
 * of GameState (and therefore aren't persisted).
 *
 * Two modes today:
 *   - makeBourbon: two-phase flow for committing a mash + a bill to a barrel.
 *   - auditDiscard: builder for an AUDIT_DISCARD payload — the player must
 *     drop exactly `pendingAuditOverage` cards across mash bills + unbuilt
 *     investments + operations.
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

type AuditDiscardMode = {
  active: boolean;
  /** Mash-bill ids selected to drop. */
  mashBillIds: string[];
  /** Investment instance ids (must be unbuilt) selected to drop. */
  investmentInstanceIds: string[];
  /** Operations instance ids selected to drop. */
  operationsInstanceIds: string[];
};

export type UiStore = {
  makeBourbon: MakeBourbonMode;
  startMakeBourbon: () => void;
  toggleMashCard: (instanceId: string) => void;
  pickMashBill: (cardId: string) => void;
  cancelMakeBourbon: () => void;

  auditDiscard: AuditDiscardMode;
  startAuditDiscard: () => void;
  toggleAuditMashBill: (cardId: string) => void;
  toggleAuditInvestment: (instanceId: string) => void;
  toggleAuditOperations: (instanceId: string) => void;
  cancelAuditDiscard: () => void;

  /**
   * Round number whose post-market recap the player has dismissed.
   * The MarketRecapPanel renders during the next round's fees phase
   * (i.e. round = N + 1 when this stores N) and hides itself once
   * dismissed. Cleared implicitly by comparing against current round.
   */
  dismissedMarketRecapForRound: number | null;
  dismissMarketRecap: (round: number) => void;

  /**
   * Currently open inspect target — either a free-floating mash bill
   * (kind: "bill" — used when clicking a card in the bourbon hand) or a
   * specific aging barrel (kind: "barrel" — used when clicking a chip in
   * a rickhouse). The BourbonInspectModal reads this and renders the
   * full Bourbon Card face plus contextual info.
   */
  inspect:
    | { kind: "bill"; cardId: string }
    | { kind: "barrel"; barrelId: string }
    | null;
  inspectBill: (cardId: string) => void;
  inspectBarrel: (barrelId: string) => void;
  closeInspect: () => void;
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

  auditDiscard: {
    active: false,
    mashBillIds: [],
    investmentInstanceIds: [],
    operationsInstanceIds: [],
  },
  startAuditDiscard: () =>
    set({
      auditDiscard: {
        active: true,
        mashBillIds: [],
        investmentInstanceIds: [],
        operationsInstanceIds: [],
      },
    }),
  toggleAuditMashBill: (cardId) =>
    set((s) => {
      const has = s.auditDiscard.mashBillIds.includes(cardId);
      const mashBillIds = has
        ? s.auditDiscard.mashBillIds.filter((id) => id !== cardId)
        : [...s.auditDiscard.mashBillIds, cardId];
      return { auditDiscard: { ...s.auditDiscard, mashBillIds } };
    }),
  toggleAuditInvestment: (instanceId) =>
    set((s) => {
      const has = s.auditDiscard.investmentInstanceIds.includes(instanceId);
      const investmentInstanceIds = has
        ? s.auditDiscard.investmentInstanceIds.filter((id) => id !== instanceId)
        : [...s.auditDiscard.investmentInstanceIds, instanceId];
      return { auditDiscard: { ...s.auditDiscard, investmentInstanceIds } };
    }),
  toggleAuditOperations: (instanceId) =>
    set((s) => {
      const has = s.auditDiscard.operationsInstanceIds.includes(instanceId);
      const operationsInstanceIds = has
        ? s.auditDiscard.operationsInstanceIds.filter((id) => id !== instanceId)
        : [...s.auditDiscard.operationsInstanceIds, instanceId];
      return { auditDiscard: { ...s.auditDiscard, operationsInstanceIds } };
    }),
  cancelAuditDiscard: () =>
    set({
      auditDiscard: {
        active: false,
        mashBillIds: [],
        investmentInstanceIds: [],
        operationsInstanceIds: [],
      },
    }),

  dismissedMarketRecapForRound: null,
  dismissMarketRecap: (round) =>
    set({ dismissedMarketRecapForRound: round }),

  inspect: null,
  inspectBill: (cardId) => set({ inspect: { kind: "bill", cardId } }),
  inspectBarrel: (barrelId) =>
    set({ inspect: { kind: "barrel", barrelId } }),
  closeInspect: () => set({ inspect: null }),
}));
