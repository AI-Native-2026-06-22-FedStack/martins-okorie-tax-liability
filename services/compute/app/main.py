import sqlite3

import structlog
from app.auth import UserIdentity, get_current_user
from app.calc import compute_scenario_comparison, compute_tax_liability
from app.contracts import (
    CalculationRequest,
    CalculationResponse,
    ScenarioComparisonRequest,
    ScenarioComparisonResponse,
)
from app.correlation import CorrelationIdMiddleware
from app.db import get_db
from app.logging_config import configure_logging
from fastapi import Depends, FastAPI, status
from pydantic import BaseModel

# Configure structured JSON logging
configure_logging()
logger = structlog.get_logger()

app = FastAPI(
    title="TaxPulse Compute Service",
    description="Microservice for complex tax liability modeling scenarios and computations.",
    version="1.0.0",
)

# Register correlation middleware
app.add_middleware(CorrelationIdMiddleware)


class LegacyTaxCalculationRequest(BaseModel):
    income: float
    deductions: float


class LegacyTaxCalculationResponse(BaseModel):
    status: str
    tenant_id: str
    role: str
    tax_liability: float


@app.post(
    "/compute/tax-liability",
    response_model=LegacyTaxCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate real-time tax liability (legacy route)",
)
async def calculate_tax_liability_legacy(
    request: LegacyTaxCalculationRequest,
    user: UserIdentity = Depends(get_current_user),
) -> LegacyTaxCalculationResponse:
    """
    Legacy calculation route for Module 3 compatibility.
    Reads tenant_id and role strictly from the verified token context.
    """
    logger.info(
        "Calculating tax liability in compute service (legacy)",
        income=request.income,
        deductions=request.deductions,
        tenant_id=user.tenant_id,
        role=user.role,
    )
    taxable_income = max(0.0, request.income - request.deductions)
    tax_liability = taxable_income * 0.15

    return LegacyTaxCalculationResponse(
        status="success",
        tenant_id=user.tenant_id,
        role=user.role,
        tax_liability=tax_liability,
    )


@app.post(
    "/v1/calculate",
    response_model=CalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate deterministic real-time tax liability",
)
async def calculate_tax(
    request: CalculationRequest,
    user: UserIdentity = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> CalculationResponse:
    """
    Computes deterministic federal/state progressive tax liability.
    Protected by shared RS256 JWT auth context.
    """
    logger.info(
        "Calculating tax liability in compute service",
        income=request.income,
        deductions=request.deductions,
        state=request.state,
        filing_status=request.filing_status,
        tenant_id=user.tenant_id,
        user_id=user.id,
    )
    return compute_tax_liability(
        conn=conn,
        filing_status=request.filing_status,
        income=request.income,
        deductions=request.deductions,
        state=request.state,
    )


@app.post(
    "/v1/scenario",
    response_model=ScenarioComparisonResponse,
    status_code=status.HTTP_200_OK,
    summary="Compare tax modeling scenarios against baseline",
)
async def compare_scenarios(
    request: ScenarioComparisonRequest,
    user: UserIdentity = Depends(get_current_user),
    conn: sqlite3.Connection = Depends(get_db),
) -> ScenarioComparisonResponse:
    """
    Computes baseline calculation and 2-5 modeled scenarios with deltas.
    Protected by shared RS256 JWT auth context.
    """
    logger.info(
        "Comparing tax scenarios in compute service",
        scenario_count=len(request.scenarios),
        tenant_id=user.tenant_id,
        user_id=user.id,
    )
    return compute_scenario_comparison(
        conn=conn,
        baseline=request.baseline,
        scenarios=request.scenarios,
    )
