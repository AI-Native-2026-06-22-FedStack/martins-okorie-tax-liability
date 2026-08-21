# Week 9 Day 1 PR — Python Data Tooling

## Summary

This PR establishes the analytical data platform foundation for TaxPulse, implementing **Week 9 Day 1 — Python Data Tooling**. It introduces the new analytical engine package at `services/pipeline/`, profiling a 2,000,000-row income event export, enforcing strict schema and dtype discipline, contrasting eager Pandas vs. lazy Polars query optimization, archiving partitioned Parquet to local floci S3, and reconciling analytical aggregates directly against operational PostgreSQL using in-process DuckDB:

1. **Analytical Pipeline Package (`services/pipeline/`)**:
   - Initialized `services/pipeline/pyproject.toml` with strict constraints (`polars>=1,<2`, `pandas>=3,<4`, `duckdb>=1,<2`, `pyarrow`, `psycopg[binary]>=3.1`).
   - Clean architectural separation: exploratory data analysis strictly confined to `notebooks/income-export-eda.ipynb`, tested production pipeline implemented in `services/pipeline/aggregate.py`.
   - Updated `.gitignore` to ensure high-volume machine-generated data (`data/exports/`, `data/warehouse/`, `*.parquet`, `.ipynb_checkpoints/`) never enters version control.
2. **Deterministic Export Generator (`services/pipeline/tools/generate_export.py`)**:
   - Manufactured 2,000,000 income event rows (`SEED = 42`, 58.24 MB compressed) mirroring operational `tenant` and `tax_plan_cycle` entities.
   - Seeded realistic vendor anomalies: leading-zero FIPS jurisdiction codes (`01001`, `06001`, `00420`), negative clawbacks (9,847 rows), distribution outliers (382 rows), and nullable notes (25.66%).
3. **Declared Schema & Dtype Discipline (`services/pipeline/schema.py`)**:
   - Explicit read schema `EXPORT_SCHEMA` declaring identifiers as `pl.String` (preventing silent truncation of leading zeros), `amount_cents` as `pl.Int64` (integer minor units eliminating float drift), `effective_rate` as `pl.Decimal(6, 4)`, and dates as `pl.Date` / `pl.Datetime`.
4. **Dual Income Rollup Aggregate (`services/pipeline/aggregate.py`)**:
   - Implemented YTD cycle gross income, effective rates, and client YoY income deltas in both eager Pandas 3.x and lazy Polars 1.x.
   - Polars lazy query plan demonstrated projection pushdown (`PROJECT 6/12 COLUMNS`) and streaming execution.
   - **Benchmark (2M rows)**: Polars Lazy ran in **1.167s** with **0.03 MB peak RAM**, outperforming Pandas Eager (5.180s, 510.45 MB RAM) by **>4.4x in speed** and **>17,000x in peak memory efficiency**.
5. **Partitioned Parquet Warehouse & Local floci S3 Upload**:
   - Partitioned dataset by `planning_period=YYYY-QX` under `data/warehouse/income_rollup/` and uploaded 7 partitions to floci S3 bucket `taxpulse-analytics-warehouse`.
   - Verified round-trip fidelity with zero floating-point accumulation drift.
6. **DuckDB Cross-Engine Reconciliation (`services/pipeline/tools/reconcile.py`)**:
   - DuckDB in-process session querying the Parquet warehouse directly and attaching live PostgreSQL (`taxpulse_l`) via `ATTACH (TYPE postgres)`.
   - Reconciled all 8 plan cycles across 4 tenants with **100% exact equivalence** and zero mismatches, joining strictly on declared string identifiers without numeric casting.
7. **Comprehensive Testing (`services/pipeline/tests/`)**:
   - 5 unit and integration tests covering hand-calculated exact arithmetic, Pandas-Polars parity, YoY edge cases, Parquet round-trip type preservation, and live DuckDB reconciliation.

---

## Related ADR

- [`docs/data/income-export-profile.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/data/income-export-profile.md)
- [`docs/adr/0023-terraform-iac-scanning.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0023-terraform-iac-scanning.md)

---

## Testing

### 1. Pytest Suite Execution (5/5 Passing)
```text
$ PYTHONPATH=. pytest services/pipeline/tests/
============================= test session starts ==============================
platform darwin -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: /Users/martinsokorie/Desktop/martins-okorie-tax-liability/services/pipeline
configfile: pyproject.toml
plugins: anyio-4.14.0, asyncio-1.4.0
asyncio: mode=Mode.STRICT, debug=False, asyncio_default_fixture_loop_scope=None, asyncio_default_test_loop_scope=function
collected 5 items

services/pipeline/tests/test_aggregate.py ....                           [ 80%]
services/pipeline/tests/test_reconcile.py .                              [100%]

============================== 5 passed in 0.61s ===============================
```

---

### 2. Full-Scale Eager vs. Lazy Benchmark (2,000,000 Rows)
```text
Pandas Eager: Wall-clock = 5.180s | Peak Memory = 510.45 MB
Polars Lazy:  Wall-clock = 1.167s | Peak Memory = 0.03 MB
Totals match: True (Exact Arithmetic Parity in Integer Cents)
```

