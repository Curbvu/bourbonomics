/**
 * `Tick` Lambda — bot stepper.
 *
 * Fires on a schedule (EventBridge cron, currently 1/min). Scans every
 * room and, when the cursor is on a bot seat, runs `stepOrchestrator`
 * to advance the game one action. On every successful step it
 * broadcasts the new state to the room.
 *
 * Why scan + write rather than push? Bots need to act between human
 * turns even when no client message has arrived. EventBridge → Lambda
 * is the cheapest "always-on heartbeat" AWS provides; a 1-minute cron
 * keeps cost trivial while the average action-to-action time stays
 * snappy because human turns trigger the action handler directly.
 *
 * The cron rate is conservative on purpose. Once we have real traffic
 * we can raise it (or move to API Gateway connection-keepalive) — but
 * minute-granular bot turns are a generous starting budget for a
 * turn-based bourbon game.
 */

import {
  awaitingHumanInput,
  isGameOver,
  stepOrchestrator,
} from "@bourbonomics/engine";
import {
  DynamoDBClient,
} from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  ScanCommand,
} from "@aws-sdk/lib-dynamodb";
import { Resource } from "sst";

import { broadcastToRoom } from "../lib/broadcast.js";
import { updateRoomState, type RoomRecord } from "../lib/rooms.js";

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

// Cap how many actions we step per room per tick — keeps a runaway
// bot war from hogging the Lambda.
const MAX_STEPS_PER_TICK = 12;

export const handler = async (): Promise<void> => {
  const rooms = await listAllRooms();
  await Promise.all(
    rooms.map((room) =>
      stepRoom(room).catch((err) => {
        // eslint-disable-next-line no-console
        console.error(`tick: room ${room.code} failed`, err);
      }),
    ),
  );
};

async function listAllRooms(): Promise<RoomRecord[]> {
  // Scan is cheap at our scale (<100 rooms typical). When that no
  // longer holds, switch to a status-indexed GSI.
  const out: RoomRecord[] = [];
  let cursor: Record<string, unknown> | undefined;
  do {
    const r = await ddb.send(
      new ScanCommand({
        TableName: Resource.Rooms.name,
        ExclusiveStartKey: cursor,
      }),
    );
    if (r.Items) out.push(...(r.Items as RoomRecord[]));
    cursor = r.LastEvaluatedKey;
  } while (cursor);
  return out;
}

async function stepRoom(room: RoomRecord): Promise<void> {
  if (isGameOver(room.state)) return;
  // Don't step while the cursor is on a human — they might be mid-pick.
  if (awaitingHumanInput(room.state)) return;

  let state = room.state;
  let seq = room.seq;
  let stepped = 0;
  while (stepped < MAX_STEPS_PER_TICK) {
    if (isGameOver(state)) break;
    if (awaitingHumanInput(state)) break;
    const result = stepOrchestrator(state);
    if (!result) break;
    state = result.state;
    stepped += 1;
  }
  if (stepped === 0) return;

  // Single CAS write for the batch — `updateRoomState` enforces that
  // the action handler hasn't beat us to a write.
  let updated;
  try {
    // Stage advances as we walk; final seq is `seq + stepped`.
    updated = await updateRoomState(room.code, seq, state);
    // The CAS only bumped seq by 1; sync our view.
    seq = updated.seq;
  } catch (err) {
    // Race with a human action — let the action handler's broadcast
    // take care of it; we'll re-converge on the next tick.
    return;
  }

  await broadcastToRoom(room.code, {
    type: "state",
    state: updated.state,
    seq: updated.seq,
  });
}
