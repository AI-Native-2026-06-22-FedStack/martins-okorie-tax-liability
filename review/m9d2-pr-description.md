# Week 9 Day 2 PR — Pipelines & Data Quality

## Summary

This PR delivers the production analytical pipeline and data quality platform for TaxPulse, implementing **Week 9 Day 2 — Pipelines & Data Quality**. It introduces an observable, five-stage pipeline under `services/pipeline/` (`stages/`), guards both the extract and load boundaries with strict Pydantic v2 models, executes fail-safe Module 3 boundary redaction before any processing or logging occurs, enforces row conservation across every stage, evaluates five value-level data quality checks (including tax bracket coverage against reference tables), quarantines rejected rows to floci S3 with detailed failure attribution, emits CloudWatch metrics, and gates ingestion runs against a defensive quarantine rate threshold linking to an actionable runbook.

### Key Architectural Deliverables:

1. **Five Observable, Counted Stages (`services/pipeline/stages/`)**:
   - `extract.py`: Ingests source exports using declared read schema ([`schema.py`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/services/pipeline/schema.py)) and executes immediate, fail-safe boundary redaction.
   - `validate.py`: Validates rows against Pydantic v2 boundary models and the 5-check Data Quality Suite, writes bad rows to S3 quarantine, and enforces the quarantine rate threshold gate.
   - `transform.py`: Performs high-performance group aggregation and YoY/YTD income rollups in Polars Lazy.
   - `load.py`: Writes strictly and exclusively to the isolated `analytics.income_rollup` PostgreSQL table without touching operational OLTP planning tables (`public.tax_plan_cycle`, `public.tenants`).
   - `publish.py`: Publishes a CloudEvents-compliant domain event (`taxpulse.pipeline.corpus_refreshed`) to the Module 6 SNS topic on floci.
2. **Row Conservation & Leak Localization (`services/pipeline/metrics.py`)**:
   - Every stage tracks `count_in`, `count_out`, and `count_bad`.
   - Conservation invariant `count_in == count_out + count_bad` is strictly asserted at the validation boundary; any disparity raises `ConservationViolationError`, immediately localizing the leaking stage.
3. **Pydantic v2 Boundary Contracts & Redaction (`services/pipeline/models.py`)**:
   - `IncomeEvent` (extract boundary) and `IncomeRollupRecord` (load boundary) enforce pure Pydantic v2 APIs (`model_validate`, `field_validator`, `ConfigDict`) with exact integer minor units (`amount_cents`, `gross_income_cents`, `total_tax_cents`).
   - Rejections return structured field-level errors naming both the field and the offending input value (missing fields, wrong types, negative amounts).
   - Module 3 fail-safe redactor strips sensitive credentials (`token`, `password`, `mfa_secret`, `authorization`, `income` in unstructured text) at extract time; unredacted secrets never reach downstream transforms, error logs, or S3 quarantine records.
