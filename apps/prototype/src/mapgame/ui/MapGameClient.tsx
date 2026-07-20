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
  tagColor,
  tagLabel,
  tileController,
} from "../engine";
import type { Action, ActionType, GameState, Suit, Tile, TokenType } from "../engine";
import { SUIT_ACTIONS } from "../engine";

const C = {
  bg: "#0e1420",
  panel: "#182234",
  panel2: "#111a29",
  border: "#2a3a53",
  text: "#e2e9f4",
  muted: "#8ca0bd",
  faint: "#5f728c",
  gold: "#e0a94a",
  green: "#46b46e",
  red: "#e0553a",
};
const PC = ["#e0a94a", "#e0553a", "#46b46e", "#48a6d6", "#9a6fe0"];
const SANS = "'Inter', system-ui, sans-serif";
const MONO = "'JetBrains Mono', ui-monospace, monospace";
const HUMAN = "p0";

const CAT_FILL: Record<string, string> = {
  PURE_PREFERENCE: "#1b2740",
  OFF_PREMISE: "#1a2c3a",
  ON_PREMISE: "#22283f",
  EXPERIENTIAL: "#2a2340",
  EXPORT: "#1f3330",
  LOYALTY: "#3a2438",
  KEYSTONE: "#40331f",
  BLOCKING: "#0c0f16",
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
    <div style={{ width: 1920, height: 1080, background: C.bg, color: C.text, fontFamily: SANS, display: "grid", placeItems: "center" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 68, fontWeight: 800, letterSpacing: -1, color: C.gold }}>Bourbonomics</div>
        <div style={{ fontSize: 30, color: C.muted, marginBottom: 8 }}>Map Game</div>
        <div style={{ fontSize: 18, color: C.faint, marginBottom: 44 }}>Area control over a shared market of demand. Most Capital after 5 ages wins.</div>
        <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onStart(n)}
              style={{ fontSize: 26, fontWeight: 700, padding: "22px 46px", background: C.panel, color: C.text, border: `1px solid ${C.border}`, borderRadius: 14, cursor: "pointer" }}
            >
              {n} Players
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

  const actor = game.phase === "playing" ? currentActorOf(game) : null;
  const yourTurn = actor?.id === HUMAN && game.phase === "playing";
  const you = game.players.find((p) => p.id === HUMAN)!;

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
    if (game.stage === "resolve" || game.stage === "planning") {
      if (mode === "BUILD_DP") return dispatch({ type: "BUILD_DP", tileId: tile.id });
      if (mode === "ADD_NICHE_FLAG") return dispatch({ type: "ADD_NICHE_FLAG", tileId: tile.id });
      if (mode === "REMOVE_NICHE_FLAG") return dispatch({ type: "REMOVE_NICHE_FLAG", tileId: tile.id });
      if (mode === "PUSH") return push(tile);
      if (mode === "CLAIM_SLOT") return dispatch({ type: "CLAIM_SLOT", tileId: tile.id, tag: preferredGrain(you) });
    }
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
      <div style={{ flex: 1, position: "relative" }}>
        <HexMap game={game} mode={yourTurn ? mode : null} onClick={clickTile} />
        {toast && (
          <div style={{ position: "absolute", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#000a", color: C.red, padding: "10px 18px", borderRadius: 8, fontSize: 16, fontFamily: MONO }}>
            {toast}
          </div>
        )}
      </div>
      <Rail game={game} you={you} yourTurn={yourTurn} mode={mode} setMode={setMode} dispatch={dispatch} onNew={onNew} onManual={onManual} />
    </div>
  );
}

// ── Hex map ──────────────────────────────────────────────────────────
const HEX = 52;

