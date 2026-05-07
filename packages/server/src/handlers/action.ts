/**
 * `$default` route handler — the heart of the multi-player server.
 *
 * Every client message lands here:
 *
 *   - `create-room` mints a 4-char code, runs `initializeGame`, and
 *     replies with `joined` (and broadcasts the initial state to the
 *     creator's connection).
 *   - `join-room` looks up the room and sends the current state to
 *     the joiner without disturbing other players.
 *   - `action` validates + applies a `GameAction` against the room's
 *     state and broadcasts the new state to every connection.
 *   - `resync` re-sends the current state to the caller (used after
 *     a reconnect).
 *
 * The engine is the same code that runs in the browser — by importing
 * `@bourbonomics/engine` directly, the server is guaranteed to validate
 * actions identically to the client's optimistic-validation hints.
 */

import {
  applyAction,
  buildVanillaDistilleryFor,
  defaultMashBillCatalog,
  DISTILLERIES_ENABLED,
  initializeGame,
  validateAction,
  type GameAction,
  type GameState,
  type NewGameConfig,
} from "@bourbonomics/engine";

import { broadcastToRoom, sendToConnection } from "../lib/broadcast.js";
import type { WsHandler } from "../lib/lambda-types.js";
import { parseClientMessage, type ClientMessage } from "../lib/protocol.js";
import {
  getConnection,
  getRoom,
  putConnection,
  putRoom,
  updateRoomState,
  type RoomRecord,
} from "../lib/rooms.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // dropped 0/O/1/I

function mintRoomCode(): string {
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(Math.random() * ROOM_CODE_ALPHABET.length)];
  }
  return code;
}

export const handler: WsHandler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const msg = parseClientMessage(event.body);
  if (!msg) {
    await sendToConnection(connectionId, { type: "error", reason: "bad-frame" });
    return { statusCode: 400, body: "" };
  }

  try {
    switch (msg.type) {
      case "create-room":
        await handleCreateRoom(connectionId, msg);
        break;
      case "join-room":
        await handleJoinRoom(connectionId, msg);
        break;
      case "action":
        await handleAction(connectionId, msg.action);
        break;
      case "resync":
        await handleResync(connectionId);
        break;
      default:
        await sendToConnection(connectionId, {
          type: "error",
          reason: "unknown-message-type",
        });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("action handler error", err);
    await sendToConnection(connectionId, {
      type: "error",
      reason: err instanceof Error ? err.message : "internal-error",
    });
  }

  return { statusCode: 200, body: "" };
};

// ---------------------------------------------------------------------------
// create-room
// ---------------------------------------------------------------------------
async function handleCreateRoom(
  connectionId: string,
  msg: Extract<ClientMessage, { type: "create-room" }>,
): Promise<void> {
  const code = await pickFreshCode();
  const state = bootstrapGame(msg.config);
  const room: RoomRecord = {
    code,
    state,
    seq: 0,
    expiresAt: 0, // putRoom sets the real value
  };
  await putRoom(room);

  // Bind this connection to the new room. The first human player in
  // `state.players` is the host's seat by convention.
  const hostPlayer = state.players.find((p) => !p.isBot);
  await putConnection({
    connectionId,
    roomCode: code,
    playerId: hostPlayer?.id,
    name: msg.name,
    joinedAt: Date.now(),
  });

  await sendToConnection(connectionId, {
    type: "joined",
    code,
    playerId: hostPlayer?.id ?? "",
    state,
    seq: 0,
  });
}

// ---------------------------------------------------------------------------
// join-room
// ---------------------------------------------------------------------------
async function handleJoinRoom(
  connectionId: string,
  msg: Extract<ClientMessage, { type: "join-room" }>,
): Promise<void> {
  const code = msg.code.toUpperCase();
  const room = await getRoom(code);
  if (!room) {
    await sendToConnection(connectionId, { type: "error", reason: "room-not-found" });
    return;
  }

  // Bind the connection to the room. We don't pre-claim a seat — the
  // joining client picks one (or claims a previously-vacated bot seat)
  // via a follow-up action message in a future iteration. For the v1
  // wire, joining is observer-style until seat-claim lands.
  await putConnection({
    connectionId,
    roomCode: code,
    name: msg.name,
    joinedAt: Date.now(),
  });

  await sendToConnection(connectionId, {
    type: "joined",
    code,
    playerId: "",
    state: room.state,
    seq: room.seq,
  });
}

