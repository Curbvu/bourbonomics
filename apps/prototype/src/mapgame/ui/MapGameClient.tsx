"use client";

// Bourbonomics: Map Game — playable v0 client.
//
// A fixed 1920×1080 canvas (via ScalingHost): a hex map of taste-space, a
// Distill row rail, the human's cellar + action-card hand, a tile inspector,
// and a Push (combat) modal. Wired straight to the engine. No scrollbars — the
// log shows only its tail. See docs/MAP_GAME_SPEC.md for the rules.

import { useEffect, useMemo, useRef, useState } from "react";
import ScalingHost from "../../app/components/ScalingHost";
import {
  CONFIG,
  applyAction,
  axialToPixel,
  botAction,
  controlledTiles,
  createMapGame,
  current,
  effectiveFit,
  hexPolygonPoints,
  isBotTurn,
  nicheStatus,
  shelfUsed,
  tileController,
  totalDistillCost,
} from "../engine";
import type { AcquireMethod, Action, Bourbon, GameState, Tile } from "../engine";

// ── palette ──────────────────────────────────────────────────────────
const C = {
  bg: "#0e1420",
  panel: "#182234",
  panel2: "#111a29",
  rail: "#141d2c",
  border: "#2a3a53",
  border2: "#38496640",
  text: "#e2e9f4",
  muted: "#8ca0bd",
  faint: "#5f728c",
  gold: "#e0a94a",
  green: "#46b46e",
  red: "#e0553a",
  blue: "#48a6d6",
};
const PLAYER_COLORS = ["#e0a94a", "#e0553a", "#46b46e", "#9a6fe0", "#48a6d6", "#d64890"];
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const SANS = "'Inter', system-ui, sans-serif";

const TRAIT_LABEL: Record<string, string> = { rye: "Rye", wheat: "Wht", corn: "Corn", aged: "Aged", premium: "Prem" };
const TRAIT_LETTER: Record<string, string> = { rye: "R", wheat: "W", corn: "C", aged: "A", premium: "P" };

function pc(i: number): string {
  return PLAYER_COLORS[i % PLAYER_COLORS.length]!;
}

// ── root ─────────────────────────────────────────────────────────────
export default function MapGameClient() {
  const [game, setGame] = useState<GameState | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }

  function start(players: number) {
    const names = Array.from({ length: players }, (_, i) => (i === 0 ? "You" : `Rival ${i}`));
    const g = createMapGame({
      seed: (Math.floor(Date.now() / 1000) % 100000) + 1,
      playerNames: names,
      botFlags: names.map((_, i) => i !== 0),
    });
    setGame(g);
  }

  if (!game) {
    return (
      <Shell>
        <SetupScreen onStart={start} />
      </Shell>
    );
  }

  return (
    <Shell>
      <Board game={game} setGame={setGame} flash={flash} onNew={() => setGame(null)} toast={toast} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg }}>
      <style>{GLOBAL_CSS}</style>
      <ScalingHost>
        <div style={{ width: 1920, height: 1080, background: "radial-gradient(120% 100% at 50% 0%, #16233a, #0b111c 70%)", color: C.text, fontFamily: SANS }}>
          {children}
        </div>
      </ScalingHost>
    </div>
  );
}

const GLOBAL_CSS = `
.mg-btn { transition: filter .12s ease, transform .12s ease; cursor: pointer; }
.mg-btn:not(:disabled):hover { filter: brightness(1.12); transform: translateY(-1px); }
.mg-btn:disabled { opacity: .4; cursor: default; }
.mg-hex { transition: filter .1s ease; cursor: pointer; }
.mg-hex:hover { filter: brightness(1.15); }
::-webkit-scrollbar { width: 0; height: 0; }
`;

