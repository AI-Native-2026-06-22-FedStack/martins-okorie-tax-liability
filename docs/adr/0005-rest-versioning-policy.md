# ADR-0005: REST Versioning and Deprecation Policy

- Status: Proposed

## Context

TaxPulse exposes a REST API that wealth-advisor firms and partner systems can integrate with. Once a consumer builds against the API, a breaking change can become a consumer outage. We need a versioning policy before wider consumption, plus a standard way to announce that an older route remains available for a bounded time and has a documented successor.

## Decision

We use URL versioning as the primary REST versioning strategy. Versioned API routes are mounted under `/v1`, and future breaking versions will use a new URL prefix such as `/v2`.

We choose URL versioning because it is explicit for external consumers, easy to route, easy to test with ordinary HTTP tools, and cache-friendly. We considered Accept-header versioning, but rejected it for the MVP because it keeps URLs visually stable at the cost of harder browser/manual testing and a greater chance that intermediaries cache the wrong representation if headers are not configured perfectly.

The unversioned `/health`, `/ready`, `/openapi.json`, and `/docs` routes remain unversioned operational/documentation endpoints. Plan Cycle API routes are served under `/v1`.

Deprecated routes remain available for at least 6 months after the deprecation date. A deprecated route must emit:

1. `Deprecation` using the RFC 9745 date format, represented as an `@` Unix timestamp.
2. `Sunset` using the RFC 8594 HTTP-date format, no earlier than the deprecation date.
3. `Link` with `rel="successor-version"` pointing to the replacement.

The current deprecated route is `GET /v1/cycles/ping`, deprecated on July 15, 2026 and scheduled to sunset on January 15, 2027. Its successor is the unversioned operational `GET /health` route.

## Breaking Change Classification

- Renaming an existing response field that consumers read is breaking and requires a new API version.
- Removing a route is breaking and requires a new API version or a deprecation/sunset period before removal.
- Adding a new optional response field is non-breaking and may ship in place.

## Consequences

- External consumers can see the API version directly in the URL they call.
- The OpenAPI document must publish versioned Plan Cycle paths so `/docs` matches the served routes.
- Deprecated routes have a concrete removal timeline instead of an open-ended warning.
- TaxPulse must maintain old and new versions during the deprecation window when a breaking replacement ships.

## Alternatives Considered

- Accept-header versioning: Rejected for now because it is less visible to consumers, harder to test manually, and easier for caches to mishandle. It remains a possible future option if API gateway tooling later standardizes version negotiation.
- Unversioned API with only additive changes: Rejected because the product will eventually need breaking contract changes, and consumers need a predictable migration path.
