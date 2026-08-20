"""
Integration test for DuckDB Parquet Warehouse vs. PostgreSQL Reconciliation
"""

import pytest

from services.pipeline.tools.reconcile import reconcile_warehouse_with_postgres


def test_reconcile_warehouse_with_postgres_live():
    """
    Executes live DuckDB cross-engine reconciliation against local Postgres.
    """
    res = reconcile_warehouse_with_postgres(
        parquet_path="data/warehouse/income_rollup/**/*.parquet",
        pg_host="localhost",
        pg_port=55433,
        pg_dbname="taxpulse_l",
        pg_user="taxpulse_app",
    )

    assert res["status"] == "RECONCILED_EXACT"
    assert res["total_parquet_cycles"] == 8
    assert res["total_postgres_cycles"] == 8
    assert len(res["covered_periods"]) == 7
    assert len(res["reconciled_tenants"]) == 4
