/**
 * WoW-style visual treatments for the five bourbon tiers. Centralised so
 * BourbonCardFace, MiniBourbonCard, RarityBadge, and CardDrawOverlay
 * agree on colour, border, and glow per tier.
 *
 * Tier colours map to the canonical WoW palette:
 *   common     white / slate
 *   uncommon   green
 *   rare       blue
 *   epic       purple
 *   legendary  orange
 */

import type { BourbonTier } from "@/lib/catalogs/types";

export type TierChrome = {
  /** Tailwind classes for the dominant border (face card). */
  border: string;
  /** Subtle border for badges and pills. */
  borderSoft: string;
  /** Tailwind classes for the title ink colour. */
  titleInk: string;
  /** Eyebrow / label colour. */
  label: string;
  /** Card background gradient. */
  gradient: string;
  /** Optional outer glow / ring (empty for common). */
  glow: string;
  /** Optional shimmer animation class (rare-shimmer keyframe). */
  shimmer: string;
  /** Rarity-pill base style. */
  pill: string;
  /** Visible label of the tier ("Common", "Legendary"). */
  label_text: string;
};

const SHIMMER = "rare-shimmer";

export const TIER_CHROME: Record<BourbonTier, TierChrome> = {
  common: {
    border: "border-slate-500",
    borderSoft: "border-slate-500/40",
    titleInk: "text-slate-100",
    label: "text-slate-400",
    gradient:
      "bg-[linear-gradient(180deg,rgba(71,85,105,.25)_0%,rgba(15,23,42,.95)_75%)]",
    glow: "",
    shimmer: "",
    pill: "border-slate-500 bg-slate-700/40 text-slate-200",
    label_text: "Common",
  },
  uncommon: {
    border: "border-emerald-400",
    borderSoft: "border-emerald-400/40",
    titleInk: "text-emerald-50",
    label: "text-emerald-300",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(16,185,129,.15),transparent_55%),linear-gradient(180deg,rgba(6,78,59,.35)_0%,rgba(15,23,42,.95)_75%)]",
    glow: "shadow-[0_0_14px_rgba(16,185,129,.25)]",
    shimmer: "",
    pill: "border-emerald-400 bg-emerald-500/20 text-emerald-100",
    label_text: "Uncommon",
  },
  rare: {
    border: "border-sky-400",
    borderSoft: "border-sky-400/40",
    titleInk: "text-sky-50",
    label: "text-sky-300",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(56,189,248,.18),transparent_55%),linear-gradient(180deg,rgba(12,74,110,.40)_0%,rgba(15,23,42,.95)_75%)]",
    glow: "shadow-[0_0_18px_rgba(56,189,248,.30)]",
    shimmer: "",
    pill: "border-sky-400 bg-sky-500/20 text-sky-100",
    label_text: "Rare",
  },
  epic: {
    border: "border-violet-400",
    borderSoft: "border-violet-400/45",
    titleInk: "text-violet-50",
    label: "text-violet-300",
    gradient:
      "bg-[radial-gradient(110%_70%_at_50%_-10%,rgba(167,139,250,.22),transparent_55%),linear-gradient(180deg,rgba(76,29,149,.40)_0%,rgba(15,23,42,.95)_75%)]",
    glow:
      "shadow-[0_0_24px_rgba(167,139,250,.40)] ring-2 ring-violet-400/40",
    shimmer: SHIMMER,
    pill: "border-violet-400 bg-violet-500/20 text-violet-100",
    label_text: "Epic",
  },
  legendary: {
    border: "border-orange-400",
    borderSoft: "border-orange-400/55",
    titleInk: "text-orange-50",
    label: "text-orange-300",
    gradient:
      "bg-[radial-gradient(120%_75%_at_50%_-10%,rgba(251,146,60,.30),transparent_55%),linear-gradient(180deg,rgba(154,52,18,.50)_0%,rgba(15,23,42,.95)_75%)]",
    glow:
      "shadow-[0_0_32px_rgba(251,146,60,.55)] ring-2 ring-orange-400/55",
    shimmer: SHIMMER,
    pill:
      "border-orange-300 bg-gradient-to-b from-orange-300 to-orange-500 text-slate-950",
    label_text: "Legendary",
  },
};

/** Convenience for callers that only have a string and need a fallback. */
export function tierOrCommon(tier: BourbonTier | undefined | null): BourbonTier {
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
