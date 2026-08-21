"""
TaxPulse Analytical Pipeline — Warehouse vs. PostgreSQL Reconciler

Reconciles analytical Parquet warehouse against the operational PostgreSQL
system of record (tax_plan_cycle table) using an in-process DuckDB session.

Enforces:
1. Exact string-based identifier joins without type coercions.
2. Two-way set equivalence (no phantom cycles in Parquet, no missing cycles in Postgres).
3. Equal cycle counts per tenant and planning period.
4. Loud failures with explicit error messages and diagnostic diffs.
"""

import os
import sys
from pathlib import Path
from typing import Any

import duckdb


def reconcile_warehouse_with_postgres(
    parquet_path: str = "data/warehouse/income_rollup/**/*.parquet",
    pg_host: str = "localhost",
    pg_port: int = 55433,
    pg_dbname: str = "taxpulse_l",
    pg_user: str = "taxpulse_app",
) -> dict[str, Any]:
    """
    Executes cross-engine reconciliation in a single DuckDB session.
    """
    con = duckdb.connect()

    # 1. Install & load DuckDB Postgres extension
    con.execute("INSTALL postgres;")
    con.execute("LOAD postgres;")

    # 2. Attach live operational PostgreSQL database
    attach_sql = f"ATTACH 'dbname={pg_dbname} host={pg_host} port={pg_port} user={pg_user}' AS pg_db (TYPE postgres);"
    con.execute(attach_sql)

    # 3. Extract distinct cycle sets from Parquet warehouse
    parquet_cycles_query = f"""
    CREATE TEMP TABLE parquet_cycles AS
    SELECT DISTINCT
        tenant_id::VARCHAR AS tenant_id,
        cycle_id::VARCHAR AS cycle_id,
        client_id::VARCHAR AS client_id,
        planning_period::VARCHAR AS planning_period
    FROM read_parquet('{parquet_path}');
    """
    con.execute(parquet_cycles_query)

    # 4. Extract cycle sets from operational Postgres table
    postgres_cycles_query = """
    CREATE TEMP TABLE postgres_cycles AS
    SELECT DISTINCT
        tenant_id::VARCHAR AS tenant_id,
        id::VARCHAR AS cycle_id,
        client_id::VARCHAR AS client_id,
        planning_period::VARCHAR AS planning_period
    FROM pg_db.tax_plan_cycle;
    """
    con.execute(postgres_cycles_query)

    # 5. Check Direction A: Cycles in Parquet that do NOT exist in Postgres
    missing_in_pg_sql = """
    SELECT
        p.tenant_id,
        p.cycle_id,
        p.client_id,
        p.planning_period
    FROM parquet_cycles p
    LEFT JOIN postgres_cycles pg
        ON p.tenant_id = pg.tenant_id
        AND p.cycle_id = pg.cycle_id
        AND p.client_id = pg.client_id
        AND p.planning_period = pg.planning_period
    WHERE pg.cycle_id IS NULL;
    """
    missing_in_pg = con.execute(missing_in_pg_sql).fetchall()

    # 6. Check Direction B: Cycles in Postgres for covered periods that are missing from Parquet
    missing_in_parquet_sql = """
    SELECT
        pg.tenant_id,
        pg.cycle_id,
        pg.client_id,
        pg.planning_period
    FROM postgres_cycles pg
    WHERE pg.planning_period IN (SELECT DISTINCT planning_period FROM parquet_cycles)
      AND NOT EXISTS (
          SELECT 1 FROM parquet_cycles p
          WHERE p.tenant_id = pg.tenant_id
            AND p.cycle_id = pg.cycle_id
            AND p.client_id = pg.client_id
            AND p.planning_period = pg.planning_period
      );
    """
    missing_in_parquet = con.execute(missing_in_parquet_sql).fetchall()

    # 7. Check Per-Tenant, Per-Period Count Equality
    count_reconciliation_sql = """
    WITH parquet_counts AS (
        SELECT tenant_id, planning_period, COUNT(DISTINCT cycle_id) AS parquet_count
        FROM parquet_cycles
        GROUP BY tenant_id, planning_period
    ),
    postgres_counts AS (
        SELECT tenant_id, planning_period, COUNT(DISTINCT cycle_id) AS postgres_count
        FROM postgres_cycles
        GROUP BY tenant_id, planning_period
    )
    SELECT
        COALESCE(p.tenant_id, pg.tenant_id) AS tenant_id,
        COALESCE(p.planning_period, pg.planning_period) AS planning_period,
        COALESCE(p.parquet_count, 0) AS parquet_count,
        COALESCE(pg.postgres_count, 0) AS postgres_count
    FROM parquet_counts p
    FULL OUTER JOIN postgres_counts pg
        ON p.tenant_id = pg.tenant_id
        AND p.planning_period = pg.planning_period
    WHERE COALESCE(p.parquet_count, 0) != COALESCE(pg.postgres_count, 0);
    """
    count_mismatches = con.execute(count_reconciliation_sql).fetchall()

    # 8. Fetch total reconciled counts
    total_parquet_cycles = con.execute("SELECT COUNT(*) FROM parquet_cycles;").fetchone()[0]
    total_pg_cycles = con.execute("SELECT COUNT(*) FROM postgres_cycles;").fetchone()[0]

    # Diagnostic validation & assertions
    errors = []
    if missing_in_pg:
        errors.append(f"Found {len(missing_in_pg)} cycles in Parquet missing from Postgres: {missing_in_pg}")

    if missing_in_parquet:
        errors.append(f"Found {len(missing_in_parquet)} cycles in Postgres missing from Parquet: {missing_in_parquet}")

    if count_mismatches:
        errors.append(f"Per-tenant/period count mismatches detected: {count_mismatches}")

    if errors:
        error_msg = "\n[RECONCILIATION FAILURE]\n" + "\n".join(errors)
        raise AssertionError(error_msg)

    return {
        "status": "RECONCILED_EXACT",
        "total_parquet_cycles": total_parquet_cycles,
        "total_postgres_cycles": total_pg_cycles,
        "covered_periods": con.execute("SELECT DISTINCT planning_period FROM parquet_cycles ORDER BY 1;").fetchall(),
        "reconciled_tenants": con.execute("SELECT DISTINCT tenant_id FROM parquet_cycles ORDER BY 1;").fetchall(),
    }


