// Bourbonomics: Map Game — the client ⇄ server wire protocol (online play).
//
// Shared by the browser transport (net/transport.ts) and the WebSocket Lambda
// (src/server/rooms.ts). Keep it a pure type module — no imports with runtime
// side effects — so both a DOM client and a Node Lambda can import it.

import type { Action, GameState } from "../engine/types";

/** A seat at a table: a human connection or a bot the host added. */
export interface Seat {
  index: number; // 0-based; maps to GameState.players[index]
  name: string;
  isBot: boolean;
  connected: boolean;
}

/** Public lobby / table view broadcast to everyone in a room. */
export interface RoomView {
  code: string;
  hostSeat: number;
  seats: Seat[];
  status: "lobby" | "playing" | "ended";
  yourSeat: number; // the receiving client's own seat index (−1 if spectator)
}

// ── Client → server ──────────────────────────────────────────────────
export type ClientMessage =
  | { t: "create"; name: string }
  | { t: "join"; code: string; name: string }
  | { t: "addBot"; code: string }
  | { t: "removeSeat"; code: string; seat: number }
  | { t: "start"; code: string; seed?: number }
  | { t: "action"; code: string; action: Action }
  | { t: "leave"; code: string };

// ── Server → client ──────────────────────────────────────────────────
export type ServerMessage =
  | { t: "room"; room: RoomView } // lobby changed (join/leave/bot)
  | { t: "state"; room: RoomView; game: GameState } // authoritative game state
  | { t: "error"; reason: string };

export const ROOM_CODE_LEN = 4;
export const MAX_SEATS = 5;
export const MIN_SEATS = 2;
