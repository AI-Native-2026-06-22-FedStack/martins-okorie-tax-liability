# ADR-0019. Image Strategy

- Status: Accepted

## Context

Week 7 Day 1 requires local production images for the TaxPulse Core Case Service and FastAPI Tax Engine. There is no cloud surface in this deliverable. The federal image gate requires reproducible builds, no secrets in image layers, non-root runtimes, health signals, graceful shutdown, and a Trivy HIGH/CRITICAL scan gate that either reports zero findings or carries documented exceptions.

Docker sends the project directory as build context before any Dockerfile instruction runs, so context hygiene is part of the control surface. The root `.dockerignore` excludes `.env`, `.env.*`, dependency directories, virtual environments, VCS metadata, build output, caches, and editor/test artifacts before the daemon can copy them into a layer.

## Decision

Both images are Linux amd64 production artifacts. Each Dockerfile defines `ARG TAXPULSE_IMAGE_PLATFORM=linux/amd64` and uses digest-pinned bases for that platform. A different platform must be an explicit build decision with matching base digests.

The Core Case Service image uses these layers:

- Build base: `node:24.17.0-trixie-slim@sha256:b97b310afd056455616802dfddbd6be02c13a345cc64b635e3af3e83e4d902e3`.
- Dependency layer: copy only root workspace manifests, service/package manifests, and `tsconfig.json`, then run `npm ci --workspace=@taxpulse/api` from `package-lock.json`.
- Build layer: copy `apps/api`, `packages/shared-schemas`, `src/typescript`, and the non-secret shared redaction config; bundle `apps/api/src/server.ts` with `esbuild@0.28.1` into `dist/server.js` while keeping production packages external; compile the shared-schemas workspace package into `dist`; generate a Node-based `/health` probe.
- Prune layer: run `npm prune --omit=dev --workspaces --include-workspace-root` in the build stage, never in runtime.
- Runtime base: `gcr.io/distroless/nodejs24-debian13:nonroot@sha256:f987682b3ea8d8e22497cb95edc5014d793612f7064e43df8104394db0ce19fe`.
- Runtime artifact: copy only pruned root/workspace production `node_modules`, the API `package.json`, `dist`, the compiled `packages/shared-schemas` runtime package, and `/shared/redaction-config.json` from the build stage.
- Runtime contract: run as `nonroot`, expose port 3000, use a Node healthcheck, and use exec-form `CMD ["dist/server.js"]`.

The API direct dependencies in `apps/api/package.json` and root production dependencies used by the workspace install are exact versions, and transitive dependencies are pinned by `package-lock.json`. The lockfile also pins patched production transitives used by the image gate, including `fast-uri@3.1.5`, `ip-address@10.3.1`, and `path-to-regexp@0.1.13`. No OS packages are installed with `apt-get`; the OS package set comes only from the pinned base digests.

The Tax Engine image uses these layers:

- Build base: `python:3.13-slim-trixie@sha256:69e18bd8d831d88e0ef70239dc7771ab7c28bc296ae78ac75cde71e60aa4434f`.
- Dependency layer: copy `services/compute/requirements.lock`, then run `python -m pip install --no-cache-dir --require-hashes --target=/opt/python -r /tmp/requirements.lock`.
- Build layer: copy only `services/compute/app`, `services/compute/main.py`, and `packages/shared-schemas/calculation.schema.json`; compile the app with `python -m compileall`.
- Runtime base: `gcr.io/distroless/python3-debian13:nonroot@sha256:cf4327dd87975725c44cae784555f91717af87f3d4d941005106401d9e4cf89c`.
- Runtime artifact: copy only `/opt/python`, `/app/services/compute`, and `/app/packages`.
- Runtime contract: run as `nonroot`, expose port 8000, use a Python standard-library healthcheck, and use exec-form Uvicorn `CMD ["-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]`.

The compute direct runtime dependencies in `services/compute/pyproject.toml` are exact versions. The Docker install uses `services/compute/requirements.lock`, exported from `uv.lock`, so production transitives are pinned with hashes. Test-only `pact-python` is in the dev dependency group and is not emitted into the runtime requirements file.

