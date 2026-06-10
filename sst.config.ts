/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v4 deployment config for Bourbonomics.
 *
 * Two halves:
 *
 *   1. **Static site** — `sst.aws.Nextjs("Bourbonomics")` builds the
 *      `packages/client` Next.js app, uploads it to S3, fronts it with
 *      CloudFront, and (optionally) wires Route 53 + ACM for a custom
 *      domain.
 *
 *   2. **Multi-player game server** — DynamoDB tables for room state +
 *      live connections, an API Gateway WebSocket API for client traffic,
 *      and four Lambda handlers (connect / disconnect / action / tick).
 *      The client signs into a room via the WebSocket URL; every game
 *      action round-trips through the `action` handler so the server
 *      stays authoritative.
 *
 * Stage mapping (matches `.github/workflows/ci.yml`):
 *   prod → legacy.apex          (legacy.DOMAIN — the P1 live game, retired to legacy.)
 *   stg  → stg.apex             (stg.DOMAIN)
 *   *    → dev-legacy.apex      (dev-legacy.DOMAIN)
 *
 * Prototype (P2) stages are fully isolated and deploy ONLY the prototype
 * Next.js site (no game server / DynamoDB / live site). P2 is now the
 * primary product and owns the apex root + dev.apex:
 *   proto-prod → apex                 (DOMAIN — the P2 root site)
 *   proto-dev  → dev.apex             (dev.DOMAIN)
 *
 * Domain wiring is opt-in. If `HOSTED_ZONE_ID`, `CERTIFICATE_ARN`, and
 * `DOMAIN` are not all set, SST deploys to its auto-generated CloudFront
 * URL instead. The certificate must live in `us-east-1` (CloudFront
 * requirement).
 *
 * Each stage gets its own isolated copy of the Lambdas + DynamoDB
 * tables — `prod` traffic and `dev` traffic never share state.
 */
