"use client";

// Bourbonomics — "Spotlight" board. A 3-zone layout (At the Table · Center Stage
// · The Market) over a full-width Table Log. The CENTER STAGE is the only thing
// that morphs per phase; the rails stay quiet and persistent. The headline is the
// turn-clarity system: a live player ticker, a spectator narration stage on rival
// turns (no more silent lock), and a shared Table Log. Warm parchment palette.
// Wired to the engine (applyAction / botAction / isBotTurn / game.log).

import { useEffect, useRef, useState } from "react";
import {
  applyAction,
  botAction,
  isBotTurn,
  createGame,
  improvementCost,
  barrelValue,
  zoneForCardCount,
  zoneMultiplier,
  capAge,
  meetsRequirement,
  reputationOf,
  rickhouseCapacity as fnRick,
  supplyCap as fnSupply,
  warehouseCap as fnWarehouse,
  mashFloorDraw as fnMash,
  hasUlt,
  CONFIG,
} from "@bourbonomics/prototype-engine";
import type {
  Action,
  Bourbon,
  DemandCard,
  Department,
  DepartmentId,
  DieFace,
  GameState,
  Player,
  Quality,
  ResourceCard,
  ResourceKind,
  StyleTag,
  UltimateId,
  Zone,
} from "@bourbonomics/prototype-engine";

// The fields the bill-inspect modal reads — satisfied by both a MashBill and a
// built/resting Bourbon, so either can be inspected.
type BillLike = {
  name: string;
  styleTag: StyleTag;
  tags: StyleTag[];
  recipe: Partial<Record<ResourceKind, number>>;
  batchQtyBias: number;
  slogan?: string;
};
type Inspect =
  | { kind: "resource"; card: ResourceCard }
  | { kind: "pending"; k: ResourceKind }
  | { kind: "bill"; bill: BillLike };
import ScalingHost from "./components/ScalingHost";
import { TUT_BEATS, TutorialOverlay, tutorialGame } from "./tutorial";

// ── tokens (warm parchment "tasting-room daylight") ──────────────────
const MONO = "'JetBrains Mono', monospace";
const SERIF = "'Cormorant Garamond', serif";
const C = {
  // ink ladder (dark → ghost) over the light board
  ink: "#2a1a0e",
  text2: "#6f5c45",
  muted: "#9a8568",
  faint: "#bcae90",
  // accents
  gold: "#b07d28", // brass — Capital
  brass: "#a06f22",
  copper: "#b5793a",
  prestige: "#8a5fb0",
  green: "#3e7d59", // emerald — done / positive
  red: "#c0492c", // hot / crash
  amber: "#cf8a33",
  // structure
  border: "#d9c8a8",
  border2: "#e0d2b5",
  hairline: "#ece2cf",
};

// Surfaces + the §4 depth recipe (light panels, soft warm shadows).
const SURFACE = {
  panel: "linear-gradient(180deg,#fffdf8,#f6eedd)",
  rail: "#fbf7ee",
  inset: "#f3ebdb",
  insetGrad: "linear-gradient(180deg,#f5eede,#ece2cf)",
};
const PANEL_SHADOW = "inset 0 1px 0 rgba(255,255,255,.7), 0 10px 26px rgba(120,90,50,.10)";
const CARD_SHADOW = "inset 0 1px 0 rgba(255,255,255,.6), 0 6px 16px rgba(120,90,50,.10)";
// Primary CTA — amber.
const PRIMARY = "linear-gradient(180deg,#cf8a33,#a3531f)";
const PRIMARY_INK = "#fff7ea";
const PRIMARY_SHADOW = "inset 0 1px 0 rgba(255,255,255,.35), 0 8px 20px rgba(163,83,31,.28)";
// Page letterbox — a flat creme that matches the parchment canvas, so the
// pillarbox/letterbox blends seamlessly with the board (no dark edges).
const PAGE_BG = "#ece2cf";

const FACE: Record<DieFace, { mono: string; label: string; color: string; wild?: boolean }> = {
  cask: { mono: "CK", label: "Cask", color: "#cf9a5e" },
  corn: { mono: "CN", label: "Corn", color: "#e0a82f" },
  rye: { mono: "RY", label: "Rye", color: "#d96b54" },
  // Wheat stays cyan (matching its card chrome) so it doesn't read as gold-corn.
  wheat: { mono: "WH", label: "Wheat", color: "#5ab6cf" },
  barley: { mono: "BA", label: "Barley", color: "#56a87c" },
  anything: { mono: "✦", label: "Any", color: "#caa86a", wild: true },
};
const PILE_ORDER: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];
const SUB: Record<ResourceKind, { ink: string; glyph: string; label: string }> = {
  cask: { ink: "#8a5a25", glyph: "⌬", label: "Cask" },
  corn: { ink: "#8a6212", glyph: "✺", label: "Corn" },
  rye: { ink: "#9a3c1d", glyph: "✸", label: "Rye" },
  wheat: { ink: "#2c6c80", glyph: "❉", label: "Wheat" },
  barley: { ink: "#2c5d40", glyph: "❦", label: "Barley" },
};

// Resource icon art (white silhouettes in /public) — rendered as TINTED MASKS.
const RESOURCE_ICON: Partial<Record<ResourceKind, string>> = {
  corn: "/icons8-corn-90.png",
  rye: "/icons8-rye-90.png",
  wheat: "/icons8-flour-90.png",
  barley: "/icons8-barley-90.png",
};

/** A resource's mark at `size` px tinted `color`: the icon mask where one exists, else the glyph. */
function resMark(kind: ResourceKind, size: number, color: string): React.ReactNode {
  const icon = RESOURCE_ICON[kind];
  if (!icon) return <span style={{ fontSize: size, lineHeight: 1, color }}>{SUB[kind].glyph}</span>;
  const mask = `url(${icon}) center / contain no-repeat`;
  return <span aria-hidden style={{ display: "inline-block", width: size, height: size, background: color, WebkitMask: mask, mask }} />;
}

// Per-resource card chrome — light tinted tiles with a colored ink (legible on parchment).
const KIND_CHROME: Record<ResourceKind, { grad: string; border: string; ink: string }> = {
  cask: { grad: "linear-gradient(180deg,#f3e6d3,#fffdf8)", border: "#b5793a", ink: "#7a4d1e" },
  corn: { grad: "linear-gradient(180deg,#f8edcb,#fffdf8)", border: "#c8922f", ink: "#8a6212" },
  rye: { grad: "linear-gradient(180deg,#f4dccf,#fffdf8)", border: "#b04e2a", ink: "#8a3a1c" },
  wheat: { grad: "linear-gradient(180deg,#dceef3,#fffdf8)", border: "#5ab6cf", ink: "#2c6678" },
  barley: { grad: "linear-gradient(180deg,#dcefe2,#fffdf8)", border: "#3e7d59", ink: "#2c5d40" },
};

const STYLE_LABEL: Record<StyleTag, string> = {
  rye: "High-Rye",
  wheat: "Wheated",
  barley: "Barley",
  highCorn: "High-Corn",
  fourGrain: "Four-Grain",
  classic: "Classic",
};

// Per-style tag chrome — `border` is the pill fill (dark ink on the saturated pill).
const STYLE_CHROME: Record<StyleTag, { border: string; ink: string }> = {
  classic: { border: "#4a7fb0", ink: "#0e1a24" },
  highCorn: { border: "#a8862c", ink: "#1c1606" },
  rye: { border: "#b04e2a", ink: "#1e0c06" },
  wheat: { border: "#4a93a8", ink: "#08181c" },
  fourGrain: { border: "#8a5fb0", ink: "#160c20" },
  barley: { border: "#3e7d59", ink: "#0a1610" },
};

const ZONE_META: Record<Zone, { label: string; color: string }> = {
  low: { label: "Low", color: C.green },
  mid: { label: "Mid", color: C.amber },
  high: { label: "Hot", color: C.red },
};

// Rival playback pace — "Rival pace" tweak (maps to the AI driver delay).
type AiSpeed = "slow" | "normal" | "fast";
const AI_SPEEDS: Record<AiSpeed, { label: string; mult: number }> = {
  fast: { label: "Brisk", mult: 0.4 },
  normal: { label: "Relaxed", mult: 1 },
  slow: { label: "Cinematic", mult: 1.9 },
};
const AI_SPEED_ORDER: AiSpeed[] = ["fast", "normal", "slow"];

// Per-quality chrome — the WoW-style five-tier ladder (grey→orange), light cards.
const QUALITY_CHROME: Record<string, { ink: string; label: string; border: string; bg: string; glow: string; foil: string }> = {
  common: {
    ink: "#7c6f52", label: "Common", border: "rgba(154,138,108,.6)",
    bg: "linear-gradient(180deg,#fffdf8,#f0e7d4)",
    glow: CARD_SHADOW,
    foil: "linear-gradient(180deg,#cdc3ad,#9a8a6c)",
  },
  uncommon: {
    ink: "#3e7d59", label: "Uncommon", border: "rgba(79,138,94,.65)",
    bg: "radial-gradient(115% 70% at 50% -12%, rgba(79,138,94,.18), transparent 60%), linear-gradient(180deg,#fbfdf9,#edf4ea)",
    glow: "inset 0 1px 0 rgba(255,255,255,.6), 0 0 14px rgba(79,138,94,.18), 0 6px 16px rgba(120,90,50,.10)",
    foil: "linear-gradient(180deg,#7bbf93,#4f8a5e)",
  },
  rare: {
    ink: "#4a7fb0", label: "Rare", border: "rgba(74,127,176,.7)",
    bg: "radial-gradient(115% 70% at 50% -12%, rgba(74,127,176,.18), transparent 60%), linear-gradient(180deg,#fafcff,#e9f0f7)",
    glow: "inset 0 1px 0 rgba(255,255,255,.6), 0 0 16px rgba(74,127,176,.22), 0 6px 16px rgba(120,90,50,.10)",
    foil: "linear-gradient(180deg,#9bc1ea,#4a7fb0)",
  },
  epic: {
    ink: "#8a5fb0", label: "Epic", border: "rgba(138,95,176,.72)",
    bg: "radial-gradient(120% 74% at 50% -12%, rgba(138,95,176,.2), transparent 60%), linear-gradient(180deg,#fdfbff,#efe8f6)",
    glow: "inset 0 1px 0 rgba(255,255,255,.6), 0 0 18px rgba(138,95,176,.26), 0 6px 16px rgba(120,90,50,.10)",
    foil: "linear-gradient(180deg,#c3a0e6,#8a5fb0)",
  },
  legendary: {
    ink: "#b9701f", label: "Legendary", border: "rgba(196,122,44,.85)",
    bg: "radial-gradient(125% 78% at 50% -12%, rgba(196,122,44,.26), transparent 62%), linear-gradient(180deg,#fffdf6,#f6e9cf)",
    glow: "inset 0 1px 0 rgba(255,255,255,.65), 0 0 22px rgba(196,122,44,.34), 0 6px 18px rgba(120,90,50,.12)",
    foil: "linear-gradient(180deg,#e7ab53,#c47a2c)",
  },
};

const ULT_LABEL: Record<UltimateId, { name: string; blurb: string }> = {
  megaExpansion: { name: "Mega Expansion", blurb: "+2 barrel slots." },
  climateControlled: { name: "Climate Controlled", blurb: "Your oldest barrel ages +2/round." },
  charToast: { name: "Char & Toast", blurb: "Every barrel you build starts at age 1." },
  doubleMaturation: { name: "Double Maturation", blurb: "A barrel reaching age 8 gains +1 batch." },
  warehouseTasting: { name: "Warehouse Tasting", blurb: "With 3+ aging barrels, +1 Capital/round." },
  secondReroll: { name: "Second Reroll", blurb: "Reroll a second time each Collect turn." },
  overflowRoll: { name: "Overflow Roll", blurb: "+2 dice in Collect." },
  prospector: { name: "Prospector", blurb: "Claims from a chosen pile draw 2, keep the better." },
  tripleThreat: { name: "Triple Threat", blurb: "Once/turn, discard 2 dice → take 1 of any face." },
  grandWarehouse: { name: "Grand Warehouse", blurb: "+3 hold cap." },
  qualitySort: { name: "Quality Sort", blurb: "Once/round, a free blind draw from any pile." },
  longCellar: { name: "Long Cellar", blurb: "Staged cards stay swappable (not locked)." },
  masterRecipe: { name: "Master Recipe", blurb: "+1 mash bill revealed each Draw." },
  houseBlend: { name: "House Blend", blurb: "One recipe slot accepts any resource at build." },
  openBill: { name: "Open Bill", blurb: "One extra Draw Mash Bills each round." },
  privateCard: { name: "Private Demand Card", blurb: "A personal order outside the zone/crash count, paid at the current zone." },
  ph: { name: "Ultimate (TBD)", blurb: "Ultimate menu for this branch is a placeholder." },
};

// Department UI metadata (engine ids → design room presentation).
const DEPT_META: Record<DepartmentId, { color: string; tag: string; name: string }> = {
  rickhouse: { color: "#b5793a", tag: "Aging", name: "The Rickhouse" },
  supply: { color: "#c4772a", tag: "Supply", name: "Supply Room" },
  warehouse: { color: "#3e7d59", tag: "Warehouse", name: "The Warehouse" },
  mashFloor: { color: "#7d8fd4", tag: "Recipes", name: "Mash Floor" },
  marketing: { color: "#b08fd8", tag: "Shape Demand", name: "Marketing Dept." },
};
// Single-letter badge per department (colour disambiguates the two M's).
const DEPT_LETTER: Record<DepartmentId, string> = { rickhouse: "R", supply: "S", warehouse: "W", mashFloor: "M", marketing: "M" };
// Room-style category label + the unit each level value is measured in.
const DEPT_ROOM: Record<DepartmentId, string> = {
  supply: "RM 01 · Procurement", warehouse: "RM 02 · Inventory", mashFloor: "RM 03 · Production", marketing: "RM 04 · Sales & Mktg", rickhouse: "RM 05 · Operations",
};
const DEPT_UNIT: Record<DepartmentId, string> = { supply: "dice", warehouse: "hold", mashFloor: "bills", marketing: "demand", rickhouse: "slots" };
const ROMAN = ["I", "II", "III", "IV", "V"];

const PLAYER_COLORS = ["#c4772a", "#c0492c", "#3e7d59", "#8a5fb0", "#5fa6c9", "#b07d28"];

