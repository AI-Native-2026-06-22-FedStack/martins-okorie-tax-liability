"""
TaxPulse Analytical Pipeline — Declared Schema

Defines the explicit read schema and typed data contracts for analytical
processing across polars, DuckDB, and Parquet staging.
"""

import polars as pl

# Explicit polars schema for reading vendor income-event exports.
# Enforces strict dtype discipline to eliminate schema inference bugs:
# 1. Identifiers (event_id, tenant_id, cycle_id, client_id, jurisdiction_code) as String
#    to protect against silent truncation of leading zeros.
# 2. Monetary amounts (amount_cents) as Int64 integer minor units to prevent float precision drift.
# 3. Tax rates (effective_rate) as Decimal (precision 6, scale 4) for exact rate representation.
# 4. Dates and timestamps as Date / Datetime objects (parsed, not left as generic strings).
EXPORT_SCHEMA: dict[str, pl.DataType] = {
    "event_id": pl.String,
    "tenant_id": pl.String,
    "cycle_id": pl.String,
    "client_id": pl.String,
    "jurisdiction_code": pl.String,
    "planning_period": pl.String,
    "income_source": pl.String,
    "amount_cents": pl.Int64,
    "effective_rate": pl.Decimal(precision=6, scale=4),
    "event_date": pl.Date,
    "notes": pl.String,
    "created_at": pl.Datetime,
}

# Explicit pandas dtype mapping for eager baseline comparison
PANDAS_DTYPES: dict[str, str] = {
    "event_id": "string[pyarrow]",
    "tenant_id": "string[pyarrow]",
    "cycle_id": "string[pyarrow]",
    "client_id": "string[pyarrow]",
    "jurisdiction_code": "string[pyarrow]",
    "planning_period": "string[pyarrow]",
    "income_source": "string[pyarrow]",
    "amount_cents": "int64",
    "effective_rate": "float64",
    "notes": "string[pyarrow]",
}
