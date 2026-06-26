from collections.abc import Awaitable
from typing import Protocol

from pydantic import ValidationError

from taxpulse_python.tax_liability_model import (
    TaxCalcFilingStatus,
    TaxCalcRequest,
    TaxPlanCycleAggregationPayload,
)


class TaxLiabilitySourceError(Exception):
    pass


class TaxLiabilityValidationError(Exception):
    def __init__(self, error: ValidationError) -> None:
        super().__init__("Invalid Tax Plan Cycle payload for real-time tax-liability calculation.")
        self.error = error


class TaxCalcResult:
    def __init__(
        self,
        *,
        filing_status: TaxCalcFilingStatus,
        state: str,
        taxable_income: float,
        estimated_tax_liability: float,
        is_placeholder: bool,
    ) -> None:
        self.filing_status = filing_status
        self.state = state
        self.taxable_income = taxable_income
        self.estimated_tax_liability = estimated_tax_liability
        self.is_placeholder = is_placeholder


class TaxLiabilityScenarioResult:
    def __init__(
        self,
        *,
        scenario_id: str,
        label: str,
        projected_tax_liability: float,
        projected_net_income_after_deductions: float,
    ) -> None:
        self.scenario_id = scenario_id
        self.label = label
        self.projected_tax_liability = projected_tax_liability
        self.projected_net_income_after_deductions = projected_net_income_after_deductions

    def as_dict(self) -> dict[str, str | float]:
        return {
            "scenario_id": self.scenario_id,
            "label": self.label,
            "projected_tax_liability": self.projected_tax_liability,
            "projected_net_income_after_deductions": self.projected_net_income_after_deductions,
        }


class TaxLiabilityModelingResult:
    def __init__(
        self,
        *,
        payload: TaxPlanCycleAggregationPayload,
        total_holding_market_value: float,
        scenario_results: list[TaxLiabilityScenarioResult],
    ) -> None:
        self.payload = payload
        self.total_holding_market_value = total_holding_market_value
        self.scenario_results = scenario_results


class TaxPlanCycleDataSource(Protocol):
    def load_payload(self) -> Awaitable[object]: ...


async def calculate_tax_result(request: TaxCalcRequest) -> TaxCalcResult:
    taxable_income = max(request.income - request.deductions, 0.0)

    return TaxCalcResult(
        filing_status=request.filing_status,
        state=request.state,
        taxable_income=taxable_income,
        estimated_tax_liability=taxable_income * 0.20,
        is_placeholder=True,
    )


def _calculate_scenario_results(
    payload: TaxPlanCycleAggregationPayload,
) -> list[TaxLiabilityScenarioResult]:
    base_income = sum(item.amount for item in payload.income_events)
    base_deductions = sum(item.amount for item in payload.deductions)

    results: list[TaxLiabilityScenarioResult] = []
    for scenario in payload.scenarios:
        projected_income = base_income + scenario.projected_additional_income
        projected_deductions = base_deductions + scenario.projected_additional_deductions
        projected_net_income_after_deductions = projected_income - projected_deductions
        taxable_amount = max(projected_net_income_after_deductions, 0)
        results.append(
            TaxLiabilityScenarioResult(
                scenario_id=scenario.scenario_id,
                label=scenario.label,
                projected_tax_liability=taxable_amount * scenario.effective_tax_rate,
                projected_net_income_after_deductions=projected_net_income_after_deductions,
            )
        )

    return results


async def model_tax_liability(source: TaxPlanCycleDataSource) -> TaxLiabilityModelingResult:
    try:
        raw_payload = await source.load_payload()
    except Exception as error:
        raise TaxLiabilitySourceError(
            "Unable to load Tax Plan Cycle payload for real-time tax-liability calculation."
        ) from error

    try:
        payload = TaxPlanCycleAggregationPayload.model_validate(raw_payload)
    except ValidationError as error:
        raise TaxLiabilityValidationError(error) from error

    return TaxLiabilityModelingResult(
        payload=payload,
        total_holding_market_value=sum(holding.market_value for holding in payload.holdings),
        scenario_results=_calculate_scenario_results(payload),
    )
