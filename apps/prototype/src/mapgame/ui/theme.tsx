"use client";

// Bourbonomics: Map Game — shared board theme & canonical assets.
//
// Implements the Asset & Visual Composition Spec on a LIGHT parchment palette:
// design tokens, the shared TagGrid (§1 — 5 fixed 2-2-1 slots, always rendered),
// reward-color mapping (§2), the collector grain gradients (§3), and the SVG
// pieces (pawns / flags). Tiles and bourbon cards share ONE slot model so fit
// reads slot-for-slot.

import { tagColor } from "../engine";
import type { Suit, Tag, TokenType } from "../engine";

// ── design tokens (LIGHT parchment theme) ────────────────────────────
// Keys are stable; the client reads T.oak / T.panel / T.cream / etc. `cream`
// is text-only, so a dark value converts all body copy in one move.
export const T = {
  oak: "#efe6d0", // page / stage base
  oak2: "#e7dcbf", // lifted parchment
  oak3: "#ddceac",
  copper: "#c8791e", // amber liquid accent
  gold: "#c8961f", // accents / rings / badges
  goldSoft: "#8f6510", // heading text (darker for contrast on light)
  cream: "#2c1e0e", // PRIMARY DARK TEXT (only ever used as text)
  cherry: "#7a2318", // deep cherry / rye depth
  paper: "#fffdf7", // light card paper
  plainTile: "#fffef9", // non-reward tile body
  ink: "#241a0e", // text on light tiles / cards
  grey: "#7a7268", // muted labels
  cut: "#c8c0b4", // cut-line / faint frame
  // convenience aliases used across the client
  felt: "#efe6d0",
  feltDeep: "#e1d5b8", // rail gradient bottom
  panel: "#fffdf7", // card face
  panel2: "#f4edda", // inset panels / log
  rail: "#ece2c8", // rail gradient top
  border: "#cbba90",
  line: "#d9cca9",
  muted: "#6f5a34",
  faint: "#93805a",
  red: "#9c3a2e",
  green: "#7a8c3a",
  parchEdge: "#c2ad82",
} as const;

// ── suit colors (§0 canon) ───────────────────────────────────────────
export const SUIT_COLOR: Record<Suit, string> = {
  DISTRIBUTION: "#7a8c3a", // olive
  SALES: "#9c3a2e", // red
  MARKETING: "#c69749", // amber
  BUSINESS_DEV: "#3a4a6b", // blue
  SOURCING: "#5a3e2b", // brown
  DISTILL: "#8a5a2b", // copper-brown
};
export const SUIT_SHORT: Record<Suit, string> = {
  DISTRIBUTION: "DIST",
  SALES: "SALES",
  MARKETING: "MKTG",
  BUSINESS_DEV: "BIZ",
  SOURCING: "SRC",
  DISTILL: "DSTL",
};

// reward color mapping (§2): capital/ANY = gold; token = its suit color.
const REW_CAPITAL = "#b8912e";
export function rewardColor(r: { kind: "CAPITAL" } | { kind: "TOKEN"; token: TokenType }): string {
  if (r.kind === "CAPITAL") return REW_CAPITAL;
  return r.token === "ANY" ? REW_CAPITAL : SUIT_COLOR[r.token];
}
export function rewardLabel(r: { kind: "CAPITAL"; amount: number } | { kind: "TOKEN"; token: TokenType }): string {
  if (r.kind === "CAPITAL") return `+${r.amount} CAPITAL`;
  return r.token === "ANY" ? "+1 ANY TOKEN" : `+1 ${SUIT_SHORT[r.token]}`;
}

// player colors — distinct from suit/tag colors where possible
export const PLAYER_COLOR = ["#e8b84a", "#c8552e", "#4a8a72", "#4a6ea8", "#9a5aa0"];

// grain tint for collector-card art (§3): rye redder, wheat golder, trad amber
export function grainTint(tags: readonly Tag[]): { a: string; b: string } {
  const g = tags.find((t) => t.kind === "GRAIN")?.value;
  if (g === "RYE") return { a: "#8a3418", b: "#2c1006" };
  if (g === "WHEAT") return { a: "#7a6a1e", b: "#2e2608" };
  return { a: "#6f5620", b: "#281c0a" }; // traditional / none
}

export const SERIF = "var(--font-cormorant), Georgia, serif";
export const SANS = "var(--font-inter), system-ui, sans-serif";
export const MONO = "var(--font-jb), ui-monospace, monospace";

