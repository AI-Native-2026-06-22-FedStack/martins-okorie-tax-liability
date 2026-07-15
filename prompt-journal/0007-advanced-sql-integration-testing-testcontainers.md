# Advanced SQL And Integration Testing With Testcontainers

# Entry 1

Asked — Copy the attached Week 2 Day 2 advanced SQL and integration testing with Testcontainers lesson into `helper/` and create a new prompt journal for the `m2d2-implementation` branch.

Produced — Created `helper/week-2-day-2-advanced-sql-integration-testing-testcontainers.md` from the attached lesson text and started `prompt-journal/0007-advanced-sql-integration-testing-testcontainers.md`.

Accepted or rejected — Accepted.

Why — The requested helper note and new branch journal were created in the expected locations.

# Entry 2

Asked — Implement Task 1 for M2D2 by adding the advisor Plan Cycle Queue read under `apps/api/src/repository/plan-cycle-queue.ts`.

Produced — Added a tenant-scoped Plan Cycle Queue read that requires `tenant_id`, filters inside a CTE, orders cycles by `due_date ASC, id ASC`, derives `overdue` from `due_date < now()::date`, and relies on the Deliverable 1 `(tenant_id, due_date)` index.

Accepted or rejected — Accepted.

Why — The engineer requested implementation of the accepted Task 1 plan, and the read now satisfies the tenant scope, ordering, CTE, and derived overdue requirements while deferring Testcontainers work to later tasks.

# Entry 3

Asked — Implement Task 2 by adding a Testcontainers PostgreSQL harness under `apps/api/test/setup/postgres-container.ts`, wiring it through `apps/api/vitest.config.ts`, and updating API typecheck coverage.

Produced — Installed `@testcontainers/postgresql`, `pg`, and `@types/pg`; added a Vitest global setup that starts one real `postgres:17-alpine` container, applies the Deliverable 1 migrations in filename order through `pg`, exposes `TAXPULSE_TEST_DATABASE_URL`, and stops the container in teardown; added the API Vitest config; and updated `apps/api/tsconfig.json` to include source, test setup, and API Vitest config files.

Accepted or rejected — Accepted.

Why — The harness code uses a real `PostgreSqlContainer` and `getConnectionUri()` rather than a fake, API/root typechecks and root tests passed, and runtime Testcontainers verification is blocked until Docker is running and Task 4 adds API integration tests.

# Entry 4

Asked — Implement Task 3 by adding a faker-backed `tax_plan_cycle` factory and an `afterEach` cleanup hook for API integration tests.

Produced — Added `apps/api/test/factories/make-cycle.ts` with current namespaced `@faker-js/faker` defaults for valid, varied Tax Plan Cycle rows, override support for fields such as `tenant_id` and `due_date`, a Vitest cleanup hook that truncates `stage_transition` and `tax_plan_cycle` with `RESTART IDENTITY CASCADE`, and updated the API container setup to apply the fictional local tenant seed so the default factory tenant satisfies the foreign key.

Accepted or rejected — Accepted.

Why — The engineer requested implementation of the accepted Task 3 plan, and the factory keeps defaults within the Deliverable 1 constraints, including the tenant foreign key, while the cleanup hook gives each importing integration test a clean cycle dataset.

# Entry 5

Asked — Implement Task 4 by adding real-container integration tests for the Plan Cycle Queue read under `apps/api/test/plan-cycle-queue.test.ts`.

Produced — Added integration tests that seed fictional cycles for two tenants with mixed past and future due dates, assert Tenant A queue ordering, derived overdue flags, and zero Tenant B leakage, and prove the migrated database is real by asserting an invalid stage insert is rejected by `tax_plan_cycle_stage_check`.

Accepted or rejected — Accepted.

Why — The engineer requested implementation of the accepted Task 4 plan, and the tests exercise the Plan Cycle Queue read plus a Deliverable 1 database constraint; static verification passed, while the real-container Vitest run is blocked because Docker is not running locally.

# Entry 6

Asked — Reject the Docker-blocked placeholder PR-description path and make sure Docker is running before creating the M2D2 PR description.

Produced — Recorded that the PR evidence must come from a real Docker-backed Testcontainers run rather than placeholders or skipped integration tests.

Accepted or rejected — Rejected.

Why — The engineer rejected the Docker-blocked PR-description path because Docker must be running and the rubric requires real-container proof.

# Entry 7

Asked — Create the M2D2 PR description after capturing Docker-backed verification, including the green real-container suite and a deliberately broken-query failure.

Produced — Started Docker Desktop, verified `docker ps`, ran API/root typechecks and tests, fixed the queue read to return `due_date` as text while still ordering by the date value, captured a green real-container API suite, captured the expected failing suite after changing the queue ordering to `ORDER BY id ASC`, restored the query, confirmed the suite was green again, verified no containers remained running, and saved `review/m2d2-pr-description.md`.

Accepted or rejected — Accepted.

Why — The PR description now includes actual Docker-backed Testcontainers evidence, a demonstrated ordering-regression failure, PR routing, and the completed M2D2 deliverables checklist.

# Entry 8

Asked — Address PR review comment: move `afterEach` database cleanup hook from `test/factories/make-cycle.ts` into a dedicated setup file so the test lifecycle is visible.

Produced — Created `test/setup/db-cleanup.ts` with the `afterEach` truncation hook, removed the hook and its `pg`/`vitest` imports from `make-cycle.ts`, and registered the new file via `setupFiles` in `vitest.config.ts`.

Accepted or rejected — Accepted.

Why — The factory file now contains only data-building logic, and the cleanup lifecycle is visible in the setup layer where readers expect it.

# Entry 9

Asked — Address two m2d3 PR review comments: (1) remove the unnecessary `describeWithDatabase` skip guard from `problem-json.test.ts` since the test doesn't use the DB, and (2) replace the unnecessary `await import(...)` with a static import in `openapi.ts`.

Produced — Replaced `describeWithDatabase` with plain `describe` in the Problem+JSON test (repository is in-memory stubs, no DB needed). Replaced the top-level `await import(...)` dynamic import in `openapi.ts` with a static `import` while keeping the required `extendZodWithOpenApi(z)` call.

Accepted or rejected — Accepted.

Why — Both fixes address valid PR feedback: the test now runs unconditionally without a false DB dependency, and the OpenAPI module avoids an unnecessary top-level await.