// ── global style (fonts, keyframes, hover, body texture) ─────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
@keyframes bb-pip { 0%,100%{box-shadow:0 0 0 0 rgba(176,125,40,.5);} 50%{box-shadow:0 0 0 6px rgba(176,125,40,0);} }
@keyframes bb-ember { 0%,100%{box-shadow:inset 0 2px 3px rgba(255,255,255,.5),0 0 10px rgba(207,138,51,.4);} 50%{box-shadow:inset 0 2px 3px rgba(255,255,255,.5),0 0 18px rgba(207,138,51,.7);} }
@keyframes bb-shelf { 0%,100%{opacity:.5;} 50%{opacity:.85;} }
@keyframes bb-rise { from{opacity:0;transform:translateY(8px);} to{opacity:1;transform:translateY(0);} }
.bb-card { transition: transform .2s cubic-bezier(.22,1,.36,1), filter .18s ease; }
.bb-card:hover { transform: translateY(-6px); filter: brightness(1.04); z-index:5; }
.bb-die { transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
.bb-die.clk:hover { transform: translateY(-4px); border-color:#a3531f !important; }
.bb-btn { transition: filter .15s ease, transform .15s ease, background .15s ease; }
.bb-btn:not(:disabled):hover { filter: brightness(1.04); transform: translateY(-1px); }
.bb-sec:not(:disabled):hover { background:#ece2cf !important; }
.bb-noise::before { content:""; position:absolute; inset:0; pointer-events:none; z-index:0;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.55 0 0 0 0 0.42 0 0 0 0 0.24 0 0 0 0.05 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  mix-blend-mode:multiply; opacity:.5; }
::-webkit-scrollbar{width:8px;height:8px;} ::-webkit-scrollbar-thumb{background:#d9c8a8;border-radius:4px;}
@keyframes bb-roll-drop {
  0%   { transform: translateY(-200px) rotate(-320deg) scale(.78); opacity: 0; }
  18%  { opacity: 1; }
  60%  { transform: translateY(0) rotate(170deg) scale(1); }
  74%  { transform: translateY(-18px) rotate(255deg) scale(1.06); }
  88%  { transform: translateY(0) rotate(345deg) scale(.97); }
  100% { transform: translateY(0) rotate(360deg) scale(1); }
}
.bb-roll-drop { animation: bb-roll-drop .82s cubic-bezier(.34,1.2,.64,1) both; will-change: transform, opacity; }
@keyframes bb-roll-shadow {
  0%,55% { opacity: 0; transform: scaleX(.4); }
  72%    { opacity: .4; transform: scaleX(1.15); }
  100%   { opacity: .25; transform: scaleX(1); }
}
.bb-roll-shadow { animation: bb-roll-shadow .82s cubic-bezier(.34,1.2,.64,1) both; }
@keyframes bb-wild-shimmer { 0%,100%{ box-shadow:0 0 0 0 rgba(180,121,58,.0);} 50%{ box-shadow:0 0 14px 2px rgba(180,121,58,.4);} }
@media (prefers-reduced-motion: reduce) {
  .bb-roll-drop, .bb-roll-shadow { animation-duration: .001ms !important; }
}
`;

// ── helpers ──────────────────────────────────────────────────────────
function recipeKinds(recipe: Partial<Record<ResourceKind, number>>): ResourceKind[] {
  const out: ResourceKind[] = [];
  for (const k of PILE_ORDER) for (let i = 0; i < (recipe[k] ?? 0); i++) out.push(k);
  return out;
}
function recipeSize(recipe: Partial<Record<ResourceKind, number>>): number {
  return PILE_ORDER.reduce((s, k) => s + (recipe[k] ?? 0), 0);
}
function requirementText(req: DemandCard["requirement"]): string {
  const parts: string[] = [];
  if (req.tags) for (const t of req.tags) parts.push(STYLE_LABEL[t]);
  if (req.quality) parts.push(`${req.quality}+`);
  if (req.minAge !== undefined) parts.push(`age ${req.minAge}+`);
  return parts.length ? parts.join(" · ") : "Any bourbon";
}
function playerColor(i: number): string {
  return PLAYER_COLORS[i % PLAYER_COLORS.length]!;
}
type OrderRow = { pi: number; name: string; cap: number; rep: number; barrels: number; isBot: boolean; color: string; status: "done" | "now" | "next"; statusText: string };
/** Match a log line to the player whose name it leads with (for color-coding). */
function lineColor(line: string, players: Player[]): string | null {
  for (let i = 0; i < players.length; i++) {
    const n = players[i]!.name;
    if (line.startsWith(n + " ") || line.startsWith(n + "'")) return playerColor(i);
  }
  return null;
}
/** One-line live status for a player in the left ticker. */
function statusFor(p: Player, idx: number, game: GameState): string {
  if (game.phase === "ended") return "Done";
  const active = idx === game.currentPlayerIndex;
  if (game.roundPhase === "demand") return active ? "Reading the market…" : "Waiting…";
  if (game.roundPhase === "collect") return active ? "Drafting dice…" : "Waiting…";
  if (game.roundPhase === "play") return active ? "Working the distillery…" : p.donePlayThisRound ? "Turn complete" : "Waiting…";
  return "Waiting…";
}

// ── setup ────────────────────────────────────────────────────────────
function SetupScreen({ onStart, onTutorial }: { onStart: (names: string[]) => void; onTutorial: () => void }) {
  const [count, setCount] = useState(3);
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%", fontFamily: "Inter, sans-serif" }}>
      <div
        style={{
          width: 540,
          display: "flex",
          flexDirection: "column",
          gap: 20,
          padding: 36,
          borderRadius: 18,
          border: `1px solid ${C.border}`,
          background: SURFACE.panel,
          boxShadow: PANEL_SHADOW,
        }}
      >
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, color: C.gold }}>Bourbonomics</div>
        <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.5 }}>
          A cozy distillery game — Demand, Collect, Play. Gather resources by dice draft, age bourbon in
          your rickhouse, and sell into a shifting demand market. Complete orders for prestige.
        </div>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: C.brass }}>
          Players
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setCount(n)}
              className="bb-btn"
              style={{
                width: 48,
                height: 44,
                borderRadius: 9,
                fontFamily: MONO,
                fontWeight: 700,
                fontSize: 14,
                cursor: "pointer",
                border: `1px solid ${count === n ? C.brass : C.border}`,
                color: count === n ? PRIMARY_INK : C.ink,
                background: count === n ? PRIMARY : SURFACE.inset,
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <button
          onClick={() => onStart(Array.from({ length: count }, (_, i) => (i === 0 ? "You" : `Rival ${i}`)))}
          className="bb-btn"
          style={{
            padding: "14px 24px",
            borderRadius: 12,
            border: 0,
            cursor: "pointer",
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 14,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: PRIMARY_INK,
            background: PRIMARY,
            boxShadow: PRIMARY_SHADOW,
          }}
        >
          Start Game
        </button>
        <button
          onClick={onTutorial}
          className="bb-btn bb-sec"
          style={{
            padding: "11px 24px",
            borderRadius: 12,
            cursor: "pointer",
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: C.gold,
            background: SURFACE.inset,
            border: `1px solid ${C.brass}`,
          }}
        >
          ▶ How to play (tutorial)
        </button>
        <a
          href="/"
          style={{
            textAlign: "center",
            fontFamily: MONO,
            fontSize: 11,
            letterSpacing: ".12em",
            textTransform: "uppercase",
            color: C.muted,
            textDecoration: "none",
            marginTop: -6,
          }}
        >
          ← Back to main menu
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
export default function GameClient() {
  const [game, setGame] = useState<GameState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialPool = useRef(1);

  // Collect-phase local overlay (the engine commits at pass time).
  const [claims, setClaims] = useState<Record<string, ResourceKind>>({});
  const [keepDice, setKeepDice] = useState<Set<string>>(new Set());
  const [pendingWild, setPendingWild] = useState<string | null>(null);
  const [ttFace, setTtFace] = useState(false);
  // Play-phase local UI.
  const [drawingBills, setDrawingBills] = useState(false);
  const [keepBills, setKeepBills] = useState<Set<number>>(new Set());
  const [sellId, setSellId] = useState<string | null>(null);
  const [ultDept, setUltDept] = useState<DepartmentId | null>(null);
  const [qsOpen, setQsOpen] = useState(false);
  const [tut, setTut] = useState<number | null>(null);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [aiSpeed, setAiSpeed] = useState<AiSpeed>("normal");

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }
  function resetLocal() {
    setClaims({});
    setKeepDice(new Set());
    setPendingWild(null);
    setTtFace(false);
    setDrawingBills(false);
    setKeepBills(new Set());
    setSellId(null);
    setUltDept(null);
    setQsOpen(false);
    setInspect(null);
  }
  function start(names: string[]) {
    const g = createGame({
      seed: (Math.floor(Date.now() / 1000) % 100000) + 1,
      playerNames: names,
      botFlags: names.map((_, i) => i !== 0),
    });
    initialPool.current = g.demandDeck.length + g.demandDiscard.length + g.demandCards.length || 1;
    setTut(null);
    setGame(g);
    resetLocal();
  }
  // ── tutorial control ────────────────────────────────────────────────
  function startTutorial() {
    let g = tutorialGame();
    const oe = TUT_BEATS[0]!.onEnter;
    if (oe) g = oe(g);
    initialPool.current = g.demandDeck.length + g.demandDiscard.length + g.demandCards.length || 1;
    setGame(g);
    setTut(0);
    resetLocal();
  }
  function exitTutorial() {
    setTut(null);
    setGame(null);
    resetLocal();
  }
  function tutContinue() {
    if (tut === null || !game) return;
    const ni = tut + 1;
    if (ni >= TUT_BEATS.length) { exitTutorial(); return; }
    const oe = TUT_BEATS[ni]!.onEnter;
    setTut(ni);
    setGame(oe ? oe(game) : game);
    resetLocal();
  }
  function dispatch(action: Action, silent = false): boolean {
    if (!game) return false;
    // Ignore human input while the AI is on the clock (its turn is auto-driven).
    if (isBotTurn(game)) return false;

    // Tutorial gating: block actions that aren't part of the active step.
    if (tut !== null) {
      const beat = TUT_BEATS[tut]!;
      if (beat.cta) { if (!silent) flash(`Press “${beat.cta}” to continue`); return false; }
      if (beat.allow && !beat.allow(action, game)) { if (!silent) flash(beat.hint ?? "Follow the highlighted step"); return false; }
    }

    const res = applyAction(game, action);
    if (!res.ok) {
      if (!silent) flash("⚠ " + res.reason);
      return false;
    }

    let nextState = res.state;
    if (tut !== null) {
      const beat = TUT_BEATS[tut]!;
      const done = (beat.goal && beat.goal(action, res.state)) || (beat.advanceWhen && beat.advanceWhen(res.state));
      if (done) {
        const ni = tut + 1;
        if (ni >= TUT_BEATS.length) setTut(null);
        else { setTut(ni); const oe = TUT_BEATS[ni]!.onEnter; if (oe) nextState = oe(res.state); }
      }
    }
    setGame(nextState);
    resetLocal();
    return true;
  }

  /** Fast-forward through every queued AI turn until it's the human's turn. */
  function skipAhead() {
    if (!game || tut !== null) return;
    let s = game;
    let guard = 0;
    while (guard++ < 400 && s.phase === "playing" && isBotTurn(s)) {
      const a = botAction(s);
      if (!a) break;
      const r = applyAction(s, a);
      if (!r.ok) break;
      s = r.state;
    }
    setGame(s);
    resetLocal();
  }

  // ── AI driver ──────────────────────────────────────────────────────
  // Auto-advances only BOT collect/play turns (one action at a time, paced by
  // aiSpeed). The Demand phase is now human-gated — the human clicks "Begin the
  // Collect draft" in the DemandStage, so the driver does NOT auto-advance it.
  useEffect(() => {
    if (!game || game.phase !== "playing") return;
    if (tut !== null) return;
    if (game.roundPhase === "demand") return;
    if (!isBotTurn(game)) return;
    const a = botAction(game);
    if (!a) return;
    const base = game.roundPhase === "collect" ? 1500 : 850;
    const delay = Math.round(base * AI_SPEEDS[aiSpeed].mult);
    const t = setTimeout(() => {
      const res = applyAction(game, a);
      if (res.ok) {
        setGame(res.state);
        resetLocal();
      }
    }, delay);
    return () => clearTimeout(t);
  }, [game, tut, aiSpeed]);

  // Tutorial: some steps advance on a LOCAL action (opening the mash-bill picker).
  useEffect(() => {
    if (tut === null || !game || !drawingBills) return;
    const beat = TUT_BEATS[tut];
    if (!beat?.advanceOnDrawOpen) return;
    const ni = tut + 1;
    if (ni >= TUT_BEATS.length) { setTut(null); return; }
    setTut(ni);
    const oe = TUT_BEATS[ni]!.onEnter;
    if (oe) setGame(oe(game));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingBills, tut]);

  // Deep-link: /play?tutorial=1 launches the guided tutorial.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tutorial")) {
      startTutorial();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!game) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: PAGE_BG }}>
        <style>{GLOBAL_CSS}</style>
        <ScalingHost>
          <div style={{ width: 1920, height: 1080, background: "linear-gradient(160deg,#f6efe1,#ece2cf 55%,#e4d8c0)" }}>
            <SetupScreen onStart={start} onTutorial={startTutorial} />
          </div>
        </ScalingHost>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: PAGE_BG }}>
      <style>{GLOBAL_CSS}</style>
      <ScalingHost>
        <Board
          game={game}
          dispatch={dispatch}
          flash={flash}
          onNew={() => { setTut(null); setGame(null); }}
          onSkip={skipAhead}
          initialPool={initialPool.current}
          claims={claims}
          setClaims={setClaims}
          keepDice={keepDice}
          setKeepDice={setKeepDice}
          pendingWild={pendingWild}
          setPendingWild={setPendingWild}
          ttFace={ttFace}
          setTtFace={setTtFace}
          drawingBills={drawingBills}
          setDrawingBills={setDrawingBills}
          keepBills={keepBills}
          setKeepBills={setKeepBills}
          sellId={sellId}
          setSellId={setSellId}
          ultDept={ultDept}
          setUltDept={setUltDept}
          qsOpen={qsOpen}
          setQsOpen={setQsOpen}
          onInspect={setInspect}
          aiSpeed={aiSpeed}
          setAiSpeed={setAiSpeed}
          toast={toast}
        />
      </ScalingHost>
      {tut !== null && TUT_BEATS[tut] && sellId === null && pendingWild === null && ultDept === null && !qsOpen && !ttFace && inspect === null && (
        <TutorialOverlay beat={TUT_BEATS[tut]!} draftedCount={Object.keys(claims).length} pickedCount={keepBills.size} onContinue={tutContinue} onExit={exitTutorial} />
      )}
      {inspect && <InspectOverlay inspect={inspect} onClose={() => setInspect(null)} />}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
interface BoardProps {
  game: GameState;
  dispatch: (a: Action, silent?: boolean) => boolean;
  flash: (m: string) => void;
  onNew: () => void;
  onSkip: () => void;
  initialPool: number;
  claims: Record<string, ResourceKind>;
  setClaims: (v: Record<string, ResourceKind>) => void;
  keepDice: Set<string>;
  setKeepDice: (v: Set<string>) => void;
  pendingWild: string | null;
  setPendingWild: (v: string | null) => void;
  ttFace: boolean;
  setTtFace: (v: boolean) => void;
  drawingBills: boolean;
  setDrawingBills: (v: boolean) => void;
  keepBills: Set<number>;
  setKeepBills: (v: Set<number>) => void;
  sellId: string | null;
  setSellId: (v: string | null) => void;
  ultDept: DepartmentId | null;
  setUltDept: (v: DepartmentId | null) => void;
  qsOpen: boolean;
  setQsOpen: (v: boolean) => void;
  onInspect: (i: Inspect) => void;
  aiSpeed: AiSpeed;
  setAiSpeed: (v: AiSpeed) => void;
  toast: string | null;
}

function Board(p: BoardProps) {
  const { game, dispatch, flash } = p;
  // Which player's board we're DISPLAYING. Defaults to the active player; the
  // human can click a ticker row to peek at a rival's board (read-only).
  const [viewIdx, setViewIdx] = useState<number | null>(null);
  useEffect(() => { setViewIdx(null); }, [game.currentPlayerIndex, game.roundPhase]);
  const shownIdx = viewIdx ?? game.currentPlayerIndex;
  const me = game.players[shownIdx]!;
  const spectating = viewIdx !== null && viewIdx !== game.currentPlayerIndex;
  const supplyCap = fnSupply(me);
  const warehouseCap = fnWarehouse(me);
  const rickCap = fnRick(me);
  const phaseStage = game.roundPhase;
  const botTurn = isBotTurn(game);
  const locked = botTurn || spectating;
  const humanIdx = game.players.findIndex((pl) => !pl.isBot);
  const isMyTurn = !botTurn && !spectating && phaseStage !== "demand" && game.currentPlayerIndex === shownIdx;

  const optimisticClaims = phaseStage === "collect" && !spectating ? Object.values(p.claims) : [];
  const heldTotal = me.hand.length + optimisticClaims.length;
  const whFull = heldTotal >= warehouseCap;

  const zone = zoneForCardCount(game.demandCards.length);

  // Canvas-space refs for the card-flight animation (die → Warehouse).
  const rootRef = useRef<HTMLDivElement>(null);
  const warehouseRef = useRef<HTMLDivElement>(null);
  const wildSrc = useRef<{ x0: number; y0: number } | null>(null);
  const flightSeq = useRef(0);
  const [flights, setFlights] = useState<Flight[]>([]);

  const toCanvas = (rect: DOMRect): { x: number; y: number } | null => {
    const root = rootRef.current;
    if (!root) return null;
    const r = root.getBoundingClientRect();
    const scale = r.width / 1920 || 1;
    return { x: (rect.left + rect.width / 2 - r.left) / scale, y: (rect.top + rect.height / 2 - r.top) / scale };
  };
  const flyToHand = (x0: number, y0: number, kind: ResourceKind) => {
    const wh = warehouseRef.current;
    const c = wh ? toCanvas(wh.getBoundingClientRect()) : null;
    const id = ++flightSeq.current;
    setFlights((f) => [...f, { id, x0, y0, x1: c?.x ?? x0, y1: c?.y ?? y0, kind }]);
    window.setTimeout(() => setFlights((f) => f.filter((x) => x.id !== id)), 620);
  };

  // ---- collect actions ----
  const collect = game.collect;
  const toggleKeep = (id: string) => {
    const next = new Set(p.keepDice);
    next.has(id) ? next.delete(id) : next.add(id);
    p.setKeepDice(next);
  };
  const onRoll = () => {
    if (!collect || collect.rolled) return;
    if (p.keepDice.size > supplyCap) {
      flash(`Keep at most ${supplyCap} dice`);
      return;
    }
    dispatch({ type: "COLLECT_ROLL", keepDiceIds: [...p.keepDice] });
  };
  const onReroll = () => {
    if (!collect || !collect.rolled || collect.rerollsUsed >= collect.maxRerolls) return;
    const keep = Object.keys(p.claims);
    if (keep.length === collect.dice.length) {
      flash("Nothing left to reroll — every die is drafted");
      return;
    }
    dispatch({ type: "COLLECT_ROLL", keepDiceIds: keep });
  };
  const claimDie = (id: string, face: DieFace, el: HTMLElement) => {
    if (id in p.claims) {
      const next = { ...p.claims };
      delete next[id];
      p.setClaims(next);
      return;
    }
    if (heldTotal >= warehouseCap) {
      flash("⚠ Warehouse full — raise the hold limit");
      return;
    }
    const c = toCanvas(el.getBoundingClientRect());
    if (face === "anything") {
      wildSrc.current = c ? { x0: c.x, y0: c.y } : null;
      p.setPendingWild(id);
      return;
    }
    p.setClaims({ ...p.claims, [id]: face as ResourceKind });
    if (c) flyToHand(c.x, c.y, face as ResourceKind);
  };
  const choosePile = (kind: ResourceKind) => {
    if (!p.pendingWild) return;
    p.setClaims({ ...p.claims, [p.pendingWild]: kind });
    if (wildSrc.current) flyToHand(wildSrc.current.x0, wildSrc.current.y0, kind);
    wildSrc.current = null;
    p.setPendingWild(null);
  };
  const onPass = () => {
    const claimList = Object.entries(p.claims).map(([dieId, pile]) => {
      const die = collect!.dice.find((d) => d.id === dieId)!;
      return die.face === "anything" ? { dieId, pile } : { dieId };
    });
    const n = (collect?.dice.length ?? 0) - claimList.length;
    if (dispatch({ type: "COLLECT_CLAIM", claims: claimList })) flash(`Drafted ${claimList.length} · passed ${n} dice on`);
  };
  const onTripleThreat = (face: DieFace) => {
    if (!collect) return;
    const rest = collect.dice.filter((d) => !(d.id in p.claims)).map((d) => d.id);
    if (rest.length < 2) {
      flash("Triple Threat needs 2 undrafted dice");
      return;
    }
    dispatch({ type: "TRIPLE_THREAT", discardDiceIds: [rest[0]!, rest[1]!], face });
  };

  // ---- play: build / stage ----
  const autoStage = (b: Bourbon) => {
    for (const k of PILE_ORDER) {
      const need = (b.recipe[k] ?? 0) - b.staged.filter((c) => c.kind === k).length;
      if (need > 0) {
        const card = me.hand.find((c) => c.kind === k);
        if (card) {
          dispatch({ type: "STAGE", barrelId: b.id, resourceCardId: card.id });
          return;
        }
      }
    }
    flash("⚠ No matching card in the Warehouse to stage");
  };
  const tryBuild = (b: Bourbon) => {
    const picked: string[] = [];
    const pool = [...me.hand];
    for (const k of PILE_ORDER) {
      let need = (b.recipe[k] ?? 0) - b.staged.filter((c) => c.kind === k).length;
      while (need > 0) {
        const idx = pool.findIndex((c) => c.kind === k);
        if (idx < 0) {
          flash("⚠ Missing resources to build — collect or stage more");
          return;
        }
        picked.push(pool[idx]!.id);
        pool.splice(idx, 1);
        need--;
      }
    }
    if (dispatch({ type: "MAKE_BOURBON", barrelId: b.id, resourceCardIds: picked })) flash(`Built ${b.name} — now aging`);
  };

  // ── view-model ──
  const phaseDefs = [
    { name: "Demand", done: phaseStage !== "demand", active: phaseStage === "demand" },
    { name: "Collect", done: phaseStage === "play", active: phaseStage === "collect" },
    { name: "Play", done: false, active: phaseStage === "play" },
  ];

  // Player ticker order: collect uses the live pass order; otherwise most-Capital-first.
  const order = (
    collect
      ? collect.order
      : game.players.map((_, i) => i).sort((a, b) => game.players[b]!.capital - game.players[a]!.capital || a - b)
  ).map((pi, idx) => {
    const pl = game.players[pi]!;
    let status: "done" | "now" | "next" = "next";
    if (collect) status = idx < collect.pos ? "done" : idx === collect.pos ? "now" : "next";
    else if (pi === game.currentPlayerIndex) status = "now";
    return { pi, name: pl.name, cap: pl.capital, rep: reputationOf(pl), barrels: pl.rickhouse.length, isBot: pl.isBot, color: playerColor(pi), status, statusText: statusFor(pl, pi, game) };
  });

  const sellBourbon = p.sellId ? me.rickhouse.find((b) => b.id === p.sellId) ?? null : null;

  if (game.phase === "ended") return <EndScreen game={game} onNew={p.onNew} />;

  return (
    <div
      ref={rootRef}
      className="bb-noise"
      style={{
        position: "relative",
        width: 1920,
        height: 1080,
        padding: "16px 20px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        fontFamily: "Inter, system-ui, sans-serif",
        color: C.ink,
        background: "radial-gradient(120% 80% at 50% -10%, rgba(207,138,51,.07), transparent 55%), linear-gradient(160deg,#f6efe1 0%,#ece2cf 55%,#e4d8c0 100%)",
      }}
    >
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
        <TopBar game={game} me={game.players[humanIdx] ?? me} phaseDefs={phaseDefs} board={p} />

        {/* ===== 3-ZONE STAGE ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "312px 1fr 372px", gap: 16, flex: 1, minHeight: 0 }}>
          <TableRail order={order} game={game} board={p} shownIdx={shownIdx} onView={(pi) => setViewIdx(pi === game.currentPlayerIndex ? null : pi)} />

          <CenterStage
            board={p}
            me={me}
            shownIdx={shownIdx}
            spectating={spectating}
            isMyTurn={isMyTurn}
            botTurn={botTurn}
            locked={locked}
            phaseStage={phaseStage}
            collect={collect}
            zone={zone}
            supplyCap={supplyCap}
            warehouseCap={warehouseCap}
            heldTotal={heldTotal}
            whFull={whFull}
            rickCap={rickCap}
            humanIdx={humanIdx}
            order={order}
            optimisticClaims={optimisticClaims}
            warehouseRef={warehouseRef}
            onRoll={onRoll}
            onReroll={onReroll}
            toggleKeep={toggleKeep}
            claimDie={claimDie}
            onTT={() => p.setTtFace(true)}
            onPass={onPass}
            autoStage={autoStage}
            tryBuild={tryBuild}
            onExitView={() => setViewIdx(null)}
          />

          <MarketRail game={game} zone={zone} privateCards={game.players[humanIdx]?.privateCards ?? []} />
        </div>

        <TableLog game={game} />
      </div>

      <FlightLayer flights={flights} />

      {p.pendingWild && (
        <PileChooser title="✦ Wild — draw from which pile?" onPick={choosePile} onCancel={() => { wildSrc.current = null; p.setPendingWild(null); }} />
      )}
      {p.qsOpen && (
        <PileChooser
          title="✦ Quality Sort — free draw from which pile?"
          onPick={(k) => dispatch({ type: "QUALITY_SORT", pile: k })}
          onCancel={() => p.setQsOpen(false)}
        />
      )}
      {p.ttFace && (
        <FaceChooser title="⚡ Triple Threat — discard 2 undrafted dice, take which face?" onPick={onTripleThreat} onCancel={() => p.setTtFace(false)} />
      )}
      {p.drawingBills && !botTurn && <BillPicker board={p} />}
      {sellBourbon && (
        <SellOverlay
          game={game}
          me={me}
          bourbon={sellBourbon}
          zone={zone}
          onRoute={(demandCardId) => dispatch({ type: "SELL", bourbonId: sellBourbon.id, demandCardId })}
          onCancel={() => p.setSellId(null)}
        />
      )}
      {p.ultDept && (
        <UltimateOverlay
          dept={me.distillery.departments.find((d) => d.id === p.ultDept)!}
          onChoose={(ultimateId, ultimatePile) => dispatch({ type: "IMPROVE", departmentId: p.ultDept!, ultimateId, ultimatePile })}
          onCancel={() => p.setUltDept(null)}
        />
      )}
      {p.toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 70, padding: "12px 22px", borderRadius: 11, background: SURFACE.panel, border: `1px solid ${C.brass}`, boxShadow: PANEL_SHADOW, fontFamily: MONO, fontSize: 12, letterSpacing: ".04em", color: C.ink, animation: "bb-rise .24s ease-out" }}>{p.toast}</div>
      )}
    </div>
  );
}

// ── Top bar (brand · phase stepper · rival pace · Prestige · Capital) ──
function TopBar({ game, me, phaseDefs, board }: { game: GameState; me: Player; phaseDefs: { name: string; done: boolean; active: boolean }[]; board: BoardProps }) {
  const active = game.players[game.currentPlayerIndex]!;
  return (
    <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "8px 14px", borderRadius: 14, background: SURFACE.panel, border: `1px solid ${C.border}`, boxShadow: PANEL_SHADOW, flex: "0 0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: "linear-gradient(160deg,#e0a44e,#a3531f)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,.45), 0 5px 14px rgba(163,83,31,.35)" }}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 25, color: "#fff7ea" }}>B</span>
        </div>
        <div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 25, lineHeight: 1, color: C.ink }}>Bourbonomics</div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".2em", color: C.muted, marginTop: 3 }}>
            ROUND {game.roundNumber}{game.finalRound ? " · FINAL" : ""} · {active.name}&apos;s turn{active.isBot ? " · AI" : ""}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center" }}>
        {phaseDefs.map((ph, i) => (
          <div key={ph.name} style={{ display: "flex", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 14px", borderRadius: 10, ...(ph.active ? { background: "linear-gradient(180deg,#f7e9cc,#f0dcb0)", border: `1px solid ${C.brass}`, color: C.ink } : { background: SURFACE.inset, border: `1px solid ${C.hairline}`, color: ph.done ? C.text2 : C.muted }) }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: ph.active ? C.amber : ph.done ? C.green : C.faint, animation: ph.active ? "bb-pip 2.2s ease-in-out infinite" : undefined }} />
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase" }}>{ph.name}</span>
              {ph.done && <span style={{ fontFamily: MONO, fontSize: 10, color: C.green }}>✓</span>}
            </div>
            {i < 2 && <span style={{ width: 22, height: 1, background: C.border, margin: "0 2px" }} />}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }} title="How fast rival turns play out">
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted }}>Pace</span>
          <div style={{ display: "flex", borderRadius: 8, overflow: "hidden", border: `1px solid ${C.border}` }}>
            {AI_SPEED_ORDER.map((s) => {
              const on = board.aiSpeed === s;
              return (
                <button key={s} onClick={() => board.setAiSpeed(s)} style={{ padding: "5px 9px", fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", cursor: "pointer", border: 0, color: on ? PRIMARY_INK : C.text2, background: on ? PRIMARY : SURFACE.rail }}>{AI_SPEEDS[s].label}</button>
              );
            })}
          </div>
        </div>
        <button className="bb-btn bb-sec" onClick={board.onNew} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, background: SURFACE.inset, border: `1px solid ${C.border}`, padding: "7px 12px", borderRadius: 10, cursor: "pointer" }}>New</button>
        <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 13px", borderRadius: 10, background: SURFACE.inset, border: `1px solid ${C.border}` }}>
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".12em", color: C.muted }}>PRESTIGE</span>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: C.prestige }}>{reputationOf(me)}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>· {me.keptCards.length}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 15px", borderRadius: 10, background: "linear-gradient(180deg,#fbf2db,#f3e6c4)", border: `1px solid ${C.brass}` }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", color: C.muted }}>CAPITAL</span>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: C.gold }}>{me.capital}</span>
        </div>
      </div>
    </header>
  );
}

// ── Left rail — "At the Table" player ticker + clock ──────────────────
function TableRail({ order, game, board, shownIdx, onView }: { order: OrderRow[]; game: GameState; board: BoardProps; shownIdx: number; onView: (pi: number) => void }) {
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
      <section style={{ display: "flex", flexDirection: "column", gap: 8, borderRadius: 14, background: SURFACE.rail, border: `1px solid ${C.border}`, boxShadow: PANEL_SHADOW, padding: 12, flex: 1, minHeight: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: C.brass }}>At the Table</span>
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", color: C.muted }}>TAP TO VIEW</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
          {order.map((o) => {
            const viewed = o.pi === shownIdx;
            const now = o.status === "now";
            return (
              <button
                key={o.pi}
                onClick={() => onView(o.pi)}
                title={`View ${o.name}'s distillery`}
                style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 9, padding: "11px 12px", borderRadius: 12, cursor: "pointer", flex: "0 0 auto", ...(now ? { background: `linear-gradient(120deg,${o.color}1f,#fffdf8 70%)`, border: `1.5px solid ${o.color}`, boxShadow: `0 0 0 3px ${o.color}14, ${CARD_SHADOW}` } : viewed ? { background: SURFACE.inset, border: `1px solid ${o.color}` } : { background: "#fffdf8", border: `1px solid ${C.hairline}` }) }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                  <div style={{ position: "relative", width: 40, height: 40, flex: "0 0 auto", borderRadius: 11, background: `linear-gradient(160deg,${o.color},${o.color}c0)`, display: "grid", placeItems: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,.45)" }}>
                    <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20, color: "#fff" }}>{o.name[0]}</span>
                    {now && <span style={{ position: "absolute", inset: -3, borderRadius: 13, border: `2px solid ${o.color}`, animation: "bb-pip 1.6s ease-in-out infinite" }} />}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.name}</span>
                      {now ? <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#fff", background: o.color, padding: "2px 6px", borderRadius: 5 }}>Now</span>
                        : o.isBot ? <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted, border: `1px solid ${C.border2}`, padding: "1px 5px", borderRadius: 5 }}>AI</span> : null}
                    </div>
                    <div style={{ fontFamily: MONO, fontSize: 10, color: now ? o.color : C.muted, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{o.statusText}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, paddingTop: 9, borderTop: `1px solid ${now ? `${o.color}40` : C.hairline}` }}>
                  <span style={{ fontFamily: MONO, fontSize: 11 }}><b style={{ fontFamily: SERIF, fontSize: 16, color: C.gold }}>{o.cap}</b> <span style={{ fontSize: 8, letterSpacing: ".1em", color: C.muted }}>CAP</span></span>
                  <span style={{ fontFamily: MONO, fontSize: 11 }}><b style={{ fontFamily: SERIF, fontSize: 16, color: C.prestige }}>{o.rep}</b> <span style={{ fontSize: 8, letterSpacing: ".1em", color: C.muted }}>PRES</span></span>
                  <span style={{ flex: 1 }} />
                  <span style={{ fontFamily: MONO, fontSize: 10, color: C.text2 }}>{o.barrels} <span style={{ color: C.muted }}>barrel{o.barrels === 1 ? "" : "s"}</span></span>
                </div>
              </button>
            );
          })}
        </div>
      </section>
      <ClockCard game={game} initialPool={board.initialPool} />
    </aside>
  );
}

