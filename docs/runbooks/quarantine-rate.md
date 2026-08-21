# Runbook: Quarantine Rate Above Threshold (dq_quarantine_rate_high)

## 1. What This Failure Means

- **Metric**: `TaxPulse/Pipeline` -> `QuarantineRate` (calculated as `count_bad / count_in`).
- **Threshold**: **`0.02`** (2.0% of batch rows rejected by Pydantic boundary validation or Data Quality checks).
- **Measurement Window**: Evaluated per scheduled batch execution over the full incoming export file.
- **Impact**: The analytical ingestion pipeline halted with a non-zero exit code to prevent corrupted or unbracketed income distributions from polluting the `analytics.income_rollup` table. Operational Core Case Service OLTP tables (`public.tax_plan_cycle`) are unaffected.

---

## 2. Where the Bad Rows Are

All rejected rows are quarantined on the floci S3 emulator rather than discarded:

- **S3 Bucket**: `s3://taxpulse-analytics-quarantine`
- **Key Prefix**: `quarantine/<run_id>/bad_records_<uuid>.jsonl`
- **Record Structure**: Each quarantined record is stored as an NDJSON line preserving full row identity and an explicit reasons array:
  ```json
  {
    "row": {
      "event_id": "bad-clawback-1",
      "tenant_id": "11111111-1111-4111-8111-111111111111",
      "cycle_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "client_id": "CLI-001",
      "jurisdiction_code": "06001",
      "planning_period": "2026-Q3",
      "income_source": "w2_salary",
      "amount_cents": -50000,
      "effective_rate": 0.25,
      "event_date": "2026-06-15",
      "notes": "[REDACTED]"
    },
    "stage": "validate_data_quality",
    "reasons": [
      "amount_not_positive: amount_cents is -50000"
    ]
  }
  ```

---

## 3. How to Inspect and Triage

To inspect failure reasons and identify whether the breach is due to upstream vendor schema drift or bad data:

### Step 3.1: Query the Pipeline Audit Run Record
```bash
python -c "
import psycopg
conn = psycopg.connect('postgresql://postgres:postgres@localhost:5432/taxpulse')
with conn.cursor() as cur:
    cur.execute('SELECT run_id, started_at, status, count_in, count_out, count_bad, quarantine_rate, error_message FROM analytics.pipeline_run ORDER BY started_at DESC LIMIT 1;')
    print(cur.fetchall())
conn.close()
"
```

### Step 3.2: Pull and Sample Quarantined Records from S3
```bash
export AWS_ENDPOINT_URL=http://localhost:4566
export AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_DEFAULT_REGION=us-east-1

# List recent quarantine files
aws --endpoint-url "$AWS_ENDPOINT_URL" s3 ls s3://taxpulse-analytics-quarantine/quarantine/ --recursive

# Pull and inspect the first 10 bad rows with failure reasons
aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp \
  $(aws --endpoint-url "$AWS_ENDPOINT_URL" s3 ls s3://taxpulse-analytics-quarantine/quarantine/ --recursive | sort | tail -n 1 | awk '{print "s3://taxpulse-analytics-quarantine/" $4}') - \
  | head -n 10 | python3 -m json.tool
```

### Failure Reason Triage Matrix

| Failure Reason | Meaning & Root Cause | Action |
|---|---|---|
| `amount_not_positive` | Negative adjustments or clawbacks in raw export | Verify if vendor included reversal transactions. |
| `unrecognized_income_source` | Vendor introduced a new income category | Add category to `KNOWN_INCOME_SOURCES` in `quality.py` if approved by domain spec. |
| `invalid_effective_rate_bounds` | Floating-point corruption or rates outside `[0.0, 1.0]` | Reject file back to provider for recalculation. |
| `income_exceeds_bracket_coverage` | Income exceeds top bracket limit ($100M) | Review tax bracket schedule in `federal_tax_bracket` reference table. |
| `unregistered_or_missing_tenant` | Event belongs to unknown organization | Verify tenant onboarding in `public.tenants`. |
| `pydantic_schema_validation_failed` | Column dropped, renamed, or formatted incorrectly | Inspect `errors` field in quarantine record. |

---

## 4. How to Replay After Upstream Fix

Once the root cause is resolved (either through an upstream corrected export or an engine configuration update):

### Step 4.1: Reprocess Clean Source Export
1. Place the corrected export file in `data/exports/` (or specify path directly).
2. Execute the five-stage pipeline:
   ```bash
   PYTHONPATH=. python services/pipeline/run.py
   ```

### Step 4.2: Verify Clean Ingestion & Event Emission
1. Confirm the pipeline run audit status is `COMPLETED` with `quarantine_rate <= 0.02`:
   ```bash
   python -c "
   import psycopg
   conn = psycopg.connect('postgresql://postgres:postgres@localhost:5432/taxpulse')
   with conn.cursor() as cur:
       cur.execute('SELECT status, count_in, count_out, count_bad, quarantine_rate FROM analytics.pipeline_run ORDER BY started_at DESC LIMIT 1;')
       print('Status:', cur.fetchone())
   conn.close()
   "
   ```
2. Verify `analytics.income_rollup` received the newly aggregated cycles.
3. Verify domain refresh event was emitted to SNS topic `taxpulse-stage-changed`.
