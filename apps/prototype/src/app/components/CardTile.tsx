"use client";

import type React from "react";

import type { ResourceKind, Quality } from "@bourbonomics/prototype-engine";

/**
 * Canonical resource-card tile for the prototype, recreated in the
 * live game's HandCardTile visual language: a portrait card with a
 * small uppercase category label up top, a brand-y display name in the
 * middle, an italic flavor line, and a circular glyph badge anchored to
 * the bottom edge. Cost goes top-left, quality ★ top-right, count chip
 * bottom-right. Kept here in apps/prototype so the prototype stays
 * isolated from packages/client.
 *
 * Canonical in-hand size is `lg` (130×180) — the exact fan-card size so
 * a player can't tell a tray-rendered card from one in their hand.
 */

type Tone = {
  gradient: string;
  border: string;
  glyph: string;
};

const KIND_CHROME: Record<ResourceKind, Tone> = {
  cask: {
    gradient: "from-[#6b4423]/95 via-[#3d2417]/95 to-[#1a0f06]",
    border: "border-[#a07142]",
    glyph: "🛢",
  },
  corn: {
    gradient: "from-[#7a5a1e]/95 via-[#4a3410]/95 to-[#1d1306]",
    border: "border-[#d6a94a]",
    glyph: "🌽",
  },
  rye: {
    gradient: "from-[#6e3a1c]/95 via-[#43230f]/95 to-[#1a0d05]",
    border: "border-[#c07a3c]",
    glyph: "🌾",
  },
  wheat: {
    gradient: "from-[#6f6320]/95 via-[#403a12]/95 to-[#191606]",
    border: "border-[#ccb84e]",
    glyph: "🌾",
  },
  barley: {
    gradient: "from-[#1e4a44]/95 via-[#123028]/95 to-[#06140f]",
    border: "border-[#4f9c87]",
    glyph: "🌾",
  },
};

const KIND_LABEL: Record<ResourceKind, string> = {
  cask: "Cask",
  corn: "Corn",
  rye: "Rye",
  wheat: "Wheat",
  barley: "Barley",
};

const QUALITY_META: Record<
  Quality,
  { stars: number; flavor: string; label: string }
> = {
  common: { stars: 0, flavor: "Workaday stock.", label: "text-white/65" },
  specialty: {
    stars: 1,
    flavor: "A cut above the rack.",
    label: "text-[var(--t-specialty)]",
  },
  heritage: {
    stars: 2,
    flavor: "Old-world pedigree.",
    label: "text-[var(--t-heritage)]",
  },
};

const SIZE: Record<
  "sm" | "md" | "lg",
  {
    box: string;
    label: string;
    name: string;
    flavor: string;
    glyph: string;
    glyphCircle: string;
    badge: string;
  }
> = {
  sm: {
    box: "h-[120px] w-[86px] p-1",
    label: "text-[11px] tracking-[.14em]",
    name: "text-[12px]",
    flavor: "text-[10px]",
    glyph: "text-[18px]",
    glyphCircle: "h-7 w-7",
    badge: "text-[10px] px-1 py-[1px]",
  },
  md: {
    box: "h-[140px] w-[100px] p-1.5",
    label: "text-[12px] tracking-[.16em]",
    name: "text-[14px]",
    flavor: "text-[10px]",
    glyph: "text-[20px]",
    glyphCircle: "h-9 w-9",
    badge: "text-[11px] px-1 py-[1px]",
  },
  lg: {
    box: "h-[180px] w-[130px] p-2",
    label: "text-[13px] tracking-[.18em]",
    name: "text-[16px]",
    flavor: "text-[12px]",
    glyph: "text-[24px]",
    glyphCircle: "h-11 w-11",
    badge: "text-[12px] px-1.5 py-[1px]",
  },
};

