"use client";

import type { ResourceKind, Quality } from "@bourbonomics/prototype-engine";

/**
 * Canonical resource-card tile for the prototype, recreated in the
 * live game's card visual language (gradient body, top label, display
 * name, flavor line, circular glyph badge, tier ring). Kept here in
 * apps/prototype so the prototype stays isolated from packages/client.
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
  grain: {
    gradient: "from-[#1e4a44]/95 via-[#123028]/95 to-[#06140f]",
    border: "border-[#4f9c87]",
    glyph: "🌾",
  },
};

const KIND_LABEL: Record<ResourceKind, string> = {
  cask: "Cask",
  corn: "Corn",
  grain: "Grain",
};

const QUALITY_META: Record<
  Quality,
  { stars: number; ring: string; flavor: string; ink: string }
> = {
  common: {
    stars: 0,
    ring: "",
    flavor: "Workaday stock.",
    ink: "text-[var(--t-common)]",
  },
  specialty: {
    stars: 1,
    ring: "ring-1 ring-[var(--t-specialty)]/60",
    flavor: "A cut above the rack.",
    ink: "text-[var(--t-specialty)]",
  },
  heritage: {
    stars: 2,
    ring: "ring-1 ring-[var(--t-heritage)]/70",
    flavor: "Old-world pedigree.",
    ink: "text-[var(--t-heritage)]",
  },
};

const SIZE: Record<
  "sm" | "md" | "lg",
  { box: string; name: string; label: string; glyph: string; flavor: string }
> = {
  sm: {
    box: "h-[120px] w-[86px]",
    name: "text-[13px]",
    label: "text-[8px]",
    glyph: "h-7 w-7 text-[14px]",
    flavor: "text-[8px]",
  },
  md: {
    box: "h-[140px] w-[100px]",
    name: "text-[15px]",
    label: "text-[9px]",
    glyph: "h-8 w-8 text-[16px]",
    flavor: "text-[9px]",
  },
  lg: {
    box: "h-[170px] w-[122px]",
    name: "text-[17px]",
    label: "text-[10px]",
    glyph: "h-9 w-9 text-[18px]",
    flavor: "text-[10px]",
  },
};

export default function CardTile({
  kind,
  quality,
  name,
  flavor,
  count,
  size = "md",
  selected = false,
  interactive = true,
  dim = false,
  onClick,
}: {
  kind: ResourceKind;
  quality: Quality;
  name: string;
  flavor?: string;
  count?: number;
  size?: "sm" | "md" | "lg";
  selected?: boolean;
  interactive?: boolean;
  dim?: boolean;
  onClick?: () => void;
}) {
  const chrome = KIND_CHROME[kind];
  const q = QUALITY_META[quality];
  const s = SIZE[size];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      className={[
        "relative shrink-0 overflow-hidden rounded-md border-2 bg-gradient-to-b p-1.5 text-left transition",
        s.box,
        chrome.gradient,
        chrome.border,
        selected
          ? "ring-2 ring-[var(--gold)] ring-offset-1 ring-offset-[var(--bg)]"
          : q.ring,
        interactive ? "cursor-pointer hover:-translate-y-0.5 hover:brightness-110" : "cursor-default",
        dim ? "opacity-45" : "",
      ].join(" ")}
    >
      {/* top hairline highlight */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/25"
      />

      {/* quality stars (top-right) */}
      {q.stars > 0 ? (
        <span className="absolute right-1 top-1 text-[10px] leading-none text-[var(--gold)]">
          {"★".repeat(q.stars)}
        </span>
      ) : null}

      {/* count (bottom-right) */}
      {count && count > 1 ? (
        <span className="absolute bottom-1 right-1.5 font-mono text-[10px] font-bold text-white/80">
          ×{count}
        </span>
      ) : null}

      <div
        className={`label-sm ${s.label}`}
        style={{ color: "rgba(255,255,255,.65)" }}
      >
        {KIND_LABEL[kind]}
      </div>
      <div
        className={`mt-0.5 line-clamp-2 font-display font-bold leading-tight text-[var(--ink)] ${s.name}`}
      >
        {name}
      </div>
      <div className={`mt-0.5 italic leading-tight text-white/55 ${s.flavor}`}>
        {flavor ?? q.flavor}
      </div>

      {/* circular glyph badge */}
      <div
        className={`absolute bottom-1.5 left-1.5 grid place-items-center rounded-full border-2 border-white/25 bg-white/10 leading-none backdrop-blur ${s.glyph}`}
      >
        <span aria-hidden>{chrome.glyph}</span>
      </div>
    </button>
  );
}
