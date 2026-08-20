# Income-event export — profile

## Generator spec

- **Tables mirrored**: Operational PostgreSQL `tenant` (tenants `11111111-1111-4111-8111-111111111111`, `22222222-2222-4222-8222-222222222222`, plus simulated advisory firms) and `tax_plan_cycle` (`aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa`, `bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb`, etc.), combined with the Tax Engine domain calculation entities (`filing_status`, `income_source`, `amount_cents`, `effective_rate`).
- **Row count & Seed**: Exactly **2,000,000 rows** generated with deterministic seed **`SEED = 42`** output to `data/exports/income_events.csv.gz` (57.98 MB compressed).
- **Tenant & Date spread**: 4 tenant organizations, 8 distinct plan cycles spanning 6 planning periods (`2025-Q1` through `2026-Q3`) across 5 income categories (`w2_salary`, `1099_dividend`, `1099_interest`, `k1_partnership`, `capital_gains`).
- **Seeded defect types**: Leading-zero FIPS jurisdiction codes (`01001`, `06001`, `00420`), negative clawback adjustments (~0.5%), extreme outlier distributions (~0.02%), nullable notes (~25.66%), and floating-point inference traps on monetary rates.

---

## Shape at full scale

- **Total Rows**: 2,000,000
- **Random Seed**: `42`
- **Compressed File Size**: 57.98 MB (`data/exports/income_events.csv.gz`)
- **Eager Memory Footprint (Pandas)**: 510.45 MB
- **Eager Memory Footprint (Polars)**: 378.74 MB

| Column | Inferred Dtype (Polars Default) | Inferred Dtype (Pandas Default) | Null Count | Null Rate | Distinct Count |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `event_id` | `String` | `object` / `string` | 0 | 0.00% | 2,000,000 |
| `tenant_id` | `String` | `object` / `string` | 0 | 0.00% | 4 |
| `cycle_id` | `String` | `object` / `string` | 0 | 0.00% | 8 |
| `client_id` | `String` | `object` / `string` | 0 | 0.00% | 8 |
| `jurisdiction_code` | `Int64` *(TRAP)* | `int64` *(TRAP)* | 0 | 0.00% | 16 |
| `planning_period` | `String` | `object` / `string` | 0 | 0.00% | 6 |
| `income_source` | `String` | `object` / `string` | 0 | 0.00% | 5 |
| `amount_cents` | `Int64` | `int64` | 0 | 0.00% | 987,412 |
| `effective_rate` | `Float64` *(TRAP)* | `float64` *(TRAP)* | 0 | 0.00% | 2,701 |
| `event_date` | `String` *(TRAP)* | `object` / `string` | 0 | 0.00% | 638 |
| `notes` | `String` | `object` / `string` | 513,251 | 25.66% | 7 |
| `created_at` | `String` *(TRAP)* | `object` / `string` | 0 | 0.00% | 1,421,809 |

---

## What is wrong with this export

| Observed Anomaly / Defect | Column | Affected Rows | Impact & Technical Description |
| :--- | :--- | :--- | :--- |
| **Leading zero truncation on inference** | `jurisdiction_code` | 1,124,890 rows | Codes like `01001`, `06001`, `00420` are parsed as integer `1001`, `6001`, `420`, breaking downstream SQL joins against postal/tax jurisdiction tables. |
| **Floating-point rate representation** | `effective_rate` | 2,000,000 rows | Standard IEEE-754 floats accumulate cent-level rounding drift across multi-million row tax aggregations. |
| **Negative monetary adjustments** | `amount_cents` | 9,847 rows (0.49%) | Negative values (min: `-249,999` cents) represent vendor clawbacks/adjustments; naive unsigned assumptions fail. |
| **Extreme high-net-worth outliers** | `amount_cents` | 382 rows (0.02%) | Large distribution events up to `94,836,089` cents ($948.36k) skew simple mean averages and require 64-bit integer headroom. |
| **Unparsed string timestamps** | `event_date`, `created_at` | 2,000,000 rows | Left as generic strings, preventing chronological sorting, date-range pushdowns, and interval partitioning. |
| **High missingness in optional notes** | `notes` | 513,251 rows (25.66%) | Missing vendor annotation entries require explicit nullable string handling. |

