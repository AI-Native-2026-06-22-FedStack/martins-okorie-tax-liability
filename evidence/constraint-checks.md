# Constraint & query-plan checks

Constraint verification database: PostgreSQL 17.10 on `localhost:5433`, database `taxpulse_constraints_20260707`.

Postgres MCP query-plan verification database: PostgreSQL 17.10 on `localhost:5433`, database `taxpulse_mcp_explain_20260707`. The repo-local MCP server is configured in `.codex/config.toml` as `mcp_servers.postgres` and uses `@modelcontextprotocol/server-postgres`, whose `query` tool is described as read-only.

## Violating inserts (each rejected)

1. Out-of-set stage:

```sql
INSERT INTO tax_plan_cycle (
    tenant_id,
    client_id,
    planning_period,
    stage,
    owner,
    priority,
    due_date
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
```

Rejected by:

```text
ERROR:  new row for relation "tax_plan_cycle" violates check constraint "tax_plan_cycle_stage_check"
```

2. Orphaned tenant FK:

```sql
INSERT INTO tax_plan_cycle (
    tenant_id,
    client_id,
    planning_period,
    stage,
    owner,
    priority,
    due_date
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
```

Rejected by:

```text
ERROR:  insert or update on table "tax_plan_cycle" violates foreign key constraint "tax_plan_cycle_tenant_id_fkey"
DETAIL:  Key (tenant_id)=(99999999-9999-4999-8999-999999999999) is not present in table "tenant".
```

3. Null tenant_id:

```sql
INSERT INTO tax_plan_cycle (
    tenant_id,
    client_id,
    planning_period,
    stage,
    owner,
    priority,
    due_date
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
```

Rejected by:

```text
ERROR:  null value in column "tenant_id" of relation "tax_plan_cycle" violates not-null constraint
```

4. Orphaned transition FK:

```sql
INSERT INTO stage_transition (
    tenant_id,
    case_id,
    from_stage,
    to_stage,
    actor
)
VALUES (
    '11111111-1111-4111-8111-111111111111',
    '88888888-8888-4888-8888-888888888888',
    'Intake',
    'Data Aggregation',
    'advisor-fictional-1'
);
```

Rejected by:

```text
ERROR:  insert or update on table "stage_transition" violates foreign key constraint "stage_transition_case_fk"
DETAIL:  Key (tenant_id, case_id)=(11111111-1111-4111-8111-111111111111, 88888888-8888-4888-8888-888888888888) is not present in table "tax_plan_cycle".
```

## Tenant-scoped queue query plan

Queue query:

```sql
SELECT
    id,
    tenant_id,
    client_id,
    planning_period,
    stage,
    owner,
    priority,
    due_date,
    on_hold,
    hold_reason
FROM tax_plan_cycle
WHERE tenant_id = '11111111-1111-4111-8111-111111111111'
ORDER BY due_date ASC, id ASC
LIMIT 10;
```

MCP source: Postgres MCP `query` tool running `EXPLAIN (ANALYZE, BUFFERS)`.

Before the queue index in the MCP verification database, `tax_plan_cycle_tenant_due_date_idx` was dropped. The earlier expectation was that this would force a sequential scan, but the MCP-returned plan corrected that claim: PostgreSQL used the existing tenant/id uniqueness index for the tenant filter.

```text
Bitmap Heap Scan on tax_plan_cycle  (cost=9.83..125.58 rows=200 width=139) (actual time=0.020..0.047 rows=200 loops=1)
  Recheck Cond: (tenant_id = '11111111-1111-4111-8111-111111111111'::uuid)
  Heap Blocks: exact=5
  Buffers: shared hit=8
  ->  Bitmap Index Scan on tax_plan_cycle_tenant_id_id_unique  (cost=0.00..9.78 rows=200 width=0) (actual time=0.012..0.012 rows=200 loops=1)
        Index Cond: (tenant_id = '11111111-1111-4111-8111-111111111111'::uuid)
        Buffers: shared hit=3
```

After recreating `tax_plan_cycle_tenant_due_date_idx`, the same MCP query used the tenant and due-date index:

```text
Index Scan using tax_plan_cycle_tenant_due_date_idx on tax_plan_cycle  (cost=0.28..197.78 rows=200 width=139) (actual time=0.094..0.098 rows=12 loops=1)
  Index Cond: (tenant_id = '11111111-1111-4111-8111-111111111111'::uuid)
  Buffers: shared hit=12 read=2
```

Plan claim verified: the queue read uses `tax_plan_cycle_tenant_due_date_idx` after the index is present. Claim corrected: dropping only that queue index does not produce a whole-table sequential scan in this schema because `tax_plan_cycle_tenant_id_id_unique` can still support the tenant filter.

## Transition-history query plan

Transition-history query:

```sql
SELECT
    id,
    tenant_id,
    case_id,
    from_stage,
    to_stage,
    actor,
    occurred_at
FROM stage_transition
WHERE case_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'
ORDER BY occurred_at ASC;
```

The query used `stage_transition_case_id_idx`:

```text
Bitmap Index Scan on stage_transition_case_id_idx
  Index Cond: (case_id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1'::uuid)
```

## No violating rows remain

```sql
SELECT count(*) AS violating_cycle_count
FROM tax_plan_cycle
WHERE stage = 'Paused'
   OR tenant_id = '99999999-9999-4999-8999-999999999999'
   OR tenant_id IS NULL;
```

Result: `0`.

```sql
SELECT count(*) AS orphan_transition_count
FROM stage_transition st
WHERE NOT EXISTS (
    SELECT 1
    FROM tax_plan_cycle c
    WHERE c.tenant_id = st.tenant_id
      AND c.id = st.case_id
);
```

Result: `0`.

Required indexes present:

```text
stage_transition_case_id_idx
tax_plan_cycle_tenant_due_date_idx
```
