🕐 Last Updated: 2026-07-17 20:58:14 UTC
📌 Commit: aed73002
Week 7 · Day 2
Docker Compose & LocalStack
Make one docker-compose stack the canonical local environment — every service and brownfield mock running the same images that ship to AWS, ordered with healthchecks and depends_on conditions, organized by dev/test/brownfield profiles, pointed at LocalStack, and brought up and seeded by make up.

1
Topic 1 of 5
Compose as the canonical local environment
Why Do I Need to Know This?
The images from 7.1 Docker & Multi-stage Builds run one container at a time. The capstone is not one container — it is two services over three data stores plus emulated AWS and a set of legacy mocks. Starting that by hand, in the right order, with the right environment, is exactly the "works on my machine" problem a shared Compose file solves. One docker-compose.yml that brings the whole stack up the same way for every teammate is the fix, and it is the file every later lesson builds on.

This stack is also the foundation for cloud deployment. Because Compose runs the same images that ship to AWS, the service definitions you write here map directly onto the ECS task definitions in 7.3 ECS Fargate & ALB — local mirrors cloud.

Scenario
Onboarding a fifth engineer currently takes a day: install Node and Python, set a dozen environment variables, start Postgres, DynamoDB Local, Redis, and LocalStack in the right order, then both services. The team replaces all of it with a single docker-compose.yml and a make up that brings the whole stack green on a fresh laptop.

Theory
Compose describes a multi-service stack declaratively
A docker-compose.yml file lists each service and how to run it — which image, which ports to publish, which environment variables, which volumes, which network. Instead of a runbook of manual steps, the stack is a single declarative file that docker compose up brings to life. Compose creates a shared network so the services reach each other by service name (postgres, redis) rather than hard-coded addresses.

The capstone stack is polyglot — one file holds all of it
The capstone is not one language or one process. The Compose file declares the Express (Node) service, the FastAPI (Python) service, Postgres, DynamoDB Local, Redis, LocalStack, and the brownfield mocks — together, in one place. Polyglot here just means one Compose file is enough to describe all of them.

Compose runs the same images that ship to AWS
The services in the Compose file reference the images built in 7.1 Docker & Multi-stage Builds — not a separate "dev build." Running the production image locally is what makes local behavior match cloud behavior; a bug that only appears in the shipped image shows up on the laptop, not in production. Local must mirror cloud.

i
Note
Data stores like Postgres, Redis, and DynamoDB Local use their official images directly (postgres:17, redis:7-alpine, amazon/dynamodb-local); only the two capstone services use the images you built in 7.1 Docker & Multi-stage Builds.

One Compose file wires the whole polyglot stack
The two capstone services connect to the data stores and to LocalStack, all declared in a single Compose file on a shared network.








Example
a trimmed compose file for part of the stack
services:
  express:                          # (1) the Node service, built in 7.1
    image: myorg/filing-api:1.4.2
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: postgres://app:app@postgres:5432/app   # (2) reaches Postgres by service name
    networks: [appnet]

  postgres:                         # (3) official image, used directly
    image: postgres:17
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
    networks: [appnet]

  localstack:                       # (4) emulated AWS — see the LocalStack topic
    image: localstack/localstack:2026.06        # calendar-version tag (YYYY.MM)
    environment:
      LOCALSTACK_AUTH_TOKEN: ${LOCALSTACK_AUTH_TOKEN}   # required to start since 2026.03
    ports: ["4566:4566"]
    networks: [appnet]

networks:
  appnet:
Copy
Annotation (1) — the Express service runs the exact image built and scanned in 7.1 Docker & Multi-stage Builds; no separate dev image.
Annotation (2) — the service reaches Postgres at hostname postgres, the service name, over the shared appnet network — no IP addresses.
Annotation (3) — data stores use their official images directly; there is nothing for the team to build.
Annotation (4) — LocalStack publishes port 4566, its single endpoint for every emulated AWS service; the LocalStack as the cloud stand-in, with make targets topic covers it in full.
AI Practice
Prompt it
Have Codex draft the full Compose graph from the service list, then verify every service maps to a real image and port.

