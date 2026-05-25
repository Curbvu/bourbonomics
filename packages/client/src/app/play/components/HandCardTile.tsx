"use client";

/**
 * Presentational card tile — shared between the Drafting Loop modal,
 * the Buy modal, and any other surface that renders a card. The visual
 * mirrors the in-hand card in HandTray: small uppercase label up top,
 * brand-y display name in the middle, flavor line, and a circular
 * glyph anchored to the bottom edge. Cost goes top-left, ★ top-right
 * for specialty cards, count chip bottom-right when the card stacks.
 *
 * Canonical size is `md` (`h-[140px] w-[100px]`) — the exact size of
 * the in-hand card so a player can't tell a modal-rendered card from
 * the one in their hand at a glance. `sm` and `lg` are scaled
 * variants for tight rails or feature treatments.
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

interface SizeChrome {
  box: string;
  label: string;
  name: string;
  flavor: string;
  glyph: string;
  glyphCircle: string;
  starBadge: string;
  costBadge: string;
  countBadge: string;
}

const SIZE_CHROME: Record<HandCardTileSize, SizeChrome> = {
  sm: {
    box: "h-[120px] w-[86px] p-1",
    label: "text-[11px] tracking-[.14em]",
    name: "text-[12px]",
    flavor: "text-[11px]",
    glyph: "text-[18px]",
    glyphCircle: "h-7 w-7",
    starBadge: "text-[11px] px-1 py-[1px]",
    costBadge: "text-[11px] px-1 py-[1px]",
    countBadge: "text-[11px] px-1",
  },
  md: {
    box: "h-[140px] w-[100px] p-1.5",
    label: "text-[13px] tracking-[.18em]",
    name: "text-[15px]",
    flavor: "text-[11px]",
    glyph: "text-[22px]",
    glyphCircle: "h-9 w-9",
    starBadge: "text-[13px] px-1 py-[1px]",
    costBadge: "text-[12px] px-1.5 py-[1px]",
    countBadge: "text-[12px] px-1.5",
  },
  lg: {
    box: "h-[170px] w-[122px] p-2",
    label: "text-[13px] tracking-[.18em]",
    name: "text-[16px]",
    flavor: "text-[12px]",
    glyph: "text-[26px]",
    glyphCircle: "h-11 w-11",
    starBadge: "text-[14px] px-1.5 py-[2px]",
    costBadge: "text-[12px] px-1.5 py-[1px]",
    countBadge: "text-[12px] px-1.5",
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
  /** Show the rep cost in the top-left corner. */
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
  size = "md",
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
    card.laborSubtype === "marketing"
      ? "Marketing"
      : card.laborSubtype === "cooper"
        ? "Cooper"
        : card.laborSubtype === "architect"
          ? "Architect"
          : "Worker";
  const baseLabel = isLabor
    ? "Labor"
    : subtype
      ? RESOURCE_LABEL[subtype]
      : "Card";
  const displayName =
    card.displayName ?? (isLabor ? laborSubtypeLabel : baseLabel);
  const glyph = isLabor
    ? laborGlyphFor(card.laborSubtype)
    : subtype
      ? RESOURCE_GLYPH[subtype]
      : "?";

  const isSpecialty = card.specialty === true;
  const count = card.resourceCount ?? 1;
  const showCount = !isLabor && count > 1;

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
      : "opacity-90 cursor-default";

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      title={displayName}
      style={dim ? { opacity: 0.35, filter: "saturate(0.5)" } : undefined}
      className={[
        "relative flex flex-shrink-0 flex-col overflow-hidden rounded-md border-2 text-left shadow-[0_4px_12px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-all duration-200",
        sz.box,
        chrome.gradient,
        chrome.border,
        isSpecialty ? "ring-amber-300/70" : "",
        ringClass,
      ].join(" ")}
    >
      {/* Top hairline highlight — same as in-hand cards. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
        aria-hidden
      />

      {showCost && card.cost != null ? (
        <span
          className={`absolute left-1 top-1 z-10 rounded border border-amber-300/70 bg-slate-950/70 font-mono font-bold text-amber-200 shadow-[0_1px_3px_rgba(0,0,0,.5)] ${sz.costBadge}`}
          aria-label={`cost ${card.cost} rep`}
        >
          ฿{card.cost}
        </span>
      ) : null}

      {isSpecialty ? (
        <span
          className={`absolute right-1 top-1 z-10 rounded border border-amber-300/80 bg-amber-700/55 font-mono font-bold text-amber-100 shadow-[0_1px_3px_rgba(0,0,0,.55)] ${sz.starBadge}`}
          title="Specialty"
          aria-label="Specialty"
        >
          ★
        </span>
      ) : null}

      {showCount ? (
        <span
          className={`absolute right-1 bottom-1 z-10 rounded border border-white/15 bg-slate-950/70 font-mono font-bold text-slate-100 ${sz.countBadge}`}
          aria-label={`${count} units`}
        >
          ×{count}
        </span>
      ) : null}

      {/* Top: small uppercase category label. */}
      <div className="flex items-baseline justify-center px-7">
        <span className={`font-semibold uppercase ${sz.label} ${chrome.label}`}>
          {baseLabel}
        </span>
      </div>

      {/* Middle: brand displayName + optional flavor. */}
      <h4
        className={`mt-1 line-clamp-2 px-1 text-center font-display font-bold leading-tight drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${sz.name} ${chrome.ink}`}
      >
        {displayName}
      </h4>
      {card.flavor ? (
        <p
          className={`mt-0.5 line-clamp-2 px-1 text-center font-display italic leading-snug opacity-90 ${sz.flavor} ${chrome.label}`}
        >
          {card.flavor}
        </p>
      ) : null}

      {/* Bottom: circular glyph badge anchored via mt-auto. */}
      <div
        className={`mt-auto grid self-center place-items-center rounded-full border-2 bg-white/10 shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm ${sz.glyphCircle} ${chrome.border} ${chrome.ink}`}
      >
        <span
          className={`${sz.glyph} leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,.45)] ${isLabor ? "font-emoji" : ""}`}
        >
          {glyph}
        </span>
      </div>
    </button>
  );
}
