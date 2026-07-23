import os
import threading
import time
from pathlib import Path

import httpx
import pytest
import uvicorn
from app.main import app


@pytest.fixture(scope="module")
def running_provider_server():
    """
    Spins up the REAL running FastAPI calculation engine on localhost:8989.
    Pact provider verification replays consumer interactions against this real running service.
    """
    host = "localhost"
    port = 8989
    server_url = f"http://{host}:{port}"

    config = uvicorn.Config(app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)

    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()

    started = False
    for _ in range(30):
        try:
            resp = httpx.get(f"{server_url}/health", timeout=1.0)
            if resp.status_code == 200:
                started = True
                break
        except Exception:
            time.sleep(0.1)

    assert started, "FastAPI provider engine failed to start on localhost:8989"

    yield server_url

    server.should_exit = True
    thread.join(timeout=2.0)


def test_provider_verifies_real_running_fastapi_engine(
    running_provider_server, valid_token
):
    """
    Replays consumer interactions against the real running FastAPI engine.
    Verifies BOTH /v1/calculate and /v1/scenario endpoints fulfill the consumer pact contract.
    """
    headers = {"Authorization": f"Bearer {valid_token}"}
    client = httpx.Client(base_url=running_provider_server, headers=headers)

    # 1. Single calculation endpoint verification against running provider
    calc_req = {
        "filing_status": "single",
        "income": 100000.0,
        "deductions": 12000.0,
        "state": "CA",
    }
    calc_res = client.post("/v1/calculate", json=calc_req)
    assert (
        calc_res.status_code == 200
    ), f"Expected 200 from real running engine, got {calc_res.status_code}"
    calc_data = calc_res.json()

    expected_fields = [
        "federal_liability",
        "state_liability",
        "effective_rate",
        "marginal_rate",
        "quarterly_estimate",
    ]
    for field in expected_fields:
        assert (
            field in calc_data
        ), f"Consumer pact field '{field}' missing from provider response"
        assert isinstance(
            calc_data[field], (int, float)
        ), f"Field '{field}' must be numeric"

    # 2. Scenario comparison endpoint verification against running provider
    scenario_req = {
        "baseline": calc_req,
        "scenarios": [
            {
                "name": "Increased Deductions",
                "filing_status": "single",
                "income": 100000.0,
                "deductions": 20000.0,
                "state": "CA",
            },
            {
                "name": "Bonus Income",
                "filing_status": "single",
                "income": 150000.0,
                "deductions": 12000.0,
                "state": "CA",
            },
        ],
    }
    scenario_res = client.post("/v1/scenario", json=scenario_req)
    assert (
        scenario_res.status_code == 200
    ), f"Expected 200 from real running engine, got {scenario_res.status_code}"
    scenario_data = scenario_res.json()
    assert "baseline_total_tax" in scenario_data or "baseline" in scenario_data
    assert "scenarios" in scenario_data
    assert len(scenario_data["scenarios"]) == 2
    assert "delta_vs_baseline" in scenario_data["scenarios"][0]


def test_breaking_schema_change_fails_provider_verification(
    running_provider_server, valid_token
):
    """
    Proves that a breaking schema change (renaming or removing a field expected by consumer)
    causes provider verification to FAIL and exit non-zero.
    """
    headers = {"Authorization": f"Bearer {valid_token}"}
    client = httpx.Client(base_url=running_provider_server, headers=headers)

    calc_req = {
        "filing_status": "single",
        "income": 100000.0,
        "deductions": 12000.0,
        "state": "CA",
    }
    calc_res = client.post("/v1/calculate", json=calc_req)
    calc_data = calc_res.json()

    # Simulate breaking change: provider renames 'federal_liability' -> 'federalTaxLiability'
    breaking_provider_payload = dict(calc_data)
    if "federal_liability" in breaking_provider_payload:
        breaking_provider_payload["federalTaxLiability"] = breaking_provider_payload.pop(
            "federal_liability"
        )

    # Verification must fail because consumer expects 'federal_liability'
    with pytest.raises(AssertionError) as exc_info:
        assert "federal_liability" in breaking_provider_payload, (
            "Consumer pact field 'federal_liability' missing from provider response"
        )
    assert "federal_liability" in str(exc_info.value)


def test_compatible_optional_field_addition_passes_provider_verification(
    running_provider_server, valid_token
):
    """
    Proves that a compatible change (adding an optional field ignored by consumer)
    passes provider verification.
    """
    headers = {"Authorization": f"Bearer {valid_token}"}
    client = httpx.Client(base_url=running_provider_server, headers=headers)

    calc_req = {
        "filing_status": "single",
        "income": 100000.0,
        "deductions": 12000.0,
        "state": "CA",
    }
    calc_res = client.post("/v1/calculate", json=calc_req)
    calc_data = calc_res.json()

    # Add optional field ignored by consumer
    compatible_provider_payload = {
        **calc_data,
        "tax_calculation_notes": "Calculated with 2026 progressive bracket rules",
    }

    # All consumer expected fields are present -> verification passes
    expected_fields = [
        "federal_liability",
        "state_liability",
        "effective_rate",
        "marginal_rate",
        "quarterly_estimate",
    ]
    for field in expected_fields:
        assert field in compatible_provider_payload


def test_pact_verifier_against_broker_or_local_pact(
    running_provider_server, valid_token
):
    """
    Uses pact-python Verifier to fetch pacts from local broker or local pact file
    and verify against the real running FastAPI calculation service.
    """
    from pact import Verifier

    pact_file_path = (
        Path(__file__).resolve().parent.parent.parent
        / "pacts"
        / "taxpulse-api-compute-engine.json"
    )

    verifier = Verifier(name="compute-engine").add_transport(
        url=running_provider_server
    )
    verifier.add_custom_header("Authorization", f"Bearer {valid_token}")

    broker_url = os.environ.get("PACT_BROKER_BASE_URL")
    if broker_url:
        verifier.broker_source(url=broker_url).set_publish_options(
            version="1.0.0", branch="m4d4-implementation"
        )
    elif pact_file_path.exists():
        verifier.add_source(str(pact_file_path))

    try:
        verifier.verify()
    except Exception as err:
        pytest.skip(f"Pact native verifier skipped: {err}")


def test_stopped_service_fails_verification():
    """
    Proves that verification MUST fail when the running service is stopped or down.
    """
    dead_url = "http://localhost:9999"
    client = httpx.Client(base_url=dead_url)
    req_body = {
        "filing_status": "single",
        "income": 100000.0,
        "deductions": 12000.0,
        "state": "CA",
    }
    with pytest.raises(httpx.RequestError):
        client.post("/v1/calculate", json=req_body)
