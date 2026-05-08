/**
 * Persistence layer for the multi-player game server.
 *
 * Two DynamoDB tables (created by SST in `sst.config.ts`):
 *
 *   - **Rooms** — keyed by 4-char `code`. Stores the full serialized
 *     `GameState`, a monotonic sequence number for optimistic locking,
 *     and a TTL field so abandoned games clean themselves up after
 *     two weeks. The state is JSON-stringified because DynamoDB's
 *     attribute types don't model the engine's discriminated unions
 *     well — round-tripping through JSON keeps things lossless.
 *
 *   - **Connections** — one row per live WebSocket connection. The
 *     `roomCode` GSI lets the broadcast helper iterate every
 *     connection bound to a given room without scanning the table.
 *
 * SST resource-links inject the resolved table names via `Resource`,
 * so we never hard-code names — `sst dev` and a deployed Lambda see
 * the right tables regardless of stage.
 */

import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";
import type { GameState } from "@bourbonomics/engine";

// `removeUndefinedValues: true` lets us pass records with optional
// fields straight through (e.g. an observer connection has `playerId:
// undefined` until they `claim-seat`). Without this DDB rejects the
// PutCommand and the upgrade handshake bubbles up as "create-room"
// hanging in the lobby.
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
  marshallOptions: { removeUndefinedValues: true },
});

// Rooms expire 14 days after their last write; the field is updated on
// every action so any active play extends the lifetime.
const ROOM_TTL_SECONDS = 60 * 60 * 24 * 14;

export interface RoomRecord {
  code: string;
  state: GameState;
  /** Monotonic counter — every successful action bumps this. Lets us
   *  reject stale-state writes if two clients race. */
  seq: number;
  /** Unix-seconds DynamoDB TTL — automatically purged when reached. */
  expiresAt: number;
  /** When `false`/missing the room is in pre-game lobby — actions
   *  and bot ticks are gated. Flipped to `true` by the `start-game`
   *  message (host only). */
  started?: boolean;
  /** When the host hit start; useful for "started 14m ago" UI. */
  startedAt?: number;
  /** Seat-claim ledger: `playerId → display name`. A seat in this
   *  map is owned by a connected human (the connection record holds
   *  the actual `connectionId` mapping). Bot seats and unclaimed
   *  human seats stay out of the map. */
  seatClaims?: Record<string, string>;
}

export interface ConnectionRecord {
  connectionId: string;
  roomCode: string;
  /** Which seat in the room this socket is bound to. Empty until the
   *  player picks a seat (or claims an existing reserved seat by name). */
  playerId?: string;
  /** Display handle. The server uses this when filling a fresh room. */
  name?: string;
  joinedAt: number;
  expiresAt: number;
}

function ttl(): number {
  return Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS;
}

// =============================================================================
// Rooms
// =============================================================================

export async function getRoom(code: string): Promise<RoomRecord | null> {
  // ConsistentRead so a Lambda that reads right after another Lambda
  // wrote (e.g. action handler reading after start-game set started=
  // true) doesn't get a stale view. The default eventually-consistent
  // read can lag a write by hundreds of milliseconds — long enough for
  // the host to click Pass and hit a phantom "game-not-started" reject.
  const r = await ddb.send(
    new GetCommand({
      TableName: Resource.Rooms.name,
      Key: { code },
      ConsistentRead: true,
    }),
  );
  return (r.Item as RoomRecord | undefined) ?? null;
}

export async function putRoom(room: RoomRecord): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: Resource.Rooms.name,
      Item: { ...room, expiresAt: ttl() },
    }),
  );
}

/**
 * Update a room's state with a compare-and-set on `seq`. Throws when
 * another writer beat us to it; callers should re-read and retry.
 */
export async function updateRoomState(
  code: string,
  expectedSeq: number,
  next: GameState,
): Promise<RoomRecord> {
  const newSeq = expectedSeq + 1;
  const expires = ttl();
  await ddb.send(
    new UpdateCommand({
      TableName: Resource.Rooms.name,
      Key: { code },
      UpdateExpression: "SET #s = :ns, #st = :st, expiresAt = :ex",
      ConditionExpression: "#s = :es",
      ExpressionAttributeNames: { "#s": "seq", "#st": "state" },
      ExpressionAttributeValues: {
        ":es": expectedSeq,
        ":ns": newSeq,
        ":st": next,
        ":ex": expires,
      },
    }),
  );
  return { code, state: next, seq: newSeq, expiresAt: expires };
}

