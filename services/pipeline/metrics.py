"""
TaxPulse Analytical Pipeline — Metrics & Row Conservation

Emits structured logs and CloudWatch metrics for each pipeline stage.
Enforces the conservation invariant: count_out + count_bad == count_in.
"""

import logging
import os
from typing import Any, Optional

import boto3

logger = logging.getLogger("taxpulse.pipeline")


class ConservationViolationError(Exception):
    """Raised when count_out + count_bad does not equal count_in for a stage."""
    pass


class StageMetrics:
    """Tracks and validates row conservation for a specific pipeline stage."""

    def __init__(self, stage_name: str, count_in: int, count_out: int, count_bad: int = 0):
        self.stage_name = stage_name
        self.count_in = count_in
        self.count_out = count_out
        self.count_bad = count_bad
        self.validate_conservation()

    def validate_conservation(self) -> None:
        if (self.count_out + self.count_bad) != self.count_in:
            raise ConservationViolationError(
                f"Row conservation violation in stage '{self.stage_name}': "
                f"count_in ({self.count_in}) != count_out ({self.count_out}) + count_bad ({self.count_bad})"
            )

    def log(self, extra: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        payload = {
            "stage": self.stage_name,
            "count_in": self.count_in,
            "count_out": self.count_out,
            "count_bad": self.count_bad,
        }
        if extra:
            payload.update(extra)
        logger.info(f"Stage '{self.stage_name}' completed", extra=payload)
        return payload


def emit_cloudwatch_metric(
    metric_name: str,
    value: float,
    unit: str = "Count",
    dimensions: Optional[list[dict[str, str]]] = None,
    namespace: str = "TaxPulse/Pipeline",
) -> None:
    """
    Pushes custom metrics to CloudWatch (targeting local floci emulator when AWS_ENDPOINT_URL is set).
    """
    endpoint_url = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    try:
        cw = boto3.client(
            "cloudwatch",
            endpoint_url=endpoint_url,
            aws_access_key_id="test",
            aws_secret_access_key="test",
            region_name="us-east-1",
        )
        cw.put_metric_data(
            Namespace=namespace,
            MetricData=[
                {
                    "MetricName": metric_name,
                    "Value": value,
                    "Unit": unit,
                    "Dimensions": dimensions or [{"Name": "Environment", "Value": "local"}],
                }
            ],
        )
    except Exception as exc:
        logger.warning(f"Could not emit CloudWatch metric {metric_name}: {exc}")
