"""
TaxPulse Analytical Pipeline — Stage 5: Publish Domain Refresh Event

Emits the 'taxpulse.pipeline.corpus_refreshed' domain event to the Module 6 SNS event fabric
so downstream AI-Assist retrieval indexes and cache warmers can rebuild automatically.
"""

from datetime import datetime, timezone
import json
import logging
import os
from typing import Any, Optional
import uuid

import boto3

from services.pipeline.metrics import StageMetrics

logger = logging.getLogger("taxpulse.pipeline")


def publish_event(
    topic_arn: str,
    payload: dict[str, Any],
    event_type: str = "taxpulse.pipeline.corpus_refreshed",
) -> str:
    """
    Publishes a CloudEvents-compatible domain event to AWS SNS.
    """
    endpoint_url = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    sns = boto3.client(
        "sns",
        endpoint_url=endpoint_url,
        aws_access_key_id="test",
        aws_secret_access_key="test",
        region_name="us-east-1",
    )

    cloud_event = {
        "specversion": "1.0",
        "type": event_type,
        "source": "taxpulse/services/pipeline",
        "id": str(uuid.uuid4()),
        "time": datetime.now(timezone.utc).isoformat(),
        "datacontenttype": "application/json",
        "data": payload,
    }

    resp = sns.publish(
        TopicArn=topic_arn,
        Message=json.dumps(cloud_event),
        Subject="Corpus Refreshed",
    )
    message_id = resp.get("MessageId", "")
    logger.info(f"Published domain event {event_type} to {topic_arn} (MessageId: {message_id})")
    return message_id


def publish(
    topic_arn: str,
    loaded_cycles_count: int,
    run_id: Optional[str] = None,
) -> tuple[str, StageMetrics]:
    """
    Publishes corpus refreshed notification event to downstream subscribers.
    """
    payload = {
        "runId": run_id or str(uuid.uuid4()),
        "loadedCyclesCount": loaded_cycles_count,
        "refreshedAt": datetime.now(timezone.utc).isoformat(),
        "schema": "analytics",
    }

    try:
        msg_id = publish_event(topic_arn, payload)
        metrics = StageMetrics(stage_name="publish", count_in=1, count_out=1, count_bad=0, run_id=run_id)
    except Exception as exc:
        logger.warning(f"Failed to publish domain event: {exc}")
        msg_id = ""
        metrics = StageMetrics(stage_name="publish", count_in=1, count_out=0, count_bad=1, run_id=run_id)

    metrics.log()
    return msg_id, metrics
