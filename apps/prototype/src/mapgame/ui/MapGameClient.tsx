"use client";

// Bourbonomics: Map Game — playable client, rebuilt on the new engine.
//
// A fixed 1920×1080 canvas (via ScalingHost): a hex map of demand-space on the
// left, a rail on the right (standings · market · your hand + action controls ·
// log tail). You are player 0; rivals are bots that auto-advance. No scrollbars;
// the log shows only its tail. Rules: docs/MAP_GAME_SPEC.md + the build brief.

import { useMemo, useRef, useState } from "react";
import ScalingHost from "../../app/components/ScalingHost";
import Manual from "./Manual";
import {
  applyAction,
  autoAdvance,
  axialToPixel,
  canPlaceDP,
  createGame,
  currentActorOf,
  fit,
  hexPolygonPoints,
  liveDPCount,
  placementCandidates,
  tagColor,
  tileController,
} from "../engine";
import type { Action, ActionType, GameState, Suit, Tile, TokenType } from "../engine";
import { SUIT_ACTIONS } from "../engine";
import {
  Flag,
  grainTint,
  MONO,
  PLAYER_COLOR as PC,
  Pawn,
  rewardColor,
  rewardLabel,
  SANS,
  SERIF,
  SUIT_COLOR,
  SUIT_SHORT,
  T,
  TagGridHTML,
  TagGridSVG,
  tagGlyph,
} from "./theme";

// oak-world palette (mapped from the §0 design tokens)
const C = {
  bg: T.oak,
  panel: T.panel,
  panel2: T.rail,
  border: T.border,
  text: T.cream,
  muted: T.muted,
  faint: T.faint,
  gold: T.gold,
  green: T.green,
  red: T.red,
};
const HUMAN = "p0";

// Friendly labels for the stage pill — never show the raw enum.
const STAGE_LABEL: Record<GameState["stage"], string> = {
  setupPlace: "Place tiles",
  setupDraft: "Opening draft",
  trade: "The Trade",
  catchup: "Catch-up",
  planning: "Planning",
  commit: "Commit",
  resolve: "Resolve",
  ageEnd: "Scoring",
};

export default function MapGameClient() {
  const [game, setGame] = useState<GameState | null>(null);
  const [manual, setManual] = useState(false);

  // ScalingHost only shrinks when its parent bounds the height — mirror the
  // full-viewport flex column the live GameClient gives it (see CLAUDE.md §1).
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg }}>
      <ScalingHost>
        {game ? (
          <Board game={game} setGame={setGame} onNew={() => setGame(null)} onManual={() => setManual(true)} />
        ) : (
          <Setup
            onStart={(n) => setGame(autoAdvance(createGame({ playerNames: names(n), seed: 12345 })))}
            onManual={() => setManual(true)}
          />
        )}
      </ScalingHost>
      {/* The manual is chrome outside the fixed canvas — it may scroll (like /rules). */}
      {manual && <Manual onClose={() => setManual(false)} />}
    </div>
  );
}

function names(n: number): string[] {
  return Array.from({ length: n }, (_, i) => (i === 0 ? "You" : `Rival ${i}`));
}

// ── Setup ────────────────────────────────────────────────────────────
function Setup({ onStart, onManual }: { onStart: (n: number) => void; onManual: () => void }) {
  return (
    <div style={{ width: 1920, height: 1080, background: "radial-gradient(125% 95% at 42% 34%, #f4ecd6 0%, #e4d6b6 52%, #d0bf99 100%)", boxShadow: "inset 0 0 160px 10px #8a6a3a30", color: C.text, fontFamily: SANS, display: "grid", placeItems: "center" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.22, mixBlendMode: "multiply", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")" }} />
      <div style={{ textAlign: "center", position: "relative" }}>
        <div style={{ fontFamily: MONO, fontSize: 14, letterSpacing: 6, color: T.goldSoft, textTransform: "uppercase", marginBottom: 6 }}>The Territory Game</div>
        <div style={{ fontFamily: SERIF, fontSize: 96, fontWeight: 800, letterSpacing: -2, color: "#8f6510", lineHeight: 0.95, textShadow: "0 2px 10px #c8961f2e" }}>Bourbonomics</div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: T.muted, marginTop: 10, marginBottom: 8 }}>A game of demand, distribution &amp; the angel&apos;s share.</div>
        <div style={{ fontSize: 16, color: C.faint, marginBottom: 46 }}>Serve the market — build, flag, and Push for the tiles that pay. Most Capital after 5 ages wins.</div>
        <div style={{ display: "flex", gap: 18, justifyContent: "center" }}>
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onStart(n)}
              style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, padding: "20px 44px", background: "linear-gradient(#fffdf7, #f1e7cf)", color: T.ink, border: `1px solid ${T.gold}`, borderRadius: 14, cursor: "pointer", boxShadow: "0 4px 12px #7a5f2a2e" }}
            >
              {n} <span style={{ fontFamily: MONO, fontSize: 13, color: T.muted }}>PLAYERS</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 34 }}>
          <button
            onClick={onManual}
            style={{ fontSize: 16, fontWeight: 600, padding: "12px 28px", background: "transparent", color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 12, cursor: "pointer" }}
          >
            📖 The Distiller&apos;s Field Guide
          </button>
        </div>
        <div style={{ fontSize: 15, color: C.faint, marginTop: 26 }}>You are player 1 (gold). The rest are bots.</div>
      </div>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────
type Mode = ActionType | "CLAIM_SLOT" | null;

