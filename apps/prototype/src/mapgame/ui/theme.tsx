"use client";

// Bourbonomics: Map Game — shared board theme & canonical assets.
//
// Implements the Asset & Visual Composition Spec: §0 design tokens, the shared
// TagGrid (§1 — 5 fixed 2-2-1 slots, always rendered), reward-color mapping
// (§2), the collector grain gradients (§3), and the SVG pieces (pawns/flags/
// chips). Tiles and bourbon cards share ONE slot model so fit reads slot-for-
// slot.

import { tagColor } from "../engine";
import type { Suit, Tag, TokenType } from "../engine";

// ── §0 design tokens ─────────────────────────────────────────────────
export const T = {
  oak: "#160d05", // charred oak, near-black base/frame
  oak2: "#241611", // lifted oak (panels)
  oak3: "#2c1c12",
  copper: "#c8791e", // amber liquid accent
  gold: "#e8b84a", // aged gold / foil
  goldSoft: "#b8912e",
  cream: "#f0e4cc", // label cream (text on dark)
  cherry: "#7a2318", // deep cherry / rye depth
  paper: "#faf6f0", // light card paper
  plainTile: "#fbf9f5", // non-reward tile body
  ink: "#211a13", // near-black text on light
  grey: "#7a7268", // muted labels
  cut: "#c8c0b4", // cut-line / faint frame
  // convenience aliases used across the client
  felt: "#160d05",
  feltDeep: "#0e0803",
  panel: "#241611",
  panel2: "#2c1c12",
  rail: "#1c1109",
  border: "#4a3a24",
  line: "#3a2a1a",
  muted: "#a5926a",
  faint: "#7a6a48",
  red: "#9c3a2e",
  green: "#7a8c3a",
  parchEdge: "#ccbf9a",
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
  const batch = tags.find((t) => t.kind === "BATCH");
  const bonded = tags.find((t) => t.kind === "QUALITY" && t.value === "BONDED");
  const age = tags.find((t) => t.kind === "AGE");
  const premium = tags.find((t) => t.kind === "QUALITY" && t.value === "PREMIUM");
  return {
    GRAIN: grains.length
      ? { glyph: grains[0]!.value[0]! + (grains.length > 1 ? `x${grains.length}` : ""), color: tagColor(grains[0]!) }
      : null,
    BATCH: batch ? { glyph: batch.value === "SINGLE_BARREL" ? "1B" : "SB", color: tagColor(batch) } : null,
    BONDED: bonded ? { glyph: "B", color: tagColor(bonded) } : null,
    AGE: age ? { glyph: String(age.value), color: tagColor(age) } : null,
    PREMIUM: premium ? { glyph: "P", color: tagColor(premium) } : null,
  };
}
/** Compact single-tag glyph (R/W/T, 1B/SB, B, n, P) — for tight rows. */
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
  const r = cell * 0.18;
  return (
    <g transform={`translate(${x} ${y})`}>
      {slot ? (
        <>
          <rect x={-cell / 2} y={-cell / 2} width={cell} height={cell} rx={r} fill={slot.color} />
          <rect x={-cell / 2 + cell * 0.06} y={-cell / 2 + cell * 0.06} width={cell * 0.88} height={cell * 0.88} rx={r} fill="none" stroke="#00000033" strokeWidth={0.8} />
          <text y={cell * 0.19} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={slot.glyph.length > 1 ? cell * 0.5 : cell * 0.62} fill="#fff">
            {slot.glyph}
          </text>
        </>
      ) : (
        <>
          <rect x={-cell / 2} y={-cell / 2} width={cell} height={cell} rx={r} fill="none" stroke={T.cut} strokeWidth={0.9} strokeDasharray="2 2" />
          <text y={cell * 0.18} textAnchor="middle" fontFamily={SERIF} fontSize={cell * 0.5} fill={T.cut}>–</text>
        </>
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
/** A Distribution Point pawn. Live = upright; dark = tipped + faded. */
export function Pawn({ x, y, color, dead = false, s = 1 }: { x: number; y: number; color: string; dead?: boolean; s?: number }) {
  const c = dead ? "#8a7a5e" : color;
  return (
    <g transform={`translate(${x} ${y}) scale(${s}) ${dead ? "rotate(66)" : ""}`} opacity={dead ? 0.78 : 1}>
      <ellipse cx={0} cy={11} rx={9} ry={3} fill="#00000038" />
      <circle cx={0} cy={-10} r={5.4} fill={c} />
      <path d="M -6.2 9 Q -6.2 -2 0 -3.4 Q 6.2 -2 6.2 9 Z" fill={c} />
      <rect x={-8} y={8.5} width={16} height={3.4} rx={1.7} fill={c} />
      {!dead && <circle cx={-1.7} cy={-11.4} r={1.7} fill="#ffffff66" />}
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

/** A small reward chip / token (poker-chip look). */
export function Chip({ x, y, r = 13, color, label }: { x: number; y: number; r?: number; color: string; label: string }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={r} fill={color} stroke="#00000044" strokeWidth={1} />
      <circle r={r - 3} fill="none" stroke="#ffffff55" strokeWidth={1} strokeDasharray="2 3" />
      <text y={r * 0.3} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={r * 0.9} fill="#fff">{label}</text>
    </g>
  );
}
