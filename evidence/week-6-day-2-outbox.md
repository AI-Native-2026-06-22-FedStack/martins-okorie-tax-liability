# Week 6 Day 2 Task 1 — Outbox Evidence

## What Changed

- Added Drizzle outbox schema at `apps/api/src/db/schema/outbox.ts`.
- Generated forward migration `apps/api/drizzle/0003_damp_valeria_richards.sql`.
- Re-exported the outbox table from `apps/api/src/db/schema.ts`.
- Added `apps/api/src/repository/outbox.repository.ts` for transactional outbox inserts.
- Changed `apps/api/src/routes/cycle-transition.routes.ts` so the successful stage transition transaction inserts the validated stage-changed CloudEvent into `outbox`.
- Removed direct SNS publishing from the transition handler.
- Added `apps/api/src/events/outboxRelay.ts` to claim unsent rows with `FOR UPDATE SKIP LOCKED`, publish outside the DB transaction, and mark rows sent only after SNS publish confirms.
- Relay claims include a stale-claim window so a crash after claim but before publish does not strand an unsent row forever.

## Migration Smoke

```bash
DATABASE_URI=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run db:migrate
```

Result: migrations applied successfully.

```bash
psql postgresql://taxpulse_app@localhost:55433/taxpulse_l -c "\d outbox"
```

Result: `outbox` exists with `id`, `event_type`, `aggregate_type`, `aggregate_id`, serialized `payload`, `attempts`, `claimed_at`, `sent_at`, `last_error`, and `created_at`, plus ordering/aggregate indexes.

## Source Checks

```bash
rg -n "publishStageChanged|PublishCommand|sns\.send|buildStageChangedCloudEvent|insertStageChangedOutboxEvent" apps/api/src/routes/cycle-transition.routes.ts apps/api/src/events/outboxRelay.ts
```

Result: `cycle-transition.routes.ts` only builds the CloudEvent and inserts it into outbox; `PublishCommand` and `sns.send` appear only in `outboxRelay.ts`.

```bash
rg -n "FOR UPDATE SKIP LOCKED|sent_at = now\(\)|PublishCommand" apps/api/src/events/outboxRelay.ts
```

Result: relay uses `FOR UPDATE SKIP LOCKED`, publishes with `PublishCommand`, and sets `sent_at = now()` after publish confirmation.

## Tests

```bash
TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run test -- test/events/outbox.test.ts
```

Result: 4/4 outbox tests passed.

Coverage:

- Rolled-back transition-style transaction leaves no outbox row.
- Committed outbox row survives until relay startup and is published.
- Transient SNS failure leaves row unsent and retryable.
- Later relay run publishes the same unsent row and marks it sent.
- Sent rows are not claimed again.
- Stale claimed rows are eligible for a later relay run; active claims are protected by `FOR UPDATE SKIP LOCKED`.

```bash
TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run test -- test/events/stageChangedSchema.test.ts test/events/fanout.test.ts test/events/outbox.test.ts
```

Result: 12/12 focused event tests passed.

```bash
npx tsc --noEmit --module NodeNext --moduleResolution NodeNext --target ES2022 --strict --skipLibCheck apps/api/src/db/schema/outbox.ts apps/api/src/repository/outbox.repository.ts apps/api/src/events/outboxRelay.ts apps/api/test/events/outbox.test.ts
```

Result: focused TypeScript check passed.

```bash
npm run typecheck
```

Result: root TypeScript check passed.

## Relay Choice

The relay is implemented as an explicit callable batch method, `publishOutboxBatch`, rather than an always-on interval in the API process. This keeps broker publishing outside the request/transition path, makes retries deterministic in tests, and lets a later worker or script schedule the relay without changing the core outbox semantics.
