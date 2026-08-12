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
