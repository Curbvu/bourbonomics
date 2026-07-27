"use client";

// Bourbonomics: Map Game — playable client, rebuilt on the new engine.
//
// A fixed 1920×1080 canvas (via ScalingHost): a hex map of demand-space on the
// left, a rail on the right (standings · market · your hand + action controls ·
// log tail). You are player 0; rivals are bots that auto-advance. No scrollbars;
// the log shows only its tail. Rules: docs/MAP_GAME_SPEC.md + the build brief.

import { useEffect, useMemo, useRef, useState } from "react";
import ScalingHost from "../../app/components/ScalingHost";
import Manual from "./Manual";
import {
  applyAction,
  autoAdvance,
  axialToPixel,
  canPlaceDP,
  CONFIG,
  createGame,
  currentActorOf,
  derivedNiches,
  fit,
  hexPolygonPoints,
  liveDPCount,
  nicheControlledCount,
  nicheStatus,
  placementCandidates,
  stepAuto,
  tagColor,
  tileController,
  tileOwner,
} from "../engine";
import type { Action, ActionType, GameState, Suit, Tag, Tile, TokenType } from "../engine";
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

// light-parchment palette (mapped from the shared theme tokens)
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
  setupDP: "Place DPs",
  cull: "New hand",
  planning: "Planning",
  commit: "Commit",
  resolve: "Resolve",
  ageEnd: "Scoring",
};

// How long each kind of bot setup action lingers before the next, so the board
// visibly grows one placement at a time (tile placement is the headline moment —
// paced slow enough to watch each rival lay their tile).
const SETUP_STEP_MS: Record<string, number> = { setupPlace: 980, setupDP: 560, setupDraft: 260 };

export default function MapGameClient() {
  const [game, setGame] = useState<GameState | null>(null);
  const [manual, setManual] = useState(false);
  const botTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopBots = () => {
    if (botTimer.current) clearTimeout(botTimer.current);
    botTimer.current = null;
  };
  useEffect(() => stopBots, []);

  // During SETUP, step bots ONE action at a time on a timer so the human watches
  // the board grow tile by tile. Once setup ends, resolve play-phase bots at once.
  const stepSetupBots = (s: GameState) => {
    stopBots();
    if (s.phase !== "setup" || !currentActorOf(s).isBot) return;
    const delay = SETUP_STEP_MS[s.stage] ?? 300;
    botTimer.current = setTimeout(() => {
      let next = stepAuto(s);
      if (next.phase !== "setup") next = autoAdvance(next);
      setGame(next);
      stepSetupBots(next);
    }, delay);
  };

  // Local play: apply the action, show it, then advance the bots. Returns an error
  // reason (Board flashes it) or null on success.
  const onAction = (action: Action): string | null => {
    if (!game) return "no game";
    const res = applyAction(game, action);
    if (!res.ok) return res.reason;
    if (res.state.phase === "setup") {
      setGame(res.state); // show your move immediately…
      stepSetupBots(res.state); // …then let the bots place, one at a time
    } else {
      setGame(autoAdvance(res.state)); // in play, resolve bots instantly
    }
    return null;
  };

  const startGame = (n: number) => {
    // A fresh random seed each game → tiles, market, and hands all shuffle
    // differently (the seed is client input; the engine stays deterministic).
    const g = createGame({ playerNames: names(n), seed: Math.floor(Math.random() * 1_000_000_000) });
    setGame(g);
    stepSetupBots(g); // animate any leading bot placements (human is p0, usually none)
  };

  // ScalingHost only shrinks when its parent bounds the height — mirror the
  // full-viewport flex column the live GameClient gives it (see CLAUDE.md §1).
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: C.bg }}>
      <ScalingHost>
        {game ? (
          <Board game={game} onAction={onAction} onNew={() => { stopBots(); setGame(null); }} onManual={() => setManual(true)} />
        ) : (
          <Setup onStart={startGame} onManual={() => setManual(true)} />
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
    <div style={{ width: 1920, height: 1080, background: "radial-gradient(125% 95% at 42% 34%, #f8f6ef 0%, #ece7db 52%, #dbd6c8 100%)", boxShadow: "inset 0 0 160px 12px #8a806a26", color: C.text, fontFamily: SANS, display: "grid", placeItems: "center" }}>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.22, mixBlendMode: "multiply", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")" }} />
      <div style={{ textAlign: "center", position: "relative", maxWidth: 760 }}>
        {/* This is the game's setup step, not a second landing — keep the brand a
            quiet wordmark and make the player-count choice the hero. */}
        <a href="/" style={{ position: "absolute", top: -70, left: 0, fontFamily: MONO, fontSize: 13, letterSpacing: 1, color: T.goldSoft, textDecoration: "none" }}>← Menu</a>
        <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 5, color: T.goldSoft, textTransform: "uppercase", marginBottom: 10 }}>Bourbonomics · New game</div>
        <div style={{ fontFamily: SERIF, fontSize: 52, fontWeight: 800, letterSpacing: -1, color: "#8f6510", lineHeight: 1 }}>How many at the table?</div>
        <div style={{ fontSize: 17, color: C.muted, marginTop: 12, marginBottom: 44 }}>
          You play as <B>gold</B> — strategic bots fill the other seats. Most Capital after 5 ages wins.
        </div>
        <div style={{ display: "flex", gap: 18, justifyContent: "center" }}>
          {[2, 3, 4, 5].map((n) => (
            <button
              key={n}
              onClick={() => onStart(n)}
              style={{ fontFamily: SERIF, fontSize: 28, fontWeight: 700, padding: "22px 46px", background: "linear-gradient(#fffdf7, #f1e7cf)", color: T.ink, border: `1px solid ${T.gold}`, borderRadius: 14, cursor: "pointer", boxShadow: "0 4px 12px #7a5f2a2e" }}
            >
              {n} <span style={{ fontFamily: MONO, fontSize: 13, color: T.muted }}>PLAYERS</span>
            </button>
          ))}
        </div>
        <div style={{ marginTop: 30, fontSize: 15 }}>
          New here?{" "}
          <button
            onClick={onManual}
            style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, background: "none", border: "none", color: C.gold, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 3, padding: 0 }}
          >
            📖 Read the Field Guide
          </button>{" "}
          first.
        </div>
      </div>
    </div>
  );
}

// ── Board ────────────────────────────────────────────────────────────
type Mode = ActionType | "CLAIM_SLOT" | null;

