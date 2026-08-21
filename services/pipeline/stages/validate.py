"""
TaxPulse Analytical Pipeline — Stage 2: Validate & Quarantine

Executes:
1. Pydantic v2 boundary schema validation (model_validate, field_validator)
2. Five value-level data quality checks (quality.py)
3. Quarantine sink routing to S3 on floci emulator
4. Quarantine-rate CloudWatch metric emission and threshold gating (docs/runbooks/quarantine-rate.md)
"""

from datetime import date, datetime, timezone
import json
import logging
import os
from typing import Any, Optional
import uuid

import boto3

from services.pipeline.metrics import StageMetrics, emit_cloudwatch_metric
from services.pipeline.models import IncomeEvent, validate_boundary_rows
from services.pipeline.quality import check_quality

logger = logging.getLogger("taxpulse.pipeline")


class QuarantineRateThresholdExceededError(Exception):
    """Raised when the fraction of quarantined rows exceeds the configured rate threshold."""
    def __init__(self, rate: float, threshold: float, total_bad: int, total_in: int):
        self.rate = rate
        self.threshold = threshold
        self.total_bad = total_bad
        self.total_in = total_in
        super().__init__(
            f"Quarantine rate {rate:.4f} ({total_bad}/{total_in}) exceeded defensive threshold {threshold:.4f}. "
            "Pipeline halted to protect downstream analytics corpus. "
            "Refer to runbook: docs/runbooks/quarantine-rate.md"
        )


def quarantine_records_to_s3(
    bad_records: list[dict[str, Any]],
    bucket_name: str = "taxpulse-analytics-quarantine",
    run_id: Optional[str] = None,
) -> str:
    """
    Persists quarantined records with attached failure reasons to floci S3.
    """
    if not bad_records:
        return ""

    endpoint_url = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    run_key = run_id or datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    s3_key = f"quarantine/{run_key}/bad_records_{uuid.uuid4().hex[:8]}.jsonl"

    try:
        s3 = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id="test",
            aws_secret_access_key="test",
            region_name="us-east-1",
        )
        try:
            s3.create_bucket(Bucket=bucket_name)
        except Exception:
            pass

        body = "\n".join(json.dumps(r, default=str) for r in bad_records)
        s3.put_object(
            Bucket=bucket_name,
            Key=s3_key,
            Body=body.encode("utf-8"),
            ContentType="application/x-ndjson",
        )
        logger.info(f"Wrote {len(bad_records)} quarantined rows to s3://{bucket_name}/{s3_key}")
        return f"s3://{bucket_name}/{s3_key}"
    except Exception as exc:
        logger.warning(f"Could not persist quarantine to S3: {exc}")
        return ""


def validate(
    raw_rows: list[dict[str, Any]],
    rate_threshold: float = 0.02,
    quarantine_bucket: str = "taxpulse-analytics-quarantine",
    today: Optional[date] = None,
    allowed_jurisdictions: Optional[set[str]] = None,
    run_id: Optional[str] = None,
) -> tuple[list[IncomeEvent], list[dict[str, Any]], StageMetrics]:
    """
    Validates rows against Pydantic boundary and DQ suite, quarantines bad rows,
    and enforces the quarantine rate threshold.
    """
    count_in = len(raw_rows)
    if count_in == 0:
        metrics = StageMetrics(stage_name="validate", count_in=0, count_out=0, count_bad=0)
        return [], [], metrics

    # Step 1: Pydantic v2 boundary validation
    structurally_valid, boundary_bad = validate_boundary_rows(raw_rows)

    # Step 2: Data Quality Suite (5 value-level checks)
    dq_valid, dq_bad = check_quality(
        structurally_valid,
        today=today,
        allowed_jurisdictions=allowed_jurisdictions,
    )

    all_bad = boundary_bad + dq_bad
    count_out = len(dq_valid)
    count_bad = len(all_bad)

    # Step 3: Enforce row conservation
    metrics = StageMetrics(
        stage_name="validate",
        count_in=count_in,
        count_out=count_out,
        count_bad=count_bad,
        run_id=run_id,
    )
    metrics.log()

    # Step 4: Write bad rows to quarantine
    if all_bad:
        quarantine_records_to_s3(all_bad, bucket_name=quarantine_bucket, run_id=run_id)

    # Step 5: Calculate rate and emit CloudWatch metric
    quarantine_rate = count_bad / max(count_in, 1)
    emit_cloudwatch_metric(
        metric_name="QuarantineRate",
        value=quarantine_rate,
        unit="None",
        dimensions=[{"Name": "Pipeline", "Value": "IncomeIngest"}],
    )
    emit_cloudwatch_metric(
        metric_name="QuarantinedRows",
        value=float(count_bad),
        unit="Count",
    )

    # Step 6: Gate run against rate threshold
    if quarantine_rate > rate_threshold:
        raise QuarantineRateThresholdExceededError(
            rate=quarantine_rate,
            threshold=rate_threshold,
            total_bad=count_bad,
            total_in=count_in,
        )

    return dq_valid, all_bad, metrics
