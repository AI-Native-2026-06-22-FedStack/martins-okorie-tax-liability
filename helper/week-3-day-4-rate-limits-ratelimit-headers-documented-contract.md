# Week 3 · Day 4

# Rate Limits, RateLimit Headers & the Documented Contract

Protect the secured routes from abuse and publish the contract — token-bucket vs fixed-window rate limiting enforced in-process with a shared store, standard RateLimit headers and a graduated slow-down, and an OpenAPI 3.1 document that describes auth, errors, and limits.

## Topics

### 1. Rate-limiting strategies — token bucket vs fixed window

- **Fixed Window**: Counts requests per fixed clock interval (e.g. per minute). Can allow up to double the limit at the boundary window reset (e.g., all budget spent at the end of window A and start of window B).
- **Token Bucket**: Accumulates tokens continuously at a steady rate. Allows controlled short bursts (spending saved tokens) and smooths out traffic over the long run without boundary doubling effects.
- **Per-route policies**: Limiting criteria and thresholds are tailored to route costs (e.g. cheap read routes vs expensive write routes calling downstream services).

### 2. Enforcing limits in-process — shared store and graduated slow-down

- **In-process memory vs Shared Store**: Default memory storage is per-process, multiplying limits in multi-instance setups. Redis (`rate-limit-redis` + `ioredis`) solves this by sharing a single source of truth count across all Express processes.
- **Graduated Slow-Down (`express-slow-down` v2)**: Introduces back-pressure by adding a delay to client requests before a hard `429` rejection is returned. Ramps up delays as requests approach limits.
- **Limiting placement**: Limiting is implemented inside the Express application rather than gateway infrastructure for this sprint.

### 3. Communicating limits — RateLimit headers and a clear 429

- **IETF RateLimit headers draft**: (draft-ietf-httpapi-ratelimit-headers, not RFC 9239). Emits the draft-8 combined form, for example `RateLimit: "100-in-1min"; r=97; t=42`, and policy `RateLimit-Policy: "100-in-1min"; q=100; w=60; pk=:tenant:`.
- **Cost-accounting headers**: Emits `X-Request-Cost` for the route cost and `X-Quota-Remaining` derived from the `RateLimit` header's `r=` value.
- **429 Responses**: Returns `429 Too Many Requests` status, includes `Retry-After: <seconds>` header, and uses the standard RFC 9457 `Problem+JSON` error structure.

### 4. Documenting the secured contract in OpenAPI 3.1

- **Security definition**: Register `bearerAuth` security scheme in `@asteasolutions/zod-to-openapi` registry.
- **Route annotations**: Mark protected paths as requiring security, and document `401 Unauthorized` and `429 Too Many Requests` responses (with `Retry-After` and `RateLimit` headers).
