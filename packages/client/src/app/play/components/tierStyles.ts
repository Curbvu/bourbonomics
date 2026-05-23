/**
 * v3 "Distillery-first" tier chrome for mash bills.
 *
 * Five tiers, warm bourbon palette (replaces the v2 cool WoW set so
 * tiers read coherently against the bourbon canvas):
 *
 *   common      #b9a684  (ink-muted oak)
 *   uncommon    #82c9a3  (verdigris)
 *   rare        #7da6df  (cellar sky)
 *   epic        #c69df0  (smoke)
 *   legendary   #f0b070  (lit amber)
 *
 * Centralised so BarrelCell + caption card (DistilleryStage), MarketCard
 * (MarketDrawer), opponent mini-rickhouse (OpponentRail), inspect modal,
 * and the /wiki gallery all agree per tier on border / gradient /
 * label tint / glow.
 *
 * Arbitrary-value Tailwind utilities keep the structure intact while
 * pointing every ink at the warm palette; consumers that need the raw
 * hex (gradients, glows) reach for `TIER_INK` directly.
 */

import type { MashBillTier } from "@bourbonomics/engine";

export type TierChrome = {
  border: string;
  titleInk: string;
  label: string;
  gradient: string;
  /** Outer glow / ring (empty for common). */
  glow: string;
  /** Pill chrome used for the tier badge. */
  pill: string;
  /** Display label ("Common", "Legendary"). */
  label_text: string;
};

/**
 * Raw tier-ink hex values — exposed so chrome that needs gradient
 * stops or inline SVG fills can reach for the same source of truth.
 * Mirrors the `--t-*` CSS custom properties in globals.css.
 */
export const TIER_INK: Record<MashBillTier, string> = {
  common: "#b9a684",
  uncommon: "#82c9a3",
  rare: "#7da6df",
  epic: "#c69df0",
  legendary: "#f0b070",
};

export const TIER_CHROME: Record<MashBillTier, TierChrome> = {
  common: {
    border: "border-[#b9a684]/55",
    titleInk: "text-[#f0e3c8]",
    label: "text-[#b9a684]",
    gradient:
      "bg-[linear-gradient(180deg,rgba(185,166,132,.10)_0%,rgba(20,14,8,.95)_75%)]",
    glow: "",
    pill: "border-[#b9a684] bg-[#b9a684]/15 text-[#f0e3c8]",
    label_text: "Common",
  },
  uncommon: {
    border: "border-[#82c9a3]/70",
    titleInk: "text-[#f0e3c8]",
    label: "text-[#82c9a3]",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(130,201,163,.18),transparent_55%),linear-gradient(180deg,rgba(130,201,163,.10)_0%,rgba(20,14,8,.95)_75%)]",
    glow: "shadow-[0_0_14px_rgba(130,201,163,.30)]",
    pill: "border-[#82c9a3] bg-[#82c9a3]/15 text-[#f0e3c8]",
    label_text: "Uncommon",
  },
  rare: {
    border: "border-[#7da6df]/70",
    titleInk: "text-[#f0e3c8]",
    label: "text-[#7da6df]",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(125,166,223,.20),transparent_55%),linear-gradient(180deg,rgba(125,166,223,.10)_0%,rgba(20,14,8,.95)_75%)]",
    glow: "shadow-[0_0_18px_rgba(125,166,223,.40)]",
    pill: "border-[#7da6df] bg-[#7da6df]/15 text-[#f0e3c8]",
    label_text: "Rare",
  },
  epic: {
    border: "border-[#c69df0]/70",
    titleInk: "text-[#f0e3c8]",
    label: "text-[#c69df0]",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(198,157,240,.25),transparent_55%),linear-gradient(180deg,rgba(198,157,240,.10)_0%,rgba(20,14,8,.95)_75%)]",
    glow: "shadow-[0_0_24px_rgba(198,157,240,.45)] ring-2 ring-[#c69df0]/40",
    pill: "border-[#c69df0] bg-[#c69df0]/15 text-[#f0e3c8]",
    label_text: "Epic",
  },
  legendary: {
    border: "border-[#f0b070]/80",
    titleInk: "text-[#f0e3c8]",
    label: "text-[#f0b070]",
    gradient:
      "bg-[radial-gradient(120%_75%_at_50%_-10%,rgba(240,176,112,.35),transparent_55%),linear-gradient(180deg,rgba(240,176,112,.15)_0%,rgba(20,14,8,.95)_75%)]",
    glow: "shadow-[0_0_32px_rgba(240,176,112,.60)] ring-2 ring-[#f0b070]/55",
    pill: "border-[#f0b070] bg-gradient-to-b from-[#f0c970] to-[#c69d52] text-[#1a120b]",
    label_text: "Legendary",
  },
};

export function tierOrCommon(tier: MashBillTier | undefined | null): MashBillTier {
  if (!tier) return "common";
  if (
    tier === "common" ||
    tier === "uncommon" ||
    tier === "rare" ||
    tier === "epic" ||
    tier === "legendary"
  ) {
    return tier;
  }
  return "common";
}
