🕐 Last Updated: 2026-07-16 18:03:04 UTC
📌 Commit: 165aadf3
Week 7 · Day 1
Docker & Multi-stage Builds
Turn both capstone services into small, hardened, scannable production images — multi-stage builds onto a non-root distroless or slim runtime, pinned dependencies, no secrets in any layer, and correct SIGTERM handling so the image is ready to deploy.

1
Topic 1 of 5
Images, containers, and the layered filesystem
Why Do I Need to Know This?
For two modules you have used Docker as a black box — a command that brings up LocalStack and the brownfield mocks. This week you write the production images yourself, and every decision you are about to make (why an image is 1 GB or 80 MB, why a secret survives after you "delete" it, why instruction order controls build speed) follows from one idea: an image is a stack of layers. Get this mental model first and the rest of the lesson is mechanical.

This is the foundation for the whole module. The images you build in this lesson are the artifacts the Compose stack runs in 7.2 Docker Compose & LocalStack and the things ECS Fargate pulls and runs on AWS in 7.3 ECS Fargate & ALB — the same bytes, locally and in the cloud.

Scenario
A teammate writes the team’s first real Dockerfile for the Express service. The build works, but the image is 1.2 GB and a scan finds an .env file baked inside it — even though the Dockerfile deletes that file a few lines later. The team traces both problems to the same gap: nobody on the team can yet say what each COPY and RUN line actually does to the image. Before fixing anything, they learn the layer model.

Theory
An image is read-only layers; a container is a writable layer on top
A container image is an ordered stack of read-only layers. Each layer is a set of filesystem changes. When you run the image, the container engine adds one thin writable layer on top — that is where the running process makes its changes. The image never changes; you can start a hundred containers from one image and they all share the same read-only layers, each with its own writable layer.

This is why "image" and "container" are not the same word for the same thing. The image is the immutable template; the container is a running instance with its own writable layer.

Each Dockerfile instruction that changes the filesystem creates a layer
Instructions like COPY and RUN each produce a new layer stacked on the one before. Docker caches these layers by content and reuses them on the next build — which is why instruction order controls build speed. When a layer changes, every layer after it is invalidated and must be rebuilt; layers before it are reused from cache. Put the things that rarely change (installing dependencies) before the things that change on every commit (copying source), and most rebuilds reuse the expensive dependency layer.

»
Tip
Copy your dependency manifest (package.json, requirements.txt) and install before copying the rest of the source. Then editing a source file only rebuilds the cheap source layer, not the expensive install layer.

A file "deleted" in a later layer still exists in an earlier one
Layers only stack — a later layer cannot truly erase a file written by an earlier one, it can only hide it. If you COPY a secret in one instruction and RUN rm it in a later instruction, the secret is gone from the final filesystem view but still sits in the earlier layer, readable by anyone who pulls the image and inspects its layers. This is exactly the .env problem from the scenario, and it is why "just delete it afterward" is never how secrets are kept out of an image (the Image hygiene — pinned versions, no secrets in layers, scanning topic covers the real fix).

One image, many containers, built from stacked layers
Each instruction adds a read-only layer; the finished image is the stack, and every container adds its own writable layer on top of the shared image.

Base layer (node:24-alpine)

Dependencies layer (npm ci)

App layer (source code)

Image -- read-only stack

Container 1 -- writable layer

Container 2 -- writable layer

Example
one dockerfile, one layer per instruction
FROM node:24-alpine          # (1) base image layer
WORKDIR /app
COPY package*.json ./        # (2) manifest only — its own cached layer
RUN npm ci                   # (3) installed modules — expensive, cached layer
COPY . .                     # (4) source code — changes most often
CMD ["node", "server.js"]
Copy
Annotation (1) — FROM sets the base layers the image stacks on; everything builds on top of node:24-alpine.
Annotation (2) and (3) — copying the manifest before npm ci means the install layer is reused on every rebuild where dependencies did not change.
Annotation (4) — COPY . . is last because source changes most often; only this layer and any after it rebuild on a code edit.
Run docker history <image> to see the layers and their sizes — one row per instruction — which is how you find where 1.2 GB came from.
AI Practice
Prompt it
Have Codex explain an existing Dockerfile layer by layer and predict the cache impact of a change, then verify against a real rebuild.

