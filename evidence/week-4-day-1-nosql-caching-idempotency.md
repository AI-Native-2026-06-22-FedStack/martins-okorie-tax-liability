# Week 4 Day 1 Verification: NoSQL, Caching & Idempotency

## Local Stack

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

## Test Evidence

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

The focused suite proves:

- DynamoDB table creation uses `PAY_PER_REQUEST` and exactly one GSI.
- Queue, read-your-own-write cycle lookup, overdue-by-due-date, and owner queue access patterns use `QueryCommand`; no `ScanCommand` is used.
- Projection writes tenant-scoped cycle, queue, and overdue items, recomputes the `overdue` flag from `due_date`, and removes stale projection keys after a stage change.
- Redis cache-aside stores queue reads, invalidates stale tenant queue data, and protects a hot miss from concurrent rebuilds.
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
