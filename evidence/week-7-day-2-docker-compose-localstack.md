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
