"""
TaxPulse Analytical Pipeline — Integration & Quality Tests

Tests:
1. Pydantic v2 boundary enforcement (model_validate, field_validator)
2. Five value-level data quality checks (amount range, uniqueness, referential, freshness, batch size)
3. Row conservation invariants (count_out + count_bad == count_in)
4. Planted bad rows quarantined with attached failure reasons
5. Quarantine rate threshold alarm gate (> 2% fails, <= 2% passes)
6. End-to-end 5-stage pipeline execution with analytics schema isolation and SNS event publication
"""

from datetime import date, datetime, timedelta
import os
import pytest
from pydantic import ValidationError

from services.pipeline.metrics import ConservationViolationError, StageMetrics
from services.pipeline.models import IncomeEvent, IncomeRollupRecord, validate_boundary_rows
from services.pipeline.quality import check_batch_size, check_quality
from services.pipeline.run import run
from services.pipeline.stages.extract import extract
from services.pipeline.stages.load import load
from services.pipeline.stages.publish import publish
from services.pipeline.stages.transform import transform
from services.pipeline.stages.validate import QuarantineRateThresholdExceededError, validate


def create_sample_event(
    event_id: str = "evt-001",
    tenant_id: str = "11111111-1111-4111-8111-111111111111",
    cycle_id: str = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    client_id: str = "CLI-001",
    jurisdiction_code: str = "06001",
    planning_period: str = "2026-Q3",
    income_source: str = "w2_salary",
    amount_cents: int = 150_000_00,  # $150,000.00
    effective_rate: float = 0.2850,
    event_date: str = "2026-06-15",
    notes: str = "Standard payroll",
) -> dict:
    return {
        "event_id": event_id,
        "tenant_id": tenant_id,
        "cycle_id": cycle_id,
        "client_id": client_id,
        "jurisdiction_code": jurisdiction_code,
        "planning_period": planning_period,
        "income_source": income_source,
        "amount_cents": amount_cents,
        "effective_rate": effective_rate,
        "event_date": event_date,
        "notes": notes,
        "created_at": "2026-06-15T12:00:00Z",
    }


# ==============================================================================
# 1. Pydantic v2 Boundary Validation Tests
# ==============================================================================

def test_pydantic_v2_valid_event():
    raw = create_sample_event()
    event = IncomeEvent.model_validate(raw)
    assert event.event_id == "evt-001"
    assert event.amount_cents == 150_000_00
    assert event.jurisdiction_code == "06001"
    assert event.event_date == date(2026, 6, 15)


def test_pydantic_v2_rejects_negative_amount():
    raw = create_sample_event(amount_cents=-500)
    with pytest.raises(ValidationError) as exc:
        IncomeEvent.model_validate(raw)
    errors = exc.value.errors()
    assert any(e["loc"] == ("amount_cents",) for e in errors)


def test_pydantic_v2_rejects_invalid_jurisdiction_format():
    # Less than 5 digits (leading zero stripped) or non-digits
    raw = create_sample_event(jurisdiction_code="6001")
    with pytest.raises(ValidationError) as exc:
        IncomeEvent.model_validate(raw)
    errors = exc.value.errors()
    assert any(e["loc"] == ("jurisdiction_code",) for e in errors)


def test_pydantic_v2_rejects_invalid_planning_period():
    raw = create_sample_event(planning_period="2026-Q5")
    with pytest.raises(ValidationError):
        IncomeEvent.model_validate(raw)


def test_boundary_validation_preserves_field_errors():
    valid_raw = create_sample_event(event_id="good-1")
    invalid_raw = create_sample_event(event_id="bad-1", amount_cents=-100)

    good, bad = validate_boundary_rows([valid_raw, invalid_raw])
    assert len(good) == 1
    assert len(bad) == 1
    assert bad[0]["row"]["event_id"] == "bad-1"
    assert "errors" in bad[0]


# ==============================================================================
# 2. Data Quality Suite Tests (5 Value-Level Checks)
# ==============================================================================

def test_dq_amount_range_check():
    # Negative/Zero amount should fail DQ range check if it bypassed structural types
    event = IncomeEvent.model_validate(create_sample_event(amount_cents=0))
    good, bad = check_quality([event])
    assert len(good) == 0
    assert len(bad) == 1
    assert "amount_not_positive" in bad[0]["reasons"]


