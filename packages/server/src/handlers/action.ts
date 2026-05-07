/**
 * `$default` route handler — the heart of the multi-player server.
 *
 * Every client message lands here:
 *
 *   - `create-room` mints a 4-char code, runs `initializeGame` with
 *     the requested seat layout (host + extra humans + bots), and
 *     registers the caller as the host (seat 0).
 *   - `join-room` binds the connection to an existing room as an
 *     observer.
 *   - `claim-seat` lets a connection take an open human seat by
 *     `playerId`. Server rejects duplicates and bot seats.
 *   - `action` validates that the caller's claimed seat matches
 *     `action.playerId`, applies via the engine, persists, and
 *     broadcasts. After every successful human action it also
 *     **inline-steps the orchestrator** while a bot is on the
 *     clock, so bot turns play instantly without waiting for the
 *     1-min cron tick.
 *   - `resync` re-sends current state to the caller.
 *
 * The engine is the same code that runs in the browser — by
 * importing `@bourbonomics/engine` directly, the server validates
 * actions identically to the client's optimistic-validation hints.
 */

import {
  applyAction,
  awaitingHumanInput,
  buildVanillaDistilleryFor,
  defaultMashBillCatalog,
  DISTILLERIES_ENABLED,
  initializeGame,
  isGameOver,
  stepOrchestrator,
  validateAction,
  type GameAction,
  type GameState,
  type NewMultiplayerGameConfig,
} from "@bourbonomics/engine";

import { broadcastToRoom, sendToConnection } from "../lib/broadcast.js";
import type { WsHandler } from "../lib/lambda-types.js";
import {
  parseClientMessage,
  type ClientMessage,
  type SeatInfo,
} from "../lib/protocol.js";
import {
  claimSeat,
  getConnection,
  getRoom,
  putConnection,
  putRoom,
  releaseSeat,
  updateRoomState,
  type RoomRecord,
} from "../lib/rooms.js";

const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // dropped 0/O/1/I