function ClockCard({ game, initialPool }: { game: GameState; initialPool: number }) {
  const poolLeft = game.demandDeck.length + game.demandDiscard.length;
  const pct = Math.round((poolLeft / initialPool) * 100);
  return (
    <section style={{ borderRadius: 14, background: SURFACE.rail, border: `1px solid ${C.border}`, boxShadow: PANEL_SHADOW, padding: 12, flex: "0 0 auto" }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: C.brass }}>The Clock</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, margin: "6px 0 8px" }}>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, color: C.ink }}>{poolLeft}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>/ {initialPool} demand cards left</span>
      </div>
      <div style={{ height: 8, borderRadius: 5, background: SURFACE.inset, overflow: "hidden", border: `1px solid ${C.border}` }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "linear-gradient(90deg,#56a87c,#b07d28)" }} />
      </div>
      <div style={{ fontSize: 10.5, color: C.muted, marginTop: 7, lineHeight: 1.4 }}>Completed orders leave the deck. Game ends when it runs dry.</div>
    </section>
  );
}

// ── small shared bits ────────────────────────────────────────────────
// Compact branch readout — connected nodes, the ultimate a gold diamond.
function Pips({ dept, me }: { dept: DepartmentId; me: Player }) {
  const d = me.distillery.departments.find((x) => x.id === dept)!;
  const color = DEPT_META[dept].color;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {Array.from({ length: d.maxLevel + 1 }).map((_, i) => {
        const owned = i <= d.level;
        const isUlt = i === d.maxLevel;
        const conn = i > 0 ? <span style={{ width: 6, height: 2, borderRadius: 2, background: i <= d.level ? color : C.border2 }} /> : null;
        const node = isUlt ? (
          <span title="Ultimate" style={{ width: 9, height: 9, transform: "rotate(45deg)", borderRadius: 2, background: owned ? "linear-gradient(135deg,#f0c970,#b07d28)" : "transparent", border: `1px solid ${owned ? C.gold : C.brass}`, boxShadow: owned ? "0 0 6px rgba(176,125,40,.7)" : undefined }} />
        ) : (
          <span style={{ width: 8, height: 8, borderRadius: 999, background: owned ? color : "transparent", border: `1.5px solid ${owned ? color : C.border2}` }} />
        );
        return <span key={i} style={{ display: "inline-flex", alignItems: "center" }}>{conn}{node}</span>;
      })}
    </div>
  );
}

