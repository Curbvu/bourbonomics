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

    const ws = new sst.aws.ApiGatewayWebSocket("Ws", {
      transform: {
        route: {
          handler: {
            link: [connectionsTable, gamesTable],
          },
        },
      },
    });
    ws.route("$connect", "functions/wsConnect.handler");
    ws.route("$disconnect", "functions/wsDisconnect.handler");
    ws.route("$default", "functions/wsDefault.handler");

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
