# Prompt Journal: Docker Compose & LocalStack

## Entry 1

Asked — Save the attached Week 7 Day 2 "Docker Compose & LocalStack" lesson as a helper and start a new prompt journal.

Produced — Saved `helper/week-7-day-2-docker-compose-localstack.md` from the provided lesson text and initialized `prompt-journal/0027-docker-compose-localstack.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 7 Day 2 Docker Compose and LocalStack helper lesson is saved in the repository helper directory and prompt journal 0027 is initialized for the new local environment work.

## Entry 2

Asked — Build the Week 7 Day 2 local-only deliverable with a docker-compose service graph, Makefile targets, `.env.local` floci endpoint, idempotent seed script, cold-start README, and evidence showing `make up`, service health, re-seed, and floci calls.

Produced — Replaced the root Compose stack with `api`, `compute`, `postgres`, `redis`, `floci`, and brownfield-profile `tivs-acl`; added `pull_policy: never` for the local Week 7 Day 1 service images; added `.env.local`, `scripts/seed.sh`, `README-stack.md`, and `evidence/week-7-day-2-docker-compose-localstack.md`; updated `.gitignore` to track the non-secret endpoint file; and verified `make up`, `docker compose ps`, `make seed`, row counts, and a floci STS call.

Accepted or rejected — Accepted.

Why — The local stack starts with healthy core services, every AWS-shaped call is pointed at floci on port 4566, the seed script is idempotent, and the evidence file captures the successful verification results.

## Entry 3

Asked — Complete Task 1 by verifying the canonical `docker-compose.yml` uses the m7d1 service images, official pinned Postgres and Redis images, service-name addressing, one shared network, health-gated dependencies, and only needed developer ports.

Produced — Re-ran `docker compose config`, inspected the running services and local image tags, confirmed the brownfield `tivs-acl` service stays profiled, verified the API and compute services are healthy from the m7d1 tags, and used a one-off network curl container to call `http://api:3000/ready`, proving the API reaches Postgres through the Compose network. Appended the Task 1 acceptance pass to `evidence/week-7-day-2-docker-compose-localstack.md`.

Accepted or rejected — Accepted.

Why — Task 1 verification passed with the canonical stack healthy, service images pinned to the local m7d1 tags, service-name URLs in the resolved Compose config, and API readiness confirming Postgres access through the shared network.
