## Summary

Adds the M2D1 relational data model, raw PostgreSQL migrations, tenant-scoped repository helper, and verification evidence for TaxPulse Tax Plan Cycles. The model keeps `stage` as the lifecycle source of truth, carries `tenant_id` on case-related entities, enforces core invariants in PostgreSQL, and proves the tenant queue read uses the `(tenant_id, due_date)` index through Postgres MCP `EXPLAIN (ANALYZE, BUFFERS)` output.

## Related ADR

ADR: [0001: Keep a Tax Plan Cycle's condition in its stage](../docs/adr/0001-tax-plan-cycle-stage-only-condition.md)

## Testing

- Confirmed current branch: `m2d1-implementation`.
- Applied raw SQL migrations from an empty PostgreSQL 17.10 database on `localhost:5433`.
- Ran `apps/api/db/seed.sql` twice and confirmed the tenant count remains `2`.
- Attempted four violating inserts and confirmed each was rejected by a named PostgreSQL constraint.
- Used the configured Postgres MCP server to run `EXPLAIN (ANALYZE, BUFFERS)` for the tenant-scoped queue read and confirmed the plan uses `tax_plan_cycle_tenant_due_date_idx`.
- `npx tsc -p apps/api/tsconfig.json --noEmit`
- `npm run typecheck`
- `npm test`

Verification output:

```text
Branch:
m2d1-implementation

Migrations from empty PostgreSQL 17.10 database:
CREATE EXTENSION
CREATE TABLE
CREATE TABLE
CREATE INDEX
CREATE TABLE
CREATE INDEX

Seed:
INSERT 0 2
INSERT 0 2

Tenant count after running seed twice:
 tenant_count
--------------
            2

Violating insert 1: out-of-set stage
INSERT INTO tax_plan_cycle (
    tenant_id, client_id, planning_period, stage, owner, priority, due_date
)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    'client-fictional-bad-stage',
    '2026 Q1',
    'Paused',
    'advisor-fictional-1',
    'Normal',
    DATE '2026-03-31'
);

ERROR:  new row for relation "tax_plan_cycle" violates check constraint "tax_plan_cycle_stage_check"

Violating insert 2: orphaned tenant FK
INSERT INTO tax_plan_cycle (
    tenant_id, client_id, planning_period, stage, owner, priority, due_date
)
VALUES (
    '99999999-9999-4999-8999-999999999999',
    'client-fictional-orphan-tenant',
    '2026 Q1',
    'Intake',
    'advisor-fictional-1',
    'Normal',
    DATE '2026-03-31'
);

ERROR:  insert or update on table "tax_plan_cycle" violates foreign key constraint "tax_plan_cycle_tenant_id_fkey"
DETAIL:  Key (tenant_id)=(99999999-9999-4999-8999-999999999999) is not present in table "tenant".

Violating insert 3: null tenant_id
INSERT INTO tax_plan_cycle (
    tenant_id, client_id, planning_period, stage, owner, priority, due_date
)
VALUES (
    NULL,
    'client-fictional-null-tenant',
    '2026 Q1',
    'Intake',
    'advisor-fictional-1',
    'Normal',
    DATE '2026-03-31'
);

ERROR:  null value in column "tenant_id" of relation "tax_plan_cycle" violates not-null constraint

Violating insert 4: orphaned transition FK
INSERT INTO stage_transition (
    tenant_id, case_id, from_stage, to_stage, actor
)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    'Intake',
    'Data Aggregation',
    'advisor-fictional-1'
);

ERROR:  insert or update on table "stage_transition" violates foreign key constraint "stage_transition_case_fk"
DETAIL:  Key (tenant_id, case_id)=(11111111-1111-4111-8111-111111111111, 88888888-8888-4888-8888-888888888888) is not present in table "tax_plan_cycle".

Postgres MCP EXPLAIN (ANALYZE, BUFFERS), after recreating tax_plan_cycle_tenant_due_date_idx:
Index Scan using tax_plan_cycle_tenant_due_date_idx on tax_plan_cycle  (cost=0.28..197.78 rows=200 width=139) (actual time=0.094..0.098 rows=12 loops=1)
  Index Cond: (tenant_id = '11111111-1111-4111-8111-111111111111'::uuid)
  Buffers: shared hit=12 read=2

No violating rows remain:
violating_cycle_count = 0
orphan_transition_count = 0

TypeScript and test checks:
npx tsc -p apps/api/tsconfig.json --noEmit
PASS

npm run typecheck
PASS

npm test
PASS: 2 test files, 7 tests
```

Lint note: `npm run lint` is not listed as passing because it still reports pre-existing `Array<T>` style issues in `src/typescript/stage-transition.test.ts`; the new `apps/api` code typechecks and formats cleanly.

## AI review evidence

AI review output:

```text
Codex review of the M2D1 relational-model diff:
- The data model keeps Tax Plan Cycle condition in the explicit stage field and does not add a separate status.
- Raw SQL migrations create tenant, tax_plan_cycle, and stage_transition with primary keys, foreign keys, tenant_id NOT NULL where required, and the seven-stage CHECK constraint.
- The tenant-scoped queue helper requires tenant_id in its TypeScript input type and applies it in WHERE tenant_id = $1.
- Constraint evidence shows the bad stage, orphaned tenant, null tenant_id, and orphaned transition attempts were rejected by named database constraints.
- Postgres MCP EXPLAIN evidence identifies the specific plan line proving the queue read uses tax_plan_cycle_tenant_due_date_idx.
```

What it missed:

```text
Codex initially expected dropping only tax_plan_cycle_tenant_due_date_idx to produce a sequential scan. The MCP-returned plan corrected that: PostgreSQL still used tax_plan_cycle_tenant_id_id_unique for a Bitmap Index Scan on the tenant filter. The final evidence records the actual before-index plan and the after-index Index Scan using tax_plan_cycle_tenant_due_date_idx instead of trusting the summary claim.
```

## AI-tool reflection

I accepted Codex's tenant-scoped repository helper and typecheck proof because `listTaxPlanCyclesForTenant` requires `tenant_id` and the `@ts-expect-error` call without it proves the omission fails at compile time. I rejected the PostgreSQL 18.4 and plain `psql` fallback as final query-plan evidence because the rubric requires PostgreSQL 17 and Postgres MCP evidence; the final evidence uses PostgreSQL 17.10 on port `5433` and MCP-returned `EXPLAIN (ANALYZE, BUFFERS)` plan lines.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isiah Muli` as the ES reviewer.

## AI code-review checklist

- [x] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [x] Workflow changes keep stage transitions represented through stage-transition history and do not add an unscoped workflow bypass.
- [x] typed boundaries are preserved with the tenant-scoped repository helper and compile-time missing-tenant proof.
- [x] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [x] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [x] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [x] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

## Deliverables checklist

- [x] Domain modeled in 3NF: `docs/data-model.md` has a Mermaid ER diagram, cardinalities, tenant_id on case entities, lifecycle as `stage`, and a normalization note.
- [x] Schema applied as committed migrations: numbered `.sql` files create `tenant`, `tax_plan_cycle`, and `stage_transition`; seed inserts two tenants and is re-runnable.
- [x] Invariants enforced by the database: stage CHECK, `tenant_id` NOT NULL, `(tenant_id, due_date)` index, and `case_id` index are present.
- [x] Tenant isolation guaranteed: read helper requires `tenant_id`, applies it to every cycle query, and omission fails to type-check.
- [x] Constraints proven, not assumed: `evidence/constraint-checks.md` records four violating inserts rejected by named constraints.
- [x] Query plan verified: Postgres MCP `EXPLAIN (ANALYZE, BUFFERS)` shows `Index Scan using tax_plan_cycle_tenant_due_date_idx` with `Index Cond`.
- [x] PR description includes verification output as a code block.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] Deliverables checklist is included and completed.
- [x] PR is self-assigned in Assignees.
- [x] `Isiah Muli` is requested under Reviewers as the ES reviewer.
