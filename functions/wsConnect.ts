import type { APIGatewayProxyResult } from "aws-lambda";
import type { APIGatewayProxyWebsocketEventV2 } from "aws-lambda/trigger/api-gateway-proxy";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const client = new DynamoDBClient({});

export const handler = async (
  event: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;
  const qs = event.queryStringParameters ?? {};
  const gameId = (qs.gameId ?? "").toUpperCase();
  const playerId = qs.playerId ?? "";

  if (!gameId) {
    return { statusCode: 400, body: "Missing gameId" };
  }

  await client.send(
    new PutItemCommand({
      TableName: Resource.Connections.name,
      Item: marshall({
        connectionId,
        gameId,
        playerId,
      }),
    })
  );

  return { statusCode: 200, body: "Connected" };
};
