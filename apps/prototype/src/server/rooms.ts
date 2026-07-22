// Bourbonomics: Map Game — WebSocket room server (authoritative online play).
//
// A single Lambda backs an API Gateway WebSocket API. The server owns the game:
// it runs the SAME pure engine the browser runs, applies each client's action
// only when it's that seat's turn, auto-advances bot seats, and broadcasts the
// resulting GameState to everyone in the room. DynamoDB holds one item per room
// (pk = ROOM#code) and one per live connection (pk = CONN#connId).
//
// This module is deployed by sst.config.ts ONLY when ENABLE_MULTIPLAYER is set,
// so the default site build/deploy is unaffected. See the env-gated block there.

import { ApiGatewayManagementApiClient, PostToConnectionCommand } from "@aws-sdk/client-apigatewaymanagementapi";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

import { applyAction } from "../mapgame/engine/engine";
import { autoAdvance, currentActorOf } from "../mapgame/engine/bot";
import { createGame } from "../mapgame/engine/setup";
import type { GameState } from "../mapgame/engine/types";
import {
  MAX_SEATS,
  MIN_SEATS,
  ROOM_CODE_LEN,
  type ClientMessage,
  type RoomView,
  type Seat,
  type ServerMessage,
} from "../mapgame/net/protocol";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const TABLE = Resource.Rooms.name;

interface RoomRecord {
  pk: string; // ROOM#<code>
  code: string;
  hostSeat: number;
  seats: Seat[];
  connBySeat: Record<number, string>; // seat index → connection id (humans only)
  status: "lobby" | "playing" | "ended";
  game: GameState | null;
  seed: number;
  updatedAt: number;
}

interface ConnRecord {
  pk: string; // CONN#<connId>
  code: string;
  seat: number;
}

// ── Persistence ──────────────────────────────────────────────────────
const roomKey = (code: string) => `ROOM#${code.toUpperCase()}`;
const connKey = (id: string) => `CONN#${id}`;

async function getRoom(code: string): Promise<RoomRecord | null> {
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: roomKey(code) } }));
  return (r.Item as RoomRecord) ?? null;
}
async function putRoom(room: RoomRecord): Promise<void> {
  room.updatedAt = Date.now();
  await ddb.send(new PutCommand({ TableName: TABLE, Item: room }));
}
async function getConn(id: string): Promise<ConnRecord | null> {
  const r = await ddb.send(new GetCommand({ TableName: TABLE, Key: { pk: connKey(id) } }));
  return (r.Item as ConnRecord) ?? null;
}
async function putConn(rec: ConnRecord): Promise<void> {
  await ddb.send(new PutCommand({ TableName: TABLE, Item: rec }));
}
async function delConn(id: string): Promise<void> {
  await ddb.send(new DeleteCommand({ TableName: TABLE, Key: { pk: connKey(id) } }));
}

// ── Messaging ────────────────────────────────────────────────────────
function mgmt(event: WsEvent): ApiGatewayManagementApiClient {
  const { domainName, stage } = event.requestContext;
  return new ApiGatewayManagementApiClient({ endpoint: `https://${domainName}/${stage}` });
}

async function send(api: ApiGatewayManagementApiClient, connId: string, msg: ServerMessage): Promise<boolean> {
  try {
    await api.send(new PostToConnectionCommand({ ConnectionId: connId, Data: Buffer.from(JSON.stringify(msg)) }));
    return true;
  } catch {
    return false; // stale connection (410) or transient — caller prunes
  }
}

function roomView(room: RoomRecord, yourSeat: number): RoomView {
  return { code: room.code, hostSeat: room.hostSeat, seats: room.seats, status: room.status, yourSeat };
}

/** Broadcast the room (and game, if playing) to every connected human seat. */
async function broadcast(api: ApiGatewayManagementApiClient, room: RoomRecord): Promise<void> {
  const dead: number[] = [];
  for (const seat of room.seats) {
    if (seat.isBot) continue;
    const connId = room.connBySeat[seat.index];
    if (!connId) continue;
    const msg: ServerMessage =
      room.game != null ? { t: "state", room: roomView(room, seat.index), game: room.game } : { t: "room", room: roomView(room, seat.index) };
    const ok = await send(api, connId, msg);
    if (!ok) dead.push(seat.index);
  }
  if (dead.length) {
    for (const s of dead) markDisconnected(room, s);
    // a dead connection mid-broadcast is handled lazily; state already reflects it
  }
}