export function Board({
  game,
  onAction,
  onNew,
  onManual,
  youId = HUMAN,
  notice,
}: {
  game: GameState;
  onAction: (a: Action) => string | null;
  onNew: () => void;
  onManual: () => void;
  youId?: string;
  notice?: string | null;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [toast, setToast] = useState<string | null>(null);
  // The tile currently pinned in the inspector (§3). Read-only info + fit + acts.
  const [inspectId, setInspectId] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = (m: string) => {
    setToast(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 2000);
  };
  // Surface async notices from an online session (e.g. "it isn't your turn").
  useEffect(() => {
    if (notice) flash(notice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notice]);

  // Which of your setup tiles is lifted, ready to place.
  const [selTile, setSelTile] = useState(0);
  // The setup how-to layover — shown once at the start, reopenable via the chip.
  const [helpOpen, setHelpOpen] = useState(true);
  // Board zoom (buttons + scroll wheel).
  const [zoom, setZoom] = useState(1);
  const zoomBy = (d: number) => setZoom((z) => Math.min(2.2, Math.max(0.6, +(z + d).toFixed(2))));
  // Tiles that just appeared → animate them flying in from their placer. Your
  // tiles rise from your hand (bottom); a rival's drop in from across the table
  // (top), tinted that rival's colour so you can see who laid it.
  type PlaceFX = { dir: "you" | "rival"; color: string };
  const [newTiles, setNewTiles] = useState<Map<string, PlaceFX>>(new Map());
  const prevIds = useRef<Set<string>>(new Set());
  useEffect(() => {
    const cur = new Set(game.tiles.map((t) => t.id));
    const fresh = game.tiles.filter((t) => !prevIds.current.has(t.id));
    const firstPaint = prevIds.current.size === 0;
    prevIds.current = cur;
    if (fresh.length > 0 && !firstPaint) {
      // who placed it? the newest "X places …" log line names the player.
      const placeLog = [...game.log].reverse().find((l) => / places /.test(l.message));
      const placerName = placeLog ? placeLog.message.split(" places ")[0] : null;
      const placer = placerName ? game.players.find((p) => p.name === placerName) : undefined;
      const isYou = placer ? placer.id === youId : true;
      const fx: PlaceFX = { dir: isYou ? "you" : "rival", color: placer ? PC[placer.colorIdx]! : T.gold };
      setNewTiles(new Map(fresh.map((t) => [t.id, fx])));
      const h = setTimeout(() => setNewTiles(new Map()), 1000);
      return () => clearTimeout(h);
    }
  }, [game.tiles, youId]);

  const inPlay = game.phase === "playing" || game.phase === "setup";
  const actor = inPlay ? currentActorOf(game) : null;
  const yourTurn = actor?.id === youId && inPlay;
  const you = game.players.find((p) => p.id === youId) ?? game.players[0]!;
  const inSetup = game.phase === "setup";
  const playing = game.phase === "playing";
  const sel = Math.min(selTile, Math.max(0, you.setupTiles.length - 1));
  // valid empty hexes to place the next setup tile (your turn only)
  const candidates = useMemo(
    () => (inSetup && game.stage === "setupPlace" && yourTurn ? placementCandidates(game) : []),
    [game, inSetup, yourTurn],
  );

  function dispatch(action: Action) {
    const err = onAction(action);
    if (err) flash(err);
  }

  // Try to perform the active action-mode on a tile. Returns true if it acted.
  function tryActOnTile(tile: Tile): boolean {
    if (!yourTurn || tile.category === "BLOCKING") return false;
    // Starting-DP step: click a tile to plant a LIVE DP on it (setup-exempt).
    if (game.stage === "setupDP") { dispatch({ type: "SETUP_PLACE_DP", tileId: tile.id }); return true; }
    if (game.stage === "resolve" || game.stage === "planning") {
      if (mode === "BUILD_DP") {
        // One DP action: a DARK DP of yours here → revive it; otherwise place a new one.
        const dark = game.dps.find((d) => d.tileId === tile.id && d.owner === youId && d.state === "DARK");
        dispatch(dark ? { type: "REPAIR_DP", dpId: dark.id } : { type: "BUILD_DP", tileId: tile.id });
        return true;
      }
      if (mode === "ADD_NICHE_FLAG") { dispatch({ type: "ADD_NICHE_FLAG", tileId: tile.id }); return true; }
      if (mode === "REMOVE_NICHE_FLAG") { dispatch({ type: "REMOVE_NICHE_FLAG", tileId: tile.id }); return true; }
      if (mode === "PUSH") { push(tile); return true; }
      if (mode === "CLAIM_SLOT") { dispatch({ type: "CLAIM_SLOT", tileId: tile.id, tag: preferredGrain(you) }); return true; }
    }
    return false;
  }

  // A click either takes the active action on the tile, or (no action pending)
  // pins it in the inspector (§3). Inspection works any time — even on a rival's
  // turn — since it is read-only.
  function clickTile(tile: Tile) {
    if (tryActOnTile(tile)) return;
    setInspectId((cur) => (cur === tile.id ? null : tile.id));
  }

  function placeSetupTile(hex: { q: number; r: number }) {
    if (yourTurn && game.stage === "setupPlace") dispatch({ type: "SETUP_PLACE_TILE", hex, tileIndex: sel });
  }

  function push(tile: Tile) {
    const cap = liveDPCount(game, tile.id, youId);
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

  const showTray = inSetup && game.stage === "setupPlace";
  return (
    <div style={{ width: 1920, height: 1080, background: C.bg, color: C.text, fontFamily: SANS, display: "flex", overflow: "hidden" }}>
      <style>{`
        @keyframes bbTilePop { 0%{transform:translateY(130px) scale(.35) rotate(-9deg);opacity:0} 45%{opacity:1} 70%{transform:translateY(-12px) scale(1.1) rotate(3deg)} 85%{transform:translateY(3px) scale(.97) rotate(-1.5deg)} 100%{transform:translateY(0) scale(1) rotate(0)} }
        @keyframes bbTileDrop { 0%{transform:translateY(-140px) scale(.35) rotate(9deg);opacity:0} 45%{opacity:1} 70%{transform:translateY(12px) scale(1.1) rotate(-3deg)} 85%{transform:translateY(-3px) scale(.97) rotate(1.5deg)} 100%{transform:translateY(0) scale(1) rotate(0)} }
        @keyframes bbTrayGlow { 0%,100%{box-shadow:0 -9px 30px -10px ${T.gold}88, inset 0 2px 0 #ffffffaa} 50%{box-shadow:0 -12px 40px -6px ${T.gold}cc, inset 0 2px 0 #ffffffaa} }
        @keyframes bbLift { 0%{transform:translateY(0)} 100%{transform:translateY(-10px)} }
        .bb-fan-card { transition: transform 130ms ease; }
        .bb-fan-card:hover { transform: translateY(-22px) rotate(0deg) !important; z-index: 30; }
        .bb-play-card { transition: transform 130ms ease; }
        .bb-play-card:hover { transform: translateY(-7px); z-index: 30; }
      `}</style>
      <div
        style={{
          flex: 1,
          position: "relative",
          background: "radial-gradient(125% 95% at 42% 34%, #f8f6ef 0%, #ebe7db 55%, #dcd7c9 100%)",
          boxShadow: "inset 0 0 220px 30px #8a806a2e",
          userSelect: "none",
          WebkitUserSelect: "none",
        }}
      >
        {/* paper grain (multiplies onto the light stage) */}
        <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.22, mixBlendMode: "multiply", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E\")" }} />

        {inSetup ? <SetupStatus stage={game.stage} yourTurn={yourTurn} actorName={actor?.name} actorColor={actor ? PC[actor.colorIdx] : undefined} onHelp={() => setHelpOpen(true)} /> : (
          <div style={{ position: "absolute", top: 20, left: 26, zIndex: 1 }}>
            <div style={{ fontFamily: MONO, fontSize: 11, letterSpacing: 3, color: "#4a3a1e", textTransform: "uppercase" }}>Bourbonomics</div>
            <div style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 26, color: "#241505", lineHeight: 1 }}>The Market</div>
            <div style={{ fontFamily: SANS, fontSize: 12.5, color: "#4c3c22", marginTop: 3, maxWidth: 360 }}>Serve demand · control tiles · harvest niches.</div>
          </div>
        )}

        <div
          onWheel={(e) => { if (e.deltaY !== 0) zoomBy(e.deltaY < 0 ? 0.12 : -0.12); }}
          style={{ position: "absolute", top: 0, left: playing ? 172 : 0, right: 0, bottom: showTray ? 186 : playing ? 312 : 0 }}
        >
          <HexMap game={game} mode={yourTurn && !inSetup ? mode : null} onClick={clickTile} candidates={candidates} onPlace={placeSetupTile} draftable={yourTurn && game.stage === "setupDP"} newTiles={newTiles} tilt={!inSetup} zoom={zoom} selectedId={inspectId} />
          {/* zoom controls */}
          <div style={{ position: "absolute", top: 14, right: 16, display: "flex", flexDirection: "column", gap: 5, zIndex: 3 }}>
            <ZoomBtn label="+" onClick={() => zoomBy(0.15)} />
            <ZoomBtn label="−" onClick={() => zoomBy(-0.15)} />
            <ZoomBtn label="⤢" onClick={() => setZoom(1)} small />
          </div>
        </div>

        {playing && <UpForBidShelf game={game} you={you} yourTurn={yourTurn} dispatch={dispatch} />}
        {playing && <PlayHandZone game={game} you={you} yourTurn={yourTurn} mode={mode} setMode={setMode} dispatch={dispatch} />}

        {showTray && (
          <SetupTray tiles={you.setupTiles} selected={sel} onSelect={setSelTile} yourTurn={yourTurn} />
        )}

        {toast && (
          <div style={{ position: "absolute", bottom: showTray ? 200 : 24, left: "50%", transform: "translateX(-50%)", background: "#000c", color: C.gold, padding: "10px 18px", borderRadius: 8, fontSize: 15, fontFamily: MONO, border: `1px solid ${T.border}`, zIndex: 5 }}>
            {toast}
          </div>
        )}
        {inSetup && helpOpen && <SetupHelpOverlay activeStage={game.stage} onClose={() => setHelpOpen(false)} />}
      </div>
      <Rail game={game} you={you} yourTurn={yourTurn} mode={mode} setMode={setMode} dispatch={dispatch} onNew={onNew} onManual={onManual} youId={youId} inspect={inspectId ? game.tiles.find((t) => t.id === inspectId) ?? null : null} onCloseInspect={() => setInspectId(null)} onPush={push} />
    </div>
  );
}

const SETUP_STEPS = [
  { key: "setupPlace", label: "Build the market", hint: "Pick a tile from your hand below the board, then click a glowing socket. Each tile must touch 2+ others." },
  { key: "setupDraft", label: "Draft bourbons", hint: "Take bottles from the market on the right. Premium bottles are held back until age 1." },
  { key: "setupDP", label: "Plant DPs", hint: "Drop your starting distribution points on any tiles — this is setup, so place them anywhere." },
] as const;

// Slim top-left status: the three step chips with the active one lit, a "how to
// play" chip that reopens the layover, and whose turn it is (so you can follow
// the board growing during rivals' turns). The instructions live in the layover.
function SetupStatus({ stage, yourTurn, actorName, actorColor, onHelp }: { stage: GameState["stage"]; yourTurn: boolean; actorName?: string; actorColor?: string; onHelp: () => void }) {
  const activeIdx = Math.max(0, SETUP_STEPS.findIndex((s) => s.key === stage));
  return (
    <div style={{ position: "absolute", top: 18, left: 24, zIndex: 3, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        {SETUP_STEPS.map((s, i) => {
          const done = i < activeIdx;
          const on = i === activeIdx;
          return (
            <span key={s.key} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: SERIF, fontWeight: 700, fontSize: 13, color: on ? "#1c110a" : done ? T.goldSoft : "#9a8358", background: on ? "linear-gradient(#f6d98a,#e7b64a)" : done ? "#e9dcbb" : "#ffffff55", border: `1px solid ${on ? T.gold : done ? T.border : "#00000018"}`, borderRadius: 999, padding: "3px 11px", boxShadow: on ? `0 3px 10px ${T.gold}55` : "none" }}>
                <span style={{ fontFamily: MONO, fontSize: 10, opacity: 0.85 }}>{done ? "✓" : i + 1}</span>
                {s.label}
              </span>
              {i < SETUP_STEPS.length - 1 && <span style={{ color: "#00000030", fontSize: 12 }}>→</span>}
            </span>
          );
        })}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onHelp} style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, color: T.goldSoft, background: "#fffef8cc", border: `1px solid ${T.border}`, borderRadius: 999, padding: "4px 12px", cursor: "pointer" }}>
          ⓘ How to play
        </button>
        {!yourTurn && actorColor && (
          <span style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: SANS, fontSize: 12.5, color: "#3a2c14", background: "#fffef8cc", border: `1px solid ${actorColor}66`, borderRadius: 999, padding: "3px 11px 3px 8px" }}>
            <span style={{ width: 11, height: 11, borderRadius: "50%", background: actorColor, boxShadow: `0 0 0 2px ${actorColor}44` }} />
            {actorName ?? "A rival"} is placing…
          </span>
        )}
      </div>
    </div>
  );
}

