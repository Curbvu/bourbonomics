/**
 * Minimal local shape for the API Gateway WebSocket Lambda event.
 *
 * `@types/aws-lambda` exposes a moving target for WebSocket handler
 * signatures across versions; relying on the published name has bitten
 * us before. The fields below are the stable subset SST passes through
 * to a `$connect` / `$disconnect` / `$default` Lambda — anything more
 * specific is opt-in.
 */

export interface WsEvent {
  body?: string;
  requestContext: {
    connectionId: string;
    routeKey: string;
    /** Domain + stage form the API Gateway management endpoint. SST
     *  pre-resolves this for us via `Resource.GameWs.managementEndpoint`,
     *  so we don't read it from here in practice. */
    domainName?: string;
    stage?: string;
  };
}

export interface WsResult {
  statusCode: number;
  body?: string;
}

export type WsHandler = (event: WsEvent) => Promise<WsResult>;
