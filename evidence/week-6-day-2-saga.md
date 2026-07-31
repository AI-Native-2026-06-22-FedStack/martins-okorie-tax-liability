# Week 6 Day 2 Task 2 Evidence: Present-To-Client Saga

## Scope

- Added `action_item` as a Drizzle forward migration in `apps/api/drizzle/0004_tranquil_next_avengers.sql`.
- Added the versioned `presented-to-client` CloudEvents schema in `packages/shared-schemas/src/events/presentToClient.ts`.
- Added an orchestrated saga in `apps/api/src/events/presentToClientSaga.ts`.
- Extended the outbox repository so the present-to-client event is emitted through the same reliable outbox path as `stage-changed`.

## Saga Decision

TaxPulse uses orchestration for this flow. A coordinator drives the ordered local transactions because the flow is small, the failure point is known, and the compensation is explicit: advance the cycle to `Client Approval`, then create action items and insert the outbox event. If action-item creation fails, the coordinator performs a new offsetting action that returns the cycle to `Review` and records the compensation in the audit trail.

## Local Verification

```text
DATABASE_URI=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run db:migrate
[✓] migrations applied successfully!
```

```text
psql postgresql://taxpulse_app@localhost:55433/taxpulse_l -c '\d action_item'
Table "public.action_item"
id uuid primary key default gen_random_uuid()
tenant_id uuid not null
case_id uuid not null
description text not null
deadline date not null
completed boolean not null default false
```

```text
TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run test -- test/events/saga.test.ts
Test Files  1 passed (1)
Tests       2 passed (2)
```

```text
TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run test -- test/events/saga.test.ts test/events/outbox.test.ts
Test Files  2 passed (2)
Tests       6 passed (6)
```

```text
npm run typecheck
tsc -p tsconfig.json --noEmit
```