// ── §1 the shared slot model ─────────────────────────────────────────
export type SlotKey = "GRAIN" | "BATCH" | "BONDED" | "AGE" | "PREMIUM";
export interface Slot {
  glyph: string;
  color: string;
}
/** Map a tag bag onto the 5 fixed slots (null = empty). Doubled grain → "Rx2". */
export function tagSlots(tags: readonly Tag[]): Record<SlotKey, Slot | null> {
  const grains = tags.filter((t) => t.kind === "GRAIN");
  const anyGrain = tags.find((t) => t.kind === "WILD" && t.value === "ANYGRAIN");
  const batch = tags.find((t) => t.kind === "BATCH");
  const anyBatch = tags.find((t) => t.kind === "WILD" && t.value === "ANYBATCH");
  const bonded = tags.find((t) => t.kind === "QUALITY" && t.value === "BONDED");
  const age = tags.find((t) => t.kind === "AGE");
  const premium = tags.find((t) => t.kind === "QUALITY" && t.value === "PREMIUM");
  return {
    // A tile wildcard (ANYGRAIN / ANYBATCH) renders as ★ in its slot (brief §3).
    GRAIN: grains.length
      ? { glyph: grains[0]!.value[0]! + (grains.length > 1 ? `x${grains.length}` : ""), color: tagColor(grains[0]!) }
      : anyGrain
        ? { glyph: "★", color: tagColor(anyGrain) }
        : null,
    BATCH: batch
      ? { glyph: batch.value === "SINGLE_BARREL" ? "1B" : "SB", color: tagColor(batch) }
      : anyBatch
        ? { glyph: "★", color: tagColor(anyBatch) }
        : null,
    BONDED: bonded ? { glyph: "B", color: tagColor(bonded) } : null,
    AGE: age ? { glyph: String(age.value), color: tagColor(age) } : null,
    PREMIUM: premium ? { glyph: "P", color: tagColor(premium) } : null,
  };
}
/** Compact single-tag glyph (R/W/T, 1B/SB, B, n, P, ★) — for tight rows. */
export function tagGlyph(tag: Tag): string {
  switch (tag.kind) {
    case "GRAIN":
      return tag.value[0]!;
    case "BATCH":
      return tag.value === "SINGLE_BARREL" ? "1B" : "SB";
    case "QUALITY":
      return tag.value === "BONDED" ? "B" : "P";
    case "AGE":
      return String(tag.value);
    case "WILD":
      return "★";
  }
}

const SLOT_SUBLABEL: Record<SlotKey, string> = { GRAIN: "GRAIN", BATCH: "BATCH", BONDED: "BONDED", AGE: "AGE", PREMIUM: "PREM" };
// 2-2-1 layout positions in grid units (col, row); PREMIUM centered on row 2.
const SLOT_POS: Record<SlotKey, [number, number]> = {
  GRAIN: [0, 0],
  BATCH: [1, 0],
  BONDED: [0, 1],
  AGE: [1, 1],
  PREMIUM: [0.5, 2],
};

// ── §1 TagGrid — SVG (for tiles) ─────────────────────────────────────
/** Render the 5-slot 2-2-1 grid centered at (cx, cy) as SVG. Cell = chip size. */
export function TagGridSVG({ tags, cx, cy, cell = 14, sub = false }: { tags: readonly Tag[]; cx: number; cy: number; cell?: number; sub?: boolean }) {
  const slots = tagSlots(tags);
  const gap = cell * 0.26;
  const rowH = cell + gap + (sub ? cell * 0.5 : 0);
  const colW = cell + gap;
  // center the 2-wide rows: columns at cx ± colW/2
  const originX = cx - colW / 2;
  const originY = cy - rowH; // row 0 above center
  return (
    <g>
      {(Object.keys(SLOT_POS) as SlotKey[]).map((k) => {
        const [col, row] = SLOT_POS[k];
        const x = originX + col * colW;
        const y = originY + row * rowH;
        const s = slots[k];
        return <SlotSVG key={k} x={x} y={y} cell={cell} slot={s} sub={sub ? SLOT_SUBLABEL[k] : undefined} />;
      })}
    </g>
  );
}

