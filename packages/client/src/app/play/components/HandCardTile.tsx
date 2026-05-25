"use client";

/**
 * Presentational hand-card tile — shared between the Drafting Loop
 * modal and the Buy modal so a card looks the same in any overlay as
 * it does in the player's actual hand. Renders the real card's
 * `displayName` and a ★ corner badge for Specialty / Heritage cards
 * so a player can tell at a glance whether they're committing the
 * cheap or the expensive version.
 *
 * Pure visual — no game-store coupling. The parent owns the click
 * handler and selection state.
 */

import type { Card, ResourceSubtype } from "@bourbonomics/engine";
import {
  LABOR_CHROME,
  RESOURCE_CHROME,
  RESOURCE_GLYPH,
  RESOURCE_LABEL,
  laborGlyphFor,
} from "./handCardStyles";

export type HandCardTileSize = "sm" | "md" | "lg";

const SIZE_CHROME: Record<HandCardTileSize, {
  box: string;
  glyph: string;
  name: string;
  flavor: string;
  sublabel: string;
  starBadge: string;
  costBadge: string;
  countBadge: string;
  showFlavor: boolean;
}> = {
  sm: {
    box: "h-[120px] w-[86px] gap-1 px-1 py-1.5",
    glyph: "text-[30px]",
    name: "text-[12px] leading-tight",
    flavor: "text-[11px] leading-snug",
    sublabel: "text-[11px] tracking-[.10em]",
    starBadge: "text-[12px] px-1 py-[1px]",
    costBadge: "text-[12px] px-1 py-[1px]",
    countBadge: "text-[12px] px-1",
    showFlavor: false,
  },
  md: {
    box: "h-[170px] w-[114px] gap-1 px-2 py-2",
    glyph: "text-[38px]",
    name: "text-[14px] leading-tight",
    flavor: "text-[11px] leading-snug",
    sublabel: "text-[11px] tracking-[.12em]",
    starBadge: "text-[13px] px-1 py-[1px]",
    costBadge: "text-[12px] px-1.5 py-[1px]",
    countBadge: "text-[12px] px-1.5",
    showFlavor: true,
  },
  lg: {
    box: "h-[210px] w-[148px] gap-1.5 px-2 py-2.5",
    glyph: "text-[56px]",
    name: "text-[15px] leading-tight",
    flavor: "text-[12px] leading-snug",
    sublabel: "text-[12px] tracking-[.14em]",
    starBadge: "text-[14px] px-1.5 py-[2px]",
    costBadge: "text-[12px] px-1.5 py-[1px]",
    countBadge: "text-[12px] px-1.5",
    showFlavor: true,
  },
};

export interface HandCardTileProps {
  card: Card;
  selected?: boolean;
  interactive?: boolean;
  onClick?: () => void;
  /** Visual tone of the hover/selected ring. */
  tone?: "amber" | "emerald" | "rose" | "sky";
  size?: HandCardTileSize;
  /** Show the rep cost in the top-right corner. */
  showCost?: boolean;
  /** Optional dim/highlight cue (e.g. "ineligible" payment in buy mode). */
  dim?: boolean;
}

export default function HandCardTile({
  card,
  selected = false,
  interactive = false,
  onClick,
  tone = "amber",
  size = "sm",
  showCost = false,
  dim = false,
}: HandCardTileProps) {
  const sz = SIZE_CHROME[size];
  const isLabor = card.type === "labor";
  const subtype = card.subtype as ResourceSubtype | undefined;
  const chrome = isLabor
    ? LABOR_CHROME
    : subtype
      ? RESOURCE_CHROME[subtype]
      : LABOR_CHROME;

  const laborSubtypeLabel =
    card.laborSubtype === "marketing" ? "Marketing" :
    card.laborSubtype === "cooper" ? "Cooper" :
    card.laborSubtype === "architect" ? "Architect" :
    "Labor";
  const baseLabel = isLabor
    ? laborSubtypeLabel
    : subtype
      ? RESOURCE_LABEL[subtype]
      : "Card";
  const glyph = isLabor
    ? laborGlyphFor(card.laborSubtype)
    : subtype
      ? RESOURCE_GLYPH[subtype]
      : "?";

  // Specialty cards get a tier-style ★ badge + an amber dot on the
  // gradient. The displayName ("Superior Rye", "Heritage Cask")
  // already carries the brand; the badge is the at-a-glance signal.
  const isSpecialty = card.specialty === true;
  const count = card.resourceCount ?? 1;
  const showCount = !isLabor && count > 1;

  // Prefer the themed displayName — falls back to the auto-generated
  // subtype label for plain commons that don't carry a brand string.
  const displayName = card.displayName ?? baseLabel;

  const ringByTone = {
    amber: "ring-amber-300",
    emerald: "ring-emerald-300",
    rose: "ring-rose-300",
    sky: "ring-sky-300",
  }[tone];

  const ringClass = selected
    ? `ring-2 ${ringByTone} ring-offset-1 ring-offset-slate-950 shadow-[0_0_18px_rgba(251,191,36,.45)]`
    : interactive
      ? `hover:ring-2 hover:${ringByTone} hover:scale-[1.04] cursor-pointer`
      : "opacity-80 cursor-default";

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      title={displayName}
      style={dim ? { opacity: 0.35, filter: "saturate(0.5)" } : undefined}
      className={[
        "relative flex flex-col items-center justify-center overflow-hidden rounded-md border-2 shadow-[0_4px_10px_rgba(0,0,0,.45)] transition-transform duration-150",
        sz.box,
        chrome.gradient,
        chrome.border,
        isSpecialty ? "ring-1 ring-amber-300/70" : "",
        ringClass,
      ].join(" ")}
    >
      {showCost && card.cost != null ? (
        <span
          className={`absolute left-1 top-1 rounded border border-amber-300/70 bg-slate-950/70 font-mono font-bold text-amber-200 shadow-[0_1px_3px_rgba(0,0,0,.5)] ${sz.costBadge}`}
          aria-label={`cost ${card.cost} rep`}
        >
          ฿{card.cost}
        </span>
      ) : null}

      {isSpecialty ? (
        <span
          className={`absolute right-1 top-1 rounded border border-amber-300/80 bg-amber-700/55 font-mono font-bold text-amber-100 shadow-[0_1px_3px_rgba(0,0,0,.55)] ${sz.starBadge}`}
          title="Specialty"
          aria-label="Specialty"
        >
          ★
        </span>
      ) : null}

      {showCount ? (
        <span
          className={`absolute right-1 bottom-1 rounded border border-white/15 bg-slate-950/70 font-mono font-bold text-slate-100 ${sz.countBadge}`}
          aria-label={`${count} units`}
        >
          ×{count}
        </span>
      ) : null}

      <span className={`${sz.glyph} ${chrome.ink} leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,.45)]`}>
        {glyph}
      </span>
      <span
        className={`line-clamp-2 max-w-[95%] text-center font-display font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,.35)] ${sz.name} ${chrome.ink}`}
      >
        {displayName}
      </span>
      {sz.showFlavor && card.flavor ? (
        <span
          className={`line-clamp-2 max-w-[95%] text-center font-display italic opacity-90 ${sz.flavor} ${chrome.label}`}
        >
          {card.flavor}
        </span>
      ) : null}
      {isSpecialty ? (
        <span className={`font-mono uppercase text-amber-200/85 ${sz.sublabel}`}>
          Specialty
        </span>
      ) : null}
    </button>
  );
}
