# Prompt Journal: Reliable Eventing

## Entry 1

Asked — Save the attached Week 6 Day 2 "Reliable Eventing: Outbox, Sagas, DLQs & Idempotency" helper into the repository and create a new prompt journal.

Produced — Saved `helper/week-6-day-2-reliable-eventing-outbox-sagas-dlqs-idempotency.md` from the provided lesson text and initialized `prompt-journal/0024-reliable-eventing.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 6 Day 2 reliable eventing helper lesson material is saved in the repository helper directory and prompt journal 0024 is initialized for the new reliable eventing work.

## Entry 2

Asked — Verify the Week 6 Day 2 reliable eventing prerequisites and environment before building the outbox, saga, DLQ/redrive, and end-to-end idempotency tasks.

Produced — Started Postgres, Redis, and LocalStack; verified Node 24, npm, LocalStack SQS, Redis, SNS/SQS SDKs, and ioredis; diagnosed a host port conflict where local Postgres already owned `localhost:5433`; moved Compose Postgres host access to `55433` in active local env examples and compose config; applied existing Drizzle migrations successfully; confirmed outbox/action item tables are not present yet because they belong to the upcoming tasks; recorded the smoke results in `evidence/week-6-day-2-reliable-eventing-prereqs.md`.

Accepted or rejected — Accepted.

Why — The prerequisite smoke now passes: Compose services are healthy, Drizzle migrations apply against `localhost:55433`, LocalStack SQS and Redis are reachable, focused event tests pass 8/8, and root typecheck passes.

## Entry 3

Asked — Implement Task 1 by fixing the stage-changed dual write with the Outbox pattern: add an outbox migration, write the event row in the same transition transaction, remove direct SNS publish from the handler, add a `FOR UPDATE SKIP LOCKED` relay, and prove atomicity/retry behavior.

Produced — Added `apps/api/src/db/schema/outbox.ts`, generated `apps/api/drizzle/0003_damp_valeria_richards.sql`, added a transactional outbox repository, changed the transition route to insert the validated stage-changed CloudEvent into outbox inside the stage-change transaction, added `apps/api/src/events/outboxRelay.ts`, and added `apps/api/test/events/outbox.test.ts`. The relay is a callable batch method rather than an always-on interval so broker publishing stays outside the request path and can later be scheduled by a worker or script without changing semantics.

Accepted or rejected — Accepted.

Why — The outbox migration applied successfully, source checks confirmed the transition handler no longer publishes to SNS and the relay uses `FOR UPDATE SKIP LOCKED`, outbox tests passed 4/4, the focused event suite passed 12/12, focused TypeScript checks passed, and root typecheck passed.

## Entry 4

Asked — Implement Task 2 by modeling present-to-client as a saga with an `action_item` forward migration, a present-to-client CloudEvent emitted through outbox, and an idempotent compensation that reverts the cycle to Review and records the audit reversal when action-item creation fails.

Produced — Added the `action_item` Drizzle schema and migration, added the shared `presented-to-client` CloudEvents schema, added an orchestrated `presentToClientSaga` under `apps/api/src/events/`, extended the outbox repository for the new event, and covered the success and compensation paths with `apps/api/test/events/saga.test.ts`. Chose orchestration because this flow has a small ordered set of local transactions, one explicit compensation, and no need for distributed event choreography or Step Functions in this module.

Accepted or rejected — Accepted.

Why — The migration applied successfully, `action_item` exists in Postgres, the saga test passed both success and failure paths, compensation is safe to retry without a duplicate audit line, the focused reliability suite passed 6/6, and root typecheck passed.

## Entry 5

Asked — Make the stage-changed queue resilient under poison messages and make the projection consumer safe under redelivery by using DLQ redrive, DLQ depth alerting, redrive support, and a Module 4 idempotency check-and-claim on the end-to-end event id.

Produced — Kept the source queue redrive policy pointed at a real DLQ with `maxReceiveCount` set to 3, added a guard against first-receive dead-lettering, added DLQ depth alerting and manual redrive helpers, and hardened the stage-changed consumer to claim `event.id` with one Redis `SET ... EX ... NX` before projection. The consumer now treats the CloudEvents id as the end-to-end idempotency key, deletes only after success or confirmed DLQ handoff, and preserves a bounded `FailureReason` attribute when it copies a final-retry poison message to the DLQ.

Accepted or rejected — Accepted.

Why — Focused event tests passed 11/11, the LocalStack fan-out test proved a poison payload reaches the DLQ after repeated receives, root typecheck passed, and the replay test delivered the same event three times with one projection effect.
