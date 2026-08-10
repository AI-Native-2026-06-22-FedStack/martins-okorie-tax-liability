# Week 7 Day 2 Evidence: Docker Compose & floci

## Bootstrap Smoke

Command:

```sh
docker compose version
make --version
docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E 'taxpulse-api|taxpulse-compute|apps/api|services/compute'
```

Observed:

```text
Docker Compose version 5.1.1
GNU Make 3.81
taxpulse-api:w7d1 abdc5c722f1d
taxpulse-compute:w7d1 fbaa420625b8
```

## Compose Config

Command:

```sh
docker compose config
docker compose --profile brownfield config
```

Observed:

- Default config includes `api`, `compute`, `postgres`, `redis`, and `floci`.
- Default config does not include `tivs-acl`.
- Brownfield profile config includes `tivs-acl` with `profiles: ["brownfield"]`.
- `api` and `compute` use local `taxpulse-api:w7d1` and `taxpulse-compute:w7d1` images with `pull_policy: never`.
- Core service dependencies use `condition: service_healthy`.

## make up

Command:

```sh
make up
```

Observed:

```text
secret exists: taxpulse/local/db-password
secret exists: taxpulse/local/jwt-signing-keys
INSERT 0 2
INSERT 0 2
TaxPulse local seed complete.
Container martins-okorie-tax-liability-api-1 Started
```

## Running Services

Command:

```sh
docker compose ps
```

Observed:

```text
martins-okorie-tax-liability-api-1        taxpulse-api:w7d1           Up (healthy)   0.0.0.0:3000->3000/tcp
martins-okorie-tax-liability-compute-1    taxpulse-compute:w7d1       Up (healthy)   0.0.0.0:8001->8000/tcp
martins-okorie-tax-liability-floci-1      floci/floci:latest-compat   Up (healthy)   0.0.0.0:4566->4566/tcp
martins-okorie-tax-liability-postgres-1   postgres:17.6-alpine        Up (healthy)   0.0.0.0:55433->5432/tcp
martins-okorie-tax-liability-redis-1      redis:7.4.5-alpine          Up (healthy)   0.0.0.0:6379->6379/tcp
```

## floci Call

Command:

```sh
docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sts get-caller-identity
```

Observed:

```json
{
  "UserId": "000000000000",
  "Account": "000000000000",
  "Arn": "arn:aws:iam::000000000000:root"
}
```

## Idempotent Re-seed

Command:

```sh
make seed
docker compose exec -T postgres psql -U taxpulse_app -d taxpulse_l -c "select count(*) as tenants from tenant; select count(*) as cycles from tax_plan_cycle;"
```

Observed:

```text
secret exists: taxpulse/local/db-password
secret exists: taxpulse/local/jwt-signing-keys
INSERT 0 2
INSERT 0 2
TaxPulse local seed complete.

 tenants
---------
       2

 cycles
--------
      2
```

## Notes

- `floci/floci:1.5.11-compat` was not available from Docker Hub during verification, so the stack uses Floci's documented `latest-compat` image.
- Docker emitted an Apple Silicon warning for the Week 7 Day 1 local images because they were built as `linux/amd64`; the containers still started and reported healthy.

## Task 1 Acceptance Pass

Command:

```sh
docker compose config
docker compose ps
docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E 'taxpulse-api|taxpulse-compute|postgres|redis|floci'
docker run --rm --network martins-okorie-tax-liability_taxpulse-local curlimages/curl:8.16.0 -fsS http://api:3000/ready
```

Observed:

```text
docker compose config parsed successfully.
api        taxpulse-api:w7d1           Up (healthy)   0.0.0.0:3000->3000/tcp
compute    taxpulse-compute:w7d1       Up (healthy)   0.0.0.0:8001->8000/tcp
floci      floci/floci:latest-compat   Up (healthy)   0.0.0.0:4566->4566/tcp
postgres   postgres:17.6-alpine        Up (healthy)   0.0.0.0:55433->5432/tcp
redis      redis:7.4.5-alpine          Up (healthy)   0.0.0.0:6379->6379/tcp

taxpulse-api:w7d1 abdc5c722f1d
taxpulse-compute:w7d1 fbaa420625b8
postgres:17.6-alpine ef257d85f76e
redis:7.4.5-alpine bb186d083732
floci/floci:latest-compat 15ba10dace4a

{"database":"ok","service":"taxpulse-api","status":"ready"}
```

Task 1 result:

- The API and compute services use the Week 7 Day 1 local image tags, not `latest` and not Compose rebuilds.
- Postgres and Redis use official pinned images.
- Cross-service configuration uses `postgres`, `redis`, `compute`, and `floci` service names.
- API `/ready` proves database access through the Compose network.
- Published ports are limited to the developer-facing API, compute, floci, Postgres, and Redis ports.

## Task 2 Acceptance Pass

Command:

