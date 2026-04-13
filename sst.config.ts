/// <reference path="./.sst/platform/config.d.ts" />

export default $config({
  app(input) {
    return {
      name: "bourbonomics",
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: ["prod"].includes(input?.stage ?? ""),
      home: "aws",
    };
  },
  async run() {
    const hostedZoneId = process.env.HOSTED_ZONE_ID;
    const certificateArn = process.env.CERTIFICATE_ARN;
    const apexDomain = process.env.DOMAIN?.replace(/\.$/, "");
    const stageName = process.env.STAGE;

    const siteDomain =
      hostedZoneId && certificateArn && apexDomain && stageName
        ? stageName === "prod"
          ? apexDomain
          : stageName === "stg"
            ? `stg.${apexDomain}`
            : `dev.${apexDomain}`
        : undefined;

    const webDomain =
      siteDomain != null
        ? {
            name: siteDomain,
            dns: sst.aws.dns({ zone: hostedZoneId! }),
            cert: certificateArn!,
          }
        : undefined;
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

    // Per-route `link` / `permissions` only — `transform.route.handler` must be a callback in SST v4,
    // not a plain object; a `{ link }` object there was unmarshaled as `handler` and broke deploy.
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
      handler: "functions/wsDefault.handler",
      link: [connectionsTable, gamesTable],
      permissions: [
        {
          actions: ["execute-api:ManageConnections"],
          resources: [$interpolate`${ws.nodes.api.executionArn}/*`],
        },
      ],
    });

    const api = new sst.aws.ApiGatewayV2("Api", {
      cors: {
        allowOrigins: ["*"],
        allowMethods: ["*"],
        allowHeaders: ["*"],
      },
    });

    const gameLink = { link: [gamesTable] };

    api.route("GET /health", "functions/health.handler");
    api.route("POST /games", {
      handler: "functions/createGame.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/join", {
      handler: "functions/joinGame.handler",
      ...gameLink,
    });
    api.route("GET /games/{id}", {
      handler: "functions/getGame.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/start", {
      handler: "functions/startGame.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/lobby-seat", {
      handler: "functions/lobbySeat.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/phase", {
      handler: "functions/advancePhase.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/pass", {
      handler: "functions/passAction.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/roll-demand", {
      handler: "functions/rollDemand.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/buy", {
      handler: "functions/buyResources.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/rickhouse-fees", {
      handler: "functions/rickhouseFees.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/sell", {
      handler: "functions/sellBourbon.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/barrel", {
      handler: "functions/barrelBourbon.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/computer-turn", {
      handler: "functions/computerTurn.handler",
      ...gameLink,
    });
    api.route("POST /games/{id}/cards", {
      handler: "functions/gameCards.handler",
      ...gameLink,
    });

    const web = new sst.aws.Nextjs("Web", {
      ...(webDomain ? { domain: webDomain } : {}),
      link: [api, ws],
      environment: {
        NEXT_PUBLIC_API_URL: api.url,
        NEXT_PUBLIC_WS_URL: ws.url,
      },
    });

    return {
      apiUrl: api.url,
      webUrl: web.url,
      siteDomain: siteDomain ?? "",
      wsUrl: ws.url,
    };
  },
});
