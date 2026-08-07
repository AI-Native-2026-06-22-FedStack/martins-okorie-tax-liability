# Week 7 Day 1 Docker Images Evidence

## Bootstrap Smoke

Command results from the local toolchain check:

- `docker buildx version` — `github.com/docker/buildx v0.34.1-desktop.1 c79576280a671664e17eb68da98ec3136b614aed`
- `DOCKER_BUILDKIT=1 docker build --help` — help output includes `--secret`, so BuildKit build secrets are available.
- `docker info` — Docker Desktop daemon is available after launching Docker Desktop; server version `29.5.3`.
- `trivy --version` — `Version: 0.73.0`.
- `grype --version` — `grype 0.116.1`.
- `node --version` — `v24.17.0`
- `python3 --version` — `Python 3.13.2`

## Image Build Commands

```sh
DOCKER_BUILDKIT=1 docker build -f apps/api/Dockerfile -t taxpulse-api:w7d1 .
DOCKER_BUILDKIT=1 docker build -f services/compute/Dockerfile -t taxpulse-compute:w7d1 .
```

Final hardening result on 2026-08-07:

- API build base pinned to `node:24.17.0-trixie-slim@sha256:b97b310afd056455616802dfddbd6be02c13a345cc64b635e3af3e83e4d902e3`.
- API runtime base pinned to `gcr.io/distroless/nodejs24-debian13:nonroot@sha256:f987682b3ea8d8e22497cb95edc5014d793612f7064e43df8104394db0ce19fe`.
- Compute build base pinned to `python:3.13-slim-trixie@sha256:69e18bd8d831d88e0ef70239dc7771ab7c28bc296ae78ac75cde71e60aa4434f`.
- Compute runtime base pinned to `gcr.io/distroless/python3-debian13:nonroot@sha256:cf4327dd87975725c44cae784555f91717af87f3d4d941005106401d9e4cf89c`.
- Both Dockerfiles default `TAXPULSE_IMAGE_PLATFORM=linux/amd64`.
- API direct dependencies are exact in `apps/api/package.json`; root workspace production dependencies used by the image are exact in `package.json`; transitives are pinned by `package-lock.json`.
- Compute direct runtime dependencies are exact in `services/compute/pyproject.toml`; production transitives are pinned with hashes in `services/compute/requirements.lock`.
- No Dockerfile uses `apt-get`; there are no unversioned OS package installs.
- `.trivyignore` contains only ADR-0019 accepted exceptions for the current distroless Python base.

## Layer Inspection Commands

```sh
docker history taxpulse-api:w7d1
docker history taxpulse-compute:w7d1
```

Expected proof points:

- Runtime stages are distroless `:nonroot` images.
- API runtime copies only pruned production `node_modules`, the API `package.json`, `dist`, compiled `packages/shared-schemas`, and the non-secret shared redaction config from the build stage after `npm prune --omit=dev --workspaces --include-workspace-root`.
- Compute runtime copies only `/opt/python`, `/app/services/compute`, and `/app/packages`.
- `.env`, `.env.*`, local dependency directories, virtual environments, caches, and VCS metadata are excluded by `.dockerignore`.

Observed API image result:

- `DOCKER_BUILDKIT=1 docker build -f apps/api/Dockerfile -t taxpulse-api:w7d1 .` — passed.
- Final BuildKit context transfer after `.dockerignore` was about 494.90 KB.
- `docker image inspect taxpulse-api:w7d1 --format '{{.RepoTags}} {{.Size}} {{.Config.User}} {{json .Config.Healthcheck}} {{json .Config.Cmd}}'` — size `63,413,751` bytes, user `nonroot`, cmd `["dist/server.js"]`, healthcheck `CMD /nodejs/bin/node /app/dist/healthcheck.js`, interval `10s`, timeout `3s`, start period `20s`, retries `3`.
- `docker history --no-trunc taxpulse-api:w7d1` — runtime-added layers are `COPY /workspace/node_modules ./node_modules` (`80MB`), `COPY /workspace/apps/api/node_modules ./node_modules` (`557kB`), `COPY /workspace/apps/api/package.json ./package.json` (`12.3kB`), `COPY /workspace/apps/api/dist ./dist` (`106kB`), `COPY /workspace/packages/shared-schemas ./packages/shared-schemas` (`5.44MB`), and `COPY /workspace/shared/redaction-config.json /shared/redaction-config.json` (`12.3kB`), plus metadata for `USER`, `HEALTHCHECK`, and `CMD`.

