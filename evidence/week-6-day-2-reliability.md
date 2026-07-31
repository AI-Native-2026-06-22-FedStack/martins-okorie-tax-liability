# Week 6 Day 2 Task 3 Evidence: DLQ, Redrive, and Idempotent Projection

## Queue Resilience

- `setupStageChangedFanout` creates the SNS topic, source SQS queue, and real DLQ.
- The redrive policy is attached to the source queue and points at the DLQ ARN.
- `maxReceiveCount` is `3`, deliberately greater than one so transient failures are retried before dead-lettering.
- `alertOnStageChangedDlqDepth` logs `DLQ_DEPTH_ALERT` to stdout when DLQ depth is greater than zero.
- `redriveStageChangedDlq` receives DLQ messages, sends the original body and message attributes back to the source queue, then deletes the DLQ copy after the send succeeds.

## Projection Idempotency

- The consumer uses the CloudEvents `id` as the end-to-end idempotency key.
- The Module 4 Redis store is reused with one atomic claim:

```text
SET event-dedupe:stage-changed:<tenant_id>:<event_id> 1 EX 86400 NX
```

- Projection happens only after the claim succeeds.
- Duplicate deliveries are deleted without projecting.
- Failed processing releases the claim so the source queue can retry and eventually DLQ.

## Verification

```text
TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run test -- test/events/fanout.test.ts test/events/stageChangedSchema.test.ts
Test Files  2 passed (2)
Tests       11 passed (11)
```

Covered:

- Source queue redrive policy points to a real DLQ.
- `maxReceiveCount` cannot be `1`.
- The same event delivered three times produces one projection write.
- DLQ depth alert logs to stdout.
- Redrive moves a DLQ payload back to the source queue.
- A final-retry poison message preserves the original payload plus `FailureReason`.

```text
TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l RUN_LOCALSTACK_EVENTS_TESTS=1 npm --workspace apps/api run test -- test/events/localstackFanout.test.ts
Test Files  1 passed (1)
Tests       1 passed (1)
```

Covered:

- LocalStack SNS publishes to SQS.
- A poison message is received repeatedly without deletion and reaches the real DLQ.

```text
npm run typecheck
tsc -p tsconfig.json --noEmit
```
