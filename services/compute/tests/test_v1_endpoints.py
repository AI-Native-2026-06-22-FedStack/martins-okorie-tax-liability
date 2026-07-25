from app.main import app
from fastapi.testclient import TestClient

client = TestClient(app)


def test_calculate_unauthenticated_returns_401():
    response = client.post(
        "/v1/calculate",
        json={
            "filing_status": "single",
            "income": 120000.0,
            "deductions": 14600.0,
            "state": "CA",
        },
    )
    assert response.status_code == 401


def test_calculate_authenticated_success(valid_token):
    headers = {"Authorization": f"Bearer {valid_token}"}
    response = client.post(
        "/v1/calculate",
        headers=headers,
        json={
            "filing_status": "single",
            "income": 120000.0,
            "deductions": 14600.0,
            "state": "CA",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "federal_liability" in data
    assert "state_liability" in data
    assert "effective_rate" in data
    assert "marginal_rate" in data
    assert "quarterly_estimate" in data
    assert data["federal_liability"] > 0.0


def test_calculate_negative_income_returns_422(valid_token):
    headers = {"Authorization": f"Bearer {valid_token}"}
    response = client.post(
        "/v1/calculate",
        headers=headers,
        json={
            "filing_status": "single",
            "income": -1000.0,
            "deductions": 14600.0,
            "state": "CA",
        },
    )
    assert response.status_code == 422


def test_scenario_unauthenticated_returns_401():
    response = client.post(
        "/v1/scenario",
        json={
            "baseline": {
                "filing_status": "single",
                "income": 100000.0,
                "deductions": 14600.0,
                "state": "CA",
            },
            "scenarios": [
                {
                    "name": "S1",
                    "filing_status": "single",
                    "income": 110000.0,
                    "deductions": 14600.0,
                    "state": "CA",
                },
                {
                    "name": "S2",
                    "filing_status": "single",
                    "income": 120000.0,
                    "deductions": 14600.0,
                    "state": "CA",
                },
            ],
        },
    )
    assert response.status_code == 401


def test_scenario_authenticated_valid_scenarios_returns_200(valid_token):
    headers = {"Authorization": f"Bearer {valid_token}"}
    response = client.post(
        "/v1/scenario",
        headers=headers,
        json={
            "baseline": {
                "filing_status": "single",
                "income": 100000.0,
                "deductions": 14600.0,
                "state": "CA",
            },
            "scenarios": [
                {
                    "name": "Bonus Scenario",
                    "filing_status": "single",
                    "income": 120000.0,
                    "deductions": 14600.0,
                    "state": "CA",
                },
                {
                    "name": "Deduction Scenario",
                    "filing_status": "single",
                    "income": 100000.0,
                    "deductions": 30000.0,
                    "state": "CA",
                },
            ],
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "baseline_total_tax" in data
    assert len(data["scenarios"]) == 2
    assert data["scenarios"][0]["name"] == "Bonus Scenario"
    assert data["scenarios"][0]["delta_vs_baseline"] > 0.0
    assert data["scenarios"][1]["name"] == "Deduction Scenario"
    assert data["scenarios"][1]["delta_vs_baseline"] < 0.0


def test_scenario_1_scenario_returns_422(valid_token):
    headers = {"Authorization": f"Bearer {valid_token}"}
    response = client.post(
        "/v1/scenario",
        headers=headers,
        json={
            "baseline": {
                "filing_status": "single",
                "income": 100000.0,
                "deductions": 14600.0,
                "state": "CA",
            },
            "scenarios": [
                {
                    "name": "Single Scenario",
                    "filing_status": "single",
                    "income": 110000.0,
                    "deductions": 14600.0,
                    "state": "CA",
                }
            ],
        },
    )
    assert response.status_code == 422


def test_scenario_6_scenarios_returns_422(valid_token):
    headers = {"Authorization": f"Bearer {valid_token}"}
    scenarios = [
        {
            "name": f"Scenario {i}",
            "filing_status": "single",
            "income": 100000.0 + i * 1000,
            "deductions": 14600.0,
            "state": "CA",
        }
        for i in range(1, 7)  # 6 scenarios
    ]
    response = client.post(
        "/v1/scenario",
        headers=headers,
        json={
            "baseline": {
                "filing_status": "single",
                "income": 100000.0,
                "deductions": 14600.0,
                "state": "CA",
            },
            "scenarios": scenarios,
        },
    )
    assert response.status_code == 422


def test_calculate_invalid_shared_schema_payload_returns_422(valid_token):
    headers = {"Authorization": f"Bearer {valid_token}"}
    response = client.post(
        "/v1/calculate",
        headers=headers,
        json={
            "filing_status": "single",
            "income": 120000.0,
            "deductions": 14600.0,
            "state": "CALIFORNIA",
        },
    )
    assert response.status_code == 422
    assert "Shared JSON Schema" in response.text or "state" in response.text