Here is our Dockerfile. For each instruction, tell me (1) whether it creates a
new layer, (2) roughly what goes in that layer, and (3) if I edit a single
source file and rebuild, which layers rebuild and which are reused from cache.
Then suggest a reordering that maximizes cache reuse on a typical code change.
Copy
Watch out
Codex sometimes claims a RUN rm of a copied file removes it from the image — it does not; the file remains in the earlier layer. It may also assert cache behavior without accounting for instruction order. Treat its layer-by-layer story as a hypothesis and confirm it.

Verify
Run docker history on the built image and confirm the layer count and the expensive layers match Codex’s explanation. Then edit one source file, rebuild, and watch the build output: confirm the dependency-install layer says CACHED and only the source layer and later layers rebuild. If Codex predicted otherwise, record the miss in your prompt journal.

Knowledge Check
1. What is the relationship between a Docker image and a container?
An image is the running process, and a container is the file it was built from.
An image is read-only layers; a container adds a writable layer on top.
An image and a container are simply two names for the same single thing.
A container is read-only and an image is the writable copy you edit live.
2. You COPY a source file early in the Dockerfile, then rebuild after editing only that file. What happens to the build cache?
Nothing rebuilds — Docker caches the finished image as a single unit.
Only the base image layer is rebuilt; everything after it stays cached.
The entire image rebuilds from scratch regardless of what actually changed.
That layer and all layers after it rebuild; earlier ones are cached.
3. A teammate copies a secret file, uses it, then deletes it in a later RUN. Is the secret in the final image?
Yes — the earlier layer still has it; a later delete only hides it.
No — the delete instruction purges it from every layer of the built image.
No — Docker automatically strips any file named like a secret.
Yes, but only if the image is pushed to a public registry first.
4. Why does the order of instructions in a Dockerfile affect build speed?
Because Docker runs the later instructions first to optimize parallelism.
Because only the first three instructions are ever cached by Docker.
Because a changed layer invalidates the cache for every later layer.
Because each instruction doubles the size of the layer before it.
2
Topic 2 of 5
Multi-stage builds and slim or distroless base images
Why Do I Need to Know This?
The 1.2 GB image from the Images, containers, and the layered filesystem topic ships the entire build toolchain — compilers, dev dependencies, the full source tree — to production, where none of it is needed. That is wasted space, slow pulls, and a large attack surface an auditor will flag. Multi-stage builds are the single biggest lever you have on image size and safety: they let you build with a full toolchain and ship only the runtime artifact.

This is the technique that produces the images the rest of the module deploys. Both capstone services — Express (Node) and FastAPI (Python) — get a multi-stage Dockerfile here.

Scenario
The team needs production images for the Express service and the FastAPI service. Building each needs npm ci / pip install and a build step, but running them needs only the built output and the runtime dependencies. The team rewrites both Dockerfiles as two stages — a build stage with the full toolchain and a runtime stage that copies only the artifact onto a tiny base — and watches the Express image drop from 1.2 GB to under 150 MB.

Theory
A multi-stage Dockerfile splits "build" from "run"
A multi-stage Dockerfile declares more than one FROM. The first stage (AS build) has the full toolchain and produces the artifact. The final stage starts from a clean, small base and uses COPY --from=build to pull in only the built output. Everything in the build stage that you do not copy forward — compilers, dev dependencies, caches, source — never reaches the final image. The toolchain did its job and is discarded.

Base-image tiers: full, slim, distroless
The final stage’s base image sets your floor for size and attack surface:

Full (node:24, python:3.13) — a complete OS with a shell and package manager. Largest, most to patch.
Slim (node:24-trixie-slim, python:3.13-slim) — a trimmed OS. A good default. node:24-alpine is also marketed as slim, but Alpine uses a different C library (musl), not glibc — a distinct compatibility target.
Distroless (gcr.io/distroless/nodejs24-debian13, gcr.io/distroless/python3-debian13) — just the language runtime and its dependencies, with no shell and no package manager. Smallest attack surface. Note that the default image tag still runs as root; to run unprivileged, use the :nonroot image tag (which runs as uid 65532) or select the built-in nonroot user with a USER directive. The trade-off is debugging: with no shell, you cannot docker exec in and poke around, so you lean on logs and healthchecks instead.
i
Note
Distroless images are built on Debian. When you target gcr.io/distroless/python3-debian13, build on a matching Debian base such as python:3.13-slim-trixie so the compiled dependencies share the same C library and you avoid ABI mismatches. The same rule applies to Node: build on node:24-trixie-slim (glibc/Debian), not node:24-alpine (musl), when the runtime is gcr.io/distroless/nodejs24-debian13 — a native module like argon2 compiled against musl will fail to load under glibc.