Observed compute image result:

- `DOCKER_BUILDKIT=1 docker build -f services/compute/Dockerfile -t taxpulse-compute:w7d1 .` — passed after correcting the build base to the available `python:3.13-slim-trixie` tag and later pinning the base by digest.
- `docker image inspect taxpulse-compute:w7d1 --format '{{.RepoTags}} {{.Size}} {{.Config.User}} {{json .Config.Healthcheck}} {{json .Config.Cmd}}'` — size `34,914,397` bytes, user `nonroot`, cmd `["-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]`, healthcheck `CMD /usr/bin/python3 -c ... /health`, interval `10s`, timeout `3s`, start period `20s`, retries `3`.
- `docker history --no-trunc taxpulse-compute:w7d1` — runtime-added layers are `COPY /opt/python /opt/python` (`41.2MB`), `COPY /app/services/compute /app/services/compute` (`127kB`), and `COPY /app/packages /app/packages` (`20.5kB`), plus metadata for `USER`, `HEALTHCHECK`, and `CMD`. No pip, build-tool, or cache layer is added by the runtime Dockerfile.
- Final runtime probes: `docker run --rm --entrypoint /nodejs/bin/node taxpulse-api:w7d1 -e '...'` printed `{"uid":65532,"env":false,"npm":false,"dist":true,"sharedSchemas":true,"redaction":true}`. `docker run --rm --entrypoint /usr/bin/python3 taxpulse-compute:w7d1 -c '...'` printed `{'uid': 65532, 'env': False, 'pip': False, 'app': True}`.

## Local Static Validation

Commands that do not require the Docker daemon:

- `npx esbuild apps/api/src/server.ts --bundle --platform=node --target=node24 --format=esm --outfile=/tmp/taxpulse-api-bundle/server.js --external:argon2 --external:pg-native` — passed and produced a 4.4 MB API bundle.
- `python3 -m compileall -q services/compute/app` — passed.
- `rg -n 'apt-get|COPY .*\\.env|latest|\\^|>=' apps/api/Dockerfile services/compute/Dockerfile package.json apps/api/package.json services/compute/pyproject.toml` — found only Node/Python engine lower-bound declarations, not Dockerfile package installs, `.env` copies, `latest` tags, or unpinned direct dependencies.
- `git diff --check` — passed.
- `npm run test --workspace=apps/api` — ran with Docker available, but failed in pre-existing integration areas: 19 files passed, 9 failed, 1 skipped; failures include missing workspace-local `apps/api/packages/shared-schemas/*` paths and refused connections to local DynamoDB/LocalStack at `localhost:8000`.
- `DOCKER_BUILDKIT=1 docker build -f apps/api/Dockerfile -t taxpulse-api:w7d1 .` — initially failed when using the stale `apps/api/package-lock.json`; the Dockerfile now installs from the root workspace lockfile instead.
- `docker run --rm --entrypoint /nodejs/bin/node taxpulse-api:w7d1 -e 'console.log(process.getuid())'` — passed and printed `65532`, confirming the runtime runs as the distroless non-root user.
- `docker run --rm --entrypoint /nodejs/bin/node taxpulse-api:w7d1 -e 'const fs=require("fs"); console.log(fs.existsSync("/app/dist/server.js"), fs.existsSync("/app/dist/healthcheck.js"), fs.existsSync("/app/.env"))'` — passed and printed `true true false`, confirming the server artifact and healthcheck exist and `.env` is absent from `/app`.

## Scan Gate Commands

```sh
trivy image --severity HIGH,CRITICAL --exit-code 1 taxpulse-api:w7d1
trivy image --severity HIGH,CRITICAL --exit-code 1 taxpulse-compute:w7d1
grype taxpulse-api:w7d1 --fail-on high
grype taxpulse-compute:w7d1 --fail-on high
```

Observed API scan result:

