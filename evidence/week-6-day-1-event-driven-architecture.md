# Week 6 Day 1 — Event-Driven Architecture Evidence

## LocalStack reachability

- `docker compose ps`
  - Initial result: Failed because Docker was pointed at the `colima` context while Colima was not running.
  - Fix: Started Colima with `colima start`.
- `curl -s http://localhost:4566/_localstack/health`
  - Initial result: Failed to connect.
  - Fix: Pinned LocalStack to `localstack/localstack:3.8.1`; `localstack/localstack:latest` pulled `2026.7.1`, which exited with code 55 because it required a LocalStack auth token.
- `AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 sns list-topics --no-cli-pager`
  - Result after fix: Passed and returned an empty `Topics` list.

Conclusion: LocalStack is reachable at `http://localhost:4566` with SNS and SQS available. Docker Compose now pins the community image and the healthcheck accepts LocalStack's `"available"` service status.

## Verification Commands

```bash
npx vitest run apps/api/test/events/stageChangedSchema.test.ts apps/api/test/events/fanout.test.ts
```

Result: Passed 7/7 focused event tests.

```bash
npx vitest run apps/api/test/events/fanout.test.ts apps/api/test/events/localstackFanout.test.ts
```

Result: Passed the fast SNS/SQS fan-out tests 4/4; the LocalStack integration test was skipped because `RUN_LOCALSTACK_EVENTS_TESTS` was not set.

```bash
RUN_LOCALSTACK_EVENTS_TESTS=1 npx vitest run apps/api/test/events/localstackFanout.test.ts
```

Initial result: Failed before LocalStack was fixed. Final result after starting Colima, pinning LocalStack to `3.8.1`, and updating the healthcheck: Passed 1/1 live LocalStack integration test.

```bash
npx tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --strict --skipLibCheck apps/api/src/events/publishStageChanged.ts apps/api/src/events/snsSqsSetup.ts apps/api/src/events/stageChangedConsumer.ts apps/api/test/events/stageChangedSchema.test.ts apps/api/test/events/fanout.test.ts packages/shared-schemas/src/events/stageChanged.ts
```

Result: Passed focused TypeScript check for the new eventing files.

```bash
npm run typecheck
```

Result: Passed root TypeScript check.

```bash
npm run test -- test/events/stageChangedSchema.test.ts test/events/fanout.test.ts
```

Result: Blocked in `apps/api` because the API Vitest config starts Testcontainers Postgres before collecting tests, and Docker was unavailable in this shell.

## What Was Verified

- Valid stage-changed CloudEvents 1.0 envelopes are accepted.
- Missing required CloudEvents fields are rejected.
- Command-shaped event types are rejected.
- SNS setup creates a topic, SQS queue, SQS DLQ, subscription, and redrive policy.
- SNS setup uses a standard SQS queue and configures an SQS policy allowing the SNS topic to send messages.
- Publisher sends the validated CloudEvent to the configured SNS topic ARN.
- Consumer deletes successfully processed messages.
- Consumer validates each message before dedupe/projection.
- Consumer dedupes replayed events by CloudEvents `id` through the existing Redis store.
- Consumer projects stage-changed into a Redis current-stage read model exactly once under a tenant-and-cycle scoped key.
- Consumer leaves malformed poison messages undeleted so SQS can redrive them to the DLQ.

## Opt-In LocalStack Test

`apps/api/test/events/localstackFanout.test.ts` is an executable LocalStack proof guarded by `RUN_LOCALSTACK_EVENTS_TESTS=1`. When LocalStack is reachable, it creates a unique SNS topic, standard SQS queue, and real DLQ; publishes one valid stage-changed CloudEvent and receives it from SQS; then sends a malformed message, receives it three times without deleting it, and confirms it appears in the DLQ.