// The dismissible how-to layover, shown once at the start of setup and reopenable
// from the "How to play" chip. Click the backdrop, ✕, or "Got it" to dismiss.
function SetupHelpOverlay({ activeStage, onClose }: { activeStage: GameState["stage"]; onClose: () => void }) {
  const activeIdx = Math.max(0, SETUP_STEPS.findIndex((s) => s.key === activeStage));
  return (
    <div onClick={onClose} style={{ position: "absolute", inset: 0, zIndex: 30, background: "#241606c2", display: "grid", placeItems: "center", padding: 24 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: 580, maxWidth: "92%", background: "linear-gradient(#fffdf5, #f1e6cd)", border: `1px solid ${T.gold}`, borderRadius: 18, padding: "30px 34px 28px", boxShadow: "0 28px 70px #000a" }}>
        <button onClick={onClose} aria-label="Close" style={{ position: "absolute", top: 14, right: 16, width: 30, height: 30, borderRadius: 999, background: "#00000010", border: `1px solid ${T.border}`, color: T.muted, fontSize: 15, cursor: "pointer", lineHeight: 1 }}>✕</button>
        <div style={{ fontFamily: MONO, fontSize: 12, letterSpacing: 5, color: T.goldSoft, textTransform: "uppercase" }}>Setup</div>
        <h2 style={{ fontFamily: SERIF, fontSize: 30, fontWeight: 800, color: T.ink, margin: "4px 0 6px" }}>Lay the board &amp; stock up</h2>
        <p style={{ fontFamily: SANS, fontSize: 14.5, color: T.muted, margin: "0 0 18px", lineHeight: 1.5 }}>
          Before age 1, you and your rivals build the market together and gather your bourbons. Three quick steps:
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
          {SETUP_STEPS.map((s, i) => {
            const on = i === activeIdx;
            return (
              <div key={s.key} style={{ display: "flex", gap: 13, alignItems: "flex-start", background: on ? "#f7eccf" : "transparent", border: `1px solid ${on ? T.gold : "transparent"}`, borderRadius: 12, padding: "9px 12px" }}>
                <span style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 999, background: on ? "linear-gradient(#f6d98a,#e7b64a)" : "#e9dcbb", color: "#1c110a", fontFamily: SERIF, fontWeight: 800, fontSize: 14, display: "grid", placeItems: "center", boxShadow: on ? `0 2px 8px ${T.gold}66` : "none" }}>{i + 1}</span>
                <div>
                  <div style={{ fontFamily: SERIF, fontSize: 16.5, fontWeight: 700, color: T.ink }}>
                    {s.label} {on && <span style={{ fontFamily: MONO, fontSize: 10, color: T.goldSoft, letterSpacing: 1 }}>· NOW</span>}
                  </div>
                  <div style={{ fontFamily: SANS, fontSize: 13.5, color: T.muted, lineHeight: 1.45, marginTop: 1 }}>{s.hint}</div>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onClose} style={{ width: "100%", fontFamily: SERIF, fontSize: 18, fontWeight: 700, color: "#1c110a", background: "linear-gradient(#f0c65a, #d69f2a)", border: `1px solid ${T.gold}`, borderRadius: 12, padding: "12px 0", cursor: "pointer", boxShadow: `0 5px 16px ${T.gold}55` }}>
          Got it — let&apos;s play →
        </button>
      </div>
    </div>
  );
}

// The glowing "hand" of setup tiles, docked below the board. Click a card to lift
// it; the lifted card is the one placed when you click a socket.
function SetupTray({ tiles, selected, onSelect, yourTurn }: { tiles: GameState["players"][number]["setupTiles"]; selected: number; onSelect: (i: number) => void; yourTurn: boolean }) {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        height: 186,
        background: "linear-gradient(to top, #efece1 0%, #efece1ee 55%, #efece100 100%)",
        borderTop: `2px solid ${T.gold}`,
        animation: "bbTrayGlow 2.6s ease-in-out infinite",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "flex-end",
        padding: "0 20px 16px",
        gap: 8,
        zIndex: 4,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, alignSelf: "stretch", justifyContent: "center", marginBottom: 2 }}>
        <span style={{ flex: 1, maxWidth: 220, height: 1, background: `linear-gradient(90deg, transparent, ${T.gold})` }} />
        <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: T.goldSoft, letterSpacing: 0.5 }}>
          {yourTurn ? "Your tiles — pick one, then click a glowing socket" : "Your tiles"}
        </span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: T.muted }}>{tiles.length} to place</span>
        <span style={{ flex: 1, maxWidth: 220, height: 1, background: `linear-gradient(90deg, ${T.gold}, transparent)` }} />
      </div>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", minHeight: 132 }}>
        {tiles.length === 0 && <span style={{ fontSize: 14, color: T.faint, alignSelf: "center", paddingBottom: 40 }}>All tiles placed — on to the draft.</span>}
        {tiles.map((t, i) => (
          <button
            key={t.defId + i}
            onClick={() => onSelect(i)}
            disabled={!yourTurn}
            style={{ background: "none", border: "none", padding: 0, cursor: yourTurn ? "pointer" : "default" }}
          >
            <SetupTileCard tile={t} isNext={i === selected && yourTurn} />
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Hex map ──────────────────────────────────────────────────────────
const HEX = 56;
const THICK = 7; // slim cardboard edge for the extruded chip

// Territorial washes on the top face + darkened side-wall colors, by controller
// colorIdx (0 = you/gold, 1 = rosé, 2 = green, 3 = blue, 4 = plum).
const OWN_FACE = ["#f6e6c4", "#f4dbd1", "#dcecd5", "#d9e2ee", "#e9dcee"];
const OWN_EDGE = ["#a8842f", "#a85c47", "#4d7d6a", "#3a5a82", "#6a4a80"];

/** Pointy-top hex corner coords (matches hexPolygonPoints order). */
function hexCorners(cx: number, cy: number, size: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push([cx + size * Math.cos(a), cy + size * Math.sin(a)]);
  }
  return pts;
}

function HexMap({ game, mode, onClick, candidates = [], onPlace, draftable = false, newTiles, tilt = false, zoom = 1, selectedId }: { game: GameState; mode: Mode; onClick: (t: Tile) => void; candidates?: { q: number; r: number }[]; onPlace?: (h: { q: number; r: number }) => void; draftable?: boolean; newTiles?: Map<string, { dir: "you" | "rival"; color: string }>; tilt?: boolean; zoom?: number; selectedId?: string | null }) {
  const layout = useMemo(() => {
    const pts = game.tiles.map((t) => ({ t, ...axialToPixel(t.hex, HEX) }));
    const cand = candidates.map((h) => ({ h, ...axialToPixel(h, HEX) }));
    const xs = [...pts, ...cand].map((p) => p.x);
    const ys = [...pts, ...cand].map((p) => p.y);
    const minX = Math.min(...xs) - HEX * 1.6;
    const minY = Math.min(...ys) - HEX * 1.6;
    const w = Math.max(...xs) - minX + HEX * 1.6;
    const h = Math.max(...ys) - minY + HEX * 1.6;
    const posOf = new Map(pts.map(({ t, x, y }) => [t.id, { x, y }]));
    return { pts, cand, minX, minY, w, h, posOf };
  }, [game.tiles, candidates]);

  const idxOf = (pid: string) => game.players.findIndex((p) => p.id === pid);

  // Ground the cluster with one soft elliptical shadow under it (parchment table).
  const cx = layout.minX + layout.w / 2;
  const gy = layout.minY + layout.h * 0.66;
  return (
    <div style={{ width: "100%", height: "100%", perspective: tilt ? "1700px" : undefined, userSelect: "none", WebkitUserSelect: "none" }}>
      <svg
        viewBox={`${layout.minX} ${layout.minY} ${layout.w} ${layout.h}`}
        style={{ width: "100%", height: "100%", transform: `${tilt ? "rotateX(12deg) " : ""}scale(${zoom})`, transformOrigin: "center 55%", overflow: "visible", transition: "transform 120ms ease" }}
      >
        <defs>
          <radialGradient id="tileSheen" cx="0.35" cy="0.22" r="0.9">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.42" />
            <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="plainFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fffef9" />
            <stop offset="1" stopColor="#efe6d2" />
          </linearGradient>
          <linearGradient id="rewardFace" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fdf3cf" />
            <stop offset="1" stopColor="#eccb70" />
          </linearGradient>
          <radialGradient id="groundShadow" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#2a1c0c" stopOpacity="0.34" />
            <stop offset="0.7" stopColor="#2a1c0c" stopOpacity="0.14" />
            <stop offset="1" stopColor="#2a1c0c" stopOpacity="0" />
          </radialGradient>
          {/* soft gold bloom for the placement sockets */}
          <filter id="socketGlow" x="-60%" y="-60%" width="220%" height="220%">
            <feDropShadow dx="0" dy="0" stdDeviation="7" floodColor="#e6a92a" floodOpacity="0.95" />
          </filter>
        </defs>
        <ellipse cx={cx} cy={gy} rx={layout.w * 0.46} ry={layout.h * 0.2} fill="url(#groundShadow)" pointerEvents="none" />
      {/* ghost placement sockets (drawn UNDER tiles so tiles always read on top) */}
      {layout.cand.map(({ h, x, y }, i) => (
        <g key={`c${i}`} onClick={() => onPlace?.(h)} style={{ cursor: "pointer" }}>
          <polygon points={hexPolygonPoints(x, y, HEX - 4)} fill="#e7b53a22" stroke="#d89f1c" strokeWidth={3} strokeDasharray="9 6" filter="url(#socketGlow)">
            <animate attributeName="opacity" values="0.55;1;0.55" dur="1.7s" repeatCount="indefinite" />
          </polygon>
          <text x={x} y={y - 1} textAnchor="middle" fontFamily={SERIF} fontSize={36} fontWeight={700} fill="#a9781a" opacity={0.9}>＋</text>
          <text x={x} y={y + 25} textAnchor="middle" fontFamily={MONO} fontSize={10.5} letterSpacing={1.5} fill="#8a6416">PLACE</text>
        </g>
      ))}
        {layout.pts.map(({ t, x, y }) => (
          <TileHex key={t.id} game={game} t={t} x={x} y={y} idxOf={idxOf} clickable actionable={(mode !== null || draftable) && t.category !== "BLOCKING"} selected={t.id === selectedId} onClick={() => onClick(t)} fx={newTiles?.get(t.id)} />
        ))}
        <NicheGroups game={game} pos={layout.posOf} />
      </svg>
    </div>
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

function TileHex({ game, t, x, y, idxOf, clickable, actionable = false, selected = false, onClick, fx }: { game: GameState; t: Tile; x: number; y: number; idxOf: (p: string) => number; clickable: boolean; actionable?: boolean; selected?: boolean; onClick: () => void; fx?: { dir: "you" | "rival"; color: string } }) {
  const isNew = fx != null;
  const ctrl = tileController(game, t.id);
  const ctrlIdx = ctrl ? idxOf(ctrl) : -1;
  const flags = game.nicheFlags.filter((f) => f.tileId === t.id);
  const dps = game.dps.filter((d) => d.tileId === t.id);
  const isBlock = t.category === "BLOCKING";
  const isWild = t.category === "LOYALTY" || t.category === "KEYSTONE";
  const reward = t.reward;

  // §1/§2: an extruded chip. Top face carries a TERRITORIAL wash by controller;
  // side walls are a darkened shade of that; reward is signalled by a ribbon (not
  // the whole face). Blocking = charred oak.
  const rc = reward ? rewardColor(reward) : null;
  const face = isBlock ? "#3a352c" : ctrlIdx >= 0 ? OWN_FACE[ctrlIdx]! : rc ? "url(#rewardFace)" : "url(#plainFace)";
  const edge = isBlock ? "#140f07" : ctrlIdx >= 0 ? OWN_EDGE[ctrlIdx]! : rc ? "#9a7420" : "#b09965";
  const rim = isBlock ? "#160d05" : ctrlIdx >= 0 ? PC[ctrlIdx]! : rc ? "#c69a2c" : "#a98f5f";
  const rimW = ctrlIdx >= 0 ? 3 : rc ? 2.4 : 1.8;
  const nm = nameLines(t.name);
  const corners = hexCorners(x, y, HEX);
  const lowerEdges: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 4]];

  const anim = fx ? `${fx.dir === "rival" ? "bbTileDrop" : "bbTilePop"} 900ms cubic-bezier(0.16, 1, 0.3, 1) both` : undefined;
  return (
    <g onClick={onClick} style={{ cursor: clickable ? "pointer" : "default", ...(anim ? { animation: anim, transformBox: "fill-box", transformOrigin: "center" } as React.CSSProperties : {}) }}>
      {/* 1. contact shadow */}
      <polygon points={hexPolygonPoints(x, y + THICK + 5, HEX)} fill="#2a1c0c" opacity={0.26} />
      {/* 2. extruded side walls (the four lower/front edges) */}
      {lowerEdges.map(([a, b], i) => {
        const [ax, ay] = corners[a]!;
        const [bx, by] = corners[b]!;
        return <polygon key={i} points={`${ax},${ay} ${bx},${by} ${bx},${by + THICK} ${ax},${ay + THICK}`} fill={edge} />;
      })}
      {/* 3. top face + barely-there inner hairline (no heavy bevel) */}
      <polygon points={hexPolygonPoints(x, y, HEX)} fill={face} stroke={rim} strokeWidth={rimW} />
      {!isBlock && <polygon points={hexPolygonPoints(x, y, HEX - 3.5)} fill="none" stroke="#ffffff" strokeOpacity={0.06} strokeWidth={1.2} />}
      {/* 4. sheen */}
      <polygon points={hexPolygonPoints(x, y, HEX)} fill="url(#tileSheen)" pointerEvents="none" />
      {/* soft ripple as the tile settles — tinted with the placer's colour */}
      {isNew && (
        <polygon points={hexPolygonPoints(x, y, HEX)} fill="none" stroke={fx!.color} strokeWidth={2} pointerEvents="none">
          <animate attributeName="stroke-width" values="1;11" dur="0.72s" begin="0.42s" fill="freeze" calcMode="spline" keySplines="0.2 0.8 0.3 1" keyTimes="0;1" />
          <animate attributeName="opacity" values="0.75;0" dur="0.72s" begin="0.42s" fill="freeze" />
        </polygon>
      )}
      {t.defenseBonus > 0 && !isBlock && <DefBadge x={x + HEX * 0.5} y={y + HEX * 0.5} n={t.defenseBonus} />}
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
          {/* reward ribbon — a dark notched banner at the top edge */}
          {reward && (
            <g transform={`translate(${x} ${y - HEX * 0.64})`}>
              <polygon points="-36,-8 36,-8 31,0 36,8 -36,8 -31,0" fill={darken(rc!, 0.52)} stroke={rc!} strokeWidth={1} />
              <text y={3} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={8} letterSpacing={0.3} fill="#ffe9c0">{rewardLabel(reward)}</text>
            </g>
          )}
          {isWild && <text x={x} y={y - HEX * 0.36} textAnchor="middle" fontFamily={MONO} fontSize={8} letterSpacing={1.2} fill={T.ink} opacity={0.6}>WILDCARD</text>}
          <text x={x} y={y - HEX * (reward || isWild ? 0.16 : 0.34)} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={13.5} fill={T.ink} stroke="#fffdf5" strokeWidth={3.2} strokeLinejoin="round" style={{ paintOrder: "stroke" } as React.CSSProperties}>
            {nm.map((ln, i) => (
              <tspan key={i} x={x} dy={i === 0 ? 0 : 13}>{ln}</tspan>
            ))}
          </text>
          {isWild ? (
            <OwnerSlot game={game} t={t} x={x} y={y + HEX * 0.16} idxOf={idxOf} />
          ) : (
            <TagGridSVG tags={t.tags} cx={x} cy={y + HEX * 0.2} cell={13} />
          )}
          <DPRow dps={dps} x={x} y={y + HEX * 0.76} idxOf={idxOf} />
          {flags.length > 0 && (
            <g transform={`translate(${x - HEX * 0.68} ${y - HEX * 0.02})`}>
              {flags.slice(0, 4).map((f, i) => <Flag key={f.id} x={0} y={i * 8} color={PC[idxOf(f.owner)]!} h={15} />)}
            </g>
          )}
        </>
      )}
      {/* actionable hint (a mode targets this tile) and the inspector selection ring */}
      {actionable && !selected && (
        <polygon points={hexPolygonPoints(x, y, HEX - 2)} fill="none" stroke={T.green} strokeWidth={2} strokeDasharray="6 5" opacity={0.75} pointerEvents="none" />
      )}
      {selected && (
        <polygon points={hexPolygonPoints(x, y, HEX + 2.5)} fill="none" stroke={T.gold} strokeWidth={3.5} pointerEvents="none">
          <animate attributeName="stroke-opacity" values="1;0.35;1" dur="1.4s" repeatCount="indefinite" />
        </polygon>
      )}
    </g>
  );
}