function ImproveBtn({ id, board, me, compact }: { id: DepartmentId; board: BoardProps; me: Player; compact?: boolean }) {
  const d = me.distillery.departments.find((x) => x.id === id)!;
  const maxed = d.level >= d.maxLevel;
  const cost = improvementCost(me.improvements, d.discount);
  const isActor = me.id === board.game.players[board.game.currentPlayerIndex]?.id && !isBotTurn(board.game);
  const can = isActor && !maxed && me.capital >= cost && board.game.roundPhase === "play";
  const nextIsUlt = d.level + 1 === d.maxLevel;
  const realOptions = d.ultimateOptions.filter((o) => o !== "ph");
  const onClick = () => {
    if (maxed || !isActor) return;
    if (board.game.roundPhase !== "play") { board.flash("Improve during the Play phase"); return; }
    if (nextIsUlt && realOptions.length > 0) {
      if (me.capital < cost) { board.flash(`Costs ${cost} capital`); return; }
      board.setUltDept(id);
    } else {
      board.dispatch({ type: "IMPROVE", departmentId: id });
    }
  };
  return (
    <button
      className="bb-btn bb-sec"
      disabled={maxed}
      onClick={onClick}
      title={nextIsUlt && realOptions.length ? "Choose an ultimate" : undefined}
      style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", padding: compact ? "4px 8px" : "5px 10px", borderRadius: 7, whiteSpace: "nowrap", cursor: maxed ? "default" : "pointer", ...(maxed ? { border: `1px solid ${C.border2}`, color: C.faint, background: SURFACE.inset } : can ? { border: 0, color: PRIMARY_INK, background: PRIMARY } : { border: `1px solid ${C.border}`, color: C.muted, background: SURFACE.inset }) }}
    >
      {maxed ? "MAX" : nextIsUlt && realOptions.length ? `★ ${cost}` : `+ ${cost}`}
    </button>
  );
}

// Lettered department badge (soft tinted tile, dept-colour initial).
function DeptIcon({ id, size = 40 }: { id: DepartmentId; size?: number }) {
  const color = DEPT_META[id].color;
  return (
    <div style={{ width: size, height: size, borderRadius: Math.round(size * 0.26), flex: "0 0 auto", display: "grid", placeItems: "center", background: `linear-gradient(160deg, ${color}30, ${color}14)`, border: `1px solid ${color}66`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.5)" }}>
      <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: Math.round(size * 0.5), lineHeight: 1, color }}>{DEPT_LETTER[id]}</span>
    </div>
  );
}

// The branch as a value-per-level track: roman-numeral nodes with a value+unit
// label under each, ending in a gold UL (ultimate) diamond.
function DeptValueTrack({ d, color, unit }: { d: Department; color: string; unit: string }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {Array.from({ length: d.maxLevel + 1 }).map((_, i) => {
        const owned = i <= d.level;
        const current = i === d.level;
        const isUlt = i === d.maxLevel;
        const conn = i > 0 ? <span style={{ width: 16, height: 2, borderRadius: 2, marginTop: 12, background: i <= d.level ? color : C.border2 }} /> : null;
        const node = isUlt ? (
          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, width: 30 }}>
            <span title="Ultimate" style={{ width: 24, height: 24, transform: "rotate(45deg)", borderRadius: 5, display: "grid", placeItems: "center", background: owned ? "linear-gradient(135deg,#f7dd9a,#b07d28)" : "#fffdf8", border: `1.5px solid ${owned ? C.gold : C.brass}`, boxShadow: current ? `0 0 9px ${C.gold}` : owned ? "0 0 5px rgba(176,125,40,.5)" : undefined }}>
              <span style={{ transform: "rotate(-45deg)", fontFamily: MONO, fontSize: 8, fontWeight: 700, color: owned ? "#2a1a0e" : C.brass }}>UL</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: ".06em", textTransform: "uppercase", color: C.faint }}>ult</span>
          </span>
        ) : (
          <span style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, width: 40 }}>
            <span style={{ width: 26, height: 26, borderRadius: 8, display: "grid", placeItems: "center", background: owned ? `linear-gradient(180deg, ${color}, ${color}cc)` : "#fffdf8", border: `1.5px solid ${current ? C.ink : owned ? color : C.border2}`, boxShadow: current ? `0 0 0 2px ${color}40` : undefined }}>
              <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 11, color: owned ? "#fff" : C.muted }}>{ROMAN[i]}</span>
            </span>
            <span style={{ fontFamily: MONO, fontSize: 8, color: current ? C.ink : C.faint, whiteSpace: "nowrap" }}>{d.values[i]} {unit}</span>
          </span>
        );
        return <span key={i} style={{ display: "inline-flex", alignItems: "flex-start" }}>{conn}{node}</span>;
      })}
    </div>
  );
}

// ── Center stage — the only zone that morphs per phase ────────────────
interface StageProps {
  board: BoardProps;
  me: Player;
  shownIdx: number;
  spectating: boolean;
  isMyTurn: boolean;
  botTurn: boolean;
  locked: boolean;
  phaseStage: GameState["roundPhase"];
  collect: GameState["collect"];
  zone: Zone;
  supplyCap: number;
  warehouseCap: number;
  heldTotal: number;
  whFull: boolean;
  rickCap: number;
  humanIdx: number;
  order: OrderRow[];
  optimisticClaims: ResourceKind[];
  warehouseRef: React.RefObject<HTMLDivElement | null>;
  onRoll: () => void;
  onReroll: () => void;
  toggleKeep: (id: string) => void;
  claimDie: (id: string, face: DieFace, el: HTMLElement) => void;
  onTT: () => void;
  onPass: () => void;
  autoStage: (b: Bourbon) => void;
  tryBuild: (b: Bourbon) => void;
  onExitView: () => void;
}

const STAGE_PANEL: React.CSSProperties = {
  position: "relative",
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  borderRadius: 16,
  background: SURFACE.panel,
  border: `1px solid ${C.border}`,
  boxShadow: PANEL_SHADOW,
  overflow: "hidden",
};

function CenterStage(props: StageProps) {
  const { phaseStage, botTurn, spectating, isMyTurn } = props;
  let content: React.ReactNode;
  if (spectating) content = <DistilleryFloor {...props} />;
  else if (phaseStage === "demand") content = <DemandStage {...props} />;
  else if (botTurn) content = <SpectatorStage {...props} />;
  else if (phaseStage === "collect" && isMyTurn) content = <DiceDraftStage {...props} />;
  else content = <DistilleryFloor {...props} />;
  const showEnd = isMyTurn && phaseStage === "play";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0, minWidth: 0 }}>
      <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>{content}</div>
      <DepartmentBar {...props} />
      {showEnd && (
        <button className="bb-btn" onClick={() => props.board.dispatch({ type: "END_TURN" })} style={{ flex: "0 0 auto", padding: "10px", borderRadius: 11, border: 0, cursor: "pointer", fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: ".12em", textTransform: "uppercase", color: "#fff", background: "linear-gradient(180deg,#56a87c,#2f6347)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.3)" }}>End turn ✓</button>
      )}
    </div>
  );
}

// Persistent department bar — visible in every phase. The Warehouse is one of the
// cards here (and doubles as your resource-card storage).
function DepartmentBar(props: StageProps) {
  const { board, me } = props;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 9, flex: "0 0 auto", minWidth: 0 }}>
      <DepartmentCard id="supply" board={board} me={me} />
      <WarehouseDeptCard {...props} />
      <DepartmentCard id="mashFloor" board={board} me={me} />
      <DepartmentCard id="marketing" board={board} me={me} />
    </div>
  );
}

// The Warehouse as a department card — same chrome as the others, but its body is
// your held resource cards (claimed dice fly here).
function WarehouseDeptCard(props: StageProps) {
  const { board, me, warehouseCap, heldTotal, whFull, optimisticClaims, warehouseRef, phaseStage, locked } = props;
  const d = me.distillery.departments.find((x) => x.id === "warehouse")!;
  const meta = DEPT_META.warehouse;
  const realOptions = d.ultimateOptions.filter((o) => o !== "ph");
  const chosen = d.chosenUltimate && d.chosenUltimate !== "ph" ? d.chosenUltimate : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 7, borderRadius: 12, border: `1px solid ${C.border}`, background: `radial-gradient(90% 50% at 50% 0%, ${meta.color}12, transparent 60%), ${SURFACE.panel}`, boxShadow: CARD_SHADOW, padding: "10px 11px", minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <DeptIcon id="warehouse" size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: ".12em", textTransform: "uppercase", color: meta.color }}>{DEPT_ROOM.warehouse}</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: C.ink, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.name}</div>
        </div>
        <span style={{ display: "flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 999, background: "#fffdf8", border: `1px solid ${whFull ? C.red : C.border}` }}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 14, color: whFull ? C.red : C.green }}>{heldTotal}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>/{warehouseCap}</span>
        </span>
        <ImproveBtn id="warehouse" board={board} me={me} compact />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: chosen ? C.gold : meta.color, opacity: chosen ? 1 : 0.5 }} />
        <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{chosen ? `Cut · ${ULT_LABEL[chosen].name}` : `Spirit cut · open 1 of ${realOptions.length}`}</span>
        <div style={{ flex: 1 }} />
        <DeptValueTrack d={d} color={meta.color} unit="hold" />
      </div>
      <div ref={warehouseRef} style={{ flex: 1, minHeight: 0, display: "flex", gap: 5, flexWrap: "wrap", alignContent: "flex-start", paddingTop: 7, borderTop: `1px solid ${C.hairline}`, overflow: "hidden" }}>
        {me.hand.slice(0, warehouseCap).map((card) => (
          <ResMiniCard key={card.id} kind={card.kind} quality={card.quality} onClick={() => board.onInspect({ kind: "resource", card })} />
        ))}
        {optimisticClaims.slice(0, Math.max(0, warehouseCap - me.hand.length)).map((kind, i) => (
          <ResMiniCard key={`pend${i}`} kind={kind} pending onClick={() => board.onInspect({ kind: "pending", k: kind })} />
        ))}
        {Array.from({ length: Math.max(0, warehouseCap - heldTotal) }).map((_, i) => (
          <div key={`g${i}`} style={{ width: 38, height: 52, borderRadius: 7, border: `1.5px dashed ${C.border2}`, background: SURFACE.inset }} />
        ))}
        {hasUlt(me, "warehouse", "qualitySort") && phaseStage === "play" && !locked && (
          <button className="bb-btn" disabled={me.qualitySortUsedThisRound} onClick={() => board.setQsOpen(true)} style={{ alignSelf: "flex-start", padding: "4px 8px", borderRadius: 7, fontFamily: MONO, fontWeight: 600, fontSize: 8.5, letterSpacing: ".06em", textTransform: "uppercase", border: `1px solid ${C.green}`, background: "rgba(62,125,89,.1)", color: C.green, cursor: me.qualitySortUsedThisRound ? "default" : "pointer", opacity: me.qualitySortUsedThisRound ? 0.5 : 1 }}>
            ✦ QS {me.qualitySortUsedThisRound ? "used" : "free"}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Demand stage — draw the round's order + market-heat meter ──────────
function DemandStage({ board, zone }: StageProps) {
  const game = board.game;
  const [revealed, setRevealed] = useState(false);
  const count = game.demandCards.length;
  const featured = game.demandCards[count - 1];
  return (
    <section style={{ ...STAGE_PANEL, display: "flex", flexDirection: "column", padding: "16px 20px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: C.amber }}>Demand Phase</span>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: C.ink }}>Read the Market</span>
        <span style={{ fontSize: 12, color: C.text2 }}>A new order joins the table — the zone &amp; crash sit in the Market rail. Open the draft when you&apos;re ready.</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, marginTop: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
        {!revealed || !featured ? (
          <button className="bb-card" onClick={() => setRevealed(true)} style={{ width: 210, height: 280, borderRadius: 16, cursor: "pointer", border: `2px dashed ${C.brass}`, background: "repeating-linear-gradient(135deg,#f3e6c8 0 10px,#efe0bf 10px 20px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: C.brass }}>
            <span style={{ fontSize: 40 }}>🂠</span>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", textAlign: "center", lineHeight: 1.6 }}>Draw this<br />round&apos;s order</span>
          </button>
        ) : (
          <div style={{ animation: "bb-rise .4s ease-out" }}><DemandCardFace card={featured} zone={zone} /></div>
        )}
        <button className="bb-btn" onClick={() => board.dispatch({ type: "BEGIN_COLLECT" })} style={{ padding: "13px 28px", borderRadius: 12, background: PRIMARY, color: PRIMARY_INK, fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", border: 0, boxShadow: PRIMARY_SHADOW }} data-tut="begin">Begin the Collect draft →</button>
      </div>
    </section>
  );
}

// A featured demand card face (the round's drawn order).
function DemandCardFace({ card, zone }: { card: DemandCard; zone: Zone }) {
  const reqTags = card.requirement.tags ?? [];
  const filled = card.filledBy.filter((f) => f !== null).length;
  const open = reqTags.length === 0 && card.requirement.quality === undefined && card.requirement.minAge === undefined;
  return (
    <article style={{ width: 210, borderRadius: 16, border: `1px solid ${C.border}`, background: SURFACE.panel, boxShadow: PANEL_SHADOW, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
        {open ? (
          <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#0a1610", background: STYLE_CHROME.barley.border, padding: "2px 8px", borderRadius: 999 }}>Open · any</span>
        ) : reqTags.map((t) => (
          <span key={t} style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: STYLE_CHROME[t].ink, background: STYLE_CHROME[t].border, padding: "2px 8px", borderRadius: 999 }}>{STYLE_LABEL[t]}</span>
        ))}
      </div>
      <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: C.ink, lineHeight: 1.05 }}>{card.label}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>{requirementText(card.requirement)}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, borderTop: `1px solid ${C.hairline}` }}>
        <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>order</span>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20, color: C.gold }}>+{card.orderValue}</span>
        <span style={{ flex: 1 }} />
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, background: "rgba(138,95,176,.14)", border: `1px solid ${C.prestige}` }}>
          <span style={{ fontSize: 13, color: C.prestige }}>★</span>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 18, color: C.prestige }}>{card.reputation}</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>{filled}/{card.slotsActive} slots</span>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 9, color: ZONE_META[zone].color }}>{ZONE_META[zone].label} ×{zoneMultiplier(zone)}</span>
      </div>
    </article>
  );
}

