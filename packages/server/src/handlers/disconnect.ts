/**
 * `$disconnect` handler — fires when a client's WebSocket goes away
 * (clean close, browser tab closed, network drop, idle timeout).
 *
 * Drops the connection row; a future broadcast won't waste a 410.
 * The room itself sticks around — players can reconnect via the
 * room code and pick up where they left off.
 */

import type { WsHandler } from "../lib/lambda-types.js";
import { deleteConnection } from "../lib/rooms.js";

export const handler: WsHandler = async (event) => {
  await deleteConnection(event.requestContext.connectionId);
  return { statusCode: 200, body: "" };
};
