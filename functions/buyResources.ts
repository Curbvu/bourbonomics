import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import {
  buyResources as buyResourcesLogic,
  normalizeGame,
  type GameDoc,
} from "./lib/game";

const client = new DynamoDBClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const gameId = event.pathParameters?.id?.toUpperCase();
  if (!gameId) {
    return { statusCode: 400, body: JSON.stringify({ error: "game id required" }) };
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const option = body.option === "random" ? "random" : "market";

  const res = await client.send(
    new GetItemCommand({
      TableName: Resource.Games.name,
      Key: marshall({ gameId }),
    })
  );

  if (!res.Item) {
    return { statusCode: 404, body: JSON.stringify({ error: "Game not found" }) };
  }

  const game = normalizeGame(unmarshall(res.Item) as GameDoc);
  const result = buyResourcesLogic(game, option);

  if (result.error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: result.error }),
    };
  }

  await client.send(
    new PutItemCommand({
      TableName: Resource.Games.name,
      Item: marshall({
        ...result.game,
        updatedAt: result.game.updatedAt,
      }),
    })
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result.game),
  };
};
