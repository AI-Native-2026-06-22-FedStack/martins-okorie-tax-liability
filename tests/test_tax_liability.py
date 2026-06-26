import asyncio
from collections.abc import Mapping

import pytest
from pydantic import ValidationError
from taxpulse_python.tax_liability import (
    TaxLiabilitySourceError,
    TaxLiabilityValidationError,
    calculate_tax_result,
    model_tax_liability,
)
from taxpulse_python.tax_liability_model import TaxCalcRequest, TaxPlanCycleAggregationPayload

VALID_PAYLOAD: dict[str, object] = {
    "tax_plan_cycle": {
        "tax_plan_cycle_id": "cycle-fictional-2026-q1",
        "tenant_workspace_id": "tenant-fictional-advisory",
        "advisor_id": "advisor-fictional-1",
        "client_id": "client-fictional-1",
        "planning_period": "2026-Q1",
        "stage": "Modeling",
        "on_hold": False,
        "due_date": "2026-04-15",
        "priority": "normal",
    },
    "income_events": [
        {
            "income_event_id": "income-fictional-1",
            "amount": 120000.0,
            "occurred_on": "2026-01-15T00:00:00Z",
        },
        {
            "income_event_id": "income-fictional-2",
            "amount": 3500.0,
            "occurred_on": "2026-02-01T00:00:00Z",
        },
    ],
    "deductions": [
        {
            "deduction_id": "deduction-fictional-1",
            "amount": 24000.0,
            "incurred_on": "2026-03-01T00:00:00Z",
        }
    ],
    "holdings": [
        {
            "holding_id": "holding-fictional-1",
            "unrealized_gain": 15000.0,
            "market_value": 250000.0,
        }
    ],
    "scenarios": [
        {
            "scenario_id": "scenario-fictional-baseline",
            "label": "Baseline",
            "projected_additional_income": 0.0,
            "projected_additional_deductions": 0.0,
            "effective_tax_rate": 0.24,
        },
        {
            "scenario_id": "scenario-fictional-deduction",
            "label": "Deduction timing",
            "projected_additional_income": 0.0,
            "projected_additional_deductions": 10000.0,
            "effective_tax_rate": 0.24,
        },
    ],
}


def test_tax_calc_request_model_validate_accepts_valid_input() -> None:
    request = TaxCalcRequest.model_validate(
        {
            "filing_status": "married_filing_jointly",
            "income": 180000.0,
            "deductions": 42000.0,
            "state": "NY",
        }
    )

    assert request.filing_status == "married_filing_jointly"
    assert request.income == 180000.0
    assert request.deductions == 42000.0
    assert request.state == "NY"


def test_tax_calc_request_model_validate_rejects_invalid_filing_status() -> None:
    with pytest.raises(ValidationError):
        TaxCalcRequest.model_validate(
            {
                "filing_status": "joint",
                "income": 180000.0,
                "deductions": 42000.0,
                "state": "NY",
            }
        )


@pytest.mark.asyncio
async def test_calculate_tax_result_returns_placeholder_result() -> None:
    request = TaxCalcRequest.model_validate(
        {
            "filing_status": "single",
            "income": 125000.0,
            "deductions": 25000.0,
            "state": "CA",
        }
    )

    result = await calculate_tax_result(request)

    assert result.filing_status == "single"
    assert result.state == "CA"
    assert result.taxable_income == 100000.0
    assert result.estimated_tax_liability == 20000.0
    assert result.is_placeholder is True


@pytest.mark.asyncio
async def test_calculate_tax_result_floors_taxable_income_at_zero() -> None:
    request = TaxCalcRequest.model_validate(
        {
            "filing_status": "head_of_household",
            "income": 15000.0,
            "deductions": 20000.0,
            "state": "WA",
        }
    )

    result = await calculate_tax_result(request)

    assert result.taxable_income == 0.0
    assert result.estimated_tax_liability == 0.0
    assert result.is_placeholder is True


class FakeTaxPlanCycleDataSource:
    def __init__(self, payload: object = VALID_PAYLOAD, *, should_fail: bool = False) -> None:
        self.payload = payload
        self.should_fail = should_fail

    async def load_payload(self) -> object:
        await asyncio.sleep(0)
        if self.should_fail:
            raise RuntimeError("fictional source failure")
        return self.payload


def test_model_validate_accepts_valid_tax_plan_cycle_payload() -> None:
    payload = TaxPlanCycleAggregationPayload.model_validate(VALID_PAYLOAD)

    assert payload.tax_plan_cycle.tax_plan_cycle_id == "cycle-fictional-2026-q1"
    assert payload.scenarios[1].projected_net_adjustment == -10000.0


def test_model_validate_rejects_invalid_tax_plan_cycle_payload() -> None:
    valid_scenarios = VALID_PAYLOAD["scenarios"]
    assert isinstance(valid_scenarios, list)
    valid_comparison = valid_scenarios[1]
    assert isinstance(valid_comparison, Mapping)

    invalid_payload = {
        **VALID_PAYLOAD,
        "scenarios": [
            {
                "scenario_id": "scenario-fictional-invalid",
                "label": "Invalid negative projection",
                "projected_additional_income": -1.0,
                "projected_additional_deductions": 0.0,
                "effective_tax_rate": 0.24,
            },
            valid_comparison,
        ],
    }

    with pytest.raises(ValidationError):
        TaxPlanCycleAggregationPayload.model_validate(invalid_payload)


@pytest.mark.asyncio
async def test_model_tax_liability_returns_expected_synthetic_result() -> None:
    result = await model_tax_liability(FakeTaxPlanCycleDataSource())

    assert result.total_holding_market_value == 250000.0
    assert [scenario.as_dict() for scenario in result.scenario_results] == [
        {
            "scenario_id": "scenario-fictional-baseline",
            "label": "Baseline",
            "projected_tax_liability": 23880.0,
            "projected_net_income_after_deductions": 99500.0,
        },
        {
            "scenario_id": "scenario-fictional-deduction",
            "label": "Deduction timing",
            "projected_tax_liability": 21480.0,
            "projected_net_income_after_deductions": 89500.0,
        },
    ]


@pytest.mark.asyncio
async def test_model_tax_liability_surfaces_typed_source_error() -> None:
    with pytest.raises(TaxLiabilitySourceError):
        await model_tax_liability(FakeTaxPlanCycleDataSource(should_fail=True))


@pytest.mark.asyncio
async def test_model_tax_liability_surfaces_typed_validation_error() -> None:
    invalid_payload = {**VALID_PAYLOAD, "income_events": [{"amount": "not-a-number"}]}

    with pytest.raises(TaxLiabilityValidationError):
        await model_tax_liability(FakeTaxPlanCycleDataSource(invalid_payload))
