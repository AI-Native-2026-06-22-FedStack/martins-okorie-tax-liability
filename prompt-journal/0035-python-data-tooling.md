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
