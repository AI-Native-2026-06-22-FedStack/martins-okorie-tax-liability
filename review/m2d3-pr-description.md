## Summary

Adds the M2D3 Express API skeleton for TaxPulse. The API boots with Express 5, parses and logs before routes, exposes `/health`, wires Tax Plan Cycle routes through route, controller, service, and repository layers, validates requests and responses with Zod v4 schemas, returns RFC 9457 Problem+JSON errors, and generates OpenAPI 3.1 docs from the same Zod schemas at `/openapi.json` with Scalar docs at `/docs`.

## Testing

- Confirmed current branch: `m2d3-implementation`.
- Verified the Express service boots with `npm run dev`.
- Verified `POST /cycles` and `GET /cycles/:id` parse input through `.parse` and use `x-tenant-id` as the pre-auth tenant context.
- Verified the final error middleware returns Problem+JSON for malformed input, unknown cycle ids, unknown routes, and forced server errors.
- Verified `/openapi.json` is generated OpenAPI 3.1 and `/docs` renders Scalar HTML.
- `npx tsc -p apps/api/tsconfig.json --noEmit`
- `npm run typecheck`
- `npm test`
- `npm run test -- --passWithNoTests` from `apps/api`

Verification output:

```text
Branch:
$ git branch --show-current
m2d3-implementation

API typecheck:
$ npx tsc -p apps/api/tsconfig.json --noEmit
PASS

Root typecheck:
$ npm run typecheck

> taxpulse@0.1.0 typecheck
> tsc -p tsconfig.json --noEmit

PASS

Root tests:
$ npm test

> taxpulse@0.1.0 test
> vitest run

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability

 ✓ src/typescript/stage-transition.test.ts  (3 tests) 3ms
 ✓ src/typescript/tax-liability.test.ts  (4 tests) 12ms
 ✓ apps/api/test/openapi.test.ts  (1 test) 6ms
 ↓ apps/api/test/plan-cycle-queue.test.ts  (2 tests | 2 skipped)
 ↓ apps/api/test/problem-json.test.ts  (1 test | 1 skipped)

 Test Files  3 passed | 2 skipped (5)
      Tests  8 passed | 3 skipped (11)

API package tests:
$ cd apps/api
$ npm run test -- --passWithNoTests

> @taxpulse/api@0.1.0 test
> vitest run --passWithNoTests

 RUN  v2.0.5 /Users/martinsokorie/Desktop/martins-okorie-tax-liability/apps/api

 ✓ test/openapi.test.ts  (1 test) 2ms
 ✓ test/problem-json.test.ts  (1 test) 32ms
 ✓ test/plan-cycle-queue.test.ts  (2 tests) 74ms

 Test Files  3 passed (3)
      Tests  4 passed (4)

Dev server:
$ cd apps/api
$ npm run dev

> @taxpulse/api@0.1.0 dev
> tsx watch src/server.ts

taxpulse-api listening on port 3000

Missing-field 400:
$ curl -s -i -X POST localhost:3000/cycles \
  -H 'content-type: application/json' \
  -H 'x-tenant-id: 11111111-1111-4111-8111-111111111111' \
  -d '{"planning_period":"2026 Q4","owner":"Fictional Advisor","priority":"P1","due_date":"2026-12-31"}'

HTTP/1.1 400 Bad Request
Content-Type: application/problem+json; charset=utf-8

{"detail":"client_id: Invalid input: expected string, received undefined","instance":"/cycles","status":400,"title":"Invalid Request","type":"about:blank"}

Unknown-cycle 404:
$ curl -s -i localhost:3000/cycles/44444444-4444-4444-8444-444444444444 \
  -H 'x-tenant-id: 11111111-1111-4111-8111-111111111111'

HTTP/1.1 404 Not Found
Content-Type: application/problem+json; charset=utf-8

{"detail":"Tax Plan Cycle 44444444-4444-4444-8444-444444444444 was not found for this tenant.","instance":"/cycles/44444444-4444-4444-8444-444444444444","status":404,"title":"Not Found","type":"about:blank"}

Unknown-route 404:
$ curl -s -i localhost:3000/no-such-route

HTTP/1.1 404 Not Found
Content-Type: application/problem+json; charset=utf-8

{"detail":"No route matched GET /no-such-route","instance":"/no-such-route","status":404,"title":"Not Found","type":"about:blank"}

Forced 500:
$ curl -s -i localhost:3000/cycles/error

HTTP/1.1 500 Internal Server Error
Content-Type: application/problem+json; charset=utf-8

{"detail":"The API encountered an unexpected error.","instance":"/cycles/error","status":500,"title":"Internal Server Error","type":"about:blank"}

Generated OpenAPI:
$ curl -s localhost:3000/openapi.json

{
  "openapi": "3.1.0",
  "paths": [
    "/cycles",
    "/cycles/{id}"
  ],
  "createFields": [
    "client_id",
    "due_date",
    "hold_reason",
    "on_hold",
    "owner",
    "planning_period",
    "priority"
  ],
  "responseFields": [
    "client_id",
    "created_at",
    "due_date",
    "hold_reason",
    "id",
    "on_hold",
    "owner",
    "planning_period",
    "priority",
    "stage",
    "tenant_id",
    "updated_at"
  ]
}

Scalar docs:
$ curl -s -i localhost:3000/docs

HTTP/1.1 200 OK
Content-Type: text/html; charset=utf-8

<!doctype html>
<html>
  <head>
    <title>Scalar API Reference</title>
```

## AI-tool reflection

I accepted Codex's canonical Express ordering with `express.json()` and `pinoHttp()` before routes, then routes, 404 handling, and the final four-argument error middleware because that ordering lets Express 5 forward async controller failures into one Problem+JSON contract. I rejected the shortcut of treating `req.body` as `CreateCycleRequest` with a cast because that would skip runtime validation; the final controller calls Zod `.parse` and the TypeScript types come from `z.infer`, so the runtime contract and compile-time contract share the same source.

## PR routing

- Assignees: self-assign this PR.
- Reviewers: request `Isaiah Muli` as the ES reviewer.

## Deliverables checklist

- [x] Layered skeleton in correct order: `app.ts` wires parse + log first, routes, 404, and the four-argument error handler last; `/health` responds; the service imports no HTTP types; `npm run dev` boots.
- [x] Zod-validated routes: `POST /cycles` and `GET /cycles/:id` parse input with `.parse`, schemas live in one module, types use `z.infer`, and the read route is tenant-scoped through `x-tenant-id`.
- [x] Problem+JSON error contract: one last-registered middleware maps `ZodError` to 400 with fields, `NotFoundError` to 404, and unknown errors to generic 500 with no stack trace; API responses use `application/problem+json`; a unit test asserts the 400 body.
- [x] Code-first OpenAPI: docs are generated from the same Zod schemas, served at `/openapi.json`, rendered at `/docs`, and tested as OpenAPI 3.1 covering create and read operations.
- [x] PR description includes curl probe output for 400, unknown-cycle 404, unknown-route 404, and forced 500 Problem+JSON responses.
- [x] AI-tool reflection names one accepted Codex suggestion and one rejected Codex suggestion, with reasons.
- [x] PR is self-assigned in Assignees.
- [x] `Isaiah Muli` is requested under Reviewers as the ES reviewer.
