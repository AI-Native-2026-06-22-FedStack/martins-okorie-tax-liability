# Prompt Journal: Contract Testing with Pact

## Entry 1

Asked — Save the attached Week 4 Day 4 "Contract Testing with Pact" lesson into the helper folder and start a new prompt journal.

Produced — Added `helper/week-4-day-4-contract-testing-with-pact.md` from the attached lesson text and started `prompt-journal/0018-contract-testing-with-pact.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 4 Day 4 helper lesson material is saved in the repository helper directory and prompt journal 0018 is initialized for Week 4 Day 4 work.

## Entry 2

Asked — Execute Task 1: Record ADR-0010 (MADR format) capturing consumer-driven contract strategy for the internal Express → FastAPI pair and classifying third-party APIs as deliberately non-Pact-tested. Write Pact JS v13 consumer test driving the real calculation client to generate `pacts/taxpulse-api-compute-engine.json` and publish to local broker.

Produced — Created `docs/adr/ADR-0010-contract-testing-strategy.md` (linked in `docs/adr/README.md`). Created `apps/api/pact/calculation.consumer.pact.test.ts` driving real `TaxEngineClient` against PactV4 mock server covering `POST /v1/calculate` and `POST /v1/scenario` shapes. Added `apps/api/pact/publish-pacts.ts` for Pact Broker publishing.

Accepted or rejected — Accepted.

Why — Vitest `calculation.consumer.pact.test.ts` passed 2/2 tests cleanly, generating `pacts/taxpulse-api-compute-engine.json` capturing only fields read by the consumer.

## Entry 3

Asked — Execute Task 2: Implement provider verification in `services/compute/tests/test_calculation_pact_provider.py` replaying consumer pact interactions against the real running FastAPI engine. Prove that a breaking schema change (missing/renamed required field) fails verification and exits non-zero, while a compatible optional-field addition passes.

Produced — Added `services/compute/tests/test_calculation_pact_provider.py` spinning up a real FastAPI Uvicorn test server on `localhost:8989`, replaying single-calculation (`POST /v1/calculate`) and scenario (`POST /v1/scenario`) interactions against the running service, verifying both pact-python `Verifier` integration and explicit breaking change failure vs compatible change pass behaviors. Added `@app.get("/health")` route to `app/main.py`.

Accepted or rejected — Accepted.

Why — Pytest passed 47/47 tests cleanly, verifying that provider verification runs against the real running FastAPI service, fails non-zero on a breaking schema bump, and passes on an added optional field.

## Entry 4

Asked — Execute Task 3: Wire and prove the integrated modeling -> calc slice in `apps/api/src/modeling/store-figures.ts` and `apps/api/test/modeling-calc.e2e.test.ts`. Call calculation engine over `TaxEngineClient` on Modeling-stage cases, store figures for subsequent reads, handle calculation outages cleanly with 502-class Problem Details errors (leaving case stored state unchanged), and report slice coverage exceeding ≥70% line / ≥60% branch.

Produced — Created `apps/api/src/modeling/store-figures.ts` and `apps/api/test/modeling-calc.e2e.test.ts`. Configured auth, stage guardrails (`Modeling` stage), hardened engine client call, stored figures repository, and 502 Bad Gateway `ProblemDetailsError` handling leaving stored state unchanged. Updated `vitest.config.ts` to measure coverage on the slice under test.

Accepted or rejected — Accepted.

Why — Vitest e2e tests passed 4/4 tests cleanly and reported 99.06% line / 90.9% branch coverage on `calc-client.ts` and 96.34% line / 84.61% branch coverage on `store-figures.ts`, far exceeding the ≥70% line / ≥60% branch quality gate.



