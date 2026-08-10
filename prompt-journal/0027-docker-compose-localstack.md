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

## Entry 4

Asked — Complete Task 2 by ensuring startup is gated by dependency readiness, not sleeps, and the Module-6 TIVS ACL mock is available only under the `brownfield` Compose profile.

Produced — Verified healthchecks and long-form `depends_on: condition: service_healthy` in `docker-compose.yml`, changed the profiled `tivs-acl` service to boot a local brownfield mock with its own `/health` probe, cycled the stack twice with `make up`, confirmed Postgres becomes healthy before compute starts, confirmed API waits for healthy compute/floci/Postgres/Redis, confirmed plain startup excludes `tivs-acl`, and confirmed `docker compose --profile brownfield up -d tivs-acl` starts a healthy mock. Appended the Task 2 acceptance pass to `evidence/week-7-day-2-docker-compose-localstack.md`.

Accepted or rejected — Accepted.

Why — The canonical Compose graph now uses readiness probes and service-health dependency gates for startup ordering, repeated local starts avoid Tax Engine crash loops, and the brownfield mock is opt-in and healthy only when the `brownfield` profile is enabled.

## Entry 5

Asked — Complete Task 3 by wrapping the stack in `make up`, `make down`, `make seed`, and `make test`, exporting the floci endpoint for every AWS call, making the seed safe to run twice, and documenting cold-start timing and endpoint behavior.

Produced — Updated the Makefile targets so `up` starts the stack and delegates to `seed`, `down` removes default and brownfield-profile containers and volumes, and `test` runs the API, web, and compute suites against the running stack. Expanded `scripts/seed.sh` with idempotent floci SNS/SQS resources, kept the Postgres seed on upserts, pointed the DynamoDB read-model test endpoint at `AWS_ENDPOINT_URL`, and updated the cold-start README and evidence with the passing checks.

Accepted or rejected — Accepted.

Why — Task 3 verification passed with a 14.28-second clean `make up`, repeat `make seed` preserving the same database and floci resource counts, AWS CLI calls resolving through floci, and all configured test suites passing against the running stack.
