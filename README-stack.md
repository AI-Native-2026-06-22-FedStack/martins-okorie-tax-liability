# TaxPulse Local Stack

This is the canonical Week 7 Day 2 local stack. It uses Docker Compose for the service graph and floci for every AWS-shaped call. No cloud account is required.

## Files

- `docker-compose.yml` declares the local service graph.
- `Makefile` exposes `up`, `down`, `seed`, and `test`.
- `.env.local` pins the host AWS endpoint to `http://localhost:4566`.
- `scripts/seed.sh` creates synthetic local secrets, idempotent SNS/SQS event resources, and upserts local seed rows.

## Cold Start

One command starts the lean local stack and seeds it:

```sh
make up
```

Useful checks:

```sh
docker compose ps
make seed
AWS_ENDPOINT_URL=http://localhost:4566 docker compose exec -T floci aws sts get-caller-identity
```

Expected timings with prebuilt `taxpulse-api:w7d1` and `taxpulse-compute:w7d1` images:

- `postgres`, `redis`, and `floci` healthy: under 15 seconds.
- `compute` healthy after dependencies: under 20 seconds.
- `scripts/seed.sh`: under 10 seconds after containers are ready.
- Full `make up`: under 60 seconds. Latest observed clean start: 14.28 seconds.

The seed is safe to run twice. A re-seed leaves two synthetic tenants, two synthetic tax plan cycles, one SNS topic, and two SQS queues.

## Profiles

The core stack is unprofiled and starts with `make up`. The brownfield TIVS ACL is opt-in:

```sh
docker compose --profile brownfield up -d tivs-acl
```

## Endpoint Rules

Host tools use `AWS_ENDPOINT_URL=http://localhost:4566`. Containers use `http://floci:4566` through Compose service discovery. Keep `.env.local` out of version control if it ever grows beyond non-secret local endpoint values.

`make down` removes the default stack, the brownfield-profile container if it was started, and all Compose volumes:

```sh
make down
```
