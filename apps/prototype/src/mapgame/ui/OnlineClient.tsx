"use client";

// Bourbonomics: Map Game — online (WebSocket) client: lobby + live table.
//
// The server owns the game; this component only sends the local player's actions
// and renders the authoritative GameState it pushes back. It reuses the exact
// same <Board> as local play, with youId bound to this client's seat. When the
// server isn't configured (NEXT_PUBLIC_WS_URL unset) it shows a friendly notice.

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ScalingHost from "../../app/components/ScalingHost";
import type { Action, GameState } from "../engine";
import type { RoomView, ServerMessage } from "../net/protocol";
import { ONLINE_ENABLED, RoomConnection, WS_URL, type ConnStatus } from "../net/transport";
import { MONO, SERIF, T } from "./theme";
import { Board } from "./MapGameClient";
import Manual from "./Manual";

export default function OnlineClient() {
  const [status, setStatus] = useState<ConnStatus>("connecting");
  const [room, setRoom] = useState<RoomView | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const connRef = useRef<RoomConnection | null>(null);

  useEffect(() => {
    if (!ONLINE_ENABLED) return;
    const conn = new RoomConnection(WS_URL);
    connRef.current = conn;
    conn.onStatus = setStatus;
    conn.onMessage = (m: ServerMessage) => {
      if (m.t === "error") setNotice(m.reason);
      else if (m.t === "room") {
        setRoom(m.room);
        setGame(null);
      } else if (m.t === "state") {
        setRoom(m.room);
        setGame(m.game);
      }
    };
    conn.connect();
    return () => conn.close();
  }, []);

  if (!ONLINE_ENABLED) return <NotConfigured />;

  // In a live game → the shared Board, bound to our seat.
  if (room && game && room.status !== "lobby") {
    const youId = `p${room.yourSeat}`;
    const send = (action: Action): string | null => {
      connRef.current?.send({ t: "action", code: room.code, action });
      return null; // authoritative result arrives via a pushed "state" message
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: T.oak }}>
        <ScalingHost>
          <Board
            game={game}
            youId={youId}
            onAction={send}
            notice={notice}
            onNew={() => {
              connRef.current?.send({ t: "leave", code: room.code });
              setGame(null);
              setRoom(null);
            }}
            onManual={() => setManual(true)}
          />
        </ScalingHost>
        {manual && <Manual onClose={() => setManual(false)} />}
      </div>
    );
  }

  return (
    <Lobby
      status={status}
      room={room}
      notice={notice}
      onCreate={(name) => connRef.current?.send({ t: "create", name })}
      onJoin={(code, name) => connRef.current?.send({ t: "join", code, name })}
      onAddBot={() => room && connRef.current?.send({ t: "addBot", code: room.code })}
      onRemove={(seat) => room && connRef.current?.send({ t: "removeSeat", code: room.code, seat })}
      onStart={() => room && connRef.current?.send({ t: "start", code: room.code })}
    />
  );
}

