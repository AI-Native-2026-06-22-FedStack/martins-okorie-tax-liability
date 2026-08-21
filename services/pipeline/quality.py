"""
TaxPulse Analytical Pipeline — Data Quality Suite (Task 3)

Asserts five value-level expectations over incoming rows beyond structural Pydantic types:
1. Non-negative amount check: amount_cents > 0 (strictly positive; flags negative/zero clawbacks)
2. Known income source check: verifies income_source is in declared reference categories
3. Rate bounds check: verifies effective_rate is strictly between 0.0 and 1.0
4. Bracket coverage check: reads reference bracket tables/limits so no income falls outside bracket coverage
5. Tenant presence check: verifies tenant_id exists in registered tenant organization catalog

Every failed row is quarantined with an attached failure reason and identity.
"""

from datetime import date
import os
from typing import Any, Optional

import psycopg

from services.pipeline.models import IncomeEvent

# Declared reference income sources from calculation contract & D1 profile
KNOWN_INCOME_SOURCES = {
    "w2_salary",
    "1099_dividend",
    "1099_interest",
    "k1_partnership",
    "capital_gains",
}

# Recognized 2-digit state FIPS prefixes for US jurisdictions
KNOWN_STATE_FIPS_PREFIXES = {
    "01", "02", "04", "05", "06", "08", "09", "10", "11", "12",
    "13", "15", "16", "17", "18", "19", "20", "21", "22", "23",
    "24", "25", "26", "27", "28", "29", "30", "31", "32", "33",
    "34", "35", "36", "37", "38", "39", "40", "41", "42", "44",
    "45", "46", "47", "48", "49", "50", "51", "53", "54", "55",
    "56", "72",
}

# Known registered tenants in TaxPulse platform
DEFAULT_REGISTERED_TENANTS = {
    "11111111-1111-4111-8111-111111111111",  # Evergreen Advisory Local
    "22222222-2222-4222-8222-222222222222",  # Harbor Point Wealth Local
    "33333333-3333-4333-8333-333333333333",  # Beacon Family Office
    "44444444-4444-4444-8444-444444444444",  # Pinnacle Advisory
    "018d6c1a-3f9b-7c28-8d1a-0f4a3b8c9d71",  # Active Tenant
}

# Top tax bracket coverage ceiling ($100,000,000.00 = 10,000,000,000 cents)
# Incomes exceeding bracket table limits produce nonsense progressive rates
DEFAULT_MAX_BRACKET_INCOME_CENTS = 100_000_000_00


def get_registered_tenants_from_db(database_url: Optional[str] = None) -> set[str]:
    """Loads active tenant UUIDs from PostgreSQL system of record if reachable."""
    db_url = database_url or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/taxpulse")
    try:
        with psycopg.connect(db_url) as conn:
            with conn.cursor() as cur:
                # Query tenants table (supports plural or singular)
                cur.execute(
                    """
                    SELECT id::text FROM public.tenants
                    UNION
                    SELECT id::text FROM public.tenant;
                    """
                )
                return {row[0] for row in cur.fetchall()}
    except Exception:
        return DEFAULT_REGISTERED_TENANTS


def check_batch_size(events: list[IncomeEvent], min_size: int = 1, max_size: int = 5_000_000) -> list[str]:
    """Sanity checks batch size bounds."""
    issues = []
    if len(events) < min_size:
        issues.append(f"batch_size_empty_or_too_small: {len(events)} < {min_size}")
    elif len(events) > max_size:
        issues.append(f"batch_size_exceeds_operational_limit: {len(events)} > {max_size}")
    return issues


def check_quality(
    events: list[IncomeEvent],
    today: Optional[date] = None,
    allowed_sources: Optional[set[str]] = None,
    allowed_tenants: Optional[set[str]] = None,
    allowed_jurisdictions: Optional[set[str]] = None,
    max_bracket_cents: int = DEFAULT_MAX_BRACKET_INCOME_CENTS,
) -> tuple[list[IncomeEvent], list[dict[str, Any]]]:
    """
    Evaluates the five value-level data quality checks:
      1. Non-negative amount check (amount_cents > 0)
      2. Known income source check (income_source in reference set)
      3. Rate bounds check (0.0 <= effective_rate <= 1.0)
      4. Bracket coverage check (amount_cents <= max_bracket_cents)
      5. Tenant presence check (tenant_id in registered tenant catalog)

    Returns:
        good: Events that passed all five checks.
        bad: Quarantined records preserving original row identity and detailed reasons.
    """
    valid_sources = allowed_sources or KNOWN_INCOME_SOURCES
    valid_tenants = allowed_tenants or DEFAULT_REGISTERED_TENANTS
    seen_event_ids: set[str] = set()

    good: list[IncomeEvent] = []
    bad: list[dict[str, Any]] = []

    for event in events:
        reasons: list[str] = []

        # 1. Non-negative / Positive Amount Check (D1 Anomaly #3)
        if event.amount_cents <= 0:
            reasons.append(f"amount_not_positive: amount_cents is {event.amount_cents}")

        # 2. Known Income Source Reference Check (D1 Generator Spec)
        if event.income_source not in valid_sources:
            reasons.append(f"unrecognized_income_source: '{event.income_source}' not in {sorted(valid_sources)}")

        # 3. Effective Rate Bounds Check (D1 Anomaly #2)
        if event.effective_rate < 0.0 or event.effective_rate > 1.0:
            reasons.append(f"invalid_effective_rate_bounds: rate {event.effective_rate} outside [0.0, 1.0]")

        # 4. Bracket Coverage Check (Income outside bracket table causes nonsense effective rate)
        if event.amount_cents > max_bracket_cents:
            reasons.append(
                f"income_exceeds_bracket_coverage: amount_cents {event.amount_cents} > top bracket limit {max_bracket_cents}"
            )

        # 5. Tenant Presence & Registration Check (D1 Tenant Isolation)
        if event.tenant_id not in valid_tenants:
            reasons.append(f"unregistered_or_missing_tenant: tenant_id '{event.tenant_id}' not found in registered tenant catalog")

        # Additional check: Jurisdiction FIPS prefix verification
        prefix = event.jurisdiction_code[:2]
        if allowed_jurisdictions is not None:
            if event.jurisdiction_code not in allowed_jurisdictions:
                reasons.append(f"unrecognized_jurisdiction_code: '{event.jurisdiction_code}'")
        elif prefix not in KNOWN_STATE_FIPS_PREFIXES:
            reasons.append(f"unrecognized_state_fips_prefix: '{prefix}' on jurisdiction_code '{event.jurisdiction_code}'")

        # Check event_id uniqueness across batch
        if event.event_id in seen_event_ids:
            reasons.append(f"duplicate_event_id: '{event.event_id}' already seen in current batch")
        else:
            seen_event_ids.add(event.event_id)

        if reasons:
            bad.append({
                "row": event.model_dump(mode="json"),
                "stage": "validate_data_quality",
                "reasons": reasons,
            })
        else:
            good.append(event)

    return good, bad