// §2.3 — draw each player's contiguous claim clusters as a colored outline:
// dashed while building (< NICHE_MIN tiles), solid once it's a niche. For a
// formed niche, flag tier-2 all-or-nothing status — a "n/m" or "✓" badge and a
// "!" warning on every niche tile the owner does NOT control (the tile denying
// the whole bonus). Clusters stagger by player so overlaps stay readable.
function NicheGroups({ game, pos }: { game: GameState; pos: Map<string, { x: number; y: number }> }) {
  const out: React.ReactNode[] = [];
  game.players.forEach((p, pi) => {
    const col = PC[pi]!;
    derivedNiches(game, p.id).forEach((n, ci) => {
      if (n.tileIds.length < 2) return; // a lone flag isn't a group worth outlining
      const formed = n.tileIds.length >= CONFIG.NICHE_MIN_TILES;
      const ringR = HEX + 3 + pi * 2.5;
      for (const tid of n.tileIds) {
        const q = pos.get(tid);
        if (!q) continue;
        out.push(
          <polygon
            key={`ng-${p.id}-${ci}-${tid}`}
            points={hexPolygonPoints(q.x, q.y, ringR)}
            fill="none"
            stroke={col}
            strokeWidth={formed ? 3 : 2}
            strokeDasharray={formed ? undefined : "7 6"}
            strokeLinejoin="round"
            opacity={0.9}
            pointerEvents="none"
          />,
        );
        if (formed && tileController(game, tid) !== p.id) {
          out.push(
            <g key={`ngw-${p.id}-${ci}-${tid}`} transform={`translate(${q.x - HEX * 0.52} ${q.y - HEX * 0.52})`} pointerEvents="none">
              <circle r={8.5} fill="#d39a1e" stroke="#fff" strokeWidth={1.3} />
              <text y={3.2} textAnchor="middle" fontFamily={MONO} fontWeight={800} fontSize={12} fill="#3a2600">!</text>
            </g>,
          );
        }
      }
      if (formed) {
        const first = pos.get(n.tileIds[0]!);
        if (first) {
          const held = nicheControlledCount(game, n);
          const all = held === n.tileIds.length;
          out.push(
            <g key={`ngb-${p.id}-${ci}`} transform={`translate(${first.x} ${first.y - HEX - 7})`} pointerEvents="none">
              <rect x={-24} y={-9} width={48} height={17} rx={8} fill={all ? "#3f6d34" : "#7a531c"} stroke={col} strokeWidth={1.3} />
              <text y={3.4} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={8.5} letterSpacing={0.3} fill="#fff">
                {all ? "NICHE ✓" : `${held}/${n.tileIds.length}`}
              </text>
            </g>,
          );
        }
      }
    });
  });
  return <>{out}</>;
}

// Wildcard tiles carry no shelf slot / star — the owner reads from their seated
// pawn's colour and the territorial tint; defense shows via the shared DefBadge.
function OwnerSlot({ game, t, x, y, idxOf }: { game: GameState; t: Tile; x: number; y: number; idxOf: (p: string) => number }) {
  const ownerDP = t.ownerSlotDP ? game.dps.find((d) => d.id === t.ownerSlotDP) : null;
  return ownerDP ? (
    <text x={x} y={y} textAnchor="middle" fontFamily={MONO} fontSize={8} letterSpacing={0.5} fill={PC[idxOf(ownerDP.owner)]!} fontWeight={700}>
      held ●
    </text>
  ) : (
    <text x={x} y={y} textAnchor="middle" fontFamily={MONO} fontSize={8} letterSpacing={0.5} fill="#8a6a3a">unclaimed</text>
  );
}

