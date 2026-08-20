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

