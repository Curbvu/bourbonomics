import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import {
  startGame as startGameLogic,
  lobbyHasUnfilledOpenSeat,
  countSeatedBarons,
  type GameDoc,
} from "./lib/game";

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
  if (game.status !== "lobby") {
    return { statusCode: 400, body: JSON.stringify({ error: "Game already started" }) };
  }
  const seats = game.lobbySeats;
  if (seats?.length === 6) {
    if (lobbyHasUnfilledOpenSeat(seats)) {
      return {
        statusCode: 400,
        body: JSON.stringify({
          error: "Close or fill every open seat before starting",
        }),
      };
    }
    if (countSeatedBarons(seats) < 2) {
      return { statusCode: 400, body: JSON.stringify({ error: "Need at least 2 barons to start" }) };
    }
  } else if (game.playerOrder.length < 2) {
    return { statusCode: 400, body: JSON.stringify({ error: "Need at least 2 barons to start" }) };
  }

  const updated = startGameLogic(game);

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
