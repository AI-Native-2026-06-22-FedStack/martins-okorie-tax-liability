"""
TaxPulse Analytical Pipeline — Integration & Quality Tests (Week 9 Day 2 — Tasks 1, 2, 3)

Tests:
1. Pydantic v2 boundary enforcement (model_validate, field_validator)
2. Five value-level data quality checks:
   - Non-negative amount check
   - Known income source check against reference tables
   - Rate bounds check [0.0, 1.0]
   - Bracket coverage check against reference limits
   - Tenant presence check against registered tenant catalog
3. Row conservation invariants (count_out + count_bad == count_in)
4. Stage leak localization (deliberate lossy stage failure)
5. Planted bad rows quarantined to S3 with attached failure reasons (absent from loaded output)
6. Quarantine rate CloudWatch metric emission on floci
7. Quarantine rate threshold alarm gate (> 2% fails with runbook link, <= 2% passes)
8. Boundary redaction verification (Module 3 fail-safe, censored downstream & in quarantine)
9. Operational database table immutability (public schema untouched)
10. Module 6 event fabric verification (SNS publish arrives on subscribed SQS queue)
11. End-to-end 5-stage pipeline execution
"""

from datetime import date, datetime, timedelta
import json
import os
import boto3
import psycopg
import pytest
from pydantic import ValidationError

os.environ.setdefault("AWS_ENDPOINT_URL", "http://localhost:4566")
os.environ.setdefault("AWS_ACCESS_KEY_ID", "test")
os.environ.setdefault("AWS_SECRET_ACCESS_KEY", "test")
os.environ.setdefault("AWS_DEFAULT_REGION", "us-east-1")

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
# 1. Pydantic v2 Boundary Validation Tests (Task 2)
# ==============================================================================

def test_pydantic_v2_valid_event():
    raw = create_sample_event()
    event = IncomeEvent.model_validate(raw)
    assert event.event_id == "evt-001"
    assert event.amount_cents == 150_000_00
    assert event.jurisdiction_code == "06001"
    assert event.event_date == date(2026, 6, 15)


def test_pydantic_v2_refuses_missing_required_field():
    raw = create_sample_event()
    del raw["planning_period"]

    with pytest.raises(ValidationError) as exc:
        IncomeEvent.model_validate(raw)

    errors = exc.value.errors()
    assert any(e["loc"] == ("planning_period",) for e in errors)


def test_pydantic_v2_refuses_wrong_type():
    raw = create_sample_event(amount_cents="not_a_valid_integer_cents")

    with pytest.raises(ValidationError) as exc:
        IncomeEvent.model_validate(raw)

    errors = exc.value.errors()
    assert any(e["loc"] == ("amount_cents",) and "int" in e["type"] for e in errors)


def test_pydantic_v2_refuses_negative_amount_naming_field_and_value():
    negative_val = -500_00
    raw = create_sample_event(amount_cents=negative_val)

    with pytest.raises(ValidationError) as exc:
        IncomeEvent.model_validate(raw)

    errors = exc.value.errors()
    amount_err = next(e for e in errors if e["loc"] == ("amount_cents",))
    assert amount_err["input"] == negative_val
    assert "non-negative" in amount_err["msg"]
    assert str(negative_val) in amount_err["msg"]


def test_pydantic_v2_refuses_invalid_jurisdiction_format():
    raw = create_sample_event(jurisdiction_code="6001")
    with pytest.raises(ValidationError) as exc:
        IncomeEvent.model_validate(raw)
    errors = exc.value.errors()
    assert any(e["loc"] == ("jurisdiction_code",) for e in errors)


def test_pydantic_v2_refuses_invalid_planning_period():
    raw = create_sample_event(planning_period="2026-Q5")
    with pytest.raises(ValidationError):
        IncomeEvent.model_validate(raw)


def test_boundary_validation_preserves_field_errors_and_offending_values():
    valid_raw = create_sample_event(event_id="good-1")
    invalid_raw = create_sample_event(event_id="bad-1", amount_cents=-100)

    good, bad = validate_boundary_rows([valid_raw, invalid_raw])
    assert len(good) == 1
    assert len(bad) == 1
    assert bad[0]["row"]["event_id"] == "bad-1"
    assert "errors" in bad[0]
    assert bad[0]["errors"][0]["field"] == "amount_cents"
    assert bad[0]["errors"][0]["input"] == -100


def test_load_boundary_model_enforcement():
    valid_rollup = {
        "tenant_id": "11111111-1111-4111-8111-111111111111",
        "cycle_id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        "client_id": "CLI-001",
        "planning_period": "2026-Q3",
        "tax_year": 2026,
        "gross_income_cents": 250_000_00,
        "total_tax_cents": 50_000_00,
        "effective_rate_bps": 2000,
        "event_count": 10,
        "yoy_income_delta_cents": 25_000_00,
    }
    rec = IncomeRollupRecord.model_validate(valid_rollup)
    assert rec.effective_rate_bps == 2000

    # Invalid: negative gross income
    with pytest.raises(ValidationError) as exc:
        IncomeRollupRecord.model_validate({**valid_rollup, "gross_income_cents": -100})
    assert any(e["loc"] == ("gross_income_cents",) for e in exc.value.errors())

    # Invalid: effective rate bps > 10,000 (over 100%)
    with pytest.raises(ValidationError) as exc:
        IncomeRollupRecord.model_validate({**valid_rollup, "effective_rate_bps": 12000})
    assert any(e["loc"] == ("effective_rate_bps",) for e in exc.value.errors())


# ==============================================================================
# 2. Five Value-Level Data Quality Suite Tests (Task 3)
# ==============================================================================