function Board({ game, setGame, onNew, onManual }: { game: GameState; setGame: (g: GameState) => void; onNew: () => void; onManual: () => void }) {
  const [mode, setMode] = useState<Mode>(null);
  const [toast, setToast] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2000);
  };

  const inPlay = game.phase === "playing" || game.phase === "setup";
  const actor = inPlay ? currentActorOf(game) : null;
  const yourTurn = actor?.id === HUMAN && inPlay;
  const you = game.players.find((p) => p.id === HUMAN)!;
  const inSetup = game.phase === "setup";
  // valid empty hexes to place the next setup tile (your turn only)
  const candidates = useMemo(
    () => (inSetup && game.stage === "setupPlace" && yourTurn ? placementCandidates(game) : []),
    [game, inSetup, yourTurn],
  );

  function dispatch(action: Action) {
    const res = applyAction(game, action);
    if (!res.ok) {
      flash(res.reason);
      return;
    }
    setGame(autoAdvance(res.state));
  }

  function clickTile(tile: Tile) {
    if (!yourTurn || tile.category === "BLOCKING") return;
    // Opening draft: click a tile to place a LIVE DP on it (setup-exempt).
    if (game.stage === "setupDraft") return dispatch({ type: "SETUP_PLACE_DP", tileId: tile.id });
    if (game.stage === "resolve" || game.stage === "planning") {
      if (mode === "BUILD_DP") return dispatch({ type: "BUILD_DP", tileId: tile.id });
      if (mode === "ADD_NICHE_FLAG") return dispatch({ type: "ADD_NICHE_FLAG", tileId: tile.id });
      if (mode === "REMOVE_NICHE_FLAG") return dispatch({ type: "REMOVE_NICHE_FLAG", tileId: tile.id });
      if (mode === "PUSH") return push(tile);
      if (mode === "CLAIM_SLOT") return dispatch({ type: "CLAIM_SLOT", tileId: tile.id, tag: preferredGrain(you) });
    }
  }

  function placeSetupTile(hex: { q: number; r: number }) {
    if (yourTurn && game.stage === "setupPlace") dispatch({ type: "SETUP_PLACE_TILE", hex });
  }

  function push(tile: Tile) {
    const cap = liveDPCount(game, tile.id, HUMAN);
    const tags = tile.wildcardTag ? [tile.wildcardTag] : tile.tags;
    const ids = you.bourbons
      .filter((b) => b.state === "FRESH") // only FRESH is committable (§7b)
      .map((b) => ({ id: b.id, f: fit(b.tags, tags) }))
      .filter((b) => b.f > 0)
      .sort((a, b) => b.f - a.f)
      .slice(0, cap)
      .map((b) => b.id);
    dispatch({ type: "PUSH", tileId: tile.id, bourbonIds: ids });
  }

  return (
    <div style={{ width: 1920, height: 1080, background: C.bg, color: C.text, fontFamily: SANS, display: "flex", overflow: "hidden" }}>
      <div
        style={{
          flex: 1,
          position: "relative",
          background: "radial-gradient(125% 95% at 42% 34%, #f4ecd6 0%, #e4d6b6 52%, #d0bf99 100%)",
          boxShadow: "inset 0 0 160px 10px #8a6a3a30",
        }}
      >
        {/* paper grain (multiplies onto the light stage) */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.22, mixBlendMode: "multiply", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")" }} />
        <div style={{ position: "absolute", top: 20, left: 26, zIndex: 1 }}>
          <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, color: "#4a3a1e", textTransform: "uppercase" }}>Bourbonomics</div>
          <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, color: "#241505", lineHeight: 1 }}>
            {inSetup ? (game.stage === "setupPlace" ? "Building the Board" : "The Opening Draft") : "The Market"}
          </div>
          <div style={{ fontFamily: SANS, fontSize: 12.5, color: "#4c3c22", marginTop: 3, maxWidth: 360 }}>
            {inSetup
              ? game.stage === "setupPlace"
                ? "Lay your tiles on the open ground — each must touch 2+ tiles."
                : "Draft a bourbon or plant a distribution point."
              : "Serve demand · control tiles · harvest niches."}
          </div>
        </div>
        <HexMap game={game} mode={yourTurn && !inSetup ? mode : null} onClick={clickTile} candidates={candidates} onPlace={placeSetupTile} draftable={yourTurn && game.stage === "setupDraft"} />
        {toast && (
          <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#000c", color: C.gold, padding: "10px 18px", borderRadius: 8, fontSize: 15, fontFamily: MONO, border: `1px solid ${T.border}` }}>
            {toast}
          </div>
        )}
      </div>
      <Rail game={game} you={you} yourTurn={yourTurn} mode={mode} setMode={setMode} dispatch={dispatch} onNew={onNew} onManual={onManual} />
    </div>
  );
}

// ── Hex map ──────────────────────────────────────────────────────────
const HEX = 56;

