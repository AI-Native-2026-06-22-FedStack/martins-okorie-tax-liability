# Prompt Journal: Event-Driven Architecture

## Entry 1

Asked — Save the attached Week 6 Day 1 "Event-Driven Architecture: SNS, SQS, EventBridge & Kinesis" helper into the repository and start a new prompt journal.

Produced — Saved `helper/week-6-day-1-event-driven-architecture-sns-sqs-eventbridge-kinesis.md` from the provided lesson text and initialized `prompt-journal/0023-event-driven-architecture.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 6 Day 1 helper lesson material is saved in the repository helper directory and prompt journal 0023 is initialized for the new event-driven architecture work.

## Entry 2

Asked — Build the Week 6 Day 1 event-driven stage-changed deliverable using LocalStack, SNS/SQS, CloudEvents validation in shared schemas, the existing Redis idempotency store, ADR documentation, evidence, and prompt-journal tracking.

Produced — Added a shared zod CloudEvents 1.0 schema for `com.taxpulse.tax-plan-cycle.stage.changed.v1`, added SNS/SQS LocalStack setup, publishing, and SQS consumer modules under `apps/api/src/events`, extended env examples and API config for LocalStack topic/queue names, hooked best-effort stage-changed publishing into successful workflow transitions, added focused event tests, recorded ADR-0014 and evidence, and installed the missing SNS/SQS AWS SDK clients.

Accepted or rejected — Accepted.

Why — Focused event tests passed 7/7, the root TypeScript check passed, and the focused TypeScript check for the new eventing files passed; live LocalStack smoke was documented as blocked because Docker/localhost:4566 was unreachable from this shell.

## Entry 3

Asked — Refactor Task 1 if needed so the stage-changed schema clearly defines a past-fact CloudEvents 1.0 envelope, exports parse/validate helpers, is versioned and documented, and has ADR-0014 begun.

Produced — Added `stageChangedSchemaVersion`, documented the stage-changed fact in the shared schema file, exported `parseStageChangedCloudEvent` and `validateStageChangedCloudEvent`, updated schema tests to use the shared parse/validate helpers, and expanded ADR-0014 with the schema location, version, payload fields, and dedupe meaning of CloudEvents `id`.

Accepted or rejected — Accepted.

Why — The focused stage-changed schema test passed, confirming valid envelopes parse and malformed or command-shaped envelopes are rejected by the shared contract.

## Entry 4

Asked — Refactor Task 2 if needed so a successful stage transition publishes a validated stage-changed CloudEvent once to SNS, fans out through an SQS queue on LocalStack with a real DLQ, proves fan-out and DLQ behavior, and records the standard-vs-FIFO choice.

Produced — Updated the publisher to use the shared Task 1 parse helper before `PublishCommand`, made the SNS/SQS setup explicitly use a standard queue, added a real queue policy allowing the SNS topic to send to SQS, kept redrive pointed at a created DLQ, added an opt-in LocalStack integration test for publish-to-queue and poison-to-DLQ behavior, and documented verification in evidence.

Accepted or rejected — Accepted.

Why — Fast SNS/SQS fan-out tests passed 4/4 and focused TypeScript checks passed; standard SQS was chosen because stage-changed fan-out needs durable at-least-once delivery and independent consumer backlogs more than strict FIFO ordering, with Task 3 deduping by CloudEvents `id`. The live LocalStack proof is implemented but could not pass here because `localhost:4566` was not listening.

## Entry 5

Asked — Resolve LocalStack so the environment can reach `http://localhost:4566` and the live SNS/SQS fan-out proof can run.

Produced — Diagnosed Docker as pointing at a stopped Colima runtime, started Colima, found `localstack/localstack:latest` was pulling `2026.7.1` and exiting with license activation failure, pinned Docker Compose to `localstack/localstack:3.8.1`, updated the healthcheck to accept LocalStack's `"available"` service status, recreated LocalStack, verified AWS CLI connectivity to SNS, and reran the live LocalStack fan-out/DLQ test.

Accepted or rejected — Accepted.

Why — `docker compose ps localstack` reports healthy, `aws --endpoint-url http://localhost:4566 sns list-topics` succeeds, and `RUN_LOCALSTACK_EVENTS_TESTS=1 npx vitest run apps/api/test/events/localstackFanout.test.ts` passes 1/1.

## Entry 6

Asked — Refactor Task 3 so the SQS consumer validates stage-changed events, projects them into a read model idempotently using the Module 4 store, deletes only after success, proves replay dedupe, and finishes ADR-0014.

Produced — Added the default Redis current-stage projection in `stageChangedConsumer.ts`, keyed by tenant and Tax Plan Cycle id; reused the existing Redis store for both CloudEvents-id dedupe and projection storage; updated consumer tests to prove malformed messages are rejected before projection, successful messages are deleted after projection, and duplicate deliveries project exactly once; expanded ADR-0014 with projection shape, delete-on-success behavior, and EventBridge/Kinesis rejection details.

Accepted or rejected — Accepted.

Why — Event consumer tests passed with replay dedupe coverage, the focused TypeScript check passed, root typecheck passed, and the live LocalStack fan-out/DLQ test remained green.

## Entry 7

Asked — Create a PR description for the current Week 6 Day 1 event-driven architecture branch.

Produced — Added `review/m6d1-pr-description.md` summarizing the CloudEvents schema, SNS/SQS fan-out, LocalStack fix, idempotent projection consumer, ADR/evidence updates, verification output, AI-tool reflection, PR routing, and deliverables checklist.

Accepted or rejected — Accepted.

Why — The PR description reflects the actual branch changes and cites the passing event tests, live LocalStack proof, and root typecheck.