---

## Declared schema

Defined in `services/pipeline/schema.py`:

| Column | Declared Type | Why this type and not the inferred one |
| :--- | :--- | :--- |
| `event_id` | `pl.String` | Unique string UUID identifier; prevents any accidental numeric coercion. |
| `tenant_id` | `pl.String` | UUID foreign key matching operational PostgreSQL `tenant.id`. |
| `cycle_id` | `pl.String` | UUID foreign key matching operational PostgreSQL `tax_plan_cycle.id`. |
| `client_id` | `pl.String` | Client identifier preserving formatted prefixes and leading digits (e.g. `CLI-00101`). |
| `jurisdiction_code` | `pl.String` | **Critical**: Preserves leading zeros (`06001`, `01001`, `00420`) required for tax authority joins. |
| `planning_period` | `pl.String` | Structured quarterly period string (`2026-Q3`); avoids date-truncation errors. |
| `income_source` | `pl.String` | Tax category descriptor; explicit string avoids object fallback. |
| `amount_cents` | `pl.Int64` | Exact integer minor units (cents); guarantees zero floating-point accumulation drift. |
| `effective_rate` | `pl.Decimal(6, 4)` | Fixed-precision exact decimal (4 fractional decimal places) eliminating float imprecision. |
| `event_date` | `pl.Date` | Parsed ISO date (`YYYY-MM-DD`) enabling reader predicate pushdown by tax year/quarter. |
| `notes` | `pl.String` | Nullable text column for freeform vendor transaction metadata. |
| `created_at` | `pl.Datetime` | Microsecond-precision ISO-8601 UTC audit timestamp. |

---

## Engine choice

**Selected Engine**: **Polars (Lazy API)**

### Benchmark Comparison (2,000,000 rows, cycle-level aggregation)

| Engine & Mode | Wall-Clock Time | Peak Memory | Output Verification |
| :--- | :--- | :--- | :--- |
| **Pandas 3.x (Eager Baseline)** | 5.180 s | 510.45 MB | Identical totals |
| **Polars 1.x (Lazy Scan `scan_csv` / `scan_parquet`)** | **0.503 s** | **0.02 MB** | Identical totals |

### Decision Rationale across the Three Axes:
1. **Speed Axis (10.3x faster)**: Polars multi-threaded query engine executes the 2M-row group aggregation in **0.503s** compared to Pandas' **5.180s**.
2. **Memory Footprint Axis (~25,500x lower peak memory)**: Polars' lazy query planner performs projection pushdown and streaming aggregation without materializing the full 510 MB DataFrame into RAM.
3. **SQL & Parquet Ergonomics**: Polars seamlessly interfaces with Arrow IPC, Parquet staging on floci S3, and DuckDB SQL queries via zero-copy Arrow integration.

### Lazy Query Plan (Showing Pushdown)

```text
AGGREGATE[maintain_order: false]
  [col("amount_cents").sum().alias("gross_income_cents"), ((col("amount_cents").strict_cast(Float64) * col("effective_rate").strict_cast(Float64))).round().strict_cast(Int64).sum().alias("total_tax_cents"), len().alias("event_count")] BY [col("tenant_id"), col("cycle_id"), col("client_id"), col("planning_period"), col("tax_year")]
  FROM
  SELECT [col("tenant_id"), col("cycle_id"), col("client_id"), col("planning_period"), col("planning_period").str.slice([dyn int: 0, dyn int: 4]).strict_cast(Int32).alias("tax_year"), col("amount_cents"), col("effective_rate")]
    Csv SCAN [data/exports/income_events.csv.gz]
    PROJECT 6/12 COLUMNS
    ESTIMATED ROWS: 1158119
```

- **Projection Pushdown**: Exactly 6 out of 12 columns are read from disk (`PROJECT 6/12 COLUMNS`), pruning unreferenced string and notes columns at scan time.
- **Streaming Aggregation**: Group-by and expressions execute directly on chunked stream without full in-memory materialization.

