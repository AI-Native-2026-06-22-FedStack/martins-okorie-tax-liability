# 9.1 Python Data Tooling

- **Last Updated:** 2026-07-29 23:10:51 UTC
- **Commit:** [8185229e](https://git.uptimecrew.com/wisam.naji/ai-native-curriculum/-/blob/8185229e65933074f1fa0d275f4f7694f7243ed5/curriculum_fs/Module9/Lesson1/lesson.lms.md)
- **Module:** Week 9 · Day 1

Choose the right Python data engine for the job, understand lazy versus eager evaluation and dtype discipline, and keep exploration in notebooks while pipelines live in `.py`.

---

## Topic 1 of 5: Choosing the engine — pandas, polars, and DuckDB

### Why Do I Need to Know This?
This week the team builds the data pipeline that feeds its AI-Assist feature, and the very first decision is which engine processes the corpus. Reaching for pandas out of habit can make a pipeline slow and memory-hungry before a line of business logic exists. Knowing when pandas, polars, and DuckDB each win is what lets you pick deliberately instead of by reflex.

That choice shapes the rest of the week: the engine you pick here is the one your pipeline, your validation queries, and your corpus exploration all run on.

### Scenario
The team profiles its capstone corpus — a few million rows of income and transaction events, plus a directory of guidance documents. pandas is what everyone already knows. polars is faster and can defer work until it has the whole query. DuckDB lets them run SQL straight over the files and check that its answers match their Postgres database exactly. They need to pick the engine that fits the work, not the one that fits their muscle memory.

### Theory

#### pandas: the familiar default for small and medium data
pandas is the right choice when the data fits comfortably in memory and you need its huge ecosystem of integrations. As of 2026 the current major is pandas 3.x, which made [Copy-on-Write the default and added a PyArrow-backed string type](https://pandas.pydata.org/community/blog/pandas-3.0.html) (PyArrow is the Python library for the Arrow columnar format, defined below) — string columns are faster and use less memory when pyarrow is installed. pandas evaluates every operation immediately, which is simple to reason about but means it holds the whole frame in memory at each step.

#### polars: speed and memory headroom at scale
polars wins when the data is large or the work is speed-critical. It is Arrow-backed and multithreaded by default, and its lazy API lets it plan and optimize a whole query before reading data ([polars lazy guide](https://docs.pola.rs/user-guide/lazy/)). For the team’s multi-million-row event tables, polars processes more data in less memory than pandas — the win the Example measures.

#### DuckDB: SQL over files, in-process
DuckDB wins when the work is SQL-shaped. It runs in-process with no server to operate, reads Parquet and CSV files directly, and — through its [Postgres extension](https://duckdb.org/docs/current/core_extensions/postgres/overview) — can query live Postgres tables with ATTACH. That last capability is how the team checks a transform produces the same answer in DuckDB and in its Postgres database. The current major is DuckDB 1.x.

#### Choosing: match the engine to the work
The decision turns on three axes: memory footprint, raw speed, and SQL ergonomics. Small data with heavy ecosystem needs points to pandas; large or speed-critical columnar work points to polars; SQL-shaped work or queries that run directly over files or Postgres point to DuckDB. The point is to match the engine to the shape of the work.

```text
Picking the engine by the shape of the work:

Is the work naturally SQL, or run over files / Postgres?
  ├─ YES -> DuckDB
  └─ NO  -> Does the data fit comfortably in memory?
              ├─ YES (small/medium) -> pandas
              └─ NO (large / speed-critical) -> polars
```

### Example: one aggregation, three engines

```python
# Total income per filer — the same result in three engines.

# (1) pandas — eager, in-memory
import pandas as pd

df = pd.read_parquet("income_events.parquet")
pd_result = df.groupby("filer_id")["amount_cents"].sum()

# (2) polars — lazy scan, optimized before it runs
import polars as pl

pl_result = (
    pl.scan_parquet("income_events.parquet")  # lazy: nothing read yet
    .group_by("filer_id")
    .agg(pl.col("amount_cents").sum())
    .collect()  # runs the optimized plan
)

# (3) DuckDB — SQL straight over the Parquet file
import duckdb

duck_result = duckdb.sql("""
    SELECT filer_id, SUM(amount_cents) AS total
    FROM 'income_events.parquet'
    GROUP BY filer_id
""").pl()  # return as a polars frame
```

- **(1) pandas** reads the whole file into memory, then groups — simple, but the full frame is resident the entire time.
- **(2) scan_parquet** returns a lazy plan; polars only reads what the grouped aggregation needs when `.collect()` runs.
- **(3) DuckDB** runs SQL directly on the file with no explicit load step, which is why SQL-shaped work is its sweet spot.

All three produce the same totals — the choice is about memory, speed, and which idiom fits, not correctness.

### AI Practice

#### Prompt it
Have Codex run an exploratory data analysis (EDA) on the corpus and build a polars pipeline that beats a pandas baseline:
> Profile our capstone corpus (income_events.parquet plus the guidance docs directory): row counts, column dtypes, null rates, and memory footprint. Then write a pandas baseline that computes total income per filer and a polars equivalent, and report the wall-clock time and peak memory of each. Use scan_parquet for the polars version.

#### Watch out
Codex may write the polars version with `read_parquet().lazy()` (which materializes the whole file first and defeats the optimization), compare the two on a tiny sample where pandas looks fine, or report only wall-clock time and ignore peak memory. It can also claim a speedup without actually timing both. Confirm the polars version uses `scan_parquet`, that the comparison runs on the real corpus size, and that memory is measured, not assumed.

#### Verify
Run both versions and confirm they produce identical per-filer totals. Confirm the polars version uses `scan_parquet` (not `read_parquet().lazy()`) and that it reports both wall-clock time and peak memory against the full corpus. Then, without AI, state which of the three engines you would choose for this pipeline and name the axis — memory, speed, or SQL ergonomics — that decided it.

### Knowledge Check
1. **Your pipeline step is a multi-table join and several aggregations expressed most naturally as SQL, and you also want to confirm the result matches the same query against your Postgres database. Which engine fits best, and why?**
   - *Answer:* DuckDB, because the work is SQL-shaped and its Postgres extension can query the live database for an equivalence check.
2. **A teammate defaults to pandas for a 40-million-row transaction table on a laptop and the job runs out of memory. What is the accurate framing of the problem?**
   - *Answer:* pandas is eager and in-memory, so it holds the whole frame at once; polars (lazy) or DuckDB would read far less data.
3. **What does it mean that pandas evaluates "eagerly," and why does it matter for a memory-constrained pipeline?**
   - *Answer:* Each operation runs immediately and returns a materialized frame, so intermediate results stay in memory at every step.
4. **Your task processes a few million rows, is performance-critical, and is expressed as DataFrame transformations rather than SQL. Which engine is the best default, and on which axis?**
   - *Answer:* polars, on the speed-and-memory axis, because it is Arrow-backed, multithreaded, and can plan the work lazily.

---

## Topic 2 of 5: Lazy versus eager evaluation

### Why Do I Need to Know This?
The single biggest performance lever in polars and DuckDB is that they can plan an entire query before running it — but only if you use the lazy API. A learner who calls polars eagerly throws that lever away and then wonders why it is no faster than pandas. Understanding lazy evaluation is what turns "polars is supposedly fast" into a measured win.

The team’s pipeline reads from large files every run, so reading less data per run is the difference between a pipeline that finishes in seconds and one that drags.

### Scenario
The team’s first polars pipeline reads the whole corpus into memory and then filters to one tax year — no faster than the pandas version it replaced. Rewriting it to start from `scan_parquet` turns it into a lazy query, so polars pushes the year filter down into the file scan and reads only the matching row groups. The same job drops from minutes to seconds.

### Theory

#### Eager runs now; lazy plans first
Eager evaluation executes each operation the moment you write it. Lazy evaluation instead records what you want, optimizes the whole plan, and runs it only when you call `.collect()`. Lazy is what lets the engine rearrange and prune work before any data moves.

#### polars LazyFrames and DuckDB plan; pandas does not
In polars, the `scan_*` functions (such as `scan_parquet`) return a `LazyFrame`, and DuckDB’s SQL engine plans every query the same way ([polars lazy guide](https://docs.pola.rs/user-guide/lazy/)). pandas is eager and has no equivalent planning step. The canonical polars pipeline is therefore `scan → transform chain → collect`.

> [!WARNING]
> `read_parquet(...).lazy()` looks lazy but is not — it materializes the entire file first and then wraps it, so the optimizer cannot push anything into the reader. Always start from `scan_parquet` when you want a lazy pipeline ([polars Parquet guide](https://docs.pola.rs/user-guide/io/parquet/)).

#### Pushdown: read less data
The optimizer’s two biggest wins are **predicate pushdown** (filter conditions are pushed into the scan, so non-matching rows are skipped before they load) and **projection pushdown** (only the columns the query references are read from disk) ([polars scan_parquet](https://docs.pola.rs/api/python/dev/reference/api/polars.scan_parquet.html)). For the team’s year-filtered pipeline, predicate pushdown is what makes it read one year instead of all of them.

#### The cost: errors surface at collect
Because nothing runs until `.collect()`, an error in a lazy chain surfaces there, not at the line that looks wrong. You diagnose a lazy pipeline by reading its query plan with `.explain()`, which shows the optimized plan — including whether your filter actually became a pushdown.

### Example: a lazy pipeline and its plan

```python
import polars as pl

# (1) scan_parquet returns a LazyFrame — no data read yet
q = (
    pl.scan_parquet("income_events.parquet")
    .filter(pl.col("tax_year") == 2025)          # (2) becomes a predicate pushdown
    .select(["filer_id", "amount_cents"])        # (3) becomes a projection pushdown
)

# (4) inspect the optimized plan BEFORE running it
print(q.explain())  # shows filter + column pruning pushed into the scan

# (5) collect triggers the read — only 2025 rows, only two columns
result = q.collect()
```

- **(1) scan_parquet** builds a plan; the file is not read at this line.
- **(2)** The filter is pushed into the scan, so non-2025 row groups are skipped on read.
- **(3)** The select is pushed down too, so only the two referenced columns leave disk.
- **(4) .explain()** shows the optimized plan — this is how you confirm the pushdowns happened.
- **(5) .collect()** is the only line that actually reads data, and it reads the pruned set.

### AI Practice

#### Prompt it
Have Codex convert an eager polars script to a lazy pipeline and prove the pushdown:
> Convert this eager polars script (it calls read_parquet then filters and selects) into a lazy pipeline that starts from scan_parquet, applies the same filter and column selection, and ends in collect. Then print q.explain() and point out where the filter and the column pruning appear as pushdowns in the plan.

#### Watch out
Codex may "convert" the script by appending `.lazy()` to `read_parquet`, which still loads the whole file first and pushes nothing down. It may also call `.collect()` early in the chain (forcing a materialization mid-pipeline) or skip `.explain()` so you can’t confirm the optimization. Check that the chain starts from `scan_parquet`, that `.collect()` appears once at the end, and that the printed plan shows the filter and projection pushed into the scan.

#### Verify
Run `.explain()` on the converted pipeline and confirm the filter shows as a predicate pushdown and the column selection as a projection pushdown in the plan. Confirm `scan_parquet` begins the chain and `.collect()` appears exactly once, at the end. Time the eager and lazy versions on the full corpus and confirm the lazy one reads less and runs faster. Then, without AI, explain why `read_parquet().lazy()` cannot achieve the same pushdown.

### Knowledge Check
1. **A polars pipeline starts with scan_parquet, applies a filter to one region, then selects three columns and calls .collect(). What does the lazy engine actually read from disk?**
   - *Answer:* Only the rows matching the region filter and only the three selected columns, because both are pushed into the scan.
2. **A developer rewrites a slow pandas job in polars using pl.read_parquet("f.parquet").lazy() and is surprised it is no faster. What is the problem?**
   - *Answer:* `read_parquet` materializes the whole file first, so wrapping it in `.lazy()` leaves nothing for the optimizer to push down.
3. **Why does an error in a long lazy polars chain surface at the .collect() call rather than at the line that contains the mistake?**
   - *Answer:* Because the chain only builds a plan until `.collect()` runs it, so execution-time errors appear when the plan executes.
4. **You need to confirm that a filter in your lazy pipeline became a predicate pushdown rather than a post-load filter. What do you do?**
   - *Answer:* Call `.explain()` on the pipeline and confirm the filter appears pushed into the scan in the optimized plan.

---

## Topic 3 of 5: Schema inference and dtype discipline

### Why Do I Need to Know This?
Inferred data types are a silent data-quality bug. A ZIP code read as an integer loses its leading zero, a money column read as a float drifts by cents, and a column with mixed values collapses to a useless generic type. None of these throws an error — they just quietly corrupt the corpus the AI-Assist feature will later answer from. The pipeline must declare its types, not guess them.

The corpus feeds retrieval and citations downstream, so a type bug here becomes a wrong answer a filer reads later — the cost of a guessed dtype is paid far from where it happened.

### Scenario
The team’s loader reads a CSV of jurisdiction codes and infers the code column as a 64-bit integer. A handful of codes have leading zeros, which the integer type silently drops, so a later join against the jurisdiction table misses those rows entirely. Declaring the column as a string at read time prevents the whole class of bug before it reaches the corpus.

### Theory

#### Inference guesses, and guesses wrong in predictable ways
Schema inference scans a sample of the data and picks a type. It gets the same categories wrong every time: identifiers with leading zeros (ZIPs, jurisdiction codes) become integers and lose digits; money becomes a float and accumulates rounding error; mixed columns collapse to a generic object/string type that defeats later operations.

#### Declare an explicit schema at the untyped boundary
Inference bites hardest on untyped text sources — CSV and JSON — because the types are not stored anywhere. The discipline is to pass an explicit schema (a column-to-dtype map) at read time, so the reader is told the types rather than guessing them. Both polars and pandas accept an explicit dtype/schema argument on their text readers.

#### Persist to Parquet so types travel
Once you have declared the right types, store the data in [Parquet](https://docs.pola.rs/user-guide/io/parquet/), a columnar format that records each column’s type in the file. From then on, every downstream read gets the correct types for free — the type information travels with the data instead of being re-guessed at each hop.

#### Money is the recurring trap
Represent money as an integer count of minor units (cents) or a fixed-precision decimal type — never a float. Floating point cannot represent most decimal fractions exactly, so a float money column drifts by fractions of a cent across millions of rows.

| Column | Inferred (wrong) | Declared (right) | Bug prevented |
| :--- | :--- | :--- | :--- |
| `jurisdiction_code` | int64 | string | leading zeros dropped → join misses |
| `amount` | float64 | int (cents) | cent-level rounding drift |
| `status` | object (mixed) | enum/category | unbounded values, no validation |

### Example: declare the schema at read, then archive to parquet

```python
import polars as pl

# (1) Tell the reader the types instead of letting it guess
schema = {
    "jurisdiction_code": pl.String,    # keep leading zeros
    "amount_cents": pl.Int64,          # money as integer minor units, never float
    "filer_id": pl.String,
    "filed_at": pl.Datetime,
}

df = pl.read_csv("filings.csv", schema_overrides=schema)  # (2) explicit dtypes

# (3) Persist to Parquet so the types travel with the data
df.write_parquet("filings.parquet")

# (4) Every later read gets the right types for free
later = pl.read_parquet("filings.parquet")  # jurisdiction_code is still String
```

- **(1)** The schema declares each column’s type up front, so nothing is inferred for these columns.
- **(2)** `schema_overrides` forces the CSV reader to use those types — the jurisdiction code stays a string and keeps its leading zeros.
- **(3)** Writing to Parquet records the types in the file itself.
- **(4)** The downstream read inherits the declared types, so the rest of the pipeline never re-guesses them.

### AI Practice

#### Prompt it
Have Codex propose an explicit schema for the corpus and justify each identifier and money column:
> Here are the columns and a 20-row sample of our filings CSV. Propose an explicit read schema (column to dtype) for polars. For every identifier column, money column, and date column, say which type you chose and the bug that inferring it would have caused. Type money as integer cents, not float.

#### Watch out
Codex tends to type identifier columns (ZIPs, codes) as integers because the sample rows look numeric, type money as a float because the sample shows decimals, and leave mixed columns as a generic string without flagging them. Each looks fine on the sample and breaks on the full data. Check every identifier is a string, every money column is integer cents (or a decimal), and that date columns are real datetimes, not strings.

#### Verify
Read the CSV with the proposed schema and confirm the jurisdiction code keeps its leading zeros and the amount column is integer cents, not float. Write to Parquet, read it back, and confirm the types survive the round-trip. Run a join that depends on the identifier column and confirm no rows are dropped from a lost leading zero. Then, without AI, explain why money as a float drifts and what to use instead.

### Knowledge Check
1. **A CSV loader infers a zip_code column as int64, and a later join on ZIP silently drops a handful of rows. What happened, and what is the fix?**
   - *Answer:* Inferring the ZIP as an integer dropped its leading zeros, so those values no longer match; declare it as a string at read.
2. **Why should a money column be stored as integer cents or a fixed-precision decimal rather than a float?**
   - *Answer:* Floats cannot represent most decimal fractions exactly, so a float money column accumulates cent-level rounding drift.
3. **Your pipeline reads an untyped CSV every run and you keep fighting inference bugs. What is the most durable fix?**
   - *Answer:* Declare an explicit schema at read time and archive to Parquet so the corrected types travel with the data.
4. **After you declare a schema and write the data to Parquet, why do downstream reads no longer need the schema?**
   - *Answer:* Because Parquet records each column’s type in the file, so every later read gets the declared types without guessing.

---

## Topic 4 of 5: Notebooks for exploration, .py for pipelines

### Why Do I Need to Know This?
Notebooks are excellent for exploring a corpus and dangerous for running one in production. Their hidden, out-of-order execution state means a notebook that "works on my machine" can fail the moment it runs top-to-bottom in CI — and they resist testing and version-control diffs. The team needs a hard line: explore in a notebook, ship a .py pipeline.

That line is a program rule for the week — pipelines live in `.py` with validation at the boundary, notebooks are exploration only — because the pipeline this week becomes production code the AI feature depends on.

### Scenario
A teammate’s exploratory notebook computes the corpus summary perfectly on their laptop, but the same notebook fails in CI: a variable it uses was defined in a cell below the one that uses it, and the teammate had simply run the cells out of order. Because the team’s `AGENTS.md` says pipelines live in `.py`, the actual ingest was never at risk — only the exploration was.

### Theory

#### Notebooks carry hidden, mutable state
A notebook’s cells share one kernel session and can be run in any order, so its real state depends on the order you happened to click — not the order the cells appear. That makes a notebook non-reproducible (a fresh top-to-bottom run can behave differently) and hard to diff in version control. This is fine for exploration, where you are poking at data, and unsafe for a pipeline, where the run must be identical every time.

#### A pipeline is a versioned, tested module
A pipeline is a `.py` module with explicit inputs and outputs, exercised by `pytest`, and reviewable as a plain diff in a pull request. It runs top-to-bottom the same way every time, on every machine, which is exactly what a production ingest requires. The contrast with a notebook is reproducibility and testability, not capability.

#### The boundary: exploration informs, code ships
The notebook’s job is to produce two things — the one-page corpus summary and the schema decision from Topic 3. The `.py` pipeline then implements that decision. Exploration informs the design; code ships it. Keeping the two separate is what lets the team move fast in the notebook without that speed leaking into the production path.

```text
Notebook (EDA)  ──>  1-page summary + schema decision  ──>  .py pipeline (implements)  ──>  pytest  ──>  CI
```

### Example: the same logic as a testable pipeline

```python
# pipeline/summary.py
import polars as pl

# (1) explicit, typed inputs and outputs — no hidden state
def total_income_by_year(path: str) -> pl.DataFrame:
    return (
        pl.scan_parquet(path)
        .group_by("tax_year")
        .agg(pl.col("amount_cents").sum().alias("total_cents"))
        .sort("tax_year")
        .collect()
    )

if __name__ == "__main__":
    # (2) runs top-to-bottom, every time
    print(total_income_by_year("income_events.parquet"))
```

```python
# tests/test_summary.py
from pipeline.summary import total_income_by_year

def test_totals_are_grouped_by_year():
    # (3) the pipeline is testable
    out = total_income_by_year("tests/fixtures/sample.parquet")
    assert out.columns == ["tax_year", "total_cents"]
    assert out.height > 0
```

- **(1)** The transform is a typed function with one input and one output — no reliance on cells run earlier.
- **(2)** The `__main__` guard means the module runs the same way top-to-bottom whenever it is executed.
- **(3)** Because it is a plain function, pytest can call it on a fixture and assert on the result — something a notebook cell cannot offer.

### AI Practice

#### Prompt it
Have Codex extract a clean `.py` pipeline from an exploratory notebook:
> Here is our EDA notebook. Extract the corpus-summary logic into a pipeline/summary.py module as typed functions with explicit inputs and outputs, add an if __name__ == "__main__" entry point, and write a pytest test that runs it against a small fixture. Drop any notebook-only state (display calls, out-of-order variables) and confirm it runs top-to-bottom.

#### Watch out
Codex may copy notebook cells into a `.py` file in their on-screen order without fixing out-of-order variable definitions, so the module fails on a clean run. It may also carry over notebook-only calls (inline display, magics) or write a test that just imports the module without asserting on its output. Run the module top-to-bottom from a clean interpreter and confirm the test actually checks the result, not just that the import succeeds.

#### Verify
Run the extracted module top-to-bottom in a fresh interpreter and confirm it produces the summary with no `NameError` from out-of-order definitions. Run `pytest` and confirm the test asserts on the output shape or values, not merely that the import worked. Confirm no notebook-only calls (`display`, magics) remain. Then, without AI, explain why a notebook that works for you can still fail a clean top-to-bottom run in CI.

### Knowledge Check
1. **An EDA notebook runs perfectly for its author but fails in CI with a NameError. What is the most likely cause?**
   - *Answer:* The author ran cells out of order, so a variable used in one cell was defined in a later cell that a clean run hits second.
2. **Why is a .py module the right home for a production pipeline, while a notebook is the right home for exploration?**
   - *Answer:* A `.py` module runs top-to-bottom identically every time and can be tested and diffed, which a notebook’s hidden state cannot guarantee.
3. **According to the team’s working rule, what should an exploratory notebook actually produce before any pipeline code is written?**
   - *Answer:* The one-page corpus summary and the schema decision that the `.py` pipeline then implements as tested code.
4. **What makes the .py pipeline testable in a way the equivalent notebook cell is not?**
   - *Answer:* The pipeline exposes typed functions with explicit inputs and outputs, so pytest can call them on a fixture and assert on the result.

---

## Topic 5 of 5: Practice — profile the corpus and stand up the baseline pipeline

### Why Do I Need to Know This?
This lesson’s payoff is the foundation the rest of the week builds on: a clear picture of the corpus, the right engine chosen for the work, a declared schema that won’t silently corrupt the data, and a tested `.py` pipeline rather than a fragile notebook. The way to know you have it is to do it — profile the real corpus, build a lazy polars baseline that beats a pandas one, declare the schema, and extract the whole thing into a module with a test. This exercise drives Codex through the work and verifies by running it.

### AI Practice

#### Prompt it
Hands-on practice for this lesson — profile the corpus and build the baseline pipeline:
> Help me stand up the data foundation for our capstone corpus: (1) profile it (row counts, dtypes, null rates, memory) in a notebook and write a 1-page summary; (2) pick polars or pandas and justify it on memory/speed/SQL-ergonomics; (3) declare an explicit read schema (identifiers as strings, money as integer cents, real datetimes) and archive to Parquet; (4) write a lazy polars baseline (scan_parquet -> filter -> select -> collect) that beats a pandas baseline on the full corpus; (5) extract it into pipeline/*.py with a pytest test and a DuckDB query that confirms the same answer as Postgres.

#### Watch out
Codex is likely to default to pandas without justifying it, write the polars version with `read_parquet().lazy()` so no pushdown happens, infer dtypes (typing ZIPs as integers and money as floats), leave the work in a notebook instead of a tested module, or compare engines on a tiny sample. Each leaves a foundation that looks done but quietly fails at corpus scale. Check the engine justification, the `scan_parquet` start, the declared schema, and that the pipeline is a tested `.py` module before you trust it.

#### Verify
Confirm the 1-page summary reports row counts, dtypes, null rates, and memory on the full corpus. Confirm the schema types identifiers as strings (leading zeros intact), money as integer cents, and dates as datetimes, and that the Parquet round-trip preserves them. Confirm the polars baseline starts from `scan_parquet`, shows its pushdowns in `.explain()`, and beats the pandas baseline on time and memory at full scale. Confirm the pipeline is a `.py` module with a passing pytest test and that the DuckDB query matches the Postgres answer. Then close Codex and, without AI, justify your engine choice and explain one dtype you declared and the bug it prevents.
