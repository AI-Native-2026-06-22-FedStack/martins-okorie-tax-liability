"""
TaxPulse Analytical Pipeline — Master Orchestrator

Wires the five stages in sequence:
  Stage 1: Extract (read + boundary redact)
  Stage 2: Validate (pydantic v2 + 5 DQ checks + S3 quarantine + rate threshold gate)
  Stage 3: Transform (YTD & YoY Polars rollup)
  Stage 4: Load (analytics schema isolated write)
  Stage 5: Publish (domain refresh SNS event)

Enforces per-stage row conservation and structured logging.
"""

from datetime import datetime, timezone
import glob
import logging
import os
from pathlib import Path
import tomllib
from typing import Any, Optional
import uuid

import psycopg

from services.pipeline.stages.extract import extract
from services.pipeline.stages.load import load
from services.pipeline.stages.publish import publish
from services.pipeline.stages.transform import transform
from services.pipeline.stages.validate import validate

logger = logging.getLogger("taxpulse.pipeline")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def load_pipeline_config(config_path: Optional[str | Path] = None) -> dict[str, Any]:
    """Loads configuration from pipeline.toml."""
    path = Path(config_path or (Path(__file__).parent / "pipeline.toml"))
    if not path.exists():
        return {
            "source": {"export_glob": "data/exports/*.jsonl.gz"},
            "quarantine": {
                "bucket": os.getenv("QUARANTINE_BUCKET", "taxpulse-analytics-quarantine"),
                "rate_threshold": float(os.getenv("QUARANTINE_RATE_THRESHOLD", "0.02")),
            },
            "load": {"schema": "analytics"},
            "publish": {
                "topic_arn": os.getenv("STAGE_CHANGED_TOPIC_ARN", "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"),
            },
        }

    with open(path, "rb") as f:
        return tomllib.load(f)


def record_pipeline_run(
    run_id: str,
    status: str,
    count_in: int,
    count_out: int,
    count_bad: int,
    quarantine_rate: float,
    error_message: Optional[str] = None,
    database_url: Optional[str] = None,
) -> None:
    """Updates the analytics.pipeline_run audit log."""
    db_url = database_url or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/taxpulse")
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                cur.execute("CREATE SCHEMA IF NOT EXISTS analytics;")
                cur.execute(
                    """
                    INSERT INTO analytics.pipeline_run (
                        run_id, status, count_in, count_out, count_bad, quarantine_rate, error_message, completed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, now())
                    ON CONFLICT (run_id) DO UPDATE SET
                        status = EXCLUDED.status,
                        count_in = EXCLUDED.count_in,
                        count_out = EXCLUDED.count_out,
                        count_bad = EXCLUDED.count_bad,
                        quarantine_rate = EXCLUDED.quarantine_rate,
                        error_message = EXCLUDED.error_message,
                        completed_at = now();
                    """,
                    (run_id, status, count_in, count_out, count_bad, quarantine_rate, error_message),
                )
            conn.commit()
    except Exception as exc:
        logger.warning(f"Could not update pipeline_run record: {exc}")


def run(
    source: Optional[str | list[dict[str, Any]]] = None,
    config_path: Optional[str | Path] = None,
    database_url: Optional[str] = None,
    run_id: Optional[str] = None,
) -> dict[str, Any]:
    """
    Executes the 5-stage production pipeline with row conservation and threshold checks.
    """
    current_run_id = run_id or f"run_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    cfg = load_pipeline_config(config_path)

    quarantine_cfg = cfg.get("quarantine", {})
    rate_threshold = float(quarantine_cfg.get("rate_threshold", 0.02))
    quarantine_bucket = str(quarantine_cfg.get("bucket", "taxpulse-analytics-quarantine"))

    load_cfg = cfg.get("load", {})
    target_schema = str(load_cfg.get("schema", "analytics"))

    publish_cfg = cfg.get("publish", {})
    topic_arn = str(publish_cfg.get("topic_arn", "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"))

    # Resolve source path / glob if not directly provided
    resolved_source: Any = source
    if resolved_source is None:
        source_glob = cfg.get("source", {}).get("export_glob", "data/exports/*.jsonl.gz")
        matched_files = glob.glob(source_glob)
        if matched_files:
            resolved_source = matched_files[0]
        else:
            # Check default data directory for csv / jsonl exports
            for fallback in ("data/exports/income_events.csv.gz", "data/exports/income_events.jsonl.gz", "data/exports/income_events.csv"):
                if os.path.exists(fallback):
                    resolved_source = fallback
                    break

    if resolved_source is None:
        raise ValueError("No source data found matching configured export glob")

    logger.info(f"Starting pipeline run '{current_run_id}' on source '{resolved_source}'")

    try:
        # Stage 1: Extract & Redact
        raw_rows, extract_metrics = extract(resolved_source)

        # Stage 2: Validate & Quarantine
        good_events, bad_records, validate_metrics = validate(
            raw_rows=raw_rows,
            rate_threshold=rate_threshold,
            quarantine_bucket=quarantine_bucket,
            run_id=current_run_id,
        )

        # Stage 3: Transform (Rollup calculation)
        rollup_records, transform_metrics = transform(good_events)

        # Stage 4: Load to Analytics Schema
        loaded_count, load_metrics = load(
            records=rollup_records,
            schema_name=target_schema,
            database_url=database_url,
        )

        # Stage 5: Publish Domain Event
        msg_id, publish_metrics = publish(
            topic_arn=topic_arn,
            loaded_cycles_count=loaded_count,
            run_id=current_run_id,
        )

        q_rate = len(bad_records) / max(len(raw_rows), 1)
        record_pipeline_run(
            run_id=current_run_id,
            status="COMPLETED",
            count_in=len(raw_rows),
            count_out=len(good_events),
            count_bad=len(bad_records),
            quarantine_rate=q_rate,
            database_url=database_url,
        )

        summary = {
            "run_id": current_run_id,
            "status": "COMPLETED",
            "stages": {
                "extract": extract_metrics.log(),
                "validate": validate_metrics.log(),
                "transform": transform_metrics.log(),
                "load": load_metrics.log(),
                "publish": publish_metrics.log(),
            },
            "loaded_cycles": loaded_count,
            "quarantined_records": len(bad_records),
            "quarantine_rate": q_rate,
            "publish_message_id": msg_id,
        }
        logger.info(f"Pipeline run '{current_run_id}' COMPLETED successfully: {summary}")
        return summary

    except Exception as exc:
        logger.error(f"Pipeline run '{current_run_id}' FAILED: {exc}")
        record_pipeline_run(
            run_id=current_run_id,
            status="FAILED",
            count_in=len(raw_rows) if "raw_rows" in locals() else 0,
            count_out=len(good_events) if "good_events" in locals() else 0,
            count_bad=len(bad_records) if "bad_records" in locals() else 0,
            quarantine_rate=(len(bad_records) / max(len(raw_rows), 1)) if ("bad_records" in locals() and "raw_rows" in locals()) else 0.0,
            error_message=str(exc),
            database_url=database_url,
        )
        raise


if __name__ == "__main__":
    import sys
    src = sys.argv[1] if len(sys.argv) > 1 else None
    res = run(source=src)
    print(res)