// ---------------------------------------------------------------------------
// action
// ---------------------------------------------------------------------------
async function handleAction(connectionId: string, action: GameAction): Promise<void> {
  const conn = await getConnection(connectionId);
  if (!conn || !conn.roomCode) {
    await sendToConnection(connectionId, { type: "error", reason: "not-in-a-room" });
    return;
  }
  const room = await getRoom(conn.roomCode);
  if (!room) {
    await sendToConnection(connectionId, { type: "error", reason: "room-evicted" });
    return;
  }

  // Server-side authority — the client may speculatively believe an
  // action is legal but we re-check before applying.
  const verdict = validateAction(room.state, action);
  if (!verdict.legal) {
    await sendToConnection(connectionId, {
      type: "error",
      reason: verdict.reason ?? "illegal-action",
    });
    return;
  }

  const next = applyAction(room.state, action);
  let updated;
  try {
    updated = await updateRoomState(room.code, room.seq, next);
  } catch (err) {
    // Optimistic-CAS lost the race — another action got in first. Tell
    // the client to resync and retry with the fresh state.
    await sendToConnection(connectionId, {
      type: "error",
      reason: "stale-state",
      retriable: true,
    });
    return;
  }

  await broadcastToRoom(room.code, {
    type: "state",
    state: updated.state,
    seq: updated.seq,
  });
}

// ---------------------------------------------------------------------------
// resync
// ---------------------------------------------------------------------------
async function handleResync(connectionId: string): Promise<void> {
  const conn = await getConnection(connectionId);
  if (!conn || !conn.roomCode) {
    await sendToConnection(connectionId, { type: "error", reason: "not-in-a-room" });
    return;
  }
  const room = await getRoom(conn.roomCode);
  if (!room) {
    await sendToConnection(connectionId, { type: "error", reason: "room-evicted" });
    return;
  }
  await sendToConnection(connectionId, {
    type: "state",
    state: room.state,
    seq: room.seq,
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Mint a 4-char code that isn't already taken. We try a small handful
 * of times — collisions are vanishingly rare against the 32^4 ≈ 1M
 * keyspace and a typical concurrent-room count below 100.
 */
async function pickFreshCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = mintRoomCode();
    const existing = await getRoom(candidate);
    if (!existing) return candidate;
  }
  // Astronomically unlikely; surface the failure rather than retrying
  // forever.
  throw new Error("could not mint a unique room code");
}

/**
 * Build a fresh `GameState` from a setup config — mirrors the
 * `newGame` reducer in `packages/client/src/lib/store/game.tsx`. We
 * inline the initialization rather than importing it because the
 * client-side helper has React hooks; the engine pieces it composes
 * are already exported.
 */
function bootstrapGame(cfg: NewGameConfig): GameState {
  const catalog = defaultMashBillCatalog();
  const seats = [cfg.human, ...cfg.bots];
  const players = seats.map((s, i) => ({
    id: i === 0 ? "human" : `bot${i}`,
    name: s.name,
    isBot: i !== 0,
  }));
  const seed = cfg.seed ?? Math.floor(Math.random() * 0xffff_ffff);
  const startingMashBills: ReturnType<typeof defaultMashBillCatalog>[] = [];
  let cursor = 0;
  for (let i = 0; i < players.length; i++) {
    const slice = catalog.slice(cursor, cursor + 3);
    startingMashBills.push(slice);
    cursor += slice.length;
  }
  const bourbonDeck = catalog.slice(cursor);
  const startingDistilleries = DISTILLERIES_ENABLED
    ? undefined
    : players.map((p) => buildVanillaDistilleryFor(p.id));
  return initializeGame({
    seed,
    players,
    startingMashBills,
    bourbonDeck,
    startingDistilleries,
  });
}

