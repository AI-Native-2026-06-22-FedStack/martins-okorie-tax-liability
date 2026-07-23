# Prompt Journal: NoSQL, Caching & Idempotency

## Entry 1

Asked — Copy the attached Week 4 Day 1 "NoSQL, Caching & Idempotency" lesson into the helper folder and start a new prompt journal.

Produced — Added `helper/week-4-day-1-nosql-caching-idempotency.md` from the attached lesson text and started this new Week 4 prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 4 Day 1 helper content is now available in the repo, and new Week 4 work has its own sequential prompt journal.

## Entry 2

Asked — Implement the Week 4 Day 1 deliverable plan for DynamoDB, Redis cache-aside, and idempotent Tax Plan Cycle creates using Floci as the AWS emulator.

Produced — Added a Compose stack for Postgres 17 and Redis, installed DynamoDB SDK dependencies, added DynamoDB queue projection modules with access-pattern keys and one GSI, added a Redis cache-aside queue service with TTL/invalidation/stampede protection, added tenant-scoped `Idempotency-Key` middleware for `POST /v1/cycles`, documented ADR-0008, updated OpenAPI, added focused tests, and captured verification evidence.

Accepted or rejected — Accepted.

Why — Typecheck and the focused, baseline, and OpenAPI API tests passed against local Postgres, Redis, and Floci, proving the queue read model, cache invalidation, and idempotency lock behavior.

## Entry 3

Asked — Ensure the Week 4 Day 1 implementation follows the deliverable note: one PR branch, one root Compose file with Postgres, DynamoDB Local, and Redis, root `.env.example`, and store-facing API code/tests under `apps/api/src/store` and `apps/api/test/store`.

Produced — Updated the root Compose stack to include DynamoDB Local, added a trackable root `.env.example` while keeping real `.env` files ignored, moved the DynamoDB, Redis cache, and idempotency code into `apps/api/src/store`, moved focused tests into `apps/api/test/store`, and refreshed evidence to use the Compose smoke checks.

Accepted or rejected — Accepted.

Why — Typecheck stayed green after the layout change, Docker Compose reported all three local stores healthy, and Redis, DynamoDB Local, and Node dependency smoke checks passed.

## Entry 4

Asked — Make Task 1 follow the stricter read-model instructions: write tenant queue, cycle-by-id, and overdue access patterns first; keep every pattern as a DynamoDB `Query`; project stale stage changes correctly; and ensure no scan or duplicate/stale projection behavior hides behind a happy-path test.

Produced — Expanded ADR-0008 with access patterns, consistency modes, and derived keys before the layout; changed the DynamoDB projection to write tenant-scoped `CYCLE#`, `QUEUE#`, and `OVERDUE#` items; added Query-only functions for cycle lookup and overdue lists; kept one GSI for owner+stage queues; and strengthened tests to catch stale projection and invalid DynamoDB delete keys.

Accepted or rejected — Accepted.

Why — The focused read-model and transition tests passed against DynamoDB Local, then the full API suite passed with 20 files and 68 tests.

## Entry 5

Asked — Strengthen the Plan Cycle Queue cache-aside implementation and tests so Redis hits avoid DynamoDB, misses populate with a TTL, stage or due-date changes invalidate stale queue entries, and expired hot keys rebuild once under concurrent load.

Produced — Kept the `60s` `QUEUE_CACHE_TTL_SECONDS` read-through cache and Redis `SET NX PX` rebuild lock, strengthened cache tests to assert a positive TTL, no second DynamoDB read on a hit, fresh data after tenant invalidation, and exactly one rebuild after an expired hot key is hit concurrently.

Accepted or rejected — Accepted.

Why — A 60-second TTL bounds accidental stale reads while smoothing repeated Advisor queue refreshes, and the Redis `SET NX PX` lock works across Node processes so concurrent cache misses do not stampede DynamoDB.

## Entry 6

Asked — Implement Task 3 so `POST /v1/cycles` uses tenant-scoped `Idempotency-Key` replay and serializes concurrent creates instead of returning a duplicate or normal-path `409`.

Produced — Updated the Redis-backed middleware to poll for the first stored `{ status, body }` response when a same-tenant key is locked, release only its own lock owner, store non-5xx outcomes for 24 hours, and strengthened the real-route tests for sequential retries, concurrent replay, distinct keys, tenant scoping, and lock release.

Accepted or rejected — Accepted.

Why — Typecheck and the focused idempotency suite passed, proving three retries and two concurrent creates with one key produce exactly one Tax Plan Cycle while replaying the same response.

## Entry 7

Asked — Make `apps/api/src/store` match the Week 4 Day 1 helper by keeping only `dynamo.ts`, `queueCache.ts`, and `idempotency.ts`, integrating `plan-cycle-queue`, `plan-cycle-queue.keys`, and Redis helper code if still needed.

Produced — Folded the DynamoDB read-model projector, projection item builders, and key construction into `dynamo.ts`; moved the shared Redis client/helpers into `queueCache.ts`; redirected imports; and removed the extra store files.

Accepted or rejected — Accepted.

Why — Typecheck and the focused store suite passed with `apps/api/src/store` containing only the three helper-specified files.

## Entry 8

Asked — Check the Week 4 Day 1 grading rubric against the branch.

Produced — Audited the ADR, store tests, Compose stack, evidence, and review artifacts; added `review/m4d1-pr-description.md` with verification output, AI-tool reflection, and a rubric checklist so the PR-description criterion is covered.

Accepted or rejected — Accepted.

Why — The rubric now has repo-backed evidence for the read model, cache-aside behavior, idempotency, local stack, verification output, and AI reflection.

## Entry 9

Asked — Address PR feedback by making cache rebuild and idempotency lock releases owner-safe with atomic Lua compare-and-delete, testing lock expiry overlaps, and exercising DynamoDB Local in readModel.test.ts.

Produced — Updated `queueCache.ts` and `idempotency.ts` to generate UUID lock owner tokens and release locks via an atomic Lua script (`releaseRedisLock`), added test coverage in `cacheAside.test.ts` and `idempotency.test.ts` for lock expiry overlap and owner matching, and added a DynamoDB Local integration test in `readModel.test.ts` covering table creation, cycle upserts, get-by-id, queue list (stage & GSI owner), overdue queries, and cycle deletions.

Accepted or rejected — Accepted.

Why — Vitest store tests passed with 3 test files and 8 active tests, confirming owner-safe Lua CAS lock release and real DynamoDB Local access pattern queries.

