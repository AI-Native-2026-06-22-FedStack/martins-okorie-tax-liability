"""
TaxPulse Analytical Pipeline — Stage 1: Extract & Redact

Reads source records from compressed exports (JSONL / CSV / Parquet) or raw collections,
applies the Module 3 security boundary redactor to unstructured metadata, and emits counts.
"""

import gzip
import json
from pathlib import Path
from typing import Any

from services.compute.app.logging_config import REDACT_KEYS, redact_processor
from services.pipeline.metrics import StageMetrics


def extract(source: str | Path | list[dict[str, Any]]) -> tuple[list[dict[str, Any]], StageMetrics]:
    """
    Extracts raw records from source path or memory list, applying boundary redaction.
    """
    raw_records: list[dict[str, Any]] = []

    if isinstance(source, list):
        raw_records = [dict(r) for r in source]
    else:
        path = Path(source)
        if not path.exists():
            raise FileNotFoundError(f"Source file not found: {path}")

        if path.suffix == ".gz" and ".jsonl" in path.name:
            with gzip.open(path, "rt", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        raw_records.append(json.loads(line))
        elif path.suffix == ".jsonl":
            with open(path, "r", encoding="utf-8") as f:
                for line in f:
                    if line.strip():
                        raw_records.append(json.loads(line))
        elif path.suffix in (".csv", ".gz"):
            # If CSV, parse using standard CSV reader
            import csv
            opener = gzip.open(path, "rt", encoding="utf-8") if path.suffix == ".gz" else open(path, "r", encoding="utf-8")
            with opener as f:
                reader = csv.DictReader(f)
                for row in reader:
                    # Convert typed numeric strings if present
                    parsed_row: dict[str, Any] = dict(row)
                    if "amount_cents" in parsed_row and parsed_row["amount_cents"] != "":
                        try:
                            parsed_row["amount_cents"] = int(parsed_row["amount_cents"])
                        except ValueError:
                            pass
                    if "effective_rate" in parsed_row and parsed_row["effective_rate"] != "":
                        try:
                            parsed_row["effective_rate"] = float(parsed_row["effective_rate"])
                        except ValueError:
                            pass
                    raw_records.append(parsed_row)
        else:
            # Try raw json
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                raw_records = data if isinstance(data, list) else [data]

    # Apply Module 3 boundary redaction on unstructured note/metadata fields
    redacted_records: list[dict[str, Any]] = []
    for r in raw_records:
        rec_copy = dict(r)
        if "notes" in rec_copy and isinstance(rec_copy["notes"], str):
            # Check for sensitive tokens inside note text
            for key in REDACT_KEYS:
                if key in rec_copy["notes"].lower():
                    rec_copy["notes"] = "[REDACTED]"
                    break
        redacted_records.append(rec_copy)

    metrics = StageMetrics(
        stage_name="extract",
        count_in=len(raw_records),
        count_out=len(redacted_records),
        count_bad=0,
    )
    metrics.log()

    return redacted_records, metrics