4. **Five Value-Level Data Quality Checks (`services/pipeline/quality.py`)**:
   - Grounded in the Deliverable 1 profile ([`income-export-profile.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/data/income-export-profile.md)):
     1. *Non-Negative Amount*: Catches negative clawbacks (`amount_not_positive`).
     2. *Known Income Source*: Verifies source category against declared reference set (`unrecognized_income_source`).
     3. *Rate Bounds*: Verifies effective rates within `[0.0, 1.0]` (`invalid_effective_rate_bounds`).
     4. *Bracket Coverage*: Asserts income does not exceed top tax bracket ceiling ($100M), preventing unbracketed income from producing runaway tax estimates (`income_exceeds_bracket_coverage`).
     5. *Tenant Presence*: Asserts `tenant_id` exists in registered tenant catalog (`unregistered_or_missing_tenant`).
5. **S3 Quarantine, CloudWatch Metrics, & Runbook Halt Gate (`docs/runbooks/quarantine-rate.md`)**:
   - Quarantines bad rows to floci S3 (`s3://taxpulse-analytics-quarantine/quarantine/<run_id>/bad_records_*.jsonl`) preserving full record context and explicit `reasons`.
   - Emits `QuarantineRate` and `QuarantinedRows` to CloudWatch.
   - Halts the run with `QuarantineRateThresholdExceededError` whenever quarantine rate exceeds defensive threshold (`0.02`), linking directly to [`docs/runbooks/quarantine-rate.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/runbooks/quarantine-rate.md).
6. **Architecture Decision Record (`docs/adr/0027-batch-over-streaming.md`)**:
   - Documents ADR-0027 defending batch-over-streaming for RIA quarterly tax planning cycles with an acceptable 15-minute ingestion SLA.

---

## Related ADR & Documents

- [`docs/adr/0027-batch-over-streaming.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0027-batch-over-streaming.md)
- [`docs/runbooks/quarantine-rate.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/runbooks/quarantine-rate.md)
- [`docs/data/income-export-profile.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/data/income-export-profile.md)
- [`apps/api/db/migrations/0003_analytics_schema.sql`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api/db/migrations/0003_analytics_schema.sql)

---

## Testing & Verification Output

### 1. Pytest Suite Execution (28/28 Passing)
```text
$ PYTHONPATH=. pytest services/pipeline/tests/test_pipeline.py services/pipeline/tests/test_aggregate.py -v
============================= test session starts ==============================
platform darwin -- Python 3.13.2, pytest-9.1.1, pluggy-1.6.0
rootdir: /Users/martinsokorie/Desktop/martins-okorie-tax-liability/services/pipeline
configfile: pyproject.toml
plugins: anyio-4.14.0, asyncio-1.4.0
collected 28 items

services/pipeline/tests/test_pipeline.py::test_pydantic_v2_valid_event PASSED                           [  3%]
services/pipeline/tests/test_pipeline.py::test_pydantic_v2_refuses_missing_required_field PASSED         [  7%]
services/pipeline/tests/test_pipeline.py::test_pydantic_v2_refuses_wrong_type PASSED                   [ 10%]
services/pipeline/tests/test_pipeline.py::test_pydantic_v2_refuses_negative_amount_naming_field_and_value PASSED [ 14%]
services/pipeline/tests/test_pipeline.py::test_pydantic_v2_refuses_invalid_jurisdiction_format PASSED    [ 17%]
services/pipeline/tests/test_pipeline.py::test_pydantic_v2_refuses_invalid_planning_period PASSED       [ 21%]
services/pipeline/tests/test_pipeline.py::test_boundary_validation_preserves_field_errors_and_offending_values PASSED [ 25%]
services/pipeline/tests/test_pipeline.py::test_load_boundary_model_enforcement PASSED                   [ 28%]
services/pipeline/tests/test_pipeline.py::test_dq_check_1_non_negative_amount PASSED                   [ 32%]
services/pipeline/tests/test_pipeline.py::test_dq_check_2_known_income_source PASSED                   [ 35%]
services/pipeline/tests/test_pipeline.py::test_dq_check_3_effective_rate_bounds PASSED                 [ 39%]
services/pipeline/tests/test_pipeline.py::test_dq_check_4_bracket_coverage PASSED                     [ 42%]
services/pipeline/tests/test_pipeline.py::test_dq_check_5_tenant_presence PASSED                     [ 46%]
services/pipeline/tests/test_pipeline.py::test_dq_batch_size_check PASSED                              [ 50%]
services/pipeline/tests/test_pipeline.py::test_row_conservation_valid PASSED                           [ 53%]
services/pipeline/tests/test_pipeline.py::test_row_conservation_violation_raises PASSED                 [ 57%]
services/pipeline/tests/test_pipeline.py::test_leak_localization_detects_failing_stage PASSED           [ 60%]
services/pipeline/tests/test_pipeline.py::test_quarantine_rate_under_threshold_passes PASSED          [ 64%]
services/pipeline/tests/test_pipeline.py::test_quarantine_rate_exceeded_raises_and_alerts PASSED        [ 67%]
services/pipeline/tests/test_pipeline.py::test_planted_bad_row_quarantined_on_s3_and_absent_from_loaded_output PASSED [ 71%]
services/pipeline/tests/test_pipeline.py::test_extract_redacts_sensitive_fields_before_validation_and_downstream PASSED [ 75%]
services/pipeline/tests/test_pipeline.py::test_operational_database_remains_untouched PASSED           [ 78%]
services/pipeline/tests/test_pipeline.py::test_sns_refresh_event_arrives_on_sqs_queue PASSED           [ 82%]
services/pipeline/tests/test_pipeline.py::test_end_to_end_pipeline_execution PASSED                   [ 85%]
services/pipeline/tests/test_aggregate.py::test_lazy_aggregate_exact_values PASSED                    [ 89%]
services/pipeline/tests/test_aggregate.py::test_eager_and_lazy_parity PASSED                           [ 92%]
services/pipeline/tests/test_aggregate.py::test_parquet_round_trip_type_preservation PASSED           [ 96%]
services/pipeline/tests/test_aggregate.py::test_query_plan_pushdown PASSED                             [100%]

======================= 28 passed in 1.84s ========================
```

---

### 2. Five Stages' In/Out/Rejected Counts with Exact Conservation Reconciliation
```text
=== 5-STAGE OBSERVABILITY & ROW CONSERVATION VERIFICATION ===
Stage Metrics:
  - Stage extract   : count_in=51, count_out=51, count_bad= 0 (Conservation: 51 == 51 + 0) [OK]
  - Stage validate  : count_in=51, count_out=50, count_bad= 1 (Conservation: 51 == 50 + 1) [OK]
  - Stage transform : count_in=50, count_out=50, count_bad= 0 (Conservation: 50 == 50 + 0) [OK]
  - Stage load      : count_in= 1, count_out= 1, count_bad= 0 (Conservation: 1 == 1 + 0)   [OK]
  - Stage publish   : count_in= 1, count_out= 1, count_bad= 0 (Conservation: 1 == 1 + 0)   [OK]

Result: Status = COMPLETED, Quarantined Records = 1, Loaded Cycles = 1
```

---

### 3. Quarantined Row on floci S3 Showing Explicit Failure Reason
```json
{
  "row": {
    "event_id": "bad-bracket-over-1",
    "tenant_id": "11111111-1111-4111-8111-111111111111",
    "cycle_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "client_id": "CLI-001",
    "jurisdiction_code": "06001",
    "planning_period": "2026-Q3",
    "income_source": "w2_salary",
    "amount_cents": 20000000000,
    "effective_rate": 0.285,
    "event_date": "2026-06-15",
    "notes": "Standard payroll",
    "created_at": "2026-06-15T12:00:00Z"
  },
  "stage": "validate_data_quality",
  "reasons": [
    "income_exceeds_bracket_coverage: amount_cents 20000000000 > top bracket limit 10000000000"
  ]
}
```

---

### 4. Failed-Then-Clean Run Execution Verification
```text
=== 1. RUN WITH BATCH ABOVE THRESHOLD (Spike > 2%) ===
Run failed as expected with non-zero exit:
services.pipeline.stages.validate.QuarantineRateThresholdExceededError: Quarantine rate 0.0909 (1/11) exceeded defensive threshold 0.0200. Pipeline halted to protect downstream analytics corpus. Refer to runbook: docs/runbooks/quarantine-rate.md

=== 2. RUN WITH CLEAN BATCH (Quarantine Rate <= 2%) ===
Pipeline run 'run_20260821_144747_cafb4e' COMPLETED successfully.
  - Quarantined records: 1 (1.96% <= 2.0%)
  - Loaded cycles: 1 -> analytics.income_rollup
  - Published SNS domain event: MessageId c7580ea4-4ccc-4335-84cb-bbf124811fb5
```

---

## AI review evidence

Paste the sample PR AI-review output as a quote or code block:

```text
The analytical pipeline introduces an observable five-stage architecture with strict Pydantic v2 boundary typing, fail-safe Module 3 boundary redaction, and exact integer arithmetic. Value-level checks, including reference bracket coverage, prevent unbracketed income distributions from polluting analytical rollups. Quarantining to S3 preserves explicit failure attribution, while CloudWatch metrics and an automated 2% threshold gate safeguard downstream systems against bad upstream feeds.
```

Paste the "what it missed" note as a quote or code block:

```text
The AI code generator initially drafted data-quality checks that merely restated Pydantic type assertions (e.g. checking whether amount was a number or tenant_id was a string) and omitted the tax bracket coverage check against reference limits. The developer caught this and replaced them with genuine value-level semantic checks grounded in the Deliverable 1 profile, specifically adding the $100M top-bracket coverage limit to prevent unbracketed income from producing runaway effective tax rates.
```

---

## AI-tool reflection

During this sprint, we **accepted** the AI suggestion to structure stage counts as structured log events with an explicit reconciliation invariant (`count_in == count_out + count_bad`) at the validation boundary, ensuring any silent row leaks immediately halt execution and name the offending stage. Conversely, we **rejected** the AI suggestion to model money amounts as floating-point numbers on the Pydantic boundary models and to write data-quality checks that merely duplicated basic type constraints; instead, we enforced exact integer cents (`amount_cents: int`) across all models and wrote five value-level semantic checks grounded in the Deliverable 1 profile—including checking tax bracket coverage limits to protect progressive liability calculations.

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

- [x] Summary explains what changed across all 5 pipeline stages, boundary models, DQ suite, S3 quarantine, and CloudWatch metrics.
- [x] Related ADR ([`0027-batch-over-streaming.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/adr/0027-batch-over-streaming.md)), runbook ([`quarantine-rate.md`](file:///Users/martinsokorie/Desktop/martins-okorie-tax-liability/docs/runbooks/quarantine-rate.md)), and D1 profile are linked.
- [x] Testing lists all 28 passed tests with pasted verification outputs (5 stage counts with reconciliation, quarantined row with reason, and failed-then-clean run outputs).
- [x] AI code-review checklist is completed.
- [x] AI review output is pasted above as a quote or code block.
- [x] "What it missed" note is pasted above as a quote or code block.
- [x] AI-tool reflection names one accepted suggestion (structured stage count reconciliation) and one rejected suggestion (float money typing / trivial type checks), with reasons.
- [x] PR is self-assigned in Assignees (`@martinsokorie`).
- [x] `Isaiah Muli` is requested under Reviewers.
