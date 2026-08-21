"""
TaxPulse Analytical Pipeline — Stage 1: Extract & Redact

Reads source records with the D1 declared schema (schema.py), then applies the Module 3
security boundary redactor over every row BEFORE anything else touches it.

Fail-safe: if redaction cannot run, the row does not proceed. Unredacted sensitive values
must never reach validation errors, the quarantine, or the archive.
"""

import gzip
import json
import logging
from pathlib import Path
from typing import Any, Optional

import polars as pl

from services.compute.app.logging_config import REDACT_KEYS, redact_processor
from services.pipeline.metrics import StageMetrics
from services.pipeline.schema import EXPORT_SCHEMA

logger = logging.getLogger("taxpulse.pipeline")


def redact_record_failsafe(record: dict[str, Any]) -> dict[str, Any]:
    """
    Applies Module 3 boundary redaction to a raw dictionary record.
    Recursively scans keys and values, censoring any sensitive fields declared in REDACT_KEYS.
    If redaction cannot run or fails, raises an error so unredacted data never proceeds.
    """
    try:
        # Use structlog redact_processor logic to sanitize dict
        sanitized = redact_processor(None, None, dict(record))

        # Additional inspection on string fields (like notes or custom properties)
        for k, v in list(sanitized.items()):
            if isinstance(v, str):
                v_lower = v.lower()
                for sensitive_key in REDACT_KEYS:
                    if sensitive_key in v_lower:
                        sanitized[k] = "[REDACTED]"
                        break
            elif isinstance(v, dict):
                sanitized[k] = redact_record_failsafe(v)
            elif isinstance(v, list):
                sanitized[k] = [
                    redact_record_failsafe(item) if isinstance(item, dict) else item
                    for item in v
                ]
        return sanitized
    except Exception as exc:
        raise RuntimeError(f"Failsafe redaction failed on record {record.get('event_id', 'unknown')}: {exc}") from exc


def extract(
    source: str | Path | list[dict[str, Any]],
    run_id: Optional[str] = None,
) -> tuple[list[dict[str, Any]], StageMetrics]:
    """
    Extracts raw records from source using declared read schema, then applies Module 3 boundary redactor.
    """
    raw_records: list[dict[str, Any]] = []

    if isinstance(source, list):
        raw_records = [dict(r) for r in source]
    else:
        path = Path(source)
        if not path.exists():
            raise FileNotFoundError(f"Source file not found: {path}")

        path_str = str(path)
        if path_str.endswith((".jsonl", ".jsonl.gz")):
            opener = gzip.open(path, "rt", encoding="utf-8") if path_str.endswith(".gz") else open(path, "r", encoding="utf-8")
            with opener as f:
                for line in f:
                    line_str = line.strip()
                    if line_str:
                        raw_records.append(json.loads(line_str))
        elif path_str.endswith((".csv", ".csv.gz")):
            # Read using Polars with declared D1 EXPORT_SCHEMA overrides
            df = pl.read_csv(path_str, schema_overrides=EXPORT_SCHEMA)
            raw_records = df.to_dicts()
        elif path_str.endswith((".parquet", ".pq")):
            df = pl.read_parquet(path_str)
            raw_records = df.to_dicts()
        else:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                raw_records = data if isinstance(data, list) else [data]

    # Apply fail-safe boundary redactor before anything else touches it
    redacted_records: list[dict[str, Any]] = []
    bad_count = 0
    for row in raw_records:
        try:
            redacted = redact_record_failsafe(row)
            redacted_records.append(redacted)
        except Exception as exc:
            bad_count += 1
            event_id = row.get("event_id", "unknown") if isinstance(row, dict) else "unknown"
            logger.warning(
                "Failsafe redaction failed on record %s: %s; dropping row to prevent sensitive data leakage",
                event_id,
                exc,
            )

    metrics = StageMetrics(
        stage_name="extract",
        count_in=len(raw_records),
        count_out=len(redacted_records),
        count_bad=bad_count,
        run_id=run_id,
    )
    metrics.log()

    return redacted_records, metrics

