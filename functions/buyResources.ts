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
  type MarketBuyPicks,
} from "./lib/game";

const client = new DynamoDBClient({});

function parsePicks(body: Record<string, unknown>): MarketBuyPicks | "random" {
  if (body.random === true || body.option === "random") return "random";
  if (body.option === "market") return "random";
  const raw = body.picks as Record<string, unknown> | undefined;
  const c = raw
    ? Math.max(0, Math.floor(Number(raw.cask) || 0))
    : Math.max(0, Math.floor(Number(body.cask) || 0));
  const co = raw
    ? Math.max(0, Math.floor(Number(raw.corn) || 0))
    : Math.max(0, Math.floor(Number(body.corn) || 0));
  const g = raw
    ? Math.max(0, Math.floor(Number(raw.grain) || 0))
    : Math.max(0, Math.floor(Number(body.grain) || 0));
  if (c + co + g === 0) return "random";
  return { cask: c, corn: co, grain: g };
}

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const gameId = event.pathParameters?.id?.toUpperCase();
  if (!gameId) {
    return { statusCode: 400, body: JSON.stringify({ error: "game id required" }) };
  }

  const body = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
  const picks = parsePicks(body);

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
  const result = buyResourcesLogic(game, picks);

  if (result.error) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: result.error }),
    };
  }

  await client.send(
    new PutItemCommand({
      TableName: Resource.Games.name,
      Item: marshall(
        {
          ...result.game,
          updatedAt: result.game.updatedAt,
        },
        { removeUndefinedValues: true }
      ),
    })
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(result.game),
  };
};
