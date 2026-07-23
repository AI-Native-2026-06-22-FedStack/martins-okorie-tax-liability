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