// ── setup ────────────────────────────────────────────────────────────
function SetupScreen({ onStart }: { onStart: (players: number) => void }) {
  const [n, setN] = useState(2);
  return (
    <div style={{ display: "grid", placeItems: "center", height: "100%" }}>
      <div style={{ width: 620, padding: 44, borderRadius: 18, border: `1px solid ${C.border}`, background: C.panel, boxShadow: "0 20px 60px rgba(0,0,0,.5)" }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".28em", textTransform: "uppercase", color: C.gold }}>Bourbonomics</div>
        <div style={{ fontSize: 40, fontWeight: 700, marginTop: 6 }}>Map Game <span style={{ color: C.muted, fontSize: 20, fontWeight: 500 }}>· v0 playtest</span></div>
        <p style={{ color: C.muted, lineHeight: 1.6, marginTop: 14, fontSize: 15 }}>
          A territorial game of taste-space. Build Distribution Points across a hex map, distill bourbons into your
          cellar, and Push rivals off contested shelves. Control contiguous tiles to declare a <b style={{ color: C.text }}>niche</b> and
          harvest its rewards. Unspent Capital wins. Rivals are AI (they expand &amp; defend, but won&apos;t attack you in this build).
        </p>
        <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: C.muted, marginTop: 22 }}>Players</div>
        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {[2, 3, 4].map((k) => (
            <button key={k} onClick={() => setN(k)} className="mg-btn"
              style={{ width: 56, height: 52, borderRadius: 10, fontFamily: MONO, fontWeight: 700, fontSize: 16, border: `1px solid ${n === k ? C.gold : C.border}`, color: n === k ? C.bg : C.text, background: n === k ? C.gold : C.panel2 }}>
              {k}
            </button>
          ))}
        </div>
        <button onClick={() => onStart(n)} className="mg-btn"
          style={{ marginTop: 28, width: "100%", padding: "15px 0", borderRadius: 12, border: 0, fontFamily: MONO, fontWeight: 700, fontSize: 14, letterSpacing: ".14em", textTransform: "uppercase", color: C.bg, background: C.gold }}>
          ▶ Start playtest
        </button>
        <a href="/" style={{ display: "block", textAlign: "center", marginTop: 16, fontFamily: MONO, fontSize: 11, letterSpacing: ".14em", textTransform: "uppercase", color: C.muted, textDecoration: "none" }}>← main menu</a>
      </div>
    </div>
  );
}

// ── local UI state for the human's turn ──────────────────────────────
type Mode = "inspect" | "niche" | "placeTile";
interface PushDraft {
  tileId: string;
  variant: "attack" | "purge";
  defenderId: string;
  selected: Set<string>;
}