function HexMap({ game, mode, onClick, candidates = [], onPlace, draftable = false }: { game: GameState; mode: Mode; onClick: (t: Tile) => void; candidates?: { q: number; r: number }[]; onPlace?: (h: { q: number; r: number }) => void; draftable?: boolean }) {
  const layout = useMemo(() => {
    const pts = game.tiles.map((t) => ({ t, ...axialToPixel(t.hex, HEX) }));
    const cand = candidates.map((h) => ({ h, ...axialToPixel(h, HEX) }));
    const xs = [...pts, ...cand].map((p) => p.x);
    const ys = [...pts, ...cand].map((p) => p.y);
    const minX = Math.min(...xs) - HEX * 1.6;
    const minY = Math.min(...ys) - HEX * 1.6;
    const w = Math.max(...xs) - minX + HEX * 1.6;
    const h = Math.max(...ys) - minY + HEX * 1.6;
    return { pts, cand, minX, minY, w, h };
  }, [game.tiles, candidates]);

  const idxOf = (pid: string) => game.players.findIndex((p) => p.id === pid);

  return (
    <svg viewBox={`${layout.minX} ${layout.minY} ${layout.w} ${layout.h}`} style={{ width: "100%", height: "100%" }}>
      <defs>
        <radialGradient id="tileSheen" cx="0.35" cy="0.22" r="0.9">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="plainFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#ede4d0" />
        </linearGradient>
        <linearGradient id="rewardFace" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fdf3cf" />
          <stop offset="1" stopColor="#eccb70" />
        </linearGradient>
      </defs>
      {layout.pts.map(({ t, x, y }) => (
        <TileHex key={t.id} game={game} t={t} x={x} y={y} idxOf={idxOf} clickable={(mode !== null || draftable) && t.category !== "BLOCKING"} onClick={() => onClick(t)} />
      ))}
      {/* ghost placement sockets during setup */}
      {layout.cand.map(({ h, x, y }, i) => (
        <g key={`c${i}`} onClick={() => onPlace?.(h)} style={{ cursor: "pointer" }}>
          <polygon points={hexPolygonPoints(x, y, HEX)} fill="#ffffff2e" stroke="#b8901e" strokeWidth={2.5} strokeDasharray="7 6">
            <animate attributeName="opacity" values="0.5;0.95;0.5" dur="1.8s" repeatCount="indefinite" />
          </polygon>
          <text x={x} y={y - 2} textAnchor="middle" fontFamily={SERIF} fontSize={34} fontWeight={700} fill="#7a5f22">＋</text>
          <text x={x} y={y + 24} textAnchor="middle" fontFamily={MONO} fontSize={10.5} letterSpacing={1} fill="#7a5f22">PLACE</text>
        </g>
      ))}
    </svg>
  );
}

/** Split a tile name into <=2 balanced lines (only when it's long). */
function nameLines(name: string): string[] {
  if (name.length <= 11 || !name.includes(" ")) return [name];
  const words = name.split(" ");
  let best = [name.length, [name] as string[]] as [number, string[]];
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const diff = Math.abs(a.length - b.length);
    if (diff < best[0]) best = [diff, [a, b]];
  }
  return best[1];
}

function TileHex({ game, t, x, y, idxOf, clickable, onClick }: { game: GameState; t: Tile; x: number; y: number; idxOf: (p: string) => number; clickable: boolean; onClick: () => void }) {
  const ctrl = tileController(game, t.id);
  const ctrlIdx = ctrl ? idxOf(ctrl) : -1;
  const flags = game.nicheFlags.filter((f) => f.tileId === t.id);
  const dps = game.dps.filter((d) => d.tileId === t.id);
  const isBlock = t.category === "BLOCKING";
  const isWild = t.category === "LOYALTY" || t.category === "KEYSTONE";
  const reward = t.reward;

  // §2: tile COLOR denotes its REWARD. Reward tiles = warm gold gradient; plain
  // tiles = white gradient; blocking = charred oak (dark against the light board).
  const rc = reward ? rewardColor(reward) : null;
  const face = isBlock ? "#3a352c" : rc ? "url(#rewardFace)" : "url(#plainFace)";
  const frame = ctrlIdx >= 0 ? PC[ctrlIdx]! : isBlock ? "#160d05" : rc ? "#caa23a" : "#c2ad82";
  const frameW = ctrlIdx >= 0 ? 3.5 : rc ? 3 : 1.5;
  const nm = nameLines(t.name);

  return (
    <g onClick={onClick} style={{ cursor: clickable ? "pointer" : "default" }}>
      {/* warm drop shadow */}
      <polygon points={hexPolygonPoints(x, y + 6, HEX)} fill="#5a4020" opacity={0.26} />
      <polygon points={hexPolygonPoints(x, y, HEX)} fill={face} stroke={frame} strokeWidth={frameW} />
      {!isBlock && <polygon points={hexPolygonPoints(x, y, HEX - 3.5)} fill="none" stroke="#ffffff" strokeOpacity={0.55} strokeWidth={1.4} />}
      <polygon points={hexPolygonPoints(x, y, HEX)} fill="url(#tileSheen)" pointerEvents="none" />
      {isBlock ? (
        <>
          {/* diagonal charred staves */}
          <clipPath id={`clip-${t.id}`}><polygon points={hexPolygonPoints(x, y, HEX)} /></clipPath>
          <g clipPath={`url(#clip-${t.id})`} opacity={0.5}>
            {[-40, -20, 0, 20, 40].map((o) => (
              <line key={o} x1={x - HEX + o} y1={y + HEX} x2={x + HEX + o} y2={y - HEX} stroke="#0d0906" strokeWidth={4} />
            ))}
          </g>
          <text x={x} y={y - 6} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={12} fill="#e7dcbf">{t.name}</text>
          <g transform={`translate(${x} ${y + 12})`}>
            <rect x={-32} y={-9} width={64} height={16} rx={8} fill="#00000055" />
            <text y={2.5} textAnchor="middle" fontFamily={MONO} fontSize={8} letterSpacing={0.5} fill="#c9b48e">🔒 NO BUILD</text>
          </g>
        </>
      ) : (
        <>
          <text x={x} y={y - HEX * (nm.length > 1 ? 0.66 : 0.6)} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={12.5} fill={T.ink}>
            {nm.map((ln, i) => (
              <tspan key={i} x={x} dy={i === 0 ? 0 : 12.5}>{ln}</tspan>
            ))}
          </text>
          {reward && (
            <g transform={`translate(${x} ${y - HEX * (nm.length > 1 ? 0.30 : 0.42)})`}>
              <rect x={-34} y={-8} width={68} height={15} rx={7.5} fill={rc!} />
              <text y={3} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={8} letterSpacing={0.3} fill="#fff">{rewardLabel(reward)}</text>
            </g>
          )}
          {isWild ? (
            <OwnerSlot game={game} t={t} x={x} y={y + HEX * 0.05} idxOf={idxOf} />
          ) : (
            <TagGridSVG tags={t.tags} cx={x} cy={y + HEX * (reward ? 0.15 : 0.04)} cell={13} />
          )}
          <DPRow dps={dps} x={x} y={y + HEX * 0.74} idxOf={idxOf} />
          {flags.length > 0 && (
            <g transform={`translate(${x - HEX * 0.66} ${y - HEX * 0.1})`}>
              {flags.slice(0, 4).map((f, i) => <Flag key={f.id} x={0} y={i * 8} color={PC[idxOf(f.owner)]!} h={15} />)}
            </g>
          )}
        </>
      )}
    </g>
  );
}

