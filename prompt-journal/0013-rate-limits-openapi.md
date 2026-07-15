# Prompt Journal: Rate Limits, RateLimit Headers & the Documented Contract

## Entry 1

Asked — Setup helper documentation for Week 3 · Day 4 covering token-bucket vs fixed-window limiting, Redis stores, express-slow-down v2, IETF RateLimit headers, and OpenAPI 3.1 contract registration. Started a new prompt journal file.

Produced — Created `helper/week-3-day-4-rate-limits-ratelimit-headers-documented-contract.md` and initialized `prompt-journal/0013-rate-limits-openapi.md`.

Accepted or rejected — Accepted.

Why — The helper documentation and the new prompt journal file are correctly created and indexed.

## Entry 2

Asked — Recommend and implement a rate-limiting strategy for cheap reads vs expensive write routes, configure them using a Redis shared store, and justify the burst behaviors in the prompt journal.

Produced — Implemented `apps/api/src/middleware/rate-limit.ts` with configurable per-tenant limits using Redis store and fail-open wrappers. Applied `express-slow-down` (v2) before `express-rate-limit`.

Accepted or rejected — Accepted.

Why — For cheap reads, fixed-window is selected as boundary bursts carry low resource costs. For expensive writes (POST /cycles, transition), fixed-window rate limiting is coupled with a graduated slow-down (back-pressure) to progressively delay requests exceeding 50% of the cap, smoothing out bursts and protecting downstream compute resources. Tests in `rate-limit.test.ts` verify standard headers and fail-open capability.

## Entry 3

Asked — Implement cost-accounting advisory headers, extend the OpenAPI registry with bearerAuth/401/429 contract, and verify the full test suite.

Produced — Created `apps/api/src/middleware/cost-header.ts` emitting `X-Request-Cost` (eagerly) and `X-Quota-Used` (via `writeHead` intercept) without interfering with the rate limiter. Extended `apps/api/src/openapi/openapi.ts` with `bearerAuth` security scheme, shared 401/429 responses, and the PATCH /cycles/{id}/transition path — all on the existing registry without a hand-written spec file. Created `apps/api/test/openapi-security.test.ts` (7 tests). Fixed express-rate-limit `ERR_ERL_KEY_GEN_IPV6` by using `ipKeyGenerator` and `ERR_ERL_DOUBLE_COUNT` by adding distinct `rl:` / `sd:` prefixes to the store.

Accepted or rejected — Accepted.

Why — All 15 Vitest test files and 48 tests pass cleanly with 0 errors. The `x-request-cost` header is visible in pino logs on every response.