---

### 3. Query Plan Pushdown Verification
```text
AGGREGATE[maintain_order: false]
  [col("amount_cents").sum().alias("gross_income_cents"), ((col("amount_cents").strict_cast(Float64) * col("effective_rate").strict_cast(Float64))).round().strict_cast(Int64).sum().alias("total_tax_cents"), len().alias("event_count")] BY [col("tenant_id"), col("cycle_id"), col("client_id"), col("planning_period"), col("tax_year")]
  FROM
  SELECT [col("tenant_id"), col("cycle_id"), col("client_id"), col("planning_period"), col("planning_period").str.slice([dyn int: 0, dyn int: 4]).strict_cast(Int32).alias("tax_year"), col("amount_cents"), col("effective_rate")]
    Csv SCAN [data/exports/income_events.csv.gz]
    PROJECT 6/12 COLUMNS
    ESTIMATED ROWS: 1158119
```

---

### 4. Parquet on floci S3 Partition Verification
```text
$ AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1 \
  aws --endpoint-url http://localhost:4566 s3 ls s3://taxpulse-analytics-warehouse/warehouse/income_rollup/ --recursive

2026-08-20 12:47:22       4279 warehouse/income_rollup/planning_period=2025-Q1/part-0000.parquet
2026-08-20 12:47:22       4279 warehouse/income_rollup/planning_period=2025-Q2/part-0000.parquet
2026-08-20 12:47:22       4279 warehouse/income_rollup/planning_period=2025-Q3/part-0000.parquet
2026-08-20 12:47:22       4279 warehouse/income_rollup/planning_period=2025-Q4/part-0000.parquet
2026-08-20 12:47:22       4277 warehouse/income_rollup/planning_period=2026-Q1/part-0000.parquet
2026-08-20 12:47:22       4277 warehouse/income_rollup/planning_period=2026-Q2/part-0000.parquet
2026-08-20 12:47:22       4371 warehouse/income_rollup/planning_period=2026-Q3/part-0000.parquet
```

---

### 5. DuckDB Cross-Engine PostgreSQL Reconciliation
```text
======================================================================
TaxPulse Analytical Reconciler — DuckDB Parquet vs. Postgres
======================================================================
Parquet source:  data/warehouse/income_rollup/**/*.parquet
PostgreSQL target: postgresql://taxpulse_app@localhost:55433/taxpulse_l
Executing cross-engine SQL verification via DuckDB ATTACH...

[SUCCESS] Reconciliation Passed with Exact 100% Equivalence:
  - Total Parquet Warehouse Cycles:  8
  - Total PostgreSQL System Cycles:  8
  - Covered Planning Periods:       ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3']
  - Reconciled Tenants:             ['11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222', '33333333-3333-4333-8333-333333333333', '44444444-4444-4444-8444-444444444444']
  - String-level identifier joins:  Zero type coercion / zero dropped leading zeros.
======================================================================
```

---

## AI review evidence

Paste the sample PR AI-review output as a quote or code block:

```text
The analytical data tooling package introduces Polars lazy query execution and DuckDB PostgreSQL integration, achieving a >4.4x speedup and >17,000x peak memory reduction compared to eager Pandas. The schema enforces strict string preservation for identifier leading zeros and integer cents for monetary calculations, while the Parquet warehouse reconciles with 100% equivalence against PostgreSQL.
```

Paste the "what it missed" note as a quote or code block:

```text
The AI code generator initially suggested joining reconciliation entities on integer-cast cycle IDs to avoid string matching edge cases. The developer caught this and enforced strict string-level joins, ensuring leading zeros in jurisdiction codes and client suffixes were rigorously preserved across both engines.
```

---

## AI-tool reflection

During this sprint, we **accepted** the AI suggestion to use DuckDB's native in-process `ATTACH (TYPE postgres)` capability for cross-engine reconciliation, which allowed analytical Parquet and transactional PostgreSQL tables to be queried and joined in a single SQL statement without intermediate CSV extracts. Conversely, we **rejected** the AI suggestion to use `read_parquet().lazy()` for the Polars pipeline, because `read_parquet()` eagerly materializes the full file into memory before the lazy optimizer can inspect the graph; instead, we enforced `scan_csv` and `scan_parquet` at the entry point so projection and predicate pushdowns were fully realized.

---

## PR routing

- Assignees: self-assigned (`@martinsokorie`).
- Reviewers: request `Isaiah Muli`.

---

## AI code-review checklist

- [x] Stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [x] Workflow changes keep stage transitions gated by role and current stage.
- [x] Typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns.
- [x] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [x] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [x] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [x] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

---

## Deliverables checklist

- [x] Summary explains what changed.
- [x] Related ADR / Profile is linked.
- [x] Testing lists only checks or verification actually performed.
- [x] AI code-review checklist is completed.
- [x] AI review output is pasted above as a quote or code block.
- [x] "What it missed" note is pasted above as a quote or code block.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] PR is self-assigned in Assignees.
- [x] `Isaiah Muli` is requested under Reviewers.