Write a docker-compose.yml for our capstone: an Express service and a FastAPI
service (both from our own images), plus Postgres, DynamoDB Local, Redis, and
LocalStack. Put them on one shared network, have the services reach the data
stores by service name, and publish only the ports a developer needs. Use our
built image names for the two services and official images for the data stores.
Copy
Watch out
Codex often invents image names or uses latest instead of your built, pinned images, and may hard-code localhost or IP addresses where a service name belongs (which breaks on the Compose network). It sometimes publishes every internal port to the host. Confirm the two services use your real image tags, cross-service URLs use service names, and only necessary ports are published.

Verify
Run docker compose config to confirm the file parses and every service has a resolvable image. Bring the stack up and confirm the Express service can reach Postgres by the name postgres (not an IP). Confirm the two capstone services reference your built image tags, not latest. Record any invented image name or hard-coded address in your prompt journal.

Knowledge Check
1. What problem does a single docker-compose.yml solve for the team?
It compiles both services into a single binary that shares one process.
Every teammate gets the same stack from one command.
It replaces the production AWS deployment with a local-only one.
It removes the need to build container images for the services.
2. Which images does the Compose stack run for the two capstone services?
Freshly downloaded official base images, rebuilt from scratch on every up.
Slimmer dev-only images that intentionally differ from what ships to AWS.
Whatever images the host has cached, regardless of the Dockerfile.
The same images from 7.1 that ship to AWS.
3. The capstone stack is polyglot. What does that mean for the Compose file?
One file declares Node, Python, and data services together.
Each language requires its own separate compose file to run.
Only the Node and Python services may share a compose network.
The compose file must be generated by a language-specific tool.
4. Why does Compose run the same images that ship to AWS rather than a separate local build?
Because Compose cannot build images and can only pull finished ones from a registry.
Because AWS rejects any image that was not first run locally in Compose.
So local behavior matches cloud and avoids "works on my machine."
Because local images must be larger to include extra debugging tools.
2
Topic 2 of 5
Ordered startup — healthchecks and depends_on conditions
Why Do I Need to Know This?
A multi-service stack comes up in dependency order or it crash-loops: FastAPI dies if it tries to connect before Postgres is accepting connections. The healthchecks you added to the Express and FastAPI images in 7.1 Docker & Multi-stage Builds already tell Compose when those two are ready; Postgres and the other official images still need one defined here — and the same readiness signal carries forward to the ECS ALB health checks in 7.3 ECS Fargate & ALB. Getting this right is also the lesson’s closed-book check: explain depends_on healthcheck semantics without AI.

Scenario
make up fails intermittently: about one run in three, the FastAPI container exits because it connected to Postgres before it finished initializing. A teammate’s first instinct is to add sleep 10 to the start command. The team rejects that and instead gives Postgres a healthcheck and makes FastAPI depend on it being healthy, not just started.

Theory
depends_on alone orders start, not readiness
Plain depends_on tells Compose to start one service before another — but "started" is not "ready." A Postgres container can be running while the database inside it is still initializing and refusing connections. A service that depends only on start order will happily connect too early and crash. The long-form depends_on with condition: service_healthy waits for the dependency’s healthcheck to pass before starting the dependent service.

Each service defines a healthcheck
A healthcheck is the readiness signal Compose waits on. It has a test (the command that decides healthy or not), an interval (how often to probe), a timeout, retries, and a start_period — a grace window at startup during which failing probes do not count against the service. For Postgres, the standard test is pg_isready, which returns success only when the server is accepting connections. The AGENTS.md rule for this module is that every service has a healthcheck and dependents use depends_on: condition: service_healthy.

Why sleep is the wrong tool
sleep 10 is a fixed guess, not a readiness signal. Too short and it still races on a slow machine; too long and every single make up wastes the difference. A healthcheck polls the actual readiness of the dependency and releases the dependent the moment it is ready — no faster, no slower. Replacing a race with a guess is not a fix.

!
Warning
A green docker compose up with sleep-based waiting hides a race that will reappear on a slower laptop or in CI. Use a healthcheck and service_healthy, never a fixed sleep, to gate startup.