Node and Python differ in what crosses the boundary
The pattern is identical for both services; only the artifact differs. For Node, the runtime stage copies the built JavaScript (dist/) and the production node_modules. For Python, it copies the installed packages — typically a virtual environment created in the build stage — into the distroless runtime. In both cases the build tools (npm, pip, compilers) stay behind in the build stage.

The toolchain stays in the build stage; only the artifact ships
The build stage installs and compiles with the full toolchain; the runtime stage copies only the built artifact onto a tiny base, and the toolchain is discarded.

Runtime stage -- distroless/nodejs24

Build stage -- node:24-trixie-slim

COPY --from=build

toolchain discarded

Source + npm ci + npm run build

dist/ + production node_modules

Not in the final image

Example
a two-stage express image onto distroless
# syntax=docker/dockerfile:1

# ---- build stage: full toolchain ----
FROM node:24-trixie-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci                              # (1) dev + prod deps, build tools
COPY . .
RUN npm run build                       # (2) produces dist/

# ---- runtime stage: distroless, no toolchain ----
FROM gcr.io/distroless/nodejs24-debian13:nonroot   # (3) :nonroot tag → runs as uid 65532
WORKDIR /app
COPY --from=build /app/dist ./dist                 # (4) only the built output
COPY --from=build /app/node_modules ./node_modules # (5) production deps
CMD ["dist/server.js"]                  # (6) distroless node entrypoint runs this
Copy
Annotation (1)–(2) — the build stage holds everything needed to compile: dev dependencies, npm, the source. None of it is copied forward.
Annotation (3) — the :nonroot tag makes the container run as an unprivileged user (uid 65532); the default tag would run as root.
Annotation (4)–(5) — COPY --from=build pulls only the artifact and production dependencies into the clean runtime stage.
Annotation (6) — the distroless Node image’s entrypoint is already node, so CMD is just the script path. The image has no shell, so the exec-form array (required by the The runtime contract — healthchecks, SIGTERM, and non-root topic) is required, not optional.
The FastAPI equivalent copies a virtual environment (/opt/venv) from a python:3.13-slim-trixie build stage onto gcr.io/distroless/python3-debian13:nonroot.
AI Practice
Prompt it
Have Codex convert a single-stage Dockerfile into a multi-stage build, then verify the toolchain did not leak into the final image.

Convert this single-stage Dockerfile for our Express service into a multi-stage
build: a node:24-trixie-slim build stage that runs npm ci and npm run build, and a
gcr.io/distroless/nodejs24-debian13 runtime stage that copies only dist/ and the
production node_modules. Do not copy dev dependencies or source into the runtime
stage. Show the full Dockerfile.
Copy
Watch out
Codex often copies too much into the runtime stage — the whole /app directory (dragging source and dev dependencies along), or it runs npm install again in the runtime stage, defeating the split. It may also pick a runtime base that still has a full shell. Confirm the runtime stage copies only the artifact and production dependencies.

Verify
Build the image and run docker history — confirm the final image has no compiler or dev-dependency layers and the size dropped sharply versus single-stage. Confirm npm and the source tree are absent from the runtime stage (the distroless image has no shell to check from, so inspect via the image layers or a dive view). Record any toolchain leak in your prompt journal.

