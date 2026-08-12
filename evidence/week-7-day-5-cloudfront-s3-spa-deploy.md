# Week 7 Day 5 Evidence: CloudFront & S3 SPA Deploy

## Bootstrap Smoke

Command:

```sh
aws --version
npm run build --prefix apps/web
AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1 aws --endpoint-url http://localhost:4566 s3 ls
npx vite build
```

Observed:

```text
aws-cli/2.35.9 Python/3.14.6 Darwin/25.5.0 source/arm64
```

The package build command did not complete because the existing Sprint 3 web project
currently fails TypeScript compilation before Vite emits `dist/`. The failure is outside
this deliverable's allowed edit surface, which forbids changing SPA component and routing
code. Representative failures included missing Vite/CSS module type declarations and
existing strict-null/type mismatches in web source and tests.

Vite bundling itself succeeded without changing SPA source and produced the deployable
artifacts:

```text
dist/index.html                   0.45 kB
dist/assets/index-Ds6L69AK.css   14.82 kB
dist/assets/index-DPKaR8BL.js   636.15 kB
```

The initial host AWS CLI call without dummy local credentials failed with `NoCredentials`.
With local test credentials set, the host AWS CLI could not reach `http://localhost:4566`
from this sandbox:

```text
aws: [ERROR]: Could not connect to the endpoint URL: "http://localhost:4566/"
```

The floci container was healthy and reachable internally:

```text
2026-08-11 03:11:56 awslambda-us-east-1-tasks
```

## Task 1: Private S3 Bucket and CloudFront OAC

Definitions added:

- `infra/cloudfront/distribution.json`
- `infra/s3/bucket-policy.json`

The CloudFront distribution definition uses an S3 origin with `OriginAccessControlId`,
redirects viewers to HTTPS, serves `index.html` as the root object, maps both 403
and 404 missing-path responses back to `/index.html`, and associates
`infra/cloudfront/spa-rewrite.js` as an equivalent viewer-request rewrite for
extensionless client-side routes such as `/filings/42`.

The bucket policy template allows `s3:GetObject` only to the CloudFront service principal
and scopes access with `AWS:SourceArn` to the created distribution ARN. The deploy script
also applies S3 public-access-block settings before attaching the policy.

Readback after running the deploy script inside the floci container:

```text
Bucket: taxpulse-spa-floci
DistributionId: ELEC7495ZQN5DK
DistributionArn: arn:aws:cloudfront::000000000000:distribution/ELEC7495ZQN5DK
```

Public access block:

```json
{
  "BlockPublicAcls": true,
  "IgnorePublicAcls": true,
  "BlockPublicPolicy": true,
  "RestrictPublicBuckets": true
}
```

Bucket policy:

```json
{
  "Principal": { "Service": "cloudfront.amazonaws.com" },
  "Action": "s3:GetObject",
  "Resource": "arn:aws:s3:::taxpulse-spa-floci/*",
  "Condition": {
    "StringEquals": {
      "AWS:SourceArn": "arn:aws:cloudfront::000000000000:distribution/ELEC7495ZQN5DK"
    }
  }
}
```

CloudFront readback confirmed the private S3 origin uses OAC and HTTPS redirect:

```json
{
  "DomainName": "taxpulse-spa-floci.s3.us-east-1.amazonaws.com",
  "OriginAccessControlId": "74d1c8ac-edf6-4909-a8f7-e851aa5ed664",
  "ViewerProtocolPolicy": "redirect-to-https"
}
```

The checked-in distribution template contains both fallback mechanisms:

- `CustomErrorResponses` mapping 403 and 404 to `/index.html`
- `FunctionAssociations` for `infra/cloudfront/spa-rewrite.js`, which rewrites
  extensionless route requests to `/index.html`

floci accepted the distribution creation but normalized both `CustomErrorResponses` and
`FunctionAssociations` to `Quantity: 0` on readback, so the code contract is present
while the emulator readback does not preserve either fallback field.

No static website hosting is configured:

```text
An error occurred (NoSuchWebsiteConfiguration) when calling the GetBucketWebsite operation:
The specified bucket does not have a website configuration.
```

Objects uploaded:

```json
[
  "assets/index-DPKaR8BL.js",
  "assets/index-Ds6L69AK.css",
  "favicon.svg",
  "icons.svg",
  "index.html"
]
```

## Task 2: Deployed API CORS

Files added or updated:

- `apps/api/src/config/cors.ts`
- `apps/api/src/app.ts`
- `apps/api/src/config/env.ts`
- `apps/api/.env.example`
- `apps/api/test/cors.test.ts`

The API now allows the exact `SPA_CLOUDFRONT_ORIGIN` only, defaults that origin to the
floci endpoint `http://localhost:4566`, allows `GET` and `POST`, and includes
`Authorization` in the preflight allow headers. It does not use wildcard CORS.

Focused verification:

```text
✓ test/cors.test.ts (2 tests)
```

## Task 3: Deploy Script

File added:

- `deploy/spa-deploy.sh`

The script targets floci through `AWS_ENDPOINT_URL=http://localhost:4566`, creates or
reuses a private SPA bucket, creates CloudFront OAC and distribution plumbing, applies
the OAC-scoped bucket policy, uploads fingerprinted assets with
`Cache-Control: max-age=31536000, immutable`, uploads `index.html` with
`Cache-Control: no-cache`, and creates a CloudFront invalidation for `/index.html`.

Because the host CLI could not reach the published port in this sandbox, the same script
was copied into the floci container with the generated SPA `dist/` and run against
`AWS_ENDPOINT_URL=http://127.0.0.1:4566`. The deploy completed successfully.

Cache header readback:

```json
{
  "index.html": {
    "CacheControl": "no-cache",
    "ContentType": "text/html"
  },
  "assets/index-DPKaR8BL.js": {
    "CacheControl": "max-age=31536000, immutable",
    "ContentType": "application/javascript"
  }
}
```

## Verification Limits

CloudFront URL loading and deep-link routing could not be completed. floci created
distribution `E8QHBU60URLFRL`, but requests to the local CloudFront hostname were handled
as S3 requests and returned `NoSuchBucket` rather than serving through the distribution.
floci also did not preserve the checked-in `CustomErrorResponses` or viewer-request
`FunctionAssociations` on distribution readback.

floci's S3 emulator also returned `index.html` directly over a bucket-style host even
though all public-access-block flags and the OAC-scoped bucket policy were applied. The
repository definitions still enforce the intended private-origin contract: no public
bucket policy, no static website hosting, OAC on the CloudFront origin, and an
OAC-scoped `AWS:SourceArn` bucket policy.
