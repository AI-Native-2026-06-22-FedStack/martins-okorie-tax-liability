from typing import Annotated

from app.schema_validator import validate_payload_against_shared_schema
from pydantic import BaseModel, Field, field_validator, model_validator


class CalculationRequest(BaseModel):
    filing_status: str = Field(
        ...,
        description=(
            "Filing status (e.g. single, married_filing_jointly, "
            "head_of_household, married_filing_separately)"
        ),
    )
    income: float = Field(..., ge=0.0, description="Gross income (must be >= 0)")
    deductions: float = Field(..., ge=0.0, description="Total deductions (must be >= 0)")
    state: str = Field(..., min_length=2, max_length=2, description="Two-letter state code")

    @model_validator(mode="after")
    def validate_with_shared_schema(self) -> "CalculationRequest":
        validate_payload_against_shared_schema(self.model_dump())
        return self


class CalculationResponse(BaseModel):
    federal_liability: float
    state_liability: float
    effective_rate: float
    marginal_rate: float
    quarterly_estimate: float


class ScenarioItem(BaseModel):
    name: str = Field(..., description="Scenario identifier or descriptive name")
    filing_status: str
    income: float = Field(..., ge=0.0, description="Gross income (must be >= 0)")
    deductions: float = Field(..., ge=0.0, description="Total deductions (must be >= 0)")
    state: str = Field(..., min_length=2, max_length=2, description="Two-letter state code")


class ScenarioComparisonRequest(BaseModel):
    baseline: CalculationRequest
    scenarios: Annotated[
        list[ScenarioItem],
        Field(..., description="List of 2 to 5 modeled scenarios")
    ]

    @field_validator("scenarios")
    @classmethod
    def validate_scenario_count(cls, scenarios: list[ScenarioItem]) -> list[ScenarioItem]:
        if len(scenarios) < 2 or len(scenarios) > 5:
            raise ValueError(
                f"Scenario count must be between 2 and 5; got {len(scenarios)}."
            )
        return scenarios


class ScenarioResult(BaseModel):
    name: str
    total_tax: float
    delta_vs_baseline: float
    calculation: CalculationResponse


class ScenarioComparisonResponse(BaseModel):
    baseline_total_tax: float
    scenarios: list[ScenarioResult]
