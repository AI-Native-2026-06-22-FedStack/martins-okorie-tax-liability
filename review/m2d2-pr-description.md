## Summary

Adds the M2D2 Plan Cycle Queue integration-test slice for TaxPulse. The queue read is tenant-scoped, composed with a CTE, ordered by `due_date ASC`, and derives `overdue` from the current date instead of storing it. The API test harness now boots a disposable `postgres:17-alpine` container, applies the Deliverable 1 migrations and local seed, uses faker-backed Tax Plan Cycle fixtures, truncates cycle tables after each test, and proves the read against real PostgreSQL data.

## Testing

- Confirmed current branch: `m2d2-implementation`.
- Confirmed Docker was running before the Testcontainers suite.
- Ran the API integration suite against a real `postgres:17-alpine` Testcontainers database.
- Deliberately broke the queue ordering by changing the query to `ORDER BY id ASC`; the integration test failed as expected.
- Restored `ORDER BY tenant_cycles.due_date ASC, id ASC` and reran the API integration suite green.
- Confirmed no containers remained running after cleanup.
- `npx tsc -p apps/api/tsconfig.json --noEmit`
- `npm run typecheck`
- `npm test`

Verification output:

```text
Branch:
$ git branch --show-current
m2d2-implementation

Docker before integration suite:
$ docker ps
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES

API typecheck:
$ npx tsc -p apps/api/tsconfig.json --noEmit
PASS

Root typecheck:
$ npm run typecheck

> taxpulse@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

PASS

Root tests:
$ npm test

> taxpulse@0.1.0 test
> vitest run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability

 ✓ src/typescript/stage-transition.test.ts  (3 tests) 2ms
 ✓ src/typescript/tax-liability.test.ts  (4 tests) 9ms
 ↓ apps/api/test/plan-cycle-queue.test.ts  (2 tests | 2 skipped)

 Test Files  2 passed | 1 skipped (3)
      Tests  7 passed | 2 skipped (9)

Real-container API integration suite:
$ npx vitest run -c apps/api/vitest.config.ts --run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api

 ✓ test/plan-cycle-queue.test.ts  (2 tests) 49ms

 Test Files  1 passed (1)
      Tests  2 passed (2)

Deliberately broken query:
Changed ORDER BY tenant_cycles.due_date ASC, id ASC to ORDER BY id ASC.

$ npx vitest run -c apps/api/vitest.config.ts --run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api

 ❯ test/plan-cycle-queue.test.ts  (2 tests | 1 failed) 60ms
   × plan cycle queue read > returns tenant cycles ordered by due date with a derived overdue flag and no cross-tenant leakage
     → expected [ …(3) ] to deeply equal [ …(3) ]

 FAIL  test/plan-cycle-queue.test.ts > plan cycle queue read > returns tenant cycles ordered by due date with a derived overdue flag and no cross-tenant leakage
AssertionError: expected [ …(3) ] to deeply equal [ …(3) ]

- Expected
+ Received

  Array [
-   "cbb85d4c-cea4-422e-ad23-4bb56237beda",
    "1b71379b-d44c-49a4-8e04-dc0acdcc72a9",
    "cb93512d-9512-407c-b8c5-91c3ec5cf4b2",
+   "cbb85d4c-cea4-422e-ad23-4bb56237beda",
  ]

Restored query:
ORDER BY tenant_cycles.due_date ASC, id ASC

$ npx vitest run -c apps/api/vitest.config.ts --run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api

 ✓ test/plan-cycle-queue.test.ts  (2 tests) 79ms

 Test Files  1 passed (1)
      Tests  2 passed (2)

Docker after integration suite cleanup:
$ docker ps
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

## AI-tool reflection

I accepted Codex's CTE-based tenant-scoped queue read with a derived `overdue` field because it keeps tenant filtering explicit, preserves the Deliverable 1 `(tenant_id, due_date)` index path, and avoids storing transient overdue state. I rejected the Docker-blocked placeholder PR evidence path because the rubric requires proof from a real `postgres:17-alpine` Testcontainers run; the final evidence uses Docker-backed green output and a deliberately broken `ORDER BY` run that fails the ordering assertion.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isiah Muli` as the ES reviewer.

## Deliverables checklist

- [x] Tenant-scoped reporting read: `plan-cycle-queue.ts` returns a tenant's cycles ordered by `due_date ASC` with a derived `overdue` flag, uses a CTE, and is served by the Deliverable 1 `(tenant_id, due_date)` index.
- [x] Real-database harness: one disposable `postgres:17-alpine` container boots, applies Deliverable 1 migrations, is shared across the API suite, and stops in teardown with no pre-provisioned database.
- [x] Factory + cleanup: faker namespaced API builds valid, varied cycle rows with overrides, and `afterEach` truncates cycle tables with `RESTART IDENTITY CASCADE`.
- [x] Read proven on real data: tests assert due-date ordering, derived overdue flags, zero cross-tenant leakage, and a real database CHECK rejection for an invalid stage.
- [x] PR description includes test output for the green real-container suite and a deliberately broken query failure.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] PR is self-assigned in Assignees.
- [x] `Isiah Muli` is requested under Reviewers as the ES reviewer.
