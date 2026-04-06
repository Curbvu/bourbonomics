import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import {
  capitalizeInvestment as capitalizeLogic,
  drawInvestmentCard as drawInvLogic,
  drawOperationsCard as drawOpLogic,
  normalizeGame,
  playOperationsCard as playOpLogic,
  type GameDoc,
} from "./lib/game";

const client = new DynamoDBClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const gameId = event.pathParameters?.id?.toUpperCase();
  if (!gameId) {
    return { statusCode: 400, body: JSON.stringify({ error: "game id required" }) };
  }

  const body = event.body ? JSON.parse(event.body) : {};
  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const action = body.action as string | undefined;
  const handIndex =
    typeof body.handIndex === "number" && Number.isFinite(body.handIndex)
      ? Math.floor(body.handIndex)
      : -1;

  if (!playerId || !action) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "playerId and action required" }),
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

  let game = normalizeGame(unmarshall(res.Item) as GameDoc);
  let result: { game: GameDoc; error?: string };

  switch (action) {
    case "drawOperations":
      result = drawOpLogic(game, playerId);
      break;
    case "drawInvestment":
      result = drawInvLogic(game, playerId);
      break;
    case "capitalizeInvestment":
      if (handIndex < 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "handIndex required" }),
        };
      }
      result = capitalizeLogic(game, playerId, handIndex);
      break;
    case "playOperations":
      if (handIndex < 0) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "handIndex required" }),
        };
      }
      result = playOpLogic(game, playerId, handIndex);
      break;
    default:
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Unknown action",
          valid: [
            "drawOperations",
            "drawInvestment",
            "capitalizeInvestment",
            "playOperations",
          ],
        }),
      };
  }

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