function OwnerSlot({ game, t, x, y, idxOf }: { game: GameState; t: Tile; x: number; y: number; idxOf: (p: string) => number }) {
  const ownerDP = t.ownerSlotDP ? game.dps.find((d) => d.id === t.ownerSlotDP) : null;
  return (
    <g>
      <text x={x} y={y - 20} textAnchor="middle" fontFamily={MONO} fontSize={8} letterSpacing={1} fill={T.ink} opacity={0.7}>WILDCARD</text>
      <circle cx={x} cy={y + 2} r={13} fill="#00000012" stroke={ownerDP ? PC[idxOf(ownerDP.owner)]! : "#00000055"} strokeWidth={2} strokeDasharray={ownerDP ? "0" : "3 3"} />
      {ownerDP ? (
        <Pawn x={x} y={y + 7} color={PC[idxOf(ownerDP.owner)]!} s={0.72} />
      ) : (
        <text x={x} y={y + 6} textAnchor="middle" fontFamily={MONO} fontSize={7} fill="#8a6a3a">OWNER</text>
      )}
      {t.defenseBonus > 0 && (
        <text x={x} y={y + 26} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={9} fill={T.red}>+{t.defenseBonus} DEF</text>
      )}
    </g>
  );
}

// A tidy row of DP pawns (live upright, dark tipped), wrapping to two rows.
function DPRow({ dps, x, y, idxOf }: { dps: GameState["dps"]; x: number; y: number; idxOf: (p: string) => number }) {
  const shown = dps.slice(0, 10);
  const per = Math.min(shown.length, 5);
  const gap = 15;
  return (
    <g>
      {shown.map((d, i) => {
        const row = Math.floor(i / 5);
        const inRow = i % 5;
        const count = row === 0 ? per : shown.length - 5;
        const rx = x - ((count - 1) * gap) / 2 + inRow * gap;
        return <Pawn key={d.id} x={rx} y={y + row * 18} color={PC[idxOf(d.owner)]!} dead={d.state !== "LIVE"} s={0.82} />;
      })}
    </g>
  );
}

