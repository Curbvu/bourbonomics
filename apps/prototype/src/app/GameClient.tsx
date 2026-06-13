"use client";

// Bourbonomics — game board. Ported to React from the "Bourbonomics Rebuild"
// hi-fi design (the Collect-phase board). Visual structure + tokens match the
// design; game logic is wired to the real engine. Where mechanics are
// undesigned the board keeps the design's 🚧 TBD / PH / STAND-IN markers.

import { useMemo, useRef, useState } from "react";
import {
  applyAction,
  createGame,
  improvementCost,
  matrixValue,
  CONFIG,
} from "@bourbonomics/prototype-engine";
import type {
  Action,
  Bourbon,
  DepartmentId,
  DieFace,
  GameState,
  Player,
  ResourceCard,
  ResourceKind,
} from "@bourbonomics/prototype-engine";
import ScalingHost from "./components/ScalingHost";

// ── tokens ───────────────────────────────────────────────────────────
const MONO = "'JetBrains Mono', monospace";
const SERIF = "'Cormorant Garamond', serif";
const C = {
  ink: "#f0e3c8",
  text2: "#b9a684",
  muted: "#7c6a51",
  faint: "#4d4031",
  gold: "#f0c970",
  brass: "#c69d52",
  border: "#3b2818",
  border2: "#2e1f15",
  green: "#6db28c",
  red: "#d96b54",
  amber: "#d59650",
};

const FACE: Record<DieFace, { mono: string; label: string; color: string; wild?: boolean }> = {
  cask: { mono: "CK", label: "Cask", color: "#cf9a5e" },
  corn: { mono: "CN", label: "Corn", color: "#f0c970" },
  rye: { mono: "RY", label: "Rye", color: "#d96b54" },
  wheat: { mono: "WH", label: "Wheat", color: "#e9b46e" },
  barley: { mono: "BA", label: "Barley", color: "#6db28c" },
  anything: { mono: "✦", label: "Any", color: "#e7d9b6", wild: true },
};
const PILE_ORDER: ResourceKind[] = ["cask", "corn", "rye", "wheat", "barley"];
const SUB: Record<ResourceKind, { ink: string; glyph: string; label: string }> = {
  cask: { ink: "#cf9a5e", glyph: "⌬", label: "Cask" },
  corn: { ink: "#f0c970", glyph: "✺", label: "Corn" },
  rye: { ink: "#d96b54", glyph: "✦", label: "Rye" },
  wheat: { ink: "#e9b46e", glyph: "❉", label: "Wheat" },
  barley: { ink: "#6db28c", glyph: "❦", label: "Barley" },
};

// Department UI metadata (engine ids → design room presentation).
const DEPT_META: Record<DepartmentId, { color: string; tag: string; ph?: boolean }> = {
  rickhouse: { color: "#cf9a5e", tag: "Aging" },
  supply: { color: "#d59650", tag: "Supply" },
  warehouse: { color: "#6db28c", tag: "Warehouse" },
  mashFloor: { color: "#7d8fd4", tag: "Recipes" },
  marketing: { color: "#b08fd8", tag: "Shape Demand" },
  distribution: { color: "#5fa6c9", tag: "Distribution" },
  countingHouse: { color: "#c9a24a", tag: "Capital", ph: true },
};
const ROSTER_ORDER: DepartmentId[] = [
  "supply",
  "warehouse",
  "mashFloor",
  "marketing",
  "distribution",
  "countingHouse",
  "rickhouse",
];

const PLAYER_COLORS = ["#d59650", "#d96b54", "#6db28c", "#b08fd8", "#5fa6c9", "#e9b46e"];

// ── global style (fonts, keyframes, hover, body texture) ─────────────
const GLOBAL_CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap');
@keyframes bb-pip { 0%,100%{box-shadow:0 0 0 0 rgba(240,201,112,.55);} 50%{box-shadow:0 0 0 6px rgba(240,201,112,0);} }
@keyframes bb-ember { 0%,100%{box-shadow:inset 0 2px 3px rgba(255,255,255,.35),0 0 10px rgba(185,166,132,.4);} 50%{box-shadow:inset 0 2px 3px rgba(255,255,255,.35),0 0 18px rgba(240,201,112,.6);} }
@keyframes bb-shelf { 0%,100%{opacity:.5;} 50%{opacity:.82;} }
@keyframes bb-rise { from{opacity:0;transform:translate(-50%,6px);} to{opacity:1;transform:translate(-50%,0);} }
.bb-card { transition: transform .2s cubic-bezier(.22,1,.36,1), filter .18s ease; }
.bb-card:hover { transform: translateY(-10px); filter: brightness(1.08); z-index:5; }
.bb-die { transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
.bb-die.clk:hover { transform: translateY(-4px); border-color:#c69d52 !important; }
.bb-btn { transition: filter .15s ease, transform .15s ease, background .15s ease; }
.bb-btn:not(:disabled):hover { filter: brightness(1.06); transform: translateY(-1px); }
.bb-sec:not(:disabled):hover { background:#2e1f15 !important; }
.bb-noise::before { content:""; position:absolute; inset:0; pointer-events:none; z-index:0;
  background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0.86 0 0 0 0 0.78 0 0 0 0 0.62 0 0 0 0.10 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  mix-blend-mode:overlay; opacity:.35; }
::-webkit-scrollbar{width:8px;height:8px;} ::-webkit-scrollbar-thumb{background:#3b2818;border-radius:4px;}
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

// ── setup ────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (names: string[]) => void }) {
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
          background: "linear-gradient(180deg,#1a120b,#130c06)",
          boxShadow: "inset 0 1px 0 rgba(240,201,112,.1), 0 18px 50px rgba(0,0,0,.45)",
        }}
      >
        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 40, color: C.gold }}>Bourbonomics</div>
        <div style={{ fontSize: 14, color: C.text2, lineHeight: 1.5 }}>
          A cozy distillery game — Demand, Collect, Play. Gather grain by dice draft, age bourbon in
          your rickhouse, and sell into a forecastable market.
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
                color: count === n ? "#2a1408" : C.ink,
                background: count === n ? "linear-gradient(180deg,#e9b46e,#c69d52)" : "#150e08",
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
            color: "#2a1408",
            background: "linear-gradient(180deg,#e9b46e,#c69d52)",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)",
          }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