Knowledge Check
1. What does a multi-stage build keep out of the final image?
The application’s runtime dependencies that it needs to serve requests.
The healthcheck and the non-root user defined in the runtime stage.
The build toolchain and dev dependencies used only to compile.
The base image, which is rebuilt fresh on every single container start.
2. Why choose a distroless or slim base image for the runtime stage?
Fewer packages means less attack surface to patch.
A larger base image starts its containers faster because of better caching.
Distroless images include a full shell that makes production debugging easier.
Slim images automatically pin all of your dependency versions for you.
3. In a Node multi-stage build, what does the runtime stage COPY --from=build?
The entire build stage, including npm, the cache, and the full source tree.
Nothing — the runtime stage reinstalls all dependencies again from scratch.
Only the Dockerfile itself, which Docker then re-runs in the runtime stage.
The built output and production node_modules, not the toolchain.
4. Why does the distroless project recommend python:3.13-slim-trixie as the build stage for gcr.io/distroless/python3-debian13?
Because the slim image is the only base that can run pip at all.
So the build and runtime share a Debian base and avoid ABI mismatches.
Because distroless cannot run Python unless a slim image sits beside it.
Because Trixie is the only Debian release that supports multi-stage builds at all.
3
Topic 3 of 5
Image hygiene — pinned versions, no secrets in layers, scanning
Why Do I Need to Know This?
For a federal cohort, image hygiene is not a nicety — it is a graded gate tied directly to supply-chain risk. An unpinned base image makes a build non-reproducible (you cannot prove what shipped). A secret baked into a layer is an audit finding. A CRITICAL CVE in a shipped image is a release blocker. This is the stakeholder briefing for this lesson: image hygiene for federal supply-chain risk.

The discipline here is also where Codex helps most and is most dangerous: it will happily scaffold an apt-get install with no version, or "handle" a secret by copying it. Your AGENTS.md rules and your own judgment are the guardrails.

Scenario
The team’s image must pass three checks before it is acceptable: every version is pinned, no layer contains a secret, and a vulnerability scan reports zero HIGH or CRITICAL findings — or a documented exception for any that cannot be fixed. Codex’s first draft fails all three: it uses apt-get install -y curl with no version, copies an .env into a layer, and the scan returns two CRITICALs. The team fixes each in turn.

Theory
Pin everything for reproducible, auditable builds
Pin the base image to a specific tag (or digest), and pin OS and language dependencies to exact versions. An unpinned node:24 or apt-get install -y curl resolves to whatever is latest at build time, so two builds of the same commit can differ — which breaks reproducibility and auditability. The AGENTS.md rule for this module is blunt: no apt-get install -y without pinned versions, and no secrets in layers.

Secrets never belong in a layer — use build secrets
As shown in the Images, containers, and the layered filesystem topic, deleting a copied secret does not remove it from the image. The correct tool is a build secret, provided by BuildKit — Docker’s modern build engine: RUN --mount=type=secret mounts the secret at /run/secrets/<id> for the duration of that one RUN and never writes it to any layer. Enable BuildKit with # syntax=docker/dockerfile:1 at the top of the Dockerfile. For values the running container needs (not the build), pass them as runtime environment variables, never COPY .env.

# syntax=docker/dockerfile:1
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc npm ciCopy
Scan, and read the results with judgment
A scanner inspects the built image’s packages against vulnerability databases and reports CVEs by severity. Trivy and Grype are the two the program uses: trivy image --severity HIGH,CRITICAL --exit-code 1 <image> fails the build on any HIGH or CRITICAL. The program runs both because their databases differ, so two scanners catch more than one. The gate is zero HIGH/CRITICAL or a documented exception — because not every CVE has a fix, and a finding in a code path you do not use may be a justified exception. That judgment is the engineer’s, not the tool’s.

!
Important
A documented exception is a decision, not a bypass. When a HIGH/CRITICAL has no available fix, you record the CVE, why it does not apply or cannot be fixed, and who accepted the risk. Deleting the scanner, downgrading the severity, or shipping silently are all how supply-chain incidents start.

The severity gate
Findings are ranked by severity; HIGH and CRITICAL block the release unless each is fixed or carries a documented exception.

CRITICAL — blocks release: fix, or documented exception with sign-off.
HIGH — blocks release: fix, or documented exception with sign-off.
— gate threshold —
MEDIUM — recorded, triaged, does not block this release.
LOW — recorded for awareness.
Example
failing the build on high or critical
# scan the built image; exit non-zero (fails CI) on any HIGH or CRITICAL
trivy image --severity HIGH,CRITICAL --exit-code 1 myorg/filing-api:1.4.2

