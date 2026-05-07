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
  // Diagnostic — dev was returning 502 on $connect; this lets us
  // verify in CloudWatch that the Lambda is reaching its body and
  // finishing the DynamoDB write rather than crashing on cold-start.
  // eslint-disable-next-line no-console
  console.log("ws.connect", { connectionId: ctx.connectionId, route: ctx.routeKey });
  try {
    await putConnection({
      connectionId: ctx.connectionId,
      // Empty roomCode until the client sends create-room / join-room.
      roomCode: "",
      joinedAt: Date.now(),
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("ws.connect.failed", err instanceof Error ? err.message : err);
    // Returning a 500 here makes API Gateway reject the upgrade with
    // 502 to the client (current symptom). Returning 200 anyway lets
    // the connection open; the client will fail on first send if
    // DynamoDB is genuinely down, but at least the handshake works.
    return { statusCode: 200, body: "" };
  }
  return { statusCode: 200, body: "" };
};