// ── Rail ─────────────────────────────────────────────────────────────
function Rail({
  game,
  you,
  yourTurn,
  mode,
  setMode,
  dispatch,
  onNew,
  onManual,
}: {
  game: GameState;
  you: GameState["players"][number];
  yourTurn: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  dispatch: (a: Action) => void;
  onNew: () => void;
  onManual: () => void;
}) {
  return (
    <div style={{ width: 600, height: 1080, background: `linear-gradient(${T.rail}, ${T.feltDeep})`, borderLeft: `3px solid ${T.border}`, boxShadow: `inset 4px 0 0 ${T.gold}44`, display: "flex", flexDirection: "column", padding: 18, gap: 12, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontFamily: SERIF, fontSize: 24, fontWeight: 700, color: T.goldSoft }}>
          {game.phase === "setup" ? "Setup" : <>Age {game.age}<span style={{ color: T.faint }}>/5</span> · Round {game.round}</>}
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: T.goldSoft, background: "#c8961f22", border: `1px solid ${T.gold}66`, borderRadius: 999, padding: "3px 10px", letterSpacing: 0.5, flex: "0 0 auto" }}>
          {STAGE_LABEL[game.stage]}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={onManual} title="The Distiller's Field Guide" style={{ fontSize: 12, background: T.panel, color: T.goldSoft, border: `1px solid ${T.gold}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
          📖 Guide
        </button>
        <button onClick={onNew} style={{ fontSize: 12, background: T.panel, color: C.faint, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
          New
        </button>
      </div>

      <Standings game={game} />
      <Market game={game} you={you} yourTurn={yourTurn} dispatch={dispatch} />
      <div style={{ flex: 1 }} />
      <Controls game={game} you={you} yourTurn={yourTurn} mode={mode} setMode={setMode} dispatch={dispatch} />
      <Log game={game} />
    </div>
  );
}

function Standings({ game }: { game: GameState }) {
  const acting = game.phase !== "ended" ? currentActorOf(game).id : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {game.players.map((p, i) => {
        const tiles = game.tiles.filter((t) => tileController(game, t.id) === p.id).length;
        const tokTotal = Object.values(p.tokens).reduce((a, b) => a + b, 0);
        const fresh = p.bourbons.filter((b) => b.state === "FRESH").length;
        const isTurn = acting === p.id;
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 12, background: isTurn ? "linear-gradient(#fdf3d8,#f7eccd)" : T.panel, borderRadius: 9, padding: "8px 14px", border: `1px solid ${isTurn ? "#c8961f99" : T.line}`, boxShadow: isTurn ? `inset 3px 0 0 ${PC[i]}` : "none" }}>
            <svg width={17} height={24} viewBox="-9 -14 18 26"><Pawn x={0} y={0} color={PC[i]!} s={0.9} /></svg>
            <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 16, flex: 1, color: T.ink, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{p.name}</span>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 4 }}>
              <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 22, color: T.gold, lineHeight: 1 }}>{p.capital}</span>
              <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 1, color: T.faint }}>CAPITAL</span>
            </div>
            <Stat value={p.dpSupply} label="DP" />
            <Stat value={tiles} label="TILES" />
            <Stat value={fresh} label="CASKS" />
            <Stat value={tokTotal} label="TOKENS" />
          </div>
        );
      })}
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 42 }}>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 0.5, color: T.faint }}>{label}</span>
    </div>
  );
}

function Market({ game, you, yourTurn, dispatch }: { game: GameState; you: GameState["players"][number]; yourTurn: boolean; dispatch: (a: Action) => void }) {
  const drafting = yourTurn && game.stage === "setupDraft";
  const canBid = drafting || (yourTurn && you.allowedSuits.some((s) => SUIT_ACTIONS[s].includes("BID")));
  return (
    <div>
      <RailLabel>{drafting ? "Draft a bourbon" : "The Market"}</RailLabel>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {game.market.map((lot) => {
          const bids = Object.entries(lot.bids).filter(([, n]) => n > 0);
          const accent = lot.def.tags[0] ? tagColor(lot.def.tags[0]) : T.goldSoft;
          return (
            <button
              key={lot.id}
              disabled={!canBid}
              onClick={() => dispatch(drafting ? { type: "SETUP_DRAFT_BOURBON", lotId: lot.id } : { type: "BID", lotId: lot.id })}
              style={{ flex: "1 1 158px", textAlign: "left", background: T.panel, border: `1px solid ${canBid ? T.gold : T.line}`, borderLeft: `4px solid ${accent}`, borderRadius: 9, padding: "8px 10px", cursor: canBid ? "pointer" : "default", boxShadow: canBid ? `0 1px 4px #7a5f2a26` : "none" }}
            >
              <div style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: T.ink, letterSpacing: 0.3 }}>{lot.def.name}</div>
              <div style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
                {lot.def.tags.map((tg, i) => (
                  <span key={i} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 11, color: "#fff", background: `${tagColor(tg)}`, borderRadius: 4, padding: "1px 5px" }}>{tagGlyph(tg)}</span>
                ))}
              </div>
              <div style={{ fontSize: 10.5, color: T.faint, fontFamily: MONO, marginTop: 5 }}>
                bids: {bids.length ? bids.map(([pid, n]) => `${game.players.find((p) => p.id === pid)?.name}×${n}`).join(" ") : "—"}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 8px" }}>
      <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: T.goldSoft, letterSpacing: 0.3 }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: T.line }} />
    </div>
  );
}

// ── Controls (stage-aware) ───────────────────────────────────────────
function Controls({ game, you, yourTurn, mode, setMode, dispatch }: { game: GameState; you: GameState["players"][number]; yourTurn: boolean; mode: Mode; setMode: (m: Mode) => void; dispatch: (a: Action) => void }) {
  if (game.phase === "ended") {
    const ranked = [...game.players].sort((a, b) => b.capital - a.capital);
    return (
      <div style={{ background: C.panel, borderRadius: 10, padding: 16, textAlign: "center" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.gold }}>{ranked[0]!.name} wins!</div>
        <div style={{ fontSize: 14, color: C.muted, marginTop: 6 }}>
          {ranked.map((p) => `${p.name} ${p.capital}`).join("  ·  ")}
        </div>
      </div>
    );
  }
  if (!yourTurn) {
    return <div style={{ background: C.panel, borderRadius: 10, padding: 14, textAlign: "center", color: C.muted, fontSize: 15 }}>Rivals are acting…</div>;
  }

  return (
    <div style={{ background: C.panel, borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
      {game.stage === "setupPlace" ? (
        <SetupPlaceControls you={you} />
      ) : game.stage === "setupDraft" ? (
        <SetupDraftControls game={game} you={you} />
      ) : game.stage === "trade" ? (
        <TradeControls you={you} dispatch={dispatch} />
      ) : game.stage === "catchup" ? (
        <CatchupControls game={game} you={you} dispatch={dispatch} />
      ) : game.stage === "commit" ? (
        <CommitControls you={you} dispatch={dispatch} />
      ) : (
        <ActControls game={game} you={you} mode={mode} setMode={setMode} dispatch={dispatch} />
      )}
    </div>
  );
}

function SetupPlaceControls({ you }: { you: GameState["players"][number] }) {
  return (
    <HandTray
      label="Your setup tiles"
      meta={`${you.setupTiles.length} to place`}
      footer="Click a glowing hex to place the lifted tile — it must touch 2+ tiles. In play, this tray becomes your action cards."
    >
      {you.setupTiles.map((t, i) => (
        <SetupTileCard key={t.defId + i} tile={t} isNext={i === 0} />
      ))}
      {you.setupTiles.length === 0 && <span style={{ fontSize: 13, color: T.faint, alignSelf: "center" }}>All tiles placed — on to the draft.</span>}
    </HandTray>
  );
}

function SetupDraftControls({ game, you }: { game: GameState; you: GameState["players"][number] }) {
  // count this player's remaining picks in the snake sequence
  const idx = game.players.indexOf(you);
  const remaining = game.setupDraftSeq.slice(game.turnPos).filter((i) => i === idx).length;
  return (
    <div>
      <RailLabel>Setup · Opening draft</RailLabel>
      <p style={{ fontSize: 14, color: C.muted, margin: "0 0 6px" }}>
        Each pick: <B>draft a bourbon</B> (click a market card) <B>or place a DP</B> (click a tile — anywhere, this is
        setup). <B>{remaining}</B> pick{remaining === 1 ? "" : "s"} left.
      </p>
      <YourBourbons you={you} />
    </div>
  );
}

function TradeControls({ you, dispatch }: { you: GameState["players"][number]; dispatch: (a: Action) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s));
  return (
    <div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 8 }}>
        The Trade — offer up to 2 cards into a shared shuffle, draw back the same number. (Age {""}
        start)
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {you.hand.map((c) => (
          <HandCard key={c.id} card={c} selected={sel.includes(c.id)} onClick={() => toggle(c.id)} width={116} />
        ))}
      </div>
      <button onClick={() => dispatch({ type: "TRADE_OFFER", cardIds: sel })} style={btn(C.gold)}>
        {sel.length ? `Offer ${sel.length}` : "Offer nothing"}
      </button>
    </div>
  );
}