// ── Collect stage — the dice draft ────────────────────────────────────
function DiceDraftStage(props: StageProps) {
  const { board, me, collect, supplyCap, warehouseCap, heldTotal, whFull } = props;
  const game = board.game;
  if (!collect) return <section style={STAGE_PANEL} />;
  const preRoll = !collect.rolled;
  const drafted = Object.keys(board.claims).length;
  const undrafted = collect.dice.length - drafted;
  const canReroll = collect.rolled && collect.maxRerolls > 0;
  const canTT = collect.rolled && hasUlt(me, "supply", "tripleThreat") && !collect.tripleThreatUsed;

  return (
    <section style={{ ...STAGE_PANEL, display: "flex", flexDirection: "column", padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: C.amber }}>Collect Phase</span>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: C.ink }}>The Dice Draft</span>
        <span style={{ fontSize: 12, color: C.text2 }}>{preRoll ? "Keep the inherited dice you like, then roll the rest." : "Tap a die to draw it into your Warehouse, then pass the leftovers on."}</span>
        <div style={{ flex: 1 }} />
        <Readout label="SUPPLY" value={`${supplyCap} dice`} color={C.amber} />
        <Readout label="HOLD" value={`${heldTotal}/${warehouseCap}`} color={whFull ? C.red : C.green} border={whFull ? C.red : C.border} />
      </div>

      {/* piles strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, margin: "11px 0", paddingBottom: 9, borderBottom: `1px solid ${C.hairline}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: C.brass }}>Piles · draw blind</span>
        {PILE_ORDER.map((k) => (
          <div key={k} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: KIND_CHROME[k].grad, border: `1px solid ${KIND_CHROME[k].border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>{resMark(k, 18, KIND_CHROME[k].ink)}</div>
            <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.ink }}>{game.piles[k].length}</span>
              <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>{FACE[k].label}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 250px", gap: 16, flex: 1, minHeight: 0 }}>
        <div style={{ borderRadius: 12, background: SURFACE.inset, border: `1px solid ${C.border}`, padding: 14, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 0 }}>
          <DiceTray
            dice={collect.dice}
            rollId={`${collect.pos}-${collect.rolled}-${collect.rerollsUsed}`}
            animate={collect.rolled}
            mode={preRoll ? "keep" : "claim"}
            selectedIds={preRoll ? board.keepDice : new Set(Object.keys(board.claims))}
            full={whFull}
            locked={false}
            onDie={preRoll ? (id) => props.toggleKeep(id) : props.claimDie}
          />
        </div>

        <div style={{ borderRadius: 11, background: SURFACE.inset, border: `1px solid ${C.border}`, padding: 12, display: "flex", flexDirection: "column", gap: 9, justifyContent: "center", minHeight: 0 }}>
          {preRoll ? (
            <>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>{board.keepDice.size} kept · rolling {Math.max(0, supplyCap - board.keepDice.size)} fresh</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>Keep the inherited dice you like, then roll to fill up to your Supply cap. Claimed cards land in the Warehouse below.</div>
              <button data-tut="pass" className="bb-btn" onClick={props.onRoll} style={{ padding: "13px 18px", borderRadius: 10, background: PRIMARY, color: PRIMARY_INK, fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer", border: 0, boxShadow: PRIMARY_SHADOW }}>🎲 Roll</button>
            </>
          ) : (
            <>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>{drafted} drafted · {undrafted} left</div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5 }}>Each claim flies a card to the Warehouse below.</div>
              {canReroll && (
                <button className="bb-btn bb-sec" onClick={props.onReroll} disabled={collect.rerollsUsed >= collect.maxRerolls} style={{ padding: "9px 14px", borderRadius: 10, fontFamily: MONO, fontWeight: 600, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", ...(collect.rerollsUsed < collect.maxRerolls ? { border: `1px solid ${C.brass}`, color: C.gold, background: SURFACE.inset, cursor: "pointer" } : { border: `1px solid ${C.border2}`, color: C.faint, background: SURFACE.inset, cursor: "default" }) }}>↻ Reroll · {collect.maxRerolls - collect.rerollsUsed} left</button>
              )}
              {canTT && (
                <button className="bb-btn bb-sec" onClick={props.onTT} style={{ padding: "9px 14px", borderRadius: 10, fontFamily: MONO, fontWeight: 600, fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", border: `1px solid ${C.amber}`, color: C.amber, background: SURFACE.inset, cursor: "pointer" }}>⚡ Triple Threat</button>
              )}
              <button data-tut="pass" className="bb-btn" onClick={props.onPass} style={{ padding: "12px 18px", borderRadius: 10, background: PRIMARY, color: PRIMARY_INK, fontFamily: MONO, fontWeight: 700, fontSize: 13, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", border: 0, boxShadow: PRIMARY_SHADOW }}>Claim &amp; pass →</button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Readout({ label, value, color, border }: { label: string; value: string; color: string; border?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 11px", borderRadius: 9, background: SURFACE.inset, border: `1px solid ${border ?? C.border}` }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".1em", color: C.muted }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 13, color }}>{value}</span>
    </div>
  );
}

// ── Spectator stage — live narration on a rival's turn (no silent lock) ─
function SpectatorStage(props: StageProps) {
  const { board, me, phaseStage, humanIdx, collect, spectating } = props;
  const game = board.game;
  const color = playerColor(game.currentPlayerIndex);
  const doing = phaseStage === "collect" ? "drafting dice" : "working the distillery";

  // How many turns until the human is up.
  let upText = "your turn is coming up";
  if (humanIdx >= 0) {
    if (phaseStage === "collect" && collect) {
      const myPos = collect.order.indexOf(humanIdx);
      const away = myPos - collect.pos;
      upText = away <= 0 ? "you've drafted — sit back" : away === 1 ? "you're up next" : `you're up in ${away} turns`;
    } else {
      const n = game.players.length;
      let away = 0;
      for (let step = 1; step <= n; step++) {
        const idx = (game.currentPlayerIndex + step) % n;
        if (idx === humanIdx) break;
        if (!game.players[idx]!.donePlayThisRound) away++;
      }
      const human = game.players[humanIdx]!;
      upText = human.donePlayThisRound ? "you're done this round" : away === 0 ? "you're up next" : `you're up in ${away} turns`;
    }
  }

  // Narration beats — the recent shared-log tail, color-coded, streaming in.
  const beats = game.log.slice(-7);

  return (
    <section style={{ ...STAGE_PANEL, display: "flex", flexDirection: "column", padding: "20px 24px", background: `radial-gradient(110% 70% at 50% -10%, ${color}14, transparent 55%), ${SURFACE.panel}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ position: "relative", width: 84, height: 84, borderRadius: 999, flex: "0 0 auto", background: `linear-gradient(160deg,${color},${color}aa)`, display: "grid", placeItems: "center", boxShadow: `inset 0 1px 0 rgba(255,255,255,.4), 0 0 0 4px ${color}22` }}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 42, color: "#fff" }}>{me.name[0]}</span>
          <span style={{ position: "absolute", inset: -5, borderRadius: 999, border: `2px solid ${color}`, animation: "bb-pip 1.6s ease-in-out infinite" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color }}>{me.isBot ? "AI · on the clock" : "On the clock"}</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 30, color: C.ink, lineHeight: 1.05 }}>{me.name} is {doing}…</div>
          <div style={{ fontFamily: MONO, fontSize: 12, color: C.text2, marginTop: 4 }}>{spectating ? "Viewing the table" : upText} · <b style={{ color: C.gold }}>{me.capital}c</b> · <span style={{ color: C.prestige }}>★{reputationOf(me)}</span> · {me.rickhouse.length} barrels</div>
        </div>
        <button className="bb-btn" onClick={board.onSkip} style={{ padding: "11px 18px", borderRadius: 10, background: PRIMARY, color: PRIMARY_INK, fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", border: 0, boxShadow: PRIMARY_SHADOW, flex: "0 0 auto" }}>Skip ahead →</button>
      </div>

      <div style={{ marginTop: 18, flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: C.muted }}>Live beats</span>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 7, marginTop: 10 }}>
          {beats.map((line, i) => {
            const lc = lineColor(line, game.players);
            const newest = i === beats.length - 1;
            return (
              <div key={`${game.log.length}-${i}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 13px", borderRadius: 10, background: newest ? "#fffdf8" : "transparent", border: `1px solid ${newest ? C.border : "transparent"}`, opacity: newest ? 1 : 0.55, animation: newest ? "bb-rise .35s ease-out" : undefined }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, flex: "0 0 auto", background: lc ?? C.faint }} />
                <span style={{ fontSize: 13, color: newest ? C.ink : C.text2, lineHeight: 1.35 }}>{line}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Play stage — the Rickhouse barrel floor (departments live in the bar) ─
function DistilleryFloor(props: StageProps) {
  const { board, me, shownIdx, spectating, locked, phaseStage, rickCap } = props;
  const game = board.game;
  const agingBarrels = me.rickhouse.filter((b) => b.built);
  const restingBarrels = me.rickhouse.filter((b) => !b.built);
  const openCount = Math.max(0, rickCap - me.rickhouse.length);
  const office = fnMash(me);
  const noRoom = openCount <= 0;
  const supplyEmpty = game.mashBillSupply.length === 0;
  const isActor = !locked && phaseStage === "play";
  const accent = playerColor(shownIdx);

  return (
    <section style={{ ...STAGE_PANEL, display: "flex", flexDirection: "column", padding: 14, gap: 11 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flex: "0 0 auto" }}>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".22em", textTransform: "uppercase", color: isActor ? C.brass : accent }}>{isActor ? "Your Distillery" : `${me.name}'s Distillery`}</span>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: C.muted }}>{me.distillery.name}</span>
        {spectating && (
          <button onClick={props.onExitView} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 11px", borderRadius: 999, background: `${accent}1a`, border: `1px solid ${accent}`, cursor: "pointer", color: C.ink, fontFamily: MONO, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase" }}>👁 Viewing · back ✕</button>
        )}
        <span style={{ flex: 1, height: 1, background: `linear-gradient(90deg,${C.border},transparent)` }} />
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".08em" }}><b style={{ color: C.copper }}>{agingBarrels.length}</b><span style={{ color: C.muted }}>/{rickCap} aging</span></span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr" }}>
        <RickhouseRoom {...props} agingBarrels={agingBarrels} restingBarrels={restingBarrels} openCount={openCount} office={office} noRoom={noRoom} supplyEmpty={supplyEmpty} isActor={isActor} />
      </div>
    </section>
  );
}


const CUT_LABELS = ["A", "B", "C", "D"];
function DepartmentCard({ id, board, me }: { id: DepartmentId; board: BoardProps; me: Player }) {
  const d = me.distillery.departments.find((x) => x.id === id)!;
  const meta = DEPT_META[id];
  const realOptions = d.ultimateOptions.filter((o) => o !== "ph");
  const chosen = d.chosenUltimate && d.chosenUltimate !== "ph" ? d.chosenUltimate : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, borderRadius: 12, border: `1px solid ${C.border}`, background: `radial-gradient(90% 50% at 50% 0%, ${meta.color}12, transparent 60%), ${SURFACE.panel}`, boxShadow: CARD_SHADOW, padding: "10px 11px", minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <DeptIcon id={id} size={34} />
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 7.5, letterSpacing: ".12em", textTransform: "uppercase", color: meta.color }}>{DEPT_ROOM[id]}</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: C.ink, lineHeight: 1.05, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{meta.name}</div>
        </div>
        <ImproveBtn id={id} board={board} me={me} compact />
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: chosen ? C.gold : meta.color, opacity: chosen ? 1 : 0.5 }} />
        <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted }}>{chosen ? "Cut chosen" : `Spirit cut · open 1 of ${realOptions.length}`}</span>
      </div>

      <DeptValueTrack d={d} color={meta.color} unit={DEPT_UNIT[id]} />

      <div style={{ display: "grid", gridTemplateColumns: realOptions.length > 1 ? "1fr 1fr" : "1fr", gap: 6, paddingTop: 7, borderTop: `1px solid ${C.hairline}` }}>
        {realOptions.length === 0 && <span style={{ fontFamily: MONO, fontSize: 9, color: C.faint }}>Ultimate TBD</span>}
        {realOptions.map((o, i) => {
          const isChosen = chosen === o;
          return (
            <div key={o} style={{ padding: "5px 7px", borderRadius: 8, border: `1px solid ${isChosen ? C.gold : C.hairline}`, background: isChosen ? "rgba(176,125,40,.1)" : "#fffdf8", minWidth: 0 }}>
              <div style={{ fontFamily: MONO, fontSize: 7, letterSpacing: ".1em", textTransform: "uppercase", color: isChosen ? C.gold : C.faint }}>{isChosen ? "★ Cut" : `Cut ${CUT_LABELS[i] ?? i + 1}`}</div>
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 12.5, color: C.ink, lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ULT_LABEL[o].name}</div>
              <div title={ULT_LABEL[o].blurb} style={{ fontSize: 9, color: C.muted, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ULT_LABEL[o].blurb}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

type RickProps = StageProps & {
  agingBarrels: Bourbon[];
  restingBarrels: Bourbon[];
  openCount: number;
  office: number;
  noRoom: boolean;
  supplyEmpty: boolean;
  isActor: boolean;
};

function RickhouseRoom(props: RickProps) {
  const { board, me, zone, locked, phaseStage, rickCap, agingBarrels, restingBarrels, openCount, isActor, supplyEmpty } = props;
  const canBuild = phaseStage === "play" && !locked;
  const canDraw = isActor && !me.drewMashBillsThisTurn && !supplyEmpty && openCount > 0;

  return (
    <div style={{ position: "relative", display: "flex", flexDirection: "column", borderRadius: 13, padding: "12px 14px", border: `1px solid ${C.copper}55`, background: "radial-gradient(120% 80% at 50% 0%, rgba(181,121,58,.1), transparent 55%), linear-gradient(180deg,#fdf6ea,#f6ead2)", boxShadow: CARD_SHADOW, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 9, flex: "0 0 auto" }}>
        <span style={{ display: "inline-flex", alignItems: "center", padding: "4px 12px", borderRadius: 7, background: "linear-gradient(180deg,#e0a44e,#b06a38)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" }}>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: "#fff7ea" }}>The Rickhouse</span>
        </span>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: C.copper }}>Aging</span>
        <span style={{ fontSize: 11, color: C.muted }}>sell at {CONFIG.MIN_SELL_AGE}+</span>
        <div style={{ flex: 1 }} />
        <Pips dept="rickhouse" me={me} />
        <ImproveBtn id="rickhouse" board={board} me={me} compact />
      </div>
      {/* wood shelf rail */}
      <div style={{ height: 8, borderRadius: 4, marginBottom: 11, flex: "0 0 auto", background: "repeating-linear-gradient(90deg, rgba(120,80,40,.12) 0 2px, transparent 2px 3px), linear-gradient(180deg,#c89a5e,#a87838)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 1px 2px rgba(120,80,40,.3)" }} />

      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: `repeat(${rickCap}, minmax(0,1fr))`, gap: 10, alignContent: "start", overflow: "hidden" }}>
        {agingBarrels.map((b) => {
          const sellable = b.age >= CONFIG.MIN_SELL_AGE && b.salesRemaining > 0;
          const trackVal = barrelValue(b.quality, b.age);
          const baseValue = trackVal * zoneMultiplier(zone);
          const qc = QUALITY_CHROME[b.quality] ?? QUALITY_CHROME.common!;
          const capYear = capAge(b.quality);
          const trackSteps: { age: number; value: number }[] = [];
          for (let a = CONFIG.MIN_SELL_AGE, last = -1; a <= capYear; a++) {
            const v = barrelValue(b.quality, a);
            if (v !== last) { trackSteps.push({ age: a, value: v }); last = v; }
          }
          const activeStep = trackSteps.reduce((acc, s, i) => (b.age >= s.age ? i : acc), -1);
          return (
            <button
              key={b.id}
              data-tut="aging"
              className="bb-btn"
              onClick={() => (phaseStage === "play" && sellable && !locked ? board.setSellId(b.id) : locked ? undefined : board.flash(sellable ? "Sell in the Play phase" : `Ages until year ${CONFIG.MIN_SELL_AGE}`))}
              style={{ textAlign: "left", position: "relative", borderRadius: 12, padding: "9px 10px 10px", border: `1px solid ${qc.border}`, background: qc.bg, boxShadow: qc.glow, cursor: phaseStage === "play" && sellable ? "pointer" : "default", overflow: "hidden", minWidth: 0 }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ display: "flex", gap: 3, flex: 1, flexWrap: "wrap" }} title={`${b.salesRemaining} of ${b.batchQty} sales left`}>
                  {Array.from({ length: b.batchQty }).map((_, i) => {
                    const left = i < b.salesRemaining;
                    return <span key={i} style={{ width: 12, height: 12, borderRadius: 999, ...(left ? { background: qc.foil, boxShadow: `inset 0 1px 0 rgba(255,255,255,.5)`, border: `1px solid ${qc.ink}` } : { background: "#efe7d4", border: `1px solid ${C.border2}` }) }} />;
                  })}
                </div>
                <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#1a1206", background: qc.foil, padding: "2px 7px", borderRadius: 5 }}>{qc.label}</span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 3 }}>
                {b.tags.map((t) => (
                  <span key={t} style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: STYLE_CHROME[t].ink, background: STYLE_CHROME[t].border, padding: "1px 6px", borderRadius: 999 }}>{STYLE_LABEL[t]}</span>
                ))}
              </div>
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, color: C.ink, lineHeight: 1.05 }}>{b.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 7, paddingTop: 7, borderTop: `1px dotted ${qc.ink}55` }}>
                <span style={{ position: "relative", width: 38, height: 38, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #f7d999, #c69138 60%, #8a5a1d 100%)", display: "grid", placeItems: "center", animation: "bb-ember 3.2s ease-in-out infinite", flex: "0 0 auto" }}>
                  <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, color: "#2a1a10", lineHeight: 1 }}>{b.age}</span>
                </span>
                <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 14, color: C.ink, lineHeight: 1.1 }}>{sellable ? `sell ≈ ${baseValue}+` : "aging in oak"}</div>
              </div>
              <div style={{ marginTop: 7, padding: 6, borderRadius: 7, background: "#fffdf8", border: `1px solid ${qc.ink}2e` }}>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }} title="Capital value by age for this quality">
                  {trackSteps.map((s, i) => {
                    const active = i === activeStep;
                    const reached = i <= activeStep;
                    return (
                      <span key={s.age} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minWidth: 28, padding: "4px 6px", borderRadius: 6, lineHeight: 1, ...(active ? { background: qc.foil, color: "#1a1206", border: `1px solid ${qc.ink}` } : reached ? { background: `${qc.ink}1c`, color: qc.ink, border: `1px solid ${qc.ink}44` } : { background: "transparent", color: C.faint, border: `1px solid ${C.hairline}` }) }}>
                        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17 }}>{s.value}</span>
                        <span style={{ fontFamily: MONO, fontSize: 8, marginTop: 1, opacity: 0.85 }}>yr{s.age}</span>
                      </span>
                    );
                  })}
                </div>
              </div>
              <div style={{ textAlign: "center", marginTop: 6, padding: 4, borderRadius: 6, border: `1px solid ${qc.ink}40`, background: `${qc.ink}12`, fontFamily: MONO, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: qc.ink }}>
                {sellable ? (phaseStage === "play" ? "Tap to sell" : "Ready") : `Year ${b.age}`}
              </div>
            </button>
          );
        })}

        {restingBarrels.map((b) => {
          const ready = b.staged.length >= recipeSize(b.recipe);
          const slotList: { kind: ResourceKind; filled: boolean }[] = [];
          for (const k of PILE_ORDER) {
            const have = b.staged.filter((c) => c.kind === k).length;
            for (let i = 0; i < (b.recipe[k] ?? 0); i++) slotList.push({ kind: k, filled: i < have });
          }
          const needKinds = PILE_ORDER.filter((k) => (b.recipe[k] ?? 0) - b.staged.filter((c) => c.kind === k).length > 0);
          const stageable = needKinds.find((k) => me.hand.some((c) => c.kind === k));
          const enabled = canBuild && (ready || !!stageable);
          const label = ready ? "✓ Build now" : stageable ? `+ Stage ${FACE[stageable].label}` : `Needs ${needKinds.map((k) => FACE[k].mono).join(" ")}`;
          const tone = ready
            ? { border: 0, color: "#fff", background: "linear-gradient(180deg,#56a87c,#2f6347)" }
            : stageable
              ? { border: 0, color: PRIMARY_INK, background: PRIMARY }
              : { border: `1px solid ${C.border}`, color: C.muted, background: SURFACE.inset };
          return (
            <div key={b.id} data-tut="resting" style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
              <div onContextMenu={(e) => { e.preventDefault(); board.onInspect({ kind: "bill", bill: b }); }} style={{ position: "relative", borderRadius: 11, padding: "10px 11px", border: `1px solid ${C.border}`, background: "linear-gradient(180deg,#fffdf8,#f3ecdb)", boxShadow: CARD_SHADOW, overflow: "hidden", flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted }}>Resting Bill</span>
                  <div style={{ flex: 1 }} />
                  {b.tags.map((t) => (
                    <span key={t} style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: STYLE_CHROME[t].ink, background: STYLE_CHROME[t].border, padding: "1px 6px", borderRadius: 999 }}>{STYLE_LABEL[t]}</span>
                  ))}
                  <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); board.onInspect({ kind: "bill", bill: b }); }} title="Inspect this bill" style={{ width: 17, height: 17, borderRadius: 999, display: "grid", placeItems: "center", fontFamily: SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 11, color: C.brass, border: `1px solid ${C.border}`, background: "#fffdf8", cursor: "pointer" }}>i</span>
                </div>
                <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, color: C.ink, lineHeight: 1.05, marginTop: 2 }}>{b.name}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {slotList.map(({ kind: k, filled }, i) => (
                    <span key={i} style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1, width: 38, height: 40, borderRadius: 9, ...(filled ? { background: KIND_CHROME[k].grad, border: `1.5px solid ${KIND_CHROME[k].border}` } : { background: SURFACE.inset, border: `1.5px dashed ${C.border2}` }) }}>
                      {resMark(k, 18, filled ? KIND_CHROME[k].ink : C.faint)}
                      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 7, color: filled ? KIND_CHROME[k].ink : C.faint }}>{FACE[k].mono}</span>
                    </span>
                  ))}
                  <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: C.text2, marginLeft: 2 }}>{b.staged.length}/{recipeSize(b.recipe)}</span>
                </div>
              </div>
              <button className="bb-btn" disabled={!enabled} onClick={() => (ready ? props.tryBuild(b) : stageable ? props.autoStage(b) : board.flash(`"${b.name}" needs ${needKinds.map((k) => FACE[k].label).join(", ")}`))} style={{ padding: 6, borderRadius: 8, fontFamily: MONO, fontWeight: 600, fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", cursor: enabled ? "pointer" : "default", opacity: enabled ? 1 : 0.7, ...tone }}>{label}</button>
            </div>
          );
        })}

        {Array.from({ length: openCount }).map((_, i) => (
          <div key={`open${i}`} style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
            <div style={{ position: "relative", flex: 1, minHeight: 110, borderRadius: 11, border: `1.5px dashed ${C.brass}88`, background: "radial-gradient(70% 60% at 50% 30%, rgba(207,138,51,.08), transparent 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: 12, animation: "bb-shelf 3.6s ease-in-out infinite" }}>
              <span style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${C.faint}`, display: "grid", placeItems: "center", fontFamily: SERIF, fontSize: 17, color: C.muted }}>+</span>
              <span style={{ fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted, textAlign: "center", lineHeight: 1.6 }}>Open<br />Barrel Slot</span>
            </div>
            <button
              data-tut="draw"
              className="bb-btn"
              disabled={!canDraw}
              onClick={() => (canDraw ? board.setDrawingBills(true) : board.flash(me.drewMashBillsThisTurn ? "Bills drawn this turn" : "Draw during the Play phase"))}
              style={{ padding: 6, borderRadius: 8, fontFamily: MONO, fontWeight: 700, fontSize: 9.5, letterSpacing: ".06em", textTransform: "uppercase", cursor: canDraw ? "pointer" : "default", border: 0, opacity: canDraw ? 1 : 0.55, color: canDraw ? PRIMARY_INK : C.faint, background: canDraw ? PRIMARY : SURFACE.inset }}
            >
              ＋ Draw a mash bill
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Right rail — "The Market" (persistent in every phase) ─────────────
function MarketRail({ game, zone, privateCards }: { game: GameState; zone: Zone; privateCards: DemandCard[] }) {
  const count = game.demandCards.length;
  const toCrash = CONFIG.DEMAND_CRASH_AT - count;
  const zoneMeta = ZONE_META[zone];
  const maxSlots = CONFIG.DEMAND_CRASH_AT - 1;
  return (
    <aside data-tut="market" style={{ display: "flex", flexDirection: "column", gap: 9, borderRadius: 16, background: SURFACE.rail, border: `1px solid ${C.border}`, boxShadow: PANEL_SHADOW, padding: 12, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flex: "0 0 auto" }}>
        <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: ".2em", textTransform: "uppercase", color: C.brass }}>The Market</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: C.ink }} title="orders on the table">{count}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: MONO, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: "#fff", background: zoneMeta.color, padding: "4px 9px", borderRadius: 6 }} title="Demand zone multiplies (bourbon value + order value) at sale">
          {zoneMeta.label}<span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17 }}>×{zoneMultiplier(zone)}</span>
        </span>
      </div>

      {/* private orders — pinned above the public market; only you can fill them */}
      {privateCards.length > 0 && (
        <div style={{ flex: "0 0 auto", display: "flex", flexDirection: "column", gap: 5, padding: "7px 9px", borderRadius: 10, background: "rgba(138,95,176,.08)", border: `1px solid ${C.prestige}55` }}>
          <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: C.prestige }}>Your Private Orders · outside the count</span>
          {privateCards.map((c) => {
            const filled = c.filledBy.filter((f) => f !== null).length;
            return (
              <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>{c.label}</span>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.amber }}>{requirementText(c.requirement)}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.gold }}>+{c.orderValue}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.prestige }}>★{c.reputation}</span>
                <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: C.text2 }}>{filled}/{c.slotsActive}</span>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ position: "relative", flex: 1, minHeight: 0, display: "flex", flexDirection: "column", borderRadius: 12, border: `1px solid ${C.border}`, background: "#fffdf8", overflow: "hidden" }}>
        <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderBottom: `1px dashed ${toCrash <= 1 ? C.red : C.border2}` }}>
          <span style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: ".14em", textTransform: "uppercase", color: toCrash <= 1 ? C.red : C.muted }}>▲ crash at {CONFIG.DEMAND_CRASH_AT}</span>
          <div style={{ flex: 1 }} />
          {toCrash <= 1 && <span style={{ fontFamily: MONO, fontSize: 9.5, color: C.red }}>⚠ crash next draw</span>}
        </div>
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "5px 6px 6px" }}>
          {(() => {
            const rows: React.ReactNode[] = [];
            for (let s = maxSlots; s >= 1; s--) {
              const z = zoneForCardCount(s);
              const below = s > 1 ? zoneForCardCount(s - 1) : null;
              const card = game.demandCards[s - 1];
              const zc = ZONE_META[z].color;
              const liveZone = z === zone;
              rows.push(
                <div key={`s${s}`} style={{ flex: 1, minHeight: 0, display: "flex", borderRadius: 9, background: liveZone ? `${zc}18` : `${zc}0a`, border: `1px ${card ? "solid" : "dashed"} ${card ? C.border : `${zc}44`}`, marginBottom: 4, overflow: "hidden" }}>
                  {card ? <DemandRow card={card} zone={zone} players={game.players} /> : <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: `${zc}88` }}>empty</div>}
                </div>,
              );
              if (below && below !== z) {
                rows.push(
                  <div key={`d${s}`} style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 7, padding: "1px 2px 5px" }}>
                    <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: zc, opacity: liveZone ? 1 : 0.7 }}>{ZONE_META[z].label} ×{zoneMultiplier(z)}</span>
                    <span style={{ flex: 1, height: 1, background: `${zc}${liveZone ? "aa" : "55"}` }} />
                    <span style={{ fontFamily: MONO, fontSize: 8, color: C.muted }}>{s}+ cards</span>
                  </div>,
                );
              }
            }
            return rows;
          })()}
        </div>
      </div>
    </aside>
  );
}

function DemandRow({ card, zone, players }: { card: DemandCard; zone: Zone; players: Player[] }) {
  const filled = card.filledBy.filter((f) => f !== null).length;
  const complete = filled >= card.slotsActive;
  const compact = card.slotsActive > 8;
  const reqTags = card.requirement.tags ?? [];
  const accent = reqTags.length ? STYLE_CHROME[reqTags[0]!].border : null;
  const otherReqs: string[] = [];
  if (card.requirement.quality) otherReqs.push(`${card.requirement.quality}+`);
  if (card.requirement.minAge !== undefined) otherReqs.push(`age ${card.requirement.minAge}+`);
  const open = reqTags.length === 0 && otherReqs.length === 0;
  return (
    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", gap: 5, borderRadius: 9, padding: "8px 11px", background: complete ? "linear-gradient(180deg, rgba(62,125,89,.16), #fffdf8)" : "#fffdf8", borderLeft: accent ? `3px solid ${accent}` : complete ? `3px solid ${C.green}` : "3px solid transparent" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, color: C.ink, lineHeight: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{card.label}</span>
        <div style={{ flex: 1 }} />
        {reqTags.map((t) => (
          <span key={t} title={`Requires a ${STYLE_LABEL[t]} bourbon`} style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: STYLE_CHROME[t].ink, background: STYLE_CHROME[t].border, padding: "2px 7px", borderRadius: 999 }}>{STYLE_LABEL[t]}</span>
        ))}
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.gold }} title="order value">+{card.orderValue}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 999, background: "rgba(138,95,176,.14)", border: `1px solid ${C.prestige}` }} title="prestige on completion">
          <span style={{ fontSize: 14, color: C.prestige, lineHeight: 1 }}>★</span>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: C.prestige, lineHeight: 1 }}>{card.reputation}</span>
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted }}>Req</span>
        {otherReqs.map((r) => <span key={r} style={{ fontFamily: MONO, fontSize: 11, color: C.amber, whiteSpace: "nowrap" }}>{r}</span>)}
        {open && <span style={{ fontFamily: MONO, fontSize: 11, color: C.green, whiteSpace: "nowrap" }}>any bourbon</span>}
        {!open && reqTags.length > 0 && otherReqs.length === 0 && <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted, whiteSpace: "nowrap" }}>matching tag</span>}
        <div style={{ flex: 1 }} />
        {compact ? (
          <div style={{ width: 80, height: 10, borderRadius: 6, background: SURFACE.inset, border: `1px solid ${C.border2}`, overflow: "hidden" }}>
            <div style={{ width: `${Math.round((filled / card.slotsActive) * 100)}%`, height: "100%", background: complete ? C.green : PRIMARY }} />
          </div>
        ) : (
          <div style={{ display: "flex", gap: 3 }}>
            {card.filledBy.map((f, i) => {
              const pi = f ? players.findIndex((pl) => pl.id === f) : -1;
              return <span key={i} style={{ width: 16, height: 16, borderRadius: 4, ...(f ? { background: playerColor(pi), boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" } : { background: SURFACE.inset, border: `1.5px dashed ${C.border2}` }) }} />;
            })}
          </div>
        )}
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 700, color: complete ? C.green : C.text2 }}>{filled}/{card.slotsActive}</span>
      </div>
    </div>
  );
}

// ── Table Log — full-width narration ticker (dark strip for contrast) ──
function TableLog({ game }: { game: GameState }) {
  const lines = game.log.slice(-5);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "9px 16px", borderRadius: 12, background: "linear-gradient(180deg,#2a1d11,#211608)", border: `1px solid ${C.copper}66`, boxShadow: "inset 0 1px 0 rgba(255,255,255,.06)", flex: "0 0 auto", overflow: "hidden" }}>
      <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "#cf9a5e", flex: "0 0 auto" }}>Table Log</span>
      <div style={{ display: "flex", alignItems: "center", gap: 18, flex: 1, minWidth: 0, overflow: "hidden" }}>
        {lines.map((line, i) => {
          const lc = lineColor(line, game.players);
          const newest = i === lines.length - 1;
          return (
            <div key={`${game.log.length}-${i}`} style={{ display: "flex", alignItems: "center", gap: 7, flex: newest ? "1 1 auto" : "0 1 auto", minWidth: 0, opacity: newest ? 1 : 0.45, animation: newest ? "bb-rise .3s ease-out" : undefined }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, flex: "0 0 auto", background: lc ?? "#8a7458" }} />
              <span style={{ fontSize: 12, color: newest ? "#f3e6cf" : "#bda886", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{line}</span>
            </div>
          );
        })}
        {lines.length === 0 && <span style={{ fontSize: 12, color: "#8a7458" }}>The table is quiet…</span>}
      </div>
    </div>
  );
}

// ── Mash-bill picker (Play "Draw a mash bill") ─────────────────────────
function BillPicker({ board }: { board: BoardProps }) {
  const game = board.game;
  const me = game.players[game.currentPlayerIndex]!;
  const office = fnMash(me);
  const offer = game.mashBillSupply.slice(0, Math.min(office, game.mashBillSupply.length));
  const cap = Math.max(0, fnRick(me) - me.rickhouse.length);
  return (
    <Scrim>
      <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: C.ink }}>Draw a Mash Bill</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>Click to keep up to {cap} as resting barrels · the rest cycle back.</div>
      <div data-tut="bills" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", alignItems: "stretch", maxWidth: 980 }}>
        {offer.map((bill, i) => {
          const sel = board.keepBills.has(i);
          return (
            <button
              key={bill.id}
              className="bb-card"
              onClick={() => { const n = new Set(board.keepBills); n.has(i) ? n.delete(i) : n.add(i); board.setKeepBills(n); }}
              onContextMenu={(e) => { e.preventDefault(); board.onInspect({ kind: "bill", bill }); }}
              title="Click to keep · right-click to inspect"
              style={{ position: "relative", width: 200, textAlign: "left", display: "flex", flexDirection: "column", gap: 7, padding: "13px 14px", borderRadius: 14, cursor: "pointer", overflow: "hidden", border: `2px solid ${sel ? C.green : C.border}`, background: sel ? "linear-gradient(180deg,#f1f9f2,#e6f1e8)" : SURFACE.panel, boxShadow: sel ? "0 0 0 3px rgba(62,125,89,.18), " + CARD_SHADOW : CARD_SHADOW }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                {sel ? <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.green }}>✓ kept</span>
                  : <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); board.onInspect({ kind: "bill", bill }); }} title="Inspect" style={{ width: 18, height: 18, borderRadius: 999, display: "grid", placeItems: "center", fontFamily: SERIF, fontStyle: "italic", fontWeight: 700, fontSize: 11, color: C.brass, border: `1px solid ${C.border}`, background: "#fffdf8" }}>i</span>}
                <div style={{ flex: 1 }} />
                {bill.tags.map((t) => (
                  <span key={t} style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: STYLE_CHROME[t].ink, background: STYLE_CHROME[t].border, padding: "2px 7px", borderRadius: 999 }}>{STYLE_LABEL[t]}</span>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 19, lineHeight: 1.05, color: C.ink }}>{bill.name}</div>
                {bill.slogan && <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 11, lineHeight: 1.25, color: C.muted, marginTop: 2 }}>{bill.slogan}</div>}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {PILE_ORDER.filter((k) => (bill.recipe[k] ?? 0) > 0).map((k) => (
                  <span key={k} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 7px", borderRadius: 7, border: `1px solid ${KIND_CHROME[k].border}`, background: KIND_CHROME[k].grad }}>
                    {resMark(k, 14, KIND_CHROME[k].ink)}
                    <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 13, color: KIND_CHROME[k].ink, lineHeight: 1 }}>{bill.recipe[k]}</span>
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: "auto", paddingTop: 8, borderTop: `1px dotted ${C.border2}` }}>
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: C.gold, lineHeight: 1 }} title="Sales scale with quality">{1 + bill.batchQtyBias}–3</span>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>sales · by quality</span>
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12 }}>
        <button onClick={() => { board.setDrawingBills(false); board.setKeepBills(new Set()); }} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", color: C.muted, background: "none", border: 0, cursor: "pointer", textTransform: "uppercase" }}>cancel</button>
        <button data-tut="keep" className="bb-btn" onClick={() => board.dispatch({ type: "DRAW_MASH_BILLS", keepIndexes: [...board.keepBills] })} style={{ padding: "11px 22px", borderRadius: 10, border: 0, cursor: "pointer", fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: PRIMARY_INK, background: PRIMARY, boxShadow: PRIMARY_SHADOW }}>Keep {board.keepBills.size} →</button>
      </div>
    </Scrim>
  );
}

// ── overlays + leaves ────────────────────────────────────────────────
function Scrim({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(60,42,22,.42)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, zIndex: 60 }}>
      {children}
    </div>
  );
}

function ResMiniCard({ kind, quality, pending, onClick }: { kind: ResourceKind; quality?: Quality; pending?: boolean; onClick: () => void }) {
  const m = SUB[kind];
  const kc = KIND_CHROME[kind];
  const q = quality ? QUALITY_CHROME[quality] : null;
  return (
    <button
      className="bb-card"
      onClick={onClick}
      title={`${quality ? quality + " " : pending ? "blind " : ""}${m.label} — click to inspect`}
      style={{ position: "relative", width: 44, height: 60, borderRadius: 8, overflow: "hidden", display: "flex", flexDirection: "column", cursor: "pointer", padding: 0, background: kc.grad, border: `1px solid ${kc.border}`, boxShadow: CARD_SHADOW }}
    >
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, padding: "4px 2px 0" }}>
        <span style={{ fontFamily: MONO, fontSize: 6, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: kc.ink }}>{m.label}</span>
        {pending ? <span style={{ fontSize: 20, lineHeight: 1, color: kc.ink }}>?</span> : resMark(kind, 22, kc.ink)}
      </div>
      <div style={{ height: 5, width: "100%", background: pending ? `repeating-linear-gradient(45deg,${kc.border} 0,${kc.border} 4px,#fffdf8 4px,#fffdf8 8px)` : q ? q.foil : "#bcae90" }} aria-hidden />
    </button>
  );
}

function InspectOverlay({ inspect, onClose }: { inspect: Inspect; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(60,42,22,.5)", backdropFilter: "blur(5px)", display: "grid", placeItems: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: 560, maxWidth: "92vw" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: -12, right: -12, zIndex: 2, width: 32, height: 32, borderRadius: 999, border: `1px solid ${C.border}`, background: SURFACE.panel, color: C.muted, cursor: "pointer", fontFamily: MONO, fontSize: 13, boxShadow: CARD_SHADOW }}>✕</button>
        {inspect.kind === "bill" ? (
          <BillDetail bill={inspect.bill} />
        ) : (
          <ResourceDetail
            kind={inspect.kind === "resource" ? inspect.card.kind : inspect.k}
            quality={inspect.kind === "resource" ? inspect.card.quality : undefined}
            name={inspect.kind === "resource" ? inspect.card.name : undefined}
            pending={inspect.kind === "pending"}
          />
        )}
      </div>
    </div>
  );
}

const KIND_USE: Record<ResourceKind, string> = {
  cask: "The charred-oak cask every bourbon needs — exactly one per mash bill.",
  corn: "Corn is the bourbon backbone — every recipe needs at least one.",
  rye: "A grain with the high-rye style tag that some demand orders ask for.",
  wheat: "A grain with the wheated style tag that some demand orders ask for.",
  barley: "A grain that rounds out four-grain and classic recipes.",
};

function ResourceDetail({ kind, quality, name, pending }: { kind: ResourceKind; quality?: Quality; name?: string; pending?: boolean }) {
  const m = SUB[kind];
  const kc = KIND_CHROME[kind];
  const q = quality ? QUALITY_CHROME[quality] : null;
  const heading = name ?? `${q ? q.label + " " : ""}${m.label}`;
  return (
    <article style={{ display: "flex", gap: 18, borderRadius: 16, border: `2px solid ${kc.border}`, background: SURFACE.panel, padding: 22, boxShadow: PANEL_SHADOW }}>
      <div style={{ position: "relative", width: 150, height: 200, flex: "0 0 auto", borderRadius: 12, border: `2px solid ${kc.border}`, background: kc.grad, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: kc.ink }}>{m.label}</span>
        {pending ? <span style={{ fontSize: 64, lineHeight: 1, color: kc.ink }}>?</span> : resMark(kind, 58, kc.ink)}
        {q ? (
          <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#1a1206", background: q.foil, padding: "3px 10px", borderRadius: 5 }}>{q.label}</span>
        ) : (
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".12em", textTransform: "uppercase", color: kc.ink, opacity: 0.7 }}>blind quality</span>
        )}
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10, color: C.ink }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: C.muted }}>Resource</span>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, lineHeight: 1.05 }}>{heading}</span>
        <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: SURFACE.inset, padding: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: C.muted }}>Use</span>
          <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, color: C.text2 }}>{KIND_USE[kind]}</p>
        </div>
        <div style={{ fontFamily: MONO, fontSize: 12, lineHeight: 1.6, color: C.text2 }}>
          {pending
            ? "Drawn blind on DRAFT — you'll see its quality once it lands in your Warehouse."
            : `Quality ${q?.label}. The best-quality card you commit sets the built barrel's tier — a higher tier rides a richer age-value track.`}
        </div>
      </div>
    </article>
  );
}