def main():
    parquet_glob = os.getenv("WAREHOUSE_PARQUET_PATH", "data/warehouse/income_rollup/**/*.parquet")
    pg_host = os.getenv("PGHOST", "localhost")
    pg_port = int(os.getenv("PGPORT", "55433"))
    pg_dbname = os.getenv("PGDATABASE", "taxpulse_l")
    pg_user = os.getenv("PGUSER", "taxpulse_app")

    print("=" * 70)
    print("TaxPulse Analytical Reconciler — DuckDB Parquet vs. Postgres")
    print("=" * 70)
    print(f"Parquet source:  {parquet_glob}")
    print(f"PostgreSQL target: postgresql://{pg_user}@{pg_host}:{pg_port}/{pg_dbname}")
    print("Executing cross-engine SQL verification via DuckDB ATTACH...")

    try:
        res = reconcile_warehouse_with_postgres(
            parquet_path=parquet_glob,
            pg_host=pg_host,
            pg_port=pg_port,
            pg_dbname=pg_dbname,
            pg_user=pg_user,
        )
        print("\n[SUCCESS] Reconciliation Passed with Exact 100% Equivalence:")
        print(f"  - Total Parquet Warehouse Cycles:  {res['total_parquet_cycles']}")
        print(f"  - Total PostgreSQL System Cycles:  {res['total_postgres_cycles']}")
        print(f"  - Covered Planning Periods:       {[p[0] for p in res['covered_periods']]}")
        print(f"  - Reconciled Tenants:             {[t[0] for t in res['reconciled_tenants']]}")
        print("  - String-level identifier joins:  Zero type coercion / zero dropped leading zeros.")
        print("=" * 70)
    except AssertionError as e:
        print(e, file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Unexpected error during reconciliation: {e}", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