function CatchupControls({ game, you, dispatch }: { game: GameState; you: GameState["players"][number]; dispatch: (a: Action) => void }) {
  const [board, setBoard] = useState<string | null>(null);
  return (
    <div>
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 8 }}>
        Catch-up — swap one hand card for one board card, or pass. (Least-Capital player goes first.)
      </div>
      <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Shared board — pick one</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {game.catchUpBoard.map((c) => (
          <HandCard key={c.id} card={c} selected={board === c.id} onClick={() => setBoard(board === c.id ? null : c.id)} width={116} />
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {board ? "…and click a hand card to give away" : "Your hand"}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {you.hand.map((c) => (
          <HandCard key={c.id} card={c} disabled={!board} onClick={() => board && dispatch({ type: "CATCHUP_SWAP", handCardId: c.id, boardCardId: board })} width={116} />
        ))}
      </div>
      <button onClick={() => dispatch({ type: "CATCHUP_SWAP", handCardId: "", boardCardId: null })} style={btn(C.gold)}>
        Pass
      </button>
    </div>
  );
}

function CommitControls({ you, dispatch }: { you: GameState["players"][number]; dispatch: (a: Action) => void }) {
  // Select face-up cards: the first is your primary, the rest are chained. Each
  // chained card is paid by one face-down sacrifice, auto-chosen (lowest pips)
  // from the cards you did NOT select face-up (brief §4).
  const [faceUp, setFaceUp] = useState<string[]>([]);
  const toggle = (id: string) => setFaceUp((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const chained = Math.max(0, faceUp.length - 1);
  const rest = you.hand.filter((c) => !faceUp.includes(c.id)).sort((a, b) => a.pips - b.pips);
  const sacrifices = rest.slice(0, chained).map((c) => c.id);
  const canPlay = faceUp.length >= 1 && rest.length >= chained;
  const totalPips = you.hand.filter((c) => faceUp.includes(c.id)).reduce((n, c) => n + c.pips, 0);

  return (
    <div>
      <HandTray
        label="Your action cards"
        meta={faceUp.length ? `${faceUp.length} up${chained ? ` · ${chained} sacrificed` : ""}` : "pick a card"}
        footer="1st card = primary; extra cards chain (each costs one face-down sacrifice)."
      >
        {you.hand.map((c) => {
          const idx = faceUp.indexOf(c.id);
          return <HandCard key={c.id} card={c} selected={idx >= 0} badge={idx >= 0 ? idx + 1 : undefined} onClick={() => toggle(c.id)} />;
        })}
      </HandTray>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
        <button
          disabled={!canPlay}
          onClick={() => dispatch({ type: "COMMIT_PLAY", faceUpIds: faceUp, sacrificeIds: sacrifices, surrender: false })}
          style={{ ...btn(T.green), opacity: canPlay ? 1 : 0.4 }}
        >
          Play {faceUp.length > 1 ? `${faceUp.length} (chain, ${totalPips}p)` : `(${totalPips}p)`}
        </button>
        <button
          disabled={faceUp.length !== 1}
          onClick={() => dispatch({ type: "COMMIT_PLAY", faceUpIds: [], sacrificeIds: [faceUp[0]!], surrender: true })}
          style={{ ...btn(C.faint), opacity: faceUp.length === 1 ? 1 : 0.4 }}
        >
          Surrender (1 any-action)
        </button>
      </div>
    </div>
  );
}

function ActControls({ game, you, mode, setMode, dispatch }: { game: GameState; you: GameState["players"][number]; mode: Mode; setMode: (m: Mode) => void; dispatch: (a: Action) => void }) {
  const allowed = new Set<ActionType>();
  for (const s of you.allowedSuits) for (const a of SUIT_ACTIONS[s]) allowed.add(a);
  const tileModes: { t: Mode; label: string; need: ActionType }[] = [
    { t: "BUILD_DP", label: "Build DP", need: "BUILD_DP" },
    { t: "PUSH", label: "Push", need: "PUSH" },
    { t: "ADD_NICHE_FLAG", label: "Flag", need: "ADD_NICHE_FLAG" },
    { t: "REMOVE_NICHE_FLAG", label: "Unflag", need: "REMOVE_NICHE_FLAG" },
    { t: "CLAIM_SLOT", label: "Claim slot", need: "BUILD_DP" },
  ];
  const tokens = Object.entries(you.tokens).filter(([, n]) => n > 0) as [TokenType, number][];
  const depleted = you.bourbons.find((b) => b.state === "DEPLETED");
  const played = you.committedFaceUp.map((c) => c.name).join(" + ") || (you.surrendered ? "surrender" : "");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 14, color: C.muted }}>
          {game.stage === "planning" ? "Planning — spend tokens, then commit" : `${you.pipsRemaining} pips left`}
          {played ? ` · ${played}` : ""}
        </span>
      </div>

      {game.stage === "planning" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {tokens.length === 0 && <span style={{ fontSize: 13, color: C.faint }}>No tokens to spend.</span>}
          {tokens.map(([t, n]) => (
            <button key={t} onClick={() => dispatch({ type: "SPEND_TOKEN", token: t })} style={btn(C.gold)}>
              Spend ⊙{t} ({n})
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {tileModes.map(({ t, label, need }) => {
          const on = allowed.has(need);
          return (
            <button
              key={label}
              disabled={!on}
              onClick={() => setMode(mode === t ? null : t)}
              style={{ ...btn(mode === t ? C.green : C.border), opacity: on ? 1 : 0.35 }}
            >
              {label}
            </button>
          );
        })}
        {allowed.has("REFRESH") && depleted && (
          <button onClick={() => dispatch({ type: "REFRESH", bourbonId: depleted.id })} style={btn(C.gold)}>
            Refresh {depleted.name}
          </button>
        )}
      </div>

      {mode && (
        <div style={{ fontSize: 12, color: C.green, fontFamily: MONO }}>
          ▸ click a tile to {mode.replace(/_/g, " ").toLowerCase()}
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button onClick={() => dispatch({ type: "END_TURN" })} style={btn(C.gold)}>
          {game.stage === "planning" ? "Done planning" : "End turn"}
        </button>
        {you.heldTile && <span style={{ fontSize: 12, color: C.muted, alignSelf: "center" }}>holding: {you.heldTile.name}</span>}
      </div>

      <YourBourbons you={you} />
    </div>
  );
}

function YourBourbons({ you }: { you: GameState["players"][number] }) {
  const fresh = you.bourbons.filter((b) => b.state === "FRESH").length;
  return (
    <div>
      <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        Your bourbons — {fresh} FRESH / {you.bourbons.length}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {you.bourbons.map((b) => <BourbonChip key={b.id} b={b} />)}
        {you.bourbons.length === 0 && <span style={{ fontSize: 12, color: C.faint }}>none — bid at market</span>}
      </div>
    </div>
  );
}

/** Auto-pick a wildcard tag when claiming a slot: the player's most-owned grain. */
function preferredGrain(you: GameState["players"][number]) {
  const counts: Record<string, number> = {};
  for (const b of you.bourbons)
    for (const t of b.tags) if (t.kind === "GRAIN") counts[t.value] = (counts[t.value] ?? 0) + 1;
  const best = (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "RYE") as "RYE" | "WHEAT" | "TRADITIONAL";
  return { kind: "GRAIN", value: best } as const;
}

function Log({ game }: { game: GameState }) {
  const tail = game.log.slice(-5);
  return (
    <div style={{ background: "#f3ecd9", borderRadius: 8, padding: 10, height: 96, overflow: "hidden", border: `1px solid ${T.line}` }}>
      {tail.map((l, i) => (
        <div key={i} style={{ fontSize: 11.5, fontFamily: MONO, color: i === tail.length - 1 ? T.ink : T.faint, lineHeight: 1.5 }}>
          <span style={{ color: T.faint }}>a{l.age}r{l.round} </span>
          {l.message}
        </div>
      ))}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, padding: "6px 11px", background: "transparent", color, border: `1px solid ${color}`, borderRadius: 7, cursor: "pointer" };
}

function B({ children }: { children: React.ReactNode }) {
  return <strong style={{ color: C.text, fontWeight: 700 }}>{children}</strong>;
}

// A letterpress action card (matches the printed Action Cards): cream face,
// suit-colored header strip, serif name, pip squares, barrel initiative icon.
function HandCard({ card, selected, badge, disabled, onClick, width = 122 }: { card: GameState["players"][number]["hand"][number]; selected?: boolean; badge?: number; disabled?: boolean; onClick: () => void; width?: number }) {
  const sc = SUIT_COLOR[card.suit];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width,
        textAlign: "left",
        background: "#f3ead2",
        border: `2px solid ${selected ? T.gold : sc}`,
        borderRadius: 8,
        padding: 0,
        overflow: "hidden",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: selected ? `0 0 0 2px ${T.gold}, 0 3px 8px #0007` : "0 2px 5px #0005",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: sc, padding: "2px 7px" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#fff" }}>{SUIT_SHORT[card.suit]}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {card.icon && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }} title="Initiative — play last to lead next round">
              <BarrelIcon color="#fff" />
              <span style={{ fontFamily: MONO, fontSize: 7, fontWeight: 700, letterSpacing: 0.5, color: "#fff" }}>LEAD</span>
            </span>
          )}
          {badge != null && <span style={{ fontFamily: SERIF, fontSize: 11, fontWeight: 700, color: "#fff" }}>{badge}</span>}
        </span>
      </div>
      <div style={{ padding: "5px 8px 7px" }}>
        <div style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 700, color: T.ink, lineHeight: 1.05 }}>{card.name}</div>
        <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
          {Array.from({ length: card.pips }).map((_, i) => (
            <span key={i} style={{ width: 9, height: 9, borderRadius: 2, background: sc, boxShadow: "inset 0 0 0 1.5px #ffffff88" }} />
          ))}
        </div>
      </div>
    </button>
  );
}

function BarrelIcon({ color }: { color: string }) {
  return (
    <svg width={11} height={13} viewBox="0 0 11 13" aria-hidden>
      <rect x="1" y="1" width="9" height="11" rx="3" fill="none" stroke={color} strokeWidth="1.3" />
      <line x1="1" y1="4.3" x2="10" y2="4.3" stroke={color} strokeWidth="1" />
      <line x1="1" y1="8.7" x2="10" y2="8.7" stroke={color} strokeWidth="1" />
    </svg>
  );
}

// The persistent bottom-of-rail HAND TRAY. Its contents swap by phase — action
// cards in play, setup tiles during placement — but the slot, header, padding
// and card footprint stay identical, so it reads as one place at two times.
function HandTray({ label, meta, footer, children }: { label: string; meta?: React.ReactNode; footer?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: T.goldSoft, letterSpacing: 0.3 }}>{label}</span>
        {meta != null && <span style={{ fontFamily: MONO, fontSize: 11, color: T.muted }}>{meta}</span>}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end", minHeight: 132, paddingTop: 8 }}>{children}</div>
      {footer && <div style={{ fontFamily: SANS, fontSize: 11, color: T.faint, marginTop: 6, lineHeight: 1.4 }}>{footer}</div>}
    </div>
  );
}

