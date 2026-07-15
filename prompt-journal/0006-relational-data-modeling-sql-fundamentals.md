# Relational Data Modeling And SQL Fundamentals

# Entry 1

Asked — Copy the attached Week 2 Day 1 relational data modeling and SQL fundamentals lesson into `helper/` and create a new prompt journal day.

Produced — Created `helper/week-2-day-1-relational-data-modeling-sql-fundamentals.md` from the attached lesson text and started `prompt-journal/0006-relational-data-modeling-sql-fundamentals.md`.

Accepted or rejected — Accepted.

Why — Helps to structure the code around what the lms consist of

# Entry 2

Asked — Implement the accepted plan to turn the Tax Plan Cycle brief into a normalized relational model in `docs/data-model.md` using the Week 2 Day 1 relational data modeling helper.

Produced — Added `docs/data-model.md` with tenant, client, Tax Plan Cycle, and stage-transition log entities; documented relationship cardinalities and foreign-key placement; modeled lifecycle as `tax_plan_cycle.stage`; included tenant isolation keys, a Mermaid ER diagram, cardinality proofs, and a 3NF normalization note.

Accepted or rejected — Accepted.

Why — The documentation records the Tax Plan Cycle relational model with erm diagram, stage lifecycle, and normalization evidence

# Entry 3

Asked — Implement the accepted plan for raw PostgreSQL migration files under `apps/api/db/migrations/` and an idempotent seed file for the Tax Plan Cycle schema.

Produced — Added `0001_tenant.sql`, `0002_tax_plan_cycle.sql`, and `seed.sql` with tenant isolation, Tax Plan Cycle lifecycle constraints, tenant-scoped stage-transition history, indexes, and two fictional local tenants inserted through an idempotent upsert.

Accepted or rejected — Accepted.

Why — The requested SQL files define the tenant, tax_plan_cycle, and stage_transition schema with database constraints and an idempotent local seed; live verification passed on the available local PostgreSQL 18.4 server, while PostgreSQL 17-specific verification could not run because no local Postgres 17 server was available.

# Entry 4

Asked — Configure the record to show that PostgreSQL 18.4 verification was rejected and set up PostgreSQL 17 on port `5433` instead.

Produced — Rejected the PostgreSQL 18.4 server as the accepted verification target and began configuring PostgreSQL 17 for local migration verification on a separate port.

Accepted or rejected — Rejected.

Why — The engineer rejected PostgreSQL 18.4 because the task requires PostgreSQL 17, with PostgreSQL 17 downloaded and pointed to port `5433`.

# Entry 5

Asked — Download PostgreSQL 17, point it to port `5433`, and verify the Tax Plan Cycle raw SQL migrations against PostgreSQL 17 instead of the rejected PostgreSQL 18.4 server.

Produced — Installed PostgreSQL 17.10 with Homebrew, repaired the missing PostgreSQL 17 library symlink needed for `initdb`, initialized `/opt/homebrew/var/postgresql@17`, configured `postgresql.conf` with `port = 5433`, started PostgreSQL 17, applied the migration files in order, ran the seed twice, and verified the required tables, tenant count, tenant foreign key, stage CHECK constraint, and tenant-scoped stage transition insert.

Accepted or rejected — Accepted.

Why — PostgreSQL 17.10 is running on port `5433`, the migrations apply cleanly there, the seed remains idempotent with two tenants, and the database rejects an invalid Tax Plan Cycle stage.

# Entry 6

Asked — Push the remaining invariants into the schema, add a tenant-scoped Tax Plan Cycle read helper, and prove the constraints, indexes, and compile-time tenant requirement hold.

Produced — Added `apps/api/src/repository/cycles.ts` with a tenant-required queue read helper, added an API TypeScript config and typecheck proof for the missing-tenant call, created `evidence/constraint-checks.md` with four rejected violating inserts and query-plan evidence, and verified the migrations and constraints against PostgreSQL 17.10 on port `5433`.

Accepted or rejected — Accepted.

Why — PostgreSQL 17 rejected the bad stage, orphaned tenant, null tenant, and orphaned transition inserts with named constraints; the required indexes were present and used in query plans; the tenant-scoped helper typechecked with omission rejected; and project typecheck/tests passed.

# Entry 7

Asked — Reject the plan path that disregarded the Postgres MCP server and set up the Postgres MCP server for query-plan evidence instead.

Produced — Marked the `psql` fallback for query-plan evidence as rejected and configured a repo-local Postgres MCP server pointed at PostgreSQL 17 on port `5433` for restricted EXPLAIN plan collection.

Accepted or rejected — Rejected.

Why — The engineer rejected disregarding the Postgres MCP server because the query-plan evidence must come through the connected Postgres MCP path.

# Entry 8

Asked — Use the Postgres MCP server to confirm with `EXPLAIN (ANALYZE, BUFFERS)` evidence that the tenant-scoped queue index supports the Tax Plan Cycle queue read, and record before/after scan types.

Produced — Used the configured Postgres MCP server against PostgreSQL 17.10 on port `5433` to pull before-and-after queue plans. Verified claim: after `tax_plan_cycle_tenant_due_date_idx` was recreated, the plan used `Index Scan using tax_plan_cycle_tenant_due_date_idx` with an `Index Cond` on `tenant_id`. Corrected claim: dropping only that queue index did not produce a sequential scan because PostgreSQL used `tax_plan_cycle_tenant_id_id_unique` for a `Bitmap Index Scan` on the tenant filter.

Accepted or rejected — Accepted.

Why — The MCP-returned `EXPLAIN (ANALYZE, BUFFERS)` lines prove the queue index is used after creation and identify the actual before-index scan path instead of relying on an unsupported summary.

# Entry 9

Asked — Create the M2D1 pull request description with rubric-aligned verification output, AI-tool reflection, routing instructions, and deliverables checklist.

Produced — Added `review/m2d1-pr-description.md` with the M2D1 summary, ADR link, migration/seed/constraint/EXPLAIN verification output, AI review evidence, AI-tool reflection naming accepted and rejected Codex suggestions, PR routing, and completed grading-rubric checklist.

Accepted or rejected — Accepted.

Why — The PR description file now contains the required verification evidence, reflection, routing instructions, and checklist for the `m2d1-implementation` branch.

# Entry 10

Asked — Stage all current changes, create a commit, and push the `m2d1-implementation` branch.

Produced — Prepared the M2D1 data model, raw SQL migrations, tenant-scoped repository helper, PostgreSQL 17/MCP evidence, PR description, helper renames, and prompt-journal updates for one Conventional Commit and branch push.

Accepted or rejected — Accepted.

Why — The engineer explicitly requested staging, committing, and pushing the completed M2D1 implementation work.