The dependent waits for the dependency's healthcheck
Compose polls Postgres’s healthcheck and only starts FastAPI once it passes — instead of starting FastAPI immediately and racing the database.







Syntax error in text
mermaid version 11.16.1
Example
a healthcheck plus a service_healthy dependency
services:
  postgres:
    image: postgres:17
    healthcheck:                              # (1) readiness signal Compose waits on
      test: ["CMD-SHELL", "pg_isready -U app"]
      interval: 5s
      timeout: 3s
      retries: 5
      start_period: 10s                       # (2) grace window during init
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app

  fastapi:
    image: myorg/filing-svc:1.4.2
    depends_on:
      postgres:
        condition: service_healthy            # (3) wait for healthy, not just started
Copy
Annotation (1) — pg_isready succeeds only when Postgres is accepting connections; that is the readiness signal, not merely "the process started."
Annotation (2) — start_period gives Postgres time to initialize; failing probes during this window do not mark it unhealthy.
Annotation (3) — condition: service_healthy holds FastAPI until the healthcheck passes, which removes the crash-loop race entirely.
AI Practice
Prompt it
Have Codex add healthchecks and ordering to the stack, then verify the race is gone.

Add a healthcheck to the Postgres service in our docker-compose.yml using
pg_isready, with a sensible interval, retries, and a start_period for init. Then
make the FastAPI service depend on Postgres with condition: service_healthy so it
does not start until Postgres is ready. Do the same for any other service that
connects to a dependency at startup. Do not use sleep anywhere.
Copy
Watch out
Codex sometimes falls back to sleep in the start command, or writes depends_on in the short list form (which only orders start, not readiness). It may set no start_period, so the dependency is marked unhealthy during normal initialization, or write a healthcheck test that always passes. Confirm condition: service_healthy is used, the test actually probes readiness, and no sleep remains.

Verify
Bring the stack up several times and confirm FastAPI never crash-loops waiting for Postgres. Run docker compose ps and confirm Postgres shows healthy before FastAPI starts. Temporarily slow Postgres (or start on a loaded machine) and confirm the dependent still waits rather than racing. Record any sleep fallback or short-form depends_on in your prompt journal.

Knowledge Check
1. What does depends_on: condition: service_healthy guarantee that plain depends_on does not?
The dependency’s healthcheck passes before the dependent starts.
The dependency and the dependent start at exactly the same moment.
The dependent restarts automatically whenever the dependency restarts.
The dependency is rebuilt from its Dockerfile before each start.
2. FastAPI crash-loops because Postgres is not ready yet. What is the right fix?
Add sleep 10 to the FastAPI start command before it connects.
Increase FastAPI’s restart count until Postgres happens to be up.
Give Postgres a healthcheck and depend on service_healthy.
Start Postgres manually before running docker compose up.
3. Why is sleep 10 the wrong way to wait for a dependency?
Because Compose forbids shell commands inside a service’s start command.
It is a fixed guess — too short races, too long wastes time.
Because sleeping makes the container fail its own healthcheck.
Because Postgres always becomes ready in well under one second.
4. What does the start_period in a healthcheck control?
How long the container may run before it is forcibly restarted.
The interval between two consecutive healthcheck probes.
The total number of retries before the container is marked unhealthy.
A grace window at startup where failing probes don’t count.
3
Topic 3 of 5
Compose profiles and override files
Why Do I Need to Know This?
Not every run needs every service. Running the SOAP, SFTP, and stored-procedure mocks during a quick unit-test run wastes startup time; running them during brownfield integration is required. Profiles let one Compose file serve all three modes — everyday dev, lean test, full brownfield — without forking it into three drifting copies.

Scenario
The team wants three ways to bring the stack up from one file: make up for everyday development (no brownfield mocks), a lean make test stack, and a brownfield mode that adds the mocks from 6.3 Brownfield #1: Reading a WSDL & Building a SOAP ACL, 6.4 Brownfield #2: Postgres Stored Procedures & a Typed Façade, and 6.5 Brownfield #3: SFTP Ingest, Reconciliation & the Sprint 4 Gate (SOAP, sproc-Postgres, SFTP). Maintaining three separate Compose files would guarantee they drift apart, so the team uses profiles instead.

