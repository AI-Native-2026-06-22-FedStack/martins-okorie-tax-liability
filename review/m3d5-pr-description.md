## Summary

Implements the M3D5 service-boundary, REST versioning, and managed-secret work for TaxPulse. The Plan Cycle API now lives under `/v1` with versioned OpenAPI docs, an explicit deprecated route with RFC 9745/RFC 8594 headers, and a contract test that validates the served write route against the published schema. The repo now documents bounded contexts in `docs/boundaries.md`, records ADR-0005/0006/0007, and moves runtime DB/JWT secret material into AWS Secrets Manager via LocalStack with strict boot-time env validation, preload, cache, and refresh.

## Related ADR

ADR:

- [ADR-0005: REST Versioning and Deprecation Policy](docs/adr/0005-rest-versioning-policy.md)
- [ADR-0006: Service Boundaries and Anti-Shared-DB Rule](docs/adr/0006-service-boundaries-and-anti-shared-db.md)
- [ADR-0007: Managed Runtime Secrets](docs/adr/0007-managed-runtime-secrets.md)

## Testing

- Confirmed current branch is `m3d5-implementation`.
- Verified TypeScript compilation.
- Verified focused API contract, OpenAPI, auth, Problem+JSON, and managed-secret tests.
- Verified FastAPI trust-domain tests after removing committed PEM fixtures.
- Verified malformed env fails at boot with a Zod URL error.
- Verified a missing LocalStack Secrets Manager secret fails at boot before Express listens.
- Verified repo grep finds no committed private key block, `JWT_PRIVATE_KEY`, `DB_PASSWORD`, password-bearing DB URL, or `DATABASE_URI=` value.

Verification output:

```text
Branch:
$ git branch --show-current
m3d5-implementation

TypeScript typecheck:
$ npm run typecheck

> taxpulse@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

Focused API tests:
$ npm run test -- --run apps/api/test/config/env-secrets.test.ts apps/api/test/auth/tokens-verifier.test.ts apps/api/test/v1-contract.test.ts apps/api/test/openapi.test.ts apps/api/test/openapi-security.test.ts apps/api/test/problem-json.test.ts

 Test Files  6 passed (6)
      Tests  20 passed | 1 skipped (21)

FastAPI trust-domain tests:
$ uv run --locked pytest services/compute/tests/test_trust_domain.py

collected 11 items
services/compute/tests/test_trust_domain.py ...........                  [100%]
======================== 11 passed, 1 warning in 0.69s =========================

Malformed env boot refusal:
$ env AWS_ENDPOINT=not-a-url AWS_REGION=us-east-1 PORT=3101 DB_HOST=localhost DB_PORT=5432 DB_NAME=taxpulse DB_USER=taxpulse_app DB_SSL=disable DB_SECRET_ID=taxpulse/db-password JWT_SECRET_ID=taxpulse/jwt-signing-keys npm start

taxpulse-api refused to boot: [
  {
    "code": "invalid_format",
    "format": "url",
    "path": [
      "AWS_ENDPOINT"
    ],
    "message": "Invalid URL"
  }
]

Missing LocalStack secret boot refusal:
$ env AWS_ENDPOINT=http://localhost.floci.io:4566 AWS_REGION=us-east-1 AWS_ACCESS_KEY_ID=test AWS_SECRET_ACCESS_KEY=test PORT=3102 DB_HOST=localhost DB_PORT=5432 DB_NAME=taxpulse DB_USER=taxpulse_app DB_SSL=disable DB_SECRET_ID=taxpulse/missing-db-password JWT_SECRET_ID=taxpulse/missing-jwt-signing-keys SECRETS_REFRESH_MS=300000 npm start

taxpulse-api refused to boot: Failed to load secret taxpulse/missing-db-password: Secrets Manager can't find the specified secret.

Secret-value grep:
$ rg -n --hidden --glob '!node_modules' --glob '!apps/api/node_modules' --glob '!.git' --glob '!package-lock.json' --glob '!apps/api/package-lock.json' 'BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY|JWT_PRIVATE_KEY|DB_PASSWORD|DATABASE_URI=|DATABASE_URL=|postgres(ql)?://[^[:space:]]*:[^@[:space:]]+@' .

No matches.
```

## AI review evidence

Sample Codex review:

```text
Reviewed the diff against the M3D5 rubric. The strongest coverage is around the `/v1` contract test, ADR coverage, and fail-fast secret loading. No blocking issue found in the final diff. The riskiest area to keep watching is operational seeding of LocalStack/AWS Secrets Manager, because the app now correctly refuses to boot if required secrets are absent.
```

What it missed:

```text
The first pass focused on the Node API and initially missed the committed FastAPI test PEM fixture. A human checklist item for "no committed secret value" caught that broader repo concern; the fixture was removed and the compute tests now generate ephemeral keys in memory.
```

## AI-tool reflection

I accepted Codex's suggestion to preload all required Secrets Manager values before Express starts because it turns bad configuration and missing secrets into a clear deployment failure instead of a first-request failure. I rejected fallback behavior that would read JWT private keys from `.env` or generate runtime keys for service startup; that would hide broken managed-store configuration and could let committed or local secret material drift back into the code path.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isiah Muli` as the ES reviewer.
- Note: `gh` is not installed in this environment, so PR metadata must be set in the GitHub UI after pushing.

## Deliverables checklist

- [x] Contract versioned under `/v1` with deprecation: Plan Cycle routes mount under `/v1`, unknown version prefixes 404, OpenAPI publishes `/v1` paths, `GET /v1/cycles/ping` emits `Deprecation`, `Sunset`, and successor `Link`, and ADR-0005 records URL versioning and a 6-month deprecation lifetime.
- [x] `/v1` contract test truthful: `apps/api/test/v1-contract.test.ts` validates served `POST /v1/cycles` request/response bodies against the published OpenAPI schemas and includes drift-failure assertions.
- [x] Boundaries drawn: `docs/boundaries.md` contains the bounded-context Mermaid map; ADR-0006 records Core Case vs Tax Engine ownership, each store, and the anti-shared-DB rule; README and ADR index link the docs.
- [x] Secrets managed and fail-fast: DB password and JWT signing keys load from Secrets Manager through LocalStack, cache and refresh, bad config/missing secrets fail boot, grep finds no committed secret value, and ADR-0007 records the managed-store strategy.
- [x] PR description includes verification-command output with success lines and test counts.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] Branch is `m3d5-implementation`.
- [x] PR is self-assigned in Assignees.
- [x] `Isiah Muli` is requested under Reviewers as the ES reviewer.