// How many bot turns to inline-step after a human action before
// stopping. Bounds Lambda execution time when the bots get into a
// long stretch (e.g. several rounds of all-bot turns).
const MAX_INLINE_BOT_STEPS = 24;

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
      case "claim-seat":
        await handleClaimSeat(connectionId, msg);
        break;
      case "release-seat":
        await handleReleaseSeat(connectionId);
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

  // The host is the first human seat; auto-claim it for the
  // connection that just opened the room.
  const hostPlayer = state.players.find((p) => !p.isBot);
  const hostName = msg.config.host.name;
  const seatClaims: Record<string, string> = hostPlayer
    ? { [hostPlayer.id]: hostName }
    : {};

  const room: RoomRecord = {
    code,
    state,
    seq: 0,
    expiresAt: 0, // putRoom sets the real value
    seatClaims,
  };
  await putRoom(room);

  await putConnection({
    connectionId,
    roomCode: code,
    playerId: hostPlayer?.id,
    name: hostName,
    joinedAt: Date.now(),
  });

  await sendToConnection(connectionId, {
    type: "joined",
    code,
    playerId: hostPlayer?.id ?? "",
    state,
    seq: 0,
    roster: buildRoster(state, seatClaims),
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

  // Bind the connection to the room. The joiner is an observer
  // until they `claim-seat`. If the same name already claimed a
  // seat in this room (likely a reconnect), pre-bind to it.
  const claims = room.seatClaims ?? {};
  const existingClaimEntry = Object.entries(claims).find(
    ([, n]) => n.toLowerCase() === msg.name.toLowerCase(),
  );
  const playerId = existingClaimEntry?.[0];

  await putConnection({
    connectionId,
    roomCode: code,
    name: msg.name,
    playerId,
    joinedAt: Date.now(),
  });

  await sendToConnection(connectionId, {
    type: "joined",
    code,
    playerId: playerId ?? "",
    state: room.state,
    seq: room.seq,
    roster: buildRoster(room.state, claims),
  });
}

// ---------------------------------------------------------------------------
// claim-seat
// ---------------------------------------------------------------------------
async function handleClaimSeat(
  connectionId: string,
  msg: Extract<ClientMessage, { type: "claim-seat" }>,
): Promise<void> {
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

  const seat = room.state.players.find((p) => p.id === msg.playerId);
  if (!seat) {
    await sendToConnection(connectionId, { type: "error", reason: "no-such-seat" });
    return;
  }
  if (seat.isBot) {
    await sendToConnection(connectionId, { type: "error", reason: "seat-is-a-bot" });
    return;
  }
  const claims = room.seatClaims ?? {};
  const already = claims[msg.playerId];
  const myName = conn.name ?? "Guest";
  if (already && already.toLowerCase() !== myName.toLowerCase()) {
    await sendToConnection(connectionId, { type: "error", reason: "seat-already-claimed" });
    return;
  }

  const next = await claimSeat(conn.roomCode, msg.playerId, myName);
  await putConnection({
    connectionId,
    roomCode: conn.roomCode,
    name: myName,
    playerId: msg.playerId,
    joinedAt: conn.joinedAt,
  });

  // Broadcast the new roster to everyone — the lobby UI uses this
  // to fill in seat names live as people claim.
  await broadcastToRoom(conn.roomCode, {
    type: "state",
    state: room.state,
    seq: room.seq,
    roster: buildRoster(room.state, next),
  });
}

// ---------------------------------------------------------------------------
// release-seat
// ---------------------------------------------------------------------------
async function handleReleaseSeat(connectionId: string): Promise<void> {
  const conn = await getConnection(connectionId);
  if (!conn || !conn.roomCode || !conn.playerId) {
    await sendToConnection(connectionId, { type: "error", reason: "no-seat-to-release" });
    return;
  }
  const room = await getRoom(conn.roomCode);
  if (!room) {
    await sendToConnection(connectionId, { type: "error", reason: "room-evicted" });
    return;
  }
  const next = await releaseSeat(conn.roomCode, conn.playerId);
  // Demote the connection back to observer.
  await putConnection({
    connectionId,
    roomCode: conn.roomCode,
    name: conn.name,
    playerId: undefined,
    joinedAt: conn.joinedAt,
  });
  await broadcastToRoom(conn.roomCode, {
    type: "state",
    state: room.state,
    seq: room.seq,
    roster: buildRoster(room.state, next),
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

  // Caller must own the seat the action targets. Without this gate
  // anyone in a room could act on anyone's behalf — fine for v1 of
  // the wire, not fine the moment two humans share a room.
  const actionOwner = (action as { playerId?: string }).playerId;
  if (actionOwner && conn.playerId !== actionOwner) {
    await sendToConnection(connectionId, {
      type: "error",
      reason: "not-your-seat",
    });
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
    // Optimistic-CAS lost the race — another action got in first.
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
    action,
  });

  // Inline bot stepping — keep applying actions while the cursor
  // sits on a bot. This is what makes turns feel instant after a
  // human acts; the cron-driven `Tick` Lambda is purely a fallback
  // for "all bots, no human action just happened" cases.
  await driveBotsForward(room.code, updated.state, updated.seq);
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
    roster: buildRoster(room.state, room.seatClaims ?? {}),
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

/**
 * Mint a 4-char code that isn't already taken. We try a small
 * handful of times — collisions are vanishingly rare against the
 * 32^4 ≈ 1M keyspace and a typical concurrent-room count below
 * 100.
 */
async function pickFreshCode(): Promise<string> {
  for (let i = 0; i < 8; i++) {
    const candidate = mintRoomCode();
    const existing = await getRoom(candidate);
    if (!existing) return candidate;
  }
  throw new Error("could not mint a unique room code");
}

/**
 * Build a fresh `GameState` from a multi-player setup config. Seat
 * 0 is the host; seats 1..(1+extraHumanSeats) are unclaimed humans;
 * remaining seats are bots.
 */
function bootstrapGame(cfg: NewMultiplayerGameConfig): GameState {
  const catalog = defaultMashBillCatalog();
  const players: { id: string; name: string; isBot?: boolean }[] = [];
  // Seat 0 — host.
  players.push({ id: "human0", name: cfg.host.name, isBot: false });
  // Extra human seats.
  for (let i = 0; i < cfg.extraHumanSeats; i++) {
    players.push({
      id: `human${i + 1}`,
      name: `Open seat ${i + 1}`,
      isBot: false,
    });
  }
  // Bot seats.
  cfg.bots.forEach((b, i) => {
    players.push({ id: `bot${i + 1}`, name: b.name, isBot: true });
  });

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

/**
 * Compose the per-seat roster shipped on every roster-changing
 * broadcast. `claimedBy` reads from the seat-claims ledger; bot
 * seats stay null there.
 */
function buildRoster(
  state: GameState,
  claims: Record<string, string>,
): SeatInfo[] {
  return state.players.map((p) => ({
    playerId: p.id,
    name: p.name,
    isBot: p.isBot ?? false,
    claimedBy: p.isBot ? null : (claims[p.id] ?? null),
  }));
}

/**
 * Loop the orchestrator forward while a bot is on the clock. Each
 * step is its own optimistic-CAS write so a concurrent human
 * action can interrupt cleanly. Broadcasts the new state after
 * every successful step so the UI animates each bot turn.
 */
async function driveBotsForward(
  code: string,
  startState: GameState,
  startSeq: number,
): Promise<void> {
  let state = startState;
  let seq = startSeq;
  for (let i = 0; i < MAX_INLINE_BOT_STEPS; i++) {
    if (isGameOver(state)) break;
    if (awaitingHumanInput(state)) break;
    const result = stepOrchestrator(state);
    if (!result) break;
    let updated;
    try {
      updated = await updateRoomState(code, seq, result.state);
    } catch {
      // Race — another writer beat us. The cron tick will pick up
      // any remaining bot turns; bail without throwing.
      return;
    }
    state = updated.state;
    seq = updated.seq;
    await broadcastToRoom(code, {
      type: "state",
      state,
      seq,
      action: result.action,
    });
  }
}