export default function GameClient() {
  const [game, setGame] = useState<GameState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialBills = useRef(1);

  // Collect-phase local overlay (the engine commits at pass time).
  const [collectSub, setCollectSub] = useState<"rolled" | "claim">("rolled");
  const [kept, setKept] = useState<Set<string>>(new Set());
  const [claims, setClaims] = useState<Record<string, ResourceKind>>({});
  const [pendingWild, setPendingWild] = useState<string | null>(null);
  // Play-phase local UI.
  const [drawingBills, setDrawingBills] = useState(false);
  const [keepBills, setKeepBills] = useState<Set<number>>(new Set());

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }
  function resetCollect() {
    setCollectSub("rolled");
    setKept(new Set());
    setClaims({});
    setPendingWild(null);
  }
  function start(names: string[]) {
    const g = createGame({ seed: (Math.floor(Date.now() / 1000) % 100000) + 1, playerNames: names });
    initialBills.current = g.mashBillSupply.length || 1;
    setGame(g);
    resetCollect();
    setDrawingBills(false);
    setKeepBills(new Set());
  }
  function dispatch(action: Action, silent = false): boolean {
    if (!game) return false;
    const res = applyAction(game, action);
    if (!res.ok) {
      if (!silent) flash("⚠ " + res.reason);
      return false;
    }
    setGame(res.state);
    resetCollect();
    setDrawingBills(false);
    setKeepBills(new Set());
    return true;
  }

  if (!game) {
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0c0805" }}>
        <style>{GLOBAL_CSS}</style>
        <ScalingHost>
          <div style={{ width: 1920, height: 1080 }}>
            <SetupScreen onStart={start} />
          </div>
        </ScalingHost>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#0c0805" }}>
      <style>{GLOBAL_CSS}</style>
      <ScalingHost>
        <Board
          game={game}
          dispatch={dispatch}
          flash={flash}
          onNew={() => setGame(null)}
          initialBills={initialBills.current}
          collectSub={collectSub}
          setCollectSub={setCollectSub}
          kept={kept}
          setKept={setKept}
          claims={claims}
          setClaims={setClaims}
          pendingWild={pendingWild}
          setPendingWild={setPendingWild}
          drawingBills={drawingBills}
          setDrawingBills={setDrawingBills}
          keepBills={keepBills}
          setKeepBills={setKeepBills}
          toast={toast}
        />
      </ScalingHost>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
interface BoardProps {
  game: GameState;
  dispatch: (a: Action, silent?: boolean) => boolean;
  flash: (m: string) => void;
  onNew: () => void;
  initialBills: number;
  collectSub: "rolled" | "claim";
  setCollectSub: (v: "rolled" | "claim") => void;
  kept: Set<string>;
  setKept: (v: Set<string>) => void;
  claims: Record<string, ResourceKind>;
  setClaims: (v: Record<string, ResourceKind>) => void;
  pendingWild: string | null;
  setPendingWild: (v: string | null) => void;
  drawingBills: boolean;
  setDrawingBills: (v: boolean) => void;
  keepBills: Set<number>;
  setKeepBills: (v: Set<number>) => void;
  toast: string | null;
}

function Board(p: BoardProps) {
  const { game, dispatch, flash } = p;
  const me = game.players[game.currentPlayerIndex]!;
  const dv = (id: DepartmentId) => {
    const d = me.distillery.departments.find((x) => x.id === id)!;
    return d.values[d.level]!;
  };
  const supplyCap = dv("supply");
  const warehouseCap = dv("warehouse");
  const rickCap = dv("rickhouse");
  const heldCount = me.hand.length;
  const phaseStage = game.roundPhase; // demand | collect | play

  // Warehouse held = real hand + optimistic claims (during claim sub-stage).
  const optimisticClaims = phaseStage === "collect" && p.collectSub === "claim"
    ? Object.values(p.claims)
    : [];
  const heldTotal = heldCount + optimisticClaims.length;
  const whFull = heldTotal >= warehouseCap;

  // ---- collect actions ----
  const collect = game.collect;
  const toggleKeep = (id: string) => {
    const n = new Set(p.kept);
    n.has(id) ? n.delete(id) : n.add(id);
    p.setKept(n);
  };
  const onReroll = () => {
    if (!collect || collect.rerollsUsed >= collect.maxRerolls) return;
    const nonKept = collect.dice.filter((d) => !p.kept.has(d.id)).map((d) => d.id);
    if (nonKept.length === 0) {
      flash("Keep fewer dice to reroll");
      return;
    }
    dispatch({ type: "COLLECT_REROLL", diceIds: nonKept });
  };
  const claimDie = (id: string, face: DieFace) => {
    if (id in p.claims) return;
    if (heldTotal >= warehouseCap) {
      flash("⚠ Warehouse full — raise the hold limit");
      return;
    }
    if (face === "anything") {
      p.setPendingWild(id);
      return;
    }
    p.setClaims({ ...p.claims, [id]: face as ResourceKind });
  };
  const choosePile = (kind: ResourceKind) => {
    if (!p.pendingWild) return;
    p.setClaims({ ...p.claims, [p.pendingWild]: kind });
    p.setPendingWild(null);
  };
  const onPass = () => {
    const claimList = Object.entries(p.claims).map(([dieId, pile]) => {
      const die = collect!.dice.find((d) => d.id === dieId)!;
      return die.face === "anything" ? { dieId, pile } : { dieId };
    });
    const n = (collect?.dice.length ?? 0) - claimList.length;
    if (dispatch({ type: "COLLECT_CLAIM", claims: claimList })) {
      flash(`Claimed ${claimList.length} · passed ${n} dice on`);
    }
  };

  // ---- play actions ----
  const autoStage = (b: Bourbon) => {
    // stage one loose hand card matching a remaining recipe need
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
    // pick loose hand cards to satisfy remaining needs after staged
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
    if (dispatch({ type: "MAKE_BOURBON", barrelId: b.id, resourceCardIds: picked })) {
      flash(`Built ${b.name} — now aging`);
    }
  };

  // ── render computed view-model ──
  const phaseDefs = [
    { name: "Demand", done: phaseStage !== "demand", active: phaseStage === "demand" },
    { name: "Collect", done: phaseStage === "play", active: phaseStage === "collect" },
    { name: "Play", done: false, active: phaseStage === "play" },
  ];

  // collect order (most capital first); annotate with status during collect
  const order = (collect ? collect.order : game.players.map((_, i) => i)
    .sort((a, b) => game.players[b]!.capital - game.players[a]!.capital || a - b)
  ).map((pi, idx) => {
    const pl = game.players[pi]!;
    let status: "done" | "now" | "next" = "next";
    if (collect) status = idx < collect.pos ? "done" : idx === collect.pos ? "now" : "next";
    return { name: pl.name, cap: pl.capital, color: PLAYER_COLORS[pi % PLAYER_COLORS.length]!, status };
  });

  const nextCost = improvementCost(me.improvements);
  const nextStep = me.improvements + 1;

  const restingBarrels = me.rickhouse.filter((b) => !b.built);
  const agingBarrels = me.rickhouse.filter((b) => b.built);
  const openCount = Math.max(0, rickCap - me.rickhouse.length);
  const barrelSlots = rickCap;

  // mash-bill offer for the draw panel
  const office = dv("mashFloor");
  const billOffer = game.mashBillSupply.slice(0, Math.min(office, game.mashBillSupply.length));

  return (
    <div
      className="bb-noise"
      style={{
        position: "relative",
        width: 1920,
        height: 1080,
        padding: "18px 28px",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, system-ui, sans-serif",
        color: C.ink,
        background:
          "radial-gradient(140% 90% at 50% 110%, rgba(213,150,80,.08), transparent 60%), radial-gradient(80% 60% at 50% -10%, rgba(213,150,80,.04), transparent 50%), #0c0805",
      }}
    >
      <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
        {/* ===== HEADER ===== */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 2px 11px", flex: "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ width: 42, height: 42, borderRadius: 10, background: "linear-gradient(160deg,#e9b46e,#b06a38)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 6px 16px rgba(176,106,56,.4)" }}>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, color: "#2a1408" }}>B</span>
            </div>
            <div>
              <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 28, lineHeight: 1 }}>Bourbonomics</div>
              <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".22em", color: C.muted, marginTop: 3 }}>
                YEAR 1 · ROUND {game.roundNumber} · REBUILD
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {phaseDefs.map((ph, i) => (
              <div key={ph.name} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 16px", borderRadius: 10, ...(ph.active ? { background: "linear-gradient(180deg,#2e1f15,#1a120b)", border: `1px solid ${C.brass}`, boxShadow: "inset 0 1px 0 rgba(240,201,112,.2)", color: C.ink } : { background: "#150e08", border: `1px solid ${C.border2}`, color: ph.done ? C.text2 : C.muted }) }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: ph.active ? C.gold : ph.done ? C.green : C.faint, animation: ph.active ? "bb-pip 2.2s ease-in-out infinite" : undefined }} />
                  <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase" }}>{ph.name}</span>
                  {ph.done && <span style={{ fontFamily: MONO, fontSize: 11, color: C.green }}>✓</span>}
                </div>
                {i < 2 && <span style={{ width: 26, height: 1, background: C.border, margin: "0 2px" }} />}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="bb-btn bb-sec" onClick={p.onNew} style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted, background: "#150e08", border: `1px solid ${C.border}`, padding: "7px 12px", borderRadius: 10, cursor: "pointer" }}>New</button>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 13px", borderRadius: 10, background: "linear-gradient(180deg,#1a1308,#140e06)", border: `1px dashed ${C.border}` }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", color: C.muted }}>PRESTIGE</span>
              <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", color: "#0c0805", background: C.amber, padding: "2px 5px", borderRadius: 3 }}>🚧 TBD</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 10, background: "linear-gradient(180deg,#221710,#1a120b)", border: `1px solid ${C.border}`, boxShadow: "inset 0 1px 0 rgba(240,201,112,.14)" }}>
              <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", color: C.muted }}>CAPITAL</span>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 24, color: C.gold }}>{me.capital}</span>
            </div>
          </div>
        </header>

        {/* ===== ACTION BAND ===== */}
        <ActionBand
          board={p}
          me={me}
          supplyCap={supplyCap}
          warehouseCap={warehouseCap}
          heldTotal={heldTotal}
          whFull={whFull}
          collect={collect}
          phaseStage={phaseStage}
          toggleKeep={toggleKeep}
          onReroll={onReroll}
          claimDie={claimDie}
          choosePile={choosePile}
          onPass={onPass}
          billOffer={billOffer}
        />

        {/* ===== BODY ===== */}
        <div style={{ display: "grid", gridTemplateColumns: "270px 1fr 332px", gap: 14, alignItems: "stretch", flex: 1, minHeight: 0 }}>
          {/* LEFT RAIL */}
          <aside style={{ display: "flex", flexDirection: "column", gap: 12, minHeight: 0 }}>
            <RailCard title="Collect Order" right="MOST CAPITAL FIRST">
              <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                {order.map((o, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 9, ...(o.status === "now" ? { background: "linear-gradient(90deg,rgba(213,150,80,.16),transparent)", border: `1px solid ${C.brass}` } : { background: "#150e08", border: `1px solid ${C.border2}` }) }}>
                    <span style={{ width: 9, height: 9, borderRadius: "50%", background: o.color, boxShadow: o.status === "now" ? "0 0 0 3px rgba(213,150,80,.2)" : undefined }} />
                    <span style={{ flex: 1, fontWeight: 600, fontSize: 14, color: o.status === "now" ? C.ink : C.text2 }}>{o.name}</span>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: C.gold }}>{o.cap}</span>
                    <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, ...(o.status === "now" ? { color: "#2a1408", background: C.gold } : o.status === "done" ? { color: C.green, background: "rgba(109,178,140,.14)" } : { color: C.muted, background: "#221710" }) }}>
                      {o.status === "now" ? "NOW" : o.status}
                    </span>
                  </div>
                ))}
              </div>
            </RailCard>

            <RailCard title="The Clock">
              <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 8 }}>
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 30, color: C.ink }}>{game.mashBillSupply.length}</span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>/ {p.initialBills} mash bills left</span>
              </div>
              <div style={{ height: 8, borderRadius: 5, background: "#2a1d12", overflow: "hidden", border: `1px solid ${C.border}` }}>
                <div style={{ width: `${Math.round((game.mashBillSupply.length / p.initialBills) * 100)}%`, height: "100%", background: "linear-gradient(90deg,#6db28c,#b9a684)" }} />
              </div>
              <div style={{ fontSize: 11, color: C.muted, marginTop: 8 }}>Game ends when the supply empties.</div>
            </RailCard>

            <RailCard title="Department Roster">
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {ROSTER_ORDER.map((id) => {
                  const d = me.distillery.departments.find((x) => x.id === id)!;
                  const color = DEPT_META[id].color;
                  return (
                    <div key={id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 3, background: color, flex: "0 0 auto" }} />
                      <span style={{ flex: 1, fontSize: 12, color: C.text2 }}>{d.name}</span>
                      <div style={{ display: "flex", gap: 2 }}>
                        {Array.from({ length: d.maxLevel + 1 }).map((_, i) => (
                          <span key={i} style={{ width: 9, height: 5, borderRadius: 2, background: i <= d.level ? color : C.border2 }} />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </RailCard>

            <section style={{ borderRadius: 14, background: "linear-gradient(180deg,#221710,#150e08)", border: `1px solid ${C.border}`, padding: 13, marginTop: "auto" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: C.brass }}>Next Improvement</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: C.text2 }}>step {nextStep}</span>
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: C.gold }}>{nextCost}</span>
              </div>
              <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.5, marginTop: 6 }}>One shared, rising price for every room. Each improvement raises the next.</div>
            </section>
          </aside>

          {/* DISTILLERY */}
          <main style={{ position: "relative", borderRadius: 16, background: "linear-gradient(180deg,#1c130c 0%,#130c06 100%)", border: `1px solid ${C.border}`, boxShadow: "inset 0 1px 0 rgba(240,201,112,.1), 0 18px 50px rgba(0,0,0,.45)", padding: 13, display: "flex", flexDirection: "column", gap: 11, minHeight: 0, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flex: "0 0 auto" }}>
              <span style={{ fontFamily: MONO, fontSize: 13, letterSpacing: ".24em", textTransform: "uppercase", color: C.brass }}>Your Distillery</span>
              <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: C.muted }}>seven rooms · one shared ledger</span>
              <span style={{ flex: 1, height: 1, background: "linear-gradient(90deg,#3b2818,transparent)" }} />
              <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".1em" }}>
                <span style={{ color: C.gold }}>{agingBarrels.length}</span>
                <span style={{ color: C.muted }}>/{barrelSlots} barrels aging</span>
              </span>
            </div>

            {/* RICKHOUSE ROOM */}
            <div style={{ position: "relative", flex: 1.1, minHeight: 0, borderRadius: 13, padding: "13px 16px 14px", border: `1px solid ${C.border}`, background: "radial-gradient(120% 80% at 50% 0%, rgba(240,201,112,.1), transparent 55%), radial-gradient(80% 90% at 50% 120%, rgba(176,106,56,.12), transparent 65%), linear-gradient(180deg,#1e140c 0%,#150e08 100%)", boxShadow: "inset 0 1px 0 rgba(240,201,112,.12), inset 0 -1px 0 rgba(0,0,0,.55)", overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 11 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "4px 12px", borderRadius: 7, background: "linear-gradient(180deg,#f0c970,#b06a38)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.35), 0 2px 5px rgba(0,0,0,.4)" }}>
                  <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: "#2a1a10" }}>The Rickhouse</span>
                </span>
                <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".12em", textTransform: "uppercase", color: "#cf9a5e" }}>Aging</span>
                <span style={{ fontSize: 12, color: C.muted }}>{rickCap} barrel slots · Base 3 → +1 → +1 → ult.</span>
                <div style={{ flex: 1 }} />
                <Pips dept="rickhouse" me={me} />
                <ImproveBtn id="rickhouse" me={me} dispatch={dispatch} />
              </div>
              <div style={{ height: 9, borderRadius: 4, marginBottom: 13, background: "repeating-linear-gradient(90deg, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,.1) 2px, rgba(0,0,0,.1) 3px), linear-gradient(180deg,#2a1a10,#1c120a)", boxShadow: "inset 0 1px 0 rgba(240,201,112,.45), inset 0 -1px 0 rgba(0,0,0,.6), 0 0 0 1px rgba(198,157,82,.35)" }} />

              <div style={{ display: "grid", gridTemplateColumns: `repeat(${barrelSlots}, minmax(0,1fr))`, gap: 14, alignItems: "start" }}>
                {agingBarrels.map((b) => {
                  const sellable = b.age >= CONFIG.MIN_SELL_AGE && b.salesRemaining > 0;
                  const val = matrixValue(b.matrix, b.age, game.demand) + dv("distribution");
                  return (
                    <div key={b.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <button
                        className="bb-btn"
                        onClick={() => (phaseStage === "play" && sellable ? dispatch({ type: "SELL", bourbonId: b.id }) && flash(`Sold ${b.name} for ${val}`) : flash(sellable ? "Sell in the Play phase" : `Ages until year ${CONFIG.MIN_SELL_AGE}`))}
                        style={{ textAlign: "left", position: "relative", borderRadius: 12, padding: "11px 12px 12px", border: "1px solid rgba(240,201,112,.4)", background: "linear-gradient(180deg, rgba(74,52,31,.5) 0%, rgba(26,18,11,.96) 60%)", boxShadow: "inset 0 1px 0 rgba(240,201,112,.22), 0 10px 22px rgba(0,0,0,.5)", cursor: phaseStage === "play" && sellable ? "pointer" : "default", overflow: "hidden" }}
                      >
                        <span style={{ position: "absolute", top: 9, right: 9, fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", color: "#2a1408", background: "linear-gradient(180deg,#e9b46e,#c69d52)", padding: "2px 6px", borderRadius: 4 }}>{b.quality}</span>
                        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: C.text2 }}>{b.expression} Bill</div>
                        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20, color: "#fbeccb", lineHeight: 1.05, marginTop: 1 }}>{b.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 11, paddingTop: 10, borderTop: "1px dotted rgba(110,80,50,.4)" }}>
                          <span style={{ position: "relative", width: 48, height: 48, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #f0c970, #c69d52 60%, #6b3d1d 100%)", display: "grid", placeItems: "center", animation: "bb-ember 3.2s ease-in-out infinite", flex: "0 0 auto" }}>
                            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 21, color: "#2a1a10", lineHeight: 1 }}>{b.age}</span>
                            <span style={{ position: "absolute", bottom: 5, fontFamily: MONO, fontSize: 8, fontWeight: 700, color: "#2a1a10", letterSpacing: ".16em" }}>YR</span>
                          </span>
                          <div>
                            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: C.ink, lineHeight: 1 }}>{sellable ? `sell · ${val}` : "aging in oak"}</div>
                            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted, marginTop: 3 }}>{b.salesRemaining}/{b.batchQty} sales left</div>
                          </div>
                        </div>
                      </button>
                      <div style={{ textAlign: "center", padding: 5, borderRadius: 7, border: "1px solid rgba(240,201,112,.25)", background: "rgba(240,201,112,.08)", fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: C.gold }}>
                        {sellable ? (phaseStage === "play" ? "Tap to sell" : "Ready to sell") : `Aging · Year ${b.age}`}
                      </div>
                    </div>
                  );
                })}

                {restingBarrels.map((b) => {
                  const slots = recipeKinds(b.recipe);
                  const ready = b.staged.length >= recipeSize(b.recipe);
                  const canBuild = phaseStage === "play";
                  return (
                    <div key={b.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ position: "relative", borderRadius: 12, padding: "11px 12px 12px", border: "1px solid #4a5a3a", background: "linear-gradient(180deg, rgba(50,60,40,.4) 0%, rgba(20,18,11,.96) 60%)", boxShadow: "inset 0 1px 0 rgba(180,210,150,.14), 0 10px 22px rgba(0,0,0,.5)", overflow: "hidden" }}>
                        <span style={{ position: "absolute", top: 9, right: 9, fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", color: "#2a1408", background: "linear-gradient(180deg,#9fc27a,#6d8f4f)", padding: "2px 6px", borderRadius: 4 }}>{b.expression}</span>
                        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: "#9fc27a" }}>Resting Bill</div>
                        <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20, color: "#fbeccb", lineHeight: 1.05, marginTop: 1 }}>{b.name}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
                          {slots.map((k, i) => {
                            const filled = i < b.staged.length;
                            return (
                              <span key={i} style={{ fontFamily: MONO, fontWeight: 700, fontSize: 10, width: 26, height: 26, borderRadius: 7, display: "inline-flex", alignItems: "center", justifyContent: "center", ...(filled ? { color: FACE[k].color, background: "#1a130b", border: `1px solid ${FACE[k].color}88` } : { color: C.faint, background: "rgba(20,14,8,.5)", border: "1.5px dashed rgba(110,80,50,.5)" }) }}>
                                {filled ? FACE[k].mono : ""}
                              </span>
                            );
                          })}
                          <span style={{ fontFamily: MONO, fontSize: 11, color: "#9fc27a", marginLeft: 2 }}>{b.staged.length}/{recipeSize(b.recipe)}</span>
                        </div>
                        <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4, marginTop: 8 }}>Staged cards lock here &amp; free Warehouse cap.</div>
                      </div>
                      <button
                        className="bb-btn"
                        disabled={!canBuild}
                        onClick={() => (ready ? tryBuild(b) : autoStage(b))}
                        style={{ padding: 7, borderRadius: 8, fontFamily: MONO, fontWeight: 600, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", cursor: canBuild ? "pointer" : "default", ...(ready ? { border: "1px solid #6d8f4f", color: "#9fc27a", background: "rgba(80,110,60,.16)" } : { border: `1px solid ${C.brass}`, color: C.gold, background: "#221710" }), opacity: canBuild ? 1 : 0.6 }}
                      >
                        {ready ? "✓ Build now" : "+ Stage a card"}
                      </button>
                    </div>
                  );
                })}

                {Array.from({ length: openCount }).map((_, i) => (
                  <div key={`open${i}`} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ position: "relative", minHeight: 150, borderRadius: 12, border: "1.5px dashed rgba(198,157,82,.35)", background: "radial-gradient(70% 60% at 50% 30%, rgba(240,201,112,.05), transparent 70%)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, padding: 16, animation: "bb-shelf 3.6s ease-in-out infinite" }}>
                      <span style={{ width: 30, height: 30, borderRadius: 999, border: `1px solid ${C.faint}`, display: "grid", placeItems: "center", fontFamily: SERIF, fontSize: 18, color: C.muted }}>+</span>
                      <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: ".18em", textTransform: "uppercase", color: "#6f5c45", textAlign: "center", lineHeight: 1.6 }}>Open<br />Barrel Slot</span>
                    </div>
                    <div style={{ textAlign: "center", padding: 5, borderRadius: 7, border: "1px dashed rgba(110,80,50,.45)", background: "rgba(20,14,8,.5)", fontFamily: MONO, fontSize: 10, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted }}>Draw a mash bill</div>
                  </div>
                ))}
              </div>
            </div>

            {/* SIX-ROOM GRID */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gridTemplateRows: "1fr 1fr", gap: 11, flex: 1, minHeight: 0 }}>
              <Room id="supply" me={me} dispatch={dispatch} bg="radial-gradient(80% 60% at 50% 0%, rgba(213,150,80,.08), transparent 65%), linear-gradient(180deg,#1a120b,#130c06)" name="The Supply Room">
                <div style={{ display: "flex", gap: 6 }}>
                  {Array.from({ length: supplyCap }).map((_, i) => (
                    <span key={i} style={{ width: 24, height: 24, borderRadius: 6, background: "linear-gradient(180deg,#2c1f13,#1a130b)", border: `1px solid ${C.border}`, boxShadow: "inset 0 1px 0 rgba(240,201,112,.15)" }} />
                  ))}
                </div>
                <div style={{ fontSize: 12, color: C.text2, marginTop: 8 }}>Rolls <b style={{ color: C.gold }}>{supplyCap} dice</b> into the draft each round.</div>
              </Room>

              <Room id="warehouse" me={me} dispatch={dispatch} bg="radial-gradient(80% 60% at 50% 0%, rgba(109,178,140,.08), transparent 65%), linear-gradient(180deg,#131a13,#0f130c)" name="The Warehouse"
                headerRight={
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 9px", borderRadius: 999, background: "#11100a", border: `1px solid ${whFull ? C.red : C.border}` }}>
                    <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: whFull ? C.red : C.green }}>{heldTotal}</span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: C.muted }}>/{warehouseCap}</span>
                  </div>
                }>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignContent: "center" }}>
                  {[...me.hand.map((c) => c.kind), ...optimisticClaims].slice(0, warehouseCap).map((kind, i) => {
                    const m = SUB[kind];
                    return (
                      <div key={i} className="bb-card" style={{ position: "relative", width: 50, height: 70, borderRadius: 8, padding: "6px 4px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(180deg,${m.ink}26 0%, rgba(20,14,8,.96) 70%)`, border: `1px solid ${m.ink}66`, boxShadow: `inset 0 1px 0 rgba(255,255,255,.06), 0 3px 9px ${m.ink}2e` }}>
                        <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: m.ink }}>{m.label}</span>
                        <span style={{ fontSize: 21, lineHeight: 1, color: m.ink, textShadow: `0 0 8px ${m.ink}55` }}>{m.glyph}</span>
                      </div>
                    );
                  })}
                  {Array.from({ length: Math.max(0, warehouseCap - heldTotal) }).map((_, i) => (
                    <div key={`g${i}`} style={{ width: 50, height: 70, borderRadius: 8, border: "1.5px dashed rgba(110,80,50,.4)", background: "rgba(20,14,8,.4)" }} />
                  ))}
                </div>
              </Room>

              <Room id="mashFloor" me={me} dispatch={dispatch} bg="radial-gradient(80% 60% at 50% 0%, rgba(125,143,212,.08), transparent 65%), linear-gradient(180deg,#14141f,#0e0d14)" name="The Mash Floor">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ position: "relative", width: 56, height: 74, flex: "0 0 auto" }}>
                    <span style={{ position: "absolute", inset: 0, borderRadius: 8, background: "linear-gradient(180deg,#2a2f44,#16161f)", border: "1px solid #3a3f55", transform: "rotate(-7deg)" }} />
                    <span style={{ position: "absolute", inset: 0, borderRadius: 8, background: "linear-gradient(180deg,#2f3550,#1a1a24)", border: "1px solid #444a64", transform: "rotate(3deg)", display: "grid", placeItems: "center", fontFamily: MONO, fontSize: 9, letterSpacing: ".1em", color: "#9aa6d4" }}>BILLS</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.45 }}>Draws <b style={{ color: C.gold }}>{dv("mashFloor")} bills</b> each round to choose a recipe.</div>
                </div>
              </Room>

              <Room id="marketing" me={me} dispatch={dispatch} bg="radial-gradient(80% 60% at 50% 0%, rgba(176,143,216,.1), transparent 65%), linear-gradient(180deg,#1a1220,#120c10)" name="Marketing Dept." borderTop="#2e2236">
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 9, background: "#160f15", border: "1px solid #3b2b46" }}>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: "#b08fd8" }}>◄</span>
                    <span style={{ flex: 1, textAlign: "center", fontFamily: MONO, fontSize: 10, letterSpacing: ".08em", textTransform: "uppercase", color: C.text2 }}>read &amp; move the market</span>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: "#b08fd8" }}>►</span>
                  </div>
                  <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.4 }}>Lays <b style={{ color: C.gold }}>{dv("marketing")} demand card{dv("marketing") > 1 ? "s" : ""}</b> each round →</div>
                </div>
              </Room>

              <Room id="distribution" me={me} dispatch={dispatch} bg="radial-gradient(80% 60% at 50% 0%, rgba(95,166,201,.1), transparent 65%), linear-gradient(180deg,#101820,#0c1014)" name="The Loading Dock" borderTop="#233038">
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", gap: 4, flex: "0 0 auto" }}>
                    {[28, 36, 24].map((h, i) => (
                      <span key={i} style={{ width: 22, height: h, borderRadius: 3, background: "linear-gradient(180deg,#3a2a18,#241810)", border: "1px solid #4a3826", boxShadow: "inset 0 0 0 2px rgba(95,166,201,.18)", alignSelf: i ? "flex-end" : "auto" }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.4 }}>Ships to market · <b style={{ color: C.gold }}>+{dv("distribution")} on every sale</b> <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>(in Play)</span></div>
                </div>
              </Room>

              <Room id="countingHouse" me={me} dispatch={dispatch} bg="radial-gradient(80% 60% at 50% 0%, rgba(201,162,74,.1), transparent 65%), linear-gradient(180deg,#1a160c,#120e07)" name="The Counting House" ph>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ display: "flex", flex: "0 0 auto" }}>
                    {[0, 1, 2].map((i) => (
                      <span key={i} style={{ width: 20, height: 20, borderRadius: 999, background: "radial-gradient(circle at 35% 30%, #f0c970, #b06a38)", boxShadow: "0 2px 5px rgba(0,0,0,.5)", marginLeft: i ? -8 : 0 }} />
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.4 }}>Capital efficiency · <span style={{ fontFamily: MONO, fontSize: 9, color: "#0c0805", background: C.amber, padding: "1px 5px", borderRadius: 3 }}>🚧 TBD</span> prestige source undesigned</div>
                </div>
              </Room>
            </div>
          </main>

          {/* MARKET (STAND-IN) */}
          <MarketAside game={game} />
        </div>
      </div>

      {/* wild pile chooser overlay */}
      {p.pendingWild && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(8,5,3,.82)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, zIndex: 60 }}>
          <div style={{ fontFamily: SERIF, fontSize: 22, fontWeight: 600, color: C.ink }}>✦ Wild — draw from which pile?</div>
          <div style={{ display: "flex", gap: 10 }}>
            {PILE_ORDER.map((k) => (
              <button key={k} className="bb-btn" onClick={() => choosePile(k)} style={{ width: 70, height: 70, borderRadius: 12, background: "linear-gradient(180deg,#2c1f13,#1a130b)", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: "pointer" }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 18, color: FACE[k].color }}>{FACE[k].mono}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".12em", textTransform: "uppercase", color: C.muted }}>{FACE[k].label}</span>
              </button>
            ))}
          </div>
          <button onClick={() => p.setPendingWild(null)} style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", color: C.muted, background: "none", border: 0, cursor: "pointer", textTransform: "uppercase" }}>cancel</button>
        </div>
      )}

      {/* toast */}
      {p.toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 26, transform: "translateX(-50%)", zIndex: 70, padding: "12px 22px", borderRadius: 11, background: "linear-gradient(180deg,#2e1f15,#1a120b)", border: `1px solid ${C.brass}`, boxShadow: "0 14px 40px rgba(0,0,0,.6)", fontFamily: MONO, fontSize: 12, letterSpacing: ".04em", color: C.ink, animation: "bb-rise .24s ease-out" }}>{p.toast}</div>
      )}
    </div>
  );
}

