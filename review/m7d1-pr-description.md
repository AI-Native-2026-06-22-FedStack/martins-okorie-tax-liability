# Week 7 Day 1 PR — Hardened Multi-stage Service Images

## Summary

Adds local production Docker images for the TaxPulse Core Case Service and FastAPI Tax
Engine. Both services now build in full-toolchain stages and run on distroless non-root
runtimes with healthchecks, exec-form commands, pinned inputs, no copied secrets, and a
Trivy HIGH/CRITICAL scan gate documented in ADR-0019.

## Related ADR

ADR: [ADR-0019: Image Strategy](../docs/adr/ADR-0019-image-strategy.md)

## Testing

- `DOCKER_BUILDKIT=1 docker build -f apps/api/Dockerfile -t taxpulse-api:w7d1 .`
- `DOCKER_BUILDKIT=1 docker build -f services/compute/Dockerfile -t taxpulse-compute:w7d1 .`
- `trivy image --db-repository ghcr.io/aquasecurity/trivy-db:2 --severity HIGH,CRITICAL --exit-code 1 taxpulse-api:w7d1`
- `trivy image --db-repository ghcr.io/aquasecurity/trivy-db:2 --severity HIGH,CRITICAL --exit-code 1 taxpulse-compute:w7d1`
- `git diff --check`

Docker image verification output:

```text
$ docker image inspect taxpulse-api:w7d1 taxpulse-compute:w7d1 --format '{{.RepoTags}} {{.Size}} {{.Config.User}} {{json .Config.Healthcheck}} {{json .Config.Cmd}}'
[taxpulse-api:w7d1] 63413751 nonroot {"Test":["CMD","/nodejs/bin/node","/app/dist/healthcheck.js"],"Interval":10000000000,"Timeout":3000000000,"StartPeriod":20000000000,"Retries":3} ["dist/server.js"]
[taxpulse-compute:w7d1] 34914397 nonroot {"Test":["CMD","/usr/bin/python3","-c","import os, sys, urllib.request; port=os.environ.get('PORT','8000'); req=urllib.request.Request(f'http://127.0.0.1:{port}/health'); sys.exit(0 if urllib.request.urlopen(req, timeout=2).status < 500 else 1)"],"Interval":10000000000,"Timeout":3000000000,"StartPeriod":20000000000,"Retries":3} ["-m","uvicorn","app.main:app","--host","0.0.0.0","--port","8000"]

$ docker history --no-trunc taxpulse-api:w7d1
COPY /workspace/node_modules ./node_modules
COPY /workspace/apps/api/node_modules ./node_modules
COPY /workspace/apps/api/package.json ./package.json
COPY /workspace/apps/api/dist ./dist
COPY /workspace/packages/shared-schemas ./packages/shared-schemas
COPY /workspace/shared/redaction-config.json /shared/redaction-config.json
USER nonroot
HEALTHCHECK CMD /nodejs/bin/node /app/dist/healthcheck.js
CMD ["dist/server.js"]

$ docker history --no-trunc taxpulse-compute:w7d1
COPY /opt/python /opt/python
COPY /app/services/compute /app/services/compute
COPY /app/packages /app/packages
USER nonroot
HEALTHCHECK CMD /usr/bin/python3 -c ... /health
CMD ["-m" "uvicorn" "app.main:app" "--host" "0.0.0.0" "--port" "8000"]

$ docker run --rm --entrypoint /nodejs/bin/node taxpulse-api:w7d1 -e '...'
{"uid":65532,"env":false,"npm":false,"dist":true,"sharedSchemas":true,"redaction":true}

$ docker run --rm --entrypoint /usr/bin/python3 taxpulse-compute:w7d1 -c '...'
{'uid': 65532, 'env': False, 'pip': False, 'app': True}

$ trivy image --db-repository ghcr.io/aquasecurity/trivy-db:2 --severity HIGH,CRITICAL --exit-code 1 taxpulse-api:w7d1
Result: exit 0, 0 HIGH/CRITICAL vulnerabilities.

$ trivy image --db-repository ghcr.io/aquasecurity/trivy-db:2 --severity HIGH,CRITICAL --exit-code 1 taxpulse-compute:w7d1
Result: exit 0 with ADR-0019 documented .trivyignore exceptions:
CVE-2025-69720, CVE-2026-11940, CVE-2026-15308, CVE-2026-7210, CVE-2026-53615.

$ docker inspect taxpulse-api-rubric --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}'
exited 0 false

$ docker logs --tail 25 taxpulse-api-rubric
received SIGTERM; closing taxpulse-api
taxpulse-api closed

$ docker inspect taxpulse-compute-rubric --format '{{.State.Status}} {{.State.ExitCode}} {{.State.OOMKilled}}'
exited 0 false

$ docker logs --tail 40 taxpulse-compute-rubric
INFO:     Shutting down
INFO:     Waiting for application shutdown.
INFO:     Application shutdown complete.
INFO:     Finished server process [1]
```

