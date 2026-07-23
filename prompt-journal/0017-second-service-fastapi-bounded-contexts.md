# Prompt Journal: The Second Service: FastAPI & Bounded Contexts

## Entry 1

Asked — Copy the attached Week 4 Day 3 "The Second Service: FastAPI & Bounded Contexts" lesson into the helper folder and start a new prompt journal.

Produced — Added `helper/week-4-day-3-second-service-fastapi-bounded-contexts.md` from the attached lesson text and started this new Week 4 Day 3 prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 4 Day 3 helper content is now available in the repo, and the FastAPI bounded contexts work has its own sequential prompt journal.

## Entry 2

Asked — Execute Task 1: Stand up bracket reference tables, seed Federal and State tax brackets, enforce 2–5 scenario limits per case (rejecting a 6th scenario insert), and define the Pydantic v2 typed boundary contract in `services/compute/app/contracts.py`.

Produced — Created `services/compute/app/contracts.py` with `CalculationRequest`, `CalculationResponse`, `ScenarioItem`, `ScenarioComparisonRequest`, `ScenarioResult`, and `ScenarioComparisonResponse` (rejecting negative income and scenario counts outside 2–5). Created `services/compute/app/db.py` with SQLite migration, 2026 Federal + State bracket seeding, and a scenario count limit check rejecting a 6th scenario insert. Added unit tests in `services/compute/tests/test_contracts.py` and `services/compute/tests/test_db.py`.

Accepted or rejected — Accepted.

Why — `uv run pytest services/compute/tests` passed 24/24 tests cleanly, proving model boundary validations and database scenario limit enforcement.

## Entry 3

Asked — Execute Task 2: Implement deterministic tax calculation logic in `services/compute/app/calc.py` and expose versioned `/v1` endpoints (`POST /v1/calculate`, `POST /v1/scenario`) in `services/compute/app/main.py` protected by the reused Module 3 JWT auth dependency `get_current_user`.

Produced — Created `services/compute/app/calc.py` computing progressive federal and state tax liabilities, effective/marginal rates, quarterly estimates, and scenario deltas vs. baseline. Updated `services/compute/app/main.py` to expose `/v1/calculate` and `/v1/scenario` protected by `Depends(get_current_user)` (returning 401 unauthenticated and 422 for invalid inputs/scenario bounds). Created unit tests in `services/compute/tests/test_calc.py` and `services/compute/tests/test_v1_endpoints.py`.

Accepted or rejected — Accepted.

Why — `uv run pytest services/compute/tests` passed 36/36 tests, verifying progressive calculation accuracy, edge cases, 401 unauthenticated guards, and 422 scenario count bounds.

## Entry 4

Asked — Execute Task 3: Publish the versioned cross-service contract in `packages/shared-schemas`, link both services to the single JSON Schema source of truth (`calculation.schema.json`), validate payloads on Express (`ajv`) and FastAPI (`jsonschema`), and implement contract-drift testing enforcing semver breaking change detection.

Produced — Created `packages/shared-schemas` holding versioned `calculation.schema.json` (v1.0.0) and `previous-calculation.schema.json` snapshot. Updated root `package.json` with `workspaces`, linked `@capstone/shared-schemas` in `apps/api/package.json` validated via `Ajv`, and updated `services/compute/pyproject.toml` validating via Python `jsonschema`. Added `apps/api/test/contract-schema.test.ts`, `apps/api/test/contract-drift.test.ts`, and `services/compute/tests/test_shared_schema.py`.

Accepted or rejected — Accepted.

Why — Vitest contract tests and Pytest `test_shared_schema.py` passed 39/39 Python tests and 8/8 JS contract tests, verifying cross-service JSON schema validation and drift detection.

## Entry 5

Asked — Execute Task 4: Wire and harden the synchronous Express -> Tax Engine HTTP client in `apps/api/src/engine/calc-client.ts` with timeouts, bounded retries (exponential backoff + jitter), 4xx/5xx handling, and Ajv schema validation.

Produced — Implemented `TaxEngineClient` and `UpstreamEngineError` in `apps/api/src/engine/calc-client.ts`. Configured per-attempt timeout (5000ms), 3 capped attempts with exponential backoff and random jitter, immediate failure on 4xx errors, retry on transient 5xx/network errors, and JSON response schema validation against `@capstone/shared-schemas` using `Ajv`. Added unit test suite in `apps/api/test/calc-client.test.ts`.

Accepted or rejected — Accepted.

Why — Vitest `calc-client.test.ts` passed 5/5 tests, verifying 3-attempt backoff with jitter on downed engine, immediate failure on 4xx, transient 503 recovery, and response schema boundary validation.