Theory
A service without a profile always runs; a profiled service is opt-in
Compose profiles tag a service so it starts only when its profile is active. A service with no profiles: key always runs on docker compose up. A service tagged profiles: ["brownfield"] starts only when you pass --profile brownfield (or set COMPOSE_PROFILES). So the core stack — the two services and their data stores — has no profile and is always on, while the mocks are tagged and opt-in.

Override files layer environment-specific changes
A base docker-compose.yml holds the shared definition; an override file (for example docker-compose.override.yml, or any file passed with -f) layers changes on top — different ports, extra volumes, debug environment variables. Compose merges them, so you keep one base file and express per-environment differences as small overlays rather than copies.

The three modes map to real needs
The profiles correspond to how the team actually works: dev is the fast inner loop with just the core stack; test is a minimal, deterministic subset for running the test suite; brownfield adds the legacy mocks for integration work. One file, three intents, no duplication.

One base file, three profile selections
The core services always run; each profile adds or narrows the set for a specific kind of work.





Example
tagging the brownfield mocks with a profile
services:
  soap-mock:                         # (1) only runs under the brownfield profile
    image: myorg/soap-legacy-mock:1.0
    profiles: ["brownfield"]
    networks: [appnet]

  sftp-mock:
    image: atmoz/sftp@sha256:<digest>   # real SFTP server, pinned by digest (atmoz/sftp publishes no semver tags)
    profiles: ["brownfield"]
    networks: [appnet]

  # express, fastapi, postgres, redis, localstack have NO profiles key
  # → they always start on `docker compose up`
Copy
docker compose up                          # (2) core stack only — no mocks
docker compose --profile brownfield up     # (3) core stack + the brownfield mocks
Copy
# docker-compose.override.yml — loaded automatically alongside docker-compose.yml
services:
  fastapi:
    ports: ["5678:5678"]   # expose a debugger port, only for local dev
Copy
Annotation (1) — profiles: ["brownfield"] makes soap-mock opt-in; a plain up leaves it out.
Annotation (2) — the default up starts only the unprofiled core services, the fast everyday loop.
Annotation (3) — adding --profile brownfield brings up the core stack plus the tagged mocks for integration work.
AI Practice
Prompt it
Have Codex add profiles for the three modes, then verify each brings up the intended services.

Add Compose profiles to our docker-compose.yml. Tag the SOAP, SFTP, and
stored-procedure mock services with a "brownfield" profile so they only start
when requested. Leave the core services (Express, FastAPI, Postgres, Redis,
LocalStack) with no profile so they always run. Show the profile tags and the
commands to bring up (a) the core stack only and (b) the core stack plus mocks.
Copy
Watch out
Codex sometimes tags the core services with a "dev" profile too, which means a plain docker compose up starts nothing. It may also assume a profiled service starts whenever any profile is active. Confirm the core services have no profiles: key (so they always run) and the mocks start only under --profile brownfield.

Verify
Run docker compose up and confirm only the core services start — no mocks. Run docker compose --profile brownfield up and confirm the mocks now start alongside the core. Run docker compose config --profile brownfield to see the resolved service set. Record any case where a plain up started nothing or started the mocks in your prompt journal.

Knowledge Check
1. A service has no profiles: key. When does it run?
Only when you pass --profile default on the command line.
Never, until it is assigned to at least one named profile.
Always, on every docker compose up.
Only when every other profile in the file is also activated.
2. How do you bring up the brownfield mocks tagged profiles: ["brownfield"]?
Run docker compose --profile brownfield up.
Remove the profiles key so the mocks start by default.
Set the mocks as a dependency of an always-on core service.
They start automatically whenever any profile is active.
3. Why organize dev, test, and brownfield as profiles in one file rather than three separate files?
Because Compose cannot load more than one compose file at a time.
Because profiles run their services faster than separate files do.
Because a test run legally requires the brownfield mocks to be present.
One source of truth serves all three modes without forking it.
4. A unit-test run does not need the SOAP and SFTP mocks. How do profiles help?
They delete the mock services from the file during the test run.
The test profile leaves the mocks out, so they don’t start.
They convert the mocks into lighter images for the test run.
They run the mocks but block their network access during tests.
4
Topic 4 of 5
LocalStack as the cloud stand-in, with make targets
Why Do I Need to Know This?
Lessons 7.3 ECS Fargate & ALB, 7.4 Lambda & API Gateway, and 7.5 CloudFront & S3 SPA Deploy deploy against these AWS services — but here, against LocalStack’s emulation of them, so the team can iterate without a real account. Knowing what LocalStack emulates well, and what it only approximates, keeps the team from debugging an emulation gap as if it were their own bug. make targets then wrap the whole stack into a reproducible inner loop.

