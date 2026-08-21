"""
TaxPulse Analytical Pipeline — Boundary Models (Pydantic v2)

Defines strict typed contracts at the extract and load boundaries:
1. IncomeEvent: Extract boundary model enforcing structural types, non-negative amounts,
   and valid jurisdiction code formatting.
2. IncomeRollupRecord: Load boundary model enforcing non-negative rollups and rate boundaries.
"""

from datetime import date, datetime
import re
from typing import Any, Optional

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator


class IncomeEvent(BaseModel):
    """
    Extract boundary model for individual vendor income-event records.
    Enforces types, non-empty identifiers, non-negative amounts, and 5-digit FIPS codes.
    """
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)

    event_id: str = Field(min_length=1, description="Unique event UUID or identifier")
    tenant_id: str = Field(min_length=1, description="Organization tenant UUID")
    cycle_id: str = Field(min_length=1, description="Tax plan cycle UUID")
    client_id: str = Field(min_length=1, description="Client identifier")
    jurisdiction_code: str = Field(description="5-digit zero-padded jurisdiction code (e.g. 01001)")
    planning_period: str = Field(description="Quarterly planning period (e.g. 2026-Q3)")
    income_source: str = Field(min_length=1, description="Income category classification")
    amount_cents: int = Field(description="Integer minor units (cents)")
    effective_rate: float = Field(ge=0.0, le=1.0, description="Effective tax rate decimal [0.0, 1.0]")
    event_date: date = Field(description="Date the income event occurred")
    notes: Optional[str] = Field(default=None, description="Optional vendor annotation")
    created_at: Optional[datetime] = Field(default=None, description="Audit timestamp")

    @field_validator("amount_cents")
    @classmethod
    def validate_amount_cents(cls, v: int) -> int:
        if v < 0:
            raise ValueError(f"amount_cents must be >= 0, got {v}")
        return v

    @field_validator("jurisdiction_code")
    @classmethod
    def validate_jurisdiction_code(cls, v: str) -> str:
        # Protect leading zeros: must be exactly 5 numeric digits
        if not re.match(r"^\d{5}$", v):
            raise ValueError(f"jurisdiction_code must be exactly 5 digits preserving leading zeros, got '{v}'")
        return v

    @field_validator("planning_period")
    @classmethod
    def validate_planning_period(cls, v: str) -> str:
        if not re.match(r"^\d{4}-Q[1-4]$", v):
            raise ValueError(f"planning_period must match format YYYY-Q[1-4], got '{v}'")
        return v


class IncomeRollupRecord(BaseModel):
    """
    Load boundary model for aggregated cycle-level analytical rollups.
    """
    model_config = ConfigDict(extra="ignore")

    tenant_id: str = Field(min_length=1)
    cycle_id: str = Field(min_length=1)
    client_id: str = Field(min_length=1)
    planning_period: str = Field(min_length=1)
    tax_year: int = Field(ge=2000, le=2100)
    gross_income_cents: int = Field(ge=0)
    total_tax_cents: int = Field(ge=0)
    effective_rate_bps: int = Field(ge=0, le=10_000)
    event_count: int = Field(ge=1)
    yoy_income_delta_cents: Optional[int] = None


def validate_boundary_rows(rows: list[dict[str, Any]]) -> tuple[list[IncomeEvent], list[dict[str, Any]]]:
    """
    Validates raw dictionary records against the IncomeEvent Pydantic v2 boundary model.
    Returns:
        good: List of typed IncomeEvent instances.
        bad: List of dicts containing the original row and field-level ValidationError details.
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
                "errors": exc.errors(),
                "reason": "pydantic_schema_validation_failed",
            })

    return good, bad
