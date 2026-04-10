import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { isBotPlayer, normalizeGame, type GameDoc } from "./lib/game";
import { runComputerTurn } from "./lib/bot";

const client = new DynamoDBClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const gameId = event.pathParameters?.id?.toUpperCase();
  if (!gameId) {
    return { statusCode: 400, body: JSON.stringify({ error: "game id required" }) };
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
  if (game.status !== "in_progress") {
    return { statusCode: 400, body: JSON.stringify({ error: "Game not in progress" }) };
  }

  const currentId = game.playerOrder[game.currentPlayerIndex];
  if (!currentId || !isBotPlayer(currentId)) {
    return { statusCode: 400, body: JSON.stringify({ error: "Not the computer's turn" }) };
  }

  const updated = runComputerTurn(normalizeGame(game));

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
