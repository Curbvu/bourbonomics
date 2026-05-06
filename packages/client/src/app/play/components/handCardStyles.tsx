/**
 * Shared visual chrome for the human hand cards. Centralised so the in-tray
 * mini cards and any future inspect modal agree on gradients, glyphs, and
 * labels. All hand cards share the same portrait silhouette in the tray
 * (HAND_CARD_W × HAND_CARD_H).
 *
 * Visual idiom ported from the dev branch.
 */

import type { ReactNode } from "react";
import type { ResourceSubtype } from "@bourbonomics/engine";
import { BarleyIcon, CornIcon, RyeIcon, WheatIcon } from "./GrainIcon";

/**
 * Single source of truth for the table-card silhouette. Hand, market
 * conveyor, mash-bill row, ops row, and draw-pile tiles all use this so
 * every card on screen reads as the same physical object.
 */
export const CARD_SIZE_CLASS = "h-[140px] w-[100px]";
export const HAND_CARD_W = 100;
export const HAND_CARD_H = 140;

/**
 * Per-card horizontal offset between siblings inside a hand row.
 * Empty string = no overlap; rows now spread out with a gap supplied
 * by the accordion container instead of stacking via negative margins.
 */
export const HAND_CARD_OVERLAP = "";

export type CardChrome = {
  gradient: string;
  border: string;
  borderSoft: string;
  ink: string;
  label: string;
};

// Resource chromes — picked for maximum complementary contrast across
// the row so a glance at the hand reads as five distinct colours, not
// "five gradients in similar warm tones".
//
//   cask    — whiskey-barrel brown (warm wood)
//   corn    — golden yellow
//   barley  — vivid forest green   (contrasts capital's indigo)
//   rye     — blood crimson         (contrasts wheat's cyan)
//   wheat   — pale cyan/sky         (contrasts rye's red)
//   capital — royal indigo          (contrasts corn's yellow, distinct
//                                    from ops which is violet/purple)
export const RESOURCE_CHROME: Record<ResourceSubtype, CardChrome> = {
  cask: {
    // Charred-oak barrel brown — pulls every step away from amber/orange so
    // the body reads as wood, not "tinted hot-amber". Top is rich oak, mid
    // is charred oak, foot is deep char near-black.
    gradient: "bg-gradient-to-b from-[#6b4423]/95 via-[#3d2417]/95 to-[#1a0f06]",
    border: "border-[#a07142]",
    borderSoft: "border-[#a07142]/45",
    ink: "text-amber-50",
    label: "text-amber-200/90",
  },
  corn: {
    gradient: "bg-gradient-to-b from-yellow-300/95 via-amber-700/90 to-slate-950",
    border: "border-yellow-200",
    borderSoft: "border-yellow-300/45",
    ink: "text-yellow-50",
    label: "text-yellow-100",
  },
  barley: {
    // Teal — sits between capital (green) and wheat (cyan) without
    // colliding with either, and stays a distinct hue from the warm
    // cask/corn/rye column.
    gradient: "bg-gradient-to-b from-teal-300/95 via-teal-800/90 to-slate-950",
    border: "border-teal-200",
    borderSoft: "border-teal-300/45",
    ink: "text-teal-50",
    label: "text-teal-200",
  },
  rye: {
    gradient: "bg-gradient-to-b from-red-500/95 via-rose-900/95 to-slate-950",
    border: "border-red-300",
    borderSoft: "border-red-400/45",
    ink: "text-red-50",
    label: "text-rose-200",
  },
  wheat: {
    gradient: "bg-gradient-to-b from-cyan-300/95 via-sky-800/90 to-slate-950",
    border: "border-cyan-200",
    borderSoft: "border-cyan-300/45",
    ink: "text-cyan-50",
    label: "text-sky-100",
  },
};

export const CAPITAL_CHROME: CardChrome = {
  // Money green — punchier emerald top so it pops next to the warm
  // wood/grain row. Barley moved to teal so the two greens no longer
  // collide.
  gradient: "bg-gradient-to-b from-emerald-400/95 via-emerald-800/90 to-slate-950",
  border: "border-emerald-300",
  borderSoft: "border-emerald-400/45",
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

/**
 * Glyph used to identify each resource subtype on every card surface.
 * Cask stays as a unicode ◯ since it's not a grain (and its rendering as
 * a plain text glyph already plays nicely with the same `text-...`
 * tinting used by the SVG grain icons). The four grains are inline SVG
 * components from `GrainIcon.tsx` — one source of truth, picked up
 * automatically by HandTray, MarketCenter, CardInspectModal,
 * StarterDeckDraftModal, and PurchaseFlight.
 */
export const RESOURCE_GLYPH: Record<ResourceSubtype, ReactNode> = {
  cask: "◯",
  corn: <CornIcon />,
  barley: <BarleyIcon />,
  rye: <RyeIcon />,
  wheat: <WheatIcon />,
};

export const RESOURCE_LABEL: Record<ResourceSubtype, string> = {
  cask: "Cask",
  corn: "Corn",
  barley: "Barley",
  rye: "Rye",
  wheat: "Wheat",
};
