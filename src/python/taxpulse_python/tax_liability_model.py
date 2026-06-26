from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class StrictTaxPulseModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)


TaxPlanCycleStage = Literal[
    "Intake",
    "Data Aggregation",
    "Modeling",
    "Review",
    "Client Approval",
    "Executed",
    "Archived",
]

TaxPlanCyclePriority = Literal["low", "normal", "high"]

TaxCalcFilingStatus = Literal[
    "single",
    "married_filing_jointly",
    "married_filing_separately",
    "head_of_household",
]


class TaxCalcRequest(StrictTaxPulseModel):
    filing_status: TaxCalcFilingStatus
    income: float = Field(ge=0)
    deductions: float = Field(ge=0)
    state: str = Field(min_length=2, max_length=2)


class TaxPlanCycle(StrictTaxPulseModel):
    tax_plan_cycle_id: str
    tenant_workspace_id: str
    advisor_id: str
    client_id: str
    planning_period: str
    stage: TaxPlanCycleStage
    on_hold: bool
    hold_reason: str | None = None
    due_date: str
    priority: TaxPlanCyclePriority


class IncomeEvent(StrictTaxPulseModel):
    income_event_id: str
    amount: float = Field(ge=0)
    occurred_on: str


class Deduction(StrictTaxPulseModel):
    deduction_id: str
    amount: float = Field(ge=0)
    incurred_on: str


class Holding(StrictTaxPulseModel):
    holding_id: str
    unrealized_gain: float
    market_value: float = Field(ge=0)


class TaxLiabilityScenarioInput(StrictTaxPulseModel):
    scenario_id: str
    label: str
    projected_additional_income: float = Field(ge=0)
    projected_additional_deductions: float = Field(ge=0)
    effective_tax_rate: float = Field(ge=0, le=1)

    @property
    def projected_net_adjustment(self) -> float:
        return self.projected_additional_income - self.projected_additional_deductions


class TaxPlanCycleAggregationPayload(StrictTaxPulseModel):
    tax_plan_cycle: TaxPlanCycle
    income_events: list[IncomeEvent]
    deductions: list[Deduction]
    holdings: list[Holding]
    scenarios: list[TaxLiabilityScenarioInput] = Field(min_length=2, max_length=5)
