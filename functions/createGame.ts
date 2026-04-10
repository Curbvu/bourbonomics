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
  applyMultiplayerLobbyPlan,
  type GameMode,
  type LobbySlotPlan,
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

  const defaultSlots: LobbySlotPlan[] = ["open", "closed", "closed", "closed", "closed"];
  let lobbySlots: LobbySlotPlan[] = defaultSlots;
  if (Array.isArray(body.lobbySlots) && body.lobbySlots.length === 5) {
    const next: LobbySlotPlan[] = [];
    for (let i = 0; i < 5; i++) {
      const v = body.lobbySlots[i];
      if (v === "closed" || v === "open" || v === "computer") next.push(v);
      else {
        return {
          statusCode: 400,
          body: JSON.stringify({
            error: "Each lobbySlots entry must be closed, open, or computer",
          }),
        };
      }
    }
    lobbySlots = next;
  } else if (body.lobbySlots != null) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "lobbySlots must be an array of exactly 5 strings" }),
    };
  }

  const gameId = shortId(6);
  const playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const base = createNewGame(gameId, mode);

  if (mode === "singleplayer") {
    const game = base;
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

  const planned = applyMultiplayerLobbyPlan(base, playerId, playerName, lobbySlots);
  if (planned.error) {
    return { statusCode: 400, body: JSON.stringify({ error: planned.error }) };
  }
  const game = planned.game;

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