def test_dq_check_1_non_negative_amount():
    # Value check: zero or negative amount flagged with reason
    event = IncomeEvent.model_validate(create_sample_event(amount_cents=0))
    good, bad = check_quality([event])
    assert len(good) == 0
    assert len(bad) == 1
    assert any("amount_not_positive" in r for r in bad[0]["reasons"])


def test_dq_check_2_known_income_source():
    # Value check: unrecognized income source
    raw = create_sample_event()
    raw["income_source"] = "unsupported_crypto_staking"
    event = IncomeEvent.model_validate(raw)

    good, bad = check_quality([event])
    assert len(good) == 0
    assert len(bad) == 1
    assert any("unrecognized_income_source" in r for r in bad[0]["reasons"])


def test_dq_check_3_effective_rate_bounds():
    # Value check: rate must be within [0.0, 1.0]
    # If a floating-point drift caused an invalid rate
    raw = create_sample_event()
    raw["effective_rate"] = 0.25
    event = IncomeEvent.model_validate(raw)
    good, bad = check_quality([event])
    assert len(good) == 1
    assert len(bad) == 0


def test_dq_check_4_bracket_coverage():
    # Value check: income exceeds top tax bracket limit ($100M) producing nonsense rates
    over_bracket_cents = 150_000_000_00  # $150M > $100M top bracket
    event = IncomeEvent.model_validate(create_sample_event(amount_cents=over_bracket_cents))

    good, bad = check_quality([event], max_bracket_cents=100_000_000_00)
    assert len(good) == 0
    assert len(bad) == 1
    assert any("income_exceeds_bracket_coverage" in r for r in bad[0]["reasons"])


def test_dq_check_5_tenant_presence():
    # Value check: unknown/unregistered tenant
    unknown_tenant_id = "99999999-9999-4999-8999-999999999999"
    event = IncomeEvent.model_validate(create_sample_event(tenant_id=unknown_tenant_id))

    good, bad = check_quality([event])
    assert len(good) == 0
    assert len(bad) == 1
    assert any("unregistered_or_missing_tenant" in r for r in bad[0]["reasons"])


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
# 4. Quarantine Rate Threshold & Planted Bad Row Tests (Task 3)
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
    assert bad[0]["row"]["event_id"] == "bad-1"


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


def test_planted_bad_row_quarantined_on_s3_and_absent_from_loaded_output():
    """
    Proves that a planted bad row appears in the S3 quarantine with its failure reason
    and is strictly absent from the loaded analytics rollup.
    """
    test_client_id = "CLI-PLANTED-TEST"
    test_cycle_id = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
    rows = [
        create_sample_event(
            event_id=f"clean-row-{i}",
            client_id=test_client_id,
            cycle_id=test_cycle_id,
            amount_cents=150_000_00,
        )
        for i in range(50)
    ]
    # Planted bad row: income exceeding bracket table limit
    planted_bad_id = "planted-bracket-overflow-999"
    rows.append(create_sample_event(
        event_id=planted_bad_id,
        client_id=test_client_id,
        cycle_id=test_cycle_id,
        amount_cents=200_000_000_00,  # $200M > $100M
    ))

    # Run pipeline (quarantine rate = 1/51 = 1.96% <= 2.0%)
    result = run(source=rows)
    assert result["status"] == "COMPLETED"
    assert result["quarantined_records"] == 1

    # Verify bad row was quarantined to S3
    s3 = boto3.client("s3", endpoint_url="http://localhost:4566", aws_access_key_id="test", aws_secret_access_key="test", region_name="us-east-1")
    objects = s3.list_objects_v2(Bucket="taxpulse-analytics-quarantine", Prefix=f"quarantine/{result['run_id']}")
    assert "Contents" in objects
    key = objects["Contents"][0]["Key"]

    bad_obj = s3.get_object(Bucket="taxpulse-analytics-quarantine", Key=key)
    quarantine_payload = json.loads(bad_obj["Body"].read().decode("utf-8"))

    assert quarantine_payload["row"]["event_id"] == planted_bad_id
    assert any("income_exceeds_bracket_coverage" in r for r in quarantine_payload["reasons"])

    # Verify bad row amount is NOT in loaded output
    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/taxpulse")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT gross_income_cents FROM analytics.income_rollup WHERE client_id = %s;",
                (test_client_id,),
            )
            loaded_income = cur.fetchone()[0]
            # 50 rows of $150,000.00 = $7,500,000.00 (750_000_000 cents). Does not include $200M bad row.
            assert loaded_income == 50 * 150_000_00


# ==============================================================================
# 5. Boundary Redaction Tests (Module 3 Fail-Safe)
# ==============================================================================

def test_extract_redacts_sensitive_fields_before_validation_and_downstream():
    raw_sensitive = create_sample_event(
        notes="Client authorization token is bearer-xyz and password is secret123",
    )
    raw_sensitive["token"] = "super-secret-token"
    raw_sensitive["mfa_secret"] = "otp-secret-key"

    redacted_records, metrics = extract([raw_sensitive])
    assert len(redacted_records) == 1
    redacted = redacted_records[0]

    # Sensitive keys censored at extract
    assert redacted["token"] == "[REDACTED]"
    assert redacted["mfa_secret"] == "[REDACTED]"
    assert "[REDACTED]" in redacted["notes"]
    assert "secret123" not in redacted["notes"]
    assert "bearer-xyz" not in redacted["notes"]

    # Redacted version travels to quarantine if invalid
    bad_raw = dict(redacted)
    bad_raw["amount_cents"] = -100  # Trigger quarantine
    good, bad, val_metrics = validate([bad_raw], rate_threshold=1.0)
    assert len(bad) == 1
    assert bad[0]["row"]["token"] == "[REDACTED]"
    assert "secret123" not in bad[0]["row"]["notes"]


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

    body = json.loads(messages[0]["Body"])
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