Build secrets, if private registry access is ever needed, must use BuildKit secret mounts:

```dockerfile
RUN --mount=type=secret,id=npm_token npm ci --workspace=@taxpulse/api
```

The secret must be read only during that instruction and must never be copied into the context or image. Runtime values must be supplied as environment variables by the orchestrator. No `.env` file is copied, and deleting a copied secret in a later layer is not an acceptable remediation.

The image gate is:

```sh
trivy image --severity HIGH,CRITICAL --exit-code 1 taxpulse-api:w7d1
trivy image --severity HIGH,CRITICAL --exit-code 1 taxpulse-compute:w7d1
```

`.trivyignore` is allowed only for ADR-documented exceptions. A control scan with an empty ignore file must fail when those exceptions are removed.

## Exceptions

Accepted risk owner: TaxPulse module engineer for the Week 7 local image deliverable, Martin Sokorie. Accepted on 2026-08-07 for the pinned `gcr.io/distroless/python3-debian13:nonroot` amd64 runtime digest above.

These Trivy HIGH findings are accepted because they are in the pinned distroless Python Debian 13.6 base, Trivy reports no fixed version, the image contains no package manager that can patch them in place, and moving to a different runtime family would break the required slim/distroless Debian strategy. The exceptions must be removed when a fixed distroless Python digest is available.

| CVE | Package(s) | Justification |
| --- | --- | --- |
| `CVE-2025-69720` | `libncursesw6`, `libtinfo6` | Base library finding with no fixed version reported; compute app does not expose terminal/ncurses workflows. |
| `CVE-2026-11940` | `libpython3.13-minimal`, `libpython3.13-stdlib`, `python3.13-minimal`, `python3.13-venv` | Base Python finding with no fixed version reported; app does not call `tarfile.extractall` on untrusted archives. |
| `CVE-2026-15308` | `libpython3.13-minimal`, `libpython3.13-stdlib`, `python3.13-minimal`, `python3.13-venv` | Base Python HTML parser DoS finding with no fixed version reported; app validates JSON calculation payloads and does not parse untrusted HTML. |
| `CVE-2026-7210` | `libpython3.13-minimal`, `libpython3.13-stdlib`, `python3.13-minimal`, `python3.13-venv` | Base Python/Expat XML DoS finding with no fixed version reported; app does not parse untrusted XML. |
| `CVE-2026-53615` | `libuuid1` | Base util-linux library finding with no fixed version reported; app does not inspect disk partition tables or call affected `libblkid` partition parsing paths. |

## Consequences

The runtime images do not include npm, pip, build tools, package-manager caches, local source trees beyond runtime artifacts, test tooling, local environment files, or VCS metadata. Distroless debugging must use logs, healthchecks, and image inspection rather than shell sessions.

The API service owns the identity/auth routes, token minting, token validation, stage transitions, correlation IDs, Problem+JSON responses, and audit behavior in the artifact copied forward. Its SIGTERM handler stops accepting new HTTP connections, waits for `server.close`, closes the default Postgres pool, and exits 0.

The compute service validates caller tokens and returns tax-liability calculations. Uvicorn runs as PID 1 so Docker's SIGTERM reaches it directly and allows in-flight requests to drain before process exit.

The API image passes Trivy HIGH/CRITICAL with zero findings. The compute image passes Trivy HIGH/CRITICAL only with the `.trivyignore` exceptions above; running the same scan with an empty ignore file exits non-zero and reports the 15 HIGH base-package findings.

## Alternatives considered

Single-stage images were rejected because they ship build tools, dev dependencies, package managers, caches, and larger attack surfaces to production.

Alpine images were rejected because both services depend on native components that should build and run on the same Debian/glibc family as the distroless runtimes.

Installing OS packages in Dockerfiles was rejected for this deliverable. There is no required package that justifies adding `apt-get`; avoiding `apt-get` also avoids an extra OS pinning surface.

Shell-form commands and shell-based healthchecks were rejected because distroless images do not include a shell and because exec-form commands deliver SIGTERM directly to the application process.