Scenario
The team standardizes four commands — make up, make down, make seed, make test — so the full stack comes up in under a minute, seeds idempotently, runs the tests, and tears down cleanly. They also write a short startup-timing README so a new teammate knows the expected timings and the one endpoint every AWS call points at.

Theory
LocalStack is the local AWS endpoint the SDK points at
LocalStack emulates the AWS APIs the program uses and exposes them at a single endpoint, http://localhost:4566. The application’s AWS SDK or CLI talks to LocalStack instead of real AWS by setting AWS_ENDPOINT_URL to that address — no code change beyond the endpoint. SNS, SQS, and S3 — the services this module relies on early — are among those LocalStack emulates.

!
Important
LocalStack requires an auth token to start. Since release 2026.03.0, LocalStack needs a LOCALSTACK_AUTH_TOKEN in its environment before it starts — on every plan, from the free Hobby plan (non-commercial use only) through the paid Base and Ultimate tiers — so make up brings up nothing without it. Pin the image with a calendar-version tag (YYYY.MM), not the retired :3/:4 tags.

Emulation has limits — name them
LocalStack approximates AWS; it is not AWS. Some services and behaviors are only partially emulated, and a few of the compute services in 7.3 ECS Fargate & ALB and 7.4 Lambda & API Gateway may behave differently than the real thing. The discipline is to name where LocalStack diverges so the team treats an emulation gap as an emulation gap, not a bug in their code. The real-AWS deploy — and the behaviors LocalStack cannot reproduce — come in Week 8.

!
Important
Do not trust LocalStack for behaviors it only approximates. Timing, eventual consistency, and some IAM enforcement differ from real AWS. Use LocalStack to build and wire the integration; confirm the behaviors it cannot fully emulate against real AWS in Week 8.

make targets wrap the stack into a reproducible loop
A small Makefile gives the team one vocabulary: make up brings the stack up (Compose plus any seeding), make down tears it down, make seed loads synthetic data, make test runs the suite against the running stack. make seed must be idempotent — running it twice leaves the same state, never duplicate rows — and make up should reach green in under about a minute so the inner loop stays fast.

The app points at LocalStack; make targets drive the loop
Every AWS call goes to the LocalStack endpoint instead of real AWS, and the make targets wrap the everyday up/seed/test/down loop.









Example
a makefile and the localstack endpoint
export AWS_ENDPOINT_URL=http://localhost:4566   # (1) point the AWS SDK/CLI at LocalStack

up:                 ## bring the whole stack up
	docker compose up -d
	$(MAKE) seed

seed:               ## load synthetic data — safe to run repeatedly
	./scripts/seed.sh        # (2) must be idempotent: re-running changes nothing

test:               ## run the suite against the running stack
	docker compose run --rm tests

down:               ## tear everything down
	docker compose down -v
Copy
Annotation (1) — exporting AWS_ENDPOINT_URL routes every AWS SDK/CLI call to LocalStack; no other code change is needed to target the emulator.
Annotation (2) — seed.sh uses upserts or existence checks so a second make seed produces the same state, never duplicate data — the same idempotency idea the program applies everywhere.
Running make up should reach an all-healthy stack in under about a minute; the startup-timing README records the expected timing for new teammates.
AI Practice
Prompt it
Have Codex write the make targets and seed script, then verify an idempotent re-seed and the endpoint wiring.

