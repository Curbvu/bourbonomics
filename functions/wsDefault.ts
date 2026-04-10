import type { APIGatewayProxyResult } from "aws-lambda";
import type { APIGatewayProxyWebsocketEventV2 } from "aws-lambda/trigger/api-gateway-proxy";
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";
import { normalizeGame, type GameDoc } from "./lib/game";

const client = new DynamoDBClient({});

export const handler = async (
  event: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;
  let body: unknown = {};
  try {
    if (event.body) body = JSON.parse(event.body);
  } catch {
    return { statusCode: 200, body: "OK" };
  }

  const msg = body as { action?: string; gameId?: string };
  if (msg.action === "getGame" && msg.gameId) {
    const gameId = String(msg.gameId).toUpperCase();
    const res = await client.send(
      new GetItemCommand({
        TableName: Resource.Games.name,
        Key: marshall({ gameId }),
      })
    );
    if (res.Item) {
      const game = normalizeGame(unmarshall(res.Item) as GameDoc);
      const endpoint = `https://${event.requestContext.domainName}/${event.requestContext.stage}`;
      const { ApiGatewayManagementApiClient, PostToConnectionCommand } = await import(
        "@aws-sdk/client-apigatewaymanagementapi"
      );
      const mgmt = new ApiGatewayManagementApiClient({ endpoint });
      await mgmt.send(
        new PostToConnectionCommand({
          ConnectionId: connectionId,
          Data: JSON.stringify({ type: "game", game }),
        })
      );
    }
  }

  return { statusCode: 200, body: "OK" };
};