function SlotSVG({ x, y, cell, slot, sub }: { x: number; y: number; cell: number; slot: Slot | null; sub?: string }) {
  const r = cell * 0.26;
  const h = cell / 2;
  return (
    <g transform={`translate(${x} ${y})`}>
      {slot ? (
        <>
          {/* drop shadow → the tag reads as a raised token */}
          <rect x={-h} y={-h + 1.3} width={cell} height={cell} rx={r} fill="#00000038" />
          <rect x={-h} y={-h} width={cell} height={cell} rx={r} fill={slot.color} />
          {/* top sheen + inner rim for depth */}
          <rect x={-h} y={-h} width={cell} height={cell * 0.52} rx={r} fill="#ffffff" opacity={0.2} />
          <rect x={-h + 0.6} y={-h + 0.6} width={cell - 1.2} height={cell - 1.2} rx={r - 0.6} fill="none" stroke="#00000045" strokeWidth={0.8} />
          <text y={cell * 0.2} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={slot.glyph.length > 1 ? cell * 0.48 : cell * 0.6} fill="#fff" style={{ paintOrder: "stroke" } as React.CSSProperties} stroke="#00000030" strokeWidth={0.5}>
            {slot.glyph}
          </text>
        </>
      ) : (
        // empty slot — a faint recessed square (no dash), so filled tags pop
        <rect x={-h} y={-h} width={cell} height={cell} rx={r} fill="#00000009" stroke={T.cut} strokeOpacity={0.45} strokeWidth={0.9} strokeDasharray="2.2 2.4" />
      )}
      {sub && <text y={cell * 0.62 + cell * 0.28} textAnchor="middle" fontFamily={MONO} fontSize={cell * 0.3} letterSpacing={0.3} fill={slot ? slot.color : T.grey}>{sub}</text>}
    </g>
  );
}

// ── §1 TagGrid — HTML (for cards) ────────────────────────────────────
export function TagGridHTML({ tags, cell = 26 }: { tags: readonly Tag[]; cell?: number }) {
  const slots = tagSlots(tags);
  const box = (k: SlotKey) => {
    const s = slots[k];
    return (
      <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
        <div style={{ width: cell, height: cell, borderRadius: cell * 0.18, background: s ? s.color : "transparent", border: s ? "1px solid #00000033" : `1px dashed ${T.cut}`, display: "grid", placeItems: "center", fontFamily: SERIF, fontWeight: 700, fontSize: s && s.glyph.length > 1 ? cell * 0.46 : cell * 0.56, color: s ? "#fff" : T.cut }}>
          {s ? s.glyph : "–"}
        </div>
        <span style={{ fontFamily: MONO, fontSize: cell * 0.26, letterSpacing: 0.4, color: s ? s.color : T.grey }}>{SLOT_SUBLABEL[k]}</span>
      </div>
    );
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
      <div style={{ display: "flex", gap: 8 }}>{box("GRAIN")}{box("BATCH")}</div>
      <div style={{ display: "flex", gap: 8 }}>{box("BONDED")}{box("AGE")}</div>
      <div>{box("PREMIUM")}</div>
    </div>
  );
}

// ── SVG pieces ───────────────────────────────────────────────────────
/** Lighten a #rrggbb toward white by fraction f (for pawn gradient tops). */
function lighten(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) + (255 - ((n >> 16) & 255)) * f);
  const g = Math.round(((n >> 8) & 255) + (255 - ((n >> 8) & 255)) * f);
  const b = Math.round((n & 255) + (255 - (n & 255)) * f);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** A standing Distribution Point pawn (a meeple), filled from a per-player radial
 *  gradient. Live = upright; dark = toppled + faded. */
export function Pawn({ x, y, color, dead = false, s = 1 }: { x: number; y: number; color: string; dead?: boolean; s?: number }) {
  const c = dead ? "#8a7a5e" : color;
  const gid = `pawn-${c.replace("#", "")}${dead ? "-d" : ""}`;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) ${dead ? "rotate(78)" : ""}`} opacity={dead ? 0.72 : 1}>
      <defs>
        <radialGradient id={gid} cx="0.38" cy="0.28" r="0.85">
          <stop offset="0" stopColor={lighten(c, 0.42)} />
          <stop offset="1" stopColor={c} />
        </radialGradient>
      </defs>
      <ellipse cx={0} cy={11} rx={9} ry={3} fill="#00000038" />
      <circle cx={0} cy={-10} r={5.4} fill={`url(#${gid})`} stroke="#00000030" strokeWidth={0.6} />
      <path d="M -6.2 9 Q -6.2 -2 0 -3.4 Q 6.2 -2 6.2 9 Z" fill={`url(#${gid})`} stroke="#00000030" strokeWidth={0.6} />
      <rect x={-8} y={8.5} width={16} height={3.4} rx={1.7} fill={`url(#${gid})`} />
      {!dead && <circle cx={-1.7} cy={-11.4} r={1.7} fill="#ffffff88" />}
    </g>
  );
}

/** A niche-claim pennant flag. */
export function Flag({ x, y, color, h = 20 }: { x: number; y: number; color: string; h?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-1} y={-h} width={2} height={h + 4} rx={1} fill="#2a1c0e" />
      <path d={`M 1 ${-h} L ${13} ${-h + 5} L 1 ${-h + 10} Z`} fill={color} stroke="#00000030" strokeWidth={0.5} />
    </g>
  );
}