/** Owner defense badge — a small red disc at a tile's lower-right. */
function DefBadge({ x, y, n }: { x: number; y: number; n: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={11} fill="#9c2f24" stroke="#ffffff" strokeWidth={1.4} />
      <text y={-1} textAnchor="middle" fontFamily={SERIF} fontWeight={800} fontSize={11} fill="#fff">+{n}</text>
      <text y={7} textAnchor="middle" fontFamily={MONO} fontSize={4.5} letterSpacing={0.5} fill="#ffd9d0">DEF</text>
    </g>
  );
}

/** Darken a #rrggbb color toward black by fraction f. */
function darken(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * (1 - f));
  const g = Math.round(((n >> 8) & 255) * (1 - f));
  const b = Math.round((n & 255) * (1 - f));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

function ZoomBtn({ label, onClick, small = false }: { label: string; onClick: () => void; small?: boolean }) {
  return (
    <button onClick={onClick} title="Zoom" style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${T.border}`, background: "#fffef8dd", color: T.goldSoft, fontSize: small ? 13 : 19, fontWeight: 700, cursor: "pointer", lineHeight: 1, display: "grid", placeItems: "center", boxShadow: "0 2px 6px #0003" }}>{label}</button>
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
  youId,
  inspect,
  onCloseInspect,
  onPush,
}: {
  game: GameState;
  you: GameState["players"][number];
  yourTurn: boolean;
  mode: Mode;
  setMode: (m: Mode) => void;
  dispatch: (a: Action) => void;
  onNew: () => void;
  onManual: () => void;
  youId: string;
  inspect: Tile | null;
  onCloseInspect: () => void;
  onPush: (t: Tile) => void;
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
      <NicheTracker game={game} you={you} />
      {/* the market shows in the rail during the opening draft; in play it moves
          to the board's "Up for Bid" shelf. */}
      {game.phase === "setup" && <Market game={game} you={you} yourTurn={yourTurn} dispatch={dispatch} />}
      {inspect && (
        <TileInspector game={game} tile={inspect} youId={youId} yourTurn={yourTurn} dispatch={dispatch} onPush={onPush} onClose={onCloseInspect} />
      )}
      <div style={{ flex: 1 }} />
      {/* bourbons + play controls live on the board pane now; the rail keeps the
          play controls only during setup / game over. */}
      {game.phase !== "playing" && <Controls game={game} you={you} yourTurn={yourTurn} mode={mode} setMode={setMode} dispatch={dispatch} />}
      <Log game={game} />
    </div>
  );
}

/** A tile's effective demand tags for fit (a declared wildcard tag overrides). */
function tileTargetTags(t: Tile): Tag[] {
  return t.wildcardTag ? [t.wildcardTag] : t.tags;
}

// §3 — the tile inspector. Surfaces everything the tabletop makes you compute:
// control, per-player DP breakdown, niche flags, YOUR bourbons ranked by fit,
// and the actions you can take on this tile right now.
function TileInspector({ game, tile, youId, yourTurn, dispatch, onPush, onClose }: {
  game: GameState;
  tile: Tile;
  youId: string;
  yourTurn: boolean;
  dispatch: (a: Action) => void;
  onPush: (t: Tile) => void;
  onClose: () => void;
}) {
  const idxOf = (pid: string) => game.players.findIndex((p) => p.id === pid);
  const you = game.players.find((p) => p.id === youId)!;
  const isBlock = tile.category === "BLOCKING";
  const isWild = tile.category === "LOYALTY" || tile.category === "KEYSTONE";
  const ctrl = tileController(game, tile.id);
  const owner = tileOwner(game, tile.id);
  const target = tileTargetTags(tile);

  const dpByPlayer = game.players
    .map((p) => ({
      p,
      live: game.dps.filter((d) => d.tileId === tile.id && d.owner === p.id && d.state === "LIVE").length,
      dark: game.dps.filter((d) => d.tileId === tile.id && d.owner === p.id && d.state === "DARK").length,
    }))
    .filter((x) => x.live + x.dark > 0);

  const flaggers = game.players.filter((p) => game.nicheFlags.some((f) => f.tileId === tile.id && f.owner === p.id));

  const ranked = isBlock
    ? []
    : [...you.bourbons]
        .map((b) => ({ b, f: fit(b.tags, target) }))
        .sort((a, z) => Number(z.b.state === "FRESH") - Number(a.b.state === "FRESH") || z.f - a.f);

  const allowed = new Set<ActionType>();
  if (yourTurn) for (const s of you.allowedSuits) for (const a of SUIT_ACTIONS[s]) allowed.add(a);
  const canSpend = yourTurn && you.pipsRemaining > 0 && (game.stage === "resolve" || game.stage === "planning") && !isBlock;
  const myDark = game.dps.find((d) => d.tileId === tile.id && d.owner === youId && d.state === "DARK");
  const myLive = liveDPCount(game, tile.id, youId);
  const freshFit = ranked.filter((r) => r.b.state === "FRESH" && r.f > 0).length;
  const slotOpen = tile.ownershipSlot && !tile.ownerSlotDP;
  const acts = !canSpend
    ? []
    : ([
        { label: myDark ? "Repair DP" : "Build DP", on: allowed.has("BUILD_DP") || allowed.has("REPAIR_DP"), run: () => (myDark ? dispatch({ type: "REPAIR_DP", dpId: myDark.id }) : dispatch({ type: "BUILD_DP", tileId: tile.id })) },
        { label: "Push", on: allowed.has("PUSH") && myLive > 0 && freshFit > 0, run: () => onPush(tile) },
        { label: "Add flag", on: allowed.has("ADD_NICHE_FLAG"), run: () => dispatch({ type: "ADD_NICHE_FLAG", tileId: tile.id }) },
        { label: "Remove flag", on: allowed.has("REMOVE_NICHE_FLAG") && game.nicheFlags.some((f) => f.tileId === tile.id && f.owner === youId), run: () => dispatch({ type: "REMOVE_NICHE_FLAG", tileId: tile.id }) },
        { label: "Claim slot", on: allowed.has("BUILD_DP") && !!slotOpen, run: () => dispatch({ type: "CLAIM_SLOT", tileId: tile.id, tag: preferredGrain(you) }) },
      ].filter((a) => a.on) as { label: string; run: () => void }[]);

  const dot = (i: number) => <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: "50%", background: PC[i]!, marginRight: 5 }} />;
  const sub = { fontFamily: MONO, fontSize: 9, letterSpacing: 1, color: T.faint, textTransform: "uppercase" as const, marginBottom: 3 };

  return (
    <div style={{ background: T.panel, border: `1px solid ${T.gold}66`, borderRadius: 12, padding: 12, boxShadow: "0 4px 14px #0004" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontFamily: SERIF, fontSize: 18, fontWeight: 800, color: T.cream }}>{tile.name}</span>
        <button onClick={onClose} title="Close" style={{ background: "none", border: "none", color: T.faint, fontSize: 18, cursor: "pointer", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, letterSpacing: 1, color: T.faint, textTransform: "uppercase", marginBottom: 8 }}>
        {tile.category.replace(/_/g, " ").toLowerCase()}{isBlock ? " · terrain" : ""}
      </div>

      {isBlock ? (
        <div style={{ fontSize: 12.5, color: T.muted }}>Blocking terrain — holds no DPs and breaks adjacency chains.</div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap", marginBottom: 9 }}>
            {(isWild ? ([tile.wildcardTag].filter(Boolean) as Tag[]) : tile.tags).map((tg, i) => (
              <span key={i} style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 12, color: "#fff", background: tagColor(tg), borderRadius: 5, padding: "2px 7px" }}>{tagGlyph(tg)}</span>
            ))}
            {isWild && tile.tags.length === 0 && !tile.wildcardTag && <span style={{ fontFamily: MONO, fontSize: 9, color: T.muted }}>owner declares tag</span>}
            {tile.reward && <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: rewardColor(tile.reward), border: `1px solid ${rewardColor(tile.reward)}66`, borderRadius: 999, padding: "2px 8px" }}>{rewardLabel(tile.reward)}</span>}
            {tile.defenseBonus > 0 && <span style={{ fontFamily: MONO, fontSize: 10.5, fontWeight: 700, color: "#e08b7f" }}>DEF +{tile.defenseBonus}</span>}
          </div>

          <div style={{ display: "flex", gap: 16, fontSize: 12.5, marginBottom: 9 }}>
            <span style={{ color: T.muted }}>Controlled by {ctrl ? <b style={{ color: PC[idxOf(ctrl)] }}>{game.players[idxOf(ctrl)]!.name}</b> : <span style={{ color: T.faint }}>nobody</span>}</span>
            {tile.ownershipSlot && <span style={{ color: T.muted }}>Owner {owner ? <b style={{ color: PC[idxOf(owner)] }}>{game.players[idxOf(owner)]!.name}</b> : <span style={{ color: T.faint }}>unclaimed</span>}</span>}
          </div>

          <div style={{ marginBottom: 9 }}>
            <div style={sub}>Distribution points</div>
            {dpByPlayer.length === 0 ? (
              <span style={{ fontSize: 12, color: T.faint }}>none yet</span>
            ) : (
              dpByPlayer.map(({ p, live, dark }) => (
                <div key={p.id} style={{ fontSize: 12.5 }}>{dot(idxOf(p.id))}<b style={{ color: PC[idxOf(p.id)] }}>{p.name}</b> <span style={{ color: T.muted }}>{live} live{dark ? ` · ${dark} dark` : ""}</span></div>
              ))
            )}
          </div>

          {flaggers.length > 0 && (
            <div style={{ marginBottom: 9, fontSize: 12.5 }}>
              <span style={sub}>Claimed by </span>
              {flaggers.map((p, i) => <span key={p.id}>{i ? ", " : ""}<b style={{ color: PC[idxOf(p.id)] }}>{p.name}</b></span>)}
            </div>
          )}

          <div>
            <div style={sub}>Your bourbons · fit here</div>
            {ranked.length === 0 ? (
              <span style={{ fontSize: 12, color: T.faint }}>no bourbons yet</span>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {ranked.slice(0, 6).map(({ b, f }) => (
                  <div key={b.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, opacity: b.state === "FRESH" ? 1 : 0.45 }}>
                    <span style={{ color: b.state === "FRESH" ? T.cream : T.muted }}>{b.name}{b.state !== "FRESH" ? " · depleted" : ""}</span>
                    <b style={{ color: f > 0 ? T.gold : T.faint, fontFamily: MONO }}>fit {f}</b>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {acts.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, borderTop: `1px solid ${T.line}`, paddingTop: 8, marginTop: 9 }}>
          {acts.map((a) => (
            <button key={a.label} onClick={a.run} style={btn(C.green)}>{a.label}</button>
          ))}
        </div>
      )}
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
            <Stat value={p.dpSupply} label="DP" redAt0 />
            <Stat value={tiles} label="TILES" />
            <Stat value={fresh} label="CASKS" />
            <Stat value={tokTotal} label="TOKENS" />
          </div>
        );
      })}
    </div>
  );
}

function Stat({ value, label, redAt0 = false }: { value: number; label: string; redAt0?: boolean }) {
  const red = redAt0 && value === 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 42 }}>
      <span style={{ fontFamily: MONO, fontSize: 14, fontWeight: 700, color: red ? T.red : T.ink, lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: MONO, fontSize: 8, letterSpacing: 0.5, color: red ? T.red : T.faint }}>{label}</span>
    </div>
  );
}

// Niches are the ONLY source of Capital — surface the player's progress toward
// one so the win condition is legible. Shows the largest flag cluster: claims
// toward the 5-tile minimum, then how many of its tiles you control (tier-2 is
// all-or-nothing — you must control EVERY tile to collect its rewards).
function NicheTracker({ game, you }: { game: GameState; you: GameState["players"][number] }) {
  const need = CONFIG.NICHE_MIN_TILES;
  const best = derivedNiches(game, you.id).sort((a, b) => b.tileIds.length - a.tileIds.length)[0];
  const size = best?.tileIds.length ?? 0;
  const formed = size >= need;
  const controlled = best ? nicheControlledCount(game, best) : 0;
  const status = best && formed ? nicheStatus(game, best) : "none";

  const pct = Math.min(100, (size / need) * 100);
  const barColor = status === "full" ? "#5f7d34" : formed ? T.gold : T.goldSoft;
  const msg = !best
    ? "Flag connected tiles to stake a niche."
    : !formed
      ? `Building — ${size}/${need} connected claims.`
      : status === "full"
        ? `Whole niche controlled — scores all rewards ✓`
        : `Controlled ${controlled}/${size} — hold ALL to claim its rewards.`;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "2px 0 5px" }}>
        <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: T.goldSoft, letterSpacing: 0.3 }}>Your niche</span>
        <span style={{ flex: 1, height: 1, background: T.line }} />
        <span style={{ fontFamily: MONO, fontSize: 10.5, color: status === "full" ? "#5f7d34" : T.faint }}>
          {formed ? `${controlled}/${size} held` : `${size}/${need}`}
        </span>
      </div>
      <div style={{ height: 8, background: T.panel2, borderRadius: 999, overflow: "hidden", border: `1px solid ${T.line}` }}>
        <div style={{ width: `${pct}%`, height: "100%", background: `linear-gradient(90deg, ${barColor}, ${barColor}bb)`, transition: "width 200ms" }} />
      </div>
      <div style={{ fontFamily: SANS, fontSize: 12, color: status === "full" ? "#5f7d34" : T.muted, marginTop: 4 }}>{msg}</div>
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
              style={{ flex: "1 1 158px", textAlign: "left", background: T.panel, borderTop: `1px solid ${canBid ? T.gold : T.line}`, borderRight: `1px solid ${canBid ? T.gold : T.line}`, borderBottom: `1px solid ${canBid ? T.gold : T.line}`, borderLeft: `4px solid ${accent}`, borderRadius: 9, padding: "8px 10px", cursor: canBid ? "pointer" : "default", boxShadow: canBid ? `0 1px 4px #7a5f2a26` : "none" }}
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
      ) : game.stage === "setupDP" ? (
        <SetupDPControls game={game} you={you} />
      ) : game.stage === "commit" ? (
        <CommitControls you={you} dispatch={dispatch} />
      ) : (
        <ActControls game={game} you={you} mode={mode} setMode={setMode} dispatch={dispatch} />
      )}
    </div>
  );
}

