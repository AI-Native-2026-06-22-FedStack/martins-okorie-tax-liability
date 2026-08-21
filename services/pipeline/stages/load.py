"""
TaxPulse Analytical Pipeline — Stage 4: Load to Analytics Schema

Writes aggregated income rollup records to the isolated 'analytics.income_rollup' PostgreSQL table.
Strictly isolated from operational 'public' domain tables.
"""

import logging
import os
from typing import Optional

import psycopg

from services.pipeline.metrics import StageMetrics
from services.pipeline.models import IncomeRollupRecord

logger = logging.getLogger("taxpulse.pipeline")


def load(
    records: list[IncomeRollupRecord],
    schema_name: str = "analytics",
    database_url: Optional[str] = None,
) -> tuple[int, StageMetrics]:
    """
    Loads transformed rollup records into the specified analytics schema.
    """
    count_in = len(records)
    if count_in == 0:
        metrics = StageMetrics(stage_name="load", count_in=0, count_out=0, count_bad=0)
        return 0, metrics

    db_url = database_url or os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/taxpulse")

    inserted_count = 0
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            # Ensure analytics schema exists
            cur.execute(f"CREATE SCHEMA IF NOT EXISTS {schema_name};")

            insert_query = f"""
                INSERT INTO {schema_name}.income_rollup (
                    tenant_id,
                    cycle_id,
                    client_id,
                    planning_period,
                    tax_year,
                    gross_income_cents,
                    total_tax_cents,
                    effective_rate_bps,
                    event_count,
                    yoy_income_delta_cents
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (tenant_id, cycle_id, planning_period) DO UPDATE SET
                    client_id = EXCLUDED.client_id,
                    tax_year = EXCLUDED.tax_year,
                    gross_income_cents = EXCLUDED.gross_income_cents,
                    total_tax_cents = EXCLUDED.total_tax_cents,
                    effective_rate_bps = EXCLUDED.effective_rate_bps,
                    event_count = EXCLUDED.event_count,
                    yoy_income_delta_cents = EXCLUDED.yoy_income_delta_cents,
                    loaded_at = now();
            """

            for rec in records:
                cur.execute(
                    insert_query,
                    (
                        rec.tenant_id,
                        rec.cycle_id,
                        rec.client_id,
                        rec.planning_period,
                        rec.tax_year,
                        rec.gross_income_cents,
                        rec.total_tax_cents,
                        rec.effective_rate_bps,
                        rec.event_count,
                        rec.yoy_income_delta_cents,
                    ),
                )
                inserted_count += 1

        conn.commit()

    metrics = StageMetrics(
        stage_name="load",
        count_in=count_in,
        count_out=inserted_count,
        count_bad=0,
    )
    metrics.log()

    return inserted_count, metrics
