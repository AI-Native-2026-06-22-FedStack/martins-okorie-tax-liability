# Week 7 Day 5 PR — CloudFront & S3 SPA Deploy

## Summary

Deploys the existing `apps/web` Vite SPA artifacts to a private S3 origin behind a
CloudFront distribution definition for floci. The bucket blocks public access, avoids S3
static-website hosting, and grants object reads only to CloudFront through an
OAC-scoped bucket policy. The CloudFront config uses OAC rather than OAI and includes
SPA fallback definitions for client-side routes.

Adds deployed-origin CORS for the Core Case Service and the present-to-client Lambda route.
The APIs allow the exact floci CloudFront origin, include `Authorization` for bearer-token
preflight, and keep the SPA API base URL as Vite configuration rather than SPA logic.

Adds deploy-time cache behavior: immutable long-cache for fingerprinted assets,
`no-cache` for `index.html`, and a CloudFront invalidation for `/index.html` only.
All AWS-shaped work targets floci at `http://localhost:4566`; no cloud account is used.

## Related ADR

ADR: N/A — no new architectural decision is introduced for this deploy plumbing deliverable.

## Testing

- `aws --version`
- `npm run build --prefix apps/web`
- `env VITE_API_BASE_URL=http://localhost:3000 npx vite build`
- `node -e "JSON.parse(require('fs').readFileSync('infra/cloudfront/distribution.json','utf8')); JSON.parse(require('fs').readFileSync('infra/s3/bucket-policy.json','utf8'))"`
- `bash -n deploy/spa-deploy.sh`
- `node` static guard for OAC, empty OAI, SPA fallback, CloudFront-only bucket policy, and no public principal
- `rg -n "WebsiteConfiguration|static-website|OriginAccessIdentity\": \"[^\"]|Principal\": \"\\*\"|public-read" infra deploy apps/api/src/config/cors.ts apps/api/src/app.ts`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api get-public-access-block --bucket taxpulse-spa-floci`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api get-bucket-policy --bucket taxpulse-spa-floci`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api get-bucket-website --bucket taxpulse-spa-floci`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 cloudfront get-distribution-config --id E8QHBU60URLFRL`
- `docker compose exec -T floci sh -lc 'AWS_ENDPOINT_URL=http://127.0.0.1:4566 ... /tmp/taxpulse-spa/deploy/spa-deploy.sh'`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api head-object --bucket taxpulse-spa-floci --key index.html`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api head-object --bucket taxpulse-spa-floci --key assets/index-BTyqfvbq.js`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 cloudfront get-invalidation --distribution-id EBE8OZYBEI79JH --id IZM9ID39A38EAN`
- `npm run test -- --run test/cors.test.ts`
- `node --input-type=module` Lambda `OPTIONS` preflight check against `lambda/present-to-client/dist/handler.js`
- `node` static guard for exact-origin CORS, `Authorization` allow header, and `VITE_API_BASE_URL=http://localhost:3000`
- `git diff --check`

Verification output:

```text
$ aws --version
aws-cli/2.35.9 Python/3.14.6 Darwin/25.5.0 source/arm64

$ npm run build --prefix apps/web
Result: failed before Vite emit due existing Sprint 3 TypeScript issues outside this
deliverable's allowed edit surface, including missing Vite/CSS module type declarations
and existing strict-null/type mismatches.

$ env VITE_API_BASE_URL=http://localhost:3000 npx vite build
dist/index.html                   0.45 kB
dist/assets/index-Ds6L69AK.css   14.82 kB
dist/assets/index-BTyqfvbq.js   636.17 kB
✓ built

$ node -e "JSON.parse(require('fs').readFileSync('infra/cloudfront/distribution.json','utf8')); JSON.parse(require('fs').readFileSync('infra/s3/bucket-policy.json','utf8')); console.log('infra json ok')"
infra json ok

$ bash -n deploy/spa-deploy.sh
Result: passed.

$ node static private-origin guard
private CloudFront/S3 contract ok

$ rg -n 'WebsiteConfiguration|static-website|OriginAccessIdentity": "[^"]|Principal": "\*"|public-read' infra deploy apps/api/src/config/cors.ts apps/api/src/app.ts
Result: no matches.

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api get-public-access-block --bucket taxpulse-spa-floci
{
  "PublicAccessBlockConfiguration": {
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }
}

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api get-bucket-policy --bucket taxpulse-spa-floci --query Policy --output text
{
  "Principal": { "Service": "cloudfront.amazonaws.com" },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::taxpulse-spa-floci/*",
  "Condition": {
    "StringEquals": {
      "AWS:SourceArn": "arn:aws:cloudfront::000000000000:distribution/E8QHBU60URLFRL"
    }
  }
}

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api get-bucket-website --bucket taxpulse-spa-floci
An error occurred (NoSuchWebsiteConfiguration) when calling the GetBucketWebsite operation:
The specified bucket does not have a website configuration.

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 cloudfront get-distribution-config --id E8QHBU60URLFRL --query 'DistributionConfig.{Origins:Origins.Items,ViewerProtocolPolicy:DefaultCacheBehavior.ViewerProtocolPolicy}'
{
  "Origins": [
    {
      "DomainName": "taxpulse-spa-floci.s3.us-east-1.amazonaws.com",
      "S3OriginConfig": { "OriginAccessIdentity": "" },
      "OriginAccessControlId": "74d1c8ac-edf6-4909-a8f7-e851aa5ed664"
    }
  ],
  "ViewerProtocolPolicy": "redirect-to-https"
}

$ docker compose exec -T floci sh -lc 'AWS_ENDPOINT_URL=http://127.0.0.1:4566 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1 /tmp/taxpulse-spa/deploy/spa-deploy.sh'
Uploading immutable SPA assets
Uploading fresh SPA entry point
Invalidating CloudFront entry point
SPA deploy complete
Bucket: taxpulse-spa-floci
DistributionId: EBE8OZYBEI79JH

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api head-object --bucket taxpulse-spa-floci --key index.html
{
  "CacheControl": "no-cache",
  "LastModified": "Wed, 12 Aug 2026 16:49:47 GMT",
  "ContentType": "text/html"
}

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api head-object --bucket taxpulse-spa-floci --key assets/index-BTyqfvbq.js
{
  "CacheControl": "max-age=31536000, immutable",
  "ContentType": "application/javascript"
}

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 s3api head-object --bucket taxpulse-spa-floci --key assets/index-Ds6L69AK.css
{
  "CacheControl": "max-age=31536000, immutable",
  "ContentType": "text/css"
}

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 cloudfront get-invalidation --distribution-id EBE8OZYBEI79JH --id IZM9ID39A38EAN
{
  "Invalidation": {
    "Status": "Completed",
    "InvalidationBatch": {
      "Paths": {
        "Quantity": 1,
        "Items": ["/index.html"]
      }
    }
  }
}

$ npm run test -- --run test/cors.test.ts
✓ test/cors.test.ts (3 tests)

Core API CORS checks:
access-control-allow-origin: http://E8QHBU60URLFRL.cloudfront.localhost.localstack.cloud:4566
access-control-allow-methods: GET, POST, PATCH
access-control-allow-headers: Content-Type, Authorization, X-Correlation-Id

Authenticated cross-origin POST returned 400 instead of 401, confirming the bearer token
reached the protected route and auth accepted it before body validation. The request log
redacted the bearer value as authorization="[REDACTED]".

$ node --input-type=module Lambda OPTIONS preflight check
lambda cors preflight ok

Lambda OPTIONS response:
statusCode: 204
access-control-allow-origin: http://E8QHBU60URLFRL.cloudfront.localhost.localstack.cloud:4566
access-control-allow-methods: POST, OPTIONS
access-control-allow-headers: Content-Type, Authorization, X-Correlation-Id

$ node static CORS/base-url guard
cors/base-url static contract ok

$ git diff --check
Result: no whitespace errors.
```

