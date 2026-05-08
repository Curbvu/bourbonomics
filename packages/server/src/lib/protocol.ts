/**
 * WebSocket wire protocol between client and server.
 *
 * Messages are JSON, framed by API Gateway. Both directions are
 * discriminated unions on `type` so adding a new message kind is a
 * one-line addition rather than a schema migration.
 */

import type {
  GameAction,
  GameState,
  NewMultiplayerGameConfig,
} from "@bourbonomics/engine";

// =============================================================================
// Client → Server
// =============================================================================

export type ClientMessage =
  | {
      /** Open a fresh room (host action). The server mints a 4-char
       *  code, runs `initializeGame` with the requested seat layout
       *  (host + extra humans + bots), and registers the caller as
       *  the host (seat 0). */
      type: "create-room";
      config: NewMultiplayerGameConfig;
    }
  | {
      /** Join an existing room as an observer. The joiner doesn't
       *  control any seat until they `claim-seat`. */
      type: "join-room";
      code: string;
      name: string;
    }
  | {
      /** Claim an open human seat in the current room. Server
       *  rejects if the seat is already claimed, is a bot seat, or
       *  doesn't exist. */
      type: "claim-seat";
      playerId: string;
    }
  | {
      /** Release whatever seat this connection currently owns —
       *  the seat opens back up for others to claim. The connection
       *  itself stays in the room as an observer. */
      type: "release-seat";
    }
  | {
      /** Host-only — flip the room out of pre-game lobby into live
       *  play. While `started: false` the server rejects every
       *  `action` message, so bots and humans alike sit idle until
       *  the host hits start. */
      type: "start-game";
    }
  | {
      /** Dispatch a game action. The server validates that the
       *  caller's claimed seat matches `action.playerId`, applies
       *  via the engine, persists, and broadcasts. */
      type: "action";
      action: GameAction;
    }
  | {
      /** Recover after a reconnect — server replies with the current
       *  state so the client can rehydrate without reapplying actions. */
      type: "resync";
    };

/**
 * Per-seat metadata sent on every broadcast so the client UI can
 * show "Seat 1: Alice (you), Seat 2: open, Seat 3: Bot". The engine
 * doesn't track who claimed what; the server overlays that.
 */
export interface SeatInfo {
  playerId: string;
  name: string;
  isBot: boolean;
  /** Display name of the connection currently controlling this
   *  seat, or null when the seat is open. Bot seats are auto-played
   *  by the server tick — `claimedBy` for a bot stays null. */
  claimedBy: string | null;
}

// =============================================================================
// Server → Client
// =============================================================================

export type ServerMessageOut =
  | {
      type: "joined";
      code: string;
      /** The seat this connection now owns ("" if the joiner is an
       *  observer until they `claim-seat`). */
      playerId: string;
      state: GameState;
      seq: number;
      roster: SeatInfo[];
      /** Whether the host has flipped the lobby into live play. */
      started: boolean;
      /** Convention: `human0` is always the host (seat 0). Surfaced
       *  here so the client can gate the start button. */
      hostPlayerId: string;
    }
  | {
      type: "state";
      state: GameState;
      seq: number;
      /** The action that produced this state, when known. Optional
       *  because bot-tick broadcasts may collapse several actions
       *  into one frame. The client uses this to drive animation
       *  snapshots (lastSale / lastMake / lastPurchase). */
      action?: GameAction;
      /** Roster snapshot when seat assignments changed (claim /
       *  release). Omitted on plain action broadcasts to keep the
       *  frame small. */
      roster?: SeatInfo[];
      /** Sent on the `start-game` broadcast (and any other lifecycle
       *  flip). Omitted on plain action broadcasts. */
      started?: boolean;
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
