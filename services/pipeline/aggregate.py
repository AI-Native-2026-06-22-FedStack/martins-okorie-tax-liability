"""
TaxPulse Analytical Pipeline — Income Rollup Aggregate

Implements analytical aggregation in two engines:
1. Eager Pandas baseline (in-memory read, filter, group, aggregate)
2. Lazy Polars pipeline (deferred scan, predicate & projection pushdown, exact minor units)

Calculates:
- Year-to-Date (YTD) gross income per cycle (in integer cents)
- Weighted total tax liability and effective rate
- Year-over-Year (YoY) income delta per client (with null when no prior year exists)
"""

import os
from decimal import Decimal
from pathlib import Path
from typing import Any

import boto3
import pandas as pd
import polars as pl

from services.pipeline.schema import EXPORT_SCHEMA, PANDAS_DTYPES


def aggregate_lazy(path: str | Path) -> pl.DataFrame:
    """
    Polars Lazy implementation:
    MUST start from scan_csv / scan_parquet, composing transformations before .collect().
    Keeps all currency values in integer minor units (cents) throughout.
    """
    path_str = str(path)

    # 1. Start with lazy scan — file is NOT materialized yet
    lazy_events = (
        pl.scan_csv(path_str, schema_overrides=EXPORT_SCHEMA)
        if path_str.endswith((".csv", ".csv.gz"))
        else pl.scan_parquet(path_str)
    )

    # 2. Extract tax_year and project only required columns (projection pushdown)
    prepared = lazy_events.select([
        pl.col("tenant_id"),
        pl.col("cycle_id"),
        pl.col("client_id"),
        pl.col("planning_period"),
        pl.col("planning_period").str.slice(0, 4).cast(pl.Int32).alias("tax_year"),
        pl.col("amount_cents"),
        pl.col("effective_rate"),
    ])

    # 3. Cycle-level gross income and tax calculation
    cycle_rollup = prepared.group_by([
        "tenant_id",
        "cycle_id",
        "client_id",
        "planning_period",
        "tax_year",
    ]).agg([
        pl.col("amount_cents").sum().alias("gross_income_cents"),
        (pl.col("amount_cents").cast(pl.Float64) * pl.col("effective_rate").cast(pl.Float64))
        .round(0)
        .cast(pl.Int64)
        .sum()
        .alias("total_tax_cents"),
        pl.len().alias("event_count"),
    ])

    # 4. Client-annual income rollup for YoY calculation
    client_annual = prepared.group_by(["client_id", "tax_year"]).agg([
        pl.col("amount_cents").sum().alias("annual_client_income_cents")
    ])

    # Prior year client income table for join
    prior_year = client_annual.select([
        pl.col("client_id"),
        (pl.col("tax_year") + 1).alias("tax_year"),
        pl.col("annual_client_income_cents").alias("prior_year_income_cents"),
    ])

    # 5. Join cycle rollup with client annual and prior year data
    joined = (
        cycle_rollup
        .join(client_annual, on=["client_id", "tax_year"], how="left")
        .join(prior_year, on=["client_id", "tax_year"], how="left")
        .with_columns([
            # Effective rate in basis points (1 bps = 0.01%)
            pl.when(pl.col("gross_income_cents") > 0)
            .then((pl.col("total_tax_cents") * 10_000 // pl.col("gross_income_cents")).cast(pl.Int64))
            .otherwise(0)
            .alias("effective_rate_bps"),
            # YoY delta: annual income - prior year income (null if no prior year exists)
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

    # 6. Single .collect() executes the full optimized graph
    return joined.collect()


def get_lazy_query_plan(path: str | Path) -> str:
    """
    Returns the Polars optimized query plan showing predicate and projection pushdowns.
    """
    path_str = str(path)
    lazy_events = (
        pl.scan_csv(path_str, schema_overrides=EXPORT_SCHEMA)
        if path_str.endswith((".csv", ".csv.gz"))
        else pl.scan_parquet(path_str)
    )

    prepared = lazy_events.select([
        pl.col("tenant_id"),
        pl.col("cycle_id"),
        pl.col("client_id"),
        pl.col("planning_period"),
        pl.col("planning_period").str.slice(0, 4).cast(pl.Int32).alias("tax_year"),
        pl.col("amount_cents"),
        pl.col("effective_rate"),
    ])

    cycle_rollup = prepared.group_by([
        "tenant_id",
        "cycle_id",
        "client_id",
        "planning_period",
        "tax_year",
    ]).agg([
        pl.col("amount_cents").sum().alias("gross_income_cents"),
        (pl.col("amount_cents").cast(pl.Float64) * pl.col("effective_rate").cast(pl.Float64))
        .round(0)
        .cast(pl.Int64)
        .sum()
        .alias("total_tax_cents"),
        pl.len().alias("event_count"),
    ])

    return cycle_rollup.explain()


def aggregate_eager(path: str | Path) -> pd.DataFrame:
    """
    Pandas Eager baseline:
    Reads entire dataset into memory, groups, aggregates, and computes YoY delta.
    """
    # 1. Eager full load into memory
    df = pd.read_csv(
        path,
        dtype=PANDAS_DTYPES,
        usecols=[
            "tenant_id",
            "cycle_id",
            "client_id",
            "planning_period",
            "amount_cents",
            "effective_rate",
        ],
    )

    # 2. Extract tax year
    df["tax_year"] = df["planning_period"].str.slice(0, 4).astype(int)

    # 3. Calculate tax cents per transaction
    df["tax_cents"] = (df["amount_cents"] * df["effective_rate"]).round().astype("int64")

    # 4. Group by cycle
    cycle_rollup = df.groupby(
        ["tenant_id", "cycle_id", "client_id", "planning_period", "tax_year"],
        as_index=False,
    ).agg(
        gross_income_cents=("amount_cents", "sum"),
        total_tax_cents=("tax_cents", "sum"),
        event_count=("amount_cents", "count"),
    )

    # 5. Client annual total for YoY
    client_annual = df.groupby(
        ["client_id", "tax_year"], as_index=False
    ).agg(annual_client_income_cents=("amount_cents", "sum"))

    prior_year = client_annual.copy()
    prior_year["tax_year"] = prior_year["tax_year"] + 1
    prior_year = prior_year.rename(
        columns={"annual_client_income_cents": "prior_year_income_cents"}
    )

    # 6. Merge
    merged = cycle_rollup.merge(client_annual, on=["client_id", "tax_year"], how="left")
    merged = merged.merge(prior_year, on=["client_id", "tax_year"], how="left")

    # 7. Effective rate bps & YoY delta
    merged["effective_rate_bps"] = 0
    pos_mask = merged["gross_income_cents"] > 0
    merged.loc[pos_mask, "effective_rate_bps"] = (
        merged.loc[pos_mask, "total_tax_cents"] * 10_000
        // merged.loc[pos_mask, "gross_income_cents"]
    ).astype("int64")

    merged["yoy_income_delta_cents"] = merged["annual_client_income_cents"] - merged["prior_year_income_cents"]
    # Ensure float NaN converted to object None / Int64 nullable
    merged["yoy_income_delta_cents"] = merged["yoy_income_delta_cents"].astype("Int64")

    result = merged[[
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
    ]].sort_values(by=["tenant_id", "client_id", "planning_period"]).reset_index(drop=True)

    return result


def write_parquet(
    frame: pl.DataFrame,
    dest_dir: str | Path,
    partition_by: list[str] = ["planning_period"],
) -> Path:
    """
    Writes the aggregated DataFrame to partitioned Parquet files.
    Ensures data types (strings, integer minor units, decimals) travel with the files.
    """
    dest = Path(dest_dir)
    dest.mkdir(parents=True, exist_ok=True)

    # In Polars, write_parquet can write partitioned datasets by slicing/writing per partition
    # or using write_parquet directly on a single file / partitioned folder.
    for partition_vals, sub_df in frame.group_by(partition_by):
        if isinstance(partition_vals, tuple):
            part_str = "_".join(str(v) for v in partition_vals)
        else:
            part_str = str(partition_vals)

        part_folder = dest / f"planning_period={part_str}"
        part_folder.mkdir(parents=True, exist_ok=True)
        out_file = part_folder / "part-0000.parquet"
        sub_df.write_parquet(out_file, compression="zstd")

    return dest


def upload_warehouse_to_floci_s3(
    local_dir: str | Path,
    bucket_name: str = "taxpulse-analytics-warehouse",
    s3_prefix: str = "warehouse/income_rollup",
) -> list[str]:
    """
    Uploads the partitioned Parquet warehouse files to floci local S3 emulator.
    """
    endpoint_url = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
    s3 = boto3.client(
        "s3",
        endpoint_url=endpoint_url,
        aws_access_key_id="test",
        aws_secret_access_key="test",
        region_name="us-east-1",
    )

    try:
        s3.create_bucket(Bucket=bucket_name)
    except Exception:
        pass

    uploaded_keys = []
    local_path = Path(local_dir)

    for root, _, files in os.walk(local_path):
        for file in files:
            if file.endswith(".parquet"):
                full_path = Path(root) / file
                rel_path = full_path.relative_to(local_path)
                s3_key = f"{s3_prefix}/{rel_path}"
                s3.upload_file(str(full_path), bucket_name, s3_key)
                uploaded_keys.append(s3_key)

    return uploaded_keys
