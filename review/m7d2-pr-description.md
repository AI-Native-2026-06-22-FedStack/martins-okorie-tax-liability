# Week 7 Day 2 PR — Canonical Local Compose Stack with floci

## Summary

Adds the canonical local TaxPulse stack around the Week 7 Day 1 service images. The stack
uses `taxpulse-api:w7d1` and `taxpulse-compute:w7d1` without rebuilds, adds pinned
Postgres and Redis dependencies, routes AWS-shaped calls through floci at
`http://localhost:4566`, gates startup on readiness healthchecks, and keeps the
brownfield TIVS ACL mock opt-in behind the `brownfield` Compose profile.

The PR also adds the four local workflow targets, an idempotent synthetic seed, a short
cold-start README, rubric evidence, and the prompt-journal entries for the AI-assisted
work.

## Related ADR

ADR: N/A — this PR adds local developer orchestration and verification only; it does not
change or introduce an architectural decision.

## Testing

- `docker compose version`
- `make --version`
- `docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E 'taxpulse-api|taxpulse-compute|apps/api|services/compute'`
- `docker compose config`
- `docker compose --profile brownfield config`
- `make down`
- `/usr/bin/time -p make up`
- `docker compose ps`
- `docker compose ps --services`
- `docker compose logs --tail=80 compute`
- `docker compose --profile brownfield up -d tivs-acl`
- `docker compose --profile brownfield ps tivs-acl`
- `docker compose --profile brownfield stop tivs-acl`
- `make seed`
- `make seed`
- `docker compose exec -T postgres psql -U taxpulse_app -d taxpulse_l -c "select count(*) as tenants from tenant; select count(*) as cycles from tax_plan_cycle;"`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sns list-topics --query 'length(Topics)'`
- `docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sqs list-queues --query 'length(QueueUrls)'`
- `AWS_ENDPOINT_URL=http://localhost:4566 docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sts get-caller-identity`
- `make test`
- `bash -n scripts/seed.sh`
- `make -n up down seed test`
- `git diff --check`

Verification output:

```text
$ docker image ls --format '{{.Repository}}:{{.Tag}} {{.ID}}' | grep -E 'taxpulse-api|taxpulse-compute|apps/api|services/compute'
taxpulse-api:w7d1 abdc5c722f1d
taxpulse-compute:w7d1 fbaa420625b8

$ docker compose config
Result: parsed successfully. api and compute use taxpulse-api:w7d1 and
taxpulse-compute:w7d1 with pull_policy: never. Cross-service URLs resolve through
postgres, redis, compute, and floci service names on the shared taxpulse-local network.

$ /usr/bin/time -p make up
real 14.28
user 1.07
sys 0.70

$ docker compose ps
api        taxpulse-api:w7d1           Up (healthy)   0.0.0.0:3000->3000/tcp
compute    taxpulse-compute:w7d1       Up (healthy)   0.0.0.0:8001->8000/tcp
floci      floci/floci:latest-compat   Up (healthy)   0.0.0.0:4566->4566/tcp
postgres   postgres:17.6-alpine        Up (healthy)   0.0.0.0:55433->5432/tcp
redis      redis:7.4.5-alpine          Up (healthy)   0.0.0.0:6379->6379/tcp

$ docker compose ps --services
api
compute
floci
postgres
redis

$ docker compose --profile brownfield config --services
postgres
compute
floci
redis
api
tivs-acl

$ docker compose --profile brownfield ps tivs-acl
tivs-acl   node:24.17.0-trixie-slim   Up (healthy)   0.0.0.0:4300->4300/tcp

$ make seed && make seed
secret exists: taxpulse/local/db-password
secret exists: taxpulse/local/jwt-signing-keys
subscription exists: arn:aws:sqs:us-east-1:000000000000:taxpulse-stage-changed-projection
INSERT 0 2
INSERT 0 2
TaxPulse local seed complete.

$ docker compose exec -T postgres psql -U taxpulse_app -d taxpulse_l -c "select count(*) as tenants from tenant; select count(*) as cycles from tax_plan_cycle;"
 tenants
---------
       2

 cycles
--------
      2

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sns list-topics --query 'length(Topics)'
1

$ docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sqs list-queues --query 'length(QueueUrls)'
2

$ AWS_ENDPOINT_URL=http://localhost:4566 docker compose exec -T floci aws --endpoint-url http://127.0.0.1:4566 sts get-caller-identity
{
    "UserId": "000000000000",
    "Account": "000000000000",
    "Arn": "arn:aws:iam::000000000000:root"
}

$ make test
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

## AI review evidence

Codex review output:

```text
Rubric result: Pass.

- Canonical Compose stack: docker compose config parses; api uses taxpulse-api:w7d1,
  compute uses taxpulse-compute:w7d1, both with pull_policy: never; Postgres, Redis,
  floci, API, and compute share one network and use service-name addressing.
- Ordered startup: Postgres uses pg_isready with start_period; Redis and floci also have
  readiness probes; compute and api use long-form depends_on with condition:
  service_healthy; no sleep appears in docker-compose.yml.
- Brownfield profile: plain docker compose ps --services excludes tivs-acl; --profile
  brownfield config includes tivs-acl, and the profiled mock starts healthy.
- Make/seed/floci: Makefile exposes up, down, seed, test; repeat make seed keeps the
  same two tenants, two cycles, one SNS topic, and two SQS queues; STS calls resolve to
  floci's local account 000000000000.
```

What it missed:

```text
The first seed verification attempt failed because the sandboxed shell script could not
use the Docker socket, even though direct Docker commands were approved. A human check
caught that this was a verification-environment permission issue rather than a seed
logic failure, reran make seed with Docker permission, and confirmed two successful
idempotent seed runs.
```

## AI-tool reflection

I accepted Codex's recommendation to make `make up` delegate to `$(MAKE) seed` and to
export `AWS_ENDPOINT_URL=http://localhost:4566` from the Makefile because it gives the
team one vocabulary for the local loop and keeps SDK/CLI calls pointed at floci instead
of a real AWS account. I rejected the early temptation to treat a one-off insert script
as enough; the final seed uses existence checks and upserts for secrets, SNS/SQS
resources, tenants, and tax plan cycles so a second run is a no-op on state.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli`.

## AI code-review checklist

- [X] stage logic uses the Tax Plan Cycle workflow stage as the case condition and does not add a separate status field.
- [X] Workflow changes keep stage transitions gated by role and current stage.
- [X] typed boundaries are preserved with the existing TypeScript schema or Python Pydantic validation patterns.
- [X] The diff contains no secrets, credentials, real client data, tenant data, or controlled data.
- [X] Tests or documented verification cover the changed behavior, including relevant negative paths.
- [X] AI-generated claims were checked against the diff and significant AI-assisted work was recorded in the prompt journal.
- [X] ADR linked if this PR changes or implements an architectural decision; otherwise `N/A` is stated above.

## Deliverables checklist

- [X] Summary explains what changed.
- [X] Related ADR is linked, or `N/A` is stated for no architectural decision change.
- [X] Testing lists only checks or verification actually performed.
- [X] AI code-review checklist is completed.
- [X] AI review output is pasted above as a quote or code block.
- [X] "What it missed" note is pasted above as a quote or code block.
- [X] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [X] PR is self-assigned in Assignees.
- [X] `Isaiah Muli` is requested under Reviewers.