# Result:
#   myorg/filing-api:1.4.2 (debian 13)
#   Total: 1 (HIGH: 0, CRITICAL: 1)
#   ┌──────────────┬────────────────┬──────────┬─────────────────────────┐
#   │   Library    │ Vulnerability  │ Severity │       Fixed Version     │
#   ├──────────────┼────────────────┼──────────┼─────────────────────────┤
#   │ libsomething │ CVE-2026-12345 │ CRITICAL │ (no fix available)      │
#   └──────────────┴────────────────┴──────────┴─────────────────────────┘
Copy
The --exit-code 1 makes the scan a CI gate, not just a report — the build fails when a HIGH/CRITICAL is present.
This finding has no fix available, so the team cannot simply bump the version.
The correct response is a documented exception: record CVE-2026-12345, note that the affected function is never called by the service, and get sign-off — then allow the build with that one CVE listed as an accepted exception.
A second scanner (grype <image>) is run alongside, because its database may flag something Trivy’s does not.
AI Practice
Prompt it
Have Codex add the scan gate and convert a leaky secret pattern to a build secret, then verify both.

Two changes to our Dockerfile and CI. (1) In the Dockerfile, replace the
`COPY .env .env` line with a BuildKit build secret so the npm registry token is
available during `npm ci` but never written to a layer; add the syntax directive.
(2) In CI, add a Trivy scan step that fails the build on HIGH or CRITICAL findings.
Show the Dockerfile changes and the CI step.
Copy
Watch out
Codex may "fix" the secret by moving the COPY .env to a later stage (still in a layer) instead of using --mount=type=secret, or forget the # syntax=docker/dockerfile:1 directive so the mount flag is unrecognized. For scanning, it may report findings without --exit-code 1, so a CRITICAL does not actually fail CI. Confirm the secret never lands in a layer and the scan is a hard gate.

Verify
Build with the secret and inspect the image layers (or dive) to confirm the token is not present in any layer. Run the Trivy step and confirm it exits non-zero on a seeded HIGH/CRITICAL. Then add a documented exception for one unfixable finding and confirm the build passes with that CVE explicitly listed. Record any secret-in-layer or non-gating scan in your prompt journal.

Knowledge Check
1. Why pin the base image and OS packages to exact versions?
Pinning makes the final image smaller by removing version metadata from layers.
Pinning lets Docker skip the vulnerability scanning step for those packages.
Pinning is required syntax, and the Dockerfile fails to build without it.
Pinning makes builds reproducible and auditable over time.
2. How does RUN --mount=type=secret keep a secret out of the image?
It encrypts the secret inside the layer so that vulnerability scanners cannot read it.
It mounts the secret only for that RUN and never writes it to a layer.
It moves the secret into the final stage, where the layers are later discarded.
It stores the secret in the image metadata instead of in a file layer.
3. A trivy image scan reports one CRITICAL CVE that has no fix available. What does the gate expect?
Ship it silently, since an unfixable CVE is not really the team’s problem.
Delete the scanner from CI so the build passes and the team can ship today.
Document the exception with a reason, or block the release.
Downgrade the finding to LOW so the severity gate stops complaining about it.
4. Why does the program run both Trivy and Grype rather than a single scanner?
Their CVE databases differ, so two scanners catch more than one.
One scanner checks the build stage and the other checks the runtime stage.
Running two scanners is the only way to produce a software bill of materials.
Trivy only finds operating-system CVEs while Grype only finds application CVEs.
4
Topic 4 of 5
The runtime contract — healthchecks, SIGTERM, and non-root
Why Do I Need to Know This?
An image is not deployable until it behaves the way an orchestrator expects. Compose (in 7.2 Docker Compose & LocalStack) and ECS Fargate (in 7.3 ECS Fargate & ALB) decide when a container is healthy and when to stop it — and they stop it by sending a signal. A service that ignores that signal gets killed mid-request; one with no healthcheck receives traffic before it is ready. This runtime contract is the difference between an image that runs and an image that deploys without dropping requests.

It also closes the loop on the rolling deploys you will configure in 7.3 ECS Fargate & ALB: zero-downtime deploys only work if the old task shuts down gracefully and the new one signals readiness.

