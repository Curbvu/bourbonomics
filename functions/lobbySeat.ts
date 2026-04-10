import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import {
  addComputerToLobbySeat,
  closeEmptyLobbySeat,
  lobbyHostPlayerId,
  normalizeGame,
  openComputerLobbySeatForHuman,
  type GameDoc,
} from "./lib/game";

const client = new DynamoDBClient({});

type LobbySeatAction = "add_computer" | "open_for_human" | "close_seat";

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const gameId = event.pathParameters?.id?.toUpperCase();
  if (!gameId) {
    return { statusCode: 400, body: JSON.stringify({ error: "game id required" }) };
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const playerId = typeof body.playerId === "string" ? body.playerId.trim() : "";
  const action = body.action as LobbySeatAction;
  const seatIndexRaw = body.seatIndex;
  const seatIndex =
    seatIndexRaw === undefined || seatIndexRaw === null
      ? NaN
      : Math.floor(Number(seatIndexRaw));

  if (!playerId) {
    return { statusCode: 400, body: JSON.stringify({ error: "playerId required" }) };
  }
  if (
    action !== "add_computer" &&
    action !== "open_for_human" &&
    action !== "close_seat"
  ) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        error: "action must be add_computer, open_for_human, or close_seat",
      }),
    };
  }
  if (!Number.isFinite(seatIndex) || seatIndex < 1 || seatIndex > 5) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "seatIndex must be 1–5 (UI seats 2–6)" }),
    };
  }

  const res = await client.send(
    new GetItemCommand({
      TableName: Resource.Games.name,
      Key: marshall({ gameId }),
    })
  );

  if (!res.Item) {
    return { statusCode: 404, body: JSON.stringify({ error: "Game not found" }) };
  }

  const game = unmarshall(res.Item) as GameDoc;
  if (game.status !== "lobby") {
    return { statusCode: 400, body: JSON.stringify({ error: "Game already started" }) };
  }

  const hostId = lobbyHostPlayerId(game);
  if (!hostId || hostId !== playerId) {
    return { statusCode: 403, body: JSON.stringify({ error: "Only the host can change lobby seats" }) };
  }

  let next: { game: GameDoc; error?: string };
  if (action === "add_computer") {
    next = addComputerToLobbySeat(game, seatIndex);
  } else if (action === "open_for_human") {
    next = openComputerLobbySeatForHuman(game, seatIndex);
  } else {
    next = closeEmptyLobbySeat(game, seatIndex);
  }

  if (next.error) {
    return { statusCode: 400, body: JSON.stringify({ error: next.error }) };
  }

  const updated = normalizeGame(next.game);

  await client.send(
    new PutItemCommand({
      TableName: Resource.Games.name,
      Item: marshall({
        ...updated,
        updatedAt: updated.updatedAt,
      }),
    })
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updated),
  };
};