function BillDetail({ bill }: { bill: BillLike }) {
  return (
    <article style={{ display: "flex", flexDirection: "column", gap: 12, borderRadius: 16, border: `2px solid ${C.brass}`, background: SURFACE.panel, padding: 22, boxShadow: PANEL_SHADOW }}>
      <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".2em", textTransform: "uppercase", color: C.brass }}>Mash Bill · {STYLE_LABEL[bill.styleTag]}</span>
      <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, color: C.ink, lineHeight: 1.05 }}>{bill.name}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {recipeKinds(bill.recipe).map((k, i) => (
          <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 11px", borderRadius: 8, border: `1px solid ${KIND_CHROME[k].border}`, background: KIND_CHROME[k].grad }}>
            {resMark(k, 18, KIND_CHROME[k].ink)}
            <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".06em", color: KIND_CHROME[k].ink }}>{SUB[k].label}</span>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {bill.tags.map((t) => (
          <span key={t} style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: STYLE_CHROME[t].ink, background: STYLE_CHROME[t].border, padding: "3px 10px", borderRadius: 999 }} title={`Fills ${STYLE_LABEL[t]} demand orders`}>{STYLE_LABEL[t]}</span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, fontFamily: MONO, fontSize: 12, color: C.text2 }}>
        <span><b style={{ color: C.gold }}>{1 + bill.batchQtyBias}–3</b> sales · by quality</span>
      </div>
      <div style={{ borderRadius: 10, border: `1px solid ${C.border}`, background: SURFACE.inset, padding: 12 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".15em", textTransform: "uppercase", color: C.muted }}>Use</span>
        <p style={{ marginTop: 6, fontSize: 14, lineHeight: 1.5, color: C.text2 }}>
          Draw it as a resting barrel, then stage its recipe (every bill needs 1 cask + 1 corn + a grain) and Make Bourbon. Sales scale with the built barrel&apos;s quality — Common is one-and-done, top tiers yield up to 3.
        </p>
      </div>
    </article>
  );
}

