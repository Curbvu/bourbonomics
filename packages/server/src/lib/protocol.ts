/**
 * WebSocket wire protocol between client and server.
 *
 * Messages are JSON, framed by API Gateway. Both directions are
 * discriminated unions on `type` so adding a new message kind is a
 * one-line addition rather than a schema migration.
 */

import type { GameAction, GameState, NewGameConfig } from "@bourbonomics/engine";

// =============================================================================
// Client → Server
// =============================================================================

export type ClientMessage =
  | {
      /** Open a fresh room (host action). The server mints a 4-char
       *  code, runs `initializeGame`, and registers the caller as the
       *  first player. */
      type: "create-room";
      /** Display name for the host's seat. */
      name: string;
      /** Setup config — bot seats, seed, etc. Same shape the local
       *  store uses today. */
      config: NewGameConfig;
    }
  | {
      /** Join an existing room. */
      type: "join-room";
      code: string;
      name: string;
    }
  | {
      /** Dispatch a game action. The server validates + applies via
       *  the engine, persists, and broadcasts the new state to every
       *  connection in the room. */
      type: "action";
      action: GameAction;
    }
  | {
      /** Recover after a reconnect — server replies with the current
       *  state so the client can rehydrate without reapplying actions. */
      type: "resync";
    };

// =============================================================================
// Server → Client
// =============================================================================

export type ServerMessageOut =
  | {
      type: "joined";
      code: string;
      playerId: string;
      state: GameState;
      seq: number;
    }
  | {
      type: "state";
      state: GameState;
      seq: number;
    }
  | {
      type: "error";
      reason: string;
      /** When set, the client can retry the action; some errors are
       *  transient (e.g. a stale-state CAS race that we'll retry). */
      retriable?: boolean;
    }
  | {
      type: "ping";
    };

/**
 * Parse an incoming WebSocket frame; returns null on any decode error
 * so the handler can reject without throwing 500s.
 */
export function parseClientMessage(body: string | undefined): ClientMessage | null {
  if (!body) return null;
  try {
    const parsed = JSON.parse(body) as { type?: string };
    if (typeof parsed.type !== "string") return null;
    return parsed as ClientMessage;
  } catch {
    return null;
  }
}
