/**
 * Shared visual chrome for the human hand cards (resources, bourbon, ops,
 * investments). Centralised so the in-tray mini cards and the
 * HandInspectModal large views agree on gradients, glyphs, and labels.
 *
 * All hand cards share the same portrait silhouette in the tray
 * (HAND_CARD_W × HAND_CARD_H), giving the player a single visual idiom
 * to scan across the three sections.
 */

import type { ResourceType } from "@/lib/catalogs/types";

export const HAND_CARD_W = 112;
export const HAND_CARD_H = 148;

/** Negative left margin used to overlap mini cards into an accordion fan. */
export const HAND_CARD_OVERLAP = "-ml-9";

export type ResourceChrome = {
  /** Tailwind classes for the gradient background. */
  gradient: string;
  /** Tailwind classes for the strong border colour. */
  border: string;
  /** Subtle border for inner badges / chips. */
  borderSoft: string;
  /** Body / glyph ink colour. */
  ink: string;
  /** Header label tint. */
  label: string;
};

export const RESOURCE_CHROME: Record<ResourceType, ResourceChrome> = {
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

export const RESOURCE_GLYPH: Record<ResourceType, string> = {
  cask: "◯",
  corn: "◆",
  barley: "★",
  rye: "▲",
  wheat: "▼",
};

export const RESOURCE_LABEL: Record<ResourceType, string> = {
  cask: "Cask",
  corn: "Corn",
  barley: "Barley",
  rye: "Rye",
  wheat: "Wheat",
};
