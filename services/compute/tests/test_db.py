import pytest
from app.db import (
    add_scenario_for_case,
    get_db_connection,
    get_federal_brackets,
    get_state_brackets,
    init_db,
    seed_brackets,
)


@pytest.fixture
def db_conn():
    conn = get_db_connection(":memory:")
    init_db(conn)
    seed_brackets(conn)
    yield conn
    conn.close()


def test_federal_brackets_query(db_conn):
    single_brackets = get_federal_brackets(db_conn, "single")
    assert len(single_brackets) > 0
    assert single_brackets[0]["rate"] == 0.10
    assert single_brackets[0]["lower_bound"] == 0.0

    joint_brackets = get_federal_brackets(db_conn, "married_filing_jointly")
    assert len(joint_brackets) > 0
    assert joint_brackets[0]["upper_bound"] == 23200.0


def test_state_brackets_query(db_conn):
    ca_brackets = get_state_brackets(db_conn, "CA", "single")
    assert len(ca_brackets) > 0
    assert ca_brackets[0]["state_code"] == "CA"

    ny_brackets = get_state_brackets(db_conn, "NY", "single")
    assert len(ny_brackets) > 0
    assert ny_brackets[0]["state_code"] == "NY"


def test_scenario_insert_limit(db_conn):
    case_id = "case-12345"

    # Insert 5 valid scenarios
    for i in range(1, 6):
        scenario_id = add_scenario_for_case(
            db_conn,
            case_id=case_id,
            name=f"Scenario {i}",
            filing_status="single",
            income=100000.0 + i * 5000,
            deductions=14600.0,
            state="CA"
        )
        assert scenario_id > 0

    # Attempting to insert a 6th scenario must be rejected
    with pytest.raises(ValueError) as exc_info:
        add_scenario_for_case(
            db_conn,
            case_id=case_id,
            name="Scenario 6 (Over Limit)",
            filing_status="single",
            income=130000.0,
            deductions=14600.0,
            state="CA"
        )
    assert "Scenario limit exceeded" in str(exc_info.value)