// ── Play-screen board overlays (Market handoff §4–5) ─────────────────
// The market lots, as collector bottles, on a shelf to the LEFT of the board.
function UpForBidShelf({ game, you, yourTurn, dispatch }: { game: GameState; you: GameState["players"][number]; yourTurn: boolean; dispatch: (a: Action) => void }) {
  const canBid = yourTurn && you.allowedSuits.some((s) => SUIT_ACTIONS[s].includes("BID"));
  return (
    <div style={{ position: "absolute", left: 12, top: 104, bottom: 244, width: 152, display: "flex", flexDirection: "column", gap: 7, zIndex: 2 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: SERIF, fontWeight: 700, fontSize: 15, color: T.goldSoft }}>Up for Bid</span>
        {canBid && <span style={{ fontFamily: MONO, fontSize: 9, color: T.gold }}>click to bid</span>}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7, overflow: "hidden" }}>
        {game.market.map((lot) => {
          const bids = Object.entries(lot.bids).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
          const top = bids[0];
          return (
            <BottleCard
              key={lot.id}
              name={lot.def.name}
              tags={lot.def.tags}
              compact
              onClick={canBid ? () => dispatch({ type: "BID", lotId: lot.id }) : undefined}
              footerBg="#2a1c0e"
              footer={top
                ? <span style={{ fontFamily: MONO, fontSize: 8.5, color: "#e7cfa0" }}>● {game.players.find((p) => p.id === top[0])?.name} · {top[1]}</span>
                : <span style={{ fontFamily: MONO, fontSize: 8.5, color: "#8a7458" }}>no bids yet</span>}
            />
          );
        })}
        {game.market.length === 0 && <span style={{ fontFamily: SANS, fontSize: 12, color: T.faint }}>market resolved</span>}
      </div>
    </div>
  );
}

// The player's bourbons, fanned as bottles at the bottom (a card lifts on hover).
function BourbonFan({ bourbons }: { bourbons: GameState["players"][number]["bourbons"] }) {
  const cards = bourbons.slice(0, 7);
  const mid = (cards.length - 1) / 2;
  if (cards.length === 0) return <span style={{ fontFamily: SANS, fontSize: 13, color: T.faint, paddingBottom: 60 }}>none — bid at the market</span>;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", paddingLeft: 54 }}>
      {cards.map((b, i) => (
        <div key={b.id} className="bb-fan-card" style={{ marginLeft: i === 0 ? 0 : -104, transform: `rotate(${(i - mid) * 4}deg)`, transformOrigin: "50% 140%", position: "relative", zIndex: i }}>
          <BourbonChip b={b} />
        </div>
      ))}
    </div>
  );
}

// Everything at the bottom of the play screen: the action pill (stage controls +
// fanned action cards live inside the existing controls) and the bourbon fan.
function PlayHandZone({ game, you, yourTurn, mode, setMode, dispatch }: { game: GameState; you: GameState["players"][number]; yourTurn: boolean; mode: Mode; setMode: (m: Mode) => void; dispatch: (a: Action) => void }) {
  // Both the commit and cull stages show the full-size action-card row, so give
  // them the taller/wider hand panel.
  const bigHand = yourTurn && (game.stage === "commit" || game.stage === "cull");
  return (
    <div style={{ position: "absolute", left: 172, right: 12, bottom: 0, height: bigHand ? 350 : 316, display: "flex", alignItems: "flex-end", gap: 18, padding: "0 14px 14px", zIndex: 4, pointerEvents: "none" }}>
      <div style={{ pointerEvents: "auto", flex: 1, minWidth: 0, maxWidth: bigHand ? 1120 : 720, background: "linear-gradient(#fdfcf7, #efe9dc)", borderRadius: 14, padding: 12, border: `1px solid ${T.border}`, boxShadow: "0 8px 26px #0006", maxHeight: bigHand ? 334 : 240, overflow: "hidden" }}>
        {!yourTurn ? (
          <div style={{ textAlign: "center", color: C.muted, fontSize: 15, padding: 20 }}>Rivals are acting…</div>
        ) : game.stage === "cull" ? (
          <CullControls you={you} dispatch={dispatch} />
        ) : game.stage === "commit" ? (
          <CommitControls you={you} dispatch={dispatch} />
        ) : (
          <ActControls game={game} you={you} mode={mode} setMode={setMode} dispatch={dispatch} />
        )}
      </div>
      <div style={{ pointerEvents: "auto", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
        <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: 1, color: "#5a4626", textTransform: "uppercase" }}>
          Your bourbons · {you.bourbons.filter((b) => b.state === "FRESH").length} fresh
        </span>
        <BourbonFan bourbons={you.bourbons} />
      </div>
    </div>
  );
}

function SetupPlaceControls({ you }: { you: GameState["players"][number] }) {
  return (
    <div>
      <RailLabel>Setup · Build the market</RailLabel>
      <p style={{ fontSize: 14, color: C.muted, margin: "0 0 4px", lineHeight: 1.5 }}>
        Your tiles are in the <B>glowing tray below the board</B>. Click one to lift it, then click a{" "}
        <B>glowing socket</B> to lay it (each tile must touch 2+ others).
      </p>
      <p style={{ fontSize: 13, color: T.faint, margin: 0 }}>
        <B>{you.setupTiles.length}</B> tile{you.setupTiles.length === 1 ? "" : "s"} left to place.
      </p>
    </div>
  );
}

