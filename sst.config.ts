/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "bourbonomics",
      removal: input?.stage === "production" ? "retain" : "remove",
      home: "aws",
    };
  },
  async run() {
    const gamesTable = new sst.aws.Dynamo("Games", {
      fields: {
        gameId: "string",
      },
      primaryIndex: { hashKey: "gameId" },
    });

    const connectionsTable = new sst.aws.Dynamo("Connections", {
      fields: {
        connectionId: "string",
        gameId: "string",
      },
      primaryIndex: { hashKey: "connectionId" },
      globalIndexes: {
        GameIndex: { hashKey: "gameId", rangeKey: "connectionId" },
      },
    });

    // Do not set `link` on transform.route.handler: SST merges `{ ...routeArgs, ...transform }`,
    // which overwrites per-route `link` and drops `ws` on $default — breaking PostToConnection IAM.
    const ws = new sst.aws.ApiGatewayWebSocket("Ws");
    ws.route("$connect", {
      handler: "functions/wsConnect.handler",
      link: [connectionsTable, gamesTable],
    });
    ws.route("$disconnect", {
      handler: "functions/wsDisconnect.handler",
      link: [connectionsTable, gamesTable],
    });
    // Explicit ManageConnections: linking `ws` from its own route can omit IAM in some cases;
    // scope to this API’s execution ARN (trailing `/*` matches stage / POST / @connections / id).
    ws.route("$default", {
      handler: {
        handler: "functions/wsDefault.handler",
        link: [connectionsTable, gamesTable],
        permissions: [
          {
            actions: ["execute-api:ManageConnections"],
            resources: [$interpolate`${ws.nodes.api.executionArn}/*`],
          },
        ],
      },
    });

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowOrigins: ["*"],
        allowMethods: ["*"],
        allowHeaders: ["*"],
      },
      transform: {
        route: {
          handler: {
            link: [gamesTable],
          },
        },
      },
    });

    api.route("GET /health", "functions/health.handler");
    api.route("POST /games", "functions/createGame.handler");
    api.route("POST /games/{id}/join", "functions/joinGame.handler");
    api.route("GET /games/{id}", "functions/getGame.handler");
    api.route("POST /games/{id}/start", "functions/startGame.handler");
    api.route("POST /games/{id}/phase", "functions/advancePhase.handler");
    api.route("POST /games/{id}/roll-demand", "functions/rollDemand.handler");
    api.route("POST /games/{id}/buy", "functions/buyResources.handler");
    api.route("POST /games/{id}/rickhouse-fees", "functions/rickhouseFees.handler");
    api.route("POST /games/{id}/sell", "functions/sellBourbon.handler");
    api.route("POST /games/{id}/barrel", "functions/barrelBourbon.handler");
    api.route("POST /games/{id}/computer-turn", "functions/computerTurn.handler");
    api.route("POST /games/{id}/cards", "functions/gameCards.handler");

    const web = new sst.aws.Nextjs("Web", {
      link: [api, ws],
      environment: {
        NEXT_PUBLIC_API_URL: api.url,
        NEXT_PUBLIC_WS_URL: ws.url,
      },
    });

    return {
      apiUrl: api.url,
      webUrl: web.url,
      wsUrl: ws.url,
    };
  },
});