Scenario
During a rolling deploy the team sees a burst of failed requests. Two causes: the Express service never handled SIGTERM, so the orchestrator killed it while requests were still in flight; and the new task had no healthcheck, so the load balancer routed traffic to it before its database pool was connected. The team adds a SIGTERM handler and a healthcheck, and the next deploy drops zero requests.

Theory
A healthcheck tells the orchestrator when to route traffic
A healthcheck is a command or endpoint the orchestrator polls to decide a container’s state. Distinguish two questions: readiness ("can this instance serve a request right now?" — used to decide whether to send it traffic) and liveness ("is this instance still working, or should it be restarted?"). A service that is up but has not finished connecting to its database is live but not ready — and should not receive traffic yet.

SIGTERM asks for a graceful shutdown; SIGKILL is the deadline
To stop a container, the orchestrator sends SIGTERM and waits a grace period, then sends SIGKILL if the process has not exited. Docker’s default grace period is 10 seconds; ECS Fargate’s stopTimeout defaults to 30 seconds (max 120). On SIGTERM, a well-behaved service stops accepting new work, finishes in-flight requests, closes its connections, and exits cleanly — before the deadline. If it ignores SIGTERM, SIGKILL cuts it off mid-request.

Run as non-root, and use the exec form so the app is PID 1
Two image-side requirements make the signal contract work. Run as a non-root user — defense in depth, and doubly expected for federal images; distroless ships a built-in nonroot user you select with a USER directive (or the :nonroot image tag), since the default tag runs as root. And use the exec form of CMD — CMD ["uvicorn", "app:app"], not CMD uvicorn app:app. The exec form makes your app PID 1 so it receives SIGTERM directly; the shell form wraps it in /bin/sh, which does not forward the signal, so graceful shutdown never fires.

!
Warning
A shell-form CMD is a silent footgun: the container starts fine and serves traffic, but on every stop the signal goes to the shell, not your app, so it is always SIGKILL-ed after the grace period. Use the exec-form array.

A graceful shutdown on SIGTERM
The orchestrator asks the container to stop with SIGTERM; the container drains in-flight work and exits before the grace period, so SIGKILL is never needed.

Container (PID 1 app)
Orchestrator
SIGKILL only fires if the grace period elapses first
SIGTERM (please stop)
1
Stop accepting new requests
2
Finish in-flight requests, close DB pool
3
Exit 0 (graceful)
4
Example
a sigterm handler, healthcheck, and non-root user
const server = app.listen(3000);

// (1) the orchestrator sent SIGTERM — begin graceful shutdown
process.on("SIGTERM", () => {
  server.close(async () => {     // (2) stop new connections, let in-flight finish
    await pool.end();            // (3) close the database pool
    process.exit(0);             // (4) clean exit before the grace deadline
  });
});
Copy
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s \
  CMD ["node", "healthcheck.js"]   # (5) readiness probe the orchestrator polls
USER nonroot                       # (6) never run as root
CMD ["node", "dist/server.js"]     # (7) exec form — app is PID 1, gets SIGTERM
Copy
Annotation (1)–(4) — the handler stops accepting connections, drains in-flight requests, closes the pool, and exits 0 before the grace period, so no request is cut off.
Annotation (5) — HEALTHCHECK gives the orchestrator a readiness signal; --start-period allows time to connect before failures count.
Annotation (6) — USER nonroot drops root; distroless provides this user.
Annotation (7) — the exec-form array is what delivers SIGTERM to the app. The FastAPI equivalent is the same idea: CMD ["uvicorn", "app:app", "--host", "0.0.0.0"] so uvicorn is PID 1 and receives the signal.
AI Practice
Prompt it
Have Codex add graceful shutdown and a healthcheck to one service, then verify the drain actually happens.

Add graceful shutdown and a healthcheck to our Express service. On SIGTERM, stop
accepting new connections, let in-flight requests finish, close the Postgres pool,
and exit 0. Add a Dockerfile HEALTHCHECK that probes a readiness endpoint, run the
container as a non-root user, and use the exec form of CMD. Show the handler and
the Dockerfile lines.
Copy
Watch out
Codex frequently writes CMD in shell form (CMD node dist/server.js), which prevents SIGTERM from reaching the app, and may call process.exit() immediately on SIGTERM without waiting for in-flight requests to drain. It sometimes adds a healthcheck with no start-period, so the container is marked unhealthy during normal startup. Confirm exec-form CMD, a real drain, and a sane start-period.