// ── Room mutation helpers ────────────────────────────────────────────
function newCode(connId: string): string {
  // Derive a short code from the connection id + time; readable, no vowels-only.
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const src = `${connId}${Date.now()}`;
  let code = "";
  for (let i = 0; i < ROOM_CODE_LEN; i++) {
    code += alphabet[(src.charCodeAt(i * 3 + 1) + i * 7) % alphabet.length];
  }
  return code;
}

function firstOpenSeat(room: RoomRecord): number {
  return room.seats.length; // seats are appended densely 0..n-1
}

function markDisconnected(room: RoomRecord, seat: number): void {
  const s = room.seats.find((x) => x.index === seat);
  if (!s) return;
  s.connected = false;
  delete room.connBySeat[seat];
  // Keep games alive: a human who drops mid-game becomes a bot the server plays.
  if (room.status === "playing" && room.game) {
    s.isBot = true;
    const p = room.game.players[seat];
    if (p) p.isBot = true;
  }
}

// ── Handlers ─────────────────────────────────────────────────────────
async function handleCreate(api: ApiGatewayManagementApiClient, connId: string, name: string): Promise<void> {
  const code = newCode(connId);
  const seat: Seat = { index: 0, name: name.slice(0, 20) || "Player 1", isBot: false, connected: true };
  const room: RoomRecord = {
    pk: roomKey(code),
    code,
    hostSeat: 0,
    seats: [seat],
    connBySeat: { 0: connId },
    status: "lobby",
    game: null,
    seed: 1,
    updatedAt: Date.now(),
  };
  await putRoom(room);
  await putConn({ pk: connKey(connId), code, seat: 0 });
  await send(api, connId, { t: "room", room: roomView(room, 0) });
}

async function handleJoin(api: ApiGatewayManagementApiClient, connId: string, code: string, name: string): Promise<void> {
  const room = await getRoom(code);
  if (!room) return void send(api, connId, { t: "error", reason: "No room with that code." });
  if (room.status !== "lobby") return void send(api, connId, { t: "error", reason: "That game has already started." });
  if (room.seats.length >= MAX_SEATS) return void send(api, connId, { t: "error", reason: "The table is full." });
  const index = firstOpenSeat(room);
  room.seats.push({ index, name: name.slice(0, 20) || `Player ${index + 1}`, isBot: false, connected: true });
  room.connBySeat[index] = connId;
  await putRoom(room);
  await putConn({ pk: connKey(connId), code: room.code, seat: index });
  await broadcast(api, room);
}

async function handleAddBot(api: ApiGatewayManagementApiClient, connId: string, code: string): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.status !== "lobby") return;
  const conn = await getConn(connId);
  if (!conn || conn.seat !== room.hostSeat) return; // host only
  if (room.seats.length >= MAX_SEATS) return;
  const index = firstOpenSeat(room);
  room.seats.push({ index, name: `Bot ${index + 1}`, isBot: true, connected: true });
  await putRoom(room);
  await broadcast(api, room);
}

async function handleRemoveSeat(api: ApiGatewayManagementApiClient, connId: string, code: string, seat: number): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.status !== "lobby") return;
  const conn = await getConn(connId);
  if (!conn || conn.seat !== room.hostSeat) return; // host only
  const target = room.seats.find((s) => s.index === seat);
  if (!target || !target.isBot) return; // only bot seats are removable in-lobby
  room.seats = room.seats.filter((s) => s.index !== seat);
  reindexSeats(room);
  await putRoom(room);
  await broadcast(api, room);
}

