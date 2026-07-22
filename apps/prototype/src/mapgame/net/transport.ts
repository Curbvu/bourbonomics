"use client";

// Bourbonomics: Map Game — browser WebSocket transport for online play.
//
// A thin wrapper over a single WebSocket to the room server (src/server/rooms.ts).
// Messages are line-delimited JSON of the shared protocol. Queues sends made
// before the socket opens; surfaces open/closed status for the lobby UI. When
// NEXT_PUBLIC_WS_URL is unset the app runs local-only and never constructs one.

import type { ClientMessage, ServerMessage } from "./protocol";

export type ConnStatus = "connecting" | "open" | "closed";

export class RoomConnection {
  private ws: WebSocket | null = null;
  private readonly url: string;
  private queue: ClientMessage[] = [];
  private closed = false;

  onMessage: (m: ServerMessage) => void = () => {};
  onStatus: (s: ConnStatus) => void = () => {};

  constructor(url: string) {
    this.url = url;
  }

  connect(): void {
    if (this.ws || this.closed) return;
    this.onStatus("connecting");
    const ws = new WebSocket(this.url);
    this.ws = ws;
    ws.onopen = () => {
      this.onStatus("open");
      for (const m of this.queue) ws.send(JSON.stringify(m));
      this.queue = [];
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(String(e.data)) as ServerMessage);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => this.onStatus("closed");
    ws.onerror = () => {};
  }

  send(m: ClientMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else this.queue.push(m);
  }

  close(): void {
    this.closed = true;
    this.ws?.close();
    this.ws = null;
  }
}

/** Configured at build time by SST (see sst.config.ts). Empty → local only. */
export const WS_URL: string = process.env.NEXT_PUBLIC_WS_URL ?? "";
export const ONLINE_ENABLED: boolean = WS_URL.length > 0;
