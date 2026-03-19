import type { APIGatewayProxyResult } from "aws-lambda";
import type { APIGatewayProxyWebsocketEventV2 } from "aws-lambda/trigger/api-gateway-proxy";
import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { marshall } from "@aws-sdk/util-dynamodb";
import { Resource } from "sst";

const client = new DynamoDBClient({});

export const handler = async (
  event: APIGatewayProxyWebsocketEventV2
): Promise<APIGatewayProxyResult> => {
  const connectionId = event.requestContext.connectionId;

  await client.send(
    new DeleteItemCommand({
      TableName: Resource.Connections.name,
      Key: marshall({ connectionId }),
    })
  );

  return { statusCode: 200, body: "Disconnected" };
};