// ── Collect dice tray: roll-in animation + click-to-draft ─────────────
const ROLL_MS = 820;
const ALL_FACES: DieFace[] = ["cask", "corn", "rye", "wheat", "barley", "anything"];

function DiceTray({ dice, rollId, animate, mode, selectedIds, full, locked, onDie }: {
  dice: { id: string; face: DieFace }[];
  rollId: string;
  animate: boolean;
  mode: "keep" | "claim";
  selectedIds: Set<string>;
  full: boolean;
  locked?: boolean;
  onDie: (id: string, face: DieFace, el: HTMLElement) => void;
}) {
  const [rolling, setRolling] = useState(animate);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!animate) { setRolling(false); return; }
    setRolling(true);
    setTick(0);
    const iv = window.setInterval(() => setTick((t) => t + 1), 75);
    const to = window.setTimeout(() => setRolling(false), ROLL_MS);
    return () => { window.clearInterval(iv); window.clearTimeout(to); };
  }, [rollId, animate]);

  const keepMode = mode === "keep";
  return (
    <div data-tut="dice" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
      {dice.map((d, i) => {
        const face = rolling ? ALL_FACES[(tick + i * 2) % ALL_FACES.length]! : d.face;
        const meta = FACE[face];
        const selected = !rolling && selectedIds.has(d.id);
        const claimed = !keepMode && selected;
        const kept = keepMode && selected;
        const clickable = !rolling && !locked && (keepMode || claimed || !full);
        const wild = meta.wild;
        const ring = claimed ? C.green : kept ? C.gold : "rgba(120,90,50,.3)";
        return (
          <div key={d.id} style={{ position: "relative", width: 96, height: 112, display: "flex", justifyContent: "center" }}>
            {rolling && (
              <span className="bb-roll-shadow" style={{ position: "absolute", bottom: 0, width: 80, height: 8, borderRadius: "50%", background: "rgba(120,90,50,.4)", filter: "blur(3px)", animationDelay: `${i * 55}ms` }} aria-hidden />
            )}
            <button
              className={`${rolling ? "bb-roll-drop" : "bb-die"}${clickable ? " clk" : ""}`}
              disabled={!clickable}
              onClick={(e) => (rolling ? undefined : onDie(d.id, d.face, e.currentTarget))}
              style={{
                position: "absolute",
                top: 0,
                width: 96,
                height: 96,
                borderRadius: 18,
                animationDelay: rolling ? `${i * 55}ms` : undefined,
                background: claimed ? "linear-gradient(180deg,#f3ecdb,#e6dcc6)" : `linear-gradient(180deg, rgba(255,255,255,.32), rgba(0,0,0,.1) 70%), ${meta.color}`,
                border: `2px solid ${ring}`,
                boxShadow: kept
                  ? `0 0 16px ${meta.color}, inset 0 1px 0 rgba(255,255,255,.5)`
                  : claimed
                    ? "inset 0 0 0 1px rgba(62,125,89,.35)"
                    : "inset 0 1px 0 rgba(255,255,255,.4), 0 6px 14px rgba(120,90,50,.3)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 4,
                cursor: clickable ? "pointer" : "default",
                opacity: claimed ? 0.7 : keepMode && !kept ? 0.85 : 1,
                padding: 0,
                ...(wild && !claimed && !rolling ? { animation: "bb-wild-shimmer 2.4s ease-in-out infinite" } : {}),
              }}
              title={keepMode ? (kept ? "Kept — tap to release" : `Tap to keep this ${meta.label}`) : claimed ? "Tap to un-draft" : clickable ? `Draft ${meta.label}` : ""}
            >
              {face === "anything"
                ? <span style={{ fontSize: 38, lineHeight: 1, color: claimed ? C.green : "#3a2410" }}>✦</span>
                : resMark(face as ResourceKind, 36, claimed ? C.green : "#241608")}
              <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".14em", textTransform: "uppercase", color: claimed ? C.green : "rgba(36,22,8,.85)" }}>{meta.label}</span>
              {claimed && <span style={{ position: "absolute", top: -9, right: -8, fontFamily: MONO, fontSize: 7.5, letterSpacing: ".06em", color: "#fff", background: C.green, padding: "2px 6px", borderRadius: 5 }}>DRAFTED</span>}
              {kept && <span style={{ position: "absolute", top: -9, right: -8, fontFamily: MONO, fontSize: 7.5, letterSpacing: ".06em", color: "#fff", background: C.gold, padding: "2px 6px", borderRadius: 5 }}>KEEP</span>}
            </button>
          </div>
        );
      })}
    </div>
  );
}

