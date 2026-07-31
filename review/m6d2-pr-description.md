## Summary

Adds Week 6 Day 2 reliable eventing for TaxPulse stage transitions and client presentation flows: a transactional outbox, relay-based SNS publishing, an orchestrated present-to-client saga with compensation, and DLQ/idempotency hardening for the SQS projection consumer.

1. **Transactional Outbox + Relay**
   - Added `apps/api/src/db/schema/outbox.ts` and Drizzle forward migration `apps/api/drizzle/0003_damp_valeria_richards.sql`.
   - Changed the stage-transition route to insert the validated `stage-changed` CloudEvent into `outbox` inside the same transaction as the stage update, stage transition log, and audit entry.
   - Removed direct SNS publishing from the transition handler.
   - Added `apps/api/src/events/outboxRelay.ts`, which claims unsent rows with `FOR UPDATE SKIP LOCKED`, publishes to SNS outside the DB transaction, and marks rows sent only after publish confirmation.
   - Relay failures leave rows unsent and retryable with backoff.

2. **Present-To-Client Saga + Compensation**
   - Added `apps/api/src/db/schema/actionItem.ts` and Drizzle forward migration `apps/api/drizzle/0004_tranquil_next_avengers.sql`.
   - Added `packages/shared-schemas/src/events/presentToClient.ts` defining the versioned `com.taxpulse.tax-plan-cycle.presented-to-client.v1` CloudEvents contract.
   - Added `apps/api/src/events/presentToClientSaga.ts` as an orchestrated saga.
   - Success path advances a cycle from `Review` to `Client Approval`, creates action items, and writes the `presented-to-client` event through the outbox.
   - Failure path compensates with a new offsetting action back to `Review`, records the reversal in the audit trail, and is idempotent under compensation retry.

3. **DLQ, Redrive, and Idempotent Projection**
   - Extended `apps/api/src/events/snsSqsSetup.ts` with a source-queue redrive policy to a real DLQ, `maxReceiveCount = 3`, a guard against first-receive dead-lettering, DLQ depth alerting, and a redrive helper.
   - Hardened `apps/api/src/events/stageChangedConsumer.ts` to use the CloudEvents `id` as the end-to-end idempotency key.
   - Reuses the Module 4 Redis store with one atomic `SET ... EX ... NX` check-and-claim before projection.
   - Duplicate deliveries are deleted without projection; failed messages are left for retry and can be handed to the DLQ with the original payload plus a bounded `FailureReason`.

4. **Environment and Evidence**
   - Updated local development Postgres host port examples to `55433` to avoid the machine’s existing local Postgres on `5433`.
   - Added Week 6 Day 2 evidence files for prerequisites, outbox, saga, and reliability.
   - Added `prompt-journal/0024-reliable-eventing.md` with the orchestration, queue, and idempotency decisions.

---

## Testing & Verification Output

### 1. TypeScript Typecheck

```text
$ npm run typecheck

> taxpulse@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

(0 errors)
```

### 2. Focused Reliable Eventing Suite

```text
$ TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l \
  npm --workspace apps/api run test -- \
  test/events/outbox.test.ts \
  test/events/saga.test.ts \
  test/events/fanout.test.ts \
  test/events/stageChangedSchema.test.ts

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api

 ✓ test/events/fanout.test.ts  (8 tests)
 ✓ test/events/outbox.test.ts  (4 tests)
 ✓ test/events/saga.test.ts  (2 tests)
 ✓ test/events/stageChangedSchema.test.ts  (3 tests)

 Test Files  4 passed (4)
      Tests  17 passed (17)
```

### 3. Live LocalStack SNS/SQS + DLQ Test

```text
$ TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l \
  RUN_LOCALSTACK_EVENTS_TESTS=1 \
  npm --workspace apps/api run test -- test/events/localstackFanout.test.ts

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api

 ✓ test/events/localstackFanout.test.ts  (1 test)

 Test Files  1 passed (1)
      Tests  1 passed (1)
```

### 4. Postgres Migration Shape

```text
$ psql postgresql://taxpulse_app@localhost:55433/taxpulse_l -c '\d outbox' -c '\d action_item'

Table "public.outbox"
id uuid primary key
event_type text not null
aggregate_type text not null
aggregate_id uuid not null
payload jsonb not null
attempts integer not null default 0
claimed_at timestamp with time zone
sent_at timestamp with time zone
last_error text
created_at timestamp with time zone not null default now()

Table "public.action_item"
id uuid primary key default gen_random_uuid()
tenant_id uuid not null
case_id uuid not null
description text not null
deadline date not null
completed boolean not null default false
created_at timestamp with time zone not null default now()
updated_at timestamp with time zone not null default now()
```

---

## AI-tool reflection

I accepted Codex's recommendation to replace direct broker publishing with a transactional outbox and a relay, because it closes the dual-write crash gap while keeping SNS calls outside the database transaction. I also accepted an orchestrated saga for present-to-client because the flow has a small ordered set of local transactions and one explicit compensation; choreography would add event indirection without useful decoupling in this sprint.

I kept the SQS queue standard instead of FIFO. Standard SQS matches this at-least-once projection flow and intentionally forces idempotent consumer behavior. FIFO ordering is not required for the current-stage projection and would trade off throughput for ordering guarantees this flow does not need.

---

## PR routing

- **Assignees**: Self-assigned (`@martins-okorie`).
- **Reviewers**: Request `Isaiah Muli` as the ES reviewer.

---

## Deliverables checklist

- [x] **Outbox atomicity + relay**: `outbox` is a Drizzle forward migration; stage transitions write the event row in the same transaction as the stage change; rolled-back transitions leave no outbox row; the relay uses `FOR UPDATE SKIP LOCKED`, publishes to SNS, marks sent only after confirmation, and retries transient failures.
- [x] **No direct publish in handler**: Stage-transition handling writes to outbox only; SNS publishing is isolated to the relay/publisher utilities.
- [x] **Saga + compensation**: `action_item` is a Drizzle forward migration; present-to-client emits a CloudEvent through outbox; action-item failure compensates back to `Review`, records audit, and is idempotent.
- [x] **Saga style justified**: Prompt journal records orchestration as the selected style with reasons.
- [x] **DLQ + alert + redrive**: Source queue redrive policy points at a real DLQ with `maxReceiveCount = 3`; DLQ depth logs an alert; redrive moves held messages back to the source queue.
- [x] **End-to-end idempotency**: Consumer dedupes on the CloudEvents `id` using the Module 4 Redis store with one atomic `SET ... EX ... NX` before projection, so three duplicate deliveries produce one projection effect.
- [x] **Evidence and prompt journal**: Week 6 Day 2 evidence files and `prompt-journal/0024-reliable-eventing.md` are recorded.