function HexMap({ game, mode, onClick }: { game: GameState; mode: Mode; onClick: (t: Tile) => void }) {
  const layout = useMemo(() => {
    const pts = game.tiles.map((t) => ({ t, ...axialToPixel(t.hex, HEX) }));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs) - HEX * 2;
    const minY = Math.min(...ys) - HEX * 2;
    const w = Math.max(...xs) - minX + HEX * 2;
    const h = Math.max(...ys) - minY + HEX * 2;
    return { pts, minX, minY, w, h };
  }, [game.tiles]);

  const idxOf = (pid: string) => game.players.findIndex((p) => p.id === pid);

  return (
    <svg viewBox={`${layout.minX} ${layout.minY} ${layout.w} ${layout.h}`} style={{ width: "100%", height: "100%" }}>
      {layout.pts.map(({ t, x, y }) => {
        const ctrl = tileController(game, t.id);
        const ctrlIdx = ctrl ? idxOf(ctrl) : -1;
        const yourFlags = game.nicheFlags.filter((f) => f.tileId === t.id);
        const dps = game.dps.filter((d) => d.tileId === t.id);
        const clickable = mode !== null && t.category !== "BLOCKING";
        return (
          <g key={t.id} onClick={() => onClick(t)} style={{ cursor: clickable ? "pointer" : "default" }}>
            <polygon
              points={hexPolygonPoints(x, y, HEX)}
              fill={CAT_FILL[t.category] ?? C.panel}
              stroke={ctrlIdx >= 0 ? PC[ctrlIdx] : C.border}
              strokeWidth={ctrlIdx >= 0 ? 3 : 1.2}
            />
            {t.category !== "BLOCKING" && (
              <>
                <text x={x} y={y - HEX * 0.55} textAnchor="middle" fontSize={9.5} fill={C.muted} fontFamily={SANS}>
                  {t.name.length > 16 ? t.name.slice(0, 15) + "…" : t.name}
                </text>
                <TileTags tile={t} x={x} y={y} />
                {t.reward && (
                  <text x={x} y={y + HEX * 0.72} textAnchor="middle" fontSize={10} fill={C.gold} fontFamily={MONO}>
                    {t.reward.kind === "CAPITAL" ? `+${t.reward.amount}C` : `⊙${t.reward.token.slice(0, 3)}`}
                  </text>
                )}
                <DPCluster dps={dps} x={x} y={y} idxOf={idxOf} />
                {yourFlags.length > 0 && (
                  <text x={x + HEX * 0.6} y={y - HEX * 0.5} fontSize={13}>
                    {yourFlags.map((f) => (
                      <tspan key={f.id} fill={PC[idxOf(f.owner)]}>⚑</tspan>
                    ))}
                  </text>
                )}
                {(t.category === "LOYALTY" || t.category === "KEYSTONE") && (
                  <text x={x} y={y + HEX * 0.95} textAnchor="middle" fontSize={8} fill={C.faint}>
                    {t.category === "KEYSTONE" ? "★ CAPITAL" : "♥ LOYAL"} {t.defenseBonus ? `+${t.defenseBonus}` : ""}
                  </text>
                )}
              </>
            )}
            {t.category === "BLOCKING" && (
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize={9} fill={C.faint}>
                {t.name}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function TileTags({ tile, x, y }: { tile: Tile; x: number; y: number }) {
  if (tile.wildcardTag) {
    return (
      <text x={x} y={y + 3} textAnchor="middle" fontSize={11} fontFamily={MONO} fill={tagColor(tile.wildcardTag)}>
        {tagLabel(tile.wildcardTag)}
      </text>
    );
  }
  const labels = tile.tags.map(tagLabel);
  return (
    <text x={x} y={y + 3} textAnchor="middle" fontSize={9} fontFamily={MONO}>
      {tile.tags.map((tg, i) => (
        <tspan key={i} x={x} dy={i === 0 ? 0 : 10} fill={tagColor(tg)}>
          {labels[i]}
        </tspan>
      ))}
    </text>
  );
}

function DPCluster({ dps, x, y, idxOf }: { dps: GameState["dps"]; x: number; y: number; idxOf: (p: string) => number }) {
  return (
    <g>
      {dps.slice(0, 8).map((d, i) => (
        <circle
          key={d.id}
          cx={x - HEX * 0.5 + (i % 4) * 10}
          cy={y + HEX * 0.4 + Math.floor(i / 4) * 10}
          r={3.6}
          fill={d.state === "LIVE" ? PC[idxOf(d.owner)] : "none"}
          stroke={PC[idxOf(d.owner)]}
          strokeWidth={1.4}
          opacity={d.state === "LIVE" ? 1 : 0.6}
        />
      ))}
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
    <div style={{ width: 600, height: 1080, background: C.panel2, borderLeft: `1px solid ${C.border}`, display: "flex", flexDirection: "column", padding: 18, gap: 12, boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: C.gold }}>
          Age {game.age}/5 · Round {game.round}
        </div>
        <div style={{ fontSize: 13, color: C.muted, fontFamily: MONO, textTransform: "uppercase", flex: 1 }}>{game.stage}</div>
        <button onClick={onManual} title="The Distiller's Field Guide" style={{ fontSize: 12, background: "none", color: C.gold, border: `1px solid ${C.gold}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
          📖 Guide
        </button>
        <button onClick={onNew} style={{ fontSize: 12, background: "none", color: C.faint, border: `1px solid ${C.border}`, borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
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
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {game.players.map((p, i) => {
        const tiles = game.tiles.filter((t) => tileController(game, t.id) === p.id).length;
        const tokTotal = Object.values(p.tokens).reduce((a, b) => a + b, 0);
        const isTurn = game.phase === "playing" && currentActorOf(game).id === p.id;
        return (
          <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: isTurn ? "#1f2c44" : C.panel, borderRadius: 8, padding: "7px 12px", border: `1px solid ${isTurn ? PC[i] : "transparent"}` }}>
            <span style={{ width: 12, height: 12, borderRadius: 3, background: PC[i] }} />
            <span style={{ fontWeight: 700, width: 90 }}>{p.name}</span>
            <span style={{ fontFamily: MONO, fontSize: 14, color: C.gold, width: 62 }}>{p.capital} Cap</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, width: 52 }}>{tiles} tile</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted, width: 44 }}>◈{p.dpSupply}</span>
            <span style={{ fontFamily: MONO, fontSize: 12, color: C.muted }}>⊙{tokTotal}</span>
          </div>
        );
      })}
    </div>
  );
}

function Market({ game, you, yourTurn, dispatch }: { game: GameState; you: GameState["players"][number]; yourTurn: boolean; dispatch: (a: Action) => void }) {
  const canBid = yourTurn && you.allowedSuits.some((s) => SUIT_ACTIONS[s].includes("BID"));
  return (
    <div>
      <div style={{ fontSize: 13, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1 }}>Market</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {game.market.map((lot) => {
          const bids = Object.entries(lot.bids).filter(([, n]) => n > 0);
          return (
            <button
              key={lot.id}
              disabled={!canBid}
              onClick={() => dispatch({ type: "BID", lotId: lot.id })}
              style={{ flex: "1 1 160px", textAlign: "left", background: C.panel, border: `1px solid ${canBid ? C.gold : C.border}`, borderRadius: 8, padding: 8, cursor: canBid ? "pointer" : "default" }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{lot.def.name}</div>
              <div style={{ fontSize: 10, fontFamily: MONO }}>
                {lot.def.tags.map((tg, i) => (
                  <span key={i} style={{ color: tagColor(tg), marginRight: 5 }}>{tagLabel(tg)}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.faint, fontFamily: MONO, marginTop: 3 }}>
                bids: {bids.length ? bids.map(([pid, n]) => `${game.players.find((p) => p.id === pid)?.name}×${n}`).join(" ") : "—"}
              </div>
            </button>
          );
        })}
      </div>
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
      {game.stage === "trade" ? (
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
        {you.hand.map((c) => {
          const on = sel.includes(c.id);
          return (
            <button key={c.id} onClick={() => toggle(c.id)} style={{ ...cardBox(on ? C.gold : C.border), width: 118 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</div>
              <div style={{ fontSize: 10, color: C.faint, fontFamily: MONO }}>{c.suit}</div>
              <div style={{ fontSize: 10, fontFamily: MONO, color: C.muted }}>{c.pips}p{c.icon ? " ◆" : ""}</div>
            </button>
          );
        })}
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
          <button key={c.id} onClick={() => setBoard(board === c.id ? null : c.id)} style={{ ...cardBox(board === c.id ? C.green : C.border), width: 118 }}>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: 10, color: C.faint, fontFamily: MONO }}>{c.suit} · {c.pips}p{c.icon ? " ◆" : ""}</div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 11, color: C.faint, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
        {board ? "…and click a hand card to give away" : "Your hand"}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        {you.hand.map((c) => (
          <button
            key={c.id}
            disabled={!board}
            onClick={() => board && dispatch({ type: "CATCHUP_SWAP", handCardId: c.id, boardCardId: board })}
            style={{ ...cardBox(C.border), width: 118, opacity: board ? 1 : 0.5 }}
          >
            <div style={{ fontSize: 12, fontWeight: 700 }}>{c.name}</div>
            <div style={{ fontSize: 10, color: C.faint, fontFamily: MONO }}>{c.suit} · {c.pips}p{c.icon ? " ◆" : ""}</div>
          </button>
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
      <div style={{ fontSize: 14, color: C.muted, marginBottom: 6 }}>
        Commit — pick face-up cards (1st = primary, extras chain, each costs a face-down sacrifice).
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>
        {you.hand.map((c) => {
          const idx = faceUp.indexOf(c.id);
          const on = idx >= 0;
          return (
            <button key={c.id} onClick={() => toggle(c.id)} style={{ ...cardBox(on ? C.green : C.border), width: 122 }}>
              <div style={{ fontSize: 12, fontWeight: 700 }}>
                {on ? `${idx + 1}· ` : ""}{c.name}
              </div>
              <div style={{ fontSize: 10, color: C.faint, fontFamily: MONO }}>{c.suit}</div>
              <div style={{ fontSize: 10, fontFamily: MONO, color: C.muted }}>{c.pips}p{c.icon ? " ◆" : ""}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button
          disabled={!canPlay}
          onClick={() => dispatch({ type: "COMMIT_PLAY", faceUpIds: faceUp, sacrificeIds: sacrifices, surrender: false })}
          style={{ ...btn(C.green), opacity: canPlay ? 1 : 0.4 }}
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
        {chained > 0 && <span style={{ fontSize: 11, color: C.faint, fontFamily: MONO }}>sacrificing {chained}</span>}
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
        {you.bourbons.map((b) => {
          const dep = b.state === "DEPLETED";
          return (
            <div
              key={b.id}
              title={b.tags.map(tagLabel).join(", ")}
              style={{ background: C.panel2, border: `1px solid ${dep ? "#3a2a2a" : C.green}`, borderRadius: 6, padding: "4px 7px", fontSize: 11, opacity: dep ? 0.5 : 1 }}
            >
              {b.name}
              <span style={{ color: C.faint, fontFamily: MONO }}> {b.tags.map((t) => tagLabel(t)[0]).join("")}</span>
            </div>
          );
        })}
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
    <div style={{ background: C.panel2, borderRadius: 8, padding: 10, height: 96, overflow: "hidden", border: `1px solid ${C.border}` }}>
      {tail.map((l, i) => (
        <div key={i} style={{ fontSize: 11.5, fontFamily: MONO, color: i === tail.length - 1 ? C.text : C.faint, lineHeight: 1.5 }}>
          <span style={{ color: C.faint }}>a{l.age}r{l.round} </span>
          {l.message}
        </div>
      ))}
    </div>
  );
}

function btn(color: string): React.CSSProperties {
  return { fontSize: 12, fontWeight: 700, padding: "6px 11px", background: "transparent", color, border: `1px solid ${color}`, borderRadius: 7, cursor: "pointer" };
}

function cardBox(borderColor: string): React.CSSProperties {
  return { background: C.panel2, border: `1px solid ${borderColor}`, borderRadius: 8, padding: 8, textAlign: "left", cursor: "pointer", color: C.text };
}
