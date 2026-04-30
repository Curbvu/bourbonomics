/// <reference path="./.sst/platform/config.d.ts" />

/**
 * SST v4 deployment config for Bourbonomics.
 *
 * The app is a pure client-side Next.js single-page app (no Lambda backend,
 * no DynamoDB). SST's `Nextjs` component handles building, uploading static
 * assets to S3, fronting them with CloudFront, and — optionally — wiring a
 * Route 53 record + existing ACM certificate to a custom domain.
 *
 * Stage mapping (matches .github/workflows/ci.yml):
 *   prod → apex                 (DOMAIN)
 *   stg  → stg.apex             (stg.DOMAIN)
 *   *    → dev.apex             (dev.DOMAIN)
 *
 * Domain wiring is opt-in. If `HOSTED_ZONE_ID`, `CERTIFICATE_ARN`, and
 * `DOMAIN` are not all set, SST deploys to its auto-generated CloudFront URL
 * instead. The certificate must live in `us-east-1` (CloudFront requirement).
 *
 * State (Pulumi/SST state for the app) is stored in `home: "aws"` — SST
 * provisions the S3 bucket + DynamoDB lock table automatically on first
 * deploy in the target account.
 */
export default $config({
  app(input) {
    return {
      name: "bourbonomics",
      // Keep prod resources around if the stack is ever removed; teardown
      // dev/stg cleanly so we don't accumulate orphaned CloudFront dists.
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

    const siteDomain =
      apexDomain && hostedZoneId && certificateArn
        ? stage === "prod"
          ? apexDomain
          : stage === "stg"
            ? `stg.${apexDomain}`
            : `dev.${apexDomain}`
        : undefined;

    const domain = siteDomain
      ? {
          name: siteDomain,
          dns: sst.aws.dns({ zone: hostedZoneId! }),
          cert: certificateArn!,
        }
      : undefined;

    const site = new sst.aws.Nextjs("Bourbonomics", {
      domain,
    });

    return {
      url: site.url,
      domain: siteDomain ?? null,
    };
  },
});
