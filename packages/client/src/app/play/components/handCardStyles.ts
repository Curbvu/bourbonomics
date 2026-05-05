/**
 * Shared visual chrome for the human hand cards. Centralised so the in-tray
 * mini cards and any future inspect modal agree on gradients, glyphs, and
 * labels. All hand cards share the same portrait silhouette in the tray
 * (HAND_CARD_W × HAND_CARD_H).
 *
 * Visual idiom ported from the dev branch.
 */

import type { ResourceSubtype } from "@bourbonomics/engine";

/**
 * Single source of truth for the table-card silhouette. Hand, market
 * conveyor, mash-bill row, ops row, and draw-pile tiles all use this so
 * every card on screen reads as the same physical object.
 */
export const CARD_SIZE_CLASS = "h-[140px] w-[100px]";
export const HAND_CARD_W = 100;
export const HAND_CARD_H = 140;

/** Negative left margin used to overlap mini cards into an accordion fan. */
export const HAND_CARD_OVERLAP = "-ml-12";

export type CardChrome = {
  gradient: string;
  border: string;
  borderSoft: string;
  ink: string;
  label: string;
};

export const RESOURCE_CHROME: Record<ResourceSubtype, CardChrome> = {
  cask: {
    gradient: "bg-gradient-to-b from-amber-600/90 via-amber-900/90 to-slate-950",
    border: "border-amber-400",
    borderSoft: "border-amber-500/40",
    ink: "text-amber-50",
    label: "text-amber-200",
  },
  corn: {
    gradient: "bg-gradient-to-b from-yellow-500/90 via-yellow-800/90 to-slate-950",
    border: "border-yellow-300",
    borderSoft: "border-yellow-400/40",
    ink: "text-yellow-50",
    label: "text-yellow-200",
  },
  barley: {
    gradient: "bg-gradient-to-b from-lime-500/90 via-lime-800/90 to-slate-950",
    border: "border-lime-300",
    borderSoft: "border-lime-400/40",
    ink: "text-lime-50",
    label: "text-lime-200",
  },
  rye: {
    gradient: "bg-gradient-to-b from-rose-500/90 via-rose-800/90 to-slate-950",
    border: "border-rose-300",
    borderSoft: "border-rose-400/40",
    ink: "text-rose-50",
    label: "text-rose-200",
  },
  wheat: {
    gradient: "bg-gradient-to-b from-sky-500/90 via-sky-800/90 to-slate-950",
    border: "border-sky-300",
    borderSoft: "border-sky-400/40",
    ink: "text-sky-50",
    label: "text-sky-200",
  },
};

export const CAPITAL_CHROME: CardChrome = {
  gradient: "bg-gradient-to-b from-emerald-500/90 via-emerald-800/90 to-slate-950",
  border: "border-emerald-300",
  borderSoft: "border-emerald-400/40",
  ink: "text-emerald-50",
  label: "text-emerald-200",
};

export const OPS_CHROME: CardChrome = {
  gradient: "bg-gradient-to-b from-violet-500/90 via-violet-800/90 to-slate-950",
  border: "border-violet-300",
  borderSoft: "border-violet-400/40",
  ink: "text-violet-50",
  label: "text-violet-200",
};

// Mash bills use TIER_CHROME from `tierStyles.ts` (WoW palette per tier),
// not a single bourbon chrome.

export const RESOURCE_GLYPH: Record<ResourceSubtype, string> = {
  cask: "◯",
  corn: "◆",
  barley: "★",
  rye: "▲",
  wheat: "▼",
};

export const RESOURCE_LABEL: Record<ResourceSubtype, string> = {
  cask: "Cask",
  corn: "Corn",
  barley: "Barley",
  rye: "Rye",
  wheat: "Wheat",
};
