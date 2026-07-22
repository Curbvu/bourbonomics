/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v4 deployment config for Bourbonomics (the redesigned game).
 *
 * The game is a Next.js site (`apps/prototype`) that runs the engine locally in
 * the browser. SST builds the site, uploads it to S3, fronts it with CloudFront,
 * and (optionally) wires Route 53 + ACM for a custom domain.
 *
 * ── Online multiplayer (OPT-IN, env-gated) ───────────────────────────────
 * Set `ENABLE_MULTIPLAYER=true` to also provision an authoritative game server:
 * a DynamoDB table (`Rooms`) + an API Gateway WebSocket API backed by one Lambda
 * (`apps/prototype/src/server/rooms.ts`). The Lambda runs the SAME pure engine
 * and broadcasts state to a room's connections; its wss URL is injected into the
 * site as `NEXT_PUBLIC_WS_URL`. When the flag is UNSET (the default) none of that
 * is created and the site deploys exactly as before — the client runs local-only.
 *
 * Stage → host (matches `.github/workflows/ci.yml`):
 *   prod → <apex>          (DOMAIN — the game root, e.g. playbourbonomics.com)
 *   dev  → dev.<apex>      (dev.DOMAIN)
 *   stg  → stg.<apex>      (stg.DOMAIN)
 *   *    → auto-generated CloudFront URL
 *
 * Domain wiring is opt-in. If `HOSTED_ZONE_ID`, `CERTIFICATE_ARN`, and
 * `DOMAIN` are not all set, SST deploys to its auto-generated CloudFront URL
 * instead. The certificate must live in `us-east-1` (CloudFront requirement)
 * and cover both the bare `<apex>` (a SAN) and `*.<apex>` (for dev/stg).
 *
 * ── One-time migration to this config ────────────────────────────────────
 * This config consolidates the former isolated prototype stages (proto-prod /
 * proto-dev) and the retired P1 live-game stages into a single mainline:
 * `prod` owns the apex, `dev` owns dev.<apex>. Route 53 can alias the apex to
 * only ONE CloudFront distribution at a time, so before this config's `prod`
 * deploy can claim the apex you must first release it from whatever stack
 * currently holds it. Sequence (run manually — CI never does this):
 *   1. Release the apex from its current owner (the old `proto-prod` stack):
 *      `sst remove --stage proto-prod`, or redeploy that stack without a domain.
 *   2. Deploy this config's apex: `sst deploy --stage prod`.
 *   3. Retire the remaining legacy stacks at your discretion — the old P1
 *      live game (`prod` at legacy.<apex>, `stg`, `dev-legacy`) and `proto-dev`.
 *      They are parked: no branch auto-deploys them under the new ci.yml.
 * The `dev` / `stg` subdomains migrate the same way but are lower-stakes.
 */
export default $config({
  app(input) {
    return {
      name: "bourbonomics",
      // Retain + protect only the apex (`prod`) stack so a stray teardown can
      // never drop production. Every other stage (dev/stg/preview) removes
      // cleanly so we don't accumulate orphaned CloudFront dists.
      removal: input?.stage === "prod" ? "retain" : "remove",
      protect: input?.stage === "prod",
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

    // prod → apex, dev → dev.apex, stg → stg.apex; anything else falls back to
    // the auto-generated CloudFront URL (preview branches, local stages).
    const siteDomain =
      apexDomain && hostedZoneId && certificateArn
        ? stage === "prod"
          ? apexDomain
          : stage === "dev"
            ? `dev.${apexDomain}`
            : stage === "stg"
              ? `stg.${apexDomain}`
              : undefined
        : undefined;

    // ── Online multiplayer (opt-in) ──────────────────────────────────────
    // Provision the room server only when explicitly enabled, so the default
    // deploy path is byte-for-byte unchanged.
    let wsUrl: string | undefined;
    if (process.env.ENABLE_MULTIPLAYER === "true") {
      const rooms = new sst.aws.Dynamo("Rooms", {
        fields: { pk: "string" },
        primaryIndex: { hashKey: "pk" },
      });
      const ws = new sst.aws.ApiGatewayWebSocket("GameWs");
      const route = {
        handler: "apps/prototype/src/server/rooms.handler",
        link: [rooms],
        permissions: [{ actions: ["execute-api:ManageConnections"], resources: ["*"] }],
        nodejs: {
          install: [
            "@aws-sdk/client-apigatewaymanagementapi",
            "@aws-sdk/client-dynamodb",
            "@aws-sdk/lib-dynamodb",
          ],
        },
      };
      ws.route("$connect", route);
      ws.route("$disconnect", route);
      ws.route("$default", route);
      wsUrl = ws.url;
    }

    const site = new sst.aws.Nextjs("Bourbonomics", {
      environment: wsUrl ? { NEXT_PUBLIC_WS_URL: wsUrl } : {},
      domain: siteDomain
        ? {
            name: siteDomain,
            // `override: true` makes the A/AAAA records UPSERT instead of
            // CREATE, so a deploy reclaims records orphaned by a prior
            // dev/stg stack (lost SST state) instead of failing with
            // "record set already exists". Scoped to non-prod: the apex
            // (prod) keeps the deliberate, manual one-at-a-time aliasing
            // documented above — we never auto-clobber the production root.
            dns: sst.aws.dns({ zone: hostedZoneId!, override: stage !== "prod" }),
            cert: certificateArn!,
          }
        : undefined,
      path: "apps/prototype",
    });

    return {
      url: site.url,
      domain: siteDomain ?? null,
    };
  },
});