// ── Lobby ────────────────────────────────────────────────────────────
function Lobby({
  status,
  room,
  notice,
  onCreate,
  onJoin,
  onAddBot,
  onRemove,
  onStart,
}: {
  status: ConnStatus;
  room: RoomView | null;
  notice: string | null;
  onCreate: (name: string) => void;
  onJoin: (code: string, name: string) => void;
  onAddBot: () => void;
  onRemove: (seat: number) => void;
  onStart: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const isHost = room != null && room.yourSeat === room.hostSeat;
  const canStart = isHost && (room?.seats.length ?? 0) >= 2;

  return (
    <Shell>
      <div style={{ fontFamily: MONO, fontSize: 13, letterSpacing: 6, color: T.goldSoft, textTransform: "uppercase" }}>
        Online table {status !== "open" && `· ${status}`}
      </div>
      <h1 style={{ fontFamily: SERIF, fontSize: 56, fontWeight: 800, color: T.gold, margin: "6px 0 20px", textShadow: "0 3px 16px #0009" }}>
        Play Together
      </h1>

      {notice && (
        <div style={{ background: "#5a2a2a", color: "#ffd9d0", borderRadius: 10, padding: "10px 16px", marginBottom: 16, fontFamily: MONO, fontSize: 13 }}>
          {notice}
        </div>
      )}

      {!room ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, width: 380 }}>
          <input
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={inputStyle}
            maxLength={20}
          />
          <button onClick={() => onCreate(name || "Player")} disabled={status !== "open"} style={primaryBtn}>
            Create a table →
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 10, color: T.faint, fontFamily: MONO, fontSize: 12 }}>
            <span style={{ flex: 1, height: 1, background: T.line }} /> OR <span style={{ flex: 1, height: 1, background: T.line }} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              placeholder="CODE"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              style={{ ...inputStyle, flex: 1, textTransform: "uppercase", letterSpacing: 4, fontFamily: MONO }}
              maxLength={6}
            />
            <button onClick={() => onJoin(code, name || "Player")} disabled={status !== "open" || code.length < 4} style={ghostBtn}>
              Join
            </button>
          </div>
        </div>
      ) : (
        <div style={{ width: 460 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
            <span style={{ fontFamily: SERIF, fontSize: 20, color: T.cream }}>Table code</span>
            <span style={{ fontFamily: MONO, fontSize: 40, fontWeight: 800, letterSpacing: 10, color: T.gold }}>{room.code}</span>
          </div>
          <p style={{ color: T.muted, fontSize: 14, marginTop: 0 }}>Share the code. Seats fill as players join; the host can add bots.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, margin: "16px 0" }}>
            {room.seats.map((s) => (
              <div key={s.index} style={{ display: "flex", alignItems: "center", gap: 12, background: T.panel, border: `1px solid ${T.border}`, borderRadius: 10, padding: "10px 14px" }}>
                <span style={{ width: 22, height: 22, borderRadius: "50%", background: PLAYER_DOT[s.index % PLAYER_DOT.length], flexShrink: 0 }} />
                <span style={{ fontFamily: SERIF, fontSize: 17, color: T.cream, flex: 1 }}>
                  {s.name} {s.index === room.hostSeat && <em style={{ color: T.goldSoft, fontSize: 12 }}>host</em>}
                  {s.index === room.yourSeat && <em style={{ color: T.gold, fontSize: 12 }}> · you</em>}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: s.isBot ? T.faint : s.connected ? "#7a8c3a" : "#a05a2e" }}>
                  {s.isBot ? "BOT" : s.connected ? "READY" : "AWAY"}
                </span>
                {isHost && s.isBot && (
                  <button onClick={() => onRemove(s.index)} style={{ ...ghostBtn, padding: "2px 8px", fontSize: 12 }}>✕</button>
                )}
              </div>
            ))}
          </div>
          {isHost ? (
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onAddBot} disabled={room.seats.length >= 5} style={ghostBtn}>+ Add bot</button>
              <button onClick={onStart} disabled={!canStart} style={{ ...primaryBtn, flex: 1 }}>
                Start game →
              </button>
            </div>
          ) : (
            <div style={{ color: T.muted, fontFamily: MONO, fontSize: 13, textAlign: "center", padding: 8 }}>
              Waiting for the host to start…
            </div>
          )}
        </div>
      )}

      <Link href="/" style={{ marginTop: 30, color: T.faint, fontFamily: MONO, fontSize: 12, textDecoration: "none" }}>
        ← back to menu
      </Link>
    </Shell>
  );
}

function NotConfigured() {
  return (
    <Shell>
      <h1 style={{ fontFamily: SERIF, fontSize: 44, fontWeight: 800, color: T.gold }}>Online isn&apos;t live yet</h1>
      <p style={{ color: T.muted, maxWidth: 460, textAlign: "center", lineHeight: 1.6 }}>
        The multiplayer server hasn&apos;t been deployed for this build. Deploy with the WebSocket stack enabled
        (<code style={{ fontFamily: MONO, color: T.cream }}>ENABLE_MULTIPLAYER=true</code>), which sets{" "}
        <code style={{ fontFamily: MONO, color: T.cream }}>NEXT_PUBLIC_WS_URL</code>. Meanwhile, pass-and-play works
        offline.
      </p>
      <Link href="/mapgame" style={primaryLink}>Play locally →</Link>
      <Link href="/" style={{ marginTop: 18, color: T.faint, fontFamily: MONO, fontSize: 12, textDecoration: "none" }}>← back to menu</Link>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: `radial-gradient(120% 100% at 50% 20%, #2a2016, ${T.oak} 60%, ${T.feltDeep})`,
        color: T.cream,
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 20px",
      }}
    >
      {children}
    </main>
  );
}

const PLAYER_DOT = ["#e8b84a", "#c8552e", "#4a8a72", "#4a6ea8", "#9a5aa0"];
const inputStyle: React.CSSProperties = {
  fontFamily: "inherit",
  fontSize: 16,
  padding: "12px 16px",
  borderRadius: 10,
  border: `1px solid ${T.border}`,
  background: T.panel,
  color: T.cream,
  outline: "none",
};
const primaryBtn: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: 20,
  fontWeight: 700,
  padding: "14px 22px",
  borderRadius: 12,
  border: `1px solid ${T.gold}`,
  background: `linear-gradient(#c8961f, #8f6510)`,
  color: "#1c110a",
  cursor: "pointer",
};
const ghostBtn: React.CSSProperties = {
  fontFamily: SERIF,
  fontSize: 16,
  fontWeight: 600,
  padding: "12px 18px",
  borderRadius: 12,
  border: `1px solid ${T.gold}`,
  background: "transparent",
  color: T.gold,
  cursor: "pointer",
};
const primaryLink: React.CSSProperties = { ...primaryBtn, marginTop: 24, textDecoration: "none", display: "inline-block" };
