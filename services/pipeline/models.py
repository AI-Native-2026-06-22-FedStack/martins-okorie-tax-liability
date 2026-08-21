"""
TaxPulse Analytical Pipeline — Boundary Models (Pydantic v2)

Defines strict typed contracts at the extract and load boundaries:
1. IncomeEvent: Extract boundary model enforcing structural types, exact integer minor units,
   non-negative amounts, and 5-digit zero-padded jurisdiction code formatting.
2. IncomeRollupRecord: Load boundary model enforcing exact rollup totals, rate constraints, and tax years.

API standard: Pure Pydantic v2 (model_validate, field_validator, model_config).
No v1 APIs (parse_obj, @validator, class Config).
"""

from datetime import date, datetime
import re
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class IncomeEvent(BaseModel):
    """
    Extract boundary model for incoming income-event records.
    Tightened against Deliverable 1's profile:
    - Identifiers: Non-empty strings
    - Currency: Exact integer minor units (cents), never floating-point
    - Tax Rates: Float/Decimal in [0.0, 1.0]
    - Jurisdiction: Exactly 5 numeric digits preserving leading zeros (e.g. 01001, 06001)
    - Planning Period: Structured quarterly format (YYYY-Q[1-4])
    """
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    event_id: str = Field(min_length=1, description="Unique event UUID or identifier")
    tenant_id: str = Field(min_length=1, description="Organization tenant UUID")
    cycle_id: str = Field(min_length=1, description="Tax plan cycle UUID")
    client_id: str = Field(min_length=1, description="Client identifier")
    jurisdiction_code: str = Field(description="5-digit zero-padded jurisdiction code (e.g. 01001)")
    planning_period: str = Field(description="Quarterly planning period (e.g. 2026-Q3)")
    income_source: str = Field(min_length=1, description="Income category classification")
    amount_cents: int = Field(description="Integer minor units (cents) — exact amount")
    effective_rate: float = Field(ge=0.0, le=1.0, description="Effective tax rate decimal [0.0, 1.0]")
    event_date: date = Field(description="Date the income event occurred")
    notes: Optional[str] = Field(default=None, description="Optional vendor annotation")
    created_at: Optional[datetime] = Field(default=None, description="Audit timestamp")

    @field_validator("amount_cents")
    @classmethod
    def validate_amount_cents(cls, v: int) -> int:
        if v < 0:
            raise ValueError(f"amount_cents must be non-negative (>= 0), got offending value: {v}")
        return v

    @field_validator("jurisdiction_code")
    @classmethod
    def validate_jurisdiction_code(cls, v: str) -> str:
        # Protect leading zeros against silent numeric inference truncation
        if not re.match(r"^\d{5}$", v):
            raise ValueError(
                f"jurisdiction_code must be exactly 5 numeric digits preserving leading zeros, got offending value: '{v}'"
            )
        return v

    @field_validator("planning_period")
    @classmethod
    def validate_planning_period(cls, v: str) -> str:
        if not re.match(r"^\d{4}-Q[1-4]$", v):
            raise ValueError(
                f"planning_period must match format YYYY-Q[1-4], got offending value: '{v}'"
            )
        return v


class IncomeRollupRecord(BaseModel):
    """
    Load boundary model for aggregated cycle-level analytical rollups
    destined for the analytics.income_rollup PostgreSQL table.
    Enforces exact integer arithmetic on monetary amounts and rates in basis points.
    """
    model_config = ConfigDict(extra="ignore")

    tenant_id: str = Field(min_length=1, description="Organization tenant UUID")
    cycle_id: str = Field(min_length=1, description="Tax plan cycle UUID")
    client_id: str = Field(min_length=1, description="Client identifier")
    planning_period: str = Field(min_length=1, description="Quarterly planning period")
    tax_year: int = Field(ge=2000, le=2100, description="Tax year")
    gross_income_cents: int = Field(ge=0, description="Total gross income in cents")
    total_tax_cents: int = Field(ge=0, description="Weighted total tax liability in cents")
    effective_rate_bps: int = Field(ge=0, le=10_000, description="Effective rate in basis points (1 bps = 0.01%)")
    event_count: int = Field(ge=1, description="Total aggregated event count")
    yoy_income_delta_cents: Optional[int] = Field(default=None, description="Year-over-year income delta in cents")

    @field_validator("gross_income_cents", "total_tax_cents")
    @classmethod
    def validate_monetary_cents(cls, v: int, info) -> int:
        if v < 0:
            raise ValueError(f"{info.field_name} must be >= 0, got offending value: {v}")
        return v


def format_validation_errors(exc: ValidationError) -> list[dict[str, Any]]:
    """
    Formats Pydantic ValidationError errors into actionable, field-level error descriptions
    explicitly preserving the field name, error message, and offending input value.
    """
    formatted: list[dict[str, Any]] = []
    for err in exc.errors():
        field_name = ".".join(str(loc) for loc in err.get("loc", ()))
        formatted.append({
            "field": field_name,
            "message": err.get("msg", ""),
            "type": err.get("type", ""),
            "input": err.get("input", None),
        })
    return formatted


def validate_boundary_rows(rows: list[dict[str, Any]]) -> tuple[list[IncomeEvent], list[dict[str, Any]]]:
    """
    Validates raw dictionary records against the IncomeEvent Pydantic v2 boundary model.
    Returns:
        good: List of typed IncomeEvent instances.
        bad: List of dicts containing the sanitized row and detailed field-level error breakdowns.
    """
    good: list[IncomeEvent] = []
    bad: list[dict[str, Any]] = []

    for row in rows:
        try:
            event = IncomeEvent.model_validate(row)
            good.append(event)
        except ValidationError as exc:
            bad.append({
                "row": row,
                "stage": "validate_pydantic_boundary",
                "errors": format_validation_errors(exc),
                "reason": "pydantic_schema_validation_failed",
            })

    return good, bad
