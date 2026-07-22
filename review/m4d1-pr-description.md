# M4D1 PR Description: NoSQL, Caching & Idempotency

## Summary

Week 4 Day 1 gives TaxPulse its first polyglot backend stores. The local stack now brings up Postgres, DynamoDB Local, and Redis with one Compose command. `apps/api` projects the Plan Cycle Queue into a tenant-scoped DynamoDB single-table read model, caches hot queue reads with Redis cache-aside, and protects `POST /v1/cycles` with tenant-scoped idempotency keys and a Redis `SET NX PX` lock.

## What changed

- Added the Week 4 Day 1 local stack: Postgres 17, DynamoDB Local, and Redis.
- Added the DynamoDB Plan Cycle Queue read model in `apps/api/src/store/dynamo.ts`.
- Added Redis cache-aside with TTL, tenant invalidation, and stampede protection in `apps/api/src/store/queueCache.ts`.
- Added Redis-backed `Idempotency-Key` handling for `POST /v1/cycles` in `apps/api/src/store/idempotency.ts`.
- Documented the access patterns, keys, consistency choices, cache keys, and idempotency keys in ADR-0008.

## Verification

```text
$ docker compose up -d
Container martins-okorie-tax-liability-dynamodb-local-1 Started
Container martins-okorie-tax-liability-postgres-1 Started
Container martins-okorie-tax-liability-redis-1 Started
```

```text
$ docker compose ps
NAME                                            IMAGE                         SERVICE          STATUS                    PORTS
martins-okorie-tax-liability-dynamodb-local-1   amazon/dynamodb-local:2.5.3   dynamodb-local   Up (healthy)             8000->8000
martins-okorie-tax-liability-postgres-1         postgres:17-alpine            postgres         Up (healthy)             5433->5432
martins-okorie-tax-liability-redis-1            redis:7-alpine                redis            Up (healthy)             6379->6379
```

```text
$ redis-cli -u redis://localhost:6379 ping
PONG
```

```text
$ AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test AWS_REGION=us-east-1 \
  aws dynamodb list-tables --endpoint-url http://localhost:8000 --no-cli-pager
{
    "TableNames": []
}
```

```text
$ cd apps/api
$ node -e "require('@aws-sdk/lib-dynamodb'); require('ioredis'); console.log('store deps OK')"
store deps OK
```

```text
$ npm run typecheck
> taxpulse@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit
```

```text
$ cd apps/api
$ npm run test -- --run test/store/readModel.test.ts test/store/cacheAside.test.ts test/store/idempotency.test.ts
Test Files  3 passed (3)
Tests       9 passed (9)
```

The focused store suite proves:

- DynamoDB table creation uses `PAY_PER_REQUEST` and exactly one GSI.
- Queue, read-your-own-write cycle lookup, overdue-by-due-date, and owner queue access patterns use `QueryCommand`; no `ScanCommand` is used.
- Projection writes tenant-scoped cycle, queue, and overdue items, recomputes the `overdue` flag from `due_date`, and removes stale projection keys after a stage change.
- Redis cache-aside stores queue reads with a TTL, returns hits without another DynamoDB read, invalidates stale tenant queue data, and protects a hot miss from concurrent rebuilds.
- Three sequential creates with one tenant-scoped `Idempotency-Key` replay one response and create one row.
- Two concurrent creates with one key both replay the same `201` response, release the Redis lock, and create exactly one row.
- Distinct idempotency keys create distinct cycles, while the same key under a different tenant creates a separate row.

```text
$ npm run test -- --run test/v1-contract.test.ts test/cycle-slice.e2e.test.ts
Test Files  2 passed (2)
Tests       4 passed (4)
```

```text
$ npm run test -- --run test/openapi.test.ts test/openapi-security.test.ts
Test Files  2 passed (2)
Tests       9 passed (9)
```

```text
$ cd apps/api
$ npm run test
Test Files  20 passed (20)
Tests       70 passed (70)
```

## AI-tool reflection

I accepted Codex's suggestion to keep the Plan Cycle Queue as one tenant-scoped DynamoDB single-table read model with PK/SK plus one GSI because it maps each written access pattern to a single `QueryCommand` and avoids a scan-based owner queue. I rejected the earlier split store-file layout after checking the helper and tasks because the deliverable explicitly asks for `dynamo.ts`, `queueCache.ts`, and `idempotency.ts`; the final version folds projection keys into `dynamo.ts` and Redis helpers into `queueCache.ts`.

## Grading checklist

- [x] Access patterns are written before keys in ADR-0008.
- [x] Single-table DynamoDB layout uses PK/SK plus one GSI.
- [x] Every required read pattern is served by `QueryCommand`, never `ScanCommand`.
- [x] Projection upsert recomputes `overdue` and matches source cycle after a change.
- [x] Queue read uses Redis cache-aside with TTL, invalidation, and stampede protection.
- [x] Idempotent create replays tenant-scoped results behind a Redis `SET NX PX` lock.
- [x] Three retries and two concurrent creates produce exactly one Tax Plan Cycle.
- [x] Root Compose stack brings up Postgres, DynamoDB Local, and Redis.
- [x] Verification output and AI-tool reflection are included.
