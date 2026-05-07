/**
 * `$connect` handler — fires when a client opens the WebSocket.
 *
 * We don't yet know which room they're joining (that comes via the
 * first message), so all we do here is record the bare connection so
 * `$disconnect` has something to clean up. The real wiring happens
 * inside `action.ts` when the client sends `create-room` / `join-room`.
 */

import type { WsHandler } from "../lib/lambda-types.js";
import { putConnection } from "../lib/rooms.js";

export const handler: WsHandler = async (event) => {
  const ctx = event.requestContext;
  await putConnection({
    connectionId: ctx.connectionId,
    // Empty roomCode until the client sends create-room / join-room.
    roomCode: "",
    joinedAt: Date.now(),
  });
  return { statusCode: 200, body: "" };
};