/** Keep seats dense (0..n-1) after a removal, fixing connBySeat + host. */
function reindexSeats(room: RoomRecord): void {
  const oldConn = room.connBySeat;
  const newConn: Record<number, string> = {};
  room.seats.forEach((s, i) => {
    const prev = s.index;
    s.index = i;
    if (oldConn[prev]) newConn[i] = oldConn[prev]!;
    if (prev === room.hostSeat) room.hostSeat = i;
  });
  room.connBySeat = newConn;
}

async function handleStart(api: ApiGatewayManagementApiClient, connId: string, code: string, seed?: number): Promise<void> {
  const room = await getRoom(code);
  if (!room) return;
  const conn = await getConn(connId);
  if (!conn || conn.seat !== room.hostSeat) return void send(api, connId, { t: "error", reason: "Only the host can start." });
  if (room.seats.length < MIN_SEATS) return void send(api, connId, { t: "error", reason: `Need at least ${MIN_SEATS} players.` });

  room.seed = seed ?? room.seed;
  const game = createGame({
    playerNames: room.seats.map((s) => s.name),
    bots: room.seats.map((s) => s.isBot),
    seed: room.seed,
  });
  room.game = autoAdvance(game); // play any leading bot seats up to the first human
  room.status = room.game.phase === "ended" ? "ended" : "playing";
  await putRoom(room);
  await broadcast(api, room);
}

async function handleAction(api: ApiGatewayManagementApiClient, connId: string, code: string, action: ClientMessage extends { t: "action"; action: infer A } ? A : never): Promise<void> {
  const room = await getRoom(code);
  if (!room || room.status !== "playing" || !room.game) return;
  const conn = await getConn(connId);
  if (!conn) return;

  const actorSeat = room.game.players.indexOf(currentActorOf(room.game));
  if (conn.seat !== actorSeat) return void send(api, connId, { t: "error", reason: "It isn't your turn." });

  const res = applyAction(room.game, action);
  if (!res.ok) return void send(api, connId, { t: "error", reason: res.reason });

  room.game = autoAdvance(res.state); // resolve any bot seats that follow
  if (room.game.phase === "ended") room.status = "ended";
  await putRoom(room);
  await broadcast(api, room);
}

async function handleLeave(api: ApiGatewayManagementApiClient, connId: string): Promise<void> {
  const conn = await getConn(connId);
  if (!conn) return;
  const room = await getRoom(conn.code);
  await delConn(connId);
  if (!room) return;
  markDisconnected(room, conn.seat);
  await putRoom(room);
  await broadcast(api, room);
}

// ── Lambda entrypoint ────────────────────────────────────────────────
interface WsEvent {
  requestContext: { connectionId: string; domainName: string; stage: string; routeKey: string };
  body?: string;
}

export async function handler(event: WsEvent): Promise<{ statusCode: number }> {
  const { routeKey, connectionId } = event.requestContext;
  if (routeKey === "$connect") return { statusCode: 200 };
  const api = mgmt(event);
  if (routeKey === "$disconnect") {
    await handleLeave(api, connectionId);
    return { statusCode: 200 };
  }

  let msg: ClientMessage;
  try {
    msg = JSON.parse(event.body ?? "{}") as ClientMessage;
  } catch {
    await send(api, connectionId, { t: "error", reason: "Malformed message." });
    return { statusCode: 200 };
  }

  try {
    switch (msg.t) {
      case "create":
        await handleCreate(api, connectionId, msg.name);
        break;
      case "join":
        await handleJoin(api, connectionId, msg.code, msg.name);
        break;
      case "addBot":
        await handleAddBot(api, connectionId, msg.code);
        break;
      case "removeSeat":
        await handleRemoveSeat(api, connectionId, msg.code, msg.seat);
        break;
      case "start":
        await handleStart(api, connectionId, msg.code, msg.seed);
        break;
      case "action":
        await handleAction(api, connectionId, msg.code, msg.action);
        break;
      case "leave":
        await handleLeave(api, connectionId);
        break;
    }
  } catch (err) {
    await send(api, connectionId, { t: "error", reason: "Server error." });
    // eslint-disable-next-line no-console
    console.error("room handler error", err);
  }
  return { statusCode: 200 };
}