- `trivy image --db-repository ghcr.io/aquasecurity/trivy-db:2 --severity HIGH,CRITICAL --exit-code 1 taxpulse-api:w7d1` — passed with exit code 0. Trivy detected Debian 13.6 and Node package files and reported 0 HIGH/CRITICAL vulnerabilities.
- During rubric verification, the API scan initially failed on fixable Node package findings in `fast-uri@3.1.4`, `ip-address@10.2.0`, and `path-to-regexp@0.1.7`; the workspace dependency pins and lockfile now carry patched production versions, and the final API image passes the same Trivy command.
- `grype taxpulse-api:w7d1 --fail-on high` — failed with exit code 2. Grype reported Debian `libc6` findings including `CVE-2026-5450` Critical, `CVE-2026-5928` High, and `CVE-2026-5435` High, all marked `(won't fix)`, plus lower-severity findings. Trivy remains the required hard gate for this deliverable; the Grype disagreement is documented for review if a second scanner is enforced.

Observed compute scan result:

- Initial Trivy scan found one Python-package HIGH for `cryptography==49.0.0`; the compute Dockerfile now pins `cryptography==50.0.0`, which removed the Python dependency finding.
- `trivy image --db-repository ghcr.io/aquasecurity/trivy-db:2 --severity HIGH,CRITICAL --exit-code 1 taxpulse-compute:w7d1` — passed with exit code 0 after applying the ADR-0019 `.trivyignore` exceptions for the distroless Python base.
- Control scan: `trivy image --ignorefile /tmp/taxpulse-empty-trivyignore --db-repository ghcr.io/aquasecurity/trivy-db:2 --severity HIGH,CRITICAL --exit-code 1 taxpulse-compute:w7d1` — failed with exit code 1 and reported 15 HIGH, 0 CRITICAL findings from base packages. This proves the gate fails without the documented exceptions.
- Accepted Trivy exception CVEs are `CVE-2025-69720`, `CVE-2026-11940`, `CVE-2026-15308`, `CVE-2026-7210`, and `CVE-2026-53615`, all documented in ADR-0019 with package scope, justification, and risk owner.
- `grype taxpulse-compute:w7d1 --fail-on high` — failed with exit code 2 on base-image HIGH/CRITICAL findings, including Debian libc findings marked `(won't fix)`. `cryptography` no longer appears as a Grype finding after the image pin was raised to `50.0.0`.

## SIGTERM Drain Smoke

API graceful shutdown is implemented in `apps/api/src/server.ts`: the process listens for `SIGINT` and `SIGTERM`, calls `server.close`, closes the default Postgres pool with `closeDefaultDb`, and exits after the HTTP server stops accepting new connections and drains existing ones.

Manual smoke command pattern:

```sh
docker run --rm --name taxpulse-api-smoke -p 3000:3000 taxpulse-api:w7d1
docker stop --time 10 taxpulse-api-smoke
docker inspect taxpulse-api-smoke --format '{{.State.ExitCode}}'
```

For the FastAPI Tax Engine, Uvicorn is run as PID 1 through exec-form `CMD`, so it receives Docker's `SIGTERM` directly during `docker stop`.

Current API smoke status:

- `docker run -d --name taxpulse-api-rubric -p 13000:3000 ... taxpulse-api:w7d1` with a synthetic local Secrets Manager-compatible endpoint — container started from the final rebuilt image.
- `docker inspect taxpulse-api-rubric --format '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{else}}no-health{{end}} {{.State.ExitCode}}'` — returned `running healthy 0`.
- Logs showed repeated `GET /health` responses with status `200`.
- `docker stop --timeout 10 taxpulse-api-rubric` followed by `docker inspect taxpulse-api-rubric --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}'` — returned `exited 0 false`.
- Logs showed `received SIGTERM; closing taxpulse-api` and `taxpulse-api closed`, confirming the exec-form command delivered SIGTERM to the Node process and the drain completed before exit.

Current compute smoke status:

- `docker run -d --name taxpulse-compute-smoke-$(date +%s) -p 18000:8000 taxpulse-compute:w7d1` — container started and reached Docker health status `healthy`.
- `docker inspect <container> --format '{{json .State.Health}}'` — health log entries exited `0`, and container logs show `GET /health HTTP/1.1" 200 OK`.
- Host `curl http://127.0.0.1:18000/health` failed with connection refused in this sandboxed session, but the in-container healthcheck and Uvicorn access log confirm the app served `/health`.
- `docker stop --time 10 <container>` followed by `docker inspect <container> --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}'` — returned `exited 0 false`.
- Container logs showed Uvicorn's graceful sequence: application startup complete, health probes handled, shutdown started, application shutdown complete, and server process finished.