function Board({ game, setGame, flash, onNew, toast }: { game: GameState; setGame: (g: GameState) => void; flash: (m: string) => void; onNew: () => void; toast: string | null }) {
  const humanIdx = game.players.findIndex((p) => !p.isBot);
  const human = game.players[humanIdx]!;
  const onClock = game.phase === "playing" ? current(game) : null;
  const isHumanTurn = game.phase === "playing" && onClock?.id === human.id;
  const canAct = isHumanTurn && game.stage === "act";
  const mustChoose = isHumanTurn && game.stage === "choose";

  const [selTile, setSelTile] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("inspect");
  const [nicheSel, setNicheSel] = useState<Set<string>>(new Set());
  const [push, setPush] = useState<PushDraft | null>(null);

  function resetLocal() {
    setMode("inspect");
    setNicheSel(new Set());
    setPush(null);
  }

  function dispatch(a: Action): boolean {
    const r = applyAction(game, a);
    if (!r.ok) {
      flash("⚠ " + r.reason);
      return false;
    }
    setGame(r.state);
    return true;
  }

  // ── bot driver ──────────────────────────────────────────────────────
  useEffect(() => {
    if (game.phase !== "playing") return;
    if (!isBotTurn(game)) return;
    const a = botAction(game);
    if (!a) return;
    const t = setTimeout(() => {
      const r = applyAction(game, a);
      if (r.ok) setGame(r.state);
    }, 420);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game]);

  function skipBots() {
    let s = game;
    let guard = 0;
    while (guard++ < 500 && s.phase === "playing" && isBotTurn(s)) {
      const a = botAction(s);
      if (!a) break;
      const r = applyAction(s, a);
      if (!r.ok) break;
      s = r.state;
    }
    setGame(s);
  }

  // reset transient selections when the turn owner changes
  useEffect(() => { resetLocal(); setSelTile(null); }, [game.turnPos, game.stage, game.round, game.age]);

  return (
    <div style={{ position: "relative", width: 1920, height: 1080, display: "grid", gridTemplateColumns: "1340px 580px", gridTemplateRows: "72px 1fr" }}>
      {/* top bar */}
      <TopBar game={game} human={human} onClock={onClock} onNew={onNew} onSkip={skipBots} isHumanTurn={isHumanTurn} />

      {/* map */}
      <div style={{ position: "relative", gridColumn: 1, gridRow: 2, padding: "10px 8px 8px 16px" }}>
        <HexMap
          game={game}
          humanId={human.id}
          selTile={selTile}
          mode={mode}
          nicheSel={nicheSel}
          onTileClick={(id) => {
            if (mode === "niche") {
              const next = new Set(nicheSel);
              next.has(id) ? next.delete(id) : next.add(id);
              setNicheSel(next);
              return;
            }
            if (mode === "placeTile") {
              if (dispatch({ type: "PLACE_TILE", nearTileId: id })) setMode("inspect");
              return;
            }
            setSelTile(id);
          }}
        />
        {/* cellar strip */}
        <Cellar human={human} game={game} selTile={selTile} />
      </div>

      {/* right rail */}
      <div style={{ gridColumn: 2, gridRow: 2, background: C.rail, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <DistillRow game={game} human={human} canAct={canAct} onDistill={(slotIndex, method) => dispatch({ type: "DISTILL", slotIndex, method })} />
        <TileInspector
          game={game}
          humanId={human.id}
          canAct={canAct}
          tileId={selTile}
          mode={mode}
          setMode={setMode}
          nicheSel={nicheSel}
          onAction={dispatch}
          onStartPush={(variant, tileId, defenderId) => setPush({ variant, tileId, defenderId, selected: new Set() })}
          onDeclareNiche={() => {
            if (dispatch({ type: "DECLARE_NICHE", tileIds: [...nicheSel] })) { setMode("inspect"); setNicheSel(new Set()); }
          }}
        />
        <Log game={game} />
      </div>

      {/* choose-card overlay */}
      {mustChoose && <ChooseOverlay human={human} onPick={(cardId, sac) => dispatch(sac ? { type: "SACRIFICE_CARD", cardId } : { type: "CHOOSE_CARD", cardId })} />}

      {/* push modal */}
      {push && (
        <PushModal
          game={game}
          human={human}
          draft={push}
          setDraft={setPush}
          onConfirm={() => {
            if (dispatch({ type: "PUSH", variant: push.variant, tileId: push.tileId, defender: push.defenderId, bourbonIds: [...push.selected] })) {
              setPush(null);
            }
          }}
          onCancel={() => setPush(null)}
        />
      )}

      {game.phase === "ended" && <EndOverlay game={game} onNew={onNew} />}
      {toast && <div style={{ position: "absolute", bottom: 26, left: "50%", transform: "translateX(-50%)", background: "#000c", color: C.text, padding: "10px 18px", borderRadius: 10, fontFamily: MONO, fontSize: 13, border: `1px solid ${C.border}` }}>{toast}</div>}
    </div>
  );
}

// ── top bar ──────────────────────────────────────────────────────────
function TopBar({ game, human, onClock, onNew, onSkip, isHumanTurn }: { game: GameState; human: GameState["players"][number]; onClock: GameState["players"][number] | null; onNew: () => void; onSkip: () => void; isHumanTurn: boolean }) {
  return (
    <div style={{ gridColumn: "1 / span 2", gridRow: 1, display: "flex", alignItems: "center", gap: 20, padding: "0 22px", borderBottom: `1px solid ${C.border}`, background: C.panel2 }}>
      <div style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: ".2em", textTransform: "uppercase", color: C.gold }}>Map Game</div>
      <Pill label="Age" value={`${game.age}/${CONFIG.AGES}`} />
      <Pill label="Round" value={`${game.round}/${CONFIG.ROUNDS_PER_AGE}`} />
      <Pill label="Stage" value={game.stage === "choose" ? "Choose card" : "Act"} />
      <div style={{ flex: 1 }} />
      {/* human resources */}
      <Stat color={C.gold} label="Capital" value={human.capital} />
      <Stat color={C.blue} label="Tokens" value={human.tokens} />
      <Stat color={C.muted} label="Agents" value={human.agents} />
      {game.stage === "act" && isHumanTurn && <Stat color={C.green} label="Bips" value={human.bips} />}
      <div style={{ width: 1, height: 34, background: C.border }} />
      <div style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>
        {game.phase === "ended" ? "Game over" : onClock ? (
          <span>On the clock: <b style={{ color: pc(onClock.colorIdx) }}>{onClock.name}</b>{isHumanTurn ? " — your turn" : "…"}</span>
        ) : null}
      </div>
      {!isHumanTurn && game.phase === "playing" && (
        <button className="mg-btn" onClick={onSkip} style={btnGhost}>⏩ Skip</button>
      )}
      <button className="mg-btn" onClick={onNew} style={btnGhost}>New</button>
    </div>
  );
}