// A setup tile rendered as a card, mirroring HandCard: grain-tinted header strip
// ("DEMAND"), reward coin, serif name (up to 2 lines), and the shared 2-2-1
// TagGrid. The next tile to place lifts with a gold ring + NEXT badge.
function SetupTileCard({ tile, isNext, width = 122 }: { tile: GameState["players"][number]["setupTiles"][number]; isNext: boolean; width?: number }) {
  const grain = tile.tags.find((t) => t.kind === "GRAIN");
  const accent = grain ? tagColor(grain) : tile.reward ? rewardColor(tile.reward) : T.goldSoft;
  const nm = nameLines(tile.name);
  return (
    <div
      style={{
        position: "relative",
        width,
        background: "linear-gradient(#fffdf7, #f3ecd9)",
        border: `2px solid ${isNext ? T.gold : accent}`,
        borderRadius: 8,
        overflow: "hidden",
        transform: isNext ? "translateY(-8px)" : "none",
        transition: "transform 120ms",
        boxShadow: isNext ? `0 0 0 2px ${T.gold}, 0 7px 14px #6b512e40` : "0 2px 6px #6b512e40",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: accent, padding: "2px 7px" }}>
        <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#fff" }}>
          {tile.category === "LOYALTY" || tile.category === "KEYSTONE" ? "WILD" : "DEMAND"}
        </span>
        {tile.reward && (
          <span style={{ width: 15, height: 15, borderRadius: 999, background: rewardColor(tile.reward), border: "1px solid #ffffff88", display: "grid", placeItems: "center", fontFamily: SERIF, fontWeight: 700, fontSize: 9, color: "#fff" }}>
            {tile.reward.kind === "CAPITAL" ? tile.reward.amount : "⊙"}
          </span>
        )}
      </div>
      <div style={{ padding: "5px 7px 7px" }}>
        <div style={{ fontFamily: SERIF, fontSize: 13, fontWeight: 700, color: T.ink, lineHeight: 1.05, minHeight: 30 }}>
          {nm.map((ln, i) => (
            <div key={i}>{ln}</div>
          ))}
        </div>
        <div style={{ display: "grid", placeItems: "center", marginTop: 4 }}>
          <TagGridHTML tags={tile.tags} cell={16} />
        </div>
      </div>
      {isNext && (
        <span style={{ position: "absolute", top: -9, left: "50%", transform: "translateX(-50%)", fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#fff", background: T.gold, borderRadius: 999, padding: "1px 8px", boxShadow: "0 2px 4px #0004" }}>
          NEXT
        </span>
      )}
    </div>
  );
}

// A bourbon as a mini collector card (§3): grain-gradient art, charred-oak
// scrim, cream serif name, and the SHARED TagGrid so it reads slot-for-slot
// against tiles.
function BourbonChip({ b }: { b: GameState["players"][number]["bourbons"][number] }) {
  const dep = b.state === "DEPLETED";
  const tint = grainTint(b.tags);
  return (
    <div
      title={`${b.name} — ${b.state}`}
      style={{
        width: 96,
        borderRadius: 8,
        overflow: "hidden",
        border: `1px solid ${dep ? "#00000066" : T.goldSoft}`,
        opacity: dep ? 0.5 : 1,
        filter: dep ? "grayscale(0.55)" : "none",
        boxShadow: dep ? "none" : "0 2px 6px #6b512e40",
        background: "#1c110a",
      }}
    >
      {/* art + scrim + name (this card stays dark — a collector bottle) */}
      <div style={{ position: "relative", height: 44, background: `linear-gradient(160deg, ${tint.a}, ${tint.b})` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(22,13,5,0.96), rgba(22,13,5,0) 70%)" }} />
        <div style={{ position: "absolute", left: 6, right: 6, bottom: 4, fontFamily: SERIF, fontWeight: 700, fontSize: 11.5, color: "#f0e4cc", lineHeight: 1.02 }}>{b.name}</div>
        {dep && <div style={{ position: "absolute", top: 3, right: 5, fontFamily: MONO, fontSize: 7, letterSpacing: 0.5, color: "#e0b0a0" }}>DEPLETED</div>}
      </div>
      {/* foil spec grid — the shared TagGrid */}
      <div style={{ background: "#1c110a", padding: "5px 0 4px", display: "grid", placeItems: "center" }}>
        <TagGridHTML tags={b.tags} cell={13} />
      </div>
    </div>
  );
}
