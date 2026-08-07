# Week 7 Day 1 PR — Hardened Multi-stage Service Images

## Summary

Adds local production Docker images for the TaxPulse Core Case Service and FastAPI Tax
Engine. Both services now build in full-toolchain stages and run on distroless non-root
runtimes with healthchecks, exec-form commands, pinned inputs, no copied secrets, and a
Trivy HIGH/CRITICAL scan gate documented in ADR-0019.

## Related ADR

ADR: [ADR-0019: Image Strategy](../docs/adr/ADR-0019-image-strategy.md)

## Verification

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
- Reviewers: request the ES reviewer.

## Deliverables checklist

- [X] Verification output included as a code block.
- [X] Docker history or image inspection shows small non-root runtime images and no build-tool runtime layer.
- [X] Trivy image result included, with documented compute exceptions listed.
- [X] Docker stop evidence shows graceful drain and `exit 0`, not SIGKILL.
- [X] AI-tool reflection includes one accepted suggestion and one rejected suggestion.
- [X] Deliverables checklist included at bottom.
- [X] PR self-assigned.
- [X] ES requested under Reviewers.
