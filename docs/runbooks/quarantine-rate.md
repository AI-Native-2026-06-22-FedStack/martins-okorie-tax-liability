# Runbook: Quarantine Rate Breach (dq_quarantine_rate_high)

## Incident Context: Analytical Pipeline Quarantine Rate Spike

**Trigger Conditions**:
- **Pipeline Failure**: `QuarantineRateThresholdExceededError` raised during `validate` stage.
- **CloudWatch Metric Alarm**: `TaxPulse/Pipeline` `QuarantineRate` > 0.02 (2.0% of batch rows rejected) over a single ingest evaluation window.
- **Severity**: P2 (Analytical Corpus Freshness Impaired; operational OLTP unaffected).

---

## Response Workflow: Confirm → Inspect → Diagnose → Remediate → Replay

```
[ Quarantine Alarm Fires / Run Halted ]
                   │
                   ▼
       1. CONFIRM Quarantine Metrics
                   │
                   ▼
      2. INSPECT S3 Quarantine Sink
                   │
                   ▼
        3. DIAGNOSE Failure Reasons
       (Schema drift vs. Bad Vendor File)
                   │
                   ▼
     4. REMEDIATE Upstream / Code Patch
                   │
                   ▼
       5. REPLAY Ingestion & Verify
```

---

### Step 1: CONFIRM the Breach

Check the pipeline audit record in PostgreSQL and the CloudWatch metric:

1. **Query Pipeline Run Audit Table**:
   ```sql
   SELECT run_id, started_at, status, count_in, count_out, count_bad, quarantine_rate, error_message
   FROM analytics.pipeline_run
   ORDER BY started_at DESC
   LIMIT 5;
   ```

2. **Check CloudWatch Metric Data**:
   ```bash
   export AWS_ENDPOINT_URL=http://localhost:4566
   aws --endpoint-url "$AWS_ENDPOINT_URL" cloudwatch get-metric-data \
     --metric-data-queries '[{"Id":"m1","MetricStat":{"Metric":{"Namespace":"TaxPulse/Pipeline","MetricName":"QuarantineRate"},"Period":60,"Stat":"Maximum"}}]' \
     --start-time $(date -u -v-1H +%Y-%m-%dT%H:%M:%SZ) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ)
   ```

---

### Step 2: INSPECT Quarantined Records on S3

All rejected records are persisted to the floci quarantine S3 bucket with attached failure reasons:

1. **List Recent Quarantine Files**:
   ```bash
   aws --endpoint-url "$AWS_ENDPOINT_URL" s3 ls s3://taxpulse-analytics-quarantine/quarantine/ --recursive
   ```

2. **Download and Inspect Sample Bad Records**:
   ```bash
   aws --endpoint-url "$AWS_ENDPOINT_URL" s3 cp \
     s3://taxpulse-analytics-quarantine/quarantine/<run_key>/bad_records.jsonl - | head -n 10 | jq .
   ```

---

### Step 3: DIAGNOSE the Root Cause

Inspect the `"reasons"` or `"errors"` array attached to quarantined records:

| Anomaly Signature | Root Cause | Action |
|---|---|---|
| `"amount_not_positive"` or negative `amount_cents` | Vendor clawback adjustment in unexpected format | Verify if negative transactions should be modeled as credit adjustments or filtered at source. |
| `"unrecognized_jurisdiction_code"` | New state/territorial FIPS code introduced | Update `KNOWN_STATE_FIPS_PREFIXES` in `services/pipeline/quality.py`. |
| `"duplicate_event_id"` | Vendor export replay or duplicate event generation | Request deduplicated export file from vendor. |
| `"future_event_date"` | System clock drift at vendor generator | Notify vendor of clock discrepancy; check timestamp timezone offset. |
| `"pydantic_schema_validation_failed"` | Unannounced column rename or type change | Inspect `errors` breakdown in quarantine record and update boundary model in `models.py`. |

---

### Step 4: REMEDIATE and REPLAY

1. **If Root Cause is Upstream Vendor File**:
   - Contact data provider for a replacement export.
   - Place corrected export in `data/exports/`.

2. **If Root Cause is Valid Business Logic Evolution**:
   - Update `services/pipeline/models.py` or `services/pipeline/quality.py`.
   - Run tests: `pytest services/pipeline/tests/test_pipeline.py`.

3. **Re-run the Pipeline**:
   ```bash
   python services/pipeline/run.py
   ```

4. **Verify Clean Ingest & Conservation**:
   - Verify `status = 'COMPLETED'` and `quarantine_rate <= 0.02`.
   - Confirm domain refresh event was emitted to SNS topic `taxpulse-stage-changed`.
