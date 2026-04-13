import type { APIGatewayProxyHandlerV2 } from "aws-lambda";
import {
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import {
  normalizeGame,
  openingCommitInvestments,
  openingKeepThreeInvestments,
  type GameDoc,
} from "./lib/game";

const client = new DynamoDBClient({});

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  const gameId = event.pathParameters?.id?.toUpperCase();
  if (!gameId) {
    return { statusCode: 400, body: JSON.stringify({ error: "game id required" }) };
  }

  let body: Record<string, unknown> = {};
  try {
    body = event.body ? (JSON.parse(event.body) as Record<string, unknown>) : {};
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: "Invalid JSON body" }) };
  }

  const playerId = typeof body.playerId === "string" ? body.playerId : "";
  const kind = body.kind === "commit" ? "commit" : body.kind === "keep" ? "keep" : "";
  if (!playerId || !kind) {
    return {
      statusCode: 400,
      body: JSON.stringify({ error: "playerId and kind (keep|commit) required" }),
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

  if (kind === "keep") {
    const raw = body.keepIndices;
    const keepIndices = Array.isArray(raw)
      ? raw.map((x) => Math.floor(Number(x)))
      : [];
    result = openingKeepThreeInvestments(game, playerId, keepIndices);
  } else {
    const raw = body.commit;
    const commit = Array.isArray(raw) ? raw : [];
    const decisions: { handIndex: number; action: "implement" | "hold" }[] = [];
    for (const row of commit) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const hi = Math.floor(Number(o.handIndex));
      const act = o.action === "implement" ? "implement" : o.action === "hold" ? "hold" : "";
      if (!Number.isFinite(hi) || (act !== "implement" && act !== "hold")) continue;
      decisions.push({ handIndex: hi, action: act });
    }
    result = openingCommitInvestments(game, playerId, decisions);
  }

  if (result.error) {
    return { statusCode: 400, body: JSON.stringify({ error: result.error }) };
  }

  game = normalizeGame(result.game);

  await client.send(
    new PutItemCommand({
      TableName: Resource.Games.name,
      Item: marshall(
        {
          ...game,
          updatedAt: game.updatedAt,
        },
        { removeUndefinedValues: true }
      ),
    })
  );

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(game),
  };
};