function SetupDraftControls({ game, you }: { game: GameState; you: GameState["players"][number] }) {
  // count this player's remaining bourbon picks in the snake sequence
  const idx = game.players.indexOf(you);
  const remaining = game.setupDraftSeq.slice(game.turnPos).filter((i) => i === idx).length;
  return (
    <div>
      <RailLabel>Setup · Opening draft</RailLabel>
      <p style={{ fontSize: 14, color: C.muted, margin: "0 0 6px" }}>
        <B>Draft a bourbon</B> — click a market card. Premium bottles are held back until age 1. <B>{remaining}</B>{" "}
        pick{remaining === 1 ? "" : "s"} left.
      </p>
      <YourBourbons you={you} />
    </div>
  );
}

function SetupDPControls({ game, you }: { game: GameState; you: GameState["players"][number] }) {
  // count this player's remaining DP placements in the round-robin sequence
  const idx = game.players.indexOf(you);
  const remaining = game.setupDraftSeq.slice(game.turnPos).filter((i) => i === idx).length;
  return (
    <div>
      <RailLabel>Setup · Starting DPs</RailLabel>
      <p style={{ fontSize: 14, color: C.muted, margin: "0 0 6px" }}>
        <B>Plant a distribution point</B> — click any tile (anywhere, this is setup). <B>{remaining}</B> DP
        {remaining === 1 ? "" : "s"} left to place.
      </p>
      <YourBourbons you={you} />
    </div>
  );
}

// Age start: draw HAND_DRAW, keep HAND_SIZE. Pick one card to discard (click to
// select, then confirm) — the full-size row so you can read every card first.
function CullControls({ you, dispatch }: { you: GameState["players"][number]; dispatch: (a: Action) => void }) {
  const [pick, setPick] = useState<string | null>(null);
  const toDrop = you.hand.length - CONFIG.HAND_SIZE;
  return (
    <div>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: T.goldSoft }}>Your new hand — keep {CONFIG.HAND_SIZE}</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: T.muted }}>{pick ? "discard the marked card, or pick another" : `pick ${toDrop} card${toDrop === 1 ? "" : "s"} to discard`}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minHeight: 188 }}>
        {you.hand.map((c) => {
          const marked = pick === c.id;
          return (
            <div
              key={c.id}
              className="bb-play-card"
              style={{ position: "relative", borderRadius: 12, boxShadow: marked ? `0 0 0 3px ${T.red}, 0 6px 16px #0007` : "none", opacity: marked ? 0.85 : 1 }}
            >
              <HandCard card={c} selected={false} onClick={() => setPick((s) => (s === c.id ? null : c.id))} width={150} />
              {marked && (
                <div style={{ position: "absolute", top: 6, right: 6, fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 0.5, color: "#fff", background: T.red, borderRadius: 6, padding: "2px 6px", pointerEvents: "none" }}>
                  DISCARD
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
        <button
          disabled={!pick}
          onClick={() => { if (pick) { dispatch({ type: "CULL_CARD", cardId: pick }); setPick(null); } }}
          style={{ ...btn(T.red), opacity: pick ? 1 : 0.4 }}
        >
          Discard &amp; keep {CONFIG.HAND_SIZE}
        </button>
        <span style={{ fontFamily: SANS, fontSize: 10.5, color: T.faint }}>The discard goes back into the deck.</span>
      </div>
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
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontFamily: SERIF, fontSize: 15, fontWeight: 700, color: T.goldSoft }}>Your action cards</span>
        <span style={{ fontFamily: MONO, fontSize: 11, color: T.muted }}>{faceUp.length ? `${faceUp.length} up${chained ? ` · ${chained} sacrificed` : ""}` : "click a card to read it, then Play"}</span>
      </div>
      {/* the hand — full-size cards, spread so you can read every action before you commit */}
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minHeight: 188 }}>
        {you.hand.map((c) => {
          const idx = faceUp.indexOf(c.id);
          return (
            <div key={c.id} className="bb-play-card" style={{ position: "relative", zIndex: idx >= 0 ? 20 : 1 }}>
              <HandCard card={c} selected={idx >= 0} badge={idx >= 0 ? idx + 1 : undefined} onClick={() => toggle(c.id)} width={150} />
            </div>
          );
        })}
        {you.hand.length === 0 && <span style={{ fontSize: 13, color: T.faint, paddingBottom: 30 }}>hand empty — you sit this round out</span>}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
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
          Surrender
        </button>
        <span style={{ fontFamily: SANS, fontSize: 10.5, color: T.faint, lineHeight: 1.3 }}>1st = primary; extras chain (1 sacrifice each).</span>
      </div>
    </div>
  );
}

function ActControls({ game, you, mode, setMode, dispatch }: { game: GameState; you: GameState["players"][number]; mode: Mode; setMode: (m: Mode) => void; dispatch: (a: Action) => void }) {
  const allowed = new Set<ActionType>();
  for (const s of you.allowedSuits) for (const a of SUIT_ACTIONS[s]) allowed.add(a);
  const hasDarkDP = game.dps.some((d) => d.owner === you.id && d.state === "DARK");
  // Build + repair are one gesture: click a tile to place a DP, or a dead one to revive it.
  const tileModes: { t: Mode; label: string; enabled: boolean }[] = [
    { t: "BUILD_DP", label: hasDarkDP ? "Place / repair DP" : "Place DP", enabled: allowed.has("BUILD_DP") || allowed.has("REPAIR_DP") },
    { t: "PUSH", label: "Push", enabled: allowed.has("PUSH") },
    { t: "ADD_NICHE_FLAG", label: "Flag", enabled: allowed.has("ADD_NICHE_FLAG") },
    { t: "REMOVE_NICHE_FLAG", label: "Unflag", enabled: allowed.has("REMOVE_NICHE_FLAG") },
    { t: "CLAIM_SLOT", label: "Claim slot", enabled: allowed.has("BUILD_DP") },
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
        {tileModes.map(({ t, label, enabled }) => (
          <button
            key={label}
            disabled={!enabled}
            onClick={() => setMode(mode === t ? null : t)}
            style={{ ...btn(mode === t ? C.green : C.border), opacity: enabled ? 1 : 0.35 }}
          >
            {label}
          </button>
        ))}
        {allowed.has("REFRESH") && depleted && (
          <button onClick={() => dispatch({ type: "REFRESH", bourbonId: depleted.id })} style={btn(C.gold)}>
            Refresh {depleted.name}
          </button>
        )}
      </div>

      {mode && (
        <div style={{ fontSize: 12, color: C.green, fontFamily: MONO }}>
          ▸ {mode === "BUILD_DP"
            ? "click a tile to place a DP — or a tile with your dead DP to revive it"
            : `click a tile to ${mode.replace(/_/g, " ").toLowerCase()}`}
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
// Friendly labels for what a card can DO, and full suit names — for the card body.
const ACTION_LABEL: Record<string, string> = {
  BUILD_DP: "Build DP",
  REPAIR_DP: "Repair DP",
  PUSH: "Push a tile",
  ADD_NICHE_FLAG: "Flag niche",
  REMOVE_NICHE_FLAG: "Remove flag",
  EXPAND_MARKET: "Expand map",
  BID: "Bid bourbon",
  REFRESH: "Refresh bourbon",
};
const SUIT_FULL: Record<Suit, string> = {
  DISTRIBUTION: "Distribution",
  SALES: "Sales",
  MARKETING: "Marketing",
  BUSINESS_DEV: "Business Dev",
  SOURCING: "Sourcing",
  DISTILL: "Distill",
};
// One-line "rules text" describing what each suit's card does — like a game card.
const SUIT_TAGLINE: Record<Suit, string> = {
  DISTRIBUTION: "Grow & mend your distribution — build or repair DPs.",
  SALES: "Fight for a tile (Push) and stake or drop niche claims.",
  MARKETING: "Fight for a tile (Push) and stake or drop niche claims.",
  BUSINESS_DEV: "Push the frontier — draw/place tiles and build DPs.",
  SOURCING: "Stock the shelves — bid on bourbons and expand the map.",
  DISTILL: "Run the still — bid on bourbons and refresh depleted ones.",
};

function HandCard({ card, selected, badge, disabled, onClick, width = 158, compact = false }: { card: GameState["players"][number]["hand"][number]; selected?: boolean; badge?: number; disabled?: boolean; onClick: () => void; width?: number; compact?: boolean }) {
  const sc = SUIT_COLOR[card.suit];
  const caps = SUIT_ACTIONS[card.suit].map((a) => ACTION_LABEL[a] ?? a);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width,
        textAlign: "left",
        background: "linear-gradient(#fbf5e6, #efe4c9)",
        border: `2px solid ${selected ? T.gold : sc}`,
        borderRadius: 11,
        padding: 0,
        overflow: "hidden",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.5 : 1,
        boxShadow: selected ? `0 0 0 3px ${T.gold}, 0 6px 14px #0007` : "0 3px 9px #0006",
        transform: selected ? "translateY(-4px)" : "none",
        transition: "transform 120ms",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: `linear-gradient(${sc}, ${sc}d0)`, padding: "4px 9px" }}>
        <span style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, letterSpacing: 1, color: "#fff" }}>{SUIT_SHORT[card.suit]}</span>
          <span style={{ fontFamily: SERIF, fontSize: 9.5, color: "#ffffffcc" }}>{SUIT_FULL[card.suit]}</span>
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {card.icon && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }} title="Initiative — play last to lead next round">
              <BarrelIcon color="#fff" />
              <span style={{ fontFamily: MONO, fontSize: 7.5, fontWeight: 700, letterSpacing: 0.5, color: "#fff" }}>LEAD</span>
            </span>
          )}
          {badge != null && <span style={{ fontFamily: SERIF, fontSize: 12, fontWeight: 700, color: "#fff" }}>{badge}</span>}
        </span>
      </div>
      <div style={{ padding: compact ? "5px 8px 7px" : "6px 10px 8px" }}>
        <div style={{ fontFamily: SERIF, fontSize: compact ? 14 : 15.5, fontWeight: 700, color: T.ink, lineHeight: 1.06, minHeight: compact ? 30 : 27 }}>{card.name}</div>
        {/* actions this round */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: compact ? 4 : 5 }}>
          <span style={{ display: "flex", gap: 3 }}>
            {Array.from({ length: card.pips }).map((_, i) => (
              <span key={i} style={{ width: compact ? 8 : 10, height: compact ? 8 : 10, borderRadius: 2.5, background: sc, boxShadow: "inset 0 0 0 1.5px #ffffff99" }} />
            ))}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 10, fontWeight: 700, color: T.muted }}>{card.pips} actions</span>
        </div>
        {/* what you can do with them (full cards only — dense swap views stay compact) */}
        {!compact && (
          <>
            <div style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, letterSpacing: 0.8, color: sc, textTransform: "uppercase", marginTop: 6 }}>Actions available</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
              {caps.map((c) => (
                <span key={c} style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, color: sc, background: `${sc}1c`, border: `1px solid ${sc}44`, borderRadius: 999, padding: "1px 7px" }}>{c}</span>
              ))}
            </div>
            {/* rules text */}
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 10.5, color: T.muted, marginTop: 6, lineHeight: 1.26, borderTop: `1px solid ${T.line}`, paddingTop: 5 }}>
              {SUIT_TAGLINE[card.suit]}
            </div>
          </>
        )}
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
// A setup tile in the hand, rendered as the ACTUAL hex tile it will become on the
// board (extruded chip + reward ribbon + name + spec grid). The lifted/selected
// one rises with a gold glow.
function SetupTileCard({ tile, isNext }: { tile: GameState["players"][number]["setupTiles"][number]; isNext: boolean }) {
  const reward = tile.reward;
  const rc = reward ? rewardColor(reward) : null;
  const isWild = tile.category === "LOYALTY" || tile.category === "KEYSTONE";
  const nm = nameLines(tile.name);
  const S = 55;
  const w = S * 2, hgt = S * 2.3;
  const cx = w / 2, cy = S + 5;
  const corners = hexCorners(cx, cy, S);
  const faceFill = rc ? "#f5e7bb" : "#fbf9f1";
  return (
    <div style={{ position: "relative", transform: isNext ? "translateY(-12px)" : "none", transition: "transform 130ms", filter: isNext ? `drop-shadow(0 0 7px ${T.gold}bb)` : "none" }}>
      <svg width={w} height={hgt} style={{ overflow: "visible", display: "block" }}>
        <polygon points={hexPolygonPoints(cx, cy + THICK + 4, S)} fill="#2a1c0c" opacity={0.22} />
        {([[0, 1], [1, 2], [2, 3], [3, 4]] as [number, number][]).map(([a, b], i) => {
          const [ax, ay] = corners[a]!;
          const [bx, by] = corners[b]!;
          return <polygon key={i} points={`${ax},${ay} ${bx},${by} ${bx},${by + THICK} ${ax},${ay + THICK}`} fill={rc ? "#9a7420" : "#b09965"} />;
        })}
        <polygon points={hexPolygonPoints(cx, cy, S)} fill={faceFill} stroke={isNext ? T.gold : rc ? "#c69a2c" : "#a98f5f"} strokeWidth={isNext ? 3 : 2} />
        {reward && (
          <g transform={`translate(${cx} ${cy - S * 0.64})`}>
            <polygon points="-34,-8 34,-8 29,0 34,8 -34,8 -29,0" fill={darken(rc!, 0.52)} stroke={rc!} strokeWidth={1} />
            <text y={3} textAnchor="middle" fontFamily={MONO} fontWeight={700} fontSize={7.5} letterSpacing={0.3} fill="#ffe9c0">{rewardLabel(reward)}</text>
          </g>
        )}
        {isWild && <text x={cx} y={cy - S * 0.36} textAnchor="middle" fontFamily={MONO} fontSize={8} letterSpacing={1.2} fill={T.ink} opacity={0.6}>WILDCARD</text>}
        <text x={cx} y={cy - S * (reward || isWild ? 0.16 : 0.34)} textAnchor="middle" fontFamily={SERIF} fontWeight={700} fontSize={12.5} fill={T.ink} stroke="#fffdf5" strokeWidth={3} strokeLinejoin="round" style={{ paintOrder: "stroke" } as React.CSSProperties}>
          {nm.map((ln, i) => <tspan key={i} x={cx} dy={i === 0 ? 0 : 12}>{ln}</tspan>)}
        </text>
        <TagGridSVG tags={tile.tags} cx={cx} cy={cy + S * 0.24} cell={12} />
      </svg>
      {isNext && (
        <span style={{ position: "absolute", top: -14, left: "50%", transform: "translateX(-50%)", fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: 1, color: "#1c110a", background: T.gold, borderRadius: 999, padding: "1px 9px", boxShadow: "0 2px 4px #0005" }}>
          NEXT
        </span>
      )}
    </div>
  );
}

