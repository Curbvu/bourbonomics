/**
 * API Gateway WebSocket broadcast helper.
 *
 * `PostToConnectionCommand` is the only way to push from a Lambda to
 * a connected client. Connections that have gone away (the client
 * dropped without firing $disconnect, the connection is older than
 * 2h, etc.) return a 410 Gone, which we silently swallow + clean up.
 */

import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
  GoneException,
} from "@aws-sdk/client-apigatewaymanagementapi";
import { Resource } from "sst";
import { deleteConnection, listRoomConnections } from "./rooms.js";
import type { ServerMessageOut } from "./protocol.js";

let _client: ApiGatewayManagementApiClient | null = null;
function client(): ApiGatewayManagementApiClient {
  if (_client) return _client;
  // The runtime endpoint takes the form
  //   https://<api-id>.execute-api.<region>.amazonaws.com/<stage>
  // SST exposes it as `Resource.GameWs.managementEndpoint`.
  _client = new ApiGatewayManagementApiClient({
    endpoint: Resource.GameWs.managementEndpoint,
  });
  return _client;
}

const enc = new TextEncoder();

function encode(msg: ServerMessageOut): Uint8Array {
  return enc.encode(JSON.stringify(msg));
}

/** Send a single message to one connection. Returns false if the
 *  connection has gone away (and cleans up the stale row). */
export async function sendToConnection(
  connectionId: string,
  msg: ServerMessageOut,
): Promise<boolean> {
  try {
    await client().send(
      new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: encode(msg),
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof GoneException) {
      await deleteConnection(connectionId);
      return false;
    }
    throw err;
  }
}

/**
 * Broadcast a message to every connection currently bound to `code`.
 * Stale connections (410 Gone) are dropped from the table as a
 * side-effect.
 */
export async function broadcastToRoom(
  code: string,
  msg: ServerMessageOut,
): Promise<void> {
  const conns = await listRoomConnections(code);
  await Promise.all(
    conns.map((c) =>
      sendToConnection(c.connectionId, msg).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`broadcast to ${c.connectionId} failed`, err);
      }),
    ),
  );
}
