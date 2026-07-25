import pytest
from app.contracts import (
    CalculationRequest,
    ScenarioComparisonRequest,
    ScenarioItem,
)
from pydantic import ValidationError


def test_calculation_request_valid():
    req = CalculationRequest(
        filing_status="single",
        income=120000.0,
        deductions=14600.0,
        state="CA"
    )
    assert req.filing_status == "single"
    assert req.income == 120000.0
    assert req.deductions == 14600.0
    assert req.state == "CA"


def test_calculation_request_negative_income_raises_422_validation_error():
    with pytest.raises(ValidationError) as exc_info:
        CalculationRequest(
            filing_status="single",
            income=-5000.0,
            deductions=14600.0,
            state="CA"
        )
    assert "income" in str(exc_info.value)


def test_calculation_request_negative_deductions_raises_validation_error():
    with pytest.raises(ValidationError) as exc_info:
        CalculationRequest(
            filing_status="single",
            income=100000.0,
            deductions=-100.0,
            state="CA"
        )
    assert "deductions" in str(exc_info.value)


def test_scenario_comparison_request_valid_count():
    baseline = CalculationRequest(
        filing_status="single",
        income=100000.0,
        deductions=14600.0,
        state="CA"
    )
    scenarios = [
        ScenarioItem(
            name="Scenario 1",
            filing_status="single",
            income=110000.0,
            deductions=14600.0,
            state="CA",
        ),
        ScenarioItem(
            name="Scenario 2",
            filing_status="single",
            income=120000.0,
            deductions=14600.0,
            state="CA",
        ),
    ]
    comp = ScenarioComparisonRequest(baseline=baseline, scenarios=scenarios)
    assert len(comp.scenarios) == 2


def test_scenario_comparison_request_too_few_scenarios_raises_validation_error():
    baseline = CalculationRequest(
        filing_status="single",
        income=100000.0,
        deductions=14600.0,
        state="CA"
    )
    scenarios = [
        ScenarioItem(
            name="Scenario 1",
            filing_status="single",
            income=110000.0,
            deductions=14600.0,
            state="CA",
        )
    ]
    with pytest.raises(ValidationError) as exc_info:
        ScenarioComparisonRequest(baseline=baseline, scenarios=scenarios)
    assert "Scenario count must be between 2 and 5" in str(exc_info.value)


def test_scenario_comparison_request_too_many_scenarios_raises_validation_error():
    baseline = CalculationRequest(
        filing_status="single",
        income=100000.0,
        deductions=14600.0,
        state="CA"
    )
    scenarios = [
        ScenarioItem(
            name=f"Scenario {i}",
            filing_status="single",
            income=100000.0 + i * 1000,
            deductions=14600.0,
            state="CA",
        )
        for i in range(1, 7)  # 6 scenarios
    ]
    with pytest.raises(ValidationError) as exc_info:
        ScenarioComparisonRequest(baseline=baseline, scenarios=scenarios)
    assert "Scenario count must be between 2 and 5" in str(exc_info.value)