// ── Action band (Demand roll / Collect dice draft / Play actions) ─────
function ActionBand(props: {
  board: BoardProps;
  me: Player;
  supplyCap: number;
  warehouseCap: number;
  heldTotal: number;
  whFull: boolean;
  collect: GameState["collect"];
  phaseStage: GameState["roundPhase"];
  toggleKeep: (id: string) => void;
  onReroll: () => void;
  claimDie: (id: string, face: DieFace) => void;
  choosePile: (k: ResourceKind) => void;
  onPass: () => void;
  billOffer: { id: string; name: string; expression: string; batchQty: number; recipe: Partial<Record<ResourceKind, number>> }[];
}) {
  const { board, me, supplyCap, warehouseCap, heldTotal, whFull, collect, phaseStage } = props;
  const sub = board.collectSub;
  const game = board.game;

  const hint =
    phaseStage === "demand"
      ? "Demand is laid out — begin the dice draft."
      : phaseStage === "play"
        ? "Play phase — build, sell, improve, then end your turn."
        : sub === "rolled"
          ? "Tap dice to KEEP, reroll the rest, then lock in."
          : "Tap each die to claim it into the Warehouse.";

  return (
    <section style={{ borderRadius: 14, background: "radial-gradient(120% 130% at 50% 0%, rgba(213,150,80,.08), transparent 55%), linear-gradient(180deg,#1c130c,#140d07)", border: `1px solid ${C.border}`, boxShadow: "inset 0 1px 0 rgba(240,201,112,.1), 0 12px 34px rgba(0,0,0,.4)", padding: "11px 18px 13px", marginBottom: 13, flex: "0 0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 11, gap: 16 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".18em", textTransform: "uppercase", color: C.gold }}>
            {phaseStage === "play" ? "Play Phase" : "Collect Phase"}
          </span>
          <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 20 }}>{phaseStage === "play" ? "Build · Sell · Improve" : "The Dice Draft"}</span>
          <span style={{ fontSize: 12, color: C.text2 }}>{hint}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Readout label="SUPPLY" value={`${supplyCap} dice`} color={C.amber} />
          <Readout label="WAREHOUSE" value={`${heldTotal}/${warehouseCap}`} color={whFull ? C.red : C.green} border={whFull ? C.red : C.border} />
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "168px 1fr 256px", gap: 16, alignItems: "stretch" }}>
        {/* inherited */}
        <div style={{ borderRadius: 11, background: "#150e08", border: `1px dashed ${C.border}`, padding: 12, display: "flex", flexDirection: "column", gap: 9 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted, lineHeight: 1.5 }}>Inherited<br />dice →</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(collect?.inherited ?? []).map((d) => (
              <div key={d.id} style={{ width: 44, height: 44, borderRadius: 11, background: "linear-gradient(180deg,#2c1f13,#1a130b)", border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2 }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 14, color: FACE[d.face].color }}>{FACE[d.face].mono}</span>
              </div>
            ))}
            {(!collect || collect.inherited.length === 0) && <span style={{ fontSize: 11, color: C.faint, fontStyle: "italic" }}>— none —</span>}
          </div>
          <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.4, marginTop: "auto" }}>Leftovers carry into your roll, up to your Supply cap.</div>
        </div>

        {/* dice tray */}
        <div style={{ position: "relative", borderRadius: 12, background: "radial-gradient(120% 100% at 50% 0%, rgba(213,150,80,.07), transparent 60%), #11100a", border: `1px solid ${C.border2}`, padding: 14, minHeight: 112, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {phaseStage === "demand" && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
              <button className="bb-btn" onClick={() => board.dispatch({ type: "BEGIN_COLLECT" })} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 30px", borderRadius: 12, background: "linear-gradient(180deg,#e9b46e,#c69d52)", color: "#2a1408", fontFamily: MONO, fontWeight: 700, fontSize: 14, letterSpacing: ".12em", textTransform: "uppercase", cursor: "pointer", border: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,.4), 0 10px 24px rgba(198,157,82,.3)" }}>🎲 Roll {supplyCap} dice</button>
              <div style={{ fontSize: 12, color: C.muted }}>Most-Capital-first · you inherit leftovers, then roll</div>
            </div>
          )}
          {phaseStage === "play" && <PlayTray board={board} me={me} />}
          {phaseStage === "collect" && collect && (
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              {collect.dice.map((d) => {
                const meta = FACE[d.face];
                const kept = board.kept.has(d.id);
                const claimed = d.id in board.claims;
                const clickable = !claimed;
                return (
                  <button
                    key={d.id}
                    className={`bb-die${clickable ? " clk" : ""}`}
                    onClick={() => (claimed ? undefined : sub === "rolled" ? props.toggleKeep(d.id) : props.claimDie(d.id, d.face))}
                    style={{ position: "relative", width: 70, height: 70, borderRadius: 15, background: claimed ? "#120c07" : "linear-gradient(180deg,#2c1f13,#1a130b)", border: `2px solid ${kept ? C.brass : C.border}`, boxShadow: kept ? "inset 0 1px 0 rgba(240,201,112,.4), 0 0 0 3px rgba(198,157,82,.2), 0 10px 22px rgba(0,0,0,.5)" : "inset 0 1px 0 rgba(240,201,112,.12), 0 8px 18px rgba(0,0,0,.45)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, cursor: clickable ? "pointer" : "default", opacity: claimed ? 0.38 : 1, padding: 0 }}
                  >
                    {kept && !claimed && <span style={{ position: "absolute", top: -9, right: -7, fontFamily: MONO, fontSize: 7, letterSpacing: ".08em", color: "#2a1408", background: C.gold, padding: "2px 5px", borderRadius: 5 }}>KEPT</span>}
                    <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: meta.wild ? 27 : 21, color: meta.color, lineHeight: 1 }}>{meta.mono}</span>
                    <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted }}>{meta.label}</span>
                    {claimed && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 25, color: C.green }}>✓</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* controls */}
        <div style={{ borderRadius: 11, background: "#150e08", border: `1px solid ${C.border2}`, padding: 12, display: "flex", flexDirection: "column", gap: 9, justifyContent: "center" }}>
          {phaseStage === "demand" && (
            <>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", textTransform: "uppercase", color: C.brass }}>Demand Phase</div>
              <div style={{ fontSize: 12, color: C.text2, lineHeight: 1.5 }}>This round&apos;s orders are on the right. Begin the draft to gather grain.</div>
            </>
          )}
          {phaseStage === "play" && <PlayControls board={board} me={me} />}
          {phaseStage === "collect" && sub === "rolled" && collect && (
            <>
              <button className="bb-btn bb-sec" onClick={props.onReroll} disabled={collect.rerollsUsed >= collect.maxRerolls} style={{ padding: "11px 16px", borderRadius: 10, fontFamily: MONO, fontWeight: 600, fontSize: 12, letterSpacing: ".06em", textTransform: "uppercase", ...(collect.rerollsUsed < collect.maxRerolls ? { border: `1px solid ${C.brass}`, color: C.gold, background: "#221710", cursor: "pointer" } : { border: `1px solid ${C.border2}`, color: C.faint, background: "#150e08", cursor: "default" }) }}>↻ Reroll unkept · {collect.maxRerolls - collect.rerollsUsed} left</button>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{collect.maxRerolls < 2 ? "2nd reroll unlocks at Supply IV 🔒" : "Supply IV: 2 rerolls"}</div>
              <button className="bb-btn" onClick={() => board.setCollectSub("claim")} style={{ padding: "11px 18px", borderRadius: 10, background: "linear-gradient(180deg,#e9b46e,#c69d52)", color: "#2a1408", fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", border: 0, boxShadow: "inset 0 1px 0 rgba(255,255,255,.35)" }}>Lock &amp; claim →</button>
            </>
          )}
          {phaseStage === "collect" && sub === "claim" && collect && (
            <>
              <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".06em", color: C.text2, lineHeight: 1.5 }}>Tap a die to draw its pile blind. Claims fill the Warehouse ↓</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.amber }}>{collect.dice.length - Object.keys(board.claims).length} unclaimed</div>
              <button className="bb-btn bb-sec" onClick={props.onPass} style={{ padding: "11px 18px", borderRadius: 10, background: "#221710", color: C.ink, fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", border: `1px solid ${C.brass}` }}>Claim &amp; pass on →</button>
            </>
          )}
        </div>
      </div>

      {/* piles strip */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 10, paddingTop: 9, borderTop: `1px solid ${C.border2}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".14em", textTransform: "uppercase", color: C.brass }}>Piles · draw blind</span>
        <div style={{ display: "flex", gap: 18 }}>
          {PILE_ORDER.map((k) => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 7 }}>
              <div style={{ width: 36, height: 36, borderRadius: 9, background: "#1a130b", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 13, color: FACE[k].color }}>{FACE[k].mono}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                <span style={{ fontFamily: MONO, fontSize: 12, color: C.ink }}>{game.piles[k].length}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", textTransform: "uppercase", color: C.muted }}>{FACE[k].label}</span>
              </div>
            </div>
          ))}
        </div>
        <div style={{ flex: 1 }} />
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: C.muted }}>
          <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", color: "#0c0805", background: "#b08fd8", padding: "2px 6px", borderRadius: 4 }}>🚧 TBD</span>
          quality (Common / Specialty) is rolled blind — gating undesigned
        </span>
      </div>
    </section>
  );
}

function PlayTray({ board, me }: { board: BoardProps; me: Player }) {
  const game = board.game;
  if (board.drawingBills) {
    const office = me.distillery.departments.find((d) => d.id === "mashFloor")!;
    const offer = game.mashBillSupply.slice(0, Math.min(office.values[office.level]!, game.mashBillSupply.length));
    const room = me.distillery.departments.find((d) => d.id === "rickhouse")!;
    const cap = room.values[room.level]! - me.rickhouse.length;
    return (
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
        {offer.map((bill, i) => {
          const sel = board.keepBills.has(i);
          return (
            <button key={bill.id} className="bb-btn" onClick={() => { const n = new Set(board.keepBills); n.has(i) ? n.delete(i) : n.add(i); board.setKeepBills(n); }} style={{ width: 150, textAlign: "left", display: "flex", flexDirection: "column", gap: 2, padding: 10, borderRadius: 10, cursor: "pointer", border: `2px solid ${sel ? C.brass : C.border}`, background: sel ? "#2a2014" : "linear-gradient(180deg,#1e140c,#150e08)" }}>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: C.ink }}>{bill.name}</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.brass }}>{bill.expression} · {bill.batchQty} sales</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>{recipeKinds(bill.recipe).map((k) => FACE[k].mono).join(" ")}</span>
            </button>
          );
        })}
        <div style={{ alignSelf: "center", fontFamily: MONO, fontSize: 10, color: C.muted, maxWidth: 90 }}>keep up to {Math.max(0, cap)} · rest cycle back</div>
      </div>
    );
  }
  const aging = me.rickhouse.filter((b) => b.built).length;
  const resting = me.rickhouse.filter((b) => !b.built).length;
  return (
    <div style={{ textAlign: "center" }}>
      <div style={{ fontFamily: SERIF, fontSize: 18, color: C.text2 }}>It&apos;s your turn — {me.name}</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 6 }}>{resting} resting · {aging} aging · {me.hand.length} cards held</div>
      <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginTop: 2 }}>Use the rickhouse below to build &amp; sell.</div>
    </div>
  );
}

function PlayControls({ board, me }: { board: BoardProps; me: Player }) {
  const office = me.distillery.departments.find((d) => d.id === "mashFloor")!;
  const room = me.distillery.departments.find((d) => d.id === "rickhouse")!;
  const noRoom = room.values[room.level]! - me.rickhouse.length <= 0;
  const supplyEmpty = board.game.mashBillSupply.length === 0;
  return (
    <>
      {!board.drawingBills ? (
        <button className="bb-btn" disabled={me.drewMashBillsThisTurn || noRoom || supplyEmpty} onClick={() => board.setDrawingBills(true)} style={{ padding: "11px 16px", borderRadius: 10, fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", border: 0, cursor: me.drewMashBillsThisTurn || noRoom || supplyEmpty ? "default" : "pointer", color: "#2a1408", background: "linear-gradient(180deg,#e9b46e,#c69d52)", opacity: me.drewMashBillsThisTurn || noRoom || supplyEmpty ? 0.5 : 1 }}>
          Draw {office.values[office.level]} Mash Bills
        </button>
      ) : (
        <button className="bb-btn" onClick={() => { board.dispatch({ type: "DRAW_MASH_BILLS", keepIndexes: [...board.keepBills] }); }} style={{ padding: "11px 16px", borderRadius: 10, fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: ".08em", textTransform: "uppercase", border: 0, cursor: "pointer", color: "#2a1408", background: "linear-gradient(180deg,#e9b46e,#c69d52)" }}>
          Keep {board.keepBills.size} →
        </button>
      )}
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, lineHeight: 1.4 }}>{me.drewMashBillsThisTurn ? "Bills drawn this turn." : "Once per turn · undrawn cycle back."}</div>
      <button className="bb-btn bb-sec" onClick={() => board.dispatch({ type: "END_TURN" })} style={{ padding: "11px 18px", borderRadius: 10, background: "#221710", color: C.ink, fontFamily: MONO, fontWeight: 700, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", cursor: "pointer", border: `1px solid ${C.brass}` }}>End Turn →</button>
    </>
  );
}

// ── small components ──────────────────────────────────────────────────
function Readout({ label, value, color, border }: { label: string; value: string; color: string; border?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 12px", borderRadius: 9, background: "#150e08", border: `1px solid ${border ?? C.border}` }}>
      <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".1em", color: C.muted }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 13, color }}>{value}</span>
    </div>
  );
}

function RailCard({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <section style={{ borderRadius: 14, background: "linear-gradient(180deg,#1a120b,#150e08)", border: `1px solid ${C.border}`, padding: 13, boxShadow: "inset 0 1px 0 rgba(240,201,112,.08)" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: C.brass }}>{title}</span>
        {right && <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".1em", color: C.muted }}>{right}</span>}
      </div>
      {children}
    </section>
  );
}

function Pips({ dept, me }: { dept: DepartmentId; me: Player }) {
  const d = me.distillery.departments.find((x) => x.id === dept)!;
  const color = DEPT_META[dept].color;
  return (
    <div style={{ display: "flex", gap: 3 }}>
      {Array.from({ length: d.maxLevel + 1 }).map((_, i) => (
        <span key={i} style={{ width: 11, height: 6, borderRadius: 2, background: i <= d.level ? color : C.border2 }} />
      ))}
    </div>
  );
}

function ImproveBtn({ id, me, dispatch }: { id: DepartmentId; me: Player; dispatch: (a: Action) => boolean }) {
  const d = me.distillery.departments.find((x) => x.id === id)!;
  const maxed = d.level >= d.maxLevel;
  const cost = improvementCost(me.improvements, d.discount);
  const can = !maxed && me.capital >= cost;
  return (
    <button
      className="bb-btn bb-sec"
      disabled={maxed}
      onClick={() => !maxed && dispatch({ type: "IMPROVE", departmentId: id })}
      style={{ fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: ".04em", textTransform: "uppercase", padding: "5px 10px", borderRadius: 7, whiteSpace: "nowrap", cursor: maxed ? "default" : "pointer", ...(maxed ? { border: `1px solid ${C.border2}`, color: C.faint, background: "#150e08" } : can ? { border: `1px solid ${C.brass}`, color: C.gold, background: "#221710" } : { border: `1px solid ${C.border}`, color: C.muted, background: "#150e08" }) }}
    >
      {maxed ? "MAX" : `+ ${cost}`}
    </button>
  );
}

function Room({ id, me, dispatch, bg, name, headerRight, borderTop, ph, children }: {
  id: DepartmentId;
  me: Player;
  dispatch: (a: Action) => boolean;
  bg: string;
  name: string;
  headerRight?: React.ReactNode;
  borderTop?: string;
  ph?: boolean;
  children: React.ReactNode;
}) {
  const d = me.distillery.departments.find((x) => x.id === id)!;
  const meta = DEPT_META[id];
  const maxed = d.level >= d.maxLevel;
  const nextEffect = maxed ? "maxed" : `${d.values[d.level + 1]}`;
  return (
    <div style={{ display: "flex", flexDirection: "column", borderRadius: 12, border: `1px solid ${C.border}`, background: bg, boxShadow: "inset 0 1px 0 rgba(240,201,112,.08)", padding: "11px 13px", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 9 }}>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, color: C.ink, whiteSpace: "nowrap" }}>{name}</span>
        <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", color: meta.color }}>{meta.tag}</span>
        {ph && <span style={{ fontFamily: MONO, fontSize: 8, color: "#0c0805", background: C.muted, padding: "1px 5px", borderRadius: 3 }}>PH</span>}
        {headerRight && <><div style={{ flex: 1 }} />{headerRight}</>}
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 9, borderTop: `1px solid ${borderTop ?? C.border2}` }}>
        <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted }}>next {nextEffect}</span>
        <div style={{ flex: 1, display: "flex", gap: 3, justifyContent: "flex-end" }}><Pips dept={id} me={me} /></div>
        <ImproveBtn id={id} me={me} dispatch={dispatch} />
      </div>
    </div>
  );
}

// ── Market (STAND-IN — structure real, content illustrative) ──────────
function MarketAside({ game }: { game: GameState }) {
  const TRIGGERS = ["On Start", "Req", "On Fill", "On Done"];
  const STANDINS = [
    { title: "Cooper's Run", requirement: "2× Aged Wheated", slots: 3, filled: 1, status: "FILLING" },
    { title: "Cold Snap Order", requirement: "Any 3 Common", slots: 4, filled: 2, status: "FILLING" },
    { title: "Rye Ask", requirement: "1× Specialty Rye", slots: 2, filled: 0, status: "OPEN" },
    { title: "Bonded Lot", requirement: "2× Aged Four-Grain", slots: 3, filled: 0, status: "OPEN" },
    { title: "Holiday Pull", requirement: "Any 2 Specialty", slots: 2, filled: 1, status: "FILLING" },
    { title: "Corn Contract", requirement: "3× High-Corn", slots: 3, filled: 0, status: "OPEN" },
  ];
  const orders = STANDINS.slice(0, Math.max(1, game.players.length));
  return (
    <aside style={{ display: "flex", flexDirection: "column", gap: 11, borderRadius: 16, background: "linear-gradient(180deg,#1a120b,#130c06)", border: `1px solid ${C.border}`, boxShadow: "inset 0 1px 0 rgba(240,201,112,.08)", padding: 13, minHeight: 0, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, flex: "0 0 auto" }}>
        <span style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: C.brass }}>The Market</span>
        <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: C.muted }}>demand {game.demand}</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".08em", color: "#0c0805", background: C.muted, padding: "2px 6px", borderRadius: 4 }}>STAND-IN</span>
      </div>
      <div style={{ fontSize: 11, color: C.muted, lineHeight: 1.45, flex: "0 0 auto" }}>One order card per player. Fill slots in Play; symmetry warms/cools next round.</div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 9, overflow: "hidden" }}>
        {orders.map((o, idx) => {
          const complete = o.filled >= o.slots;
          const color = PLAYER_COLORS[idx % PLAYER_COLORS.length]!;
          const player = game.players[idx]?.name ?? "—";
          return (
            <div key={idx} style={{ borderRadius: 11, padding: "10px 12px", background: "linear-gradient(180deg, rgba(40,28,18,.55), rgba(20,14,8,.92))", border: `1px solid ${complete ? C.green : C.border}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
                <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: C.ink }}>{o.title}</span>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", color: C.muted }}>{player}</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".06em", textTransform: "uppercase", padding: "2px 6px", borderRadius: 4, ...(complete ? { color: C.green, background: "rgba(109,178,140,.16)" } : o.status === "OPEN" ? { color: C.muted, background: "#221710" } : { color: C.amber, background: "rgba(213,150,80,.14)" }) }}>{complete ? "COMPLETE" : o.status}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted }}>Req</span>
                <span style={{ fontFamily: MONO, fontSize: 10, color: C.amber }}>{o.requirement}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 7 }}>
                <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".1em", textTransform: "uppercase", color: C.muted }}>Slots</span>
                <div style={{ display: "flex", gap: 4 }}>
                  {Array.from({ length: o.slots }).map((_, i) => (
                    <span key={i} style={{ width: 18, height: 18, borderRadius: 5, ...(i < o.filled ? { background: "linear-gradient(180deg,#f0c970,#c69d52)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.4)" } : { background: "rgba(20,14,8,.5)", border: "1.5px dashed rgba(110,80,50,.55)" }) }} />
                  ))}
                </div>
                <span style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginLeft: 2 }}>{o.filled}/{o.slots}{complete ? " · complete" : " filled"}</span>
              </div>
              <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                {TRIGGERS.map((t) => (
                  <span key={t} style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".04em", textTransform: "uppercase", padding: "3px 7px", borderRadius: 5, color: "#9a8259", background: "rgba(40,28,18,.6)", border: `1px solid ${C.border2}` }}>{t}</span>
                ))}
              </div>
            </div>
          );
        })}
        <div style={{ borderRadius: 11, border: "1.5px dashed #4a3826", background: "repeating-linear-gradient(45deg, rgba(40,28,18,.4) 0px, rgba(40,28,18,.4) 8px, rgba(20,14,8,.4) 8px, rgba(20,14,8,.4) 16px)", padding: "10px 12px", flex: "0 0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 14, color: C.text2 }}>The Glut</span>
            <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: ".08em", color: "#0c0805", background: "#6f5c45", padding: "2px 6px", borderRadius: 4 }}>NOT SPAWNED</span>
          </div>
          <div style={{ fontSize: 10, color: C.muted, lineHeight: 1.45, marginTop: 5 }}>Lazy-spawns on the first overflow / unmatched sale. Demand −1 on entry · accepts anything · matrix-only.</div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 10, borderTop: `1px solid ${C.border2}`, flex: "0 0 auto" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".06em", color: C.muted, lineHeight: 1.5 }}>Empty slots warm demand next round · glut entries cool it · floor 0.</span>
      </div>
    </aside>
  );
}
