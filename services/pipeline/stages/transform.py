"""
TaxPulse Analytical Pipeline — Stage 3: Transform & Rollup

Transforms validated IncomeEvent records into cycle-level analytical rollups:
- YTD Gross Income & Tax Liability calculation
- YoY annual income delta calculation per client
- Validates transformed records against the IncomeRollupRecord load boundary model
"""

from typing import Any, Optional
import polars as pl

from services.pipeline.metrics import StageMetrics
from services.pipeline.models import IncomeEvent, IncomeRollupRecord


def transform(
    events: list[IncomeEvent],
    run_id: Optional[str] = None,
) -> tuple[list[IncomeRollupRecord], StageMetrics]:
    """
    Transforms validated income events into analytical rollups using Polars engine.
    """
    count_in = len(events)
    if count_in == 0:
        metrics = StageMetrics(stage_name="transform", count_in=0, count_out=0, count_bad=0, run_id=run_id)
        return [], metrics

    # Build Polars DataFrame from typed events
    raw_dicts = [e.model_dump() for e in events]
    df = pl.DataFrame(raw_dicts)

    # Prepare fields and extract tax_year
    prepared = df.select([
        pl.col("tenant_id"),
        pl.col("cycle_id"),
        pl.col("client_id"),
        pl.col("planning_period"),
        pl.col("planning_period").str.slice(0, 4).cast(pl.Int32).alias("tax_year"),
        pl.col("amount_cents").cast(pl.Int64),
        pl.col("effective_rate").cast(pl.Float64),
    ])

    # 1. Cycle rollup
    cycle_rollup = prepared.group_by([
        "tenant_id",
        "cycle_id",
        "client_id",
        "planning_period",
        "tax_year",
    ]).agg([
        pl.col("amount_cents").sum().alias("gross_income_cents"),
        (pl.col("amount_cents").cast(pl.Float64) * pl.col("effective_rate"))
        .round(0)
        .cast(pl.Int64)
        .sum()
        .alias("total_tax_cents"),
        pl.len().alias("event_count"),
    ])

    # 2. Client annual total for YoY calculation
    client_annual = prepared.group_by(["client_id", "tax_year"]).agg([
        pl.col("amount_cents").sum().alias("annual_client_income_cents")
    ])

    prior_year = client_annual.select([
        pl.col("client_id"),
        (pl.col("tax_year") + 1).alias("tax_year"),
        pl.col("annual_client_income_cents").alias("prior_year_income_cents"),
    ])

    # 3. Join
    joined = (
        cycle_rollup
        .join(client_annual, on=["client_id", "tax_year"], how="left")
        .join(prior_year, on=["client_id", "tax_year"], how="left")
        .with_columns([
            pl.when(pl.col("gross_income_cents") > 0)
            .then((pl.col("total_tax_cents") * 10_000 // pl.col("gross_income_cents")).cast(pl.Int64))
            .otherwise(0)
            .alias("effective_rate_bps"),
            pl.when(pl.col("prior_year_income_cents").is_not_null())
            .then(pl.col("annual_client_income_cents") - pl.col("prior_year_income_cents"))
            .otherwise(None)
            .alias("yoy_income_delta_cents"),
        ])
        .select([
            "tenant_id",
            "cycle_id",
            "client_id",
            "planning_period",
            "tax_year",
            "gross_income_cents",
            "total_tax_cents",
            "effective_rate_bps",
            "event_count",
            "yoy_income_delta_cents",
        ])
        .sort(["tenant_id", "client_id", "planning_period"])
    )

    rollup_dicts = joined.to_dicts()
    rollup_models = [IncomeRollupRecord.model_validate(r) for r in rollup_dicts]

    metrics = StageMetrics(
        stage_name="transform",
        count_in=count_in,
        count_out=count_in,
        count_bad=0,
        run_id=run_id,
    )
    metrics.log(extra={"cycles_count": len(rollup_models)})

    return rollup_models, metrics