Write a Makefile with up, down, seed, and test targets for our Compose stack. up
should start the stack detached and then seed it; seed should run a script that
loads synthetic data idempotently (safe to run twice); test should run our suite
against the running stack; down should remove containers and volumes. Set
AWS_ENDPOINT_URL so the AWS CLI/SDK targets LocalStack at localhost:4566.
Copy
Watch out
Codex often writes a seed script that inserts rows unconditionally, so a second make seed creates duplicates. It may forget AWS_ENDPOINT_URL, so calls hit real AWS, or assume LocalStack emulates a service or behavior it only partially supports. Confirm the seed is idempotent, the endpoint is set, and any reliance on a weakly-emulated behavior is noted for Week 8.

Verify
Run make up and time it — confirm the stack reaches all-healthy in roughly a minute. Run make seed twice and confirm the second run adds no duplicate data. Confirm an AWS CLI call (for example, listing S3 buckets) hits LocalStack, not real AWS, by checking AWS_ENDPOINT_URL. Record any non-idempotent seed or missing endpoint in your prompt journal.

Knowledge Check
1. How does the application talk to LocalStack instead of real AWS?
By installing a special LocalStack SDK in place of the AWS SDK.
By routing each AWS call through a manual proxy server first.
By switching the AWS account ID to a reserved local range.
By pointing the AWS SDK/CLI at the LocalStack endpoint URL.
2. Why must make seed be idempotent?
So that seeding runs noticeably faster the second time it is invoked.
So re-running it yields the same state, not duplicates.
So the seed data is encrypted before it reaches LocalStack.
So Compose can skip the seed step on subsequent builds.
3. What is a realistic limitation of LocalStack to keep in mind?
It can only emulate one AWS service per container instance.
It requires a live AWS account to validate every request.
Some services or behaviors are only partially emulated.
It runs the exact same binaries that AWS runs in production.
4. What is the point of standardizing make up, make down, make seed, and make test?
A reproducible inner loop everyone runs the same way.
They replace the Dockerfiles with a single Makefile-based build.
They deploy the running stack to AWS without needing Terraform.
They guarantee the whole stack starts in under one millisecond.
5
Topic 5 of 5
Practice — bring the whole stack up with one command
Why Do I Need to Know This?
This lesson’s payoff is a stack a new teammate can run in one command. make up brings up both services and every data store on the same images that ship to AWS, ordered by healthchecks so nothing crash-loops, with the brownfield mocks one profile away and every AWS call pointed at LocalStack. The way to know you have it is to start from a clean machine, run make up, and then attack the setup: kill the startup ordering, run a plain up and confirm the mocks stay down, re-seed twice and check for duplicates, and confirm an AWS call hits the emulator. This is the environment every remaining lesson in the module runs against.

AI Practice
Prompt it
Hands-on practice for this lesson — assemble the canonical Compose stack with Codex, then break each guarantee to confirm it holds.

Assemble our canonical local environment: a docker-compose.yml running our built
Express and FastAPI images plus Postgres, DynamoDB Local, Redis, and LocalStack on
one network; healthchecks on every service with dependents using
depends_on: condition: service_healthy (no sleep); a "brownfield" profile for the
SOAP/SFTP/sproc mocks while core services stay unprofiled; AWS_ENDPOINT_URL set to
LocalStack; and a Makefile with up, down, seed (idempotent), and test targets.
Then show me how to verify ordered startup, profile selection, and idempotent seed.
Copy
Watch out
Codex is likely to fall back to sleep instead of service_healthy, tag the core services with a profile so a plain up starts nothing, write a non-idempotent seed that duplicates rows on re-run, forget AWS_ENDPOINT_URL so calls hit real AWS, and use latest instead of your built image tags. Each passes a glance while breaking a guarantee. Read the startup ordering, which services carry profiles, whether the seed is idempotent, where AWS calls go, and which image tags are used before trusting it.

Verify
From a clean machine, run make up and confirm the whole stack reaches healthy in about a minute with no crash-loops. Run a plain docker compose up and confirm the brownfield mocks stay down; run --profile brownfield up and confirm they start. Run make seed twice and confirm no duplicate data. Confirm an AWS CLI call hits LocalStack via AWS_ENDPOINT_URL. Stop Postgres mid-startup and confirm the dependent waits rather than crash-looping. Record every guarantee that failed on the first pass in your prompt journal.

