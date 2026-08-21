# Prompt Journal: Pipelines & Data Quality

## Entry 1

### Asked

Save the Week 9 Day 2 "Pipelines & Data Quality" lesson material into `helper/` and start a new prompt journal.

### Produced

1. Saved the pasted Week 9 Day 2 lesson content to `helper/week-9-day-2-pipelines-data-quality.md`.
2. Initialized `prompt-journal/0036-pipelines-data-quality.md` as the next sequential prompt journal file.

### Accepted or rejected

Accepted

### Why

The lesson reference material was preserved in `helper/` and a new sequential prompt journal was created according to the repository's journal conventions.

## Entry 2

### Asked

Scaffold and verify the five-stage production pipeline under `services/pipeline/` (`stages/` package, `pipeline.toml`, `models.py`, `quality.py`, `metrics.py`, `run.py`, `stages/extract.py`, `stages/validate.py`, `stages/transform.py`, `stages/load.py`, `stages/publish.py`), the isolated analytics schema migration (`apps/api/db/migrations/0003_analytics_schema.sql`), ADR-0027 (`docs/adr/0027-batch-over-streaming.md`), runbook (`docs/runbooks/quarantine-rate.md`), and comprehensive tests in `services/pipeline/tests/test_pipeline.py`.

### Produced

1. Created `services/pipeline/pipeline.toml` configuring the source export glob, S3 quarantine bucket on floci (`taxpulse-analytics-quarantine`), 2% quarantine rate threshold, `analytics` load schema, and Module 6 SNS topic ARN (`taxpulse-stage-changed`).
2. Implemented `services/pipeline/models.py` with Pydantic v2 boundary models (`IncomeEvent`, `IncomeRollupRecord`, `validate_boundary_rows`) using `model_validate` and `field_validator`.
3. Created `services/pipeline/quality.py` with the five value-level data quality checks (amount range, event_id uniqueness, FIPS referential check, date freshness, and batch size sanity).
4. Implemented `services/pipeline/metrics.py` enforcing per-stage row conservation (`count_out + count_bad == count_in`) and CloudWatch metric emission.
5. Created the five pipeline stages: `stages/extract.py` (read + Module 3 redactor), `stages/validate.py` (Pydantic v2 + DQ suite + S3 quarantine + rate threshold alarm gate), `stages/transform.py` (Polars YTD/YoY rollup), `stages/load.py` (isolated write to `analytics.income_rollup`), and `stages/publish.py` (CloudEvents SNS publish).
6. Implemented master orchestrator `services/pipeline/run.py` and applied migration `apps/api/db/migrations/0003_analytics_schema.sql`.
7. Created `docs/adr/0027-batch-over-streaming.md` and `docs/runbooks/quarantine-rate.md`.
8. Added `services/pipeline/tests/test_pipeline.py` with 15 tests covering boundary validation, data-quality assertions, conservation invariants, quarantine routing, threshold alarms, and E2E pipeline execution (15/15 passed).

### Accepted or rejected

Accepted

### Why

All 15 pipeline integration and data quality tests passed, row conservation was enforced at every stage, and the analytics schema was verified in PostgreSQL without modifying operational planning tables.

## Entry 3

### Asked

Implement Task 2: Pydantic v2 models at both extract and load boundaries with exact integer minor units, informative field-level errors naming fields and offending input values (refusing missing required fields, wrong types, and negative amounts), and fail-safe Module 3 boundary redaction in extract before validation, transformation, or quarantine touches the data.

### Produced

1. Updated `services/pipeline/models.py` with pure Pydantic v2 models (`IncomeEvent` at extract boundary, `IncomeRollupRecord` at load boundary, `format_validation_errors`, and `validate_boundary_rows`), strictly enforcing integer minor units (`amount_cents`, `gross_income_cents`, `total_tax_cents`), non-negative amounts, 5-digit zero-padded FIPS codes, and field-level error formatting.
2. Verified `services/pipeline/stages/extract.py` executes fail-safe Module 3 boundary redaction (`redact_record_failsafe`) over each record immediately upon ingestion, ensuring sensitive tokens (`token`, `password`, `mfa_secret`, `authorization`, `income` in unstructured text) are censored before validation and never reach validation errors or quarantine sinks unredacted.
3. Enhanced `services/pipeline/tests/test_pipeline.py` with explicit unit tests for missing fields, wrong types, negative amounts naming field and value, load boundary rollup validation, and downstream quarantine redaction (22/22 passed).

### Accepted or rejected

Accepted

### Why

Pydantic v2 boundary models and fail-safe redaction verified clean refusal of malformed rows with field-and-value error attribution, preserved exact integer monetary arithmetic, and passed 22/22 automated integration tests.
