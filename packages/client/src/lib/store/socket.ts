"use client";

/**
 * WebSocket client for the multi-player server.
 *
 * Talks to the API Gateway WebSocket exposed at
 * `NEXT_PUBLIC_GAME_WS_URL`. Messages on the wire match
 * `packages/server/src/lib/protocol.ts` — keep both shapes in sync
 * when extending.
 *
 * Lifecycle:
 *
 *   1. `connect()` opens the socket. Pending sends queue up until the
 *      connection is OPEN.
 *   2. `send(msg)` ships a `ClientMessage`; serializes once and either
 *      writes immediately or queues.
 *   3. The socket auto-reconnects on close (3s backoff capped at 30s).
 *      A `resync` message fires on every successful reopen so the
 *      server resends current state without losing turn order.
 *
 * The socket exposes a tiny pub/sub: `subscribe(handler)` returns an
 * unsubscribe function. Everything React-flavored lives in the
 * matching `useGameSocket` hook (a future commit) — this module is
 * deliberately framework-free so a vanilla page can use it too.
 */

import type {
  GameAction,
  GameState,
  NewGameConfig,
} from "@bourbonomics/engine";

// =============================================================================
// Wire format — mirror of `packages/server/src/lib/protocol.ts`. Keep
// these aligned by hand; they're tiny and rarely change.
// =============================================================================

export type ClientMessage =
  | { type: "create-room"; name: string; config: NewGameConfig }
  | { type: "join-room"; code: string; name: string }
  | { type: "action"; action: GameAction }
  | { type: "resync" };

export type ServerMessage =
  | {
      type: "joined";
      code: string;
      playerId: string;
      state: GameState;
      seq: number;
    }
  | { type: "state"; state: GameState; seq: number; action?: GameAction }
  | { type: "error"; reason: string; retriable?: boolean }
  | { type: "ping" };

// =============================================================================
// Connection state
// =============================================================================

export type SocketStatus = "idle" | "connecting" | "open" | "closed" | "error";

export type SocketEvent =
  | { kind: "status"; status: SocketStatus }
  | { kind: "message"; message: ServerMessage };

type Handler = (event: SocketEvent) => void;

const RECONNECT_BASE_MS = 1500;
const RECONNECT_MAX_MS = 30_000;

class GameSocket {
  private ws: WebSocket | null = null;
  private handlers = new Set<Handler>();
  private queue: string[] = [];
  private url: string | null = null;
  private explicitClose = false;
  private reconnectAttempt = 0;
  private status: SocketStatus = "idle";

  /**
   * Open the socket. No-op if already connecting / open. Pass the
   * full WebSocket URL (the SST-injected `NEXT_PUBLIC_GAME_WS_URL`).
   */
  connect(url: string): void {
    if (this.ws && (this.status === "open" || this.status === "connecting")) {
      return;
    }
    this.url = url;
    this.explicitClose = false;
    this.openSocket();
  }

  private openSocket(): void {
    if (!this.url) return;
    this.setStatus("connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.addEventListener("open", () => {
      this.reconnectAttempt = 0;
      this.setStatus("open");
      // Drain any messages queued while we were dialing.
      for (const frame of this.queue) ws.send(frame);
      this.queue = [];
    });
    ws.addEventListener("message", (e) => {
      let parsed: ServerMessage;
      try {
        parsed = JSON.parse(typeof e.data === "string" ? e.data : "") as ServerMessage;
      } catch {
        return;
      }
      this.emit({ kind: "message", message: parsed });
    });
    ws.addEventListener("close", () => {
      this.ws = null;
      this.setStatus("closed");
      if (!this.explicitClose) this.scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      this.setStatus("error");
    });
  }

  /**
   * Send a `ClientMessage`. Queued and flushed on connect if the
   * socket isn't OPEN yet, so callers can fire-and-forget.
   */
  send(msg: ClientMessage): void {
    const frame = JSON.stringify(msg);
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(frame);
    } else {
      this.queue.push(frame);
    }
  }

  /** Tear down the socket and stop reconnecting. */
  close(): void {
    this.explicitClose = true;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.queue = [];
    this.setStatus("idle");
  }

  /** Pub/sub. Returns the unsubscribe handle. */
  subscribe(handler: Handler): () => void {
    this.handlers.add(handler);
    // Replay current status so late subscribers don't miss the
    // already-OPEN signal.
    handler({ kind: "status", status: this.status });
    return () => this.handlers.delete(handler);
  }

  getStatus(): SocketStatus {
    return this.status;
  }

  // ---------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------

  private setStatus(next: SocketStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.emit({ kind: "status", status: next });
  }

  private emit(event: SocketEvent): void {
    for (const h of this.handlers) h(event);
  }

  private scheduleReconnect(): void {
    if (this.explicitClose || !this.url) return;
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * Math.pow(2, this.reconnectAttempt),
    );
    this.reconnectAttempt += 1;
    setTimeout(() => {
      if (this.explicitClose) return;
      this.openSocket();
      // After a clean reopen, ask the server to resend current state
      // so we don't drift if we missed broadcasts during the outage.
      this.send({ type: "resync" });
    }, delay);
  }
}

// Singleton — one socket per tab is plenty.
let _socket: GameSocket | null = null;
export function gameSocket(): GameSocket {
  if (!_socket) _socket = new GameSocket();
  return _socket;
}

/**
 * Helper — read the SST-injected WebSocket URL. Returns null in dev
 * if the env var isn't set so callers can fall back to single-player
 * cleanly without crashing.
 */
export function gameSocketUrl(): string | null {
  const url = process.env.NEXT_PUBLIC_GAME_WS_URL;
  return url && url.length > 0 ? url : null;
}