export default function CardTile({
  kind,
  quality,
  name,
  flavor,
  count,
  cost,
  size = "md",
  selected = false,
  interactive = true,
  dim = false,
  onClick,
  draggable = false,
  onDragStart,
  onDragEnd,
}: {
  kind: ResourceKind;
  quality: Quality;
  name: string;
  flavor?: string;
  count?: number;
  cost?: number;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  interactive?: boolean;
  dim?: boolean;
  onClick?: () => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}) {
  const chrome = KIND_CHROME[kind];
  const q = QUALITY_META[quality];
  const s = SIZE[size];
  const showCount = count != null && count > 1;

  return (
    <button
      type="button"
      onClick={interactive ? onClick : undefined}
      disabled={!interactive}
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      title={name}
      style={
        dim
          ? { opacity: 0.4, filter: "brightness(0.5) saturate(0.55)" }
          : undefined
      }
      className={[
        "relative flex flex-shrink-0 flex-col overflow-hidden rounded-md border-2 bg-gradient-to-b text-left shadow-[0_4px_12px_rgba(0,0,0,.4)] ring-1 ring-white/10 transition-all duration-200",
        s.box,
        chrome.gradient,
        chrome.border,
        selected
          ? "z-20 -translate-y-1.5 scale-[1.05] brightness-110 saturate-150 ring-2 ring-amber-300 ring-offset-2 ring-offset-slate-950 shadow-[0_10px_26px_rgba(251,191,36,.6)]"
          : interactive
            ? "cursor-pointer hover:ring-2 hover:ring-amber-300 hover:scale-[1.04]"
            : "cursor-default opacity-90",
      ].join(" ")}
    >
      {/* top hairline highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent"
      />

      {cost != null ? (
        <span
          className={`absolute left-1 top-1 z-10 rounded border border-amber-300/70 bg-slate-950/70 font-mono font-bold text-amber-200 shadow-[0_1px_3px_rgba(0,0,0,.5)] ${s.badge}`}
        >
          ฿{cost}
        </span>
      ) : null}

      {q.stars > 0 ? (
        <span
          className={`absolute right-1 top-1 z-10 rounded border border-amber-300/80 bg-amber-700/55 font-mono font-bold leading-none text-amber-100 shadow-[0_1px_3px_rgba(0,0,0,.55)] ${s.badge}`}
          title={quality}
        >
          {"★".repeat(q.stars)}
        </span>
      ) : null}

      {showCount ? (
        <span
          className={`absolute bottom-1 right-1 z-10 rounded border border-white/15 bg-slate-950/70 font-mono font-bold text-slate-100 ${s.badge}`}
        >
          ×{count}
        </span>
      ) : null}

      {/* top: small uppercase category label */}
      <div className="flex items-baseline justify-center px-6">
        <span className={`font-semibold uppercase ${s.label} ${q.label}`}>
          {KIND_LABEL[kind]}
        </span>
      </div>

      {/* middle: brand display name + flavor */}
      <h4
        className={`mt-1 line-clamp-2 px-1 text-center font-display font-bold leading-tight text-[var(--ink)] drop-shadow-[0_1px_4px_rgba(0,0,0,.35)] ${s.name}`}
      >
        {name}
      </h4>
      <p
        className={`mt-0.5 line-clamp-2 px-1 text-center font-display italic leading-snug text-white/60 ${s.flavor}`}
      >
        {flavor ?? q.flavor}
      </p>

      {/* bottom: circular glyph badge */}
      <div
        className={`mt-auto grid place-items-center self-center rounded-full border-2 bg-white/10 shadow-[inset_0_1px_4px_rgba(255,255,255,.15)] backdrop-blur-sm ${s.glyphCircle} ${chrome.border}`}
      >
        <span
          aria-hidden
          className={`leading-none drop-shadow-[0_2px_4px_rgba(0,0,0,.45)] ${s.glyph}`}
        >
          {chrome.glyph}
        </span>
      </div>
    </button>
  );
}
