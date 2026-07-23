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

