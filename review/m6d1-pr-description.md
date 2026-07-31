## Summary

Adds Week 6 Day 1 event-driven architecture for TaxPulse stage transitions: a versioned CloudEvents contract, SNS -> SQS fan-out on LocalStack, a DLQ-backed standard queue, and an idempotent Redis projection consumer.

1. **Stage-Changed CloudEvents Contract**
   - Added `packages/shared-schemas/src/events/stageChanged.ts` defining `com.taxpulse.tax-plan-cycle.stage.changed.v1` as a past-fact event.
   - The CloudEvents 1.0 envelope validates `id`, `source`, `specversion`, `type`, `time`, `subject`, `datacontenttype`, and domain `data`.
   - Exports shared parse/validate helpers so producer and consumer use the same contract.
   - Payload carries tenant id, Tax Plan Cycle id, from-stage, to-stage, actor, and change timestamp.

2. **SNS -> SQS Fan-Out on LocalStack**
   - Added `apps/api/src/events/publishStageChanged.ts` to build and validate the event before publishing once to SNS.
   - Added `apps/api/src/events/snsSqsSetup.ts` to create the SNS topic, standard SQS queue, real DLQ, redrive policy, queue policy, and subscription.
   - Hooked successful stage transitions in `cycle-transition.routes.ts` to publish the event after the committed mutation/projection/cache update.
   - Extended env config and examples for `AWS_ENDPOINT_URL`, dummy LocalStack AWS credentials, and stage-changed topic/queue/DLQ names.

3. **Idempotent Projection Consumer**
   - Added `apps/api/src/events/stageChangedConsumer.ts` to long-poll SQS, validate messages, dedupe by CloudEvents `id`, project current stage into Redis, and delete only after success.
   - Reuses the existing Module 4 Redis store for event-id dedupe and the rebuildable read-side projection.
   - Malformed messages are not deleted, allowing SQS redrive to the DLQ.

4. **LocalStack Runtime Fix**
   - Pinned `docker-compose.yml` to `localstack/localstack:3.8.1` because `latest` pulled `2026.7.1`, which exited with license activation failure.
   - Updated the LocalStack healthcheck to accept services reported as `"available"`.
   - Verified LocalStack is healthy at `http://localhost:4566` with SNS and SQS available.

5. **ADR, Evidence, and Prompt Journal**
   - Added `docs/adr/ADR-0014-event-tool-decision.md` and linked it from `docs/adr/README.md`.
   - ADR-0014 records SNS+SQS as the selected tool for this fixed fan-out flow, explains the standard queue choice, and rejects EventBridge/Kinesis here with reasons.
   - Added `evidence/week-6-day-1-event-driven-architecture.md`.
   - Added `prompt-journal/0023-event-driven-architecture.md`.

---

## Testing & Verification Output

### 1. Event Unit Tests

```text
$ npx vitest run apps/api/test/events/stageChangedSchema.test.ts apps/api/test/events/fanout.test.ts apps/api/test/events/localstackFanout.test.ts

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability

 ✓ apps/api/test/events/stageChangedSchema.test.ts  (3 tests)
 ↓ apps/api/test/events/localstackFanout.test.ts  (1 test | 1 skipped)
 ✓ apps/api/test/events/fanout.test.ts  (5 tests)

 Test Files  2 passed | 1 skipped (3)
      Tests  8 passed | 1 skipped (9)
```

### 2. Live LocalStack SNS/SQS + DLQ Test

```text
$ RUN_LOCALSTACK_EVENTS_TESTS=1 npx vitest run apps/api/test/events/localstackFanout.test.ts

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability

 ✓ apps/api/test/events/localstackFanout.test.ts  (1 test)

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

### 3. TypeScript Typecheck

```text
$ npm run typecheck

> taxpulse@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

(0 errors)
```

### 4. LocalStack Health

```text
$ docker compose ps localstack

NAME                                        IMAGE                         SERVICE      STATUS
martins-okorie-tax-liability-localstack-1   localstack/localstack:3.8.1   localstack   Up (healthy)
```

```text
$ AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test \
  aws --endpoint-url http://localhost:4566 sns list-topics --no-cli-pager

{
    "Topics": []
}
```

---

## AI-tool reflection

I accepted Codex's recommendation to keep `stage-changed` as a past-fact CloudEvents contract in `packages/shared-schemas` and to reuse the existing Redis store for both event-id dedupe and the rebuildable projection, because this keeps producer/consumer validation shared and avoids introducing a new persistence layer. I also accepted pinning LocalStack away from `latest` after the current image required license activation; pinning `3.8.1` made the local no-cost emulator deterministic for the capstone.

I rejected using EventBridge or Kinesis for this first flow. EventBridge is stronger for content-based routing, archive, and replay, but this task needs fixed fan-out to durable queues. Kinesis is better for ordered retained streams and analytics history, while this workflow is a discrete stage-transition event with a DLQ-backed consumer queue.

---

## PR routing

- **Assignees**: Self-assigned (`@martins-okorie`).
- **Reviewers**: Request `Isaiah Muli` as the ES reviewer.

---

## Deliverables checklist

- [x] **Event taxonomy + CloudEvents schema**: `stage-changed` is modeled as a past-fact event with a CloudEvents 1.0 envelope and shared zod parse/validate helpers.
- [x] **SNS -> SQS fan-out with DLQ**: Stage transitions publish one validated event to SNS; LocalStack setup creates a subscribed standard SQS queue and real DLQ with redrive policy.
- [x] **Standard queue decision**: ADR-0014 and prompt journal justify standard SQS over FIFO for this flow.
- [x] **Idempotent projection consumer**: Consumer validates before processing, dedupes by CloudEvents `id` via Redis, projects current stage once, and deletes only after success.
- [x] **LocalStack proof**: Live opt-in LocalStack test passes for valid publish-to-SQS and poison-to-DLQ behavior.
- [x] **Tool decision ADR**: ADR-0014 records SNS+SQS selected, with EventBridge and Kinesis considered and rejected here.
- [x] **Evidence and prompt journal**: Week 6 Day 1 evidence and prompt journal entries are recorded.