## AI review evidence

AI review output:

```text
Codex review of the local Docker image diff:
- apps/api uses a multi-stage Dockerfile from a digest-pinned Node 24 slim build base to a digest-pinned distroless Node 24 non-root runtime.
- services/compute uses a multi-stage Dockerfile from a digest-pinned Python 3.13 slim build base to a digest-pinned distroless Python non-root runtime.
- Runtime layers copy only production artifacts: pruned Node dependencies plus built API/shared-schema output, and hash-locked Python packages plus compute app/schema files.
- Both runtime images run as nonroot, define HEALTHCHECK instructions with startup grace, and use exec-form commands so Docker SIGTERM reaches the application process.
- .dockerignore excludes .env, .env.*, dependency folders, virtual environments, VCS metadata, caches, and build output before the build context reaches Docker.
- Trivy HIGH/CRITICAL scanning is a hard gate with --exit-code 1; the API image is clean, and the compute image passes with only ADR-0019 documented base-image exceptions.
```

What it missed:

```text
The first verification pass missed fixable production Node findings in the API image:
fast-uri@3.1.4, ip-address@10.2.0, and path-to-regexp@0.1.7. Those were not accepted as
exceptions. The lockfile and workspace pins were updated, the API image was rebuilt, and
the final Trivy gate passed with 0 HIGH/CRITICAL findings.
```

## AI-tool reflection

I accepted Codex's recommendation to use exec-form commands in both runtime stages
because Docker delivers `SIGTERM` directly to the Node process and uvicorn as PID 1,
which the smoke tests confirmed with clean `exit 0` shutdowns instead of SIGKILL. I
rejected treating scanner output as informational only; the Trivy command had to include
`--exit-code 1`, and when the API image surfaced fixable HIGH findings in production Node
dependencies, I pinned patched versions and rebuilt instead of documenting an avoidable
exception.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli` as the ES reviewer.

## AI code-review checklist

- [X] `apps/api` Dockerfile uses a multi-stage Node 24 slim build and distroless Node 24 non-root runtime.
- [X] `services/compute` Dockerfile uses a multi-stage Python 3.13 slim build and distroless Python non-root runtime.
- [X] Runtime stages copy only production artifacts and dependencies, not the full build stage, package-manager caches, or local source cruft.
- [X] Dockerfiles use exec-form commands and healthchecks suitable for orchestrator readiness checks.
- [X] API SIGTERM handling drains the HTTP server and closes the default database pool before exiting 0.
- [X] Uvicorn runs as PID 1 and shuts down cleanly on `docker stop`.
- [X] Base images are digest-pinned, direct language dependencies are pinned, and production Python transitives are hash-locked.
- [X] `.dockerignore` and Dockerfile copy boundaries keep `.env`, credentials, VCS metadata, virtualenvs, and dependency folders out of the build context or runtime layers.
- [X] Trivy HIGH/CRITICAL scan gate runs with `--exit-code 1`; accepted exceptions are documented in ADR-0019.
- [X] Significant AI-assisted work is recorded in the prompt journal.

## Deliverables checklist

- [X] Verification output included as a code block.
- [X] Docker history or image inspection shows small non-root runtime images and no build-tool runtime layer.
- [X] Trivy image result included, with documented compute exceptions listed.
- [X] Docker stop evidence shows graceful drain and `exit 0`, not SIGKILL.
- [X] AI-tool reflection includes one accepted suggestion and one rejected suggestion.
- [X] Deliverables checklist included at bottom.
- [X] PR self-assigned.
- [X] `Isaiah Muli` requested under Reviewers as the ES reviewer.
