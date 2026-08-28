# path: services/compute/tests/test_assist.py
# Comprehensive tests for AI Assist: redaction, fail-closed validation,
# latency & cost measurement, and audit trail persistence.

import os
import psycopg
import pytest
from fastapi.testclient import TestClient
import dotenv

dotenv.load_dotenv(".env.local")
dotenv.load_dotenv(".env")

import sys
from pathlib import Path

try:
    from services.compute.app.main import app
except ImportError:
    from app.main import app
from services.compute.assist import (
    AssistRequest,
    execute_assist_pipeline,
    redact_prompt_text,
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://taxpulse_app@localhost:55433/taxpulse_l")


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_redact_prompt_text_removes_sensitive_financials() -> None:
    raw = "My client earns $450,000 with $35,000 in deductions, SSN 123-45-6789. What is the reserve floor for TPX-RP-001-B?"
    redacted = redact_prompt_text(raw)

    assert "$450,000" not in redacted
    assert "$35,000" not in redacted
    assert "123-45-6789" not in redacted
    assert "[REDACTED_FINANCIAL]" in redacted
    assert "[REDACTED_SSN]" in redacted
    assert "TPX-RP-001-B" in redacted


def test_redact_prompt_fail_safe_on_invalid_input() -> None:
    with pytest.raises(ValueError):
        redact_prompt_text("")

    with pytest.raises(ValueError):
        redact_prompt_text(None)  # type: ignore[arg-type]


def test_assist_pipeline_live_query_with_redaction_and_audit() -> None:
    raw_question = "Client has $750,000 income. For TPX-RP-001-B, what maximum reserve applies to the single filer threshold table?"
    tenant_id = "tenant-alpha-advisory"
    requester = "advisor-unit-test@taxpulse.local"

    response = execute_assist_pipeline(
        raw_question=raw_question,
        tenant_id=tenant_id,
        requester=requester,
        database_url=DATABASE_URL,
    )

    # 1. Verify structured response and citation
    assert response.answer is not None and len(response.answer) > 0
    assert "18,400" in response.answer or "18400" in response.answer
    assert "TPX-RP-001-B-001" in response.citations

    # 2. Verify measured latency and non-zero token cost
    assert response.latency_ms > 0
    assert response.estimated_cost_usd > 0
    assert response.token_usage["total_tokens"] > 0

    # 3. Verify redaction happened before call
    assert "$750,000" not in response.redacted_prompt
    assert "[REDACTED_FINANCIAL]" in response.redacted_prompt

    # 4. Verify immutable audit trail in Postgres
    with psycopg.connect(DATABASE_URL) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT redacted_prompt, response_answer, citations, latency_ms, estimated_cost_usd, requester
                FROM audit.ai_assist_call
                WHERE requester = %s
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (requester,),
            )
            row = cur.fetchone()
            assert row is not None
            audit_prompt, audit_answer, audit_citations, audit_latency, audit_cost, audit_req = row

            # Assert REDACTED prompt is stored, NEVER original financial numbers
            assert "$750,000" not in audit_prompt
            assert "[REDACTED_FINANCIAL]" in audit_prompt
            assert audit_answer == response.answer
            assert audit_latency == response.latency_ms
            assert audit_cost == response.estimated_cost_usd
            assert audit_req == requester


def test_post_assist_endpoint(client: TestClient) -> None:
    payload = {
        "question": "For TPX-RP-001-B, what is the single filer reserve floor?",
        "tenant_id": "tenant-alpha-advisory",
    }
    res = client.post("/assist", json=payload)
    assert res.status_code == 200
    data = res.json()

    assert "answer" in data
    assert "citations" in data
    assert "TPX-RP-001-B-001" in data["citations"]
    assert data["latency_ms"] > 0
    assert data["estimated_cost_usd"] > 0
    assert data["token_usage"]["total_tokens"] > 0
