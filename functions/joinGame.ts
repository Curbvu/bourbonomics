import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { joinPlayerAtOpenLobbySeat, normalizeGame, type GameDoc } from "./lib/game";

const client = new DynamoDBClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const gameId = event.pathParameters?.id?.toUpperCase();
  if (!gameId) {
    return { statusCode: 400, body: JSON.stringify({ error: "game id required" }) };
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const playerName = typeof body.playerName === "string" ? body.playerName.trim() : "";
  if (!playerName) {
    return { statusCode: 400, body: JSON.stringify({ error: "playerName required" }) };
  }

  /** Optional UI seat number 2–6 (host must have opened that slot). */
  let joinSeatIndex: number | undefined;
  if (body.seatNumber != null && body.seatNumber !== "") {
    const n = Math.floor(Number(body.seatNumber));
    if (!Number.isFinite(n) || n < 2 || n > 6) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "seatNumber must be 2–6 when provided" }),
      };
    }
    joinSeatIndex = n - 1;
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

  const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const joined = joinPlayerAtOpenLobbySeat(game, playerId, playerName, {
    seatIndex: joinSeatIndex,
  });
  if (joined.error) {
    return { statusCode: 400, body: JSON.stringify({ error: joined.error }) };
  }
  const updated = normalizeGame(joined.game);

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
    body: JSON.stringify({
      gameId: updated.gameId,
      playerId,
      game: updated,
    }),
  };
};