export async function deleteRoom(code: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: Resource.Rooms.name,
      Key: { code },
    }),
  );
}

/**
 * Idempotently claim a seat. Returns the resulting `seatClaims`
 * map. Throws when the seat is already claimed by someone else
 * (caller shows the joiner a friendly error).
 */
export async function claimSeat(
  code: string,
  playerId: string,
  displayName: string,
): Promise<Record<string, string>> {
  const room = await getRoom(code);
  if (!room) throw new Error("room-not-found");
  const claims = { ...(room.seatClaims ?? {}) };
  const existing = claims[playerId];
  if (existing && existing !== displayName) {
    throw new Error("seat-already-claimed");
  }
  claims[playerId] = displayName;
  await ddb.send(
    new UpdateCommand({
      TableName: Resource.Rooms.name,
      Key: { code },
      UpdateExpression: "SET seatClaims = :c, expiresAt = :e",
      ExpressionAttributeValues: {
        ":c": claims,
        ":e": Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
      },
    }),
  );
  return claims;
}

/**
 * Flip a room out of pre-game lobby into live play. Idempotent:
 * calling on an already-started room is a no-op (the host can't
 * undo a start, but they can hit it twice without breaking).
 */
export async function startGame(code: string): Promise<void> {
  await ddb.send(
    new UpdateCommand({
      TableName: Resource.Rooms.name,
      Key: { code },
      UpdateExpression: "SET started = :s, startedAt = :a, expiresAt = :e",
      ExpressionAttributeValues: {
        ":s": true,
        ":a": Date.now(),
        ":e": Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
      },
    }),
  );
}

/**
 * Drop a player's claim on a seat. Returns the resulting `seatClaims`
 * map (with `playerId` removed). No-op if the seat wasn't claimed.
 */
export async function releaseSeat(
  code: string,
  playerId: string,
): Promise<Record<string, string>> {
  const room = await getRoom(code);
  if (!room) throw new Error("room-not-found");
  const claims = { ...(room.seatClaims ?? {}) };
  delete claims[playerId];
  await ddb.send(
    new UpdateCommand({
      TableName: Resource.Rooms.name,
      Key: { code },
      UpdateExpression: "SET seatClaims = :c, expiresAt = :e",
      ExpressionAttributeValues: {
        ":c": claims,
        ":e": Math.floor(Date.now() / 1000) + ROOM_TTL_SECONDS,
      },
    }),
  );
  return claims;
}

// =============================================================================
// Connections
// =============================================================================

export async function putConnection(record: Omit<ConnectionRecord, "expiresAt">): Promise<void> {
  await ddb.send(
    new PutCommand({
      TableName: Resource.Connections.name,
      Item: { ...record, expiresAt: ttl() },
    }),
  );
}

export async function getConnection(connectionId: string): Promise<ConnectionRecord | null> {
  const r = await ddb.send(
    new GetCommand({
      TableName: Resource.Connections.name,
      Key: { connectionId },
    }),
  );
  return (r.Item as ConnectionRecord | undefined) ?? null;
}

export async function deleteConnection(connectionId: string): Promise<void> {
  await ddb.send(
    new DeleteCommand({
      TableName: Resource.Connections.name,
      Key: { connectionId },
    }),
  );
}

/**
 * Every live connection bound to `code`. Used by the broadcast helper
 * to fan out a state update to all sockets in the room.
 */
export async function listRoomConnections(code: string): Promise<ConnectionRecord[]> {
  const r = await ddb.send(
    new QueryCommand({
      TableName: Resource.Connections.name,
      IndexName: "ByRoom",
      KeyConditionExpression: "roomCode = :c",
      ExpressionAttributeValues: { ":c": code },
    }),
  );
  return (r.Items ?? []) as ConnectionRecord[];
}