floci fidelity notes:

```text
The free/community floci CloudFront emulator accepted the distribution creation and
recorded invalidations, but generated CloudFront hostnames were handled as S3 requests
and returned NoSuchBucket rather than serving through the distribution.

floci also normalized checked-in CustomErrorResponses and FunctionAssociations to
Quantity: 0 on distribution readback, even though the repository definition includes both
the 403/404 /index.html fallback and the viewer-request rewrite function. Repeat the
CloudFront URL render and deep-link proof on a floci/LocalStack tier with full CloudFront
serving support or in real AWS.
```

## AI review evidence

Paste the sample PR AI-review output as a quote or code block:

```text
Rubric result: Pass with floci CloudFront serving caveats.

- Private origin: infra/s3/bucket-policy.json grants s3:GetObject only to the CloudFront
  service principal scoped by AWS:SourceArn, and floci readback shows all four public
  access block settings enabled. No S3 static website hosting is configured, no public
  bucket policy is present, and the CloudFront origin uses OriginAccessControlId with an
  empty OriginAccessIdentity.
- SPA fallback: infra/cloudfront/distribution.json includes CustomErrorResponses mapping
  missing paths to /index.html and a viewer-request rewrite function for extensionless
  client-side routes. The repo uses OAC, not OAI.
- CORS and bearer flow: apps/api/src/config/cors.ts allows only the exact floci
  CloudFront origin, allows GET/POST/PATCH, includes Authorization, and rejects an
  unrelated origin. The Lambda route returns exact-origin CORS for OPTIONS and normal
  responses. The SPA API base URL is controlled by VITE_API_BASE_URL.
- Cache/invalidation: deploy/spa-deploy.sh uploads assets except index.html with
  max-age=31536000, immutable; uploads index.html with no-cache; and invalidates only
  /index.html. floci readback confirms cache headers and an invalidation batch with one
  path.
```

Paste the "what it missed" note as a quote or code block:

```text
The first pass could have overstated the CloudFront browser proof. A human review caught
that the free/community floci emulator accepted CloudFront API calls but did not serve the
generated CloudFront hostname or preserve fallback fields on readback. The PR documents
that limitation rather than claiming the CloudFront URL render/deep-link check passed.

The review also caught that request logs printed a synthetic bearer token during the CORS
test. shared/redaction-config.json now redacts req.headers.authorization so the bearer-flow
verification does not leak token material in logs.
```

## AI-tool reflection

I accepted Codex's suggestion to keep Task 3 as verification of the existing deploy script
instead of rewriting working deploy plumbing, because the script already had the correct
three-step cache strategy and floci readback proved the behavior. I rejected the tempting
workaround of faking CloudFront locally with app code or public S3 website hosting, because
that would prove the wrong architecture; the PR keeps the private S3 + OAC + CloudFront
contract in code and documents the emulator limitation.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli`.

## AI code-review checklist

- [x] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [x] Workflow changes keep stage transitions gated by role and current stage.
- [x] typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns.
- [x] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [x] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [x] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [x] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

## Deliverables checklist

- [x] Summary explains what changed.
- [x] Related ADR is linked, or `N/A` is stated for no architectural decision change.
- [x] Testing lists only checks or verification actually performed.
- [x] AI code-review checklist is completed.
- [x] AI review output is pasted above as a quote or code block.
- [x] "What it missed" note is pasted above as a quote or code block.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] PR is self-assigned in Assignees.
- [x] `Isaiah Muli` is requested under Reviewers.
