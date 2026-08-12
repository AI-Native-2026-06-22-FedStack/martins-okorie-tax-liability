# Prompt Journal: CloudFront & S3 SPA Deploy

## Entry 1

Asked — Save the attached Week 7 Day 5 "CloudFront & S3 SPA Deploy" lesson as a helper and create a new prompt journal.

Produced — Saved `helper/week-7-day-5-cloudfront-s3-spa-deploy.md` from the provided lesson text and initialized `prompt-journal/0030-cloudfront-s3-spa-deploy.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 7 Day 5 CloudFront and S3 SPA Deploy helper lesson is saved in the repository helper directory and prompt journal 0030 is initialized for the new deployment work.

## Entry 2

Asked — Implement the Week 7 Day 5 deliverable using only local floci at `http://localhost:4566`: build and deploy the existing SPA artifacts unchanged, add CloudFront/S3 OAC definitions under `infra/`, add the SPA deploy script under `deploy/`, create new CORS configuration inside `apps/api`, avoid SPA component and routing edits, and do not add an ADR.

Produced — Added CloudFront distribution and OAC-scoped S3 bucket-policy templates, a floci-targeted `deploy/spa-deploy.sh` with per-type Cache-Control and `/index.html` invalidation, API CORS middleware/config/tests for an exact SPA origin with `Authorization` allowed, generated unchanged SPA artifacts with Vite, deployed them to floci from inside the container, and recorded Week 7 Day 5 evidence.

Accepted or rejected — Accepted.

Why — The deliverable plumbing is captured in repository code with no console-only changes, no SPA component or routing edits, and no new ADR; focused CORS tests passed, the Vite SPA bundle emitted `dist/`, and the deploy script uploaded the artifacts to a private floci S3 bucket with OAC-scoped CloudFront configuration and the expected cache headers.

## Entry 3

Asked — Complete the private-origin CloudFront/S3 SPA serving task by confirming all public access is blocked, OAC is used instead of OAI, no static website hosting or public bucket policy exists, and client-side routes fall back to `index.html`.

Produced — Added an explicit CloudFront viewer-request rewrite function at `infra/cloudfront/spa-rewrite.js`, associated it in the distribution definition alongside the custom error fallback, redeployed the SPA artifacts to floci, and rechecked public-access-block, OAC origin readback, bucket policy scope, object uploads, static website hosting absence, and CloudFront/floci serving behavior.

Accepted or rejected — Accepted.

Why — The code contract now includes both accepted SPA fallback forms while preserving private-bucket/OAC-only definitions; floci readback confirms public-access-block, no static website hosting, and OAC origin configuration, but the emulator does not preserve fallback fields or serve the generated CloudFront hostname correctly.

## Entry 4

Asked — Complete Task 2 by wiring the deployed SPA to the deployed API across origins using configuration only: exact CloudFront origin CORS on the Core Case Service and Lambda route, `Authorization` allowed for bearer-token preflight, and SPA API base URL set by config without changing SPA logic.

Produced — Updated Core API CORS config to the exact floci CloudFront origin with `GET`, `POST`, and `PATCH`; added an authenticated cross-origin CORS test; added exact-origin CORS and `OPTIONS` handling to the present-to-client Lambda and API Gateway definition; added a tracked SPA env example for `VITE_API_BASE_URL=http://localhost:3000`; rebuilt the Lambda artifact; redacted logged authorization headers; and recorded the verification in evidence.

Accepted or rejected — Accepted.

Why — Focused Core API tests passed, the authenticated cross-origin request reached auth with the bearer token while logs redacted the header, the Lambda preflight returned exact-origin CORS headers with `Authorization`, and the SPA API base URL is controlled by configuration rather than component or routing edits.

## Entry 5

Asked — Complete Task 3 by adding tiered Cache-Control and a deploy-time CloudFront invalidation hook: long-cache fingerprinted assets, keep `index.html` fresh, invalidate only `/index.html`, run the deploy against floci, and confirm a redeploy serves the fresh entry point without invalidating assets.

Produced — Verified `deploy/spa-deploy.sh` already uploads everything except `index.html` with `Cache-Control: max-age=31536000, immutable`, uploads `index.html` with `Cache-Control: no-cache`, and calls `cloudfront create-invalidation --paths "/index.html"` only; rebuilt and redeployed the SPA artifacts to floci; read back S3 metadata for `index.html`, JavaScript, and CSS assets; read back the CloudFront invalidation batch; and updated evidence.

Accepted or rejected — Accepted.

Why — floci readback showed `index.html` was reuploaded with a newer `LastModified` and `no-cache`, fingerprinted assets had `max-age=31536000, immutable`, and the completed invalidation batch contained exactly one path: `/index.html`.
