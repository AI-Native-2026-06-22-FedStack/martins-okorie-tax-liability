import sqlite3

from app.contracts import (
    CalculationRequest,
    CalculationResponse,
    ScenarioComparisonResponse,
    ScenarioItem,
    ScenarioResult,
)
from app.db import get_federal_brackets, get_state_brackets


def _calculate_bracket_tax(
    brackets: list[dict], taxable_income: float
) -> tuple[float, float]:
    """
    Computes progressive tax liability and marginal rate across tax brackets.
    Returns (total_tax_liability, marginal_rate).
    """
    if taxable_income <= 0.0 or not brackets:
        lowest_rate = brackets[0]["rate"] if brackets else 0.0
        return 0.0, lowest_rate

    tax = 0.0
    marginal_rate = brackets[0]["rate"]

    for b in brackets:
        lower = b["lower_bound"]
        upper = b["upper_bound"]
        rate = b["rate"]

        if taxable_income <= lower:
            break

        marginal_rate = rate
        top = upper if upper is not None else taxable_income
        chunk = min(taxable_income, top) - lower
        tax += chunk * rate

        if upper is not None and taxable_income <= upper:
            break

    return tax, marginal_rate


def compute_tax_liability(
    conn: sqlite3.Connection,
    filing_status: str,
    income: float,
    deductions: float,
    state: str,
) -> CalculationResponse:
    """
    Computes deterministic federal and state progressive tax liability,
    effective and marginal rates, and four equal quarterly estimates.
    """
    taxable_income = max(0.0, income - deductions)

    fed_brackets = get_federal_brackets(conn, filing_status)
    fed_tax, fed_marginal = _calculate_bracket_tax(fed_brackets, taxable_income)

    state_brackets = get_state_brackets(conn, state, filing_status)
    state_tax, _ = _calculate_bracket_tax(state_brackets, taxable_income)

    total_net = fed_tax + state_tax
    effective_rate = round(total_net / income, 4) if income > 0 else 0.0
    quarterly = round(total_net / 4.0, 2)

    return CalculationResponse(
        federal_liability=round(fed_tax, 2),
        state_liability=round(state_tax, 2),
        effective_rate=effective_rate,
        marginal_rate=round(fed_marginal, 4),
        quarterly_estimate=quarterly,
    )


def compute_scenario_comparison(
    conn: sqlite3.Connection,
    baseline: CalculationRequest,
    scenarios: list[ScenarioItem],
) -> ScenarioComparisonResponse:
    """
    Computes baseline tax calculation and compares 2 to 5 scenarios against it.
    Reuses the exact same progressive bracket calculation.
    """
    base_calc = compute_tax_liability(
        conn,
        filing_status=baseline.filing_status,
        income=baseline.income,
        deductions=baseline.deductions,
        state=baseline.state,
    )
    baseline_total_tax = round(
        base_calc.federal_liability + base_calc.state_liability, 2
    )

    results: list[ScenarioResult] = []
    for s in scenarios:
        s_calc = compute_tax_liability(
            conn,
            filing_status=s.filing_status,
            income=s.income,
            deductions=s.deductions,
            state=s.state,
        )
        s_total = round(s_calc.federal_liability + s_calc.state_liability, 2)
        delta = round(s_total - baseline_total_tax, 2)

        results.append(
            ScenarioResult(
                name=s.name,
                total_tax=s_total,
                delta_vs_baseline=delta,
                calculation=s_calc,
            )
        )

    return ScenarioComparisonResponse(
        baseline_total_tax=baseline_total_tax,
        scenarios=results,
    )
