import pytest
from app.calc import compute_scenario_comparison, compute_tax_liability
from app.contracts import CalculationRequest, ScenarioItem
from app.db import get_db_connection, init_db, seed_brackets


@pytest.fixture
def db_conn():
    conn = get_db_connection(":memory:")
    init_db(conn)
    seed_brackets(conn)
    yield conn
    conn.close()


def test_compute_tax_liability_deterministic(db_conn):
    res1 = compute_tax_liability(
        conn=db_conn,
        filing_status="single",
        income=120000.0,
        deductions=14600.0,
        state="CA",
    )
    res2 = compute_tax_liability(
        conn=db_conn,
        filing_status="single",
        income=120000.0,
        deductions=14600.0,
        state="CA",
    )
    assert res1 == res2
    assert res1.federal_liability > 0.0
    assert res1.state_liability > 0.0
    assert res1.effective_rate > 0.0
    assert res1.marginal_rate > 0.0
    assert res1.quarterly_estimate == round(
        (res1.federal_liability + res1.state_liability) / 4.0, 2
    )


def test_compute_tax_liability_zero_income(db_conn):
    res = compute_tax_liability(
        conn=db_conn,
        filing_status="single",
        income=0.0,
        deductions=14600.0,
        state="CA",
    )
    assert res.federal_liability == 0.0
    assert res.state_liability == 0.0
    assert res.effective_rate == 0.0
    assert res.quarterly_estimate == 0.0


def test_compute_tax_liability_deductions_exceed_income(db_conn):
    res = compute_tax_liability(
        conn=db_conn,
        filing_status="single",
        income=10000.0,
        deductions=20000.0,
        state="CA",
    )
    assert res.federal_liability == 0.0
    assert res.state_liability == 0.0
    assert res.effective_rate == 0.0
    assert res.quarterly_estimate == 0.0


def test_compute_tax_liability_bracket_boundary(db_conn):
    # Taxable income = 11600.0 (top of 10% bracket for single)
    res = compute_tax_liability(
        conn=db_conn,
        filing_status="single",
        income=11600.0,
        deductions=0.0,
        state="CA",
    )
    assert res.federal_liability == round(11600.0 * 0.10, 2)
    assert res.marginal_rate == 0.10


def test_compute_scenario_comparison_deltas(db_conn):
    baseline = CalculationRequest(
        filing_status="single",
        income=100000.0,
        deductions=14600.0,
        state="CA",
    )
    scenarios = [
        ScenarioItem(
            name="Bonus $20k",
            filing_status="single",
            income=120000.0,
            deductions=14600.0,
            state="CA",
        ),
        ScenarioItem(
            name="Max 401k $23k",
            filing_status="single",
            income=100000.0,
            deductions=37600.0,
            state="CA",
        ),
    ]

    res = compute_scenario_comparison(db_conn, baseline, scenarios)
    assert res.baseline_total_tax > 0.0
    assert len(res.scenarios) == 2

    # Higher income -> positive tax delta
    assert res.scenarios[0].name == "Bonus $20k"
    assert res.scenarios[0].delta_vs_baseline > 0.0

    # Higher deductions -> negative tax delta
    assert res.scenarios[1].name == "Max 401k $23k"
    assert res.scenarios[1].delta_vs_baseline < 0.0
