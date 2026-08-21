"""
TaxPulse Analytical Pipeline — Data Quality Suite

Asserts value-level expectations over structurally-validated batches beyond Pydantic types:
1. Range check: amount_cents > 0 and within high-net-worth operational bounds ($0 to $500M)
2. Uniqueness check: event_id is distinct across the batch
3. Referential check: jurisdiction_code exists in the recognized state/territory FIPS catalogue
4. Freshness check: event_date is not in the future and within planning period boundary
5. Batch sanity check: batch size is non-empty and within operational capacity limits
"""

from datetime import date
from typing import Any

from services.pipeline.models import IncomeEvent

# Recognized 2-digit state FIPS prefixes for US jurisdictions
KNOWN_STATE_FIPS_PREFIXES = {
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
    "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
    "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
    "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
    "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
    "56", "72",  # 72 = Puerto Rico
}

MAX_EVENT_AMOUNT_CENTS = 500_000_000_00  # $500,000,000.00 sanity ceiling
MIN_HISTORICAL_YEAR = 2020


def check_batch_size(events: list[IncomeEvent], min_size: int = 1, max_size: int = 5_000_000) -> list[str]:
    """Sanity checks the batch size."""
    issues = []
    if len(events) < min_size:
        issues.append(f"batch_size_empty_or_too_small: {len(events)} < {min_size}")
    elif len(events) > max_size:
        issues.append(f"batch_size_exceeds_operational_limit: {len(events)} > {max_size}")
    return issues


def check_quality(
    events: list[IncomeEvent],
    today: date | None = None,
    allowed_jurisdictions: set[str] | None = None,
) -> tuple[list[IncomeEvent], list[dict[str, Any]]]:
    """
    Evaluates the five value-level data quality expectations on validated IncomeEvent records.

    Returns:
        good: Events that passed all data-quality checks.
        bad: Quarantined records with the event data and list of specific failure reasons.
    """
    current_date = today or date.today()
    seen_event_ids: set[str] = set()

    good: list[IncomeEvent] = []
    bad: list[dict[str, Any]] = []

    for event in events:
        reasons: list[str] = []

        # 1. Range expectation: amount must be strictly positive and under sanity ceiling
        if event.amount_cents <= 0:
            reasons.append("amount_not_positive")
        elif event.amount_cents > MAX_EVENT_AMOUNT_CENTS:
            reasons.append("amount_exceeds_sanity_ceiling")

        # 2. Uniqueness expectation: event_id must not be duplicated within the batch
        if event.event_id in seen_event_ids:
            reasons.append("duplicate_event_id")
        else:
            seen_event_ids.add(event.event_id)

        # 3. Referential expectation: jurisdiction_code must belong to recognized state FIPS prefix
        prefix = event.jurisdiction_code[:2]
        if allowed_jurisdictions is not None:
            if event.jurisdiction_code not in allowed_jurisdictions:
                reasons.append(f"unrecognized_jurisdiction_code: {event.jurisdiction_code}")
        elif prefix not in KNOWN_STATE_FIPS_PREFIXES:
            reasons.append(f"unrecognized_state_fips_prefix: {prefix}")

        # 4. Freshness expectation: event_date cannot be in the future or unreasonably old
        if event.event_date > current_date:
            reasons.append(f"future_event_date: {event.event_date} > {current_date}")
        elif event.event_date.year < MIN_HISTORICAL_YEAR:
            reasons.append(f"stale_event_date_before_minimum_year: {event.event_date.year} < {MIN_HISTORICAL_YEAR}")

        if reasons:
            bad.append({
                "row": event.model_dump(mode="json"),
                "stage": "validate_data_quality",
                "reasons": reasons,
            })
        else:
            good.append(event)

    return good, bad
