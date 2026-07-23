import os
import sqlite3
from typing import Any


def get_db_connection(db_path: str | None = None) -> sqlite3.Connection:
    path = db_path or os.getenv("COMPUTE_DB_PATH", ":memory:")
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS federal_brackets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filing_status TEXT NOT NULL,
            rate REAL NOT NULL,
            lower_bound REAL NOT NULL,
            upper_bound REAL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS state_brackets (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            state_code TEXT NOT NULL,
            filing_status TEXT NOT NULL,
            rate REAL NOT NULL,
            lower_bound REAL NOT NULL,
            upper_bound REAL
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS scenarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            case_id TEXT NOT NULL,
            name TEXT NOT NULL,
            filing_status TEXT NOT NULL,
            income REAL NOT NULL,
            deductions REAL NOT NULL,
            state TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()


def seed_brackets(conn: sqlite3.Connection) -> None:
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM federal_brackets")
    if cursor.fetchone()[0] > 0:
        return

    # Federal brackets (2026 tax year sample)
    federal_data = [
        # Single
        ("single", 0.10, 0.0, 11600.0),
        ("single", 0.12, 11600.0, 47150.0),
        ("single", 0.22, 47150.0, 100525.0),
        ("single", 0.24, 100525.0, 191950.0),
        ("single", 0.32, 191950.0, 243725.0),
        ("single", 0.35, 243725.0, 609350.0),
        ("single", 0.37, 609350.0, None),
        # Married Filing Jointly
        ("married_filing_jointly", 0.10, 0.0, 23200.0),
        ("married_filing_jointly", 0.12, 23200.0, 94300.0),
        ("married_filing_jointly", 0.22, 94300.0, 201050.0),
        ("married_filing_jointly", 0.24, 201050.0, 383900.0),
        ("married_filing_jointly", 0.32, 383900.0, 487450.0),
        ("married_filing_jointly", 0.35, 487450.0, 731200.0),
        ("married_filing_jointly", 0.37, 731200.0, None),
    ]

    cursor.executemany(
        """INSERT INTO federal_brackets
           (filing_status, rate, lower_bound, upper_bound)
           VALUES (?, ?, ?, ?)""",
        federal_data,
    )

    # State brackets (sample for CA and NY)
    state_data = [
        # CA Single
        ("CA", "single", 0.01, 0.0, 10099.0),
        ("CA", "single", 0.02, 10099.0, 23942.0),
        ("CA", "single", 0.04, 23942.0, 37788.0),
        ("CA", "single", 0.06, 37788.0, 52444.0),
        ("CA", "single", 0.08, 52444.0, 66295.0),
        ("CA", "single", 0.093, 66295.0, None),
        # NY Single
        ("NY", "single", 0.04, 0.0, 8500.0),
        ("NY", "single", 0.045, 8500.0, 11700.0),
        ("NY", "single", 0.0525, 11700.0, 13900.0),
        ("NY", "single", 0.0585, 13900.0, 80650.0),
        ("NY", "single", 0.0625, 80650.0, None),
    ]

    cursor.executemany(
        """INSERT INTO state_brackets
           (state_code, filing_status, rate, lower_bound, upper_bound)
           VALUES (?, ?, ?, ?, ?)""",
        state_data,
    )
    conn.commit()


def get_federal_brackets(conn: sqlite3.Connection, filing_status: str) -> list[dict[str, Any]]:
    cursor = conn.cursor()
    query = """
        SELECT filing_status, rate, lower_bound, upper_bound
        FROM federal_brackets
        WHERE filing_status = ?
        ORDER BY lower_bound ASC
    """
    cursor.execute(query, (filing_status,))
    return [dict(row) for row in cursor.fetchall()]


def get_state_brackets(
    conn: sqlite3.Connection, state_code: str, filing_status: str
) -> list[dict[str, Any]]:
    cursor = conn.cursor()
    query = """
        SELECT state_code, filing_status, rate, lower_bound, upper_bound
        FROM state_brackets
        WHERE state_code = ? AND filing_status = ?
        ORDER BY lower_bound ASC
    """
    cursor.execute(query, (state_code, filing_status))
    return [dict(row) for row in cursor.fetchall()]


def add_scenario_for_case(
    conn: sqlite3.Connection,
    case_id: str,
    name: str,
    filing_status: str,
    income: float,
    deductions: float,
    state: str,
) -> int:
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM scenarios WHERE case_id = ?", (case_id,))
    count = cursor.fetchone()[0]

    if count >= 5:
        raise ValueError(
            f"Scenario limit exceeded for case '{case_id}': "
            f"maximum 5 scenarios allowed (currently {count})."
        )

    query = """
        INSERT INTO scenarios
        (case_id, name, filing_status, income, deductions, state)
        VALUES (?, ?, ?, ?, ?, ?)
    """
    cursor.execute(query, (case_id, name, filing_status, income, deductions, state))
    conn.commit()
    return cursor.lastrowid