// A bourbon as a mini collector card (§3): grain-gradient art, charred-oak
// scrim, cream serif name, and the SHARED TagGrid so it reads slot-for-slot
// against tiles.
// The canonical collector-bottle card, used for BOTH the market "Up for Bid"
// shelf and the player's bourbon hand. Dark bottle, grain art + scrim, premium
// kicker, foil TagGrid, and a slot for a footer (state, or a bid line).
function BottleCard({ name, tags, compact = false, footer, footerBg, onClick, dim = false, selected = false }: { name: string; tags: readonly Tag[]; compact?: boolean; footer?: React.ReactNode; footerBg?: string; onClick?: () => void; dim?: boolean; selected?: boolean }) {
  const tint = grainTint(tags);
  const premium = tags.some((t) => t.kind === "QUALITY" && t.value === "PREMIUM");
  const ageTag = tags.find((t) => t.kind === "AGE");
  const grainVal = tags.find((t) => t.kind === "GRAIN")?.value;
  const batchVal = tags.find((t) => t.kind === "BATCH")?.value;
  const subtitle = [grainVal, batchVal].filter(Boolean).map((v) => String(v).replace(/_/g, " ")).join(" · ");
  const artH = compact ? 42 : 92;
  return (
    <div
      onClick={onClick}
      title={name}
      style={{
        width: compact ? 132 : 172,
        flex: "0 0 auto",
        borderRadius: compact ? 9 : 13,
        overflow: "hidden",
        border: `${compact ? 2 : 2.5}px solid ${dim ? "#00000055" : selected ? T.gold : premium ? T.gold : T.goldSoft}`,
        opacity: dim ? 0.6 : 1,
        filter: dim ? "grayscale(0.4)" : "none",
        boxShadow: selected ? `0 0 0 2px ${T.gold}, 0 7px 16px #0008` : `0 5px 14px #6b512e55`,
        background: "#1c110a",
        cursor: onClick ? "pointer" : "default",
      }}
    >
      <div style={{ position: "relative", height: artH, background: `linear-gradient(160deg, ${tint.a}, ${tint.b})` }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(22,13,5,0.96), rgba(22,13,5,0) 72%)" }} />
        <div style={{ position: "absolute", top: 5, left: 9, fontFamily: MONO, fontSize: compact ? 8 : 8.5, letterSpacing: 1.5, color: premium ? "#f0d38a" : "#d9c49c", textTransform: "uppercase" }}>{premium ? "★ Premium" : "Bourbon"}</div>
        {!compact && (
          <div style={{ position: "absolute", top: 6, right: 9, textAlign: "center", fontFamily: MONO, fontSize: 7.5, lineHeight: 1.15, color: "#cbb488", border: "1px solid #cbb48866", borderRadius: 3, padding: "2px 5px", transform: "rotate(4deg)" }}>
            {premium ? "RE-\nSERVE".split("\n").map((s, i) => <div key={i}>{s}</div>) : <><div>EST</div><div>1870</div></>}
          </div>
        )}
        {!compact && ageTag && (
          <div style={{ position: "absolute", bottom: 8, right: 9, width: 34, height: 34, borderRadius: "50%", background: "#241705", border: "1.5px solid #c9a24a", display: "grid", placeItems: "center", boxShadow: "0 2px 6px #0006" }}>
            <div style={{ textAlign: "center", lineHeight: 1 }}>
              <div style={{ fontFamily: SERIF, fontWeight: 800, fontSize: 15, color: "#f0d38a" }}>{ageTag.value}</div>
              <div style={{ fontFamily: MONO, fontSize: 5, letterSpacing: 1, color: "#c9b48e" }}>AGE</div>
            </div>
          </div>
        )}
        <div style={{ position: "absolute", left: 9, right: compact ? 9 : 46, bottom: compact ? 5 : 22, fontFamily: SERIF, fontWeight: 700, fontSize: compact ? 12.5 : 16, color: "#f4e8cf", lineHeight: 1.04 }}>{name}</div>
        {!compact && subtitle && <div style={{ position: "absolute", left: 9, bottom: 6, fontFamily: MONO, fontSize: 7.5, letterSpacing: 0.6, color: "#c6ad82", textTransform: "uppercase" }}>{subtitle}</div>}
      </div>
      <div style={{ background: "#1c110a", padding: compact ? "5px 0 4px" : "9px 0 7px", display: "grid", placeItems: "center" }}>
        <TagGridHTML tags={tags} cell={compact ? 13 : 21} />
      </div>
      {footer != null && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: footerBg ?? "#241705", padding: "4px 6px", minHeight: 18 }}>{footer}</div>
      )}
    </div>
  );
}

function BourbonChip({ b, compact = false }: { b: GameState["players"][number]["bourbons"][number]; compact?: boolean }) {
  const dep = b.state === "DEPLETED";
  return (
    <BottleCard
      name={b.name}
      tags={b.tags}
      compact={compact}
      dim={dep}
      footerBg={dep ? "#3a241a" : "#26401f"}
      footer={
        <>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: dep ? "#c07a4a" : "#8fc25a" }} />
          <span style={{ fontFamily: MONO, fontSize: 8.5, fontWeight: 700, letterSpacing: 1, color: dep ? "#e7bfa4" : "#c6e3a0" }}>{b.state}</span>
        </>
      }
    />
  );
}
