# Entry 1

Asked — Save the attached Python toolchain and syntax information into a file for use above `AGENTS.md`, and create the journal entry in a new journal file.

Produced — Created the root-level Python overlay/reference Markdown file and started a new Python toolchain prompt journal.

Accepted or rejected — Accepted.

Why — Helps keep Python/FastAPI references close to the repo so future work follows the same structure and toolchain expectations.

# Entry 2

Asked — Set up the Python project folder/toolchain layout with `pyproject.toml`, `uv.lock`, `src/tax_liability_model.py`, `src/tax_liability.py`, tests, and `Makefile`.

Produced — Added the strict Python scaffold, pydantic v2 boundary, typed async function, pytest coverage, `uv.lock`, and one-command check target.

Accepted or rejected — Accepted.

Why — It established the Python scaffold, strict tooling, locked dependencies, and first working pydantic/async pytest baseline.

# Entry 3

Asked — Create a Python 3.13 package beside the TypeScript monorepo using `uv`, a committed lockfile, pinned pydantic v2, Ruff, mypy strict, and README clean-clone setup documentation.

Produced — Reorganized the starter Python code into a `src/taxpulse_python/` package, updated Python imports and tool commands, regenerated the committed `uv.lock`, and documented `uv sync --locked` plus verification commands in the README.

Accepted or rejected — Accepted.

Why — The Python code became a real package beside the TypeScript stack, with reproducible `uv` setup and README instructions.

# Entry 4

Asked — Add a single target that runs Ruff, mypy, and pytest in sequence and document Python conventions beside Node conventions.

Produced — Updated `Makefile check`, documented Node/Python conventions in README, and verified the target passes.

Accepted or rejected — Accepted.

Why — One command now runs Ruff, mypy, and pytest in order, making Python checks match the governed Node workflow.

# Entry 5

Asked — Add a pydantic v2 tax-calc request boundary model for filing status, income, deductions, and state that rejects invalid filing statuses, with pytest coverage and clean mypy.

Produced — Added `TaxCalcRequest` with a typed filing-status literal, exported it from the Python package, and added pytest cases for valid boundary parsing and invalid filing-status rejection.

Accepted or rejected — Accepted.

Why — Invalid tax-calc input now fails at the pydantic boundary while valid input remains covered by tests.

# Entry 6

Asked — Add an async tax-calc result stub that accepts `TaxCalcRequest`, returns a typed placeholder result, has async pytest happy-path and edge-case coverage, and keeps the one-command target green.

Produced — Added `TaxCalcResult` and `calculate_tax_result`, exported them from the Python package, and added async pytest cases for placeholder calculation and deductions exceeding income.

Accepted or rejected — Accepted.

Why — The async placeholder calculation is typed, local-only, covered for happy and edge cases, and keeps the check target green.

# Entry 7

Asked — Group the source tree by language so Python and TypeScript code live under separate folders.

Produced — Moved TypeScript source into `src/typescript/`, moved the Python package into `src/python/taxpulse_python/`, updated tool configuration and README references, removed generated Python bytecode caches from `src/`, and verified both stacks.

Accepted or rejected — Accepted.

Why — The source tree is easier to navigate with Python and TypeScript separated, while both toolchains still pass.
