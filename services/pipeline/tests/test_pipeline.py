"""
TaxPulse Analytical Pipeline — Integration & Quality Tests

Tests:
1. Pydantic v2 boundary enforcement (model_validate, field_validator)
2. Five value-level data quality checks (amount range, uniqueness, referential, freshness, batch size)
3. Row conservation invariants (count_out + count_bad == count_in)
4. Stage leak localization (deliberate lossy stage failure)
5. Planted bad rows quarantined with attached failure reasons
6. Quarantine rate threshold alarm gate (> 2% fails, <= 2% passes)
7. Operational database table immutability (public schema untouched)
8. Module 6 event fabric verification (SNS publish arrives on subscribed SQS queue)
9. Boundary redaction verification (sensitive credentials censored before validation)
"""

from datetime import date, datetime, timedelta
import json
import os
import boto3
import psycopg
import pytest
from pydantic import ValidationError

from services.pipeline.metrics import ConservationViolationError, StageMetrics
from services.pipeline.models import IncomeEvent, IncomeRollupRecord, validate_boundary_rows
from services.pipeline.quality import check_batch_size, check_quality
from services.pipeline.run import run
from services.pipeline.stages.extract import extract, redact_record_failsafe
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
# 3. Row Conservation & Leak Localization Tests
# ==============================================================================

def test_row_conservation_valid():
    metrics = StageMetrics(stage_name="validate", count_in=100, count_out=95, count_bad=5)
    assert metrics.count_out + metrics.count_bad == metrics.count_in


def test_row_conservation_violation_raises():
    with pytest.raises(ConservationViolationError):
        # 95 + 4 != 100 -> leaked row
        StageMetrics(stage_name="validate", count_in=100, count_out=95, count_bad=4)


def test_leak_localization_detects_failing_stage():
    """
    Demonstrates that a deliberately broken/lossy stage is immediately localized by row counts.
    """
    # Simulate a lossy transform stage that dropped 5 rows without rejection record
    in_count = 50
    leaked_out_count = 45  # 5 rows dropped silently

    with pytest.raises(ConservationViolationError) as exc_info:
        StageMetrics(
            stage_name="transform_leaky_simulation",
            count_in=in_count,
            count_out=leaked_out_count,
            count_bad=0,
        )

    # Verification: error message explicitly names the leaking stage and exact count disparity
    assert "transform_leaky_simulation" in str(exc_info.value)
    assert "count_in (50) != count_out (45) + count_bad (0)" in str(exc_info.value)


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
# 5. Boundary Redaction Tests (Module 3 Fail-Safe)
# ==============================================================================

def test_extract_redacts_sensitive_fields():
    raw_sensitive = create_sample_event(
        notes="Client authorization token is bearer-xyz and password is secret123",
    )
    raw_sensitive["token"] = "super-secret-token"

    redacted = redact_record_failsafe(raw_sensitive)
    assert redacted["token"] == "[REDACTED]"
    assert "[REDACTED]" in redacted["notes"]
    assert "secret123" not in redacted["notes"]


# ==============================================================================
# 6. Operational Database Immutability & Event Fabric Verification
# ==============================================================================

def test_operational_database_remains_untouched():
    """
    Guarantees that executing the pipeline leaves operational tables in 'public' untouched.
    """
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/taxpulse")

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM public.tax_plan_cycle;")
            initial_cycle_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM public.tenants;")
            initial_tenant_count = cur.fetchone()[0]

    # Run pipeline with valid test events
    events = [create_sample_event(event_id=f"imm-evt-{i}") for i in range(10)]
    run(source=events)

    # Verify counts in public tables are 100% unchanged
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM public.tax_plan_cycle;")
            post_cycle_count = cur.fetchone()[0]

            cur.execute("SELECT COUNT(*) FROM public.tenants;")
            post_tenant_count = cur.fetchone()[0]

            # Verify rows wrote to analytics.income_rollup instead
            cur.execute("SELECT COUNT(*) FROM analytics.income_rollup;")
            analytics_count = cur.fetchone()[0]

    assert post_cycle_count == initial_cycle_count
    assert post_tenant_count == initial_tenant_count
    assert analytics_count >= 1


def test_sns_refresh_event_arrives_on_sqs_queue():
    """
    Verifies that the publish stage emits a domain event that arrives on the subscribed SQS queue.
    """
    endpoint_url = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    os.environ["AWS_ACCESS_KEY_ID"] = "test"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "test"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"

    topic_arn = "arn:aws:sns:us-east-1:000000000000:taxpulse-stage-changed"
    queue_url = "http://floci:4566/000000000000/taxpulse-stage-changed-projection"

    # Publish refresh event
    msg_id, metrics = publish(topic_arn=topic_arn, loaded_cycles_count=5, run_id="test-run-evt")
    assert msg_id != ""
    assert metrics.count_out == 1

    # Receive from SQS queue on floci
    sqs = boto3.client("sqs", endpoint_url=endpoint_url, aws_access_key_id="test", aws_secret_access_key="test", region_name="us-east-1")
    resp = sqs.receive_message(
        QueueUrl=queue_url,
        MaxNumberOfMessages=10,
        WaitTimeSeconds=2,
    )

    messages = resp.get("Messages", [])
    assert len(messages) > 0

    # Inspect message body
    body = json.loads(messages[0]["Body"])
    # If raw message delivery was false, body contains 'Message'; if true, body is the cloud event
    event_data = json.loads(body.get("Message", json.dumps(body))) if "Message" in body else body
    assert event_data.get("type") == "taxpulse.pipeline.corpus_refreshed"
    assert event_data.get("data", {}).get("schema") == "analytics"


# ==============================================================================
# 7. End-to-End 5-Stage Pipeline Execution Test
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