```sh
rg -n "sleep|profiles:|depends_on|condition: service_healthy|healthcheck|start_period|pg_isready" docker-compose.yml
docker compose down
make up
docker compose down
make up
docker compose ps
docker compose ps --services
docker compose logs --tail=60 compute
docker compose --profile brownfield up -d tivs-acl
docker compose --profile brownfield ps tivs-acl
docker compose --profile brownfield exec -T tivs-acl node -e "fetch('http://127.0.0.1:4300/health').then(r=>r.text()).then(t=>console.log(t))"
```

Observed dependency ordering on both startup cycles:

```text
Container martins-okorie-tax-liability-postgres-1 Waiting
Container martins-okorie-tax-liability-postgres-1 Healthy
Container martins-okorie-tax-liability-compute-1 Starting
Container martins-okorie-tax-liability-compute-1 Started

Container martins-okorie-tax-liability-postgres-1 Healthy
Container martins-okorie-tax-liability-floci-1 Healthy
Container martins-okorie-tax-liability-redis-1 Healthy
Container martins-okorie-tax-liability-compute-1 Healthy
Container martins-okorie-tax-liability-api-1 Starting
Container martins-okorie-tax-liability-api-1 Started
```

Plain core service set:

```text
api
compute
floci
postgres
redis
```

Compute log after repeated startup:

```text
INFO:     Started server process [1]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
INFO:     Uvicorn running on http://0.0.0.0:8000 (Press CTRL+C to quit)
INFO:     127.0.0.1:46030 - "GET /health HTTP/1.1" 200 OK
```

Brownfield profile:

```text
martins-okorie-tax-liability-tivs-acl-1   node:24.17.0-trixie-slim   Up (healthy)   0.0.0.0:4300->4300/tcp
{"service":"tivs-acl","status":"ok"}
```

Task 2 result:

- `postgres`, `redis`, `floci`, and `tivs-acl` have concrete readiness healthchecks with `start_period`.
- `compute` uses long-form `depends_on` with `postgres: condition: service_healthy`.
- `api` uses long-form `depends_on` with `compute`, `floci`, `postgres`, and `redis` all gated on `service_healthy`.
- No `sleep` appears in `docker-compose.yml`.
- Core services have no `profiles` key; only `tivs-acl` is gated by `profiles: ["brownfield"]`.
- Repeated `make up` cycles showed Postgres becoming healthy before compute starts and no Tax Engine crash-loop.

## Task 3 Acceptance Pass

Command:

```sh
make down
/usr/bin/time -p make up
docker compose ps
make seed
make seed
docker compose exec -T postgres psql -U taxpulse_app -d taxpulse_l -c "select count(*) as tenants from tenant; select count(*) as cycles from tax_plan_cycle;"
docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sns list-topics --query 'length(Topics)'
docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sqs list-queues --query 'length(QueueUrls)'
AWS_ENDPOINT_URL=http://localhost:4566 docker compose exec -T floci aws s3 ls
AWS_ENDPOINT_URL=http://localhost:4566 docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sts get-caller-identity
make test
```

Observed clean start timing:

```text
real 14.28
user 1.07
sys 0.70
```

Observed health:

```text
api        taxpulse-api:w7d1           Up (healthy)   0.0.0.0:3000->3000/tcp
compute    taxpulse-compute:w7d1       Up (healthy)   0.0.0.0:8001->8000/tcp
floci      floci/floci:latest-compat   Up (healthy)   0.0.0.0:4566->4566/tcp
postgres   postgres:17.6-alpine        Up (healthy)   0.0.0.0:55433->5432/tcp
redis      redis:7.4.5-alpine          Up (healthy)   0.0.0.0:6379->6379/tcp
```

Observed idempotent re-seed:

```text
secret exists: taxpulse/local/db-password
secret exists: taxpulse/local/jwt-signing-keys
subscription exists: arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-projection
INSERT 0 2
INSERT 0 2
TaxPulse local seed complete.

tenants
---------
2

cycles
--------
2

SNS topics: 1
SQS queues: 2
```

Observed floci endpoint call:

```json
{
  "UserId": "000000000000",
  "Account": "000000000000",
  "Arn": "arn:aws:iam::000000000000:root"
}
```

Observed test suite:

```text
npx vitest run apps/api/test --no-file-parallelism
Test Files 22 passed | 7 skipped (29)
Tests 79 passed | 29 skipped (108)

npm run test --workspace=web
Test Files 19 passed (19)
Tests 75 passed (75)

uv run --locked pytest
tests/test_tax_liability.py ......... [100%]
9 passed in 0.14s
```

Task 3 result:

- `Makefile` now exports `AWS_ENDPOINT_URL=http://localhost:4566` plus local AWS test credentials and provides exactly `up`, `down`, `seed`, and `test`.
- `make up` starts dependencies and compute, runs the idempotent seed, then starts the API against the seeded local stack.
- `make down` uses the brownfield profile during teardown so default and profiled containers plus volumes are removed cleanly.
- `scripts/seed.sh` uses existence checks and upserts for floci secrets, SNS/SQS resources, tenants, and tax plan cycles.
- Re-running `make seed` leaves the same state: two tenants, two cycles, one topic, and two queues.
- The AWS CLI checks hit floci through the local endpoint, not a real AWS account.
