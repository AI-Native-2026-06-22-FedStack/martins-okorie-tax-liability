from fastapi import Depends, FastAPI, status
from pydantic import BaseModel

from app.auth import UserIdentity, get_current_user

app = FastAPI(
    title="TaxPulse Compute Service",
    description="Microservice for complex tax liability modeling scenarios and computations.",
    version="1.0.0"
)

class TaxCalculationRequest(BaseModel):
    income: float
    deductions: float

class TaxCalculationResponse(BaseModel):
    status: str
    tenant_id: str
    role: str
    tax_liability: float

@app.post(
    "/compute/tax-liability",
    response_model=TaxCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate real-time tax liability"
)
async def calculate_tax_liability(
    request: TaxCalculationRequest,
    user: UserIdentity = Depends(get_current_user)
) -> TaxCalculationResponse:
    """
    Computes tax liability for modeled scenario.
    Reads tenant_id and role strictly from the verified token context, never from the request body.
    """
    # Simple real-time tax calculation algorithm (15% flat rate for demonstration)
    taxable_income = max(0.0, request.income - request.deductions)
    tax_liability = taxable_income * 0.15

    return TaxCalculationResponse(
        status="success",
        tenant_id=user.tenant_id,
        role=user.role,
        tax_liability=tax_liability
    )