const btnGhost: React.CSSProperties = { padding: "7px 12px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.panel, color: C.text, fontFamily: MONO, fontSize: 11, letterSpacing: ".1em", textTransform: "uppercase" };

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".18em", textTransform: "uppercase", color: C.muted }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700 }}>{value}</span>
    </div>
  );
}
function Stat({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", lineHeight: 1.05 }}>
      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: ".16em", textTransform: "uppercase", color: C.muted }}>{label}</span>
      <span style={{ fontFamily: MONO, fontSize: 19, fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

// ── hex map ──────────────────────────────────────────────────────────
function HexMap({ game, humanId, selTile, mode, nicheSel, onTileClick }: { game: GameState; humanId: string; selTile: string | null; mode: Mode; nicheSel: Set<string>; onTileClick: (id: string) => void }) {
  const SIZE = 60;
  const layout = useMemo(() => {
    const pts = game.tiles.map((t) => ({ t, ...axialToPixel(t.hex, SIZE) }));
    const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
    const pad = SIZE * 1.4;
    const minX = Math.min(...xs) - pad, maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad, maxY = Math.max(...ys) + pad;
    return { pts, viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}` };
  }, [game.tiles]);

  return (
    <div style={{ height: 620, borderRadius: 14, border: `1px solid ${C.border}`, background: C.panel2, overflow: "hidden" }}>
      <svg width="100%" height="100%" viewBox={layout.viewBox} preserveAspectRatio="xMidYMid meet" style={{ display: "block" }}>
        {layout.pts.map(({ t, x, y }) => (
          <HexTile
            key={t.id}
            game={game}
            tile={t}
            cx={x}
            cy={y}
            size={SIZE}
            humanId={humanId}
            selected={selTile === t.id}
            nicheSelected={mode === "niche" && nicheSel.has(t.id)}
            onClick={() => onTileClick(t.id)}
          />
        ))}
      </svg>
    </div>
  );
}

function HexTile({ game, tile, cx, cy, size, humanId, selected, nicheSelected, onClick }: { game: GameState; tile: Tile; cx: number; cy: number; size: number; humanId: string; selected: boolean; nicheSelected: boolean; onClick: () => void }) {
  const controller = tileController(game, tile.id);
  const ctrlIdx = controller ? game.players.find((p) => p.id === controller)?.colorIdx ?? null : null;
  const dps = game.dps.filter((d) => d.tileId === tile.id);
  const byOwner = new Map<string, { active: number; inactive: number; colorIdx: number }>();
  for (const d of dps) {
    const owner = game.players.find((p) => p.id === d.owner)!;
    const e = byOwner.get(d.owner) ?? { active: 0, inactive: 0, colorIdx: owner.colorIdx };
    if (d.status === "active") e.active++; else e.inactive++;
    byOwner.set(d.owner, e);
  }
  const used = shelfUsed(game, tile.id);
  const borderColor = nicheSelected ? C.gold : selected ? "#fff" : ctrlIdx !== null ? pc(ctrlIdx) : C.border;
  const inNiche = game.niches.find((n) => n.tileIds.includes(tile.id));

  return (
    <g className="mg-hex" onClick={onClick}>
      <polygon
        points={hexPolygonPoints(cx, cy, size)}
        fill={inNiche ? `${pc(game.players.find((p) => p.id === inNiche.owner)!.colorIdx)}18` : "#1b283d"}
        stroke={borderColor}
        strokeWidth={selected || nicheSelected ? 4 : ctrlIdx !== null ? 3 : 1.5}
      />
      {/* traits */}
      <text x={cx} y={cy - size * 0.42} textAnchor="middle" fontFamily={MONO} fontSize={13} fontWeight={700} fill={C.text}>
        {tile.traits.map((t) => TRAIT_LETTER[t]).join(" ")}
        {tile.averse && <tspan fill={C.red}> ✕{TRAIT_LETTER[tile.averse]}</tspan>}
      </text>
      {/* reward icon */}
      {tile.reward && (
        <text x={cx} y={cy - size * 0.12} textAnchor="middle" fontFamily={MONO} fontSize={15} fontWeight={700} fill={tile.reward === "capital" ? C.gold : C.blue}>
          {tile.reward === "capital" ? "◆ Cap" : "❖ Tok"}
        </text>
      )}
      {/* DP chips grouped by owner */}
      {[...byOwner.entries()].map(([owner, e], i) => (
        <text key={owner} x={cx} y={cy + size * 0.2 + i * 15} textAnchor="middle" fontFamily={MONO} fontSize={13} fontWeight={700} fill={pc(e.colorIdx)}>
          {"●".repeat(e.active)}{"○".repeat(e.inactive)}
        </text>
      ))}
      {/* shelf capacity */}
      <text x={cx} y={cy + size * 0.72} textAnchor="middle" fontFamily={MONO} fontSize={9} fill={C.muted}>
        shelf {used}/{tile.shelfCapacity}
      </text>
    </g>
  );
}

// ── cellar strip ─────────────────────────────────────────────────────
function Cellar({ human, game, selTile }: { human: GameState["players"][number]; game: GameState; selTile: string | null }) {
  const tile = selTile ? game.tiles.find((t) => t.id === selTile) : null;
  return (
    <div style={{ position: "absolute", left: 16, right: 8, bottom: 8, height: 168, borderRadius: 14, border: `1px solid ${C.border}`, background: C.panel, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: C.gold }}>Your Cellar</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>{human.cellar.length}/{CONFIG.CELLAR_CAPACITY}</span>
        {tile && <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted, marginLeft: "auto" }}>fit shown vs selected tile &ldquo;{tile.id}&rdquo;</span>}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {human.cellar.length === 0 && <span style={{ color: C.muted, fontSize: 13 }}>Empty — distill bourbons from the row on the right.</span>}
        {human.cellar.map((b) => (
          <BourbonTile key={b.id} b={b} fit={tile ? effectiveFit(b, tile) : undefined} />
        ))}
      </div>
    </div>
  );
}

function BourbonTile({ b, fit, selected, onClick }: { b: Bourbon; fit?: number; selected?: boolean; onClick?: () => void }) {
  return (
    <div onClick={onClick} className={onClick ? "mg-btn" : undefined}
      style={{ width: 128, borderRadius: 10, border: `1px solid ${selected ? C.gold : C.border}`, background: selected ? "#20304a" : C.panel2, padding: "8px 10px", opacity: b.state === "flipped" ? 0.5 : 1 }}>
      <div style={{ fontSize: 12, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</div>
      <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, marginTop: 2 }}>{b.traits.map((t) => TRAIT_LABEL[t]).join(" · ")}</div>
      <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", fontFamily: MONO, fontSize: 10 }}>
        <span style={{ color: C.gold }}>M{b.maturitySlot}</span>
        <span style={{ color: C.muted }}>ceil {b.ceiling}</span>
        {b.locked && <span style={{ color: C.red }}>🔒</span>}
        {b.state === "flipped" && <span style={{ color: C.muted }}>flipped</span>}
        {fit !== undefined && <span style={{ marginLeft: "auto", color: fit === 0 ? C.red : C.green, fontWeight: 700 }}>fit {fit}</span>}
      </div>
    </div>
  );
}

// ── distill row ──────────────────────────────────────────────────────
function DistillRow({ game, human, canAct, onDistill }: { game: GameState; human: GameState["players"][number]; canAct: boolean; onDistill: (slotIndex: number, method: AcquireMethod) => void }) {
  return (
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.border}` }}>
      <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>Distill Row <span style={{ color: C.muted, textTransform: "none", letterSpacing: 0 }}>· grab=1 agent (young) · court=3 (mature)</span></div>
      <div style={{ display: "flex", gap: 8 }}>
        {game.distillRow.map((slot, i) => {
          const cost = totalDistillCost(slot.def.basePrice, i);
          const mine = slot.agents[human.id];
          const affordable = human.capital >= cost && human.agents >= 1 && human.cellar.length < CONFIG.CELLAR_CAPACITY;
          return (
            <div key={i} style={{ flex: 1, borderRadius: 10, border: `1px solid ${C.border}`, background: C.panel2, padding: "8px 8px 10px" }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.2, minHeight: 28 }}>{slot.def.name}</div>
              <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 3 }}>{slot.def.traits.map((t) => TRAIT_LETTER[t]).join("")} · ceil{slot.def.ceiling}</div>
              <div style={{ fontFamily: MONO, fontSize: 11, color: C.gold, marginTop: 5 }}>◆ {cost}</div>
              {Object.entries(slot.agents).length > 0 && (
                <div style={{ fontFamily: MONO, fontSize: 9, color: C.muted, marginTop: 3 }}>
                  {Object.entries(slot.agents).map(([pid, a]) => {
                    const pl = game.players.find((p) => p.id === pid)!;
                    return <span key={pid} style={{ color: pc(pl.colorIdx), marginRight: 4 }}>{a.method[0]!.toUpperCase()}{a.count}</span>;
                  })}
                </div>
              )}
              <div style={{ display: "flex", gap: 4, marginTop: 6 }}>
                <button className="mg-btn" disabled={!canAct || !affordable || (mine && mine.method === "court")} onClick={() => onDistill(i, "grab")}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: 0, background: C.green, color: C.bg, fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>Grab</button>
                <button className="mg-btn" disabled={!canAct || human.agents < 1 || (mine && mine.method === "grab")} onClick={() => onDistill(i, "court")}
                  style={{ flex: 1, padding: "5px 0", borderRadius: 6, border: 0, background: C.blue, color: C.bg, fontFamily: MONO, fontSize: 10, fontWeight: 700 }}>Court</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── tile inspector / action panel ────────────────────────────────────
function TileInspector({ game, humanId, canAct, tileId, mode, setMode, nicheSel, onAction, onStartPush, onDeclareNiche }: {
  game: GameState; humanId: string; canAct: boolean; tileId: string | null; mode: Mode; setMode: (m: Mode) => void; nicheSel: Set<string>; onAction: (a: Action) => boolean; onStartPush: (variant: "attack" | "purge", tileId: string, defenderId: string) => void; onDeclareNiche: () => void;
}) {
  const tile = tileId ? game.tiles.find((t) => t.id === tileId) : null;
  const myDPs = tile ? game.dps.filter((d) => d.tileId === tile.id && d.owner === humanId) : [];
  const myInactive = myDPs.find((d) => d.status === "inactive");
  const rivalsActive = tile ? [...new Set(game.dps.filter((d) => d.tileId === tile.id && d.owner !== humanId && d.status === "active").map((d) => d.owner))] : [];
  const rivalsInactive = tile ? [...new Set(game.dps.filter((d) => d.tileId === tile.id && d.owner !== humanId && d.status === "inactive").map((d) => d.owner))] : [];
  const iHaveActive = myDPs.some((d) => d.status === "active");
  const shelfFull = tile ? shelfUsed(game, tile.id) >= tile.shelfCapacity : true;
  const myNiches = game.niches.filter((n) => n.owner === humanId);

  return (
    <div style={{ flex: 1, minHeight: 0, padding: "12px 14px", borderBottom: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 8, overflow: "hidden" }}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <ModeBtn active={mode === "niche"} label={mode === "niche" ? `Declaring… (${nicheSel.size})` : "＋ Declare niche"} onClick={() => setMode(mode === "niche" ? "inspect" : "niche")} disabled={!canAct} />
        <ModeBtn active={mode === "placeTile"} label="＋ Place tile (blue ocean)" onClick={() => setMode(mode === "placeTile" ? "inspect" : "placeTile")} disabled={!canAct} />
        <ModeBtn active={false} label="⇧ Spend token → bip" onClick={() => onAction({ type: "SPEND_TOKEN" })} disabled={!canAct} />
      </div>

      {mode === "niche" && (
        <div style={{ borderRadius: 10, border: `1px dashed ${C.gold}`, padding: 10, background: "#1c273c" }}>
          <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>Click ≥{CONFIG.NICHE_MIN_TILES} contiguous tiles you control, then confirm.</div>
          <button className="mg-btn" disabled={!canAct || nicheSel.size < CONFIG.NICHE_MIN_TILES} onClick={onDeclareNiche}
            style={{ marginTop: 8, padding: "8px 14px", borderRadius: 8, border: 0, background: C.gold, color: C.bg, fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>Confirm niche ({nicheSel.size})</button>
        </div>
      )}
      {mode === "placeTile" && <div style={{ fontSize: 12, color: C.gold }}>Click a tile you have access to — a new market opens beside it.</div>}

      {mode === "inspect" && !tile && <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Select a tile to inspect it and act.</div>}

      {mode === "inspect" && tile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>Tile {tile.id.replace("tile_", "#")}</span>
            <span style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>likes {tile.traits.map((t) => TRAIT_LABEL[t]).join(", ")}{tile.averse ? ` · averse ${TRAIT_LABEL[tile.averse]}` : ""}</span>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted }}>
            shelf {shelfUsed(game, tile.id)}/{tile.shelfCapacity} · controller {controllerName(game, tile.id)}{tile.reward ? ` · reward ${tile.reward}` : ""}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            <ActBtn label={`Build DP (${CONFIG.COST_BUILD_DP})`} color={C.green} disabled={!canAct || shelfFull} onClick={() => onAction({ type: "BUILD_DP", tileId: tile.id })} />
            {myInactive && <ActBtn label={`Repair DP (${CONFIG.COST_REPAIR_DP})`} color={C.blue} disabled={!canAct} onClick={() => onAction({ type: "REPAIR_DP", dpId: myInactive.id })} />}
            {iHaveActive && rivalsActive.length > 0 && (
              <ActBtn label={`Attack (${CONFIG.COST_PUSH}+◆)`} color={C.red} disabled={!canAct} onClick={() => onStartPush("attack", tile.id, rivalsActive[0]!)} />
            )}
            {iHaveActive && rivalsInactive.length > 0 && (
              <ActBtn label={`Purge (${CONFIG.COST_PUSH}+◆)`} color={C.red} disabled={!canAct} onClick={() => onStartPush("purge", tile.id, rivalsInactive[0]!)} />
            )}
            {myNiches.map((n) => (
              <ActBtn key={n.id} label={`Add to niche (${CONFIG.COST_ADD_TILE_TO_NICHE})`} color={C.gold} disabled={!canAct} onClick={() => onAction({ type: "ADD_TILE_TO_NICHE", nicheId: n.id, tileId: tile.id })} />
            ))}
          </div>
        </div>
      )}

      <div style={{ flex: 1 }} />
      <NichePanel game={game} humanId={humanId} />
      {canAct && (
        <button className="mg-btn" onClick={() => onAction({ type: "END_TURN" })}
          style={{ padding: "11px 0", borderRadius: 10, border: 0, background: C.gold, color: C.bg, fontFamily: MONO, fontSize: 13, fontWeight: 700, letterSpacing: ".08em" }}>End turn ▸</button>
      )}
    </div>
  );
}

function NichePanel({ game, humanId }: { game: GameState; humanId: string }) {
  const mine = game.niches.filter((n) => n.owner === humanId);
  const ctrl = controlledTiles(game, humanId).length;
  return (
    <div style={{ fontFamily: MONO, fontSize: 11, color: C.muted, borderTop: `1px solid ${C.border2}`, paddingTop: 6 }}>
      You control {ctrl} tile(s). {mine.length === 0 ? "No niches yet." : mine.map((n) => `Niche(${n.tileIds.length}): ${nicheStatus(game, n)}`).join(" · ")}
    </div>
  );
}

function ModeBtn({ active, label, onClick, disabled }: { active: boolean; label: string; onClick: () => void; disabled: boolean }) {
  return (
    <button className="mg-btn" disabled={disabled} onClick={onClick}
      style={{ padding: "7px 10px", borderRadius: 8, border: `1px solid ${active ? C.gold : C.border}`, background: active ? C.gold : C.panel2, color: active ? C.bg : C.text, fontFamily: MONO, fontSize: 11, fontWeight: 600 }}>{label}</button>
  );
}
function ActBtn({ label, color, onClick, disabled }: { label: string; color: string; onClick: () => void; disabled: boolean }) {
  return (
    <button className="mg-btn" disabled={disabled} onClick={onClick}
      style={{ padding: "8px 12px", borderRadius: 8, border: 0, background: color, color: C.bg, fontFamily: MONO, fontSize: 11.5, fontWeight: 700 }}>{label}</button>
  );
}

function controllerName(game: GameState, tileId: string): string {
  const c = tileController(game, tileId);
  if (!c) return "contested/none";
  const p = game.players.find((x) => x.id === c)!;
  return p.name;
}

// ── choose overlay ───────────────────────────────────────────────────
function ChooseOverlay({ human, onPick }: { human: GameState["players"][number]; onPick: (cardId: string, sacrifice: boolean) => void }) {
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0009", display: "grid", placeItems: "center", zIndex: 40 }}>
      <div style={{ width: 720, padding: 30, borderRadius: 16, border: `1px solid ${C.border}`, background: C.panel }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: C.gold }}>Choose your action card</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 6 }}>Fewer bips = earlier initiative (you act sooner). More bips = more actions this round.</div>
        <div style={{ display: "flex", gap: 12, marginTop: 20, flexWrap: "wrap" }}>
          {human.hand.map((c) => (
            <div key={c.id} style={{ width: 128, borderRadius: 12, border: `1px solid ${C.border}`, background: C.panel2, padding: 16, textAlign: "center" }}>
              <div style={{ fontFamily: MONO, fontSize: 34, fontWeight: 700, color: C.gold }}>{c.bips}</div>
              <div style={{ fontFamily: MONO, fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: ".1em" }}>bips</div>
              <button className="mg-btn" onClick={() => onPick(c.id, false)} style={{ marginTop: 12, width: "100%", padding: "8px 0", borderRadius: 8, border: 0, background: C.gold, color: C.bg, fontFamily: MONO, fontSize: 12, fontWeight: 700 }}>Play</button>
              <button className="mg-btn" onClick={() => onPick(c.id, true)} style={{ marginTop: 6, width: "100%", padding: "5px 0", borderRadius: 8, border: `1px solid ${C.border}`, background: "transparent", color: C.muted, fontFamily: MONO, fontSize: 9 }}>sacrifice (1)</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── push modal ───────────────────────────────────────────────────────
function PushModal({ game, human, draft, setDraft, onConfirm, onCancel }: { game: GameState; human: GameState["players"][number]; draft: PushDraft; setDraft: (d: PushDraft) => void; onConfirm: () => void; onCancel: () => void }) {
  const tile = game.tiles.find((t) => t.id === draft.tileId)!;
  const defender = game.players.find((p) => p.id === draft.defenderId)!;
  const usable = human.cellar.filter((b) => b.state === "fresh" && !b.locked);
  const atkDP = game.dps.filter((d) => d.tileId === tile.id && d.owner === human.id && d.status === "active").length;
  const defActive = game.dps.filter((d) => d.tileId === tile.id && d.owner === defender.id && d.status === "active").length;
  const selFit = [...draft.selected].reduce((s, id) => {
    const b = human.cellar.find((x) => x.id === id);
    return s + (b ? effectiveFit(b, tile) : 0);
  }, 0);
  const atkStrength = atkDP * selFit;

  function toggle(id: string) {
    const next = new Set(draft.selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setDraft({ ...draft, selected: next });
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000a", display: "grid", placeItems: "center", zIndex: 45 }}>
      <div style={{ width: 760, padding: 28, borderRadius: 16, border: `1px solid ${C.red}`, background: C.panel }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".18em", textTransform: "uppercase", color: C.red }}>{draft.variant === "purge" ? "Purge" : "Attack"} · Tile {tile.id.replace("tile_", "#")}</div>
        <div style={{ color: C.muted, fontSize: 13, marginTop: 6, lineHeight: 1.5 }}>
          You commit ≥1 bourbon (burned regardless of outcome). Cost: {CONFIG.COST_PUSH} bip + ◆{defActive} Capital (defender&apos;s active DPs).
          The defender ({defender.name}) responds automatically. Ties go to the defender.
        </div>

        <div style={{ display: "flex", gap: 20, marginTop: 16, fontFamily: MONO, fontSize: 12 }}>
          <span>Your active DPs here: <b>{atkDP}</b></span>
          <span>Committed fit: <b style={{ color: C.gold }}>{selFit}</b></span>
          <span>Your strength: <b style={{ color: C.red }}>{atkStrength}</b> <span style={{ color: C.muted }}>(= {atkDP}×{selFit})</span></span>
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 16, flexWrap: "wrap", minHeight: 90 }}>
          {usable.length === 0 && <span style={{ color: C.muted, fontSize: 13 }}>No fresh, unlocked bourbons to commit — cancel and distill/refresh first.</span>}
          {usable.map((b) => (
            <BourbonTile key={b.id} b={b} fit={effectiveFit(b, tile)} selected={draft.selected.has(b.id)} onClick={() => toggle(b.id)} />
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 20, justifyContent: "flex-end" }}>
          <button className="mg-btn" onClick={onCancel} style={{ ...btnGhost, padding: "10px 18px" }}>Cancel</button>
          <button className="mg-btn" disabled={draft.selected.size < 1} onClick={onConfirm}
            style={{ padding: "10px 22px", borderRadius: 9, border: 0, background: C.red, color: "#fff", fontFamily: MONO, fontSize: 13, fontWeight: 700, opacity: draft.selected.size < 1 ? 0.4 : 1 }}>
            Launch {draft.variant} ▸
          </button>
        </div>
      </div>
    </div>
  );
}

// ── log ──────────────────────────────────────────────────────────────
function Log({ game }: { game: GameState }) {
  const tail = game.log.slice(-9);
  return (
    <div style={{ height: 190, padding: "10px 14px", background: C.panel2, display: "flex", flexDirection: "column", gap: 3 }}>
      <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: ".16em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>Table Log</div>
      {tail.map((line, i) => (
        <div key={i} style={{ fontFamily: MONO, fontSize: 11, lineHeight: 1.35, color: i === tail.length - 1 ? C.text : C.muted }}>{line}</div>
      ))}
    </div>
  );
}

// ── end overlay ──────────────────────────────────────────────────────
function EndOverlay({ game, onNew }: { game: GameState; onNew: () => void }) {
  const ranked = [...game.players].sort((a, b) => b.capital - a.capital);
  return (
    <div style={{ position: "absolute", inset: 0, background: "#000b", display: "grid", placeItems: "center", zIndex: 50 }}>
      <div style={{ width: 520, padding: 32, borderRadius: 16, border: `1px solid ${C.gold}`, background: C.panel, textAlign: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: ".2em", textTransform: "uppercase", color: C.gold }}>Game over</div>
        <div style={{ fontSize: 30, fontWeight: 700, marginTop: 10 }}>{ranked[0]!.name} wins</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 8 }}>
          {ranked.map((p, i) => (
            <div key={p.id} style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 14, color: pc(p.colorIdx) }}>
              <span>{i + 1}. {p.name}</span>
              <span>◆ {p.capital}</span>
            </div>
          ))}
        </div>
        <button className="mg-btn" onClick={onNew} style={{ marginTop: 24, padding: "12px 28px", borderRadius: 10, border: 0, background: C.gold, color: C.bg, fontFamily: MONO, fontSize: 13, fontWeight: 700 }}>New game</button>
      </div>
    </div>
  );
}
