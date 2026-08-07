# Prompt Journal: Docker Multi-stage Builds

## Entry 1

Asked — Copy the attached Week 7 Day 1 "Docker & Multi-stage Builds" lesson into the helper directory and create a new prompt journal.

Produced — Saved `helper/week-7-day-1-docker-multi-stage-builds.md` from the provided lesson text and initialized `prompt-journal/0026-docker-multi-stage-builds.md` as the next sequential prompt journal file.

Accepted or rejected — Accepted.

Why — The Week 7 Day 1 Docker and multi-stage builds helper lesson is saved in the repository helper directory and prompt journal 0026 is initialized for the new containerization work.

## Entry 2

Asked — Build the local-only Week 7 Day 1 image deliverable by adding a root `.dockerignore`, multi-stage non-root distroless Dockerfiles for the Core Case Service and FastAPI Tax Engine, ADR-0019 documenting the image strategy, and evidence for toolchain readiness, history, scan, and SIGTERM drain checks.

Produced — Added `.dockerignore`, updated `apps/api/Dockerfile` to build a Node 24 Debian/glibc esbuild artifact into a distroless Node non-root runtime, updated `services/compute/Dockerfile` to install pinned Python 3.13 dependencies into a distroless Python non-root runtime, added `docs/adr/ADR-0019-image-strategy.md`, and added `evidence/week-7-day-1-docker-images.md` with bootstrap smoke results and local verification commands.

Accepted or rejected — Accepted.

Why — The deliverable now has local image definitions, context hygiene, documented standard/slim/distroless choices, and evidence showing Docker BuildKit, build secrets, Node 24, and Python 3.13 are available while Docker daemon access and local scanners still need to be completed on the workstation.

## Entry 3

Asked — Complete Task 1 for the Node/Express `apps/api` Dockerfile by ensuring the build/run split, distroless non-root runtime, HEALTHCHECK, exec-form CMD, graceful SIGTERM drain, and ADR-0019 notes satisfy the rubric.

Produced — Tightened `apps/api/Dockerfile` so production dependencies are pruned in the build stage and the distroless runtime copies only `dist`, `package.json`, and production `node_modules` from that stage. Updated `apps/api/src/server.ts` so SIGTERM waits for `server.close`, closes the default Postgres pool, and exits cleanly. Updated ADR-0019 and evidence to record the production-dependency pruning and database-pool drain behavior.

Accepted or rejected — Accepted.

Why — The Core Case Service image definition now keeps compilers, dev dependencies, source, and `.env` files out of the runtime stage while the service shutdown path drains HTTP work and closes the database pool before exiting.

## Entry 4

Asked — Re-check the local Docker/BuildKit and scanner assumptions, start Docker if needed, and verify the Task 1 `apps/api` image build.

Produced — Started Docker Desktop, confirmed Docker Engine server availability, reran the API image build, found the build failed because the service-local `apps/api/package-lock.json` is stale, and changed `apps/api/Dockerfile` to install from the current root workspace lockfile with `npm ci --workspace=@taxpulse/api`. Confirmed `trivy` and `grype` are not visible on PATH or as Homebrew kegs in this session despite the expected bootstrap note.

Accepted or rejected — Accepted.

Why — The Dockerfile now uses the repo's current reproducible workspace lock for the Core Case Service instead of the stale service-local lockfile that blocked `npm ci`.

## Entry 5

Asked — Finish verifying the Task 1 `apps/api` image with Docker running, scanner gates available, and the Node 24/distroless glibc strategy intact.

Produced — Installed Trivy and Grype with Homebrew, pinned `esbuild@0.28.1` as an explicit API dev dependency, rebuilt `taxpulse-api:w7d1` successfully, inspected image metadata/history, confirmed the image runs as UID `65532`, confirmed `/app/dist/server.js` and `/app/dist/healthcheck.js` exist while `/app/.env` does not, ran the Trivy HIGH/CRITICAL gate successfully, and documented Grype's Debian `libc6` scanner disagreement.

Accepted or rejected — Accepted.

Why — The Core Case Service image now builds locally from a pinned Node 24 Debian toolchain into a distroless non-root runtime, passes the required Trivy gate, and has evidence for runtime layers, healthcheck, user, and artifact hygiene.

## Entry 6

Asked — Write and verify the multi-stage Dockerfile for the FastAPI Tax Engine in `services/compute`, using a Python 3.13 slim build stage, isolated runtime dependencies, a distroless non-root Python runtime, healthcheck, and exec-form Uvicorn shutdown behavior.

Produced — Updated `services/compute/Dockerfile` to install exact runtime dependencies into `/opt/python`, copy only `/opt/python`, the compute app, and the shared calculation schema into `gcr.io/distroless/python3-debian13:nonroot`, run Uvicorn through exec-form `CMD`, and expose a Python standard-library `/health` probe. Built `taxpulse-compute:w7d1`, inspected runtime metadata and layers, confirmed Docker health status, and verified `docker stop` exits cleanly through Uvicorn's graceful shutdown path. Raised the image `cryptography` pin to `50.0.0` to clear the Python package scanner finding and documented the remaining distroless Debian base-image Trivy/Grype findings.

Accepted or rejected — Accepted.

Why — The Tax Engine image now has the requested build/runtime boundary, non-root distroless runtime, healthcheck, and graceful shutdown behavior, with evidence capturing the remaining scanner blocker as an upstream base-image issue.

## Entry 7

Asked — Harden both Docker images to the federal image gate by pinning bases and dependencies, keeping secrets out of layers, enforcing Trivy HIGH/CRITICAL scans, documenting any exceptions, and finishing ADR-0019 layer by layer.

Produced — Digest-pinned both API and compute build/runtime bases with a default `linux/amd64` image platform, exact-pinned API direct dependencies, moved compute runtime installs to a hash-checked `requirements.lock` exported from `uv.lock`, moved Pact to compute dev dependencies, added `.trivyignore` for ADR-0019 accepted distroless Python base exceptions, rebuilt both images, verified runtime layers and no package managers or `.env` artifacts, proved Trivy passes with documented exceptions, and proved the compute gate fails with an empty ignore file.

Accepted or rejected — Accepted.

Why — Both images now build from pinned inputs, preserve secret-free distroless non-root runtime artifacts, and pass the Trivy gate with ADR-documented base-image exceptions where Trivy reports no fixed version.

## Entry 8

Asked — Use the grading rubric to verify the Node API image, FastAPI compute image, image hygiene and scan gate, and ADR-0019 strategy record.

Produced — Ran the rubric checks against the local images, found the API Trivy gate still failed on fixable production Node dependencies, pinned patched `fast-uri`, `ip-address`, `path-to-regexp`, and root workspace dependency ranges, rebuilt `taxpulse-api:w7d1`, reran Trivy successfully on both images, verified non-root/no-secret/no-package-manager runtime probes, confirmed API and compute graceful stop behavior, and updated ADR-0019 plus evidence with the final observed results.

Accepted or rejected — Accepted.

Why — The final local images match the rubric: multi-stage distroless non-root runtimes, exec-form health/drain contracts, pinned inputs, no copied `.env`, passing Trivy gates, and strategy/evidence documentation that reflects the actual image layers.