Verify
Start the container, send it a request, and while it is in flight run docker stop — confirm the in-flight request completes and the container exits 0 rather than being SIGKILL-ed after the grace period. Confirm the process runs as non-root (docker exec won’t work on distroless, so check the image’s configured user). Confirm the healthcheck reports healthy only after startup completes. Record any shell-form CMD or non-draining exit in your prompt journal.

Knowledge Check
1. Why must a containerized service handle SIGTERM?
The orchestrator sends SIGTERM to ask it to finish work and exit.
SIGTERM is the signal that tells the service to start accepting traffic.
Without a SIGTERM handler the container image will fail to build.
SIGTERM increases the container’s memory limit during a deploy.
2. During a rolling deploy, requests are dropped because the old task is killed mid-request. What is the fix?
Increase the number of running tasks so that dropped requests become rare.
Remove the healthcheck so the orchestrator stops the task sooner.
Catch SIGTERM, stop taking new requests, and drain in-flight ones.
Set the stop timeout to zero so the old task exits immediately.
3. What is the difference between a readiness and a liveness healthcheck?
Readiness restarts the container, while liveness routes traffic toward it.
Readiness means it can serve now; liveness means it is still alive.
They are identical, and the two names exist only for historical reasons.
Readiness runs once at startup; liveness only runs during shutdown.
4. Why use the exec form CMD ["uvicorn", "app:app"] instead of the shell form?
The shell form runs faster because it skips Docker’s JSON parsing step.
The exec form lets you use environment variables that the shell form cannot.
The shell form is required so that SIGTERM can reach the app as PID 1.
The exec form makes the app PID 1, so it receives SIGTERM directly.
5
Topic 5 of 5
Practice — containerize both services and pass the image gate
Why Do I Need to Know This?
This lesson’s payoff is two production images you can defend: small, because the toolchain stays in the build stage; safe, because versions are pinned, no secret is in any layer, and the scan is clean or has a documented exception; and deployable, because each handles SIGTERM and exposes a healthcheck. The way to know you have it is to build both images, then attack them — inspect the layers for a leaked secret, run the scanner as a hard gate, and docker stop a container mid-request to confirm it drains instead of dropping. These are the images the Compose stack in 7.2 Docker Compose & LocalStack will run unchanged.

AI Practice
Prompt it
Hands-on practice for this lesson — build production images for both services with Codex, then break each guarantee to confirm it holds.

For both capstone services, produce a multi-stage Dockerfile: a build stage with
the full toolchain (node:24-trixie-slim for Express, python:3.13-slim-trixie for
FastAPI) and a distroless runtime stage (gcr.io/distroless/nodejs24-debian13 and
gcr.io/distroless/python3-debian13) that copies only the built artifact and
production dependencies. Pin the base images, pass any registry token via a
BuildKit build secret (never COPY .env), run as non-root, use exec-form CMD, add a
HEALTHCHECK, and handle SIGTERM with a graceful drain. Then add a CI step that runs
Trivy and Grype and fails on HIGH or CRITICAL. Show both Dockerfiles and the CI step.
Copy
Watch out
Codex is likely to copy the whole build stage forward (dragging the toolchain in), "handle" the secret with a later COPY that still lands in a layer, write a shell-form CMD that swallows SIGTERM, call process.exit() without draining, and add a scan step with no --exit-code 1 so a CRITICAL does not fail the build. Each passes a quick docker run while breaking a real guarantee. Read what the runtime stage copies, where the secret goes, whether CMD is exec form, whether the drain waits, and whether the scan actually gates — before trusting it.

Verify
Build both images and run docker history (or dive): confirm no toolchain or dev dependencies and a sharp size drop versus single-stage. Inspect layers to confirm no secret is present. Run Trivy and Grype and confirm the build fails on a seeded HIGH/CRITICAL, then passes once you add a documented exception for an unfixable one. Send a request to each container and docker stop it mid-flight — confirm the request completes and the container exits 0 before the grace period. Record every guarantee that failed on the first pass in your prompt journal.

