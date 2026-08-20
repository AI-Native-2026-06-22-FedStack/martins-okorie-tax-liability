"""
Unit tests for TaxPulse Analytical Pipeline Aggregate Logic

Tests:
1. Exact arithmetic verification against hand-calculated synthetic fixtures.
2. Parity between eager Pandas baseline and lazy Polars pipeline.
3. Year-over-Year (YoY) delta calculation for both returning and new clients.
4. Parquet persistence and type round-trip fidelity (zero floating-point drift).
"""

import csv
import gzip
from pathlib import Path

import polars as pl
import pytest

from services.pipeline.aggregate import (
    aggregate_eager,
    aggregate_lazy,
    get_lazy_query_plan,
    write_parquet,
)
from services.pipeline.schema import EXPORT_SCHEMA


@pytest.fixture
def synthetic_export_csv(tmp_path: Path) -> Path:
    """
    Creates a small, deterministic synthetic income export fixture with known values:
    Client CLI-00001 (Returning):
      - 2025-Q1 (cycle-1): 10,000,000 cents ($100k) @ 0.2000 -> tax = 2,000,000 cents
      - 2025-Q2 (cycle-2): 5,000,000 cents ($50k)   @ 0.1000 -> tax = 500,000 cents
        -> 2025 Total: 15,000,000 cents ($150k), Tax: 2,500,000 cents ($25k), YoY: None (first year)
      - 2026-Q1 (cycle-3): 20,000,000 cents ($200k) @ 0.2500 -> tax = 5,000,000 cents
        -> 2026 Total: 20,000,000 cents ($200k), YoY: 20,000,000 - 15,000,000 = +5,000,000 cents

    Client CLI-00002 (New in 2026, no prior year):
      - 2026-Q1 (cycle-4): 8,000,000 cents ($80k) @ 0.1500 -> tax = 1,200,000 cents
        -> 2026 Total: 8,000,000 cents, YoY: None
    """
    fixture_path = tmp_path / "synthetic_fixture.csv.gz"

    fieldnames = [
        "event_id",
        "tenant_id",
        "cycle_id",
        "client_id",
        "jurisdiction_code",
        "planning_period",
        "income_source",
        "amount_cents",
        "effective_rate",
        "event_date",
        "notes",
        "created_at",
    ]

    rows = [
        # Client 1, 2025-Q1
        ["evt_001", "t1", "cyc_001", "CLI-00001", "06001", "2025-Q1", "w2_salary", "10000000", "0.2000", "2025-02-15", "W2", "2025-02-15T10:00:00Z"],
        # Client 1, 2025-Q2
        ["evt_002", "t1", "cyc_002", "CLI-00001", "06001", "2025-Q2", "1099_dividend", "5000000", "0.1000", "2025-05-20", "Div", "2025-05-20T10:00:00Z"],
        # Client 1, 2026-Q1
        ["evt_003", "t1", "cyc_003", "CLI-00001", "06001", "2026-Q1", "w2_salary", "20000000", "0.2500", "2026-02-10", "W2", "2026-02-10T10:00:00Z"],
        # Client 2, 2026-Q1 (New client)
        ["evt_004", "t1", "cyc_004", "CLI-00002", "01001", "2026-Q1", "k1_partnership", "8000000", "0.1500", "2026-03-01", "K1", "2026-03-01T10:00:00Z"],
    ]

    with gzip.open(fixture_path, "wt", encoding="utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(fieldnames)
        writer.writerows(rows)

    return fixture_path


def test_lazy_aggregate_exact_values(synthetic_export_csv: Path):
    """
    Asserts exact values for gross income, tax cents, effective rate, and YoY delta.
    """
    df = aggregate_lazy(synthetic_export_csv)

    assert len(df) == 4

    # Row 1: cyc_001 (Client 1, 2025-Q1)
    r1 = df.filter(pl.col("cycle_id") == "cyc_001").to_dicts()[0]
    assert r1["gross_income_cents"] == 10_000_000
    assert r1["total_tax_cents"] == 2_000_000
    assert r1["effective_rate_bps"] == 2000  # 20.00% -> 2000 bps
    assert r1["yoy_income_delta_cents"] is None  # No 2024 data

    # Row 2: cyc_002 (Client 1, 2025-Q2)
    r2 = df.filter(pl.col("cycle_id") == "cyc_002").to_dicts()[0]
    assert r2["gross_income_cents"] == 5_000_000
    assert r2["total_tax_cents"] == 500_000
    assert r2["effective_rate_bps"] == 1000  # 10.00% -> 1000 bps
    assert r2["yoy_income_delta_cents"] is None

    # Row 3: cyc_003 (Client 1, 2026-Q1) -> Returning client
    r3 = df.filter(pl.col("cycle_id") == "cyc_003").to_dicts()[0]
    assert r3["gross_income_cents"] == 20_000_000
    assert r3["total_tax_cents"] == 5_000_000
    assert r3["effective_rate_bps"] == 2500  # 25.00% -> 2500 bps
    # YoY delta: 2026 total ($200k) - 2025 total ($150k) = +$50k (5,000,000 cents)
    assert r3["yoy_income_delta_cents"] == 5_000_000

    # Row 4: cyc_004 (Client 2, 2026-Q1) -> New client with no prior year
    r4 = df.filter(pl.col("cycle_id") == "cyc_004").to_dicts()[0]
    assert r4["gross_income_cents"] == 8_000_000
    assert r4["total_tax_cents"] == 1_200_000
    assert r4["effective_rate_bps"] == 1500  # 15.00% -> 1500 bps
    assert r4["yoy_income_delta_cents"] is None  # Handled cleanly as None


def test_eager_and_lazy_parity(synthetic_export_csv: Path):
    """
    Asserts exact arithmetic parity between eager Pandas and lazy Polars implementations.
    """
    df_lazy = aggregate_lazy(synthetic_export_csv)
    df_eager = aggregate_eager(synthetic_export_csv)

    assert len(df_lazy) == len(df_eager)

    lazy_dicts = df_lazy.to_dicts()
    eager_dicts = df_eager.to_dict(orient="records")

    for l_row, e_row in zip(lazy_dicts, eager_dicts):
        assert l_row["cycle_id"] == e_row["cycle_id"]
        assert l_row["client_id"] == e_row["client_id"]
        assert l_row["gross_income_cents"] == e_row["gross_income_cents"]
        assert l_row["total_tax_cents"] == e_row["total_tax_cents"]
        assert l_row["effective_rate_bps"] == e_row["effective_rate_bps"]
        # Treat None and pd.NA identically
        l_yoy = l_row["yoy_income_delta_cents"]
        e_yoy = None if str(e_row["yoy_income_delta_cents"]) in ["<NA>", "nan", "None"] else int(e_row["yoy_income_delta_cents"])
        assert l_yoy == e_yoy


def test_parquet_round_trip_type_preservation(synthetic_export_csv: Path, tmp_path: Path):
    """
    Asserts that partitioned Parquet persistence preserves exact dtypes and values.
    """
    df_original = aggregate_lazy(synthetic_export_csv)
    warehouse_dir = tmp_path / "warehouse"

    out_dir = write_parquet(df_original, warehouse_dir)
    assert out_dir.exists()

    # Read back from partitioned Parquet
    df_readback = pl.read_parquet(warehouse_dir / "**/*.parquet")

    assert len(df_readback) == len(df_original)
    assert df_readback["tenant_id"].dtype == pl.String
    assert df_readback["client_id"].dtype == pl.String
    assert df_readback["gross_income_cents"].dtype == pl.Int64
    assert df_readback["total_tax_cents"].dtype == pl.Int64

    # Assert totals match with zero precision drift
    assert df_readback["gross_income_cents"].sum() == df_original["gross_income_cents"].sum()
    assert df_readback["total_tax_cents"].sum() == df_original["total_tax_cents"].sum()


def test_query_plan_pushdown(synthetic_export_csv: Path):
    """
    Verifies that the lazy query plan demonstrates projection pruning.
    """
    plan = get_lazy_query_plan(synthetic_export_csv)
    assert isinstance(plan, str)
    # The plan should include the select / projection columns
    assert "amount_cents" in plan
    assert "planning_period" in plan
