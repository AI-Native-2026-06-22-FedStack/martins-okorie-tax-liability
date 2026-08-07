# Week 6 Day 2 — Reliable Eventing Prerequisite Smoke

## Runtime Versions

```bash
node --version
```

Result: `v24.17.0`

```bash
npm --version
```

Result: `11.13.0`

## Compose Services

```bash
docker compose up -d postgres redis localstack
docker compose ps
```

Result: Postgres, Redis, and LocalStack are healthy.

LocalStack is pinned to `localstack/localstack:3.8.1` and reachable at `http://localhost:4566`.

## Postgres Port Fix

The machine already had a local Homebrew/PostgreSQL process listening on `localhost:5433`, so host tools were reaching the wrong database and failing with `role "taxpulse_app" does not exist`.

Fix: moved the Compose Postgres host port from `5433` to `55433` in active local-development config:

- `docker-compose.yml`
- `.env.example`
- `apps/api/.env.example`

## Migration Smoke

```bash
psql postgresql://taxpulse_app@localhost:55433/taxpulse_l -c "select current_database(), current_user;"
```

Result: connected to `taxpulse_l` as `taxpulse_app`.

```bash
DATABASE_URI=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run db:migrate
```

Result: existing Drizzle migrations applied successfully.

```bash
psql postgresql://taxpulse_app@localhost:55433/taxpulse_l -c "\dt public.*" -c "\dt drizzle.*"
```

Result: existing public tables and `drizzle.__drizzle_migrations` are present.

Current expected gap before Week 6 Day 2 implementation: `outbox` and `action_item` do not exist yet. They should be added by the upcoming forward migrations for Task 1 and Task 2.

## LocalStack and Module 4 Store

```bash
AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test aws --endpoint-url http://localhost:4566 sqs create-queue --queue-name tp-smoke-dlq --no-cli-pager
```

Result: SQS queue created in LocalStack.

```bash
docker compose exec redis redis-cli ping
```

Result: `PONG`

```bash
node -e "require('@aws-sdk/client-sns'); require('@aws-sdk/client-sqs'); require('ioredis'); console.log('reliability deps OK')"
```

Result: `reliability deps OK`

## API Smoke

```bash
TAXPULSE_TEST_DATABASE_URL=postgresql://taxpulse_app@localhost:55433/taxpulse_l npm --workspace apps/api run test -- test/events/stageChangedSchema.test.ts test/events/fanout.test.ts
```

Result: 8/8 focused API event tests passed.

```bash
npm run typecheck
```

Result: TypeScript root typecheck passed.