export default $config({
  app(input) {
    return {
      name: "bourbonomics",
      // Keep the two production stacks around if ever removed: `prod` (the
      // P1 live game, now at legacy.) and `proto-prod` (the P2 root site).
      // Teardown dev/stg cleanly so we don't accumulate orphaned CloudFront
      // dists, Lambdas, and DynamoDB tables.
      removal:
        input?.stage === "prod" || input?.stage === "proto-prod"
          ? "retain"
          : "remove",
      protect: input?.stage === "prod" || input?.stage === "proto-prod",
      home: "aws",
      providers: {
        aws: { region: "us-east-1" },
      },
    };
  },
  async run() {
    const stage = $app.stage;
    const apexDomain = process.env.DOMAIN?.replace(/\.$/, "");
    const hostedZoneId = process.env.HOSTED_ZONE_ID;
    const certificateArn = process.env.CERTIFICATE_ARN;

    // ---------------------------------------------------------------
    // Prototype stages are FULLY ISOLATED. Any stage whose name starts
    // with `proto-` deploys ONLY the prototype Next.js site — no live
    // game site, no game server, no DynamoDB tables. Conversely, the
    // live stages (prod/stg/dev/etc.) never create the prototype site.
    // This guarantees that pushing a prototype branch can never
    // redeploy or otherwise disturb the live game, and vice versa.
    //
    // P2 is now the primary product and owns the apex root:
    //   proto-prod → <apex>          (root)
    //   proto-dev  → dev.<apex>
    //
    // The wildcard CERTIFICATE_ARN (`*.<apex>`) covers `dev.<apex>`, and
    // a bare `<apex>` SAN (or the apex on the same cert) covers the root;
    // other prototype stages fall back to the auto-generated CloudFront URL.
    // ---------------------------------------------------------------
    const isPrototypeStage = stage.startsWith("proto-");

    if (isPrototypeStage) {
      const prototypeDomain =
        apexDomain && hostedZoneId && certificateArn
          ? stage === "proto-prod"
            ? apexDomain
            : stage === "proto-dev"
              ? `dev.${apexDomain}`
              : undefined
          : undefined;

      const prototype = new sst.aws.Nextjs("BourbonomicsPrototype", {
        domain: prototypeDomain
          ? {
              name: prototypeDomain,
              // NOTE: no `www.<apex>` → root redirect here. SST auto-names the
              // redirect CloudFront Function after the component
              // ("BourbonomicsPrototypeCdnRedirect…"), which overflows the
              // 64-char CloudFront Function name limit. Re-add `www` via a
              // separately-named mechanism (shorter component or a Route 53
              // / S3 redirect) as a follow-up.
              dns: sst.aws.dns({ zone: hostedZoneId! }),
              cert: certificateArn!,
            }
          : undefined,
        path: "apps/prototype",
      });

      return {
        prototypeUrl: prototype.url,
        prototypeDomain: prototypeDomain ?? null,
      };
    }

    // The P1 live game is retired to `legacy.<apex>` (prod) and
    // `dev-legacy.<apex>` (dev/other); P2 owns the apex root + dev.apex.
    const siteDomain =
      apexDomain && hostedZoneId && certificateArn
        ? stage === "prod"
          ? `legacy.${apexDomain}`
          : stage === "stg"
            ? `stg.${apexDomain}`
            : `dev-legacy.${apexDomain}`
        : undefined;

    const domain = siteDomain
      ? {
          name: siteDomain,
          // The live game deploys to bare subdomains (legacy./dev-legacy./
          // stg.); the `www.<apex>` → root redirect now lives on the P2
          // root site (proto-prod) above.
          dns: sst.aws.dns({ zone: hostedZoneId! }),
          cert: certificateArn!,
        }
      : undefined;

    // ---------------------------------------------------------------
    // Multi-player game server
    // ---------------------------------------------------------------
    // DynamoDB: one row per active game room (`code` is the 4-char
    // join code; the row holds the full serialized GameState plus
    // bookkeeping for the bot-tick scheduler).
    const rooms = new sst.aws.Dynamo("Rooms", {
      fields: {
        code: "string",
      },
      primaryIndex: { hashKey: "code" },
      // 14-day TTL on `expiresAt` keeps abandoned rooms from accumulating;
      // the field is set by the action handler on every write.
      ttl: "expiresAt",
    });

    // DynamoDB: one row per live WebSocket connection. We need the
    // `roomCode` GSI so that a SELL_BOURBON dispatch can iterate every
    // connection in a room and broadcast the new state.
    const connections = new sst.aws.Dynamo("Connections", {
      fields: {
        connectionId: "string",
        roomCode: "string",
      },
      primaryIndex: { hashKey: "connectionId" },
      globalIndexes: {
        ByRoom: { hashKey: "roomCode" },
      },
      ttl: "expiresAt",
    });

    // WebSocket API. Three explicit routes plus the synthetic `$connect`
    // / `$disconnect` ones; everything else lands on `$default` so the
    // client can extend the action shape without an SST redeploy.
    const wsApi = new sst.aws.ApiGatewayWebSocket("GameWs");

    // The action + tick handlers need permission to call back into API
    // Gateway's management API to push state updates to subscribed
    // clients. We grant `execute-api:ManageConnections` against the
    // wsApi's runtime ARN and let SST's resource-link auto-import the
    // bound DynamoDB tables.
    const sharedHandlerProps = {
      link: [rooms, connections, wsApi],
      runtime: "nodejs22.x" as const,
      // Bumped from 10s to 15s — `$connect` cold starts on a freshly
      // deployed stack can hit ~6s for the SDK + Resource binding
      // bootstrap, which sometimes brushed up against the prior
      // budget and returned 502 to the client.
      timeout: "15 seconds" as const,
      memory: "256 MB" as const,
      // Bundle the engine workspace into each Lambda — esbuild walks the
      // monorepo via Node's module resolution, so importing
      // `@bourbonomics/engine` Just Works once the bundler runs. Immer
      // is the only native-ish dep that needs explicit install; the
      // AWS SDK packages are in the Node 22 Lambda runtime.
      nodejs: { install: ["immer"] },
    };

    wsApi.route("$connect", {
      handler: "packages/server/src/handlers/connect.handler",
      ...sharedHandlerProps,
    });
    wsApi.route("$disconnect", {
      handler: "packages/server/src/handlers/disconnect.handler",
      ...sharedHandlerProps,
    });
    wsApi.route("$default", {
      handler: "packages/server/src/handlers/action.handler",
      ...sharedHandlerProps,
    });

    // Bot-tick scheduler. Every 1s the EventBridge rule fires the tick
    // Lambda, which scans for rooms with bots on the clock and steps
    // the orchestrator forward. Cheap (one DynamoDB scan + 0–N writes
    // per second per stage) and decouples bot pacing from client
    // traffic.
    const tickFn = new sst.aws.Function("Tick", {
      handler: "packages/server/src/handlers/tick.handler",
      ...sharedHandlerProps,
    });
    new sst.aws.Cron("TickSchedule", {
      schedule: "rate(1 minute)",
      function: tickFn.arn,
    });

    // ---------------------------------------------------------------
    // Static site — depends on `wsApi.url` so the client knows where
    // to point the WebSocket at runtime.
    // ---------------------------------------------------------------
    const site = new sst.aws.Nextjs("Bourbonomics", {
      domain,
      path: "packages/client",
      environment: {
        NEXT_PUBLIC_GAME_WS_URL: wsApi.url,
      },
    });

    return {
      url: site.url,
      domain: siteDomain ?? null,
      wsUrl: wsApi.url,
      roomsTable: rooms.name,
      connectionsTable: connections.name,
    };
  },
});