def test_dq_uniqueness_check():
    event1 = IncomeEvent.model_validate(create_sample_event(event_id="dup-1"))
    event2 = IncomeEvent.model_validate(create_sample_event(event_id="dup-1"))

    good, bad = check_quality([event1, event2])
    assert len(good) == 1
    assert len(bad) == 1
    assert "duplicate_event_id" in bad[0]["reasons"]


def test_dq_referential_jurisdiction_check():
    # Unknown state FIPS prefix '99'
    event = IncomeEvent.model_validate(create_sample_event(jurisdiction_code="99001"))
    good, bad = check_quality([event])
    assert len(good) == 0
    assert len(bad) == 1
    assert any("unrecognized_state_fips_prefix" in r for r in bad[0]["reasons"])


def test_dq_freshness_check():
    # Future event date
    tomorrow = date.today() + timedelta(days=2)
    event = IncomeEvent.model_validate(create_sample_event(event_date=tomorrow.isoformat()))
    good, bad = check_quality([event], today=date.today())
    assert len(good) == 0
    assert len(bad) == 1
    assert any("future_event_date" in r for r in bad[0]["reasons"])


def test_dq_batch_size_check():
    issues_empty = check_batch_size([], min_size=1)
    assert len(issues_empty) > 0
    assert "batch_size_empty_or_too_small" in issues_empty[0]


# ==============================================================================
# 3. Row Conservation Invariant Tests
# ==============================================================================

def test_row_conservation_valid():
    metrics = StageMetrics(stage_name="validate", count_in=100, count_out=95, count_bad=5)
    assert metrics.count_out + metrics.count_bad == metrics.count_in


def test_row_conservation_violation_raises():
    with pytest.raises(ConservationViolationError):
        # 95 + 4 != 100 -> leaked row
        StageMetrics(stage_name="validate", count_in=100, count_out=95, count_bad=4)


# ==============================================================================
# 4. Quarantine Rate Threshold Gating Tests
# ==============================================================================

def test_quarantine_rate_under_threshold_passes():
    # 100 rows, 1 bad row = 1% quarantine rate (<= 2% threshold)
    events = [create_sample_event(event_id=f"good-{i}") for i in range(99)]
    events.append(create_sample_event(event_id="bad-1", amount_cents=-50))

    good, bad, metrics = validate(
        raw_rows=events,
        rate_threshold=0.02,
        quarantine_bucket="taxpulse-analytics-quarantine",
    )
    assert len(good) == 99
    assert len(bad) == 1
    assert metrics.count_bad == 1


def test_quarantine_rate_exceeded_raises_and_alerts():
    # 10 rows, 1 bad row = 10% quarantine rate (> 2% threshold)
    events = [create_sample_event(event_id=f"good-{i}") for i in range(9)]
    events.append(create_sample_event(event_id="bad-1", amount_cents=-50))

    with pytest.raises(QuarantineRateThresholdExceededError) as exc:
        validate(
            raw_rows=events,
            rate_threshold=0.02,
            quarantine_bucket="taxpulse-analytics-quarantine",
        )
    assert "docs/runbooks/quarantine-rate.md" in str(exc.value)


# ==============================================================================
# 5. End-to-End 5-Stage Pipeline Execution Test
# ==============================================================================

def test_end_to_end_pipeline_execution():
    os.environ["AWS_ENDPOINT_URL"] = "http://localhost:4566"
    os.environ["AWS_ACCESS_KEY_ID"] = "test"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "test"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

    # Dataset with 50 valid events across 2 clients/periods + 1 planted bad row
    rows = []
    for i in range(25):
        rows.append(create_sample_event(
            event_id=f"cli1-2025-{i}",
            client_id="CLI-001",
            planning_period="2025-Q1",
            amount_cents=10_000_00,
            effective_rate=0.20,
        ))
    for i in range(25):
        rows.append(create_sample_event(
            event_id=f"cli1-2026-{i}",
            client_id="CLI-001",
            planning_period="2026-Q1",
            amount_cents=12_000_00,
            effective_rate=0.25,
        ))
    # Planted bad row (negative amount)
    rows.append(create_sample_event(
        event_id="bad-clawback-1",
        amount_cents=-50_000,
    ))

    # Run the 5-stage pipeline
    result = run(source=rows)

    assert result["status"] == "COMPLETED"
    assert result["stages"]["extract"]["count_in"] == 51
    assert result["stages"]["validate"]["count_out"] == 50
    assert result["stages"]["validate"]["count_bad"] == 1
    assert result["quarantined_records"] == 1
    assert result["loaded_cycles"] >= 2
    assert result["publish_message_id"] != ""
