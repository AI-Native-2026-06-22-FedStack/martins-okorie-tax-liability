## Summary

Adds the M2D4 Drizzle data layer for TaxPulse. This PR records the Drizzle data-access ADR, defines the TypeScript-first schema for `tenant`, `tax_plan_cycle`, and `stage_transition`, generates the first forward-only Drizzle migration, moves the Testcontainers harness onto Drizzle migrations, replaces raw SQL repository reads with tenant-scoped Drizzle queries, derives cycle DTOs with `drizzle-zod`, fixes a measured N+1 with one `.leftJoin()`, adds `/ready`, and wires the create-and-read Tax Plan Cycle walking skeleton through controller, service, repository, and Postgres.

## Testing

- Confirmed current branch: `m2d4-implementation`.
- Verified Drizzle schema and generated migrations are consistent.
- Verified API TypeScript compile, root typecheck, root tests, and API Testcontainers tests.
- Verified the N+1 query-counting test failed at `4` queries for 3 cycles against the naive implementation and passed at `1` after the joined read.
- Verified the Supertest create-then-read E2E path against Testcontainers Postgres.
- Verified `docker ps` was clean after the Testcontainers suite.

Verification output:

```text
Branch:
$ git branch --show-current
m2d4-implementation

Drizzle migration consistency:
$ npm run db:check --prefix apps/api

> @taxpulse/api@0.1.0 db:check
> drizzle-kit check

No config path provided, using default 'drizzle.config.ts'
Reading config file '/Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api/drizzle.config.ts'
Everything's fine 🐶🔥

API typecheck:
$ npx tsc -p apps/api/tsconfig.json --noEmit
PASS

Root typecheck:
$ npm run typecheck

> taxpulse@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

Root tests:
$ npm test

> taxpulse@0.1.0 test
> vitest run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability

 ✓ src/typescript/stage-transition.test.ts  (3 tests) 2ms
 ✓ src/typescript/tax-liability.test.ts  (4 tests) 13ms
 ✓ apps/api/test/openapi.test.ts  (1 test) 2ms
 ↓ apps/api/test/cycle.repository.test.ts  (1 test | 1 skipped)
 ↓ apps/api/test/cycles-with-transitions.test.ts  (1 test | 1 skipped)
 ↓ apps/api/test/plan-cycle-queue.test.ts  (2 tests | 2 skipped)
 ✓ apps/api/test/readiness.test.ts  (2 tests | 1 skipped) 7ms
 ↓ apps/api/test/cycle-slice.e2e.test.ts  (1 test | 1 skipped)
 ↓ apps/api/test/problem-json.test.ts  (1 test | 1 skipped)

 Test Files  4 passed | 5 skipped (9)
      Tests  9 passed | 7 skipped (16)

N+1 red proof before the join:
$ npm run test --prefix apps/api

 FAIL  test/cycles-with-transitions.test.ts > cycles with stage transitions repository read
AssertionError: expected 4 to be 1 // Object.is equality

- Expected
+ Received

- 1
+ 4

This was the intentional naive implementation: 1 cycle query + 3 transition queries.

API Testcontainers suite after the .leftJoin() fix:
$ npm run test --prefix apps/api

> @taxpulse/api@0.1.0 test
> vitest run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api

 ✓ test/openapi.test.ts  (1 test) 2ms
 ✓ test/cycles-with-transitions.test.ts  (1 test) 50ms
 ✓ test/plan-cycle-queue.test.ts  (2 tests) 52ms
{"method":"POST","url":"/cycles","statusCode":201}
{"method":"GET","url":"/cycles/87b387e9-4a9e-4d2b-9f90-f80c4dc66952","statusCode":200}
{"method":"GET","url":"/cycles/87b387e9-4a9e-4d2b-9f90-f80c4dc66952","statusCode":404}
 ✓ test/cycle-slice.e2e.test.ts  (1 test) 64ms
 ✓ test/cycle.repository.test.ts  (1 test) 50ms
 ✓ test/problem-json.test.ts  (1 test) 22ms
{"method":"GET","url":"/ready","statusCode":200}
 ✓ test/readiness.test.ts  (2 tests) 32ms

 Test Files  7 passed (7)
      Tests  9 passed (9)

Post-suite Docker check:
$ docker ps
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

## AI-tool reflection

I accepted Codex's suggestion to model the schema with Drizzle `pgTable` plus `uuid().defaultRandom()` because it matched the committed Deliverable 1 UUID SQL, preserved tenant isolation constraints, and gave the repository `$inferSelect`/`$inferInsert` types without a second row-shape definition. I rejected reverse-migration and Prisma-style rollback thinking because Drizzle does not generate automatic down migrations; the README documents rollback as a roll-forward repair with a new higher-numbered migration, and no reverse migration file was added.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isiah Muli` as the ES reviewer.

## Deliverables checklist

- [x] Data-access ADR + Drizzle schema: MADR ADR records Drizzle with three concrete mitigated risks; `apps/api/src/db/schema.ts` defines `tenant`, `tax_plan_cycle`, and `stage_transition`, exports inferred select/insert types, and is the table-shape source of truth.
- [x] Forward-only migration: committed `apps/api/drizzle/` migration recreates the schema from empty, Drizzle records applied migrations, `drizzle-kit check` reports consistency, and README documents roll-forward repair with no down migrations.
- [x] Drizzle repository + drizzle-zod DTOs: repository inserts and reads by case ID through Drizzle, D1-D2 reads are converted, no raw SQL remains in `apps/api/src/repository/`, DTOs are derived with `drizzle-zod`, and the D3 hand-written schema is removed.
- [x] N+1 caught and fixed; readiness probe: query-counting test failed at `4` queries before the fix and passes at `1` after `.leftJoin()`; the client uses a bounded pg pool; `/ready` checks the pool while `/health` stays database-independent.
- [x] Wired create-and-read slice: controller → service → repository → Postgres path creates a cycle in `Intake`, writes the initial transition row, reads it back tenant-scoped, and returns 404 for cross-tenant reads.
- [x] PR description includes Drizzle check output, N+1 red-to-green output, and the Testcontainers create-then-read suite output.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] PR is self-assigned in Assignees.
- [x] `Isiah Muli` is requested under Reviewers as the ES reviewer.