interface Flight { id: number; x0: number; y0: number; x1: number; y1: number; kind: ResourceKind; }

function FlightLayer({ flights }: { flights: Flight[] }) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 55, overflow: "visible" }}>
      {flights.map((f) => <FlyCard key={f.id} flight={f} />)}
    </div>
  );
}

function FlyCard({ flight }: { flight: Flight }) {
  const [go, setGo] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true)));
    return () => cancelAnimationFrame(r);
  }, []);
  const kc = KIND_CHROME[flight.kind];
  const dx = go ? flight.x1 - flight.x0 : 0;
  const dy = go ? flight.y1 - flight.y0 : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: flight.x0,
        top: flight.y0,
        width: 44,
        height: 60,
        marginLeft: -22,
        marginTop: -30,
        borderRadius: 8,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        background: kc.grad,
        border: `1px solid ${kc.border}`,
        boxShadow: `0 8px 20px ${kc.border}55`,
        transform: `translate(${dx}px, ${dy}px) scale(${go ? 0.55 : 1.04}) rotate(${go ? 12 : 0}deg)`,
        opacity: go ? 0.15 : 1,
        transition: "transform .56s cubic-bezier(.5,0,.35,1), opacity .56s ease-in",
        willChange: "transform, opacity",
      }}
    >
      {resMark(flight.kind, 22, kc.ink)}
    </div>
  );
}

function PileChooser({ title, onPick, onCancel }: { title: string; onPick: (k: ResourceKind) => void; onCancel: () => void }) {
  return (
    <Scrim>
      <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: C.ink }}>{title}</div>
      <div style={{ display: "flex", gap: 10 }}>
        {PILE_ORDER.map((k) => (
          <button key={k} className="bb-card" onClick={() => onPick(k)} style={{ width: 70, height: 70, borderRadius: 12, background: KIND_CHROME[k].grad, border: `1px solid ${KIND_CHROME[k].border}`, boxShadow: CARD_SHADOW, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
            {resMark(k, 28, KIND_CHROME[k].ink)}
            <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", color: KIND_CHROME[k].ink }}>{SUB[k].label}</span>
          </button>
        ))}
      </div>
      <button onClick={onCancel} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", color: C.muted, background: "none", border: 0, cursor: "pointer", textTransform: "uppercase" }}>cancel</button>
    </Scrim>
  );
}

function FaceChooser({ title, onPick, onCancel }: { title: string; onPick: (f: DieFace) => void; onCancel: () => void }) {
  return (
    <Scrim>
      <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: C.ink }}>{title}</div>
      <div style={{ display: "flex", gap: 10 }}>
        {(["cask", "corn", "rye", "wheat", "barley", "anything"] as DieFace[]).map((k) => {
          const isWild = k === "anything";
          const grad = isWild ? "linear-gradient(180deg,#f3ead6,#fffdf8)" : KIND_CHROME[k as ResourceKind].grad;
          const border = isWild ? C.brass : KIND_CHROME[k as ResourceKind].border;
          const ink = isWild ? C.brass : KIND_CHROME[k as ResourceKind].ink;
          return (
            <button key={k} className="bb-card" onClick={() => onPick(k)} style={{ width: 70, height: 70, borderRadius: 12, background: grad, border: `1px solid ${border}`, boxShadow: CARD_SHADOW, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
              {isWild ? <span style={{ fontSize: 24, lineHeight: 1, color: ink }}>✦</span> : resMark(k as ResourceKind, 28, ink)}
              <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", color: ink }}>{FACE[k].label}</span>
            </button>
          );
        })}
      </div>
      <button onClick={onCancel} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", color: C.muted, background: "none", border: 0, cursor: "pointer", textTransform: "uppercase" }}>cancel</button>
    </Scrim>
  );
}

function SellOverlay({ game, me, bourbon, zone, onRoute, onCancel }: {
  game: GameState;
  me: Player;
  bourbon: Bourbon;
  zone: Zone;
  onRoute: (demandCardId?: string) => void;
  onCancel: () => void;
}) {
  const trackVal = barrelValue(bourbon.quality, bourbon.age);
  const mult = zoneMultiplier(zone);
  // Public table orders first, then this player's private orders (pay at the same current zone).
  const options = [...game.demandCards, ...me.privateCards].map((c) => {
    const open = c.filledBy.indexOf(null) >= 0;
    const fits = meetsRequirement(bourbon, c.requirement);
    const filled = c.filledBy.filter((f) => f !== null).length;
    const completes = open && filled + 1 >= c.slotsActive;
    const isPrivate = me.privateCards.some((pc) => pc.id === c.id);
    return { card: c, open, fits, completes, isPrivate, payoff: (trackVal + c.orderValue) * mult };
  });
  return (
    <Scrim>
      <div style={{ width: 560, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14, padding: 28, borderRadius: 16, border: `1px solid ${C.border}`, background: SURFACE.panel, boxShadow: PANEL_SHADOW }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: C.brass }}>Sell · {STYLE_LABEL[bourbon.styleTag]} · {bourbon.quality} · age {bourbon.age}</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, color: C.ink }}>{bourbon.name}</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>(value {trackVal} <span style={{ color: ZONE_META[zone].color }}>+ order</span>) <span style={{ color: ZONE_META[zone].color }}>× {mult} {ZONE_META[zone].label}</span>. Route to a matching order.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 360, overflowY: "auto" }}>
          {options.filter((o) => o.fits).length === 0 && (
            <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted, padding: "14px 4px", textAlign: "center", lineHeight: 1.5 }}>
              No order on the table accepts this bourbon yet.<br />Wait for a matching demand card.
            </div>
          )}
          {options.filter((o) => o.fits).map(({ card, open, completes, payoff, isPrivate }) => (
            <button key={card.id} className="bb-btn" disabled={!open} onClick={() => onRoute(card.id)} style={{ textAlign: "left", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 10, cursor: open ? "pointer" : "default", border: `1px solid ${isPrivate ? C.prestige : open ? C.brass : C.border2}`, background: open ? "#fffdf8" : SURFACE.inset, opacity: open ? 1 : 0.6 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: C.ink }}>{card.label}{isPrivate && <span style={{ marginLeft: 7, fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "#fff", background: C.prestige, padding: "1px 6px", borderRadius: 4, verticalAlign: "middle" }}>Private</span>}</div>
                <div style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>{requirementText(card.requirement)} · {card.filledBy.filter((f) => f).length}/{card.slotsActive} slots</div>
              </div>
              {open ? (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20, color: C.gold }}>+{payoff}</div>
                  {completes && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "3px 9px", borderRadius: 999, background: "rgba(138,95,176,.14)", border: `1px solid ${C.prestige}` }}>
                      <span style={{ fontSize: 13, color: C.prestige }}>★</span>
                      <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20, color: C.prestige, lineHeight: 1 }}>{card.reputation}</span>
                    </span>
                  )}
                </div>
              ) : (
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>no open slot</div>
              )}
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", color: C.muted, background: "none", border: 0, cursor: "pointer", textTransform: "uppercase", alignSelf: "center" }}>cancel</button>
      </div>
    </Scrim>
  );
}

function UltimateOverlay({ dept, onChoose, onCancel }: {
  dept: Player["distillery"]["departments"][number];
  onChoose: (ult: UltimateId, pile?: ResourceKind) => void;
  onCancel: () => void;
}) {
  const [pendingProspect, setPendingProspect] = useState(false);
  const options = dept.ultimateOptions.filter((o) => o !== "ph");
  if (pendingProspect) {
    return <PileChooser title="Prospector — commit to which pile?" onPick={(k) => onChoose("prospector", k)} onCancel={() => setPendingProspect(false)} />;
  }
  return (
    <Scrim>
      <div style={{ width: 520, maxWidth: "90vw", display: "flex", flexDirection: "column", gap: 14, padding: 28, borderRadius: 16, border: `1px solid ${C.border}`, background: SURFACE.panel, boxShadow: PANEL_SHADOW }}>
        <div>
          <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: C.brass }}>{dept.name} · Ultimate</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: C.ink }}>Choose your ultimate</div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>Permanent. This is the top of the branch.</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {options.map((u) => (
            <button key={u} className="bb-btn" onClick={() => (u === "prospector" ? setPendingProspect(true) : onChoose(u))} style={{ textAlign: "left", padding: "11px 14px", borderRadius: 10, cursor: "pointer", border: `1px solid ${C.brass}`, background: "#fffdf8" }}>
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 17, color: C.gold }}>{ULT_LABEL[u].name}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.text2, marginTop: 2 }}>{ULT_LABEL[u].blurb}</div>
            </button>
          ))}
        </div>
        <button onClick={onCancel} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", color: C.muted, background: "none", border: 0, cursor: "pointer", textTransform: "uppercase", alignSelf: "center" }}>cancel</button>
      </div>
    </Scrim>
  );
}

function EndScreen({ game, onNew }: { game: GameState; onNew: () => void }) {
  const ranked = [...game.players]
    .map((pl) => ({ name: pl.name, capital: pl.capital, reputation: reputationOf(pl), total: pl.capital + reputationOf(pl), cards: pl.keptCards.length }))
    .sort((a, b) => b.total - a.total);
  return (
    <div style={{ position: "relative", width: 1920, height: 1080, display: "grid", placeItems: "center", background: "radial-gradient(120% 90% at 50% -10%, rgba(207,138,51,.1), transparent 60%), linear-gradient(160deg,#f6efe1,#e4d8c0)", color: C.ink }}>
      <div style={{ width: 640, display: "flex", flexDirection: "column", gap: 18, padding: 40, borderRadius: 18, border: `1px solid ${C.border}`, background: SURFACE.panel, boxShadow: PANEL_SHADOW }}>
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 42, color: C.gold }}>Last Call</div>
        <div style={{ fontSize: 14, color: C.text2 }}>The demand deck ran dry. Final standings — Capital + Prestige.</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {ranked.map((r, i) => (
            <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 16px", borderRadius: 11, border: `1px solid ${i === 0 ? C.brass : C.border2}`, background: i === 0 ? "linear-gradient(90deg,rgba(207,138,51,.16),#fffdf8)" : "#fffdf8" }}>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: i === 0 ? C.gold : C.muted, width: 28 }}>{i + 1}</span>
              <span style={{ flex: 1, fontFamily: SERIF, fontWeight: 700, fontSize: 20 }}>{r.name}{i === 0 ? " 🥃" : ""}</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.gold }}>{r.capital} cap</span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: C.prestige }}>{r.reputation} prestige</span>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: C.ink, width: 56, textAlign: "right" }}>{r.total}</span>
            </div>
          ))}
        </div>
        <button onClick={onNew} className="bb-btn" style={{ padding: "14px 24px", borderRadius: 12, border: 0, cursor: "pointer", fontFamily: MONO, fontWeight: 700, fontSize: 14, letterSpacing: ".12em", textTransform: "uppercase", color: PRIMARY_INK, background: PRIMARY }}>New Game</button>
      </div>
    </div>
  );
}
