# Evidence: Five-Stage Analytical Pipeline (Week 9 Day 2 — Task 1)

## 1. Five Counted Stages Execution & Row Conservation

```json
{
  "run_id": "run_20260821_143549_d50184",
  "status": "COMPLETED",
  "stages": {
    "extract": {
      "run_id": "run_20260821_143549_d50184",
      "stage": "extract",
      "count_in": 101,
      "count_out": 101,
      "count_bad": 0,
      "quarantine_rate": 0.0
    },
    "validate": {
      "run_id": "run_20260821_143549_d50184",
      "stage": "validate",
      "count_in": 101,
      "count_out": 100,
      "count_bad": 1,
      "quarantine_rate": 0.009900990099009901
    },
    "transform": {
      "run_id": "run_20260821_143549_d50184",
      "stage": "transform",
      "count_in": 100,
      "count_out": 100,
      "count_bad": 0,
      "quarantine_rate": 0.0
    },
    "load": {
      "run_id": "run_20260821_143549_d50184",
      "stage": "load",
      "count_in": 1,
      "count_out": 1,
      "count_bad": 0,
      "quarantine_rate": 0.0
    },
    "publish": {
      "run_id": "run_20260821_143549_d50184",
      "stage": "publish",
      "count_in": 1,
      "count_out": 1,
      "count_bad": 0,
      "quarantine_rate": 0.0
    }
  },
  "loaded_cycles": 1,
  "quarantined_records": 1,
  "quarantine_rate": 0.0099,
  "publish_message_id": "dec1e7c4-a378-4ae0-993c-e31ebbc97c46"
}
```

---

## 2. Row Conservation Assertion & Leak Localization Demonstration

### Deliberately Broken Stage (Simulated Leak of 5 Rows)
```text
Simulating deliberate lossy stage (50 in -> 45 out without recording bad rows)...
CAUGHT LEAK:
Row conservation violation in stage 'transform_deliberately_broken': count_in (50) != count_out (45) + count_bad (0)
```

**Diagnostic Analysis**:
Because every stage emits `count_in`, `count_out`, and `count_bad`, any stage that drops rows without recording a matching `count_bad` triggers an immediate `ConservationViolationError`, localizing the exact stage that leaked.

---

## 3. Operational Database Schema Isolation

- Operational `public.tax_plan_cycle` and `public.tenants` tables were queried before and after pipeline execution: **0 rows modified**.
- Analytics output was written exclusively to `analytics.income_rollup` and execution audited in `analytics.pipeline_run`.

---

## 4. Module 6 Event Fabric SQS Reception

- Domain refresh event `taxpulse.pipeline.corpus_refreshed` was published to SNS topic `taxpulse-stage-changed` (ARN `arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed`).
- Verified message arrival on subscribed SQS queue `taxpulse-stage-changed-projection`.
