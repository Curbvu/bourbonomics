/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v4 deployment config for Bourbonomics (the redesigned game).
 *
 * The game is a single **client-only** Next.js site (`apps/prototype`).
 * There is no game server / DynamoDB yet — the prototype runs the engine
 * locally in the browser; multiplayer + the WebSocket server return in a
 * later batch. SST builds the site, uploads it to S3, fronts it with
 * CloudFront, and (optionally) wires Route 53 + ACM for a custom domain.
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

    const site = new sst.aws.Nextjs("Bourbonomics", {
      domain: siteDomain
        ? {
            name: siteDomain,
            dns: sst.aws.dns({ zone: hostedZoneId! }),
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
