# Prompt Journal: Python Data Tooling

## Entry 1

### Asked

Save the Week 9 Day 1 "Python Data Tooling" lesson syllabus into `helper/` and start a new prompt journal on branch `m9d1-implementation`.

### Produced

1. Saved complete lesson reference text to `helper/week-9-day-1-python-data-tooling.md` covering:
   - Engine selection across pandas, polars, and DuckDB based on memory footprint, raw speed, and SQL ergonomics.
   - Lazy versus eager evaluation, scan_parquet planning, predicate and projection pushdowns, and `.explain()` verification.
   - Schema inference pitfalls and dtype discipline (preserving identifier leading zeros as strings, representing money as integer cents, and archiving to Parquet).
   - Architectural boundary: notebooks for EDA exploration, versioned `.py` modules for testable production pipelines.
   - Hands-on practice workflow for profiling, lazy benchmarking, declared schema archiving, and DuckDB-Postgres validation.
2. Initialized `prompt-journal/0035-python-data-tooling.md` as the sequential journal for Week 9 Day 1.

### Accepted or rejected

Accepted

### Why

The lesson reference material was preserved in helper and the prompt journal was initialized at the next sequential path adhering to repository standards in `AGENTS.md`.

## Entry 2

### Asked

Verify all prerequisites for Week 9 Day 1 (Python 3.13 runtime, data engine libraries polars 1.x / pandas 3.x / DuckDB 1.x / pyarrow / psycopg, Jupyter environment, operational PostgreSQL schema reachability on port 55433, local floci reachability, and existing Module 1–8 workspace integrity), scaffold `services/pipeline/pyproject.toml`, update `.gitignore` with generated data and notebook checkpoint exclusions, create required directories, and execute the bootstrap smoke test.

### Produced

1. Verified Python 3.13.2 runtime matching the Tax Engine.
2. Verified and installed data engines: `polars==1.43.2`, `pandas==3.0.5`, `duckdb==1.5.5`, `pyarrow==25.0.1`, and `psycopg==3.3.4` (`psycopg-binary`).
3. Verified Jupyter environment (`jupyter 1.1.1`, `ipython 8.32.0`, `notebook 7.6.0`).
4. Verified PostgreSQL operational database reachability via `DATABASE_URL="postgresql://taxpulse_app@localhost:55433/taxpulse_l"` with `tax_plan_cycle` and planning schema verified (`count = 2`).
5. Verified local floci emulator reachability at `http://localhost:4566`.
6. Created `services/pipeline/pyproject.toml` pinning required engine constraints (`polars>=1,<2`, `pandas>=3,<4`, `duckdb>=1,<2`, `pyarrow`, `psycopg[binary]>=3.1`, and dev group `pytest`, `jupyter`).
7. Appended `data/exports/`, `data/warehouse/`, `*.parquet`, and `.ipynb_checkpoints/` to `.gitignore`.
8. Created directory structure: `services/pipeline/tools/`, `services/pipeline/tests/`, `notebooks/`, `data/exports/`, `data/warehouse/`, `docs/data/`.
9. Successfully executed the bootstrap smoke test verifying engines, floci, database, and folder creation.

### Accepted or rejected

Accepted

### Why

All Week 9 Day 1 prerequisites, data libraries (polars 1.x, pandas 3.x, DuckDB 1.x), PostgreSQL connections, floci endpoints, directory structures, and git-ignore protections were empirically verified and initialized.

## Entry 3

### Asked

Execute Task 1: build the deterministic vendor income-event export generator (`services/pipeline/tools/generate_export.py`) mirroring operational `tax_plan_cycle` and `tenant` entities with seeded defects at a 2,000,000-row scale (`seed=42`); explore the dataset in `notebooks/income-export-eda.ipynb`; declare the explicit read schema in `services/pipeline/schema.py` enforcing string identifiers, integer minor units for amounts, exact decimal rates, and real datetimes; and document findings in the one-page profile at `docs/data/income-export-profile.md`.

### Produced

1. Authored `services/pipeline/tools/generate_export.py` generating 2,000,000 income event rows across 4 tenants and 8 plan cycles spanning 6 quarters with deterministic seed 42 into `data/exports/income_events.csv.gz` (57.98 MB).
2. Seeded realistic vendor defects: leading-zero FIPS codes (`01001`, `06001`, `00420`), negative clawbacks (9,847 rows), extreme distribution outliers (382 rows), nullable notes (25.66%), and rate decimals.
3. Authored exploratory analysis notebook `notebooks/income-export-eda.ipynb` demonstrating raw text inspection, default inference failure, dtype discipline verification, and eager vs lazy benchmarks.
4. Created `services/pipeline/schema.py` declaring `EXPORT_SCHEMA` with `pl.String`, `pl.Int64`, `pl.Decimal(6, 4)`, `pl.Date`, and `pl.Datetime`.
5. Authored `docs/data/income-export-profile.md` recording generator spec, shape at full scale, 6 detailed defect categories, declared schema justifications, and engine benchmark results (Polars Lazy at 0.503s / 0.02 MB peak RAM vs Pandas Eager at 5.180s / 510.45 MB peak RAM).

### Accepted or rejected

Accepted

### Why

The 2M-row export generator, EDA exploration notebook, explicit read schema, and comprehensive one-page profile artifact were fully implemented and empirically verified.
