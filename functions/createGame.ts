import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import {
  shortId,
  createNewGame,
  startGame,
  BOT_ID_PREFIX,
  type GameMode,
} from "./lib/game";

const client = new DynamoDBClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const body = event.body ? JSON.parse(event.body) : {};
  const mode: GameMode =
    body.mode === "bottled-in-bond"
      ? "bottled-in-bond"
      : body.mode === "singleplayer"
        ? "singleplayer"
        : "normal";
  const playerName = typeof body.playerName === "string" ? body.playerName.trim() : "Baron 1";
  if (!playerName) {
    return { statusCode: 400, body: JSON.stringify({ error: "playerName required" }) };
  }

  const gameId = shortId(6);
  const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const game = createNewGame(gameId, mode);
  game.playerOrder = [playerId];
  game.players[playerId] = {
    id: playerId,
    name: playerName,
    cash: 0,
    resourceCards: [],
    barrelledBourbons: [],
    bourbonCards: [],
    operationsHand: [],
    investmentHand: [],
  };

  if (mode === "singleplayer") {
    const botId = `${BOT_ID_PREFIX}1`;
    game.playerOrder.push(botId);
    game.players[botId] = {
      id: botId,
      name: "Computer",
      cash: 0,
      resourceCards: [],
      barrelledBourbons: [],
      bourbonCards: [],
      operationsHand: [],
      investmentHand: [],
    };
    const started = startGame(game);
    const toStore = { ...started, updatedAt: started.updatedAt };
    await client.send(
      new PutItemCommand({
        TableName: Resource.Games.name,
        Item: marshall(toStore),
      })
    );
    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gameId,
        playerId,
        joinCode: gameId,
        game: started,
      }),
    };
  }

  await client.send(
    new PutItemCommand({
      TableName: Resource.Games.name,
      Item: marshall({
        ...game,
        updatedAt: game.updatedAt,
      }),
    })
  );

  return {
    statusCode: 201,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      gameId,
      playerId,
      joinCode: gameId,
      game,
    }),
  };
};
