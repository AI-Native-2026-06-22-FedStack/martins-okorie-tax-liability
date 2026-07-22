# Prompt Journal: REST Versioning, Service Boundaries, Sync Calls & Secrets

## Entry 1

Asked — Create the Week 3 Day 5 lesson as a helper and start a brand new prompt journal.

Produced — Added `helper/week-3-day-5-rest-versioning-service-boundaries-sync-calls-secrets.md` summarizing REST versioning with Deprecation and Sunset headers, bounded contexts and anti-shared-DB rules, synchronous service-call failure handling, managed runtime secrets with rotation and least privilege, and the practice verification checklist. Started this new prompt journal file.

Accepted or rejected — Accepted.

Why — The helper captures the attached lesson in the repo's existing helper format, and the new journal is the next sequential prompt journal file.

## Entry 2

Asked — Install Floci, add the local AWS endpoint template and ignored real `.env`, scaffold managed Secrets Manager loading, mount Plan Cycle routes under `/v1`, update OpenAPI and tests, and document the versioning policy.

Produced — Installed the Floci CLI with Homebrew, added committed endpoint/secret-id templates without real secrets, created an ignored `apps/api/.env` carrying the Floci endpoint, added strict env and Secrets Manager loader modules, remounted Plan Cycle routes under `/v1`, documented a deprecated route with Deprecation/Sunset/Link headers, updated the OpenAPI registry paths, added a `/v1` contract test, and recorded ADR-0005.

Accepted or rejected — Accepted.

Why — Focused OpenAPI, rate-limit, and `/v1` contract tests passed, while Floci is installed and ready once Docker is running for the local AWS emulator.

## Entry 3

Asked — Fix the remaining blockers by making Floci reachable and completing the AWS SDK/dotenv dependency install.

Produced — Updated the API package lock by installing `@aws-sdk/client-secrets-manager` and `dotenv`, launched Docker Desktop, started the Floci container with its image pull, verified `floci doctor` passes with `AWS_ENDPOINT_URL=http://localhost.floci.io:4566`, and reran the focused OpenAPI, `/v1`, and rate-limit tests.

Accepted or rejected — Accepted.

Why — Floci now reports all checks passed, the dependency lockfile is updated, and the focused Vitest suite passed with 17 tests.

## Entry 4

Asked — Complete the `/v1` Plan Cycle API mounting, truthful OpenAPI documentation, deprecation announcement, contract test, curl verification, and ADR-0005 versioning policy.

Produced — Tightened the deprecated ping header middleware to the exact `GET /v1/cycles/ping` route, strengthened the `/v1` contract test to validate OpenAPI request/response property types and unversioned route rejection, reran focused OpenAPI and contract tests, typechecked the repo, and verified the live server with `curl -i` for deprecation headers, unknown version 404, unversioned health, and versioned OpenAPI paths.

Accepted or rejected — Accepted.

Why — The live `/v1/cycles/ping` route emits RFC 9745 Deprecation, RFC 8594 Sunset, and successor Link headers while continuing to work, `/v2/cycles` returns 404, `/health` remains unversioned, and the focused contract/OpenAPI tests pass.

## Entry 5

Asked — Make TaxPulse service boundaries explicit with a bounded-context map, document service/datastore ownership and tenant isolation, adopt an anti-shared-DB rule in ADR-0006, and link the new docs from the README and ADR index.

Produced — Added `docs/boundaries.md` with a Mermaid map for the Node Core Case Service and FastAPI Tax Engine, documented each context's owner, datastore, tenant-isolation strategy, and synchronous API call, added ADR-0006 with the anti-shared-DB decision, and linked the boundary doc and ADR.

Accepted or rejected — Accepted.

Why — The docs now identify coherent service-owned contexts, show cross-context access as an API call, forbid direct cross-boundary database reads/writes/joins, and are linked from the main README and ADR index.

## Entry 6

Asked — Move the DB password and RS256 signing keys out of committed files into AWS Secrets Manager via LocalStack, validate non-secret env strictly at boot, cache secrets with refresh, prove missing secrets and malformed config refuse to boot, remove committed signing-key fixtures, and record the strategy in ADR-0007.

Produced — Reworked API startup to parse strict Zod env, preload Secrets Manager values before Express listens, cache and refresh runtime secrets every 5 minutes, configure JWT signing and database connection material from the managed secret cache, added config/secret tests, removed committed PEM fixtures from the compute tests, documented ADR-0007, and verified LocalStack missing-secret and successful-secret boot paths.

Accepted or rejected — Accepted.

Why — Startup now fails before serving traffic when config is malformed or a LocalStack secret is missing, starts successfully with seeded managed secrets, tests pass, and the repo grep finds no committed DB password, private key block, password-bearing DB URL, or JWT private-key env fallback.

## Entry 7

Asked — Check the M3D5 grading rubric, verify the implementation, stage all changes, commit, push the `m3d5-implementation` branch, and draft the PR request with verification output and AI-tool reflection.

Produced — Verified branch, reran TypeScript typecheck, focused Vitest tests, FastAPI trust-domain tests, malformed-env boot failure, missing LocalStack secret boot failure, and secret-value grep; added ADR-0005 to the ADR index; drafted `review/m3d5-pr-description.md` with rubric checklist, verification output, AI review evidence, AI-tool reflection, and PR routing.

Accepted or rejected — Accepted.

Why — The verification commands passed or failed in the expected fail-fast mode, the rubric evidence is captured in the PR draft, and the branch is ready to stage, commit, and push.

## Entry 8

Asked — Build M3D5 from the new M3D4 changes.

Produced — Merged `origin/main` into `m3d5-implementation`, kept the M3D5 `/v1` route and managed-secret configuration, carried forward M3D4 Redis rate-limit environment variables and MFA bearer-token rejection coverage, removed the obsolete root `.env.example`, and aligned the ignored `apps/api/.env` with the committed API-local env example.

Accepted or rejected — Accepted.

Why — The M3D5 branch now incorporates the M3D4/main changes while preserving the versioned API, managed secrets, rate-limit config, and auth hardening expected by the later module work.

## Entry 9

Asked — Ensure `.env` is ignored, not present in the root, and not tracked on the remote branch.

Produced — Removed the tracked root `.env` from Git and the working tree while keeping `.gitignore` configured to ignore `.env` files and preserve the committed `apps/api/.env.example` template.

Accepted or rejected — Accepted.

Why — The branch no longer tracks a root `.env`, and the local API env file remains ignored while the example template stays available for setup.
